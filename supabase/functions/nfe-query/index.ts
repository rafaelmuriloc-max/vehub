import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AN_URL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
const MAX_LOOPS = 20;

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
    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { client_id } = await req.json();
    if (!client_id) {
      return jsonResponse({ error: "client_id é obrigatório" }, 400);
    }

    // Load client
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, company_name, document, digital_certificate_url, digital_certificate_password, last_nfe_nsu")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return jsonResponse({ error: "Cliente não encontrado" }, 404);
    }

    if (!client.document) {
      return jsonResponse({ error: "Cliente sem CNPJ cadastrado" }, 400);
    }
    if (!client.digital_certificate_url) {
      return jsonResponse({ error: "Cliente sem certificado digital" }, 400);
    }

    // Download certificate
    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates")
      .download(client.digital_certificate_url);
    if (certError || !certData) {
      return jsonResponse({ error: "Erro ao baixar certificado: " + (certError?.message || "desconhecido") }, 500);
    }

    const pfxBytes = new Uint8Array(await certData.arrayBuffer());
    const password = client.digital_certificate_password || "";
    const { certPem, keyPem } = await parsePfx(pfxBytes, password);

    const cnpj = client.document.replace(/\D/g, "");
    let lastNsu = client.last_nfe_nsu || "0";
    let totalSaved = 0;
    let loops = 0;
    let keepGoing = true;

    while (keepGoing && loops < MAX_LOOPS) {
      loops++;
      console.log(`[NF-e] Loop ${loops}, ultNuNSU=${lastNsu}, CNPJ=${cnpj}`);

      const soapBody = buildSoapRequest(cnpj, lastNsu);
      const response = await requestTextWithMTLS(
        new URL(AN_URL),
        {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: SOAP_ACTION,
          },
          body: soapBody,
        },
        certPem,
        keyPem,
      );

      console.log(`[NF-e] Response status=${response.status}, bodyLen=${response.bodyText.length}`);

      // Extract retDistDFeInt content
      const retBody = extractTagContent(response.bodyText, "retDistDFeInt") || 
                      extractTagContent(response.bodyText, "retdistDFeInt") ||
                      response.bodyText;

      const cStat = extractTagContent(retBody, "cStat");
      const xMotivo = extractTagContent(retBody, "xMotivo");
      const maxNSU = extractTagContent(retBody, "maxNSU");
      const ultNSU = extractTagContent(retBody, "ultNSU");

      console.log(`[NF-e] cStat=${cStat}, xMotivo=${xMotivo}, maxNSU=${maxNSU}, ultNSU=${ultNSU}`);

      if (cStat === "137") {
        // No documents found
        console.log("[NF-e] Nenhum DF-e localizado (137)");
        keepGoing = false;
        break;
      }

      if (cStat !== "138") {
        if (totalSaved > 0) {
          keepGoing = false;
          break;
        }
        return jsonResponse({ error: `Erro AN: ${cStat} - ${xMotivo}`, cStat }, 400);
      }

      // Extract loteDistDFeInt and parse docZip entries
      const loteContent = extractTagContent(retBody, "loteDistDFeInt") || retBody;
      const entries = await parseDocZipEntries(loteContent);
      console.log(`[NF-e] Parsed ${entries.length} entries from docZip`);

      if (entries.length === 0) {
        keepGoing = false;
        break;
      }

      // Process entries and upsert
      const invoicesToSave = [];
      for (const entry of entries) {
        const parsed = parseNfeEntry(entry, client_id);
        if (parsed) {
          invoicesToSave.push(parsed);
        }
      }

      if (invoicesToSave.length > 0) {
        const batchSize = 20;
        for (let i = 0; i < invoicesToSave.length; i += batchSize) {
          const batch = invoicesToSave.slice(i, i + batchSize);
          const { error: upsertError } = await adminClient
            .from("nfe_invoices")
            .upsert(batch, { onConflict: "access_key", ignoreDuplicates: false });
          if (upsertError) {
            console.error("[NF-e] Upsert error:", upsertError.message);
          }
        }
        totalSaved += invoicesToSave.length;
      }

      // Update last NSU
      const newLastNsu = ultNSU || lastNsu;
      if (newLastNsu && newLastNsu !== "0") {
        lastNsu = newLastNsu;
        await adminClient
          .from("clients")
          .update({ last_nfe_nsu: lastNsu })
          .eq("id", client_id);
      }

      // Continue if ultNSU < maxNSU (more documents available)
      keepGoing = !!(maxNSU && ultNSU && ultNSU < maxNSU);
    }

    return jsonResponse({
      success: true,
      invoices_saved: totalSaved,
      last_nsu: lastNsu,
      loops,
    });
  } catch (error) {
    console.error("[NF-e] Error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

// --- SOAP Request Builder ---
function buildSoapRequest(cnpj: string, ultNuNSU: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <distNFeSC versao="2.00" xmlns="http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2">
      <tpAmb>1</tpAmb>
      <verAplic>VeHub 1.0</verAplic>
      <cUF>42</cUF>
      <CNPJ>${cnpj}</CNPJ>
      <solRel>
        <indXML>1</indXML>
        <indAtor>3</indAtor>
        <ultNuNSU>${ultNuNSU}</ultNuNSU>
      </solRel>
    </distNFeSC>
  </soap:Body>
</soap:Envelope>`;
}

// --- XML Tag Extraction ---
function extractTagContent(xml: string, tagName: string): string | null {
  // Case-insensitive tag search
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// --- Gzip Decompression ---
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

// --- Parse distNFeSC entries from loteDistNFeSC ---
type DistEntry = {
  nsu: string | null;
  chAcesso: string | null;
  xmlContent: string | null;
  isEvent: boolean;
};

function parseDistEntries(loteXml: string): DistEntry[] {
  const entries: DistEntry[] = [];
  // Match <distNFeSC ... > ... </distNFeSC> entries inside loteDistNFeSC
  const entryRegex = /<distNFeSC\s+([^>]*)>([\s\S]*?)<\/distNFeSC>/gi;
  let match;

  while ((match = entryRegex.exec(loteXml)) !== null) {
    const attrs = match[1];
    const content = match[2];

    const nsuMatch = attrs.match(/NSU\s*=\s*"([^"]+)"/i);
    const chMatch = attrs.match(/chAcesso\s*=\s*"([^"]+)"/i);

    const isEvent = /<procEventoNFe/i.test(content);
    const hasNfeProc = /<nfeProc/i.test(content);

    entries.push({
      nsu: nsuMatch ? nsuMatch[1] : null,
      chAcesso: chMatch ? chMatch[1] : null,
      xmlContent: hasNfeProc || isEvent ? content.trim() : null,
      isEvent,
    });
  }

  return entries;
}

// --- Parse NF-e entry into DB record ---
function parseNfeEntry(entry: DistEntry, clientId: string): Record<string, unknown> | null {
  if (!entry.chAcesso) return null;

  const xml = entry.xmlContent || "";

  // Extract basic NF-e data from XML
  const invoiceNumber = extractTagContent(xml, "nNF");
  const issueDate = extractTagContent(xml, "dhEmi")?.slice(0, 10) || extractTagContent(xml, "dEmi");
  const emitterCnpj = extractInnerTag(xml, "emit", "CNPJ");
  const emitterName = extractInnerTag(xml, "emit", "xNome") || extractInnerTag(xml, "emit", "xFant");
  const recipientCnpj = extractInnerTag(xml, "dest", "CNPJ") || extractInnerTag(xml, "dest", "CPF");
  const recipientName = extractInnerTag(xml, "dest", "xNome");
  const totalValue = parseFloat(extractInnerTag(xml, "ICMSTot", "vNF") || extractTagContent(xml, "vNF") || "0");

  // Determine status
  let status = "autorizada";
  if (entry.isEvent) {
    const tpEvento = extractTagContent(xml, "tpEvento");
    if (tpEvento === "110111") status = "cancelada";
    else status = `evento_${tpEvento || "desconhecido"}`;
  }

  return {
    client_id: clientId,
    access_key: entry.chAcesso,
    invoice_number: invoiceNumber,
    issue_date: issueDate || null,
    emitter_cnpj: emitterCnpj,
    emitter_name: emitterName,
    recipient_cnpj: recipientCnpj,
    recipient_name: recipientName,
    total_value: isNaN(totalValue) ? 0 : totalValue,
    status,
    nsu: entry.nsu,
    raw_xml: entry.xmlContent,
  };
}

function extractInnerTag(xml: string, parentTag: string, childTag: string): string | null {
  const parentContent = extractTagContent(xml, parentTag);
  if (!parentContent) return null;
  return extractTagContent(parentContent, childTag);
}

// --- mTLS functions (reused from nfse-query) ---
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
  const attempts = [
    { label: "fetch-http1", type: "fetch" as const },
    { alpnProtocols: ["http/1.1"], label: "raw-http1-alpn", type: "raw" as const },
    { label: "raw-http1-no-alpn", type: "raw" as const },
  ];

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          const delay = Math.pow(2, retry) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
        console.log(`[NF-e] Tentando mTLS ${attempt.label} para ${url.toString()}`);

        if (attempt.type === "fetch") {
          return await requestWithFetchHttp1(url, init, certPem, keyPem, attempt.label);
        }
        return await sendRawHttpRequestOverTls(url, init, certPem, keyPem, attempt.label, attempt.alpnProtocols);
      } catch (error) {
        lastError = error as Error;
        const msg = (error as Error).message || "";
        console.error(`[NF-e] Falha ${attempt.label} (tentativa ${retry + 1}):`, msg);
        if (!msg.includes("reset") && !msg.includes("refused") && !msg.includes("timeout")) break;
      }
    }
  }
  throw lastError || new Error("Falha ao conectar via mTLS");
}

async function requestWithFetchHttp1(
  url: URL, init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string, keyPem: string, strategy: string,
): Promise<MtlsTextResponse> {
  const httpClient = Deno.createHttpClient({ cert: certPem, http1: true, http2: false, key: keyPem });
  try {
    // @ts-expect-error Deno fetch supports client
    const response = await fetch(url, { body: init.body, client: httpClient, headers: init.headers, method: init.method });
    const bodyText = await response.text();
    return { bodyText, headers: response.headers, status: response.status, statusText: response.statusText, strategy, url: url.toString() };
  } finally {
    httpClient.close();
  }
}

async function sendRawHttpRequestOverTls(
  url: URL, init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string, keyPem: string, strategy: string, alpnProtocols?: string[],
): Promise<MtlsTextResponse> {
  const encoder = new TextEncoder();
  const bodyText = init.body ?? "";
  const bodyBytes = encoder.encode(bodyText);
  const conn = await Deno.connectTls({
    hostname: url.hostname, port: Number(url.port || 443),
    cert: certPem, key: keyPem,
    ...(alpnProtocols ? { alpnProtocols } : {}),
  });

  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Host")) headers.set("Host", url.host);
    if (!headers.has("Accept")) headers.set("Accept", "text/xml, application/xml, */*");
    if (!headers.has("Accept-Encoding")) headers.set("Accept-Encoding", "identity");
    if (!headers.has("Connection")) headers.set("Connection", "close");
    if (!headers.has("User-Agent")) headers.set("User-Agent", "VeHub-NFe/1.0");
    if (bodyBytes.byteLength > 0 && !headers.has("Content-Length")) {
      headers.set("Content-Length", String(bodyBytes.byteLength));
    }

    const requestHead = [
      `${init.method} ${url.pathname}${url.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([name, value]) => `${name}: ${value}`),
      "", "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));
    if (bodyBytes.byteLength > 0) await conn.write(bodyBytes);

    const responseBytes = await readAllFromConnection(conn, 30000);
    const rawResponse = new TextDecoder().decode(responseBytes);
    const response = parseRawHttpResponse(rawResponse);
    const responseBody = await response.text();

    return { bodyText: responseBody, headers: response.headers, status: response.status, statusText: response.statusText, strategy, url: url.toString() };
  } finally {
    conn.close();
  }
}

async function readAllFromConnection(conn: Deno.Conn, timeoutMs: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  let didTimeout = false;
  const timeout = setTimeout(() => { didTimeout = true; try { conn.close(); } catch {} }, timeoutMs);

  try {
    while (true) {
      const buffer = new Uint8Array(16_384);
      const bytesRead = await conn.read(buffer);
      if (bytesRead === null) break;
      const chunk = buffer.slice(0, bytesRead);
      chunks.push(chunk);
      totalLength += chunk.length;
    }
  } finally {
    clearTimeout(timeout);
  }

  if (didTimeout) throw new Error(`Timeout na conexão com SEF-SC após ${timeoutMs}ms`);

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function parseRawHttpResponse(rawResponse: string): Response {
  const separatorIndex = rawResponse.indexOf("\r\n\r\n");
  if (separatorIndex === -1) throw new Error("Resposta HTTP inválida da SEF-SC");

  const rawHeaders = rawResponse.slice(0, separatorIndex);
  let rawBody = rawResponse.slice(separatorIndex + 4);
  const headerLines = rawHeaders.split("\r\n");
  const statusLine = headerLines.shift() || "";
  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);
  if (!statusMatch) throw new Error(`Status HTTP inválido: ${statusLine}`);

  const headers = new Headers();
  for (const line of headerLines) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    headers.append(line.slice(0, sep).trim(), line.slice(sep + 1).trim());
  }

  if ((headers.get("transfer-encoding") || "").toLowerCase().includes("chunked")) {
    rawBody = decodeChunkedBody(rawBody);
  }

  return new Response(rawBody, { headers, status: Number(statusMatch[1]), statusText: statusMatch[2] });
}

