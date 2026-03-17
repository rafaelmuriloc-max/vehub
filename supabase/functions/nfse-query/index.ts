import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADN_CONTRIBUTOR_API_BASE = "https://adn.nfse.gov.br/contribuintes";
const MAX_DFE_REQUESTS_PER_SYNC = 12;

type ParsedCertificate = {
  issuer: string;
  localKeyId: string | null;
  pem: string;
  subject: string;
};

type MtlsTextResponse = {
  bodyText: string;
  headers: Headers;
  status: number;
  statusText: string;
  strategy: string;
  url: string;
};

type AdnQueryResult = {
  documents: string[];
  maxNSU: string | null;
  rawData: unknown;
  strategy: string;
  status: number;
  ultNSU: string | null;
};

type ParsedInvoice = {
  accessKey: string | null;
  grossValue: number;
  invoiceNumber: string | null;
  issueDate: string | null;
  issuerCnpj: string | null;
  municipalityCode: string | null;
  netValue: number;
  rawData: Record<string, unknown>;
  serviceDescription: string | null;
  status: string;
  takerCnpj: string | null;
  taxValue: number;
  xml: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: "Configuração do Supabase incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const { client_id, reference_month } = await req.json();

    if (!client_id || !reference_month) {
      return jsonResponse({ error: "client_id e reference_month são obrigatórios" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("document, digital_certificate_url, digital_certificate_password, company_name")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return jsonResponse({ error: "Cliente não encontrado" }, 404);
    }

    if (!client.document) {
      return jsonResponse({ error: "Cliente não possui CNPJ cadastrado" }, 400);
    }

    if (!client.digital_certificate_url || !client.digital_certificate_password) {
      return jsonResponse({ error: "Cliente não possui certificado digital A1 configurado" }, 400);
    }

    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates")
      .download(client.digital_certificate_url);

    if (certError || !certData) {
      return jsonResponse(
        { error: `Erro ao baixar certificado digital: ${certError?.message || "arquivo não encontrado"}` },
        500,
      );
    }

    const cnpj = client.document.replace(/\D/g, "");
    const certBytes = new Uint8Array(await certData.arrayBuffer());

    let certPem: string;
    let keyPem: string;

    try {
      const parsed = await parsePfx(certBytes, client.digital_certificate_password);
      certPem = parsed.certPem;
      keyPem = parsed.keyPem;
    } catch (error) {
      return jsonResponse(
        { error: `Erro ao processar certificado digital: ${(error as Error).message}` },
        500,
      );
    }

    let invoicesData: ParsedInvoice[] = [];
    let syncMeta: Record<string, unknown> = {};

    try {
      const distribution = await fetchInvoicesFromAdn({
        certPem,
        cnpj,
        keyPem,
        referenceMonth: reference_month,
      });

      invoicesData = distribution.invoices;
      syncMeta = {
        documentsFetched: distribution.documentsFetched,
        maxNSU: distribution.maxNSU,
        transport: distribution.transport,
        ultNSU: distribution.ultNSU,
      };
    } catch (apiError) {
      console.error("ADN NFS-e connection error:", apiError);
      return jsonResponse(
        {
          error: "Erro ao consultar o ADN da NFS-e.",
          details: (apiError as Error).message,
        },
        502,
      );
    }

    // Cap at 20 invoices per sync to avoid timeout
    const MAX_SAVE_PER_SYNC = 20;
    const invoicesToSave = invoicesData.slice(0, MAX_SAVE_PER_SYNC);

    // Batch upsert: build all records first, then save in one call
    const invoiceRecords = invoicesToSave.map((invoice) => ({
      access_key: invoice.accessKey,
      client_id,
      gross_value: invoice.grossValue || 0,
      invoice_number: invoice.invoiceNumber,
      issue_date: invoice.issueDate,
      issuer_cnpj: invoice.issuerCnpj || cnpj,
      municipality_code: invoice.municipalityCode,
      net_value: invoice.netValue || 0,
      pdf_url: null,
      raw_data: invoice.rawData,
      service_description: invoice.serviceDescription,
      status: invoice.status || "normal",
      taker_cnpj: invoice.takerCnpj,
      tax_value: invoice.taxValue || 0,
      xml_url: null,
    }));

    let savedInvoices: unknown[] = [];
    if (invoiceRecords.length > 0) {
      const { data: saved, error: saveError } = await adminClient
        .from("invoices")
        .upsert(invoiceRecords, { onConflict: "access_key" })
        .select();

      if (saveError) {
        console.error("Erro ao salvar invoices em lote:", saveError);
      }
      savedInvoices = saved || [];
    }

    return jsonResponse({
      success: true,
      message: `${savedInvoices.length} nota(s) fiscal(is) encontrada(s) para ${reference_month} e salva(s).`,
      invoices: savedInvoices,
      sync_meta: syncMeta,
      total: invoicesData.length,
      truncated: invoicesData.length > MAX_SAVE_PER_SYNC,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(
      { error: "Erro interno do servidor", details: (error as Error).message },
      500,
    );
  }
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function fetchInvoicesFromAdn(params: {
  certPem: string;
  cnpj: string;
  keyPem: string;
  referenceMonth: string;
}): Promise<{
  documentsFetched: number;
  invoices: ParsedInvoice[];
  maxNSU: string | null;
  transport: string | null;
  ultNSU: string | null;
}> {
  const xmlDocuments: string[] = [];
  const seenNsu = new Set<string>();
  let currentNsu = "0";
  let maxNSU: string | null = null;
  let transport: string | null = null;
  let ultNSU: string | null = null;

  for (let index = 0; index < MAX_DFE_REQUESTS_PER_SYNC; index += 1) {
    if (seenNsu.has(currentNsu)) {
      break;
    }

    seenNsu.add(currentNsu);

    const result = await fetchAdnDfeByNsu(currentNsu, params.cnpj, params.certPem, params.keyPem);
    transport = result.strategy;
    if (result.maxNSU) maxNSU = result.maxNSU;
    if (result.ultNSU) ultNSU = result.ultNSU;

    xmlDocuments.push(...result.documents);

    console.log(
      `ADN DFe consultado com NSU ${currentNsu}: status=${result.status}, docs=${result.documents.length}, ultNSU=${result.ultNSU}, maxNSU=${result.maxNSU}, strategy=${result.strategy}`,
    );

    if (!result.ultNSU || !result.maxNSU) {
      break;
    }

    if (result.ultNSU === result.maxNSU || result.ultNSU === currentNsu) {
      break;
    }

    currentNsu = result.ultNSU;
  }

  const invoices = dedupeInvoices(parseXmlDocuments(xmlDocuments)).filter((invoice) =>
    matchesReferenceMonth(invoice.issueDate, params.referenceMonth)
  );

  return {
    documentsFetched: xmlDocuments.length,
    invoices,
    maxNSU,
    transport,
    ultNSU,
  };
}

async function fetchAdnDfeByNsu(
  nsu: string,
  cnpj: string,
  certPem: string,
  keyPem: string,
): Promise<AdnQueryResult> {
  const urls = buildAdnDfeUrls(nsu, cnpj);
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await requestTextWithMTLS(
        url,
        {
          headers: {
            Accept: "application/json, application/xml, text/xml, */*",
            "User-Agent": "Lovable-NFSe/1.0",
          },
          method: "GET",
        },
        certPem,
        keyPem,
      );

      if (response.status >= 400) {
        throw new Error(
          `HTTP ${response.status} ao consultar ${response.url}: ${response.bodyText.slice(0, 500) || response.statusText}`,
        );
      }

      const parsed = await parseAdnDistributionResponse(response.bodyText, response.headers);

      return {
        documents: parsed.documents,
        maxNSU: parsed.maxNSU,
        rawData: parsed.rawData,
        status: response.status,
        strategy: response.strategy,
        ultNSU: parsed.ultNSU,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`Falha ao consultar ADN em ${url.toString()}:`, error);
    }
  }

  throw lastError || new Error("Falha ao consultar o ADN da NFS-e");
}

function buildAdnDfeUrls(nsu: string, cnpj: string): URL[] {
  const baseUrl = `${ADN_CONTRIBUTOR_API_BASE}/DFe/${encodeURIComponent(nsu)}`;
  const urls: URL[] = [];

  if (cnpj) {
    const urlWithQuery = new URL(baseUrl);
    urlWithQuery.searchParams.set("CNPJConsulta", cnpj);
    urls.push(urlWithQuery);
  }

  urls.push(new URL(baseUrl));
  return urls;
}

async function parseAdnDistributionResponse(
  bodyText: string,
  headers: Headers,
): Promise<{ documents: string[]; maxNSU: string | null; rawData: unknown; ultNSU: string | null }> {
  const contentType = (headers.get("content-type") || "").toLowerCase();
  const trimmedBody = bodyText.trim();

  if (trimmedBody.length === 0) {
    return { documents: [], maxNSU: null, rawData: null, ultNSU: null };
  }

  if (contentType.includes("json") || /^[\[{]/.test(trimmedBody)) {
    const parsedJson = safeJsonParse(trimmedBody);
    if (!parsedJson) {
      throw new Error(`Resposta JSON inválida do ADN: ${trimmedBody.slice(0, 500)}`);
    }

    const metadata = extractNsuMetadata(parsedJson);
    const documents = await extractXmlDocumentsFromUnknown(parsedJson);

    return {
      documents,
      maxNSU: metadata.maxNSU,
      rawData: parsedJson,
      ultNSU: metadata.ultNSU,
    };
  }

  if (looksLikeXml(trimmedBody)) {
    return {
      documents: extractStandaloneXmlDocuments(trimmedBody),
      maxNSU: null,
      rawData: { xml: trimmedBody },
      ultNSU: null,
    };
  }

  throw new Error(`Resposta inesperada do ADN: ${trimmedBody.slice(0, 500)}`);
}

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

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      console.log(`Tentando conexão mTLS com estratégia ${attempt.label} para ${url.toString()}`);

      if (attempt.type === "fetch") {
        return await requestWithFetchHttp1(url, init, certPem, keyPem, attempt.label);
      }

      return await sendRawHttpRequestOverTls(url, init, certPem, keyPem, attempt.label, attempt.alpnProtocols);
    } catch (error) {
      lastError = error as Error;
      console.error(`Falha na estratégia ${attempt.label}:`, error);
    }
  }

  throw lastError || new Error("Falha ao conectar via mTLS");
}

async function requestWithFetchHttp1(
  url: URL,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
  strategy: string,
): Promise<MtlsTextResponse> {
  const httpClient = Deno.createHttpClient({
    cert: certPem,
    http1: true,
    http2: false,
    key: keyPem,
  });

  try {
    const requestInit = {
      body: init.body,
      // @ts-expect-error Deno fetch supports client in the edge runtime.
      client: httpClient,
      headers: init.headers,
      method: init.method,
    };

    const response = await fetch(url, requestInit);
    const bodyText = await response.text();

    return {
      bodyText,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
      strategy,
      url: url.toString(),
    };
  } finally {
    httpClient.close();
  }
}

async function sendRawHttpRequestOverTls(
  url: URL,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
  strategy: string,
  alpnProtocols?: string[],
): Promise<MtlsTextResponse> {
  const encoder = new TextEncoder();
  const bodyText = init.body ?? "";
  const bodyBytes = encoder.encode(bodyText);
  const conn = await Deno.connectTls({
    hostname: url.hostname,
    port: Number(url.port || 443),
    cert: certPem,
    key: keyPem,
    ...(alpnProtocols ? { alpnProtocols } : {}),
  });

  try {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Host")) headers.set("Host", url.host);
    if (!headers.has("Accept")) headers.set("Accept", "application/json, application/xml, text/xml, */*");
    if (!headers.has("Accept-Encoding")) headers.set("Accept-Encoding", "identity");
    if (!headers.has("Connection")) headers.set("Connection", "close");
    if (!headers.has("User-Agent")) headers.set("User-Agent", "Lovable-NFSe/1.0");
    if (bodyBytes.byteLength > 0 && !headers.has("Content-Length")) {
      headers.set("Content-Length", String(bodyBytes.byteLength));
    }

    const requestHead = [
      `${init.method} ${url.pathname}${url.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([name, value]) => `${name}: ${value}`),
      "",
      "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));
    if (bodyBytes.byteLength > 0) {
      await conn.write(bodyBytes);
    }

    const responseBytes = await readAllFromConnection(conn, 20000);
    const rawResponse = new TextDecoder().decode(responseBytes);
    const response = parseRawHttpResponse(rawResponse);
    const responseBody = await response.text();

    return {
      bodyText: responseBody,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
      strategy,
      url: url.toString(),
    };
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
    try {
      conn.close();
    } catch {
      // no-op
    }
  }, timeoutMs);

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

  if (didTimeout) {
    throw new Error(`Timeout ao aguardar resposta do portal NFS-e após ${timeoutMs}ms`);
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function parseRawHttpResponse(rawResponse: string): Response {
  const separatorIndex = rawResponse.indexOf("\r\n\r\n");
  if (separatorIndex === -1) {
    throw new Error("Resposta HTTP inválida do portal NFS-e");
  }

  const rawHeaders = rawResponse.slice(0, separatorIndex);
  let rawBody = rawResponse.slice(separatorIndex + 4);
  const headerLines = rawHeaders.split("\r\n");
  const statusLine = headerLines.shift() || "";
  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);

  if (!statusMatch) {
    throw new Error(`Status HTTP inválido retornado pelo portal NFS-e: ${statusLine}`);
  }

  const headers = new Headers();
  for (const line of headerLines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    headers.append(name, value);
  }

  if ((headers.get("transfer-encoding") || "").toLowerCase().includes("chunked")) {
    rawBody = decodeChunkedBody(rawBody);
  }

  return new Response(rawBody, {
    headers,
    status: Number(statusMatch[1]),
    statusText: statusMatch[2],
  });
}

function decodeChunkedBody(rawBody: string): string {
  let position = 0;
  let decoded = "";

  while (position < rawBody.length) {
    const lineEnd = rawBody.indexOf("\r\n", position);
    if (lineEnd === -1) break;

    const sizeHex = rawBody.slice(position, lineEnd).split(";", 1)[0].trim();
    const chunkSize = Number.parseInt(sizeHex, 16);
    if (Number.isNaN(chunkSize)) {
      throw new Error("Resposta chunked inválida do portal NFS-e");
    }

    position = lineEnd + 2;
    if (chunkSize === 0) break;

    decoded += rawBody.slice(position, position + chunkSize);
    position += chunkSize + 2;
  }

  return decoded;
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractNsuMetadata(value: unknown): { maxNSU: string | null; ultNSU: string | null } {
  let maxNSU: string | null = null;
  let ultNSU: string | null = null;
  const stack = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    for (const [key, child] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      if (ultNSU === null && normalizedKey === "ultnsu" && child !== null && child !== undefined) {
        ultNSU = String(child);
      }
      if (maxNSU === null && normalizedKey === "maxnsu" && child !== null && child !== undefined) {
        maxNSU = String(child);
      }

      if (child && typeof child === "object") {
        stack.push(child);
      }
    }
  }

  return { maxNSU, ultNSU };
}

async function extractXmlDocumentsFromUnknown(value: unknown): Promise<string[]> {
  const documents = new Set<string>();
  await walkUnknownForXml(value, documents, null);
  return Array.from(documents);
}

async function walkUnknownForXml(
  value: unknown,
  documents: Set<string>,
  currentKey: string | null,
): Promise<void> {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (looksLikeXml(trimmed)) {
      for (const doc of extractStandaloneXmlDocuments(trimmed)) {
        documents.add(doc);
      }
      return;
    }

    if (looksLikeBase64Payload(trimmed, currentKey)) {
      const decodedXml = await decodePossibleCompressedXml(trimmed);
      if (decodedXml) {
        for (const doc of extractStandaloneXmlDocuments(decodedXml)) {
          documents.add(doc);
        }
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      await walkUnknownForXml(item, documents, currentKey);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      await walkUnknownForXml(child, documents, key);
    }
  }
}

function looksLikeBase64Payload(value: string, key: string | null): boolean {
  if (value.length < 32 || value.length % 4 !== 0) {
    return false;
  }

  const likelyByKey = key ? /(xml|doc|dfe|conteudo|payload|arquivo|b64|gzip|zip)/i.test(key) : false;
  return likelyByKey || /^[A-Za-z0-9+/=\s]+$/.test(value);
}

async function decodePossibleCompressedXml(base64Value: string): Promise<string | null> {
  try {
    const bytes = base64ToUint8Array(base64Value);
    const gunzipped = await tryGunzip(bytes);
    if (gunzipped && looksLikeXml(gunzipped)) {
      return gunzipped;
    }

    const decodedText = new TextDecoder().decode(bytes).trim();
    return looksLikeXml(decodedText) ? decodedText : null;
  } catch {
    return null;
  }
}

function base64ToUint8Array(value: string): Uint8Array {
  const sanitized = value.replace(/\s+/g, "");
  const binary = atob(sanitized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function tryGunzip(bytes: Uint8Array): Promise<string | null> {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(buffer).trim();
  } catch {
    return null;
  }
}

function looksLikeXml(value: string): boolean {
  return /^<\?xml|^<([\w-]+:)?[\w-]+[\s>]/i.test(value);
}

function extractStandaloneXmlDocuments(xmlText: string): string[] {
  const documents = new Set<string>();
  const patterns = [
    /<(?:[\w-]+:)?NFS-e\b[\s\S]*?<\/(?:[\w-]+:)?NFS-e>/gi,
    /<(?:[\w-]+:)?NFSe\b[\s\S]*?<\/(?:[\w-]+:)?NFSe>/gi,
    /<(?:[\w-]+:)?CompNfse\b[\s\S]*?<\/(?:[\w-]+:)?CompNfse>/gi,
    /<(?:[\w-]+:)?compNFSe\b[\s\S]*?<\/(?:[\w-]+:)?compNFSe>/gi,
    /<(?:[\w-]+:)?procNfse\b[\s\S]*?<\/(?:[\w-]+:)?procNfse>/gi,
    /<(?:[\w-]+:)?nfseProc\b[\s\S]*?<\/(?:[\w-]+:)?nfseProc>/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xmlText)) !== null) {
      documents.add(match[0]);
    }
  }

  if (documents.size === 0 && looksLikeXml(xmlText)) {
    documents.add(xmlText);
  }

  return Array.from(documents);
}

function parseXmlDocuments(documents: string[]): ParsedInvoice[] {
  return documents
    .map((xml) => parseInvoiceXml(xml))
    .filter((invoice): invoice is ParsedInvoice => invoice !== null);
}

function parseInvoiceXml(xml: string): ParsedInvoice | null {
  const invoiceNumber = extractFirstXmlValue(xml, ["NumeroNfse", "nNFSe", "Numero"]);
  const accessKey = extractFirstXmlValue(xml, ["chNFSe", "ChaveAcesso", "CodigoVerificacao"]);
  const issueDate = extractFirstXmlValue(xml, ["dhEmi", "DataEmissao", "Competencia", "dCompet"]);
  const serviceDescription = extractFirstXmlValue(xml, ["xDescServ", "Discriminacao"]);
  const grossValue = parseCurrencyValue(extractFirstXmlValue(xml, ["vServ", "ValorServicos", "ValorServico"]));
  const taxValue = parseCurrencyValue(extractFirstXmlValue(xml, ["vISSQN", "ValorIss", "ValorISS"]));
  const netValue = parseCurrencyValue(extractFirstXmlValue(xml, ["vLiq", "ValorLiquidoNfse", "ValorLiquido", "vNF"]));
  const issuerCnpj = extractFirstXmlValue(xml, ["CNPJPrestador", "CnpjPrestador", "CNPJ"]);
  const takerCnpj = extractFirstXmlValue(xml, ["CNPJTomador", "CnpjTomador"]);
  const municipalityCode = extractFirstXmlValue(xml, ["cLocPrestacao", "CodigoMunicipio"]);
  const statusCode = extractFirstXmlValue(xml, ["sitNFSe", "SituacaoNfse", "cSitNfse"]);

  if (!invoiceNumber && !accessKey && !issueDate) {
    return null;
  }

  return {
    accessKey,
    grossValue,
    invoiceNumber,
    issueDate,
    issuerCnpj,
    municipalityCode,
    netValue: netValue || Math.max(grossValue - taxValue, 0),
    rawData: { xml },
    serviceDescription,
    status: normalizeInvoiceStatus(statusCode),
    takerCnpj,
    taxValue,
    xml,
  };
}

function extractFirstXmlValue(xml: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `<(?:[\\w-]+:)?${escapedTagName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escapedTagName}>`,
      "i",
    );
    const match = regex.exec(xml);
    if (match?.[1]) {
      const value = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (value) return value;
    }
  }

  return null;
}

function parseCurrencyValue(value: string | null): number {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInvoiceStatus(statusCode: string | null): string {
  if (!statusCode) return "normal";
  const normalized = statusCode.toLowerCase();
  if (["2", "cancelada", "cancelled", "canceled"].includes(normalized)) {
    return "cancelada";
  }
  return "normal";
}

function matchesReferenceMonth(issueDate: string | null, referenceMonth: string): boolean {
  if (!issueDate) return false;

  const isoMatch = issueDate.match(/(\d{4})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}` === referenceMonth;
  }

  const brMatch = issueDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}` === referenceMonth;
  }

  return false;
}

function dedupeInvoices(invoices: ParsedInvoice[]): ParsedInvoice[] {
  const seen = new Set<string>();
  const deduped: ParsedInvoice[] = [];

  for (const invoice of invoices) {
    const key = invoice.accessKey || `${invoice.invoiceNumber || "sem-numero"}-${invoice.issueDate || "sem-data"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(invoice);
  }

  return deduped;
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
  if (!keyBag?.key) {
    throw new Error("Chave privada não encontrada no certificado");
  }

  const keyPem = forge.pki.privateKeyToPem(keyBag.key);
  const keyLocalKeyId = normalizeLocalKeyId(keyBag.attributes?.localKeyId?.[0]);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const parsedCerts: ParsedCertificate[] = ((certBags[forge.pki.oids.certBag] || []) as Array<any>)
    .filter((bag) => bag?.cert)
    .map((bag) => ({
      issuer: stringifyDistinguishedName(bag.cert.issuer),
      localKeyId: normalizeLocalKeyId(bag.attributes?.localKeyId?.[0]),
      pem: forge.pki.certificateToPem(bag.cert),
      subject: stringifyDistinguishedName(bag.cert.subject),
    }));

  if (parsedCerts.length === 0) {
    throw new Error("Certificado não encontrado no arquivo PFX");
  }

  const leafCert = parsedCerts.find((cert) => keyLocalKeyId && cert.localKeyId === keyLocalKeyId) || parsedCerts[0];
  const chain = buildCertificateChain(leafCert, parsedCerts);

  console.log(`PFX carregado com ${parsedCerts.length} certificado(s); enviando cadeia com ${chain.length} item(ns).`);

  return {
    certPem: chain.map((cert) => cert.pem.trim()).join("\n"),
    keyPem,
  };
}

function normalizeLocalKeyId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return forge.util.bytesToHex(value);
  if (value instanceof Uint8Array) return Array.from(value).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (Array.isArray(value)) return value.map((byte) => Number(byte).toString(16).padStart(2, "0")).join("");
  return null;
}

function stringifyDistinguishedName(dn: { attributes?: Array<{ shortName?: string; name?: string; value?: string }> }): string {
  return (dn.attributes || [])
    .map((attr) => `${attr.shortName || attr.name || "attr"}=${attr.value || ""}`)
    .join(",");
}

function buildCertificateChain(leafCert: ParsedCertificate, allCerts: ParsedCertificate[]): ParsedCertificate[] {
  const chain = [leafCert];
  const visited = new Set([leafCert.pem]);
  let current = leafCert;

  while (true) {
    const next = allCerts.find((candidate) => !visited.has(candidate.pem) && candidate.subject === current.issuer);

    if (!next) break;

    chain.push(next);
    visited.add(next.pem);

    if (next.subject === next.issuer) break;
    current = next;
  }

  return chain;
}
