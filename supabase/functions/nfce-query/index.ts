import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePfx } from "../_shared/certificate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SC_URL = "https://dfe.sat.sef.sc.gov.br/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx";
const SC_NS = "http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1";
const SOAP_ACTION = `${SC_NS}/nfceDownloadContab`;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const isServiceCall = authHeader.replace(/^Bearer\s+/i, "") === supabaseServiceKey;
    if (!isServiceCall) {
      const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const reqBody = await req.json().catch(() => ({}));
    const client_id = reqBody?.client_id;
    if (!client_id || typeof client_id !== "string") {
      return jsonResponse({ error: "client_id é obrigatório" }, 400);
    }
    const rawKey = typeof reqBody?.access_key === "string" ? reqBody.access_key.replace(/\D/g, "") : "";
    if (reqBody?.access_key && rawKey.length !== 44) {
      return jsonResponse({ error: "Chave de acesso deve ter 44 dígitos" }, 400);
    }
    const consChave: string | null = rawKey.length === 44 ? rawKey : null;

    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, company_name, document, last_nfce_nsu, nfce_next_query_at, digital_certificate_url, digital_certificate_password")
      .eq("id", client_id)
      .single();

    if (clientError || !client) return jsonResponse({ error: "Cliente não encontrado" }, 404);
    if (!client.document) return jsonResponse({ error: "Cliente sem CNPJ cadastrado" }, 400);
    if (!consChave && client.nfce_next_query_at && new Date(client.nfce_next_query_at).getTime() > Date.now()) {
      console.log(`[NFC-e] CNPJ bloqueado até ${client.nfce_next_query_at}`);
      return jsonResponse({ success: true, skipped: true, next_query_at: client.nfce_next_query_at, invoices_saved: 0, events_saved: 0 });
    }

    // SEF-SC exige que o requisitante seja contabilista do CNPJ no SAT:
    // tenta o e-CPF do contador e depois o e-CNPJ do escritório.
    const { data: company } = await adminClient
      .from("company_settings")
      .select("digital_certificate_url, digital_certificate_password, accountant_certificate_url, accountant_certificate_password")
      .limit(1)
      .maybeSingle();
    const candidates: Array<{ label: string; url: string; pwd: string }> = [];
    if (company?.accountant_certificate_url) candidates.push({ label: "e-CPF do contador", url: company.accountant_certificate_url, pwd: company.accountant_certificate_password || "" });
    if (company?.digital_certificate_url) candidates.push({ label: "e-CNPJ do escritório", url: company.digital_certificate_url, pwd: company.digital_certificate_password || "" });
    if (candidates.length === 0) return jsonResponse({ error: "Certificado do escritório/contador não configurado em Meu Escritório" }, 400);
    const certs: Array<{ label: string; certPem: string; keyPem: string }> = [];
    for (const c of candidates) {
      try {
        const { data: f, error: e } = await adminClient.storage.from("certificates").download(c.url);
        if (e || !f) { console.error(`[NFC-e] Falha ao baixar ${c.label}:`, e?.message); continue; }
        const { chainPem, keyPem } = parsePfx(new Uint8Array(await f.arrayBuffer()), c.pwd);
        certs.push({ label: c.label, certPem: chainPem, keyPem });
      } catch (err) {
        console.error(`[NFC-e] Falha ao abrir ${c.label}:`, err instanceof Error ? err.message : err);
      }
    }
    if (certs.length === 0) return jsonResponse({ error: "Não foi possível abrir o certificado do escritório/contador" }, 500);
    let certIdx = 0;

    const cnpj = client.document.replace(/\D/g, "");

    let lastNsu = client.last_nfce_nsu || "0";
    let nextQueryAt: string | null = null;
    let invoicesSaved = 0;
    let eventsSaved = 0;
    let loops = 0;
    let keepGoing = true;
    let lastStatus = "";
    let lastMotivo = "";

    while (keepGoing && loops < (consChave ? 1 : MAX_LOOPS)) {
      loops++;
      const cert = certs[certIdx];
      console.log(`[NFC-e] Loop ${loops}, ultNuNSU=${lastNsu}, CNPJ=${cnpj}, cert=${cert.label}`);

      const soapBody = buildSoapRequest(cnpj, lastNsu, consChave);
      const response = await requestTextWithMTLS(new URL(SC_URL), soapBody, cert.certPem, cert.keyPem);
      console.log(`[NFC-e] status=${response.status}, bodyLen=${response.bodyText.length}`);

      const retBody = extractTagContent(response.bodyText, "retDistNFCeSC") || response.bodyText;
      const cStat = extractTagContent(retBody, "cStat") || "";
      const xMotivo = extractTagContent(retBody, "xMotivo") || "";
      const ultNSURet = extractTagContent(retBody, "ultNuNSURet");
      const qtDfeRet = parseInt(extractTagContent(retBody, "qtDfeRet") || "0", 10);
      lastStatus = cStat;
      lastMotivo = xMotivo;
      console.log(`[NFC-e] cStat=${cStat} ${xMotivo} ultNuNSURet=${ultNSURet} qtDfeRet=${qtDfeRet}`);

      if (cStat === "8002") {
        if (certIdx + 1 < certs.length) { certIdx++; loops--; continue; }
        return jsonResponse({ success: false, not_accountant: true, cStat, xMotivo, company_name: client.company_name, invoices_saved: invoicesSaved, events_saved: eventsSaved });
      }

      if (cStat === "110") {
        if (ultNSURet) lastNsu = ultNSURet;
        continue;
      }

      // 117 = nenhum documento localizado -> sincronismo completo: aguardar 12h.
      if (cStat === "117") {
        nextQueryAt = await blockClient(adminClient, client_id, BLOCK_HOURS_COMPLETE, consChave);
        keepGoing = false;
        break;
      }

      // 657 = bloqueio por excesso de tentativas.
      if (cStat === "657") {
        nextQueryAt = await blockClient(adminClient, client_id, BLOCK_HOURS_REJECT, consChave);
        keepGoing = false;
        break;
      }

      if (cStat !== "118") {
        if (invoicesSaved > 0 || eventsSaved > 0) { keepGoing = false; break; }
        return jsonResponse({ error: `Erro SEF-SC: ${cStat} - ${xMotivo}`, cStat }, 400);
      }

      const loteB64 = extractTagContent(retBody, "loteDistComp");
      const entries = loteB64 ? parseLote(await decompressGzip(loteB64.replace(/\s/g, ""))) : [];
      console.log(`[NFC-e] ${entries.length} documento(s) no lote`);

      const invoiceRows: Array<Record<string, unknown>> = [];
      const eventRows: Array<Record<string, unknown>> = [];

      for (const entry of entries) {
        if (/<procEventoNFe[\s>]/i.test(entry.xml)) {
          const ev = parseEventXml(entry.xml);
          if (ev) eventRows.push({ ...ev, client_id, nsu: entry.nsu, raw_xml: entry.xml });
          continue;
        }
        const inv = parseNfceXml(entry.xml, entry.chAcesso);
        if (!inv) continue;
        const accessKey = inv.access_key;
        let xmlUrl: string | null = null;
        try {
          const path = `nfce/${client_id}/${accessKey}.xml`;
          const { error: upErr } = await adminClient.storage
            .from("documents")
            .upload(path, new Blob([ensureXmlProlog(entry.xml)], { type: "application/xml" }), { upsert: true });
          if (!upErr) xmlUrl = path;
        } catch (_e) { /* mantém apenas o XML no banco */ }
        invoiceRows.push({
          ...inv,
          client_id,
          nsu: entry.nsu,
          direction: inv.emitter_cnpj && inv.emitter_cnpj === cnpj ? "saida" : "entrada",
          raw_xml: ensureXmlProlog(entry.xml),
          xml_url: xmlUrl,
        });
      }

      invoicesSaved += await saveInvoices(adminClient, invoiceRows);
      eventsSaved += await saveEvents(adminClient, eventRows);

      if (!consChave && ultNSURet && ultNSURet !== "0") {
        lastNsu = ultNSURet;
        await adminClient.from("clients").update({ last_nfce_nsu: lastNsu }).eq("id", client_id);
      }

      // Lote cheio (50) => há mais documentos, pode consultar em seguida.
      // Lote incompleto => sincronismo completo: obrigatório aguardar 12h.
      if (consChave || qtDfeRet < 50) {
        if (!consChave) nextQueryAt = await blockClient(adminClient, client_id, BLOCK_HOURS_COMPLETE, false);
        keepGoing = false;
      }
    }

    return jsonResponse({
      success: true,
      invoices_saved: invoicesSaved,
      events_saved: eventsSaved,
      next_query_at: nextQueryAt,
      last_nsu: lastNsu,
      loops,
      cStat: lastStatus,
      xMotivo: lastMotivo,
    });
  } catch (error) {
    console.error("[NFC-e] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

async function blockClient(adminClient: any, clientId: string, hours: number, isKeyQuery: unknown): Promise<string | null> {
  if (isKeyQuery) return null;
  const next = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await adminClient.from("clients").update({ nfce_next_query_at: next }).eq("id", clientId);
  console.log(`[NFC-e] Próxima consulta liberada em ${next}`);
  return next;
}

async function saveInvoices(adminClient: any, rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const m = new Map<string, Record<string, unknown>>();
  for (const r of rows) m.set(String(r.access_key), r);
  const list = [...m.values()];
  let saved = 0;
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const { error } = await adminClient.from("nfce_invoices").upsert(batch, { onConflict: "access_key" });
    if (error) {
      console.error("[NFC-e] Erro no upsert de notas:", error.message);
      for (const one of batch) {
        const { error: e1 } = await adminClient.from("nfce_invoices").upsert(one, { onConflict: "access_key" });
        if (!e1) saved++;
      }
    } else saved += batch.length;
  }
  return saved;
}

async function saveEvents(adminClient: any, rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const m = new Map<string, Record<string, unknown>>();
  for (const e of rows) m.set(`${e.access_key}|${e.tp_evento}|${e.n_seq_evento}`, e);
  const list = [...m.values()];
  let saved = 0;
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const { error } = await adminClient.from("nfce_events").upsert(batch, { onConflict: "access_key,tp_evento,n_seq_evento" });
    if (error) console.error("[NFC-e] Erro ao salvar eventos:", error.message);
    else saved += batch.length;
  }
  // Cancelamento (110111) e substituição (110112) atualizam a situação da nota.
  for (const e of list) {
    const tp = String(e.tp_evento);
    if (tp !== "110111" && tp !== "110112") continue;
    await adminClient
      .from("nfce_invoices")
      .update({ status: tp === "110111" ? "cancelada" : "substituida" })
      .eq("access_key", e.access_key);
  }
  return saved;
}

