// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // ~20 MB (limite prático do conector)
const MAX_FILES_PER_RUN = 40;

function ghHeaders(extra: Record<string, string> = {}) {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const DRIVE = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!DRIVE) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return {
    Authorization: `Bearer ${LOVABLE}`,
    "X-Connection-Api-Key": DRIVE,
    ...extra,
  };
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
  const re = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  for (const m of text.match(re) ?? []) {
    const d = m.replace(/\D/g, "");
    if (d.length === 14) out.add(d);
  }
  return [...out];
}

function extractReferenceMonth(text: string): string | null {
  // YYYY-MM
  let m = text.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])\b/);
  if (m) return `${m[1]}-${m[2]}`;
  // MM/YYYY ou MM-YYYY
  m = text.match(/\b(0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (m) return `${m[2]}-${m[1]}`;
  const months: Record<string, string> = {
    janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09",
    outubro: "10", novembro: "11", dezembro: "12",
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  const low = text.toLowerCase();
  for (const [name, mm] of Object.entries(months)) {
    const re = new RegExp(`\\b${name}\\b[^0-9]{0,10}\\b(20\\d{2})\\b`);
    const hit = low.match(re);
    if (hit) return `${hit[1]}-${mm}`;
  }
  return null;
}

interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  path: string; // folder path, ex.: "Clientes / Empresa X"
}

async function listFolderRecursive(
  rootId: string,
  rootName: string,
): Promise<DriveFileEntry[]> {
  const result: DriveFileEntry[] = [];
  const queue: { id: string; path: string }[] = [{ id: rootId, path: "" }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > 200) break; // segurança contra estruturas gigantes

    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams();
      params.set("q", `'${id}' in parents and trashed=false`);
      params.set("fields", "nextPageToken, files(id,name,mimeType,size,modifiedTime)");
      params.set("pageSize", "1000");
      if (pageToken) params.set("pageToken", pageToken);
      const r = await fetch(`${DRIVE_GATEWAY}/files?${params}`, { headers: ghHeaders() });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`list [${r.status}]: ${t}`);
      }
      const data = await r.json();
      for (const f of data.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          queue.push({ id: f.id, path: path ? `${path} / ${f.name}` : f.name });
        } else {
          result.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime,
            size: f.size,
            path,
          });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return result;
}

