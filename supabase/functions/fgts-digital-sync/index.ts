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

async function aesBridge(data: string, pass: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, enc.encode(data)));
  const out = new Uint8Array(28 + ct.length); out.set(salt); out.set(nonce, 16); out.set(ct, 28);
  return toBase64(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const token = (Deno.env.get("INFOSIMPLES_API_TOKEN") ?? "").trim().replace(/\s*visibility$/i, "").trim();
    if (!token) return json({ error: "Token da Infosimples não configurado." }, 400);
    const encKey = Deno.env.get("INFOSIMPLES_ENCRYPTION_KEY");
    if (!encKey) return json({ error: "Chave de criptografia da Infosimples não configurada." }, 400);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id ?? "");
    const periodo = String(body.periodo ?? ""); // MM/AAAA
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || !/^\d{2}\/\d{4}$/.test(periodo)) {
      return json({ error: "Parâmetros inválidos (client_id, periodo MM/AAAA)." }, 400);
    }
    const competencia = `${periodo.slice(3)}-${periodo.slice(0, 2)}`;

    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: client } = await svc.from("clients")
      .select("id, document, digital_certificate_url, digital_certificate_password, digital_certificate_expiry")
      .eq("id", clientId).maybeSingle();
    if (!client?.document) return json({ error: "Empresa sem CNPJ." }, 400);
    const cnpj = String(client.document).replace(/\D/g, "");
    const skip = async (situacao: string, reason: string) => {
      await svc.from("fgts_digital_guias").upsert([{ client_id: clientId, competencia, numero_guia: "", tipo: null,
        situacao, data_emissao: null, data_vencimento: null, data_pagamento: null, valor_total: null,
        guia_pdf_url: null, raw: null, consultado_em: new Date().toISOString() }], { onConflict: "client_id,competencia,numero_guia" });
      console.log(`[fgts-digital-sync] ${cnpj} pulada: ${reason}`);
      return json({ success: true, skipped: reason, count: 0 });
    };
    if (!client.digital_certificate_url || !client.digital_certificate_password) return await skip("Sem certificado", "sem_certificado");
    if (client.digital_certificate_expiry && new Date(client.digital_certificate_expiry) < new Date(new Date().toDateString())) {
      return await skip("Certificado vencido", "certificado_vencido");
    }
    const { data: file, error: fErr } = await svc.storage.from("certificates").download(client.digital_certificate_url);
    if (fErr || !file) {
      console.error(`[fgts-digital-sync] ${cnpj} erro ao baixar certificado`, fErr?.message);
      return json({ error: "Erro ao baixar o certificado da empresa." }, 500);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log(`[fgts-digital-sync] ${cnpj} periodo ${periodo} certificado ${bytes.length} bytes`);
    const cert = toBase64(bytes);

    const encCert = await aesBridge(cert, encKey);
    const encPass = await aesBridge(client.digital_certificate_password, encKey);
    const guias: any[] = [];
    let lastRes: any = null;
    for (let pagina = 1; pagina <= 10; pagina++) {
      const form = new URLSearchParams({
        token, timeout: "300", pkcs12_cert: encCert, pkcs12_pass: encPass,
        periodo: periodo.slice(3) + periodo.slice(0, 2), pagina: String(pagina),
      });
      const r = await fetch("https://api.infosimples.com/api/v2/consultas/fgts/guia", { method: "POST", body: form });
      const res = await r.json().catch(() => ({}));
      lastRes = res;
      if (res.code === 612) break;
      if (res.code !== 200) {
        return json({ error: res.code_message || `Erro Infosimples (${res.code ?? r.status})`, errors: res.errors, code: res.code });
      }
      const d = res.data?.[0] ?? {};
      guias.push(...(d.guias ?? []));
      if (pagina >= Number(d.total_paginas ?? 1)) break;
    }
    void lastRes;
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
