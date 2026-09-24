import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstDayOfMonth(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}

function periodoAAAAMM(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

/**
 * Walk a JSON object looking for the PGDAS-D declaration payload fields.
 */
function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function parseDadosJson(raw: unknown): any {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

const debugTexts: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findKeyNumber(o: any, re: RegExp, depth = 0): number | null {
  if (!o || typeof o !== "object" || depth > 6) return null;
  for (const [k, v] of Object.entries(o)) {
    if (re.test(k) && (typeof v === "number" || typeof v === "string")) {
      const n = pickNumber(v);
      if (n !== null) return n;
    }
    if (v && typeof v === "object") { const f = findKeyNumber(v, re, depth + 1); if (f !== null) return f; }
  }
  return null;
}

function parseBRL(s: string): number | null {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/** Primeiro valor em reais (1.234,56) que aparece logo depois do rótulo. */
function moneyAfter(txt: string, label: RegExp): number | null {
  const m = label.exec(txt);
  if (!m) return null;
  const rest = txt.slice(m.index + m[0].length, m.index + m[0].length + 400);
  const v = rest.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);
  return v ? parseBRL(v[0]) : null;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  // Lê em partes e aproveita o que foi descompactado mesmo se o fim do fluxo der erro
  const run = async (fmt: CompressionFormat, data: Uint8Array) => {
    const parts: Uint8Array[] = [];
    try {
      const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream(fmt)).getReader();
      while (true) { const { done, value } = await reader.read(); if (done) break; parts.push(value); }
    } catch { /* fluxo truncado */ }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  let out = await run("deflate", bytes);
  if (!out.length && bytes.length > 2) out = await run("deflate-raw", bytes.subarray(2));
  return out.length ? out : null;
}

/** Extrai texto simples (operadores Tj/TJ) de um PDF em base64. */
async function pdfText(b64: string): Promise<string> {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const latin = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return s; };
  const re = /stream\r?\n/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(bin))) {
    const start = m.index + m[0].length;
    const end = bin.indexOf("endstream", start);
    if (end < 0) break;
    const dict = bin.slice(Math.max(0, m.index - 300), m.index);
    const lenM = dict.slice(dict.lastIndexOf("<<")).match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let stop = end;
    if (lenM && start + Number(lenM[1]) <= end) stop = start + Number(lenM[1]);
    else while (stop > start && (bytes[stop - 1] === 10 || bytes[stop - 1] === 13)) stop--;
    let chunk = bytes.subarray(start, stop);
    if (/FlateDecode/.test(dict.slice(dict.lastIndexOf("<<")))) {
      const inf = await inflate(chunk);
      if (!inf) continue;
      chunk = inf;
    }
    const s = latin(chunk);
    if (!/T[Jj]/.test(s)) continue;
    const tokens = s.match(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>|T[Jj*]|Td|TD|T\*|ET/g) || [];
    let line = "";
    for (const t of tokens) {
      if (t.startsWith("(")) {
        line += t.slice(1, -1).replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\(.)/g, "$1");
      } else if (t.startsWith("<")) {
        const h = t.slice(1, -1).replace(/\s/g, "");
        for (let i = 0; i + 1 < h.length; i += 2) { const c = parseInt(h.slice(i, i + 2), 16); if (c >= 32) line += String.fromCharCode(c); }
      } else if (t !== "TJ" && t !== "Tj") line += " ";
    }
    parts.push(line);
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

