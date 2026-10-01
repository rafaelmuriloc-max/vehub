import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePfx } from "../_shared/certificate.ts";

// NF-e (modelo 55) pelo WS de download para contabilistas da SEF-SC.
// Diferente do Ambiente Nacional, entrega também as notas EMITIDAS (saídas).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SC_URL = "https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx";
const SC_NS = "http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2";
const SOAP_ACTION = `${SC_NS}/NfeDownloadContab`;
const MAX_LOOPS = 20;
const BLOCK_HOURS_COMPLETE = 12;
const BLOCK_HOURS_REJECT = 1;

const NFE_PROXY_URL = Deno.env.get("NFE_PROXY_URL") || "";
const NFE_PROXY_TOKEN = Deno.env.get("NFE_PROXY_TOKEN") || "";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const isServiceCall = authHeader.replace(/^Bearer\s+/i, "") === serviceKey;
    if (!isServiceCall) {
      const anon = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await anon.auth.getUser();
      if (error || !user) return jsonResponse({ error: "Não autenticado" }, 401);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const client_id = body?.client_id;
    if (!client_id || typeof client_id !== "string") return jsonResponse({ error: "client_id é obrigatório" }, 400);
    const rawKey = typeof body?.access_key === "string" ? body.access_key.replace(/\D/g, "") : "";
    if (body?.access_key && rawKey.length !== 44) return jsonResponse({ error: "Chave de acesso deve ter 44 dígitos" }, 400);
    const consChave = rawKey.length === 44 ? rawKey : null;

    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id, company_name, document, last_nfe_sc_nsu, nfe_sc_next_query_at")
      .eq("id", client_id)
      .single();
    if (cErr || !client) return jsonResponse({ error: "Cliente não encontrado" }, 404);
    if (!client.document) return jsonResponse({ error: "Cliente sem CNPJ cadastrado" }, 400);
    if (!consChave && client.nfe_sc_next_query_at && new Date(client.nfe_sc_next_query_at).getTime() > Date.now()) {
      return jsonResponse({ success: true, skipped: true, next_query_at: client.nfe_sc_next_query_at, invoices_saved: 0, events_saved: 0 });
    }

    const { data: company } = await admin
      .from("company_settings")
      .select("digital_certificate_url, digital_certificate_password, accountant_certificate_url, accountant_certificate_password")
      .limit(1).maybeSingle();
    const candidates: Array<{ label: string; url: string; pwd: string }> = [];
    if (company?.accountant_certificate_url) candidates.push({ label: "e-CPF do contador", url: company.accountant_certificate_url, pwd: company.accountant_certificate_password || "" });
    if (company?.digital_certificate_url) candidates.push({ label: "e-CNPJ do escritório", url: company.digital_certificate_url, pwd: company.digital_certificate_password || "" });
    if (candidates.length === 0) return jsonResponse({ error: "Certificado do escritório/contador não configurado em Meu Escritório" }, 400);
    const certs: Array<{ label: string; certPem: string; keyPem: string }> = [];
    for (const c of candidates) {
      try {
        const { data: f, error: e } = await admin.storage.from("certificates").download(c.url);
        if (e || !f) continue;
        const { chainPem, keyPem } = parsePfx(new Uint8Array(await f.arrayBuffer()), c.pwd);
        certs.push({ label: c.label, certPem: chainPem, keyPem });
      } catch (err) {
        console.error(`[NF-e SC] Falha ao abrir ${c.label}:`, err instanceof Error ? err.message : err);
      }
    }
    if (certs.length === 0) return jsonResponse({ error: "Não foi possível abrir o certificado do escritório/contador" }, 500);
    let certIdx = 0;

    const cnpj = client.document.replace(/\D/g, "");
    let lastNsu = client.last_nfe_sc_nsu || "0";
    let nextQueryAt: string | null = null;
    let invoicesSaved = 0, eventsSaved = 0, saidas = 0, loops = 0;
    let keepGoing = true, more = false;
    let lastStatus = "", lastMotivo = "";
    const startedAt = Date.now();

    while (keepGoing && loops < (consChave ? 1 : MAX_LOOPS)) {
      if (Date.now() - startedAt > 100_000) { more = true; break; }
      loops++;
      const cert = certs[certIdx];
      console.log(`[NF-e SC] Loop ${loops}, ultNuNSU=${lastNsu}, CNPJ=${cnpj}, cert=${cert.label}`);
      const res = await requestTextWithMTLS(new URL(SC_URL), buildSoapRequest(cnpj, lastNsu, consChave), cert.certPem, cert.keyPem);
      const ret = extractTagContent(res.bodyText, "retDistNFeSC") || res.bodyText;
      const cStat = extractTagContent(ret, "cStat") || "";
      const xMotivo = extractTagContent(ret, "xMotivo") || "";
      const ultNSURet = extractTagContent(ret, "ultNuNSURet") || extractTagContent(ret, "ultNSU");
      const qtDfeRet = parseInt(extractTagContent(ret, "qtDfeRet") || "0", 10);
      lastStatus = cStat; lastMotivo = xMotivo;
      console.log(`[NF-e SC] http=${res.status} cStat=${cStat} ${xMotivo} ultNuNSURet=${ultNSURet} qtDfeRet=${qtDfeRet}`);

      if (cStat === "8002") {
        if (certIdx + 1 < certs.length) { certIdx++; loops--; continue; }
        return jsonResponse({ success: false, not_accountant: true, cStat, xMotivo, company_name: client.company_name, invoices_saved: invoicesSaved, events_saved: eventsSaved });
      }
      if (cStat === "110") { if (ultNSURet) lastNsu = ultNSURet; continue; }
      if (cStat === "117") { nextQueryAt = await block(admin, client_id, BLOCK_HOURS_COMPLETE, consChave); break; }
      if (cStat === "657") { nextQueryAt = await block(admin, client_id, BLOCK_HOURS_REJECT, consChave); break; }
      if (cStat !== "118") {
        if (invoicesSaved > 0 || eventsSaved > 0) break;
        console.error(`[NF-e SC] resposta inesperada: ${res.bodyText.slice(0, 800)}`);
        return jsonResponse({ error: `Erro SEF-SC: ${cStat || res.status} - ${xMotivo}`, cStat }, 400);
      }

      const loteB64 = extractTagContent(ret, "loteDistComp");
      const entries = loteB64 ? parseLote(await decompressGzip(loteB64.replace(/\s/g, ""))) : [];
      console.log(`[NF-e SC] ${entries.length} documento(s) no lote`);

      const invRows: Array<Record<string, unknown>> = [];
      const evRows: Array<Record<string, unknown>> = [];
      for (const en of entries) {
        if (/<(procEventoNFe|resEvento|evento)[\s>]/i.test(en.xml) && !/<nfeProc[\s>]|<NFe[\s>]/i.test(en.xml)) {
          const ev = parseEventXml(en.xml);
          if (ev) evRows.push({ ...ev, client_id, nsu: en.nsu, raw_xml: en.xml });
          continue;
        }
        const inv = parseNfeXml(en.xml, en.chAcesso);
        if (!inv) continue;
        const xml = ensureXmlProlog(en.xml);
        let xmlUrl: string | null = null;
        const path = `nfe/${client_id}/${inv.access_key}.xml`;
        const { error: upErr } = await admin.storage.from("documents").upload(path, new Blob([xml], { type: "application/xml" }), { upsert: true });
        if (!upErr) xmlUrl = path;
        const direction = inv.emitter_cnpj === cnpj ? "saida" : "entrada";
        if (direction === "saida") saidas++;
        invRows.push({ ...inv, client_id, nsu: en.nsu, raw_xml: xml, xml_url: xmlUrl, status: xmlUrl ? "xml_baixado" : "autorizada", direction });
      }
      invoicesSaved += await saveInvoices(admin, invRows);
      eventsSaved += await saveEvents(admin, evRows);

      if (!consChave && ultNSURet && ultNSURet !== "0") {
        lastNsu = ultNSURet;
        await admin.from("clients").update({ last_nfe_sc_nsu: lastNsu }).eq("id", client_id);
      }
      if (consChave || qtDfeRet < 50) {
        if (!consChave) nextQueryAt = await block(admin, client_id, BLOCK_HOURS_COMPLETE, false);
        keepGoing = false;
      }
    }
    if (keepGoing && !consChave && loops >= MAX_LOOPS) more = true;

    return jsonResponse({ success: true, more, invoices_saved: invoicesSaved, saidas, events_saved: eventsSaved, next_query_at: nextQueryAt, last_nsu: lastNsu, loops, cStat: lastStatus, xMotivo: lastMotivo });
  } catch (error) {
    console.error("[NF-e SC] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

async function block(admin: any, id: string, hours: number, isKey: unknown): Promise<string | null> {
  if (isKey) return null;
  const next = new Date(Date.now() + hours * 3600_000).toISOString();
  await admin.from("clients").update({ nfe_sc_next_query_at: next }).eq("id", id);
  return next;
}

// Nunca rebaixa nem sobrescreve uma nota que já está com XML completo.
async function saveInvoices(admin: any, rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const m = new Map<string, Record<string, unknown>>();
  for (const r of rows) m.set(String(r.access_key), r);
  const keys = [...m.keys()];
  const complete = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await admin.from("nfe_invoices").select("access_key").in("access_key", keys.slice(i, i + 200)).eq("status", "xml_baixado");
    for (const r of data || []) complete.add(r.access_key);
  }
  const list = [...m.values()].filter((r) => !complete.has(String(r.access_key)));
  let saved = 0;
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const { error } = await admin.from("nfe_invoices").upsert(batch, { onConflict: "access_key" });
    if (error) {
      console.error("[NF-e SC] upsert:", error.message);
      for (const one of batch) {
        const { error: e1 } = await admin.from("nfe_invoices").upsert(one, { onConflict: "access_key" });
        if (!e1) saved++;
      }
    } else saved += batch.length;
  }
  return saved;
}

