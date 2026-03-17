import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFSE_API_BASE = "https://sefin.nfse.gov.br/sefinnacional";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, reference_month } = await req.json();

    if (!client_id || !reference_month) {
      return new Response(
        JSON.stringify({ error: "client_id e reference_month são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch client data (CNPJ, certificate info)
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("document, digital_certificate_url, digital_certificate_password, company_name")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client.document) {
      return new Response(
        JSON.stringify({ error: "Cliente não possui CNPJ cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client.digital_certificate_url || !client.digital_certificate_password) {
      return new Response(
        JSON.stringify({ error: "Cliente não possui certificado digital A1 configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Download certificate from storage
    const certPath = client.digital_certificate_url;
    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates")
      .download(certPath);

    if (certError || !certData) {
      return new Response(
        JSON.stringify({ error: "Erro ao baixar certificado digital: " + (certError?.message || "arquivo não encontrado") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cnpj = client.document.replace(/\D/g, "");
    const certBytes = new Uint8Array(await certData.arrayBuffer());
    const certPassword = client.digital_certificate_password;

    // 3. Parse PFX to extract cert and private key using pkcs12
    let certPem: string;
    let keyPem: string;

    try {
      const result = await parsePfx(certBytes, certPassword);
      certPem = result.certPem;
      keyPem = result.keyPem;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Erro ao processar certificado digital: " + (e as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Query NFS-e API - Distribution endpoint (DFe)
    // The API uses SOAP/REST with mTLS authentication
    const [year, month] = reference_month.split("-").map(Number);
    const competencia = `${year}-${String(month).padStart(2, "0")}`;

    let invoicesData: any[] = [];

    try {
      // Build the DFe distribution request
      const requestBody = buildDistributionRequest(cnpj, competencia);

      // Make mTLS request to NFS-e API
      const response = await fetchWithMTLS(
        `${NFSE_API_BASE}/nfse/distribuicaonfse`,
        requestBody,
        certPem,
        keyPem
      );

      if (response.ok) {
        const responseText = await response.text();
        invoicesData = parseNfseResponse(responseText);
      } else {
        const errorText = await response.text();
        console.error("NFS-e API error:", response.status, errorText);
        
        // If API returns error, still return a meaningful response
        return new Response(
          JSON.stringify({
            error: `Erro na consulta ao portal NFS-e (HTTP ${response.status}). Verifique se o certificado é válido e se o município está integrado ao padrão nacional.`,
            details: errorText.substring(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (apiError) {
      console.error("NFS-e API connection error:", apiError);
      return new Response(
        JSON.stringify({
          error: "Erro ao conectar com o portal NFS-e. Verifique o certificado digital e tente novamente.",
          details: (apiError as Error).message,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Save invoices to database and XML to storage
    const savedInvoices = [];
    for (const invoice of invoicesData) {
      // Save XML to storage
      let xmlUrl = null;
      if (invoice.xml) {
        const xmlPath = `nfse/${cnpj}/${competencia}/${invoice.accessKey || invoice.invoiceNumber || crypto.randomUUID()}.xml`;
        const { error: uploadError } = await adminClient.storage
          .from("documents")
          .upload(xmlPath, new TextEncoder().encode(invoice.xml), {
            contentType: "application/xml",
            upsert: true,
          });
        if (!uploadError) {
          xmlUrl = xmlPath;
        }
      }

      // Upsert invoice record
      const invoiceRecord = {
        client_id,
        access_key: invoice.accessKey || null,
        invoice_number: invoice.invoiceNumber || null,
        issue_date: invoice.issueDate || null,
        service_description: invoice.serviceDescription || null,
        gross_value: invoice.grossValue || 0,
        tax_value: invoice.taxValue || 0,
        net_value: invoice.netValue || 0,
        status: invoice.status || "normal",
        xml_url: xmlUrl,
        issuer_cnpj: invoice.issuerCnpj || cnpj,
        taker_cnpj: invoice.takerCnpj || null,
        municipality_code: invoice.municipalityCode || null,
        raw_data: invoice.rawData || null,
      };

      if (invoice.accessKey) {
        // Upsert by access_key
        const { data: saved, error: saveError } = await adminClient
          .from("invoices")
          .upsert(invoiceRecord, { onConflict: "access_key" })
          .select()
          .single();

        if (!saveError && saved) {
          savedInvoices.push(saved);
        }
      } else {
        const { data: saved, error: saveError } = await adminClient
          .from("invoices")
          .insert(invoiceRecord)
          .select()
          .single();

        if (!saveError && saved) {
          savedInvoices.push(saved);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${savedInvoices.length} nota(s) fiscal(is) encontrada(s) e salva(s).`,
        invoices: savedInvoices,
        total: invoicesData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- Helper functions ----

type ParsedCertificate = {
  issuer: string;
  localKeyId: string | null;
  pem: string;
  subject: string;
};

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
    const next = allCerts.find((candidate) => (
      !visited.has(candidate.pem) &&
      candidate.subject === current.issuer
    ));

    if (!next) break;

    chain.push(next);
    visited.add(next.pem);

    if (next.subject === next.issuer) break;
    current = next;
  }

  return chain;
}

function buildDistributionRequest(cnpj: string, competencia: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.sefaz.gov.br/nfse" versao="1.00">
  <tpAmb>1</tpAmb>
  <CNPJ>${cnpj}</CNPJ>
  <distNSU>
    <ultNSU>0</ultNSU>
  </distNSU>
  <perRef>${competencia}</perRef>
</distDFeInt>`;
}

async function fetchWithMTLS(
  url: string,
  body: string,
  certPem: string,
  keyPem: string
): Promise<Response> {
  const requestUrl = new URL(url);
  const attempts: Array<{ alpnProtocols?: string[]; label: string }> = [
    { label: "http1-alpn", alpnProtocols: ["http/1.1"] },
    { label: "no-alpn" },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      console.log(`Tentando conexão mTLS NFS-e com estratégia: ${attempt.label}`);
      return await sendRawHttp1RequestOverTls(requestUrl, body, certPem, keyPem, attempt.alpnProtocols);
    } catch (error) {
      lastError = error as Error;
      console.error(`Falha na estratégia ${attempt.label}:`, error);
    }
  }

  throw lastError || new Error("Falha ao conectar com o portal NFS-e via mTLS");
}

async function sendRawHttp1RequestOverTls(
  url: URL,
  body: string,
  certPem: string,
  keyPem: string,
  alpnProtocols?: string[],
): Promise<Response> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bodyBytes = encoder.encode(body);
  const conn = await Deno.connectTls({
    hostname: url.hostname,
    port: Number(url.port || 443),
    cert: certPem,
    key: keyPem,
    ...(alpnProtocols ? { alpnProtocols } : {}),
  });

  try {
    const requestPath = `${url.pathname}${url.search}`;
    const requestHead = [
      `POST ${requestPath} HTTP/1.1`,
      `Host: ${url.host}`,
      "Content-Type: application/xml; charset=utf-8",
      "Accept: application/xml, text/xml, */*",
      "Accept-Encoding: identity",
      `Content-Length: ${bodyBytes.byteLength}`,
      "Connection: close",
      "User-Agent: Lovable-NFSe/1.0",
      "",
      "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));
    await conn.write(bodyBytes);

    const responseBytes = await readAllFromConnection(conn, 20000);
    const rawResponse = decoder.decode(responseBytes);
    return parseRawHttpResponse(rawResponse);
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

function parseNfseResponse(xmlText: string): any[] {
  const invoices: any[] = [];

  // Simple XML parsing for NFS-e response
  // Extract individual NFS-e documents from the distribution response
  const nfsePattern = /<NFS-e[^>]*>([\s\S]*?)<\/NFS-e>/gi;
  let match;

  while ((match = nfsePattern.exec(xmlText)) !== null) {
    const nfseXml = match[0];
    
    const invoice: any = {
      xml: nfseXml,
      rawData: { xml: nfseXml },
    };

    // Extract fields using regex
    invoice.invoiceNumber = extractXmlValue(nfseXml, "Numero") || extractXmlValue(nfseXml, "NumeroNfse");
    invoice.accessKey = extractXmlValue(nfseXml, "ChaveAcesso") || extractXmlValue(nfseXml, "CodigoVerificacao");
    invoice.issueDate = extractXmlValue(nfseXml, "DataEmissao") || extractXmlValue(nfseXml, "Competencia");
    invoice.serviceDescription = extractXmlValue(nfseXml, "Discriminacao");
    invoice.grossValue = parseFloat(extractXmlValue(nfseXml, "ValorServicos") || "0");
    invoice.taxValue = parseFloat(extractXmlValue(nfseXml, "ValorIss") || "0");
    invoice.netValue = parseFloat(extractXmlValue(nfseXml, "ValorLiquidoNfse") || "0") || (invoice.grossValue - invoice.taxValue);
    invoice.issuerCnpj = extractXmlValue(nfseXml, "Cnpj");
    invoice.takerCnpj = extractXmlValue(nfseXml, "CpfCnpj>.*?<Cnpj") || null;
    invoice.municipalityCode = extractXmlValue(nfseXml, "CodigoMunicipio");
    invoice.status = extractXmlValue(nfseXml, "SituacaoNfse") === "2" ? "cancelada" : "normal";

    invoices.push(invoice);
  }

  // If no NFS-e pattern found, try alternative patterns
  if (invoices.length === 0) {
    const docPattern = /<docZip[^>]*>([\s\S]*?)<\/docZip>/gi;
    while ((match = docPattern.exec(xmlText)) !== null) {
      try {
        // docZip contains base64 encoded gzipped XML
        const base64Content = match[1].trim();
        invoices.push({
          xml: xmlText,
          rawData: { compressed: base64Content },
          invoiceNumber: null,
          accessKey: null,
          status: "normal",
        });
      } catch (_e) {
        // Skip malformed entries
      }
    }
  }

  return invoices;
}

function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}