function buildSoapRequest(cnpj: string, ultNSU: string, chave: string | null): string {
  const filtro = chave
    ? `<solDFe><chAcesso>${chave}</chAcesso></solDFe>`
    : `<solRel><indXML>1</indXML><indAtor>3</indAtor><ultNuNSU>${ultNSU || "0"}</ultNuNSU></solRel>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfceDownloadContab xmlns="${SC_NS}">
      <distNFCeSC versao="1.00" xmlns="${SC_NS}"><tpAmb>1</tpAmb><verAplic>vehub 1.0</verAplic><cUF>42</cUF><CNPJ>${cnpj}</CNPJ>${filtro}</distNFCeSC>
    </nfceDownloadContab>
  </soap:Body>
</soap:Envelope>`;
}

type LoteEntry = { chAcesso: string | null; nsu: string; xml: string };

export function parseLote(loteXml: string): LoteEntry[] {
  const entries: LoteEntry[] = [];
  const re = /<distNFCeSC\b([^>]*)(?:\/>|>([\s\S]*?)<\/distNFCeSC>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(loteXml)) !== null) {
    const attrs = m[1] || "";
    const inner = m[2] || "";
    const nsu = (attrs.match(/NSU\s*=\s*"([^"]*)"/i) || [])[1] || "";
    const chAcesso = (attrs.match(/chAcesso\s*=\s*"([^"]*)"/i) || [])[1] || null;
    if (!inner.trim()) continue;
    entries.push({ chAcesso, nsu, xml: inner.trim() });
  }
  return entries;
}