async function saveEvents(admin: any, rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const m = new Map<string, Record<string, unknown>>();
  for (const e of rows) m.set(`${e.access_key}|${e.tp_evento}|${e.n_seq_evento}`, e);
  const list = [...m.values()];
  let saved = 0;
  for (let i = 0; i < list.length; i += 50) {
    const { error } = await admin.from("nfe_events").upsert(list.slice(i, i + 50), { onConflict: "access_key,tp_evento,n_seq_evento" });
    if (error) console.error("[NF-e SC] eventos:", error.message); else saved += Math.min(50, list.length - i);
  }
  const cancel = list.filter((e) => String(e.tp_evento) === "110111").map((e) => e.access_key);
  if (cancel.length) await admin.from("nfe_invoices").update({ status: "cancelada" }).in("access_key", cancel);
  return saved;
}

function buildSoapRequest(cnpj: string, ultNSU: string, chave: string | null): string {
  const filtro = chave
    ? `<solDFe><chAcesso>${chave}</chAcesso></solDFe>`
    : `<solRel><indXML>1</indXML><indAtor>3</indAtor><ultNuNSU>${ultNSU || "0"}</ultNuNSU></solRel>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <NfeDownloadContab xmlns="${SC_NS}">
      <distNFeSC versao="1.00" xmlns="${SC_NS}"><tpAmb>1</tpAmb><verAplic>vehub 1.0</verAplic><cUF>42</cUF><CNPJ>${cnpj}</CNPJ>${filtro}</distNFeSC>
    </NfeDownloadContab>
  </soap:Body>
</soap:Envelope>`;
}

