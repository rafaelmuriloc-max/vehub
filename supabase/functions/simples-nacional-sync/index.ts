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

async function callIntegraContador(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  payload: { idSistema: string; idServico: string; tipo: string; dados: string; versaoSistema?: string },
): Promise<any> {
  const { data, error } = await supabase.functions.invoke("integra-contador", {
    body: { client_id: clientId, ...payload },
  });
  if (error) throw new Error(error.message || "Falha ao chamar integra-contador");
  return data;
}

/**
 * For a single client and competence, calls PGDASD to fetch declaration info and DAS PDF,
 * then upserts the row into simples_nacional_competencias.
 */
async function syncCompetencia(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  year: number,
  month: number,
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

    // 3) Status: se valor 0 ou nada, marcar sem_movimento; senão aberto
    let status: "pago" | "aberto" | "sem_movimento" = "aberto";
    let dataPagamento: string | null = null;
    if (valorDas !== null && valorDas <= 0) {
      status = "sem_movimento";
    }

    // 4) Se houver numeroDas, consultar extrato para checar pagamento
    if (numeroDas) {
      try {
        const ext = await callIntegraContador(supabase, clientId, {
          idSistema: "PGDASD",
          idServico: "CONSEXTRATO16",
          tipo: "Consultar",
          dados: JSON.stringify({ numeroDas }),
        });
        const dadosExt = parseDadosJson(ext?.data?.dados ?? ext?.dados);
        const pago = pickString(dadosExt?.dataPagamento, dadosExt?.dataArrecadacao);
        if (pago) {
          status = "pago";
          dataPagamento = pago.length >= 10 ? pago.substring(0, 10) : null;
        }
      } catch (e) {
        console.warn(`[sync] CONSEXTRATO16 falhou: ${(e as Error).message}`);
      }
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
    .in("tax_regime", ["simples_nacional", "Simples Nacional"])
    .eq("status", "active");
  if (clientId) query.eq("id", clientId);

  const { data: clients, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  const results: any[] = [];
  for (const c of clients ?? []) {
    for (const month of requestedMonths) {
      const r = await syncCompetencia(supabase, c.id, year, month);
      results.push({ client_id: c.id, company: c.company_name, year, month, ...r });
    }
  }

  return jsonResponse({ success: true, count: results.length, results });
});
