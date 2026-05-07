import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEF_SC_URL = "https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx";
const SEF_SC_NS = "http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2";
const SOAP_ACTION = `${SEF_SC_NS}/nfeDownloadContab`;
const NFE_PROXY_URL = Deno.env.get("NFE_PROXY_URL") || "";
const NFE_PROXY_TOKEN = Deno.env.get("NFE_PROXY_TOKEN") || "";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { nfe_invoice_id, type } = await req.json();

    if (!nfe_invoice_id) return jsonResponse({ error: "nfe_invoice_id é obrigatório" }, 400);
    if (!type || !["xml", "pdf"].includes(type)) return jsonResponse({ error: "type deve ser 'xml' ou 'pdf'" }, 400);

    // Load invoice
    const { data: invoice, error: invError } = await adminClient
      .from("nfe_invoices")
      .select("*")
      .eq("id", nfe_invoice_id)
      .single();
    if (invError || !invoice) return jsonResponse({ error: "NF-e não encontrada" }, 404);
    if (!invoice.access_key) return jsonResponse({ error: "NF-e sem chave de acesso" }, 400);

    // For PDF, return the portal URL (no API without captcha)
    if (type === "pdf") {
      const portalUrl = `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&nfe=${invoice.access_key}`;
      return jsonResponse({ success: true, type: "redirect", url: portalUrl });
    }

    // === XML download ===
    // Check if we already have the full XML cached in storage
    if (invoice.xml_url) {
      const { data: signedData } = await adminClient.storage
        .from("documents")
        .createSignedUrl(invoice.xml_url, 600);
      if (signedData?.signedUrl) {
        return jsonResponse({ success: true, type: "signed_url", url: signedData.signedUrl });
      }
    }

    // Check if raw_xml contains full procNFe (not just resNFe summary)
    if (invoice.raw_xml && /<nfeProc/i.test(invoice.raw_xml)) {
      // Upload to storage and return
      const storagePath = `nfe/${invoice.client_id}/${invoice.access_key}.xml`;
      const xmlBlob = new Blob([invoice.raw_xml], { type: "application/xml" });
      await adminClient.storage.from("documents").upload(storagePath, xmlBlob, { upsert: true });
      await adminClient.from("nfe_invoices").update({ xml_url: storagePath }).eq("id", nfe_invoice_id);

      const { data: signedData } = await adminClient.storage.from("documents").createSignedUrl(storagePath, 600);
      return jsonResponse({ success: true, type: "signed_url", url: signedData?.signedUrl || "" });
    }

    // Need to fetch full XML via SEF-SC NfeDownload (nfeDownloadContab)
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, document")
      .eq("id", invoice.client_id)
      .single();
    if (clientError || !client) return jsonResponse({ error: "Cliente não encontrado" }, 404);
    if (!client.document) return jsonResponse({ error: "Cliente sem CNPJ cadastrado" }, 400);

    // Load accountant (contador) certificate from company_settings
    const { data: office } = await adminClient
      .from("company_settings")
      .select("accountant_certificate_url, accountant_certificate_password")
      .limit(1)
      .maybeSingle();
    if (!office?.accountant_certificate_url) {
      return jsonResponse({
        error: "Certificado do contador não cadastrado. Vá em Configurações → Empresa para cadastrar.",
        reason: "contador_cert_missing",
      }, 400);
    }

    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates")
      .download(office.accountant_certificate_url);
    if (certError || !certData) return jsonResponse({ error: "Erro ao baixar certificado do contador" }, 500);

    const pfxBytes = new Uint8Array(await certData.arrayBuffer());
    const { certPem, keyPem } = await parsePfx(pfxBytes, office.accountant_certificate_password || "");
    const cnpjCliente = (client.document || "").replace(/\D/g, "");

    // Build SEF-SC nfeDownloadContab SOAP request
    const soapBody = buildSefScDownloadRequest(cnpjCliente, invoice.access_key);
    console.log(`[nfe-download] SEF-SC fetch chave=${invoice.access_key} CNPJ=${cnpjCliente}`);

    const response = await requestTextWithMTLS(
      new URL(SEF_SC_URL),
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: SOAP_ACTION,
          Accept: "text/xml, application/xml, */*",
        },
        body: soapBody,
      },
      certPem,
      keyPem,
    );

    console.log(`[nfe-download] Response status=${response.status}, bodyLen=${response.bodyText.length}`);

    const retBody = extractTagContent(response.bodyText, "retDistNFeSC") ||
      extractTagContent(response.bodyText, "retdistNFeSC") ||
      response.bodyText;

    const cStat = extractTagContent(retBody, "cStat");
    const xMotivo = extractTagContent(retBody, "xMotivo");
    console.log(`[nfe-download] cStat=${cStat}, xMotivo=${xMotivo}`);

    if (cStat !== "138") {
      const isAuth = ["280","281","282","283","284","285","286"].includes(cStat || "");
      return jsonResponse({
        error: `SEF-SC: ${cStat} - ${xMotivo}` + (isAuth ? " (verifique vínculo do contador no e-SAT/SC)" : ""),
        cStat,
      }, 400);
    }

    // Extract <loteDistComp> (base64 + gzip) and decompress -> <loteDistNFeSC>
    const loteCompB64 = extractTagContent(retBody, "loteDistComp");
    if (!loteCompB64) {
      return jsonResponse({ error: "Nenhum documento retornado pela SEF-SC" }, 400);
    }

    const loteXml = await decompressGzip(loteCompB64.replace(/\s+/g, ""));
    console.log(`[nfe-download] Decompressed loteDistNFeSC length=${loteXml.length}`);

    // Inside <loteDistNFeSC><distNFeSC NSU=".." chAcesso=".."><nfeProc>...</nfeProc></distNFeSC>
    const nfeProcMatch = loteXml.match(/<nfeProc[\s\S]*?<\/nfeProc>/i);
    if (!nfeProcMatch) {
      return jsonResponse({ error: "Resposta SEF-SC sem nfeProc (apenas evento ou vazio)" }, 400);
    }
    const fullXml = nfeProcMatch[0];

    // Save to storage
    const storagePath = `nfe/${invoice.client_id}/${invoice.access_key}.xml`;
    const xmlBlob = new Blob([fullXml], { type: "application/xml" });
    await adminClient.storage.from("documents").upload(storagePath, xmlBlob, { upsert: true });

    // Extract structured fields from full XML
    const emitterCnpj = extractInnerTag(fullXml, "emit", "CNPJ");
    const emitterName = extractInnerTag(fullXml, "emit", "xNome") || extractInnerTag(fullXml, "emit", "xFant");
    const recipientCnpj = extractInnerTag(fullXml, "dest", "CNPJ") || extractInnerTag(fullXml, "dest", "CPF");
    const recipientName = extractInnerTag(fullXml, "dest", "xNome");
    const invoiceNumber = extractTagContent(fullXml, "nNF");
    const totalValueStr = extractInnerTag(fullXml, "ICMSTot", "vNF") || extractTagContent(fullXml, "vNF");
    const totalValue = totalValueStr ? parseFloat(totalValueStr) : null;

    const updatePayload: Record<string, unknown> = {
      xml_url: storagePath,
      raw_xml: fullXml,
    };
    if (emitterCnpj) updatePayload.emitter_cnpj = emitterCnpj;
    if (emitterName) updatePayload.emitter_name = emitterName;
    if (recipientCnpj) updatePayload.recipient_cnpj = recipientCnpj;
    if (recipientName) updatePayload.recipient_name = recipientName;
    if (invoiceNumber) updatePayload.invoice_number = invoiceNumber;
    if (totalValue && !isNaN(totalValue)) updatePayload.total_value = totalValue;

    await adminClient.from("nfe_invoices").update(updatePayload).eq("id", nfe_invoice_id);

    const { data: signedData } = await adminClient.storage.from("documents").createSignedUrl(storagePath, 600);
    return jsonResponse({ success: true, type: "signed_url", url: signedData?.signedUrl || "" });

  } catch (error) {
    console.error("[nfe-download] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

function buildSefScDownloadRequest(cnpjCliente: string, chAcesso: string): string {
  // SEF-SC NfeDownload / nfeDownloadContab — schema distNFeSC_v2.00.xsd
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${SEF_SC_NS}">
  <soap:Body>
    <ns:nfeDownloadContab>
      <ns:nfeDadosMsg>
        <distNFeSC versao="2.00" xmlns="${SEF_SC_NS}">
          <tpAmb>1</tpAmb>
          <verAplic>velocita 1.0</verAplic>
          <cUF>42</cUF>
          <CNPJ>${cnpjCliente}</CNPJ>
          <solDFe>
            <chAcesso>${chAcesso}</chAcesso>
          </solDFe>
        </distNFeSC>
      </ns:nfeDadosMsg>
    </ns:nfeDownloadContab>
  </soap:Body>
</soap:Envelope>`;
}

function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractInnerTag(xml: string, parentTag: string, childTag: string): string | null {
  const parentContent = extractTagContent(xml, parentTag);
  if (!parentContent) return null;
  return extractTagContent(parentContent, childTag);
}

async function decompressGzip(base64Data: string): Promise<string> {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

type MtlsTextResponse = {
  bodyText: string;
  headers: Headers;
  status: number;
  statusText: string;
  strategy: string;
  url: string;
};

async function requestTextWithMTLS(
  url: URL,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
): Promise<MtlsTextResponse> {
  if (NFE_PROXY_URL) {
    try {
      console.log(`[nfe-download] Tentando via proxy: ${NFE_PROXY_URL}`);
      const soapAction = init.headers
        ? (init.headers instanceof Headers
            ? init.headers.get("SOAPAction")
            : (init.headers as Record<string, string>)["SOAPAction"])
        : null;

      const proxyResponse = await fetch(NFE_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Proxy-Token": NFE_PROXY_TOKEN,
        },
        body: JSON.stringify({
          soap_body: init.body || "",
          cert_pem: certPem,
          key_pem: keyPem,
          url: url.toString(),
          soap_action: soapAction || SOAP_ACTION,
        }),
      });

      const proxyData = await proxyResponse.json();
      if (proxyData.success && proxyData.body) {
        return {
          bodyText: proxyData.body,
          headers: new Headers(),
          status: proxyData.status || 200,
          statusText: "OK",
          strategy: "proxy-php",
          url: url.toString(),
        };
      }
      console.warn(`[nfe-download] Proxy falhou:`, proxyData.error || "resposta inválida");
    } catch (proxyError) {
      console.warn(`[nfe-download] Erro ao usar proxy:`, (proxyError as Error).message);
    }
  }

  // Direct mTLS fallback
  const httpClient = Deno.createHttpClient({ cert: certPem, http1: true, http2: false, key: keyPem });
  try {
    const response = await fetch(url, { body: init.body, client: httpClient, headers: init.headers, method: init.method });
    const bodyText = await response.text();
    return { bodyText, headers: response.headers, status: response.status, statusText: response.statusText, strategy: "direct-mtls", url: url.toString() };
  } finally {
    httpClient.close();
  }
}

async function parsePfx(pfxBytes: Uint8Array, password: string): Promise<{ certPem: string; keyPem: string }> {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < pfxBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...pfxBytes.subarray(i, i + chunkSize));
  }
  const asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no certificado");

  const keyPem = forge.pki.privateKeyToPem(keyBag.key);
  const keyLocalKeyId = normalizeLocalKeyId(keyBag.attributes?.localKeyId?.[0]);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const parsedCerts = ((certBags[forge.pki.oids.certBag] || []) as Array<any>)
    .filter((bag) => bag?.cert)
    .map((bag) => ({
      issuer: stringifyDN(bag.cert.issuer),
      localKeyId: normalizeLocalKeyId(bag.attributes?.localKeyId?.[0]),
      pem: forge.pki.certificateToPem(bag.cert),
      subject: stringifyDN(bag.cert.subject),
    }));

  if (parsedCerts.length === 0) throw new Error("Certificado não encontrado no PFX");

  const leafCert = parsedCerts.find((c) => keyLocalKeyId && c.localKeyId === keyLocalKeyId)
    || parsedCerts.find((c) => c.subject !== c.issuer)
    || parsedCerts[0];

  const chainCerts = parsedCerts.filter((c) => c !== leafCert);
  const fullCertPem = [leafCert.pem.trim(), ...chainCerts.map((c) => c.pem.trim())].join("\n");
  return { certPem: fullCertPem, keyPem };
}

function normalizeLocalKeyId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return forge.util.bytesToHex(value);
  if (value instanceof Uint8Array) return Array.from(value).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (Array.isArray(value)) return value.map((b) => Number(b).toString(16).padStart(2, "0")).join("");
  return null;
}

function stringifyDN(dn: { attributes?: Array<{ shortName?: string; name?: string; value?: string }> }): string {
  return (dn.attributes || []).map((a) => `${a.shortName || a.name || "attr"}=${a.value || ""}`).join(",");
}