type LoteEntry = { chAcesso: string | null; nsu: string; xml: string };

export function parseLote(lote: string): LoteEntry[] {
  const out: LoteEntry[] = [];
  const re = /<(distNFeSC|distDFe|docZip|DFe)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lote)) !== null) {
    const attrs = m[2] || "";
    const inner = (m[3] || "").trim();
    if (!inner) continue;
    out.push({
      nsu: (attrs.match(/NSU\s*=\s*"([^"]*)"/i) || [])[1] || "",
      chAcesso: (attrs.match(/chAcesso\s*=\s*"([^"]*)"/i) || [])[1] || null,
      xml: inner,
    });
  }
  return out;
}

export function parseNfeXml(xml: string, chAttr: string | null) {
  const chave = (chAttr || (xml.match(/Id\s*=\s*"NFe(\d{44})"/i) || [])[1] || extractTagContent(xml, "chNFe") || "").replace(/\s/g, "");
  if (chave.length !== 44 || chave.slice(20, 22) !== "55") return null;
  const ide = extractTagContent(xml, "ide") || xml;
  const emit = extractTagContent(xml, "emit") || "";
  const dest = extractTagContent(xml, "dest") || "";
  const total = extractTagContent(xml, "ICMSTot") || "";
  const dh = extractTagContent(ide, "dhEmi") || extractTagContent(ide, "dEmi");
  const v = parseFloat(extractTagContent(total, "vNF") || "0");
  return {
    access_key: chave,
    invoice_number: extractTagContent(ide, "nNF"),
    issue_date: dh && !isNaN(Date.parse(dh)) ? new Date(dh).toISOString() : null,
    emitter_cnpj: (extractTagContent(emit, "CNPJ") || extractTagContent(emit, "CPF") || "").replace(/\D/g, "") || null,
    emitter_name: extractTagContent(emit, "xNome"),
    recipient_cnpj: (extractTagContent(dest, "CNPJ") || extractTagContent(dest, "CPF") || "").replace(/\D/g, "") || null,
    recipient_name: extractTagContent(dest, "xNome"),
    total_value: isNaN(v) ? 0 : v,
  };
}

