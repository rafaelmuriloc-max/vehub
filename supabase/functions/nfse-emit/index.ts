import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SEFIN endpoints for NFS-e emission
// Primary: sefin.nfse.gov.br (may not resolve from all environments)
// Fallback: try direct IP or alternative hostnames
const SEFIN_ENDPOINTS = {
  producao: [
    "https://sefin.nfse.gov.br/SefinNacional/nfse",
  ],
  homologacao: [
    "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse",
  ],
};

interface DpsData {
  // Ambiente
  ambiente: "producao" | "homologacao";
  // Prestador (auto-filled from client)
  serie?: string;
  numeroDps?: string;
  // Competência
  competencia: string; // YYYY-MM-DD
  // Tomador
  tomadorCnpjCpf: string;
  tomadorRazaoSocial: string;
  tomadorInscricaoMunicipal?: string;
  tomadorEndereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    codigoMunicipio?: string;
    uf?: string;
    cep?: string;
    codigoPais?: string;
  };
  tomadorEmail?: string;
  tomadorTelefone?: string;
  // Serviço
  codigoServico: string; // LC 116 code e.g. "01.01"
  codigoMunicipioIncidencia: string;
  descricaoServico: string;
  valorServico: number;
  // Valores opcionais
  aliquotaIss?: number;
  valorDeducoes?: number;
  issRetido?: boolean;
  // Local da prestação
  codigoMunicipioPrestacao?: string;
}

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
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const { client_id, dps_data } = await req.json() as { client_id: string; dps_data: DpsData };

    if (!client_id || !dps_data) {
      return jsonResponse({ error: "client_id e dps_data são obrigatórios" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Load client data
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("document, digital_certificate_url, digital_certificate_password, company_name, municipal_registration, address")
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

    // Download certificate
    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates")
      .download(client.digital_certificate_url);

    if (certError || !certData) {
      return jsonResponse({ error: `Erro ao baixar certificado: ${certError?.message || "não encontrado"}` }, 500);
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
      return jsonResponse({ error: `Erro ao processar certificado: ${(error as Error).message}` }, 500);
    }

    // Trim and validate required municipality code
    dps_data.codigoMunicipioIncidencia = (dps_data.codigoMunicipioIncidencia || "").trim();
    if (!dps_data.codigoMunicipioIncidencia || !/^\d{7}$/.test(dps_data.codigoMunicipioIncidencia)) {
      return jsonResponse({ error: "Código do município de incidência (IBGE) é obrigatório (7 dígitos)" }, 400);
    }

    // Build DPS XML
    const tpAmb = dps_data.ambiente === "producao" ? "1" : "2";
    const serie = dps_data.serie || "EPN";
    const nDPS = (dps_data.numeroDps || "1").padStart(15, "0");
    const dhEmi = new Date().toISOString().replace("Z", "-03:00");
    const dCompet = dps_data.competencia;
    const codigoMunicipio = dps_data.codigoMunicipioIncidencia;

    // Generate DPS ID: DPS + cMunPrest(7) + tpInsc(1|2) + CNPJ(14) + serie(5) + nDPS(15)
    const tpInsc = cnpj.length <= 11 ? "2" : "1";
    const seriePadded = serie.padEnd(5, " ").substring(0, 5);
    const idDPS = `DPS${codigoMunicipio}${tpInsc}${cnpj.padStart(14, "0")}${seriePadded}${nDPS}`;

    // Tomador CNPJ/CPF
    const tomadorDoc = dps_data.tomadorCnpjCpf.replace(/\D/g, "");
    const tomadorDocTag = tomadorDoc.length <= 11
      ? `<CPF>${tomadorDoc}</CPF>`
      : `<CNPJ>${tomadorDoc}</CNPJ>`;

    // Valor ISS
    const vServ = dps_data.valorServico.toFixed(2);
    const vDeducoes = (dps_data.valorDeducoes || 0).toFixed(2);
    const vLiq = (dps_data.valorServico - (dps_data.valorDeducoes || 0)).toFixed(2);
    const aliquota = dps_data.aliquotaIss != null ? dps_data.aliquotaIss.toFixed(4) : "";
    const issRetido = dps_data.issRetido ? "1" : "2";

    // Build tomador address XML
    let tomadorEnderecoXml = "";
    if (dps_data.tomadorEndereco) {
      const e = dps_data.tomadorEndereco;
      tomadorEnderecoXml = `<end>` +
        (e.logradouro ? `<xLgr>${escapeXml(e.logradouro)}</xLgr>` : "") +
        (e.numero ? `<nro>${escapeXml(e.numero)}</nro>` : "") +
        (e.complemento ? `<xCpl>${escapeXml(e.complemento)}</xCpl>` : "") +
        (e.bairro ? `<xBairro>${escapeXml(e.bairro)}</xBairro>` : "") +
        (e.codigoMunicipio ? `<cMun>${e.codigoMunicipio}</cMun>` : "") +
        (e.uf ? `<UF>${e.uf}</UF>` : "") +
        (e.cep ? `<CEP>${e.cep.replace(/\D/g, "")}</CEP>` : "") +
        (e.codigoPais ? `<cPais>${e.codigoPais}</cPais>` : `<cPais>1058</cPais>`) +
        `</end>`;
    }

    // Build infDPS XML (the part that gets signed)
    const infDpsXml =
      `<infDPS versao="1.00" Id="${idDPS}">` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<dhEmi>${dhEmi}</dhEmi>` +
      `<verAplic>VeloGestao-1.0</verAplic>` +
      `<serie>${escapeXml(serie)}</serie>` +
      `<nDPS>${nDPS}</nDPS>` +
      `<dCompet>${dCompet}</dCompet>` +
      `<tpEmit>1</tpEmit>` +
      `<cLocEmi>${codigoMunicipio}</cLocEmi>` +
      `<subst>2</subst>` +
      `<prest>` +
      `<CNPJ>${cnpj}</CNPJ>` +
      (client.municipal_registration ? `<IM>${escapeXml(client.municipal_registration)}</IM>` : "") +
      `</prest>` +
      `<toma>` +
      tomadorDocTag +
      `<xNome>${escapeXml(dps_data.tomadorRazaoSocial)}</xNome>` +
      (dps_data.tomadorInscricaoMunicipal ? `<IM>${escapeXml(dps_data.tomadorInscricaoMunicipal)}</IM>` : "") +
      tomadorEnderecoXml +
      (dps_data.tomadorEmail ? `<email>${escapeXml(dps_data.tomadorEmail)}</email>` : "") +
      (dps_data.tomadorTelefone ? `<fone>${dps_data.tomadorTelefone.replace(/\D/g, "")}</fone>` : "") +
      `</toma>` +
      `<serv>` +
      `<cServ>${escapeXml(dps_data.codigoServico)}</cServ>` +
      `<xDescServ>${escapeXml(dps_data.descricaoServico)}</xDescServ>` +
      (dps_data.codigoMunicipioPrestacao ? `<cLocPrestacao>${dps_data.codigoMunicipioPrestacao}</cLocPrestacao>` : `<cLocPrestacao>${codigoMunicipio}</cLocPrestacao>`) +
      `<cPaisPrestacao>1058</cPaisPrestacao>` +
      `</serv>` +
      `<valores>` +
      `<vServPrest>` +
      `<vReceb>${vServ}</vReceb>` +
      `<vServ>${vServ}</vServ>` +
      `</vServPrest>` +
      `<trib>` +
      `<totTrib>` +
      `<indTotTrib>0</indTotTrib>` +
      `</totTrib>` +
      `<ISS>` +
      `<tpRetISSQN>${issRetido}</tpRetISSQN>` +
      (aliquota ? `<pAliq>${aliquota}</pAliq>` : "") +
      `</ISS>` +
      `</trib>` +
      (dps_data.valorDeducoes ? `<vDed>${vDeducoes}</vDed>` : "") +
      `</valores>` +
      `</infDPS>`;

    // Sign the XML
    let signedDpsXml: string;
    try {
      signedDpsXml = await signXml(infDpsXml, idDPS, keyPem, certPem);
    } catch (error) {
      return jsonResponse({ error: `Erro ao assinar XML: ${(error as Error).message}` }, 500);
    }

    // Wrap in DPS envelope
    const fullDpsXml = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
      signedDpsXml +
      `</DPS>`;

    console.log(`DPS XML gerado (${fullDpsXml.length} bytes) para cliente ${client.company_name}`);

    // Gzip + Base64
    const gzipped = await gzipCompress(fullDpsXml);
    const b64 = uint8ArrayToBase64(gzipped);

    const payload = JSON.stringify({ dpsXmlGZipB64: b64 });
    const endpoints = SEFIN_ENDPOINTS[dps_data.ambiente] || SEFIN_ENDPOINTS.homologacao;

    // Try multiple SEFIN endpoints
    let sefinResponse: MtlsTextResponse | null = null;
    let lastError: Error | null = null;

    for (const sefinUrl of endpoints) {
      console.log(`Tentando enviar DPS para SEFIN (${dps_data.ambiente}): ${sefinUrl}`);
      try {
        sefinResponse = await requestTextWithMTLS(
          new URL(sefinUrl),
          {
            method: "POST",
            body: payload,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, application/xml, */*",
              "User-Agent": "VeloGestao-NFSe/1.0",
            },
          },
          certPem,
          keyPem,
        );
        console.log(`SEFIN ${sefinUrl} respondeu: status=${sefinResponse.status}`);
        break; // success
      } catch (error) {
        lastError = error as Error;
        console.error(`Falha ao conectar em ${sefinUrl}:`, (error as Error).message);
      }
    }

    if (!sefinResponse) {
      console.error("Todas as tentativas de conexão SEFIN falharam:", lastError);
      return jsonResponse({ error: `Erro de conexão com SEFIN: ${lastError?.message || "connection reset"}` }, 502);
    }

    console.log(`SEFIN response: status=${sefinResponse.status} bodyLen=${sefinResponse.bodyText.length}`);
    console.log(`SEFIN body preview: ${sefinResponse.bodyText.slice(0, 2000)}`);

    // Process response
    if (sefinResponse.status >= 400) {
      return jsonResponse({
        error: "Rejeição do SEFIN",
        status: sefinResponse.status,
        details: sefinResponse.bodyText.slice(0, 3000),
        dps_xml_preview: fullDpsXml.slice(0, 1000),
      }, 422);
    }

    // Try to parse the response for NFS-e data
    const responseData = parseEmissionResponse(sefinResponse.bodyText);

    // Save to invoices table if we got a valid response
    if (responseData.chaveAcesso || responseData.invoiceNumber) {
      const { error: saveError } = await adminClient
        .from("invoices")
        .insert({
          access_key: responseData.chaveAcesso,
          client_id,
          gross_value: dps_data.valorServico,
          invoice_number: responseData.invoiceNumber,
          issue_date: dCompet,
          issuer_cnpj: cnpj,
          municipality_code: codigoMunicipio,
          net_value: dps_data.valorServico - (dps_data.valorDeducoes || 0),
          service_description: dps_data.descricaoServico,
          status: "normal",
          taker_cnpj: tomadorDoc,
          tax_value: 0,
          raw_data: { dps_id: idDPS, sefin_response: sefinResponse.bodyText.slice(0, 5000) },
        });

      if (saveError) {
        console.error("Erro ao salvar NFS-e emitida:", saveError);
      }
    }

    return jsonResponse({
      success: true,
      message: "DPS enviada ao SEFIN com sucesso.",
      sefin_status: sefinResponse.status,
      chave_acesso: responseData.chaveAcesso,
      numero_nfse: responseData.invoiceNumber,
      protocolo: responseData.protocolo,
      response_preview: sefinResponse.bodyText.slice(0, 3000),
      dps_id: idDPS,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Erro interno", details: (error as Error).message }, 500);
  }
});

// ─── Helpers ───

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── XML Digital Signature (XMLDSig Enveloped) using WebCrypto ───

async function signXml(infDpsXml: string, referenceId: string, keyPem: string, certPem: string): Promise<string> {
  const encoder = new TextEncoder();

  // 1. SHA-256 digest of infDPS
  const digestBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(infDpsXml));
  const digestB64 = uint8ArrayToBase64(new Uint8Array(digestBuffer));

  // 2. Build SignedInfo
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<Reference URI="#${referenceId}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<DigestValue>${digestB64}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // 3. Import private key via WebCrypto
  const keyDer = pemToDer(keyPem, "PRIVATE KEY");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // 4. Sign the SignedInfo
  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signedInfo));
  const signatureB64 = uint8ArrayToBase64(new Uint8Array(signatureBuffer));

  // 5. Extract leaf certificate for KeyInfo
  const certB64 = extractFirstCertBase64(certPem);

  // 6. Build full Signature node
  const signatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureB64}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certB64}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  // 7. Append Signature (enveloped)
  return infDpsXml + signatureXml;
}

function pemToDer(pem: string, label: string): ArrayBuffer {
  // Handle both "RSA PRIVATE KEY" (PKCS#1) and "PRIVATE KEY" (PKCS#8)
  const lines = pem.split("\n").filter((l) => !l.startsWith("-----") && l.trim().length > 0);
  const b64 = lines.join("");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // If it's PKCS#1 (RSA PRIVATE KEY), wrap it in PKCS#8 envelope
  if (pem.includes("RSA PRIVATE KEY")) {
    return wrapPkcs1InPkcs8(bytes).buffer;
  }
  return bytes.buffer;
}

function wrapPkcs1InPkcs8(pkcs1Bytes: Uint8Array): Uint8Array {
  // ASN.1 DER encoding: wrap PKCS#1 key in PKCS#8 PrivateKeyInfo structure
  const rsaOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  const octetString = encodeAsn1(0x04, pkcs1Bytes);
  const version = new Uint8Array([0x02, 0x01, 0x00]); // version 0
  const algorithmId = encodeAsn1(0x30, rsaOid);
  const inner = concatBytes(version, algorithmId, octetString);
  return encodeAsn1(0x30, inner);
}

function encodeAsn1(tag: number, content: Uint8Array): Uint8Array {
  const len = content.length;
  let header: Uint8Array;
  if (len < 128) {
    header = new Uint8Array([tag, len]);
  } else if (len < 256) {
    header = new Uint8Array([tag, 0x81, len]);
  } else if (len < 65536) {
    header = new Uint8Array([tag, 0x82, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = new Uint8Array([tag, 0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  }
  return concatBytes(header, content);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

function extractFirstCertBase64(certPem: string): string {
  const match = certPem.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/);
  return match ? match[1].replace(/\s/g, "") : "";
}

// ─── Gzip Compression ───

async function gzipCompress(text: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const input = encoder.encode(text);
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ─── Parse Emission Response ───

function parseEmissionResponse(body: string): { chaveAcesso: string | null; invoiceNumber: string | null; protocolo: string | null } {
  const chaveAcesso = extractXmlValue(body, ["chNFSe", "ChaveAcesso", "chaveAcesso"]);
  const invoiceNumber = extractXmlValue(body, ["nNFSe", "NumeroNfse", "Numero"]);
  const protocolo = extractXmlValue(body, ["nProt", "protocolo", "Protocolo", "idLote"]);

  // Also try JSON
  if (!chaveAcesso && !invoiceNumber) {
    try {
      const json = JSON.parse(body);
      return {
        chaveAcesso: json.chNFSe || json.chaveAcesso || json.accessKey || null,
        invoiceNumber: json.nNFSe || json.numero || json.invoiceNumber || null,
        protocolo: json.nProt || json.protocolo || null,
      };
    } catch {
      // not JSON
    }
  }

  return { chaveAcesso, invoiceNumber, protocolo };
}

function extractXmlValue(xml: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const regex = new RegExp(`<(?:[\\w-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`, "i");
    const match = regex.exec(xml);
    if (match?.[1]) {
      return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

// ─── mTLS Transport (reused from nfse-query) ───

type MtlsTextResponse = {
  bodyText: string;
  headers: Headers;
  status: number;
  statusText: string;
  strategy: string;
  url: string;
};

// Resolve hostname via DNS-over-HTTPS (Google) as fallback when system DNS fails
async function resolveHostname(hostname: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`);
    const data = await resp.json();
    if (data.Answer && data.Answer.length > 0) {
      const ip = data.Answer.find((a: { type: number; data: string }) => a.type === 1)?.data;
      console.log(`DNS-over-HTTPS resolved ${hostname} -> ${ip}`);
      return ip || null;
    }
  } catch (e) {
    console.error(`DNS-over-HTTPS failed for ${hostname}:`, (e as Error).message);
  }
  return null;
}

async function requestTextWithMTLS(
  url: URL,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
): Promise<MtlsTextResponse> {
  const attempts = [
    { label: "fetch-http1", type: "fetch" as const },
    { label: "raw-http1", type: "raw" as const },
  ];

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  // First try with original hostname
  for (const attempt of attempts) {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          const delay = Math.pow(2, retry) * 1000;
          console.log(`Retry ${retry}/${MAX_RETRIES} para ${attempt.label} após ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }

        if (attempt.type === "fetch") {
          const httpClient = Deno.createHttpClient({
            cert: certPem,
            http1: true,
            http2: false,
            key: keyPem,
          });

          try {
            const response = await fetch(url, {
              body: init.body,
              // @ts-expect-error Deno fetch supports client
              client: httpClient,
              headers: init.headers,
              method: init.method,
            });
            const bodyText = await response.text();
            return {
              bodyText,
              headers: response.headers,
              status: response.status,
              statusText: response.statusText,
              strategy: attempt.label,
              url: url.toString(),
            };
          } finally {
            httpClient.close();
          }
        }

        // Raw HTTP/1.1
        return await sendRawHttpRequest(url, init, certPem, keyPem, attempt.label);
      } catch (error) {
        lastError = error as Error;
        const msg = (error as Error).message || "";
        console.error(`Falha ${attempt.label} (tentativa ${retry + 1}):`, msg);

        // DNS failure - don't retry, try IP-based approach instead
        if (msg.includes("lookup") || msg.includes("not known") || msg.includes("NXDOMAIN")) {
          break;
        }
        if (!msg.includes("reset") && !msg.includes("refused") && !msg.includes("timeout")) {
          break;
        }
      }
    }
  }

  // If connection failed (DNS or connection reset), try resolving via DoH and connecting by IP
  if (lastError) {
    const errMsg = lastError.message || "";
    const isDns = errMsg.includes("lookup") || errMsg.includes("not known") || errMsg.includes("NXDOMAIN");
    const isReset = errMsg.includes("reset") || errMsg.includes("refused") || errMsg.includes("peer");
    
    if (isDns || isReset) {
      console.log(`Tentando resolver hostname via DNS-over-HTTPS (motivo: ${isDns ? "DNS" : "connection reset"})...`);
      const ip = await resolveHostname(url.hostname);
      if (ip) {
        const originalHost = url.hostname;
        const ipUrl = new URL(url.toString());
        ipUrl.hostname = ip;

        // Try raw connection with TCP→startTls (proper SNI)
        for (let retry = 0; retry < 3; retry++) {
          try {
            if (retry > 0) {
              const delay = Math.pow(2, retry) * 1000;
              await new Promise((r) => setTimeout(r, delay));
              console.log(`Retry DoH ${retry}/3...`);
            }
            return await sendRawHttpRequestWithSNI(ipUrl, originalHost, init, certPem, keyPem, "doh-raw");
          } catch (error) {
            lastError = error as Error;
            console.error(`Falha DoH raw (tentativa ${retry + 1}):`, (error as Error).message);
          }
        }
      }
    }
  }

  throw lastError || new Error("Falha ao conectar via mTLS");
}

async function sendRawHttpRequest(
  url: URL,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
  strategy: string,
): Promise<MtlsTextResponse> {
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(init.body ?? "");
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
    if (!headers.has("Connection")) headers.set("Connection", "close");
    if (bodyBytes.byteLength > 0 && !headers.has("Content-Length")) {
      headers.set("Content-Length", String(bodyBytes.byteLength));
    }

    const requestHead = [
      `${init.method} ${url.pathname}${url.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([n, v]) => `${n}: ${v}`),
      "",
      "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));
    if (bodyBytes.byteLength > 0) {
      await conn.write(bodyBytes);
    }

    const responseBytes = await readAll(conn, 30000);
    const rawResponse = new TextDecoder().decode(responseBytes);
    const sepIdx = rawResponse.indexOf("\r\n\r\n");
    if (sepIdx === -1) throw new Error("Resposta HTTP inválida");

    const headerSection = rawResponse.slice(0, sepIdx);
    const bodySection = rawResponse.slice(sepIdx + 4);
    const lines = headerSection.split("\r\n");
    const statusLine = lines.shift() || "";
    const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);
    if (!statusMatch) throw new Error("Status HTTP inválido");

    const respHeaders = new Headers();
    for (const line of lines) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      respHeaders.append(line.slice(0, sep).trim(), line.slice(sep + 1).trim());
    }

    return {
      bodyText: bodySection,
      headers: respHeaders,
      status: Number(statusMatch[1]),
      statusText: statusMatch[2],
      strategy,
      url: url.toString(),
    };
  } finally {
    conn.close();
  }
}

// Connects via plain TCP to IP, then upgrades to TLS with SNI set to original hostname
// This ensures certificate validation uses the real hostname, not the IP
async function sendRawHttpRequestWithSNI(
  ipUrl: URL,
  originalHost: string,
  init: { body?: string; headers?: HeadersInit; method: string },
  certPem: string,
  keyPem: string,
  strategy: string,
): Promise<MtlsTextResponse> {
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(init.body ?? "");
  const port = Number(ipUrl.port || 443);
  
  console.log(`Connecting TCP to ${ipUrl.hostname}:${port}, then startTls with SNI=${originalHost}`);
  
  // Step 1: Plain TCP connection to IP
  const tcpConn = await Deno.connect({
    hostname: ipUrl.hostname,
    port,
  });

  // Step 2: Upgrade to TLS with original hostname for SNI + client cert
  const conn = await Deno.startTls(tcpConn, {
    hostname: originalHost, // SNI = real hostname, cert validation passes
    cert: certPem,
    key: keyPem,
    alpnProtocols: ["http/1.1"],
  });

  try {
    const headers = new Headers(init.headers || {});
    headers.set("Host", originalHost);
    if (!headers.has("Connection")) headers.set("Connection", "close");
    if (bodyBytes.byteLength > 0 && !headers.has("Content-Length")) {
      headers.set("Content-Length", String(bodyBytes.byteLength));
    }

    const requestHead = [
      `${init.method} ${ipUrl.pathname}${ipUrl.search} HTTP/1.1`,
      ...Array.from(headers.entries()).map(([n, v]) => `${n}: ${v}`),
      "",
      "",
    ].join("\r\n");

    await conn.write(encoder.encode(requestHead));
    if (bodyBytes.byteLength > 0) {
      await conn.write(bodyBytes);
    }

    const responseBytes = await readAll(conn, 30000);
    const rawResponse = new TextDecoder().decode(responseBytes);
    const sepIdx = rawResponse.indexOf("\r\n\r\n");
    if (sepIdx === -1) throw new Error("Resposta HTTP inválida");

    const headerSection = rawResponse.slice(0, sepIdx);
    const bodySection = rawResponse.slice(sepIdx + 4);
    const lines = headerSection.split("\r\n");
    const statusLine = lines.shift() || "";
    const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/i);
    if (!statusMatch) throw new Error("Status HTTP inválido");

    const respHeaders = new Headers();
    for (const line of lines) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      respHeaders.append(line.slice(0, sep).trim(), line.slice(sep + 1).trim());
    }

    return {
      bodyText: bodySection,
      headers: respHeaders,
      status: Number(statusMatch[1]),
      statusText: statusMatch[2],
      strategy,
      url: `https://${originalHost}${ipUrl.pathname}${ipUrl.search}`,
    };
  } finally {
    conn.close();
  }
}

async function readAll(conn: Deno.Conn, timeoutMs: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  let didTimeout = false;

  const timeout = setTimeout(() => {
    didTimeout = true;
    try { conn.close(); } catch { /* */ }
  }, timeoutMs);

  try {
    while (true) {
      const buffer = new Uint8Array(16_384);
      const n = await conn.read(buffer);
      if (n === null) break;
      chunks.push(buffer.slice(0, n));
      totalLength += n;
    }
  } finally {
    clearTimeout(timeout);
  }

  if (didTimeout) throw new Error("Timeout na resposta do SEFIN");

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

// ─── PFX Parsing (reused from nfse-query) ───

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
  const chain = buildChain(leafCert, parsedCerts);

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

function buildChain(leaf: ParsedCertificate, all: ParsedCertificate[]): ParsedCertificate[] {
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