async function callIntegraContador(
  _supabase: ReturnType<typeof createClient>,
  clientId: string,
  payload: { idSistema: string; idServico: string; tipo: string; dados: string; versaoSistema?: string },
): Promise<any> {
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sleep(attempt === 0 ? 300 : 1500);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/integra-contador`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({ client_id: clientId, ...payload }),
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* texto puro */ }
      if (!res.ok && !json) {
        lastErr = `HTTP ${res.status}: ${text.slice(0, 300)}`;
        console.warn(`[sync] ${payload.idServico} ${clientId} → ${lastErr}`);
        if (res.status >= 500 && attempt === 0) continue;
        throw new Error(lastErr);
      }
      if (!res.ok) console.warn(`[sync] ${payload.idServico} ${clientId} → HTTP ${res.status}: ${text.slice(0, 500)}`);
      return json;
    } catch (e) {
      lastErr = (e as Error).message;
      console.warn(`[sync] ${payload.idServico} ${clientId} tentativa ${attempt + 1} falhou: ${lastErr}`);
      if (attempt === 1) break;
    }
  }
  throw new Error(lastErr || "Falha ao chamar integra-contador");
}

/**
 * For a single client and competence, calls PGDASD to fetch declaration info and DAS PDF,
 * then upserts the row into simples_nacional_competencias.
 */
type PaymentMap = Map<string, { data: string | null; valor: number | null }>;

function toYM(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{4})/);
  if (m) return `${m[2]}-${m[1]}`;
  return null;
}

function toISODate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Consulta PAGTOWEB/PAGAMENTOS71 e devolve os DAS arrecadados por período (yyyy-MM). */
async function fetchPayments(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  year: number,
): Promise<{ map: PaymentMap; error?: string }> {
  const map: PaymentMap = new Map();
  try {
    const res = await callIntegraContador(supabase, clientId, {
      idSistema: "PAGTOWEB",
      idServico: "PAGAMENTOS71",
      tipo: "Consultar",
      dados: JSON.stringify({
        intervaloDataArrecadacao: { dataInicial: `${year}-01-01`, dataFinal: `${year + 1}-03-31` },
        primeiroDaPagina: 0,
        tamanhoDaPagina: 100,
      }),
    });
    if (res?.success === false) {
      const msgs = res?.data?.mensagens;
      const err = msgs?.map((m: any) => m.texto).join("; ") || res?.error || "Falha na consulta de pagamentos";
      console.warn(`[sync] PAGAMENTOS71 recusado ${clientId}: ${err}`);
      return { map, error: err };
    }
    const dados = parseDadosJson(res?.data?.dados ?? res?.dados);
    console.log(`[sync] PAGAMENTOS71 ${clientId} amostra: ${JSON.stringify(dados)?.slice(0, 1500)}`);
    const list: any[] = Array.isArray(dados) ? dados
      : Array.isArray(dados?.pagamentos) ? dados.pagamentos
      : Array.isArray(dados?.documentos) ? dados.documentos
      : Array.isArray(dados?.lista) ? dados.lista : [];
    for (const it of list) {
      const tipoTxt = `${it?.tipo?.codigo ?? it?.tipoDocumento ?? it?.tipo ?? ""} ${it?.tipo?.descricao ?? ""}`;
      const isDas = String(it?.tipo?.codigo ?? "") === "9" || /simples nacional/i.test(tipoTxt);
      if (!isDas) continue;
      const ym = toYM(it?.periodoApuracao ?? it?.periodo ?? it?.desmembramentos?.[0]?.periodoApuracao);
      if (!ym || !ym.startsWith(String(year))) continue;
      const data = toISODate(it?.dataArrecadacao ?? it?.dataPagamento);
      const valor = pickNumber(it?.valorTotal, it?.valor, it?.valorPrincipal);
      const prev = map.get(ym);
      map.set(ym, { data: prev?.data && data && prev.data < data ? prev.data : (data ?? prev?.data ?? null), valor: (prev?.valor ?? 0) + (valor ?? 0) || null });
    }
  } catch (e) {
    const msg = (e as Error).message;
    console.warn(`[sync] PAGAMENTOS71 falhou ${clientId}: ${msg}`);
    return { map, error: msg };
  }
  return { map };
}

async function syncCompetencia(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  year: number,
  month: number,
  payments?: PaymentMap,
): Promise<{ ok: boolean; status: string; error?: string }> {
  const competencia = firstDayOfMonth(year, month);
  const periodo = periodoAAAAMM(year, month);

  try {
    // 1) Última declaração/recibo do PA → revela número da declaração e RBT12
    let numeroDeclaracao: string | null = null;
    let rbt12: number | null = null;
    let rba: number | null = null;
    let declaracaoPdf: string | null = null;
    try {
      const dec = await callIntegraContador(supabase, clientId, {
        idSistema: "PGDASD",
        idServico: "CONSULTIMADECREC14",
        tipo: "Consultar",
        dados: JSON.stringify({ periodoApuracao: periodo }),
      });
      const dadosDec = parseDadosJson(dec?.data?.dados ?? dec?.dados);
      numeroDeclaracao = pickString(dadosDec?.numeroDeclaracao, dadosDec?.numeroDeclaracaoTransmitida);
      rbt12 = pickNumber(dadosDec?.rbt12, dadosDec?.RBT12, dadosDec?.receitaBrutaTotal12meses);
      rba = pickNumber(dadosDec?.rba, dadosDec?.RBA, dadosDec?.receitaBrutaAcumuladaAno, dadosDec?.receitaBrutaAcumulada);
      // Coleta todos os PDFs com o caminho/nome do arquivo, para escolher a declaração (não o recibo)
      const collectPdfs = (o: any, path: string, acc: { path: string; pdf: string }[]) => {
        if (!o || typeof o !== "object") return acc;
        const nome = typeof o.nomeArquivo === "string" ? o.nomeArquivo : "";
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === "string" && v.length > 100 && (k === "pdf" || v.startsWith("JVBERi0"))) {
            acc.push({ path: `${path}.${k} ${nome}`.toLowerCase(), pdf: v });
          } else if (v && typeof v === "object") collectPdfs(v, `${path}.${k}`, acc);
        }
        return acc;
      };
      const pickDeclPdf = (root: any): string | null => {
        const all = collectPdfs(root, "", []);
        console.log(`[sync] PDFs ${clientId} ${periodo}: ${all.map((p) => `${p.path}=${p.pdf.length}`).join(" | ")}`);
        const decl = all.find((p) => /declara/.test(p.path) && !/recibo/.test(p.path));
        if (decl) return decl.pdf;
        const nonRecibo = all.filter((p) => !/recibo/.test(p.path)).sort((a, b) => b.pdf.length - a.pdf.length);
        return nonRecibo[0]?.pdf ?? null;
      };
      declaracaoPdf = pickDeclPdf(dadosDec) || pickDeclPdf(dec?.data);
      if (!declaracaoPdf && numeroDeclaracao) {
        try {
          const d2 = await callIntegraContador(supabase, clientId, {
            idSistema: "PGDASD",
            idServico: "CONSDECREC15",
            tipo: "Consultar",
            dados: JSON.stringify({ numeroDeclaracao }),
          });
          declaracaoPdf = pickDeclPdf(parseDadosJson(d2?.data?.dados ?? d2?.dados)) || pickDeclPdf(d2?.data);
        } catch (e) {
          console.warn(`[sync] CONSDECREC15 falhou ${clientId} ${periodo}: ${(e as Error).message}`);
        }
      }
      if (rbt12 === null) rbt12 = findKeyNumber(dadosDec, /^(rbt12|receitaBrutaTotal12|rbt12Total|valorRbt12)/i);
      if (rba === null) rba = findKeyNumber(dadosDec, /^(rba|receitaBrutaAcumulada)/i);
      if ((rbt12 === null || rba === null) && declaracaoPdf) {
        try {
          const txt = await pdfText(declaracaoPdf);
          debugTexts.push(txt.slice(0, 4000));
          if (rbt12 === null) rbt12 = moneyAfter(txt, /RBT12\)?|Receita\s+bruta\s+acumulada\s+nos\s+doze/i);
          if (rba === null) rba = moneyAfter(txt, /\(RBA\)|Receita\s+bruta\s+acumulada\s+no\s+ano\s+calend/i);
        } catch (e) {
          console.warn(`[sync] leitura do PDF falhou ${clientId} ${periodo}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      console.warn(`[sync] CONSULTIMADECREC14 falhou para ${clientId} ${periodo}: ${(e as Error).message}`);
    }

    // 2) Gerar DAS (PDF + valor)
    let valorDas: number | null = null;
    let numeroDas: string | null = null;
    let dataVencimento: string | null = null;
    let dasPdf: string | null = null;
    try {
      const das = await callIntegraContador(supabase, clientId, {
        idSistema: "PGDASD",
        idServico: "GERARDAS12",
        tipo: "Emitir",
        dados: JSON.stringify({ periodoApuracao: periodo }),
      });
      const dadosDas = parseDadosJson(das?.data?.dados ?? das?.dados);
      const arr = Array.isArray(dadosDas) ? dadosDas[0] : dadosDas;
      valorDas = pickNumber(arr?.valorTotalDocumento, arr?.valor, arr?.valorTotal);
      numeroDas = pickString(arr?.numeroDocumento, arr?.numeroDas);
      dataVencimento = pickString(arr?.dataVencimento, arr?.dataValidade) ?? null;
      const walkPdf = (o: any): string | null => {
        if (!o || typeof o !== "object") return null;
        for (const [k, v] of Object.entries(o)) {
          if (k === "pdf" && typeof v === "string" && v.length > 100) return v as string;
          if (typeof v === "string" && (v as string).startsWith("JVBERi0") && (v as string).length > 100) return v as string;
          if (typeof v === "object") { const f = walkPdf(v); if (f) return f; }
        }
        return null;
      };
      dasPdf = walkPdf(dadosDas) || walkPdf(das?.data);
    } catch (e) {
      console.warn(`[sync] GERARDAS12 falhou para ${clientId} ${periodo}: ${(e as Error).message}`);
    }

    // 3) Status: pagamento vem do PAGTOWEB (mapa por período)
    let status: "pago" | "aberto" | "sem_movimento" = "aberto";
    let dataPagamento: string | null = null;
    const pg = payments?.get(`${year}-${String(month).padStart(2, "0")}`);
    if (pg) {
      status = "pago";
      dataPagamento = pg.data;
    } else if (valorDas !== null && valorDas <= 0) {
      status = "sem_movimento";
    }

    await supabase.from("simples_nacional_competencias").upsert({
      client_id: clientId,
      competencia,
      ano: year,
      rbt12,
      rba_acumulado_ano: rba,
      valor_das: valorDas,
      numero_das: numeroDas,
      numero_declaracao: numeroDeclaracao,
      data_vencimento: dataVencimento,
      data_pagamento: dataPagamento,
      status,
      das_pdf_base64: dasPdf,
      declaracao_pdf_base64: declaracaoPdf,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "client_id,competencia" });

    return { ok: true, status };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[sync] Erro em ${clientId} ${periodo}: ${msg}`);
    return { ok: false, status: "error", error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { /* CRON pode chamar sem body */ }

  const now = new Date();
  const year = Number(body?.year) || now.getUTCFullYear();
  // Por padrão sincroniza o ano atual completo (meses já transcorridos + atual)
  const requestedMonths: number[] = Array.isArray(body?.months) && body.months.length
    ? body.months.map(Number)
    : Array.from({ length: now.getUTCMonth() + 1 }, (_, i) => i + 1);

  const clientId: string | undefined = body?.client_id;

  // Buscar clientes do Simples ativos
  const query = supabase.from("clients").select("id, company_name, document, tax_regime, status")
    .ilike("tax_regime", "%simples%")
    .eq("status", "active")
    .order("id");
  if (clientId) query.eq("id", clientId);

  const { data: allClients, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  const offset = Math.max(0, Number(body?.offset) || 0);
  const limit = Number(body?.limit) > 0 ? Number(body.limit) : (allClients?.length ?? 0);
  const clients = (allClients ?? []).slice(offset, offset + limit);
  const total = allClients?.length ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  const results: any[] = [];
  const paymentErrors: { company: string; error: string }[] = [];
  let pagos = 0;
  const onlyPayments = body?.only_payments === true;

  for (const c of clients) {
    const { map, error: pErr } = await fetchPayments(supabase, c.id, year);
    if (pErr) paymentErrors.push({ company: c.company_name, error: pErr });

    if (onlyPayments) {
      if (pErr) continue;
      const { data: existing } = await supabase.from("simples_nacional_competencias")
        .select("competencia, status").eq("client_id", c.id).eq("ano", year);
      const ex = new Map((existing ?? []).map((r: any) => [String(r.competencia).slice(0, 7), r.status]));
      for (const month of requestedMonths) {
        const ym = `${year}-${String(month).padStart(2, "0")}`;
        const pg = map.get(ym);
        if (pg) {
          pagos++;
          await supabase.from("simples_nacional_competencias").upsert({
            client_id: c.id, competencia: `${ym}-01`, ano: year,
            status: "pago", data_pagamento: pg.data, last_synced_at: new Date().toISOString(),
          }, { onConflict: "client_id,competencia" });
        } else if (ex.get(ym) === "pago") {
          await supabase.from("simples_nacional_competencias")
            .update({ status: "aberto", data_pagamento: null })
            .eq("client_id", c.id).eq("competencia", `${ym}-01`);
        }
        results.push({ client_id: c.id, month, status: pg ? "pago" : "aberto" });
      }
      continue;
    }

    for (const month of requestedMonths) {
      const r = await syncCompetencia(supabase, c.id, year, month, pErr ? undefined : map);
      if (r.status === "pago") pagos++;
      results.push({ client_id: c.id, company: c.company_name, year, month, ...r });
    }
  }

  return jsonResponse({ success: true, debug: body?.debug ? debugTexts.splice(0) : undefined, count: results.length, pagos, payment_errors: paymentErrors, results });
});