function decodeChunkedBody(rawBody: string): string {
  let position = 0;
  let decoded = "";
  while (position < rawBody.length) {
    const lineEnd = rawBody.indexOf("\r\n", position);
    if (lineEnd === -1) break;
    const sizeHex = rawBody.slice(position, lineEnd).split(";", 1)[0].trim();
    const chunkSize = parseInt(sizeHex, 16);
    if (isNaN(chunkSize)) throw new Error("Resposta chunked inválida");
    position = lineEnd + 2;
    if (chunkSize === 0) break;
    decoded += rawBody.slice(position, position + chunkSize);
    position += chunkSize + 2;
  }
  return decoded;
}

// --- PFX Parser ---
type ParsedCertificate = { issuer: string; localKeyId: string | null; pem: string; subject: string };

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
  const parsedCerts: ParsedCertificate[] = ((certBags[forge.pki.oids.certBag] || []) as Array<any>)
    .filter((bag) => bag?.cert)
    .map((bag) => ({
      issuer: stringifyDN(bag.cert.issuer),
      localKeyId: normalizeLocalKeyId(bag.attributes?.localKeyId?.[0]),
      pem: forge.pki.certificateToPem(bag.cert),
      subject: stringifyDN(bag.cert.subject),
    }));

  if (parsedCerts.length === 0) throw new Error("Certificado não encontrado no PFX");

  const leafCert = parsedCerts.find((c) => keyLocalKeyId && c.localKeyId === keyLocalKeyId) || parsedCerts[0];
  const chain = buildCertChain(leafCert, parsedCerts);

  return { certPem: chain.map((c) => c.pem.trim()).join("\n"), keyPem };
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

function buildCertChain(leaf: ParsedCertificate, all: ParsedCertificate[]): ParsedCertificate[] {
  const chain = [leaf];
  const visited = new Set([leaf.pem]);
  let current = leaf;
  while (true) {
    const next = all.find((c) => !visited.has(c.pem) && c.subject === current.issuer);
    if (!next) break;
    chain.push(next);
    visited.add(next.pem);
    if (next.subject === next.issuer) break;
    current = next;
  }
  return chain;
}
