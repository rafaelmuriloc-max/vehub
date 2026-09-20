// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

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
  for (const m of text.match(/\b\d{14}\b/g) ?? []) out.add(m);
  return [...out];
}

function normalizeSci(v: string): string {
  const d = (v || "").replace(/\D/g, "").replace(/^0+/, "");
  return d;
}

// Códigos SCI presentes no nome/caminho: E00195, 00195, 195-, [195] etc.
function extractSciCodes(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(/(?:^|[^0-9a-zA-Z])[a-zA-Z]?0*\d{1,6}(?=[^0-9]|$)/g) ?? []) {
    const n = normalizeSci(m);
    if (n && n.length <= 6) out.add(n);
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

function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function normalizeSalary(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  path: string;
}

interface ParsedEmployee {
  full_name: string;
  cpf: string | null;
  position: string | null;
  admission_date: string | null;
  salary: number | null;
  termination_date: string | null;
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

async function pdfToText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text) ?? "";
  } catch (e) {
    console.warn("pdf text extraction failed:", (e as Error).message);
    return "";
  }
}

async function aiExtractChunk(haystack: string, docText: string): Promise<ParsedEmployee[] | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `Você extrai a relação de funcionários de documentos de departamento pessoal brasileiros (ficha de registro, folha de pagamento, relação de empregados etc.).
Retorne TODOS os funcionários encontrados no documento — um documento pode conter dezenas de pessoas.
Regras:
- full_name: nome completo da pessoa, sem cargo, sem empresa, sem tipo de documento.
- cpf: apenas os 11 dígitos; string vazia se não houver.
- position: cargo/função; string vazia se não houver.
- admission_date e termination_date: formato AAAA-MM-DD; string vazia se não houver.
- salary: valor numérico do salário mensal; string vazia se não houver.
- Não invente dados. Não inclua sócios, contadores, testemunhas ou responsáveis pela empresa.
- Se o texto não trouxer nenhum funcionário, retorne a lista vazia.`,
          },
          {
            role: "user",
            content: `Caminho do arquivo: ${haystack}\n\nTexto do documento:\n${docText}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_employees",
            description: "Lista de funcionários encontrados no documento",
            parameters: {
              type: "object",
              properties: {
                employees: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      full_name: { type: "string" },
                      cpf: { type: "string" },
                      position: { type: "string" },
                      admission_date: { type: "string" },
                      salary: { type: "string" },
                      termination_date: { type: "string" },
                    },
                    required: ["full_name", "cpf", "position", "admission_date", "salary", "termination_date"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["employees"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_employees" } },
      }),
    });
    if (!r.ok) {
      console.warn("ai extract failed", r.status, await r.text());
      return null;
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args);
    const list: ParsedEmployee[] = [];
    for (const e of parsed.employees ?? []) {
      const name = String(e.full_name ?? "").trim();
      const cpfDigits = String(e.cpf ?? "").replace(/\D/g, "");
      if (!name && cpfDigits.length !== 11) continue;
      list.push({
        full_name: name,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
        position: String(e.position ?? "").trim() || null,
        admission_date: normalizeDate(e.admission_date),
        salary: normalizeSalary(e.salary),
        termination_date: normalizeDate(e.termination_date),
      });
    }
    return list;
  } catch (e) {
    console.warn("ai extract error", (e as Error).message);
    return [];
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
      .from("clients").select("id, company_name, document, status, sci_code");
    const clientsByCnpj = new Map<string, any>();
    const clientsBySci = new Map<string, any>();
    for (const c of clients ?? []) {
      const digits = (c.document || "").replace(/\D/g, "");
      if (digits) clientsByCnpj.set(digits, c);
      const sci = normalizeSci(String(c.sci_code ?? ""));
      if (sci && !clientsBySci.has(sci)) clientsBySci.set(sci, c);
    }

    const files = await listFolderRecursive(cfg.folder_id);
    const { data: known } = await supabase
      .from("employee_documents").select("drive_file_id, drive_modified_time, status");
    const knownById = new Map<string, any>((known ?? []).map((k: any) => [k.drive_file_id, k]));

    const stats = {
      arquivos_novos: 0, arquivos_atualizados: 0, fichas_lidas: 0,
      funcionarios_criados: 0, funcionarios_atualizados: 0,
      revisao: 0, erros: 0, ignorados: 0,
    };
    let processed = 0;

    for (const f of files) {
      const prev = knownById.get(f.id);
      // Arquivos em revisão são sempre reprocessados
      if (prev && prev.status !== "pending_review" && f.modifiedTime && prev.drive_modified_time === f.modifiedTime) continue;


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

      const markPending = async (reason: string, clientId: string | null) => {
        await supabase.from("employee_documents").delete().eq("drive_file_id", f.id);
        await supabase.from("employee_documents").insert({
          drive_file_id: f.id, file_name: f.name, drive_path: f.path,
          drive_modified_time: f.modifiedTime ?? null, status: "pending_review",
          client_id: clientId, doc_kind: guessDocKind(f.name), error: reason,
        } as any);
        stats.revisao++;
      };

      try {
        const haystack = `${f.path} / ${f.name}`;

        // Download do arquivo (necessário para ler o conteúdo)
        const r = await fetch(`${DRIVE_GATEWAY}/files/${f.id}?alt=media`, { headers: ghHeaders() });
        if (!r.ok) throw new Error(`download [${r.status}]: ${await r.text()}`);
        const bytes = new Uint8Array(await r.arrayBuffer());

        const isPdf = f.mimeType === "application/pdf" || /\.pdf$/i.test(f.name);
        const docText = isPdf ? await pdfToText(bytes) : "";
        const searchSpace = `${haystack}\n${docText}`;

        // Empresa: CNPJ (caminho/conteúdo) → código SCI (nome/caminho) → razão social (caminho/conteúdo)
        let client: any = null;
        const cnpjs = extractCnpjs(searchSpace);
        for (const cnpj of cnpjs) {
          const hit = clientsByCnpj.get(cnpj);
          if (hit) { client = hit; break; }
        }
        const scis = extractSciCodes(haystack);
        if (!client) {
          for (const sci of scis) {
            const hit = clientsBySci.get(sci);
            if (hit) { client = hit; break; }
          }
        }
        if (!client) {
          const normHay = normalizeText(haystack);
          const normDoc = normalizeText(docText.slice(0, 5000));
          let best: any = null; let bestLen = 0;
          for (const c of clients ?? []) {
            const normName = normalizeText(c.company_name || "");
            if (normName.length >= 6 && (normHay.includes(normName) || normDoc.includes(normName)) && normName.length > bestLen) {
              best = c; bestLen = normName.length;
            }
          }
          client = best;
        }

        if (!client) {
          await markPending(
            `Empresa não identificada (texto do PDF: ${docText.trim().length} caracteres; CNPJs vistos: ${cnpjs.join(", ") || "nenhum"}; códigos vistos: ${scis.join(", ") || "nenhum"})`,
            null,
          );
          continue;
        }


        if (isPdf && docText.trim().length < 40) {
          await markPending("PDF sem texto legível (documento escaneado)", client.id);
          continue;
        }

        // Funcionários: todos os presentes no documento
        let parsedEmployees = await aiExtractEmployees(haystack, docText);

        // Fallback: um único funcionário pelo CPF/nome do arquivo
        if (parsedEmployees.length === 0) {
          const cpf = extractCpf(haystack);
          if (cpf) {
            parsedEmployees = [{
              full_name: "", cpf, position: null,
              admission_date: null, salary: null, termination_date: null,
            }];
          }
        }

        if (parsedEmployees.length === 0) {
          await markPending("Nenhum funcionário identificado no arquivo", client.id);
          continue;
        }

        stats.fichas_lidas++;

        // Sobe o arquivo uma única vez
        const storagePath = `${client.id}/pessoal/${sanitizeFileName(f.name)}`;
        const { error: upErr } = await supabase.storage
          .from("documents").upload(storagePath, bytes, { upsert: true, contentType: f.mimeType });
        if (upErr) throw upErr;

        // Regrava os vínculos deste arquivo
        await supabase.from("employee_documents").delete().eq("drive_file_id", f.id);

        const linkedIds = new Set<string>();
        for (const pe of parsedEmployees) {
          let employee: any = null;
          if (pe.cpf) {
            const { data } = await supabase.from("client_employees")
              .select("*").eq("client_id", client.id).eq("cpf", pe.cpf).limit(1);
            employee = data?.[0] ?? null;
          }
          if (!employee && pe.full_name) {
            const { data } = await supabase.from("client_employees")
              .select("*").eq("client_id", client.id).ilike("full_name", pe.full_name).limit(1);
            employee = data?.[0] ?? null;
          }

          if (!employee) {
            const { data, error } = await supabase.from("client_employees").insert({
              client_id: client.id,
              full_name: pe.full_name || `Funcionário ${pe.cpf}`,
              cpf: pe.cpf,
              position: pe.position,
              admission_date: pe.admission_date,
              salary: pe.salary,
              termination_date: pe.termination_date,
              status: pe.termination_date ? "terminated" : "active",
              source: "drive",
            } as any).select("*").single();
            if (error) throw error;
            employee = data;
            stats.funcionarios_criados++;
          } else {
            // Completa apenas os campos vazios — nunca sobrescreve dado manual
            const patch: any = {};
            if (!employee.cpf && pe.cpf) patch.cpf = pe.cpf;
            if (!employee.position && pe.position) patch.position = pe.position;
            if (!employee.admission_date && pe.admission_date) patch.admission_date = pe.admission_date;
            if (employee.salary == null && pe.salary != null) patch.salary = pe.salary;
            if (!employee.termination_date && pe.termination_date) {
              patch.termination_date = pe.termination_date;
              patch.status = "terminated";
            }
            if (Object.keys(patch).length > 0) {
              await supabase.from("client_employees").update(patch).eq("id", employee.id);
              stats.funcionarios_atualizados++;
            }
          }

          if (linkedIds.has(employee.id)) continue;
          linkedIds.add(employee.id);

          await supabase.from("employee_documents").insert({
            drive_file_id: f.id, file_name: f.name, drive_path: f.path,
            drive_modified_time: f.modifiedTime ?? null, status: "imported",
            employee_id: employee.id, client_id: client.id,
            storage_path: storagePath, doc_kind: guessDocKind(f.name),
            parsed_at: new Date().toISOString(), error: null,
          } as any);
        }

        if (prev) stats.arquivos_atualizados++; else stats.arquivos_novos++;
      } catch (e) {
        console.error(`Erro em ${f.name}:`, e);
        await supabase.from("employee_documents").delete().eq("drive_file_id", f.id);
        await supabase.from("employee_documents").insert({
          drive_file_id: f.id, file_name: f.name, drive_path: f.path,
          drive_modified_time: f.modifiedTime ?? null, status: "error",
          error: (e as Error).message?.slice(0, 500),
        } as any);
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
