import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERPRO_AUTH_URL = "https://autenticacao.sapi.serpro.gov.br/authenticate";
const SERPRO_API_BASE = "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1";

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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============= Termo de Autorização (Autentica Procurador) =============

function generateSerproProcuradorXML(params: {
  contratanteCnpj: string;
  autorPedidoCnpj: string;
  contribuinteCnpj: string;
}): string {
  const now = new Date();
  // ISO 8601 with Brazil timezone (-03:00)
  const pad = (n: number) => String(n).padStart(2, "0");
  const dataHora = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}-03:00`;
  const termoId = `TERMO_${Date.now()}`;

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<TermoAutorizacao Id="${termoId}">` +
    `<Contratante>${params.contratanteCnpj}</Contratante>` +
    `<AutorPedido>${params.autorPedidoCnpj}</AutorPedido>` +
    `<Contribuinte>${params.contribuinteCnpj}</Contribuinte>` +
    `<DataHora>${dataHora}</DataHora>` +
    `</TermoAutorizacao>`;
}

function toBase64(xml: string): string {
  const bytes = new TextEncoder().encode(xml);
  return btoa(String.fromCharCode(...bytes));
}

async function signXmlWithCertificate(
  xml: string,
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate,
): Promise<string> {
  // Extract the Id from the root element for Reference URI
  const idMatch = xml.match(/Id="([^"]+)"/);
  const referenceUri = idMatch ? `#${idMatch[1]}` : "";

  // For digest: remove XML declaration, compute on the content that will be canonicalized
  // The enveloped-signature transform removes the Signature element, then C14N is applied
  // Since there's no Signature yet, the digest is over the XML content without the declaration
  const xmlWithoutDecl = xml.replace(/<\?xml[^?]*\?>/, "");
  const xmlBytes = new TextEncoder().encode(xmlWithoutDecl);
  const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", xmlBytes));
  const digestValue = btoa(String.fromCharCode(...digestBytes));

  console.log(`[sign] Reference URI: ${referenceUri}, Digest: ${digestValue}`);

  // Build SignedInfo — ALL tags must have explicit closing (no self-closing) for C14N compatibility
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI="${referenceUri}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // Convert forge private key to PKCS#8 DER for Web Crypto
  const rsaPrivateKeyAsn1 = forge.pki.privateKeyToAsn1(privateKey);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKeyAsn1);
  const pkcs8Der = forge.asn1.toDer(privateKeyInfo).getBytes();
  const keyBytes = new Uint8Array(pkcs8Der.length);
  for (let i = 0; i < pkcs8Der.length; i++) {
    keyBytes[i] = pkcs8Der.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedInfoBytes = new TextEncoder().encode(signedInfo);
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signedInfoBytes));
  const signatureValue = btoa(String.fromCharCode(...signatureBytes));

  // Get certificate as base64 DER
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate));
  const certBase64 = forge.util.encode64(certDer.getBytes());

  // Build the Signature element
  const signatureElement =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo.replace(` xmlns="http://www.w3.org/2000/09/xmldsig#"`, "") +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certBase64}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  // Insert Signature before closing tag of root element
  return xml.replace("</TermoAutorizacao>", signatureElement + "</TermoAutorizacao>");
}