function parseEventXml(xml: string) {
  const chave = extractTagContent(xml, "chNFe");
  const tp = extractTagContent(xml, "tpEvento");
  if (!chave || !tp) return null;
  const seq = parseInt(extractTagContent(xml, "nSeqEvento") || "1", 10);
  const dh = extractTagContent(xml, "dhEvento");
  return {
    access_key: chave,
    tp_evento: tp,
    n_seq_evento: isNaN(seq) ? 1 : seq,
    descricao: extractTagContent(xml, "descEvento") || extractTagContent(xml, "xEvento"),
    dh_evento: dh && !isNaN(Date.parse(dh)) ? new Date(dh).toISOString() : null,
  };
}

function extractTagContent(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1] : null;
}

function ensureXmlProlog(xml: string): string {
  return /^\s*<\?xml/i.test(xml) ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

async function decompressGzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function requestTextWithMTLS(url: URL, body: string, certPem: string, keyPem: string): Promise<{ bodyText: string; status: number }> {
  if (NFE_PROXY_URL) {
    try {
      const r = await fetch(NFE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Token": NFE_PROXY_TOKEN },
        body: JSON.stringify({ soap_body: body, cert_pem: certPem, key_pem: keyPem, url: url.toString(), soap_action: SOAP_ACTION }),
      });
      const d = await r.json();
      if (d.success && d.body) return { bodyText: d.body, status: d.status || 200 };
      console.warn("[NF-e SC] Proxy falhou:", d.error || "resposta inválida");
    } catch (e) {
      console.warn("[NF-e SC] Erro no proxy:", (e as Error).message);
    }
  }
  const httpClient = Deno.createHttpClient({ cert: certPem, key: keyPem, http1: true, http2: false });
  try {
    const r = await fetch(url, {
      body, client: httpClient, method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: SOAP_ACTION, Accept: "text/xml, application/xml, */*" },
    });
    return { bodyText: await r.text(), status: r.status };
  } finally {
    httpClient.close();
  }
}
