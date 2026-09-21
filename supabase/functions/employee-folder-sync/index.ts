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
const MAX_FILES_PER_RUN = 1;
const TIME_BUDGET_MS = 20_000;



function ghHeaders() {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const DRIVE = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!DRIVE) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return { Authorization: `Bearer ${LOVABLE}`, "X-Connection-Api-Key": DRIVE };
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
  company_hint?: string | null;
}

// ---------- Leitura de planilhas .csv ----------

function decodeBytes(bytes: Uint8Array): string {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("iso-8859-1").decode(bytes);
  }
  return text.replace(/^\uFEFF/, "");
}

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = {
    ";": (firstLine.match(/;/g) ?? []).length,
    ",": (firstLine.match(/,/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  let best = ";";
  for (const [d, n] of Object.entries(counts)) if (n > counts[best]) best = d;
  return counts[best] > 0 ? best : ";";
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (ch === "\r") continue;
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normalizeHeader(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ["nome", "nome completo", "funcionario", "funcionaria", "colaborador", "colaboradora", "empregado", "trabalhador"],
  cpf: ["cpf", "n cpf", "cpf do funcionario"],
  position: ["cargo", "funcao", "ocupacao", "cbo descricao"],
  admission_date: ["admissao", "data de admissao", "data admissao", "dt admissao", "entrada"],
  salary: ["salario", "salario base", "remuneracao", "vencimento", "valor salario"],
  termination_date: ["demissao", "data de demissao", "rescisao", "data de rescisao", "desligamento", "saida", "dt rescisao"],
  company: ["cnpj", "empresa", "razao social", "codigo", "cod", "sci", "codigo sci", "cliente"],
};

function mapCsvHeaders(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((raw, index) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue;
      if (aliases.includes(h) || aliases.some((a) => h === a || h.startsWith(a + " "))) {
        map[field] = index;
        break;
      }
    }
  });
  return map;
}

function csvToEmployees(text: string): { employees: ParsedEmployee[]; skipped: number } | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const map = mapCsvHeaders(rows[0]);
  if (map.full_name === undefined && map.cpf === undefined) return null;

  const employees: ParsedEmployee[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const get = (field: string) => {
      const i = map[field];
      return i === undefined ? "" : (row[i] ?? "").trim();
    };
    const name = get("full_name");
    const cpfDigits = get("cpf").replace(/\D/g, "");
    if (!name && cpfDigits.length !== 11) { skipped++; continue; }
    employees.push({
      full_name: name,
      cpf: cpfDigits.length === 11 ? cpfDigits : null,
      position: get("position") || null,
      admission_date: normalizeDate(get("admission_date")),
      salary: normalizeSalary(get("salary")),
      termination_date: normalizeDate(get("termination_date")),
      company_hint: get("company") || null,
    });
  }
  return { employees, skipped };
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
    return null;
  }
}

const CHUNK_SIZE = 18000;
const CHUNK_OVERLAP = 1000;
const MAX_CHUNKS = 12;

function splitEmployeeForms(text: string): string[] {
  const matches = [...text.matchAll(/REGISTRO DE COLABORADORES/gi)];
  if (matches.length <= 1) return [];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    return text.slice(start, end).trim();
  }).filter(form => form.length >= 100);
}

