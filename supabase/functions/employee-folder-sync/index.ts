// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_RUN = 60;

function ghHeaders() {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const DRIVE = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!DRIVE) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return { Authorization: `Bearer ${LOVABLE}`, "X-Connection-Api-Key": DRIVE };
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a|mei|servicos|servico|comercio|de|da|do|e)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCnpjs(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) ?? []) {
    const d = m.replace(/\D/g, "");
    if (d.length === 14) out.add(d);
  }
  return [...out];
}

function extractCpf(text: string): string | null {
  const m = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

function guessDocKind(name: string): string {
  const n = normalizeText(name);
  if (n.includes("admiss")) return "admissao";
  if (n.includes("rescis") || n.includes("demiss")) return "rescisao";
  if (n.includes("ferias")) return "ferias";
  if (n.includes("holerite") || n.includes("contracheque") || n.includes("recibo")) return "folha";
  if (n.includes("ficha")) return "ficha";
  if (n.includes("contrato")) return "contrato";
  return "outros";
}

interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  path: string;
}

async function listFolderRecursive(rootId: string): Promise<DriveFileEntry[]> {
  const result: DriveFileEntry[] = [];
  const queue: { id: string; path: string }[] = [{ id: rootId, path: "" }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > 300) break;

    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams();
      params.set("q", `'${id}' in parents and trashed=false`);
      params.set("fields", "nextPageToken, files(id,name,mimeType,size,modifiedTime)");
      params.set("pageSize", "1000");
      if (pageToken) params.set("pageToken", pageToken);
      const r = await fetch(`${DRIVE_GATEWAY}/files?${params}`, { headers: ghHeaders() });
      if (!r.ok) throw new Error(`list [${r.status}]: ${await r.text()}`);
      const data = await r.json();
      for (const f of data.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          queue.push({ id: f.id, path: path ? `${path} / ${f.name}` : f.name });
        } else {
          result.push({
            id: f.id, name: f.name, mimeType: f.mimeType,
            modifiedTime: f.modifiedTime, size: f.size, path,
          });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return result;
}

async function aiExtractEmployee(haystack: string): Promise<{ full_name: string; cpf: string; position: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const empty = { full_name: "", cpf: "", position: "" };
  if (!LOVABLE_API_KEY) return empty;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Você identifica dados de um funcionário a partir do caminho/nome de um arquivo de departamento pessoal brasileiro. Retorne o nome completo do funcionário (sem tipo de documento, sem nome da empresa), CPF apenas com dígitos e o cargo, se houver. Se não souber, retorne string vazia.",
          },
          { role: "user", content: `Caminho do arquivo:\n${haystack}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_employee",
            description: "Dados do funcionário",
            parameters: {
              type: "object",
              properties: {
                full_name: { type: "string" },
                cpf: { type: "string" },
                position: { type: "string" },
              },
              required: ["full_name", "cpf", "position"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_employee" } },
      }),
    });
    if (!r.ok) {
      console.warn("ai extract failed", r.status, await r.text());
      return empty;
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? { ...empty, ...JSON.parse(args) } : empty;
  } catch (e) {
    console.warn("ai extract error", (e as Error).message);
    return empty;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    let authorized = !!expectedSecret && cronSecret === expectedSecret;

    if (!authorized) {
      const auth = req.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ")) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        });
        const { data: claimsData } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
        authorized = !!claimsData?.claims?.sub;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cfg } = await supabase
      .from("employee_sync_config")
      .select("*")
      .eq("enabled", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!cfg) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhuma pasta configurada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: clients } = await supabase
      .from("clients").select("id, company_name, document, status");
    const clientsByCnpj = new Map<string, any>();
    for (const c of clients ?? []) {
      const digits = (c.document || "").replace(/\D/g, "");
      if (digits) clientsByCnpj.set(digits, c);
    }

    const files = await listFolderRecursive(cfg.folder_id);
    const { data: known } = await supabase
      .from("employee_documents").select("id, drive_file_id, drive_modified_time, employee_id");
    const knownById = new Map<string, any>((known ?? []).map((k: any) => [k.drive_file_id, k]));

    const stats = { novos: 0, atualizados: 0, funcionarios: 0, revisao: 0, erros: 0, ignorados: 0 };
    let processed = 0;

    for (const f of files) {
      const prev = knownById.get(f.id);
      if (prev && f.modifiedTime && prev.drive_modified_time === f.modifiedTime) continue;

      if (f.mimeType.startsWith("application/vnd.google-apps.")) {
        if (!prev) {
          await supabase.from("employee_documents").insert({
            drive_file_id: f.id, file_name: f.name, drive_path: f.path,
            drive_modified_time: f.modifiedTime ?? null, status: "pending_review",
            error: "Arquivo nativo do Google não suportado",
          } as any);
          stats.ignorados++;
        }
        continue;
      }

      if (Number(f.size ?? 0) > MAX_FILE_BYTES) {
        await supabase.from("employee_documents").upsert({
          drive_file_id: f.id, file_name: f.name, drive_path: f.path,
          drive_modified_time: f.modifiedTime ?? null, status: "pending_review",
          error: "Arquivo acima de 20 MB",
        } as any, { onConflict: "drive_file_id" });
        stats.erros++;
        continue;
      }

      if (processed >= MAX_FILES_PER_RUN) break;
      processed++;

      try {
        const haystack = `${f.path} / ${f.name}`;

        // 1) Empresa: CNPJ no caminho
        let client: any = null;
        for (const cnpj of extractCnpjs(haystack)) {
          const hit = clientsByCnpj.get(cnpj);
          if (hit) { client = hit; break; }
        }
        // 2) Empresa: razão social na pasta
        if (!client) {
          const normHay = normalizeText(haystack);
          let best: any = null; let bestLen = 0;
          for (const c of clients ?? []) {
            const normName = normalizeText(c.company_name || "");
            if (normName.length >= 6 && normHay.includes(normName) && normName.length > bestLen) {
              best = c; bestLen = normName.length;
            }
          }
          client = best;
        }

        // 3) Funcionário: CPF no caminho, senão IA
        let cpf = extractCpf(haystack);
        let fullName = "";
        let position = "";
        if (!cpf || !fullName) {
          const ai = await aiExtractEmployee(haystack);
          if (!cpf && ai.cpf) {
            const d = ai.cpf.replace(/\D/g, "");
            if (d.length === 11) cpf = d;
          }
          fullName = (ai.full_name || "").trim();
          position = (ai.position || "").trim();
        }

        if (!client || (!cpf && !fullName)) {
          await supabase.from("employee_documents").upsert({
            drive_file_id: f.id, file_name: f.name, drive_path: f.path,
            drive_modified_time: f.modifiedTime ?? null, status: "pending_review",
            client_id: client?.id ?? null,
            doc_kind: guessDocKind(f.name),
            error: !client ? "Empresa não identificada" : "Funcionário não identificado",
          } as any, { onConflict: "drive_file_id" });
          stats.revisao++;
          continue;
        }

        // Localiza ou cria o funcionário
        let employee: any = null;
        if (cpf) {
          const { data } = await supabase.from("client_employees")
            .select("*").eq("client_id", client.id).eq("cpf", cpf).limit(1);
          employee = data?.[0] ?? null;
        }
        if (!employee && fullName) {
          const { data } = await supabase.from("client_employees")
            .select("*").eq("client_id", client.id).ilike("full_name", fullName).limit(1);
          employee = data?.[0] ?? null;
        }
        if (!employee) {
          const { data, error } = await supabase.from("client_employees").insert({
            client_id: client.id,
            full_name: fullName || `Funcionário ${cpf}`,
            cpf: cpf,
            position: position || null,
            source: "drive",
          } as any).select("*").single();
          if (error) throw error;
          employee = data;
          stats.funcionarios++;
        } else {
          const patch: any = {};
          if (!employee.cpf && cpf) patch.cpf = cpf;
          if (!employee.position && position) patch.position = position;
          if (Object.keys(patch).length > 0) {
            await supabase.from("client_employees").update(patch).eq("id", employee.id);
          }
        }

        // Download e upload
        const r = await fetch(`${DRIVE_GATEWAY}/files/${f.id}?alt=media`, { headers: ghHeaders() });
        if (!r.ok) throw new Error(`download [${r.status}]: ${await r.text()}`);
        const bytes = new Uint8Array(await r.arrayBuffer());
        const storagePath = `${client.id}/pessoal/${employee.id}/${sanitizeFileName(f.name)}`;
        const { error: upErr } = await supabase.storage
          .from("documents").upload(storagePath, bytes, { upsert: true, contentType: f.mimeType });
        if (upErr) throw upErr;

        await supabase.from("employee_documents").upsert({
          drive_file_id: f.id, file_name: f.name, drive_path: f.path,
          drive_modified_time: f.modifiedTime ?? null, status: "imported",
          employee_id: employee.id, client_id: client.id,
          storage_path: storagePath, doc_kind: guessDocKind(f.name),
          parsed_at: new Date().toISOString(), error: null,
        } as any, { onConflict: "drive_file_id" });

        if (prev) stats.atualizados++; else stats.novos++;
      } catch (e) {
        console.error(`Erro em ${f.name}:`, e);
        await supabase.from("employee_documents").upsert({
          drive_file_id: f.id, file_name: f.name, drive_path: f.path,
          drive_modified_time: f.modifiedTime ?? null, status: "error",
          error: (e as Error).message?.slice(0, 500),
        } as any, { onConflict: "drive_file_id" });
        stats.erros++;
      }
    }

    await supabase.from("employee_sync_config")
      .update({ last_synced_at: new Date().toISOString() }).eq("id", cfg.id);

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("employee-folder-sync error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
