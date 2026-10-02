import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toYM(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-?(\d{2})/); if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{4})/); if (m) return `${m[2]}-${m[1]}`;
  return null;
}
function toISO(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function parseDados(raw: unknown): any {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id || "");
    const ano = Number(body.ano), mes = Number(body.mes);
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || !(ano >= 2018 && ano <= 2100) || !(mes >= 1 && mes <= 12)) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }
    const ym = `${ano}-${String(mes).padStart(2, "0")}`;
    const competencia = `${ym}-01`;
    const venc = new Date(Date.UTC(ano, mes, 20, 23, 59));
    const fimBusca = new Date(Date.UTC(ano, mes + 3, 0)).toISOString().slice(0, 10);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/integra-contador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({
        client_id: clientId, idSistema: "PAGTOWEB", idServico: "PAGAMENTOS71", tipo: "Consultar",
        dados: JSON.stringify({
          intervaloDataArrecadacao: { dataInicial: competencia, dataFinal: fimBusca },
          primeiroDaPagina: 0, tamanhoDaPagina: 100,
        }),
      }),
    });
    const r = await res.json().catch(() => null);

    let status = "aberto", valor: number | null = null, data: string | null = null, mensagem: string | null = null;
    if (!r || r.success === false) {
      mensagem = r?.data?.mensagens?.map((m: any) => m.texto).join("; ") || r?.error || "Falha na consulta de pagamentos";
    } else {
      const dados = parseDados(r?.data?.dados ?? r?.dados);
      console.log(`[mei-pag] ${clientId} ${ym} amostra: ${JSON.stringify(dados)?.slice(0, 1500)}`);
      const list: any[] = Array.isArray(dados) ? dados : dados?.pagamentos || dados?.documentos || dados?.lista || [];
      for (const it of list) {
        const tipoTxt = `${it?.tipo?.codigo ?? ""} ${it?.tipo?.descricao ?? it?.tipoDocumento ?? ""}`;
        const isDas = String(it?.tipo?.codigo ?? "") === "9" || /simples nacional|simei|mei|das/i.test(tipoTxt);
        if (!isDas) continue;
        const pYm = toYM(it?.periodoApuracao ?? it?.periodo ?? it?.desmembramentos?.[0]?.periodoApuracao);
        if (pYm !== ym) continue;
        const d = toISO(it?.dataArrecadacao ?? it?.dataPagamento);
        if (d && (!data || d < data)) data = d;
        valor = (valor ?? 0) + (num(it?.valorTotal, it?.valor, it?.valorPrincipal) ?? 0);
        status = "pago";
      }
    }
    if (status !== "pago" && venc.getTime() < Date.now()) status = "vencido";

    const row = { client_id: clientId, competencia, status, valor_pago: status === "pago" ? valor : null, data_pagamento: status === "pago" ? data : null, mensagem };
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin.from("mei_competencias").upsert(row, { onConflict: "client_id,competencia" });
    if (error) throw error;
    return json({ success: true, ...row });
  } catch (e) {
    console.error("[mei-pag]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