function chunkText(text: string): string[] {
  // Fichas de registro possuem uma pessoa por página. Mantê-las separadas evita
  // associar CPF, cargo ou rescisão de uma página ao nome da página seguinte.
  const forms = splitEmployeeForms(text);
  if (forms.length > 1) return forms.slice(0, MAX_CHUNKS * 3);
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function aiExtractEmployees(
  haystack: string,
  docText: string,
): Promise<{ employees: ParsedEmployee[]; chunks: number; truncated: boolean; failed: boolean }> {
  const chunks = chunkText(docText);
  const forms = splitEmployeeForms(docText);
  const totalNeeded = forms.length > 1
    ? forms.length
    : docText.length > CHUNK_SIZE
    ? Math.ceil((docText.length - CHUNK_OVERLAP) / (CHUNK_SIZE - CHUNK_OVERLAP))
    : 1;
  const truncated = totalNeeded > chunks.length;
  const seen = new Map<string, ParsedEmployee>();
  let failed = false;

  for (const chunk of chunks) {
    const part = await aiExtractChunk(haystack, chunk);
    if (part === null) { failed = true; continue; }
    for (const emp of part) {
      const key = emp.cpf ? `cpf:${emp.cpf}` : `nome:${normalizeText(emp.full_name)}`;
      if (!key || key === "nome:") continue;
      const prev = seen.get(key);
      if (!prev) { seen.set(key, emp); continue; }
      // Completa campos vazios com o que o outro bloco trouxe
      seen.set(key, {
        full_name: prev.full_name || emp.full_name,
        cpf: prev.cpf ?? emp.cpf,
        position: prev.position ?? emp.position,
        admission_date: prev.admission_date ?? emp.admission_date,
        salary: prev.salary ?? emp.salary,
        termination_date: prev.termination_date ?? emp.termination_date,
      });
    }
  }

  return { employees: [...seen.values()], chunks: chunks.length, truncated, failed };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    let forceReprocess = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        forceReprocess = body?.force_reprocess === true;
      } catch {
        // Chamadas automáticas podem não enviar corpo.
      }
    }

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
      funcionarios_encontrados: 0, funcionarios_criados: 0, funcionarios_atualizados: 0,
      parciais: 0, revisao: 0, erros: 0, ignorados: 0, restantes: 0,
      linhas_ignoradas: 0,
    };
    let processed = 0;
    const startedAt = Date.now();


    for (const f of files) {
      const prev = knownById.get(f.id);
      // O botão manual força a releitura; o cron continua econômico e ignora arquivos inalterados.
      if (!forceReprocess && prev && prev.status !== "pending_review" && f.modifiedTime && prev.drive_modified_time === f.modifiedTime) continue;


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

      const isCsvFile = f.mimeType === "text/csv" || f.mimeType === "text/plain" ||
        /\.(csv|txt)$/i.test(f.name);

      // A leitura de PDF é pesada; processa poucos arquivos por execução para
      // não estourar o limite de CPU da função (o restante entra na próxima).
      // Planilhas .csv são leves e não consomem essa cota.
      if (!isCsvFile && (processed >= MAX_FILES_PER_RUN || Date.now() - startedAt > TIME_BUDGET_MS)) {
        stats.restantes++;
        continue;
      }
      if (!isCsvFile) processed++;


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
        const docText = isPdf ? await pdfToText(bytes) : isCsvFile ? decodeBytes(bytes) : "";
        const searchSpace = `${haystack}\n${docText}`;

        // Empresa: CNPJ (caminho/conteúdo) → código SCI (nome/caminho) → razão social (caminho/conteúdo)
        const resolveClientFrom = (text: string, useSci: boolean): any => {
          for (const cnpj of extractCnpjs(text)) {
            const hit = clientsByCnpj.get(cnpj);
            if (hit) return hit;
          }
          if (useSci) {
            for (const sci of extractSciCodes(text)) {
              const hit = clientsBySci.get(sci);
              if (hit) return hit;
            }
          }
          const norm = normalizeText(text.slice(0, 5000));
          let best: any = null; let bestLen = 0;
          for (const c of clients ?? []) {
            const normName = normalizeText(c.company_name || "");
            if (normName.length >= 6 && norm.includes(normName) && normName.length > bestLen) {
              best = c; bestLen = normName.length;
            }
          }
          return best;
        };

        const cnpjs = extractCnpjs(searchSpace);
        const scis = extractSciCodes(haystack);
        let client: any = null;
        for (const cnpj of cnpjs) {
          const hit = clientsByCnpj.get(cnpj);
          if (hit) { client = hit; break; }
        }
        if (!client) {
          for (const sci of scis) {
            const hit = clientsBySci.get(sci);
            if (hit) { client = hit; break; }
          }
        }
        if (!client) client = resolveClientFrom(`${haystack}\n${docText}`, false);

        if (isPdf && docText.trim().length < 40) {
          await markPending("PDF sem texto legível (documento escaneado)", client?.id ?? null);
          continue;
        }

        // Planilha .csv: colunas reconhecidas pelo cabeçalho
        const csvParsed = isCsvFile ? csvToEmployees(docText) : null;
        let parsedEmployees: ParsedEmployee[] = [];
        let partial = false;
        let chunksRead = 0;

        if (csvParsed) {
          parsedEmployees = csvParsed.employees;
          stats.linhas_ignoradas += csvParsed.skipped;
          console.log("csv", f.name, {
            linhas: parsedEmployees.length,
            ignoradas: csvParsed.skipped,
          });
        } else {
          // PDF ou .csv sem cabeçalho reconhecido: leitura automática do texto
          const extraction = await aiExtractEmployees(haystack, docText);
          parsedEmployees = extraction.employees;
          partial = extraction.failed || extraction.truncated;
          chunksRead = extraction.chunks;
          console.log("extracao", f.name, {
            caracteres: docText.length,
            blocos: extraction.chunks,
            encontrados: parsedEmployees.length,
            falhou: extraction.failed,
            truncado: extraction.truncated,
          });

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
        }

        // Cada linha pode indicar a própria empresa (coluna CNPJ/empresa/código)
        const entries: { pe: ParsedEmployee; client: any }[] = [];
        for (const pe of parsedEmployees) {
          const rowClient = pe.company_hint
            ? (resolveClientFrom(pe.company_hint, true) ?? client)
            : client;
          if (!rowClient) { stats.linhas_ignoradas++; continue; }
          entries.push({ pe, client: rowClient });
        }

        if (entries.length === 0) {
          await markPending(
            client
              ? "Nenhum funcionário identificado no arquivo"
              : `Empresa não identificada (texto lido: ${docText.trim().length} caracteres; CNPJs vistos: ${cnpjs.join(", ") || "nenhum"}; códigos vistos: ${scis.join(", ") || "nenhum"})`,
            client?.id ?? null,
          );
          continue;
        }

        stats.fichas_lidas++;
        stats.funcionarios_encontrados += entries.length;


        // O arquivo não é salvo no armazenamento: ele é lido apenas em memória
        // para extrair os funcionários.

        // Regrava os vínculos deste arquivo
        await supabase.from("employee_documents").delete().eq("drive_file_id", f.id);

        const linkedIds = new Set<string>();
        for (const { pe, client: rowClient } of entries) {
          let employee: any = null;
          if (pe.cpf) {
            const { data } = await supabase.from("client_employees")
              .select("*").eq("client_id", rowClient.id).eq("cpf", pe.cpf).limit(1);
            employee = data?.[0] ?? null;
          }
          if (!employee && pe.full_name) {
            const { data } = await supabase.from("client_employees")
              .select("*").eq("client_id", rowClient.id).ilike("full_name", pe.full_name).limit(1);
            employee = data?.[0] ?? null;
          }

          const todayInSaoPaulo = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
          }).format(new Date());
          const importedStatus = pe.termination_date && pe.termination_date <= todayInSaoPaulo
            ? "terminated"
            : "active";

          if (!employee) {
            const { data, error } = await supabase.from("client_employees").insert({
              client_id: client.id,
              full_name: pe.full_name || `Funcionário ${pe.cpf}`,
              cpf: pe.cpf,
              position: pe.position,
              admission_date: pe.admission_date,
              salary: pe.salary,
              termination_date: pe.termination_date,
              status: importedStatus,
              source: "drive",
            } as any).select("*").single();
            if (error) throw error;
            employee = data;
            stats.funcionarios_criados++;
          } else {
            // Dados manuais são preservados. Registros importados são atualizados
            // pela ficha mais recente para corrigir associações feitas em leituras anteriores.
            const patch: any = {};
            if (employee.source === "drive") {
              if (pe.cpf) patch.cpf = pe.cpf;
              if (pe.position) patch.position = pe.position;
              if (pe.admission_date) patch.admission_date = pe.admission_date;
              if (pe.salary != null) patch.salary = pe.salary;
              patch.termination_date = pe.termination_date;
              patch.status = importedStatus;
            } else {
              if (!employee.cpf && pe.cpf) patch.cpf = pe.cpf;
              if (!employee.position && pe.position) patch.position = pe.position;
              if (!employee.admission_date && pe.admission_date) patch.admission_date = pe.admission_date;
              if (employee.salary == null && pe.salary != null) patch.salary = pe.salary;
              if (!employee.termination_date && pe.termination_date) {
                patch.termination_date = pe.termination_date;
                patch.status = importedStatus;
              }
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
            drive_modified_time: f.modifiedTime ?? null,
            status: partial ? "pending_review" : "imported",
            employee_id: employee.id, client_id: client.id,
            storage_path: null, doc_kind: guessDocKind(f.name),
            parsed_at: new Date().toISOString(),
            error: partial
              ? `Leitura parcial: ${parsedEmployees.length} funcionário(s) lidos em ${extraction.chunks} bloco(s); sincronize novamente para completar`
              : null,
          } as any);
        }

        if (partial) stats.parciais++;
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