export function parseNfceXml(xml: string, chAcessoAttr: string | null): Record<string, string | number | null> & { access_key: string } | null {
  const chave = (chAcessoAttr || extractAccessKeyFromXml(xml) || extractTagContent(xml, "chNFe") || "").replace(/\s/g, "");
  if (chave.length !== 44) return null;
  const ide = extractTagContent(xml, "ide") || xml;
  const emit = extractTagContent(xml, "emit") || "";
  const dest = extractTagContent(xml, "dest") || "";
  const total = extractTagContent(xml, "ICMSTot") || "";
  const dhEmi = extractTagContent(ide, "dhEmi") || extractTagContent(ide, "dEmi");
  const vNF = parseFloat(extractTagContent(total, "vNF") || "0");
  return {
    access_key: chave,
    invoice_number: extractTagContent(ide, "nNF"),
    series: extractTagContent(ide, "serie"),
    issue_date: dhEmi && !isNaN(Date.parse(dhEmi)) ? new Date(dhEmi).toISOString() : null,
    emitter_cnpj: (extractTagContent(emit, "CNPJ") || "").replace(/\D/g, "") || null,
    emitter_name: extractTagContent(emit, "xNome"),
    consumer_document: (extractTagContent(dest, "CPF") || extractTagContent(dest, "CNPJ") || "").replace(/\D/g, "") || null,
    consumer_name: extractTagContent(dest, "xNome"),
    total_value: isNaN(vNF) ? 0 : vNF,
    status: "autorizada",
  };
}

