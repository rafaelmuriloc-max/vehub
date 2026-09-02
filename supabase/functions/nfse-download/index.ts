import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

  // O manual oficial do ADN define GET /danfse/{chaveAcesso} como a rota
  // canônica. O SEFIN permanece apenas como compatibilidade para notas antigas.
  const candidateUrls = [
    new URL(`https://adn.nfse.gov.br/danfse/${accessKey}`),
    new URL(`https://sefin.nfse.gov.br/sefinnacional/danfse/${accessKey}`),
  ];

  let pdfBytes: Uint8Array | null = null;
  let lastErr: Error | null = null;
  const MAX_ATTEMPTS = 3;

  outer:
  for (const pdfUrl of candidateUrls) {
    console.log(`Fetching PDF from: ${pdfUrl.toString()}`);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        pdfBytes = await requestBinaryWithMTLS(pdfUrl, {
          method: "GET",
          headers: { "Accept": "application/pdf" },
        }, certPem, keyPem);
        if (pdfBytes && pdfBytes.length > 0) break outer;
        lastErr = new Error("PDF vazio");
      } catch (err) {
        lastErr = err as Error;
        console.error(`[PDF] ${pdfUrl.host} tentativa ${attempt} falhou: ${lastErr.message}`);
      }

      const msg = lastErr?.message ?? "";
      // Erros definitivos: não adianta repetir na mesma URL
      if (/status 403|status 404|status 401/i.test(msg)) break;

      if (attempt < MAX_ATTEMPTS) {
        const isRate = /429|Rate limit/i.test(msg);
        const delay = isRate ? 8000 : Math.min(2000 * Math.pow(2, attempt - 1), 12000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  if (!pdfBytes || pdfBytes.length === 0) {
    const detail = lastErr?.message ?? null;
    const d = detail ?? "";
    const forbidden = /status 403|status 401/i.test(d);
    const notFound = /status 404/i.test(d);
    const tlsGlitch = /cannot decrypt peer's message|close_notify|UnexpectedEof|connection error/i.test(d);

    // O XML distribuído pelo próprio ADN é a fonte fiscal oficial. Quando a
    // API de apresentação do DANFSe está temporariamente fora do ar, entregar
    // um espelho identificado evita bloquear o usuário sem fingir que o arquivo
    // foi emitido pelo Portal Nacional.
    const officialXml = getInvoiceXml(invoice.raw_data);
    if (!forbidden && !notFound && officialXml) {
      try {
        pdfBytes = await createNfseMirrorPdf(officialXml, accessKey);
        console.warn(`[PDF] Portal indisponível; gerando espelho local para ${accessKey}`);
      } catch (fallbackError) {
        console.error(`[PDF] Falha ao gerar espelho local: ${(fallbackError as Error).message}`);
      }
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      let error: string;
    let status = 503;
      if (forbidden) {
        error = "Acesso negado pelo Portal Nacional NFS-e (403). Verifique se o certificado digital do cliente tem autorização para baixar esta nota.";
        status = 403;
      } else if (notFound) {
        error = "DANFSE não encontrado no Portal Nacional para esta chave de acesso (404).";
        status = 404;
      } else if (tlsGlitch) {
        error = "Falha de conexão TLS com o Portal Nacional NFS-e (instabilidade do portal). Tente novamente em alguns minutos.";
      } else {
        error = "Portal Nacional NFS-e indisponível no momento (503). Tente novamente em alguns instantes.";
      }

      return jsonResponse({ error, detail }, status);
    }
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
  const isMirror = Boolean(lastErr);
  return jsonResponse({
    signed_url: data?.signedUrl || null,
    cached: false,
    fallback: isMirror,
    warning: isMirror
      ? "Portal Nacional indisponível. Foi gerado um PDF-espelho com os dados do XML oficial da NFS-e."
      : null,
  });
}

function getInvoiceXml(rawData: unknown): string | null {
  if (!rawData || typeof rawData !== "object") return null;
  const xml = (rawData as Record<string, unknown>).xml;
  return typeof xml === "string" && xml.trim().startsWith("<") ? xml : null;
}

function xmlValue(xml: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = xml.match(new RegExp(`<(?:\\w+:)?${escaped}(?:\\s[^>]*)?>([^<]*)<\\/(?:\\w+:)?${escaped}>`, "i"));
    if (match?.[1]) return decodeXmlText(match[1].trim());
  }
  return "";
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function formatMoney(value: string): string {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number)
    : "—";
}

function wrapPdfText(text: string, maxChars = 92): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

async function createNfseMirrorPdf(xml: string, accessKey: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]);
  let y = 798;
  const left = 42;

  const draw = (text: string, size = 10, isBold = false, color = rgb(0.12, 0.15, 0.2)) => {
    if (y < 55) {
      page = doc.addPage([595.28, 841.89]);
      y = 798;
    }
    page.drawText(text.replace(/[^\x20-\xFF]/g, " "), { x: left, y, size, font: isBold ? bold : regular, color });
    y -= size + 6;
  };
  const field = (label: string, value: string) => {
    draw(label.toUpperCase(), 7, true, rgb(0.42, 0.45, 0.5));
    for (const line of wrapPdfText(value || "—")) draw(line, 10);
    y -= 5;
  };

  draw("ESPELHO DA NFS-e", 18, true, rgb(0.91, 0.44, 0.04));
  draw("Gerado a partir do XML oficial distribuído pelo Ambiente de Dados Nacional", 9);
  draw("O DANFSe oficial do Portal Nacional estava temporariamente indisponível.", 8, false, rgb(0.55, 0.2, 0.08));
  y -= 10;
  field("Chave de acesso", accessKey);
  field("Número da NFS-e", xmlValue(xml, ["nNFSe", "numero", "Numero"]));
  field("Data de emissão", xmlValue(xml, ["dhEmi", "dEmi", "DataEmissao"]));
  field("Emitente", xmlValue(xml, ["xNome", "RazaoSocial", "NomeRazaoSocial"]));
  field("CNPJ do emitente", xmlValue(xml, ["CNPJ", "Cnpj"]));
  field("Tomador", xmlValue(xml, ["xNomeTomador", "RazaoSocialTomador", "NomeTomador"]));
  field("Serviço", xmlValue(xml, ["xDescServ", "Discriminacao", "discriminacao"]));
  field("Valor dos serviços", formatMoney(xmlValue(xml, ["vServ", "ValorServicos", "vLiq"])));
  field("Valor líquido", formatMoney(xmlValue(xml, ["vLiq", "ValorLiquidoNfse", "ValorLiquido"])));
  field("Código de verificação", xmlValue(xml, ["cVerif", "CodigoVerificacao"]));

  page.drawLine({ start: { x: left, y: 38 }, end: { x: 553, y: 38 }, thickness: 0.5, color: rgb(0.7, 0.72, 0.75) });
  page.drawText("Documento auxiliar de contingência — consulte a autenticidade pela chave de acesso.", {
    x: left, y: 24, size: 7, font: regular, color: rgb(0.42, 0.45, 0.5),
  });
  return await doc.save();
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
