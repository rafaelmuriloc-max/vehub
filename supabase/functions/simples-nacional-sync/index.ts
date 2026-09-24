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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      const walkPdf = (o: any): string | null => {
        if (!o || typeof o !== "object") return null;
        for (const [k, v] of Object.entries(o)) {
          if (k === "pdf" && typeof v === "string" && v.length > 100) return v as string;
          if (typeof v === "string" && (v as string).startsWith("JVBERi0") && (v as string).length > 100) return v as string;
          if (typeof v === "object") { const f = walkPdf(v); if (f) return f; }
        }
        return null;
      };
      declaracaoPdf = walkPdf(dadosDec) || walkPdf(dec?.data);
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

  return jsonResponse({ success: true, count: results.length, pagos, payment_errors: paymentErrors, results });
});