async function downloadDriveBytes(fileId: string): Promise<Uint8Array> {
  const r = await fetch(`${DRIVE_GATEWAY}/files/${fileId}?alt=media`, { headers: ghHeaders() });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`download [${r.status}]: ${t}`);
  }
  return new Uint8Array(await r.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Auth: cron secret OU usuário admin
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    let authorized = !!expectedSecret && cronSecret === expectedSecret;

    if (!authorized) {
      const auth = req.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ")) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        });
        const token = auth.replace("Bearer ", "");
        const { data: claimsData } = await userClient.auth.getClaims(token);
        const userId = claimsData?.claims?.sub as string | undefined;
        if (userId) {
          const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
          authorized = !!isAdmin;
        }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* cron pode chamar sem body */ }

    // Configs ativas
    let cfgQuery = supabase.from("drive_sync_configs").select("*").eq("enabled", true);
    if (body?.config_id) cfgQuery = cfgQuery.eq("id", body.config_id);
    const { data: configs, error: cfgErr } = await cfgQuery;
    if (cfgErr) throw cfgErr;

    // Clientes e tipos de documento
    const [{ data: clients }, { data: docTypes }] = await Promise.all([
      supabase.from("clients").select("id, company_name, document, status"),
      supabase.from("document_types").select("id, name, description"),
    ]);
    const clientsByCnpj = new Map<string, any>();
    for (const c of clients ?? []) {
      const digits = (c.document || "").replace(/\D/g, "");
      if (digits) clientsByCnpj.set(digits, c);
    }

    const summary: any[] = [];

    for (const cfg of configs ?? []) {
      const stats = { config_id: cfg.id, folder: cfg.folder_name, novos: 0, atualizados: 0, revisao: 0, ignorados: 0, erros: 0 };
      try {
        const files = await listFolderRecursive(cfg.folder_id, cfg.folder_name);

        const { data: synced } = await supabase
          .from("drive_synced_files")
          .select("*")
          .eq("config_id", cfg.id);
        const syncedById = new Map<string, any>((synced ?? []).map((s: any) => [s.drive_file_id, s]));

        const allowedTypeIds: string[] = cfg.allowed_doc_type_ids ?? [];
        const allowedTypes = (docTypes ?? []).filter((t: any) => allowedTypeIds.includes(t.id));

        let processed = 0;
        for (const f of files) {
          const prev = syncedById.get(f.id);
          const modifiedChanged = !prev || (f.modifiedTime && prev.drive_modified_time !== f.modifiedTime);

          if (prev && !modifiedChanged) continue; // sem alteração

          // Tipos nativos do Google (Docs/Sheets) — não baixáveis como binário
          if (f.mimeType.startsWith("application/vnd.google-apps.")) {
            if (!prev) {
              await supabase.from("drive_synced_files").insert({
                config_id: cfg.id, drive_file_id: f.id, drive_name: f.name, drive_path: f.path,
                drive_modified_time: f.modifiedTime ?? null, status: "ignored",
                error: "Arquivo nativo do Google (Docs/Sheets) não suportado",
              });
              stats.ignorados++;
            }
            continue;
          }

          if (Number(f.size ?? 0) > MAX_FILE_BYTES) {
            await supabase.from("drive_synced_files").upsert({
              config_id: cfg.id, drive_file_id: f.id, drive_name: f.name, drive_path: f.path,
              drive_modified_time: f.modifiedTime ?? null, status: "error",
              error: "Arquivo acima de 20 MB",
            }, { onConflict: "config_id,drive_file_id" });
            stats.erros++;
            continue;
          }

          if (processed >= MAX_FILES_PER_RUN) break;
          processed++;

          try {
            const haystack = `${f.path} / ${f.name}`;

            // 1) CNPJ no caminho/nome
            let client: any = null;
            for (const cnpj of extractCnpjs(haystack)) {
              const hit = clientsByCnpj.get(cnpj);
              if (hit) { client = hit; break; }
            }

            // 2) Nome da subpasta/arquivo vs razão social
            if (!client) {
              const normHay = normalizeText(haystack);
              let best: any = null;
              let bestLen = 0;
              for (const c of clients ?? []) {
                if (c.status !== "active") continue;
                const normName = normalizeText(c.company_name || "");
                if (normName.length >= 6 && normHay.includes(normName) && normName.length > bestLen) {
                  best = c; bestLen = normName.length;
                }
              }
              client = best;
            }

            // 3) Competência pelo nome/caminho
            let refMonth = extractReferenceMonth(haystack);

            // 4) IA como apoio (nome do arquivo + caminho)
            let aiTypeName = "";
            if ((!client || !refMonth) && allowedTypes.length > 0) {
              try {
                const { data: ai } = await supabase.functions.invoke("classify-document", {
                  body: {
                    text: `Caminho no Drive: ${haystack}`,
                    document_types: allowedTypes.map((t: any) => ({ name: t.name, description: t.description })),
                    mode: "full",
                  },
                });
                if (ai) {
                  if (!client && ai.cnpj) {
                    const d = String(ai.cnpj).replace(/\D/g, "");
                    const hit = clientsByCnpj.get(d)
                      ?? [...clientsByCnpj.entries()].find(([k]) => d.length === 8 && k.startsWith(d))?.[1];
                    if (hit) client = hit;
                  }
                  if (!refMonth && ai.reference_month && /^\d{4}-\d{2}$/.test(ai.reference_month)) {
                    refMonth = ai.reference_month;
                  }
                  aiTypeName = ai.document_type_name || "";
                }
              } catch (e) {
                console.warn("classify-document falhou:", (e as Error).message);
              }
            }

            // Tipo de documento
            let docType: any = null;
            if (aiTypeName) {
              docType = allowedTypes.find((t: any) => t.name.toLowerCase() === aiTypeName.toLowerCase()) ?? null;
            }
            if (!docType) {
              const lowName = f.name.toLowerCase();
              docType = allowedTypes.find((t: any) => lowName.includes(t.name.toLowerCase())) ?? null;
            }
            if (!docType && allowedTypes.length === 1) docType = allowedTypes[0];

            if (!client || !docType) {
              const reason = !client
                ? "Cliente não identificado pelo CNPJ ou nome na pasta/arquivo"
                : "Tipo de documento não identificado";
              await supabase.from("drive_synced_files").upsert({
                config_id: cfg.id, drive_file_id: f.id, drive_name: f.name, drive_path: f.path,
                drive_modified_time: f.modifiedTime ?? null, status: "pending_review",
                client_id: client?.id ?? null, error: reason,
              }, { onConflict: "config_id,drive_file_id" });
              stats.revisao++;
              continue;
            }

            if (!refMonth) {
              const now = new Date();
              refMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
            }

            // Download e upload para o bucket documents
            const bytes = await downloadDriveBytes(f.id);
            const safeName = sanitizeFileName(f.name);
            const storagePath = `${client.id}/${refMonth}/${docType.id}/${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("documents")
              .upload(storagePath, bytes, { upsert: true, contentType: f.mimeType });
            if (upErr) throw upErr;

            let documentId: string | null = prev?.document_id ?? null;
            if (documentId) {
              const { data: docRow } = await supabase.from("documents")
                .update({ file_url: storagePath, file_name: f.name })
                .eq("id", documentId)
                .select("id").single();
              if (!docRow) documentId = null;
            }
            if (!documentId) {
              const { data: inserted, error: insErr } = await supabase.from("documents").insert({
                document_type_id: docType.id,
                client_id: client.id,
                reference_month: refMonth,
                file_url: storagePath,
                file_name: f.name,
                uploaded_by: null,
                linked_obligation_id: cfg.obligation_id ?? null,
              }).select("id").single();
              if (insErr) throw insErr;
              documentId = inserted.id;
            }

            await supabase.from("drive_synced_files").upsert({
              config_id: cfg.id, drive_file_id: f.id, drive_name: f.name, drive_path: f.path,
              drive_modified_time: f.modifiedTime ?? null, status: "imported",
              document_id: documentId, client_id: client.id, error: null,
            }, { onConflict: "config_id,drive_file_id" });

            if (prev) stats.atualizados++; else stats.novos++;
          } catch (e) {
            console.error(`Erro ao importar ${f.name}:`, e);
            await supabase.from("drive_synced_files").upsert({
              config_id: cfg.id, drive_file_id: f.id, drive_name: f.name, drive_path: f.path,
              drive_modified_time: f.modifiedTime ?? null, status: "error",
              error: (e as Error).message?.slice(0, 500),
            }, { onConflict: "config_id,drive_file_id" });
            stats.erros++;
          }
        }

        await supabase.from("drive_sync_configs")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", cfg.id);
        summary.push(stats);
      } catch (e) {
        console.error(`Erro na config ${cfg.id}:`, e);
        summary.push({ ...stats, erro_fatal: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("drive-folder-sync error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
