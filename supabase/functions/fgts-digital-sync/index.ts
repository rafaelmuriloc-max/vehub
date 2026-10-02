import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toISO(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const token = Deno.env.get("INFOSIMPLES_API_TOKEN");
    if (!token) return json({ error: "Token da Infosimples não configurado." }, 400);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id ?? "");
    const periodo = String(body.periodo ?? ""); // MM/AAAA
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || !/^\d{2}\/\d{4}$/.test(periodo)) {
      return json({ error: "Parâmetros inválidos (client_id, periodo MM/AAAA)." }, 400);
    }
    const competencia = `${periodo.slice(3)}-${periodo.slice(0, 2)}`;

    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: client } = await svc.from("clients").select("id, cnpj").eq("id", clientId).maybeSingle();
    if (!client?.cnpj) return json({ error: "Empresa sem CNPJ." }, 400);
    const { data: company } = await svc.from("company_settings")
      .select("digital_certificate_url, digital_certificate_password").limit(1).maybeSingle();
    if (!company?.digital_certificate_url || !company?.digital_certificate_password) {
      return json({ error: "Certificado do escritório não configurado." }, 400);
    }
    const { data: file, error: fErr } = await svc.storage.from("certificates").download(company.digital_certificate_url);
    if (fErr || !file) return json({ error: "Erro ao baixar certificado." }, 500);
    const cert = toBase64(new Uint8Array(await file.arrayBuffer()));

    const form = new URLSearchParams({
      token, timeout: "300",
      pkcs12_cert: cert, pkcs12_pass: company.digital_certificate_password,
      representado: String(client.cnpj).replace(/\D/g, ""),
      periodo,
    });
    const r = await fetch("https://api.infosimples.com/api/v2/consultas/fgts/guia", { method: "POST", body: form });
    const res = await r.json().catch(() => ({}));
    if (res.code !== 200 && res.code !== 612) {
      return json({ error: res.code_message || `Erro Infosimples (${res.code ?? r.status})`, errors: res.errors });
    }
    const guias: any[] = (res.data ?? []).flatMap((d: any) => d.guias ?? []);
    const rows = guias.map((g) => ({
      client_id: clientId, competencia,
      numero_guia: String(g.numero ?? ""),
      tipo: g.tipo ?? null,
      situacao: g.situacao ?? null,
      data_emissao: toISO(g.data_emissao),
      data_vencimento: toISO(g.data_limite_pagamento),
      data_pagamento: toISO(g.data_arrecadacao),
      valor_total: num(g.valor_total),
      guia_pdf_url: g.guia_pdf_url ?? null,
      raw: g, consultado_em: new Date().toISOString(),
    }));
    if (!rows.length) {
      rows.push({ client_id: clientId, competencia, numero_guia: "", tipo: null, situacao: "Sem guias",
        data_emissao: null, data_vencimento: null, data_pagamento: null, valor_total: null, guia_pdf_url: null,
        raw: null, consultado_em: new Date().toISOString() });
    } else {
      await svc.from("fgts_digital_guias").delete().eq("client_id", clientId).eq("competencia", competencia).eq("numero_guia", "");
    }
    const { error } = await svc.from("fgts_digital_guias").upsert(rows, { onConflict: "client_id,competencia,numero_guia" });
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, count: guias.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