export function parseEventXml(xml: string): { access_key: string; descricao: string | null; dh_evento: string | null; n_seq_evento: number; tp_evento: string } | null {
  const chave = extractTagContent(xml, "chNFe");
  const tp = extractTagContent(xml, "tpEvento");
  if (!chave || !tp) return null;
  const seq = parseInt(extractTagContent(xml, "nSeqEvento") || "1", 10);
  const dh = extractTagContent(xml, "dhEvento");
  return {
    access_key: chave,
    descricao: extractTagContent(xml, "descEvento") || extractTagContent(xml, "xEvento"),
    dh_evento: dh && !isNaN(Date.parse(dh)) ? new Date(dh).toISOString() : null,
    n_seq_evento: isNaN(seq) ? 1 : seq,
    tp_evento: tp,
  };
}

function extractAccessKeyFromXml(xml: string): string | null {
  const m = xml.match(/Id\s*=\s*"NFe(\d{44})"/i);
  return m ? m[1] : null;
}

export function extractTagContent(xml: string, tagName: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function ensureXmlProlog(xml: string): string {
  return /^\s*<\?xml/i.test(xml) ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

async function decompressGzip(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function requestTextWithMTLS(
  url: URL,
  body: string,
  certPem: string,
  keyPem: string,
): Promise<{ bodyText: string; status: number }> {
  if (NFE_PROXY_URL) {
    try {
      const proxyResponse = await fetch(NFE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Token": NFE_PROXY_TOKEN },
        body: JSON.stringify({
          soap_body: body,
          cert_pem: certPem,
          key_pem: keyPem,
          url: url.toString(),
          soap_action: SOAP_ACTION,
        }),
      });
      const proxyData = await proxyResponse.json();
      if (proxyData.success && proxyData.body) {
        return { bodyText: proxyData.body, status: proxyData.status || 200 };
      }
      console.warn("[NFC-e] Proxy falhou:", proxyData.error || "resposta inválida");
    } catch (e) {
      console.warn("[NFC-e] Erro no proxy:", (e as Error).message);
    }
  }

  const httpClient = Deno.createHttpClient({ cert: certPem, http1: true, http2: false, key: keyPem });
  try {
    const response = await fetch(url, {
      body,
      client: httpClient,
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: SOAP_ACTION,
        Accept: "text/xml, application/xml, */*",
      },
    });
    return { bodyText: await response.text(), status: response.status };
  } finally {
    httpClient.close();
  }
}
