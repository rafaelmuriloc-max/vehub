import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ParsedCertificate = {
  issuer: string;
  localKeyId: string | null;
  pem: string;
  subject: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoice_id, type } = await req.json();
    if (!invoice_id || !type || !["xml", "pdf"].includes(type)) {
      return jsonResponse({ error: "invoice_id e type (xml|pdf) são obrigatórios" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Load invoice
    const { data: invoice, error: invErr } = await adminClient
      .from("invoices")
      .select("id, client_id, access_key, xml_url, pdf_url, raw_data")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return jsonResponse({ error: "Nota fiscal não encontrada" }, 404);
    }

    const accessKey = invoice.access_key;
    if (!accessKey) {
      return jsonResponse({ error: "Nota fiscal sem chave de acesso" }, 400);
    }

    const clientId = invoice.client_id;

    if (type === "xml") {
      return await handleXmlDownload(adminClient, invoice, clientId, accessKey);
    } else {
      return await handlePdfDownload(adminClient, invoice, clientId, accessKey);
    }
  } catch (err) {
    console.error("nfse-download error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

async function handleXmlDownload(
  adminClient: any,
  invoice: any,
  clientId: string,
  accessKey: string,
) {
  // If already uploaded, return signed URL
  if (invoice.xml_url) {
    const { data } = await adminClient.storage.from("documents").createSignedUrl(invoice.xml_url, 300);
    if (data?.signedUrl) {
      return jsonResponse({ signed_url: data.signedUrl, cached: true });
    }
  }

  // Extract XML from raw_data
  const rawData = invoice.raw_data;
  let xmlContent: string | null = null;

  if (rawData && typeof rawData === "object") {
    if (typeof rawData.xml === "string") {
      xmlContent = rawData.xml;
    }
  }

  if (!xmlContent) {
    return jsonResponse({ error: "XML não encontrado nos dados da nota" }, 404);
  }

  // Upload to storage
  const storagePath = `nfse/${clientId}/${accessKey}.xml`;
  const xmlBlob = new Blob([xmlContent], { type: "application/xml" });

  const { error: uploadErr } = await adminClient.storage
    .from("documents")
    .upload(storagePath, xmlBlob, { upsert: true, contentType: "application/xml" });

  if (uploadErr) {
    console.error("XML upload error:", uploadErr);
    return jsonResponse({ error: "Erro ao salvar XML no storage" }, 500);
  }

  // Update invoice
  await adminClient.from("invoices").update({ xml_url: storagePath }).eq("id", invoice.id);

  // Return signed URL
  const { data } = await adminClient.storage.from("documents").createSignedUrl(storagePath, 300);
  return jsonResponse({ signed_url: data?.signedUrl || null, cached: false });
}

async function handlePdfDownload(
  adminClient: any,
  invoice: any,
  clientId: string,
  accessKey: string,
) {
  // If already uploaded, return signed URL
  if (invoice.pdf_url) {
    const { data } = await adminClient.storage.from("documents").createSignedUrl(invoice.pdf_url, 300);
    if (data?.signedUrl) {
      return jsonResponse({ signed_url: data.signedUrl, cached: true });
    }
  }

  // Load client certificate
  const { data: client, error: clientErr } = await adminClient
    .from("clients")
    .select("digital_certificate_url, digital_certificate_password")
    .eq("id", clientId)
    .single();

  if (clientErr || !client?.digital_certificate_url || !client?.digital_certificate_password) {
    return jsonResponse({ error: "Certificado digital do cliente não configurado" }, 400);
  }

  // Download certificate from storage
  const { data: certFile, error: certErr } = await adminClient.storage
    .from("certificates")
    .download(client.digital_certificate_url);

  if (certErr || !certFile) {
    return jsonResponse({ error: "Erro ao baixar certificado digital" }, 500);
  }

  const pfxBytes = new Uint8Array(await certFile.arrayBuffer());
  const { certPem, keyPem } = await parsePfx(pfxBytes, client.digital_certificate_password);

  // Fetch PDF from ADN via mTLS
  const pdfUrl = new URL(`https://adn.nfse.gov.br/danfse/${accessKey}`);
  console.log(`Fetching PDF from: ${pdfUrl.toString()}`);

  const pdfBytes = await requestBinaryWithMTLS(pdfUrl, {
    method: "GET",
    headers: { "Accept": "application/pdf" },
  }, certPem, keyPem);

  if (!pdfBytes || pdfBytes.length === 0) {
    return jsonResponse({ error: "PDF vazio ou não disponível no portal" }, 404);
  }

  // Upload to storage
  const storagePath = `nfse/${clientId}/${accessKey}.pdf`;
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

  const { error: uploadErr } = await adminClient.storage
    .from("documents")
    .upload(storagePath, pdfBlob, { upsert: true, contentType: "application/pdf" });

  if (uploadErr) {
    console.error("PDF upload error:", uploadErr);
    return jsonResponse({ error: "Erro ao salvar PDF no storage" }, 500);
  }

  // Update invoice
  await adminClient.from("invoices").update({ pdf_url: storagePath }).eq("id", invoice.id);

  // Return signed URL
  const { data } = await adminClient.storage.from("documents").createSignedUrl(storagePath, 300);
  return jsonResponse({ signed_url: data?.signedUrl || null, cached: false });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ========== mTLS utilities (from nfse-query) ==========

async function requestBinaryWithMTLS(
  url: URL,
  init: { body?: string; headers?: Record<string, string>; method: string },
  certPem: string,
  keyPem: string,
): Promise<Uint8Array> {
  // Strategy 1: Deno fetch with HTTP client
  try {
    console.log(`[PDF] Trying fetch-http1 for ${url.toString()}`);
    const httpClient = Deno.createHttpClient({
      cert: certPem,
      http1: true,
      http2: false,
      key: keyPem,
    });

    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.headers,
        // @ts-expect-error Deno fetch supports client
        client: httpClient,
      });

      console.log(`[PDF] fetch-http1 status: ${response.status}`);
      if (response.status === 200) {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }

      const text = await response.text();
      console.error(`[PDF] fetch-http1 non-200: ${response.status} - ${text.substring(0, 200)}`);
      
      if (response.status === 429) {
        throw new Error("Rate limit do portal (429). Tente novamente em alguns segundos.");
      }
      throw new Error(`Portal retornou status ${response.status}`);
    } finally {
      httpClient.close();
    }
  } catch (err) {
    const msg = (err as Error).message || "";
    console.error(`[PDF] fetch-http1 failed: ${msg}`);
    
    // If it's a meaningful error (not connection), rethrow
    if (msg.includes("429") || msg.includes("Rate limit")) {
      throw err;
    }
  }

  // Strategy 2: Raw TLS connection
  try {
    console.log(`[PDF] Trying raw-tls for ${url.toString()}`);
    return await requestBinaryRawTls(url, init, certPem, keyPem);
  } catch (err) {
    console.error(`[PDF] raw-tls failed: ${(err as Error).message}`);
    throw err;
  }
}

async function requestBinaryRawTls(
  url: URL,
  init: { body?: string; headers?: Record<string, string>; method: string },
  certPem: string,
  keyPem: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const conn = await Deno.connectTls({
    hostname: url.hostname,
    port: Number(url.port || 443),
    cert: certPem,
    key: keyPem,
    alpnProtocols: ["http/1.1"],
  });

  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Host")) headers.set("Host", url.host);
    if (!headers.has("Accept")) headers.set("Accept", "application/pdf");
    if (!headers.has("Accept-Encoding")) headers.set("Accept-Encoding", "identity");
    if (!headers.has("Connection")) headers.set("Connection", "close");
    if (!headers.has("User-Agent")) headers.set("User-Agent", "Lovable-NFSe/1.0");

    const requestHead = [
      `${init.method} ${url.pathname}${url.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([name, value]) => `${name}: ${value}`),
      "",
      "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));

    const responseBytes = await readAllFromConnection(conn, 30000);
    
    // Parse HTTP response to extract binary body
    return parseRawHttpBinaryResponse(responseBytes);
  } finally {
    conn.close();
  }
}

async function readAllFromConnection(conn: Deno.Conn, timeoutMs: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  let didTimeout = false;

  const timeout = setTimeout(() => {
    didTimeout = true;
    try { conn.close(); } catch { /* no-op */ }
  }, timeoutMs);

  try {
    while (true) {
      const buffer = new Uint8Array(16_384);
      let bytesRead: number | null;
      try {
        bytesRead = await conn.read(buffer);
      } catch (err) {
        const msg = (err as Error)?.message || "";
        // Alguns servidores encerram o TLS sem close_notify: usar o que já foi lido
        if (msg.includes("close_notify") || (err as Error)?.name === "UnexpectedEof") {
          break;
        }
        throw err;
      }
      if (bytesRead === null) break;
      const chunk = buffer.slice(0, bytesRead);
      chunks.push(chunk);
      totalLength += chunk.length;
    }
  } finally {
    clearTimeout(timeout);
  }


  if (didTimeout) {
    throw new Error(`Timeout ao baixar PDF após ${timeoutMs}ms`);
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function parseRawHttpBinaryResponse(raw: Uint8Array): Uint8Array {
  // Find header/body separator: \r\n\r\n
  const separator = [13, 10, 13, 10]; // \r\n\r\n
  let sepIndex = -1;
  
  for (let i = 0; i < raw.length - 3; i++) {
    if (raw[i] === separator[0] && raw[i+1] === separator[1] && raw[i+2] === separator[2] && raw[i+3] === separator[3]) {
      sepIndex = i;
      break;
    }
  }

  if (sepIndex === -1) {
    throw new Error("Resposta HTTP inválida do portal");
  }

  const headerText = new TextDecoder().decode(raw.slice(0, sepIndex));
  const statusMatch = headerText.match(/^HTTP\/\d\.\d\s+(\d{3})/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 0;
  
  console.log(`[PDF] Raw response status: ${status}, total bytes: ${raw.length}`);
  
  if (status !== 200) {
    const bodyPreview = new TextDecoder().decode(raw.slice(sepIndex + 4, sepIndex + 504));
    throw new Error(`Portal retornou status ${status}: ${bodyPreview}`);
  }

  const body = raw.slice(sepIndex + 4);
  
  // Check if chunked transfer encoding
  if (headerText.toLowerCase().includes("transfer-encoding: chunked")) {
    return decodeChunkedBinaryBody(body);
  }
  
  return body;
}

function decodeChunkedBinaryBody(body: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let pos = 0;

  while (pos < body.length) {
    // Find end of chunk size line
    let lineEnd = -1;
    for (let i = pos; i < body.length - 1; i++) {
      if (body[i] === 13 && body[i+1] === 10) {
        lineEnd = i;
        break;
      }
    }
    if (lineEnd === -1) break;

    const sizeHex = new TextDecoder().decode(body.slice(pos, lineEnd)).split(";")[0].trim();
    const chunkSize = parseInt(sizeHex, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;

    const dataStart = lineEnd + 2;
    chunks.push(body.slice(dataStart, dataStart + chunkSize));
    pos = dataStart + chunkSize + 2; // skip chunk data + \r\n
  }

  const totalLength = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ========== PFX parsing (from nfse-query) ==========

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

  if (parsedCerts.length === 0) throw new Error("Certificado não encontrado no arquivo PFX");

  const leafCert = parsedCerts.find((c) => keyLocalKeyId && c.localKeyId === keyLocalKeyId) || parsedCerts[0];
  const chain = [leafCert];
  const visited = new Set([leafCert.pem]);
  let current = leafCert;
  while (true) {
    const next = parsedCerts.find((c) => !visited.has(c.pem) && c.subject === current.issuer);
    if (!next) break;
    chain.push(next);
    visited.add(next.pem);
    if (next.subject === next.issuer) break;
    current = next;
  }

  return {
    certPem: chain.map((c) => c.pem.trim()).join("\n"),
    keyPem,
  };
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
