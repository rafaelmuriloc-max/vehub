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

// Códigos de receita apurados na DCTFWeb (contribuições previdenciárias, terceiros, IRRF do eSocial/Reinf).
const DCTF_CODES = new Set([
  "1082", "1099", "1138", "1141", "1646", "1170", "1176", "1191", "1196", "1200", "1213", "1218", "1221",
  "1162", "1184", "1287", "1294", "1300", "1307", "1316", "1325", "1334", "1343", "1352", "1361", "1370",
  "0561", "0588", "1708", "3208", "5952", "8045", "3280", "2985", "2991", "1146",
]);

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
    const categoria = ["GERAL_MENSAL", "13_SALARIO", "GERAL_ANUAL"].includes(body.categoria) ? body.categoria : "GERAL_MENSAL";
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || !(ano >= 2018 && ano <= 2100) || !(mes >= 1 && mes <= 12)) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }
    const ym = `${ano}-${String(mes).padStart(2, "0")}`;
    const competencia = `${ym}-01`;
    // vencimento: dia 20 do mês seguinte (13º: 20/12 do ano)
    const venc = categoria === "13_SALARIO" ? new Date(Date.UTC(ano, 11, 20)) : new Date(Date.UTC(ano, mes, 20));
    const fimBusca = new Date(Date.UTC(ano, mes + 3, 0)).toISOString().slice(0, 10);

    const callIC = (payload: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/integra-contador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ client_id: clientId, ...payload }),
    }).then((x) => x.json()).catch(() => null);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date().toISOString();

    // 1) Verifica se a DCTFWeb foi transmitida (recibo de entrega).
    const dadosRec: Record<string, unknown> = { categoria, anoPA: String(ano) };
    if (categoria === "GERAL_MENSAL") dadosRec.mesPA = String(mes).padStart(2, "0");
    const rec = await callIC({ idSistema: "DCTFWEB", idServico: "CONSRECIBO32", tipo: "Consultar", dados: JSON.stringify(dadosRec) });
    const recMsgs: string = (rec?.data?.mensagens || rec?.mensagens || []).map((m: any) => `${m.codigo ?? ""} ${m.texto ?? ""}`).join("; ");
    const recDados = rec?.data?.dados ?? rec?.dados;
    const hasDoc = typeof recDados === "string" ? recDados.length > 50 : !!recDados && Object.keys(recDados).length > 0;
    console.log(`[dctfweb-pag] recibo ${clientId} ${ym} ok=${rec?.success} doc=${hasDoc} msgs=${recMsgs.slice(0, 500)}`);
    let enviada: boolean | null = null;
    if (rec && rec.success !== false && hasDoc) enviada = true;
    else if (/n[ãa]o (foi )?(encontrad|localizad|existe|h[áa])|inexist|nenhum|sem declara/i.test(recMsgs)) enviada = false;

    if (enviada !== true) {
      const row = {
        client_id: clientId, competencia, categoria, status: "aberto", valor_pago: null, data_pagamento: null,
        enviada, enviada_em: null, consultado_em: now,
        mensagem: enviada === false ? null : (recMsgs || rec?.error || "Falha ao consultar o recibo"),
      };
      const { error } = await admin.from("dctfweb_competencias").upsert(row, { onConflict: "client_id,competencia,categoria" });
      if (error) throw error;
      return json({ success: true, ...row });
    }

    // 2) Enviada: consulta pagamentos.
    const r = await callIC({
      idSistema: "PAGTOWEB", idServico: "PAGAMENTOS71", tipo: "Consultar",
      dados: JSON.stringify({
        intervaloDataArrecadacao: { dataInicial: competencia, dataFinal: fimBusca },
        primeiroDaPagina: 0, tamanhoDaPagina: 100,
      }),
    });

    let status = "aberto", valor: number | null = null, data: string | null = null, mensagem: string | null = null;
    if (!r || r.success === false) {
      mensagem = r?.data?.mensagens?.map((m: any) => m.texto).join("; ") || r?.error || "Falha na consulta de pagamentos";
    } else {
      const dados = parseDados(r?.data?.dados ?? r?.dados);
      console.log(`[dctfweb-pag] ${clientId} ${ym} amostra: ${JSON.stringify(dados)?.slice(0, 1500)}`);
      const list: any[] = Array.isArray(dados) ? dados : dados?.pagamentos || dados?.documentos || dados?.lista || [];
      for (const it of list) {
        const tipoTxt = `${it?.tipo?.codigo ?? ""} ${it?.tipo?.descricao ?? it?.tipoDocumento ?? ""}`;
        if (String(it?.tipo?.codigo ?? "") === "9" || /simples nacional/i.test(tipoTxt)) continue;
        // A guia da DCTFWeb é um DARF numerado (receita consolidada 4444) com desmembramentos.
        const mainCode = String(it?.receitaPrincipal?.codigo ?? it?.codigoReceita ?? "").padStart(4, "0");
        const parts: any[] = Array.isArray(it?.desmembramentos) ? it.desmembramentos : [];
        if (mainCode !== "4444" || parts.length === 0) continue;
        const matched = parts.filter((p) => {
          if (toYM(p?.periodoApuracao) !== ym) return false;
          const code = String(p?.receitaPrincipal?.codigo ?? p?.codigoReceita ?? "").padStart(4, "0");
          const desc = String(p?.receitaPrincipal?.descricao ?? "");
          return DCTF_CODES.has(code) || /contribui[cç][aã]o previdenci|cp segurado|cp patronal|outras entidades/i.test(desc);
        });
        if (matched.length === 0) continue;
        const d = toISO(it?.dataArrecadacao ?? it?.dataPagamento);
        if (d && (!data || d < data)) data = d;
        // Soma só as parcelas da competência consultada (a guia pode trazer meses atrasados juntos).
        valor = (valor ?? 0) + matched.reduce((s, p) => s + (num(p?.valorTotal, p?.valorPrincipal) ?? 0), 0);
        status = "pago";
      }
    }
    if (status !== "pago" && venc.getTime() < Date.now()) status = "vencido";

    const row = { client_id: clientId, competencia, categoria, status, valor_pago: status === "pago" ? valor : null, data_pagamento: status === "pago" ? data : null, mensagem, enviada: true, enviada_em: now, consultado_em: now };
    const { error } = await admin.from("dctfweb_competencias").upsert(row, { onConflict: "client_id,competencia,categoria" });
    if (error) throw error;
    return json({ success: true, ...row });
  } catch (e) {
    console.error("[dctfweb-pag]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