async function obtainProcuradorToken(
  contratanteCnpj: string,
  contratanteNome: string,
  clientCnpj: string,
  clientNome: string,
  clientCertPem: string,
  clientKeyPem: string,
  clientCertObj: forge.pki.Certificate,
  clientPrivateKey: forge.pki.PrivateKey,
  officeCertPem: string,
  officeKeyPem: string,
  bearerToken: string,
  jwtToken: string | undefined,
): Promise<string | null> {
  console.log(`[procurador] Gerando Termo de Autorização: contratante=${contratanteCnpj}, autor=${clientCnpj}`);

  // 1. Generate XML
  const xml = generateAuthorizationXml(contratanteCnpj, contratanteNome, clientCnpj, clientNome);

  // 2. Sign XML with client's certificate
  const signedXml = await signXmlWithCertificate(xml, clientPrivateKey, clientCertObj);
  console.log(`[procurador] XML assinado (${signedXml.length} chars)`);

  // 3. Convert to base64
  const xmlBytes = new TextEncoder().encode(signedXml);
  const xmlBase64 = btoa(String.fromCharCode(...xmlBytes));

  // 4. Build request body for AUTENTICAPROCURADOR
  const requestBody = {
    contratante: { numero: contratanteCnpj, tipo: 2 },
    autorPedidoDados: { numero: clientCnpj, tipo: 2 },
    contribuinte: { numero: clientCnpj, tipo: 2 },
    pedidoDados: {
      idSistema: "AUTENTICAPROCURADOR",
      idServico: "ENVIOXMLASSINADO81",
      versaoSistema: "1.0",
      dados: JSON.stringify({ xml: xmlBase64 }),
    },
  };

  // 5. Call /Apoiar using the office's mTLS certificate
  const apiUrl = new URL(`${SERPRO_API_BASE}/Apoiar`);
  const apiHeaders: Record<string, string> = {
    "Authorization": `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (jwtToken) {
    apiHeaders["jwt_token"] = jwtToken;
  }

  console.log(`[procurador] Chamando ${apiUrl.toString()}...`);
  const response = await requestWithFetchHttp1(
    apiUrl,
    {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(requestBody),
    },
    officeCertPem,
    officeKeyPem,
    "procurador-apoiar",
  );

  console.log(`[procurador] Resposta status: ${response.status}`);
  console.log(`[procurador] Resposta body: ${response.bodyText.substring(0, 500)}`);

  if (response.status < 200 || response.status >= 300) {
    console.error(`[procurador] Erro ao obter token de procurador: ${response.bodyText}`);
    return null;
  }

  // 6. Extract the autenticar_procurador_token from the response
  try {
    const data = JSON.parse(response.bodyText);
    // The token may come in the response body or in the dados field
    if (data.dados) {
      try {
        const dadosParsed = typeof data.dados === "string" ? JSON.parse(data.dados) : data.dados;
        if (dadosParsed.token || dadosParsed.autenticar_procurador_token) {
          const token = dadosParsed.token || dadosParsed.autenticar_procurador_token;
          console.log(`[procurador] Token obtido com sucesso (${token.length} chars)`);
          return token;
        }
      } catch {
        // dados might not be JSON
      }
    }
    // Try response headers
    const headerToken = response.headers.get("autenticar_procurador_token");
    if (headerToken) {
      console.log(`[procurador] Token obtido do header (${headerToken.length} chars)`);
      return headerToken;
    }

    console.log(`[procurador] Token não encontrado na resposta. Dados completos: ${response.bodyText.substring(0, 1000)}`);
    // Return the full response body text as a fallback — the API might return the token directly
    return null;
  } catch {
    console.error(`[procurador] Erro ao parsear resposta: ${response.bodyText}`);
    return null;
  }
}

// ============= Main handler =============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const body = await req.json();
    const { client_id, idSistema, idServico, tipo, dados, versaoSistema } = body;

    if (!client_id || !idSistema || !idServico || !tipo) {
      return jsonResponse({ error: "Campos obrigatórios: client_id, idSistema, idServico, tipo" }, 400);
    }

    // Load client (including certificate fields for procurador flow)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("document, company_name, digital_certificate_url, digital_certificate_password")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return jsonResponse({ error: "Cliente não encontrado" }, 404);
    }

    if (!client.document) {
      return jsonResponse({ error: "Cliente sem CNPJ cadastrado" }, 400);
    }

    // Load contratante (company_settings) with certificate
    const { data: company } = await supabase
      .from("company_settings")
      .select("cnpj, serpro_cnpj, company_name, digital_certificate_url, digital_certificate_password, accountant_certificate_url, accountant_certificate_password, accountant_cpf")
      .limit(1)
      .single();

    const contratanteCnpj = company?.serpro_cnpj?.replace(/\D/g, "") || company?.cnpj?.replace(/\D/g, "") || client.document.replace(/\D/g, "");
    const contratanteNome = company?.company_name || "Escritório Contábil";

    // --- autorPedidoDados = CNPJ/CPF do cliente (contribuinte) para acionar procuração ---
    const clientCnpjClean = client.document.replace(/\D/g, "");
    const autorPedidoCpfCnpj = clientCnpjClean;
    const autorPedidoTipo = clientCnpjClean.length <= 11 ? 1 : 2;

    // --- mTLS always uses the office's e-CNPJ certificate ---
    const certUrl = company?.digital_certificate_url;
    const certPassword = company?.digital_certificate_password;

    if (!certUrl || !certPassword) {
      return jsonResponse({ success: false, error: "Certificado digital do escritório (e-CNPJ) não configurado. Configure em Configurações > Meu Escritório." });
    }

    console.log(`[integra-contador] mTLS: e-CNPJ do escritório | autorPedidoDados (escritório): ${autorPedidoCpfCnpj} (tipo ${autorPedidoTipo}) | contratante: ${contratanteCnpj}`);

    // Download office certificate for mTLS
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: certFile, error: certError } = await serviceClient.storage
      .from("certificates")
      .download(certUrl);

    if (certError || !certFile) {
      return jsonResponse({ error: `Erro ao baixar certificado do escritório: ${certError?.message}` }, 500);
    }

    const pfxBytes = new Uint8Array(await certFile.arrayBuffer());
    const { certPem, keyPem } = await parsePfx(pfxBytes, certPassword);

    // Get SERPRO credentials
    const consumerKey = Deno.env.get("SERPRO_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");

    if (!consumerKey || !consumerSecret) {
      return jsonResponse({ error: "Credenciais SERPRO não configuradas" }, 500);
    }

    // OAuth2 authenticate via mTLS + Role-Type: TERCEIROS
    console.log("Autenticando no SERPRO via OAuth2 (mTLS + Role-Type: TERCEIROS)...");
    const authCredentials = btoa(`${consumerKey}:${consumerSecret}`);

    const authResponse = await requestWithFetchHttp1(
      new URL(SERPRO_AUTH_URL),
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authCredentials}`,
          "Role-Type": "TERCEIROS",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
      certPem,
      keyPem,
      "office-auth"
    );

    console.log(`Auth response status: ${authResponse.status}`);

    if (authResponse.status < 200 || authResponse.status >= 300) {
      console.error("Auth error body:", authResponse.bodyText);
      return jsonResponse({
        error: "Falha na autenticação SERPRO",
        details: authResponse.bodyText,
        status: authResponse.status,
      }, 401);
    }

    let authData: { access_token?: string; jwt_token?: string };
    try {
      authData = JSON.parse(authResponse.bodyText);
    } catch {
      return jsonResponse({ error: "Resposta de autenticação inválida", details: authResponse.bodyText }, 500);
    }

    const bearerToken = authData.access_token;
    const jwtToken = authData.jwt_token;

    if (!bearerToken) {
      return jsonResponse({ error: "Token de acesso não retornado pelo SERPRO" }, 500);
    }

    // ============= Autentica Procurador Flow =============
    // When autorPedidoDados (client) differs from contratante (office), we need the procurador token
    let procuradorToken: string | null = null;

    if (autorPedidoCpfCnpj !== contratanteCnpj) {
      console.log(`[integra-contador] autorPedidoDados (${autorPedidoCpfCnpj}) != contratante (${contratanteCnpj}) — iniciando fluxo de procurador`);

      // Check if client has a certificate
      if (!client.digital_certificate_url || !client.digital_certificate_password) {
        return jsonResponse({
          success: false,
          error: "Certificado digital do cliente não encontrado. Para consultar dados de terceiros via Integra Contador, o cliente precisa ter um certificado digital (A1) cadastrado.",
          hint: "Faça o upload do certificado digital do cliente na tela de Clientes > editar > aba Fiscal.",
        });
      }

      // Download client's certificate
      const { data: clientCertFile, error: clientCertError } = await serviceClient.storage
        .from("certificates")
        .download(client.digital_certificate_url);

      if (clientCertError || !clientCertFile) {
        return jsonResponse({ error: `Erro ao baixar certificado do cliente: ${clientCertError?.message}` }, 500);
      }

      const clientPfxBytes = new Uint8Array(await clientCertFile.arrayBuffer());
      const { certPem: clientCertPem, keyPem: clientKeyPem } = await parsePfx(clientPfxBytes, client.digital_certificate_password);

      // Parse client's PFX to get the certificate object and private key for signing
      const { certificate: clientCertObj, privateKey: clientPrivateKey } = parsePfxForSigning(clientPfxBytes, client.digital_certificate_password);

      procuradorToken = await obtainProcuradorToken(
        contratanteCnpj,
        contratanteNome,
        autorPedidoCpfCnpj,
        client.company_name || "Cliente",
        clientCertPem,
        clientKeyPem,
        clientCertObj,
        clientPrivateKey,
        certPem,
        keyPem,
        bearerToken,
        jwtToken,
      );

      if (!procuradorToken) {
        console.warn("[integra-contador] Não foi possível obter o token de procurador. Tentando a requisição sem ele...");
      } else {
        console.log(`[integra-contador] Token de procurador obtido com sucesso`);
      }
    }

    // Build request body for Integra Contador
    const requestBody = {
      contratante: { numero: contratanteCnpj, tipo: 2 },
      autorPedidoDados: { numero: autorPedidoCpfCnpj, tipo: autorPedidoTipo },
      contribuinte: { numero: clientCnpjClean, tipo: clientCnpjClean.length <= 11 ? 1 : 2 },
      pedidoDados: {
        idSistema,
        idServico,
        versaoSistema: versaoSistema || "1.0",
        dados: typeof dados === "string" ? dados : JSON.stringify(dados || {}),
      },
    };

    // Call SERPRO API
    const apiUrl = new URL(`${SERPRO_API_BASE}/${tipo}`);
    console.log(`Chamando SERPRO API: ${apiUrl.toString()}`);

    const apiHeaders: Record<string, string> = {
      "Authorization": `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (jwtToken) {
      apiHeaders["jwt_token"] = jwtToken;
    }

    if (procuradorToken) {
      apiHeaders["autenticar_procurador_token"] = procuradorToken;
      console.log(`[integra-contador] Header autenticar_procurador_token incluído na requisição`);
    }

    const apiResponse = await requestWithFetchHttp1(
      apiUrl,
      {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify(requestBody),
      },
      certPem,
      keyPem,
      "serpro-api"
    );

    console.log(`API response status: ${apiResponse.status}`);

    let responseData: unknown;
    try {
      responseData = JSON.parse(apiResponse.bodyText);
    } catch {
      responseData = apiResponse.bodyText;
    }

    return jsonResponse({
      success: apiResponse.status >= 200 && apiResponse.status < 300,
      status: apiResponse.status,
      data: responseData,
      client_name: client.company_name,
      service: { idSistema, idServico, tipo },
    });
  } catch (error) {
    console.error("Erro na integração SERPRO:", error);
    return jsonResponse({ error: (error as Error).message || "Erro interno" }, 500);
  }
});

// ============= mTLS & Certificate utilities =============

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

  return {
    certPem: chain.map((cert) => cert.pem.trim()).join("\n"),
    keyPem,
  };
}

function parsePfxForSigning(
  pfxBytes: Uint8Array,
  password: string,
): { certificate: forge.pki.Certificate; privateKey: forge.pki.PrivateKey } {
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
    throw new Error("Chave privada não encontrada no certificado do cliente");
  }

  const keyLocalKeyId = normalizeLocalKeyId(keyBag.attributes?.localKeyId?.[0]);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const allBags = (certBags[forge.pki.oids.certBag] || []) as Array<any>;

  const leafBag = allBags.find(
    (bag) => bag?.cert && keyLocalKeyId && normalizeLocalKeyId(bag.attributes?.localKeyId?.[0]) === keyLocalKeyId,
  ) || allBags.find((bag) => bag?.cert);

  if (!leafBag?.cert) {
    throw new Error("Certificado leaf não encontrado no PFX do cliente");
  }

  return {
    certificate: leafBag.cert,
    privateKey: keyBag.key,
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
