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

/** Escape for XML attribute values per C14N spec (does NOT escape '>') */
function xmlAttrEscape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function generateSerproProcuradorXML(params: {
  contratanteCnpj: string;
  contratanteNome: string;
  autorPedidoCnpj: string;
  autorPedidoNome: string;
}): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dataAssinatura = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const vigencia = `${now.getFullYear()}1231`;

  // Textos EXATOS conforme documentação oficial SERPRO — incluindo acentos e caracteres especiais
  const termoTexto = `Autorizo a empresa CONTRATANTE, identificada neste termo de autorização como DESTINATÁRIO, a executar as requisições dos serviços web disponibilizados pela API INTEGRA CONTADOR, onde terei o papel de AUTOR PEDIDO DE DADOS no corpo da mensagem enviada na requisição do serviço web. Esse termo de autorização está assinado digitalmente com o certificado digital do PROCURADOR ou OUTORGADO DO CONTRIBUINTE responsável, identificado como AUTOR DO PEDIDO DE DADOS.`;
  const avisoTexto = `O acesso a estas informações foi autorizado pelo próprio PROCURADOR ou OUTORGADO DO CONTRIBUINTE, responsável pela informação, via assinatura digital. É dever do destinatário da autorização e consumidor deste acesso observar a adoção de base legal para o tratamento dos dados recebidos conforme artigos 7º ou 11º da LGPD (Lei n.º 13.709, de 14 de agosto de 2018), aos direitos do titular dos dados (art. 9º, 17 e 18, da LGPD) e aos princípios que norteiam todos os tratamentos de dados no Brasil (art. 6º, da LGPD).`;
  const finalidadeTexto = `A finalidade única e exclusiva desse TERMO DE AUTORIZAÇÃO, é garantir que o CONTRATANTE apresente a API INTEGRA CONTADOR esse consentimento do PROCURADOR ou OUTORGADO DO CONTRIBUINTE assinado digitalmente, para que possa realizar as requisições dos serviços web da API INTEGRA CONTADOR em nome do AUTOR PEDIDO DE DADOS (PROCURADOR ou OUTORGADO DO CONTRIBUINTE).`;

  const nomeContratante = xmlAttrEscape(params.contratanteNome);
  const nomeAutor = xmlAttrEscape(params.autorPedidoNome);

  // Use self-closing tags to match SERPRO reference format exactly
  return `<termoDeAutorizacao><dados>` +
    `<sistema id="API Integra Contador" />` +
    `<termo texto="${xmlAttrEscape(termoTexto)}" />` +
    `<avisoLegal texto="${xmlAttrEscape(avisoTexto)}" />` +
    `<finalidade texto="${xmlAttrEscape(finalidadeTexto)}" />` +
    `<dataAssinatura data="${dataAssinatura}" />` +
    `<vigencia data="${vigencia}" />` +
    `<destinatario numero="${params.contratanteCnpj}" nome="${nomeContratante}" tipo="PJ" papel="contratante" />` +
    `<assinadoPor numero="${params.autorPedidoCnpj}" nome="${nomeAutor}" tipo="PJ" papel="autor pedido de dados" />` +
    `</dados></termoDeAutorizacao>`;
}

function toBase64(xml: string): string {
  const bytes = new TextEncoder().encode(xml);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Minimal C14N for our use case: expands self-closing tags to explicit open+close.
 * Our XML has no namespaces (except in Signature), no comments, no PIs, no CDATA.
 * Per W3C Canonical XML 1.0: empty elements are represented as start-end tag pairs.
 */
function canonicalize(xml: string): string {
  // Expand self-closing tags: <foo attr="val" /> → <foo attr="val"></foo>
  return xml.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z:_][a-zA-Z0-9:._-]*\s*=\s*"[^"]*")*)\s*\/>/g,
    '<$1$2></$1>');
}

async function signXmlWithCertificate(
  xml: string,
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate,
): Promise<string> {
  // ===== STEP 1: Enveloped-signature transform =====
  // The XML doesn't have <Signature> yet, so this is naturally satisfied.

  // ===== STEP 2: C14N of the document for digest =====
  // Expand self-closing tags to canonical form, then hash
  const canonicalDoc = canonicalize(xml);
  const docBytes = new TextEncoder().encode(canonicalDoc);
  const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", docBytes));
  const digestValue = btoa(String.fromCharCode(...digestBytes));

  console.log(`[sign] Document length: raw=${xml.length}, canonical=${canonicalDoc.length}`);
  console.log(`[sign] DigestValue: ${digestValue}`);
  console.log(`[sign] Canonical doc (first 300): ${canonicalDoc.substring(0, 300)}`);

  // ===== STEP 3: Build SignedInfo in canonical form =====
  // This EXACT string (with xmlns, explicit close tags) is what we sign.
  // Per C14N, when extracted from <Signature xmlns="...">, SignedInfo inherits the namespace.
  const signedInfoCanonical =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI="">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  console.log(`[sign] SignedInfo canonical (${signedInfoCanonical.length} chars)`);

  // ===== STEP 4: Import private key and sign =====
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

  const signedInfoBytes = new TextEncoder().encode(signedInfoCanonical);
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signedInfoBytes));
  const signatureValue = btoa(String.fromCharCode(...signatureBytes));

  console.log(`[sign] SignatureValue length: ${signatureValue.length}`);

  // ===== STEP 5: Certificate as base64 DER =====
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate));
  const certBase64 = forge.util.encode64(certDer.getBytes());

  // Log cert identity for debugging
  const certSubject = certificate.subject.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', ');
  console.log(`[sign] Signing certificate: ${certSubject}`);

  // ===== STEP 6: Build final Signature element =====
  // SignedInfo inside <Signature> inherits xmlns, so we remove the explicit xmlns
  const signedInfoForXml = signedInfoCanonical.replace(` xmlns="http://www.w3.org/2000/09/xmldsig#"`, "");
  const signatureElement =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfoForXml +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  // Insert before closing root tag
  const signedXml = xml.replace("</termoDeAutorizacao>", signatureElement + "</termoDeAutorizacao>");

  // ===== STEP 7: Local verification =====
  try {
    await verifySignatureLocally(signedXml, canonicalDoc, signedInfoCanonical, digestValue, signatureValue, certificate);
    console.log(`[sign] ✅ Local signature verification PASSED`);
  } catch (verifyErr) {
    console.error(`[sign] ❌ Local signature verification FAILED:`, (verifyErr as Error).message);
    throw new Error(`Assinatura XML inválida localmente: ${(verifyErr as Error).message}. Abortando envio ao SERPRO.`);
  }

  return signedXml;
}

/**
 * Verify the XMLDSig signature locally before sending to SERPRO.
 * This prevents wasting API credits on invalid signatures.
 */
async function verifySignatureLocally(
  signedXml: string,
  originalCanonicalDoc: string,
  signedInfoCanonical: string,
  expectedDigest: string,
  signatureValueB64: string,
  certificate: forge.pki.Certificate,
): Promise<void> {
  // 1. Re-extract the document without <Signature>...</Signature>
  const withoutSig = signedXml.replace(/<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">[\s\S]*?<\/Signature>/, "");
  const canonicalWithoutSig = canonicalize(withoutSig);

  // 2. Verify digest
  const docBytes = new TextEncoder().encode(canonicalWithoutSig);
  const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", docBytes));
  const recomputedDigest = btoa(String.fromCharCode(...digestBytes));

  if (recomputedDigest !== expectedDigest) {
    throw new Error(`DigestValue mismatch: expected=${expectedDigest}, recomputed=${recomputedDigest}`);
  }

  // 3. Verify signature using certificate's public key
  const pubKeyAsn1 = forge.pki.publicKeyToAsn1(certificate.publicKey);
  const pubKeyDer = forge.asn1.toDer(pubKeyAsn1).getBytes();
  const pubKeyBytes = new Uint8Array(pubKeyDer.length);
  for (let i = 0; i < pubKeyDer.length; i++) {
    pubKeyBytes[i] = pubKeyDer.charCodeAt(i);
  }

  const verifyKey = await crypto.subtle.importKey(
    "spki",
    pubKeyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = Uint8Array.from(atob(signatureValueB64), c => c.charCodeAt(0));
  const signedInfoBytes = new TextEncoder().encode(signedInfoCanonical);

  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", verifyKey, sigBytes, signedInfoBytes);
  if (!valid) {
    throw new Error("SignatureValue verification failed: RSA-SHA256 signature does not match SignedInfo");
  }
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
  const xml = generateSerproProcuradorXML({
    contratanteCnpj,
    contratanteNome,
    autorPedidoCnpj: clientCnpj,
    autorPedidoNome: clientNome,
  });
  console.log(`[procurador] XML gerado (${xml.length} chars): ${xml.substring(0, 500)}`);

  // 2. Sign XML with CLIENT's certificate (not office certificate)
  const signedXml = await signXmlWithCertificate(xml, clientPrivateKey, clientCertObj);
  console.log(`[procurador] XML assinado (${signedXml.length} chars)`);

  // 3. Convert to base64 and verify round-trip integrity
  const xmlBase64 = toBase64(signedXml);
  const roundTrip = new TextDecoder().decode(Uint8Array.from(atob(xmlBase64), c => c.charCodeAt(0)));
  if (roundTrip !== signedXml) {
    throw new Error("XML base64 round-trip mismatch — o XML assinado foi corrompido na conversão base64");
  }
  console.log(`[procurador] ✅ Base64 round-trip OK (${xmlBase64.length} chars)`);

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

  // 5. Call /Apoiar using the OFFICE's mTLS certificate for transport
  // In production, jwt_token MUST be the real JWT from OAuth2 authentication
  const apiUrl = new URL(`${SERPRO_API_BASE}/Apoiar`);
  const apiHeaders: Record<string, string> = {
    "Authorization": `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "jwt_token": jwtToken || "",
    "autenticar_procurador_token": "",
  };

  console.log(`[procurador] Chamando ${apiUrl.toString()} (jwt_token: ${jwtToken ? jwtToken.substring(0, 30) + '...' : 'VAZIO'})...`);
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
  console.log(`[procurador] Resposta body (truncado): ${response.bodyText.substring(0, 1000)}`);

  // Log response headers that might contain the token
  const relevantHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk.includes("token") || lk.includes("autenticar") || lk.includes("procurador") || lk.includes("authorization")) {
      relevantHeaders[key] = value.substring(0, 200);
    }
  });
  if (Object.keys(relevantHeaders).length > 0) {
    console.log(`[procurador] Headers relevantes: ${JSON.stringify(relevantHeaders)}`);
  }

  if (response.status < 200 || response.status >= 300) {
    console.error(`[procurador] SERPRO rejeitou o termo. Status: ${response.status}, Body: ${response.bodyText.substring(0, 1500)}`);
    return { error: true, status: response.status, body: response.bodyText } as any;
  }

  // 6. Extract the autenticar_procurador_token from the response — try multiple formats
  try {
    const data = JSON.parse(response.bodyText);

    // Try top-level fields
    if (data.autenticar_procurador_token) {
      console.log(`[procurador] Token obtido de data.autenticar_procurador_token`);
      return data.autenticar_procurador_token;
    }
    if (data.token) {
      console.log(`[procurador] Token obtido de data.token`);
      return data.token;
    }

    // Try inside dados (string JSON or object)
    if (data.dados != null) {
      let dadosParsed = data.dados;
      if (typeof dadosParsed === "string") {
        try { dadosParsed = JSON.parse(dadosParsed); } catch { /* keep as string */ }
      }
      if (typeof dadosParsed === "object" && dadosParsed !== null) {
        const tk = dadosParsed.autenticar_procurador_token || dadosParsed.token;
        if (tk) {
          console.log(`[procurador] Token obtido de data.dados`);
          return tk;
        }
      }
      // dados as plain string might be the token itself
      if (typeof dadosParsed === "string" && dadosParsed.length > 20) {
        console.log(`[procurador] Usando data.dados como token (string ${dadosParsed.length} chars)`);
        return dadosParsed;
      }
    }

    // Try response headers (case-insensitive search)
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === "autenticar_procurador_token") {
        console.log(`[procurador] Token obtido do header ${key}`);
        return value;
      }
    }

    console.error(`[procurador] Token NÃO encontrado. Campos disponíveis: ${Object.keys(data).join(", ")}. Dados: ${response.bodyText.substring(0, 1500)}`);
    return { error: true, status: response.status, body: response.bodyText, reason: "token_not_found" } as any;
  } catch {
    console.error(`[procurador] Erro ao parsear resposta JSON: ${response.bodyText.substring(0, 500)}`);
    return { error: true, status: response.status, body: response.bodyText, reason: "parse_error" } as any;
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

    // Reusable auth function with retry support
    async function authenticateSerpro(): Promise<{ bearerToken: string; jwtToken: string | undefined }> {
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
        throw new Error(`Falha na autenticação SERPRO (status ${authResponse.status}): ${authResponse.bodyText.substring(0, 500)}`);
      }

      let authData: { access_token?: string; jwt_token?: string };
      try {
        authData = JSON.parse(authResponse.bodyText);
      } catch {
        throw new Error(`Resposta de autenticação inválida: ${authResponse.bodyText.substring(0, 300)}`);
      }

      if (!authData.access_token) {
        throw new Error("Token de acesso não retornado pelo SERPRO");
      }

      console.log(`[auth] access_token obtido (${authData.access_token.length} chars), jwt_token: ${authData.jwt_token ? authData.jwt_token.substring(0, 30) + '...' : 'ausente'}`);
      return { bearerToken: authData.access_token, jwtToken: authData.jwt_token };
    }

    // Initial authentication
    let { bearerToken, jwtToken } = await authenticateSerpro();

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

      // Try obtainProcuradorToken, retry once on 401 (token expired)
      let procuradorResult = await obtainProcuradorToken(
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

      // Retry on 401 (token expired) — re-authenticate and try again
      if (typeof procuradorResult === "object" && procuradorResult !== null && (procuradorResult as any).error && (procuradorResult as any).status === 401) {
        console.log(`[integra-contador] Token expirado (401), re-autenticando...`);
        const newAuth = await authenticateSerpro();
        bearerToken = newAuth.bearerToken;
        jwtToken = newAuth.jwtToken;

        procuradorResult = await obtainProcuradorToken(
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
      }

      // Check if result is an error object or a valid token string
      if (typeof procuradorResult === "object" && procuradorResult !== null && (procuradorResult as any).error) {
        const errInfo = procuradorResult as any;
        console.error(`[integra-contador] Falha obrigatória na etapa de procurador. Abortando.`);

        let serproDetails: unknown;
        try { serproDetails = JSON.parse(errInfo.body); } catch { serproDetails = errInfo.body; }

        return jsonResponse({
          success: false,
          stage: "autentica_procurador",
          error: "Não foi possível obter autorização de procurador junto ao SERPRO. A consulta não pode prosseguir.",
          reason: errInfo.reason || "serpro_rejected",
          serpro_status: errInfo.status,
          serpro_response: serproDetails,
          client_name: client.company_name,
          service: { idSistema, idServico, tipo },
        });
      }

      if (typeof procuradorResult === "string" && procuradorResult.length > 0) {
        procuradorToken = procuradorResult;
        console.log(`[integra-contador] Token de procurador obtido com sucesso (${procuradorToken.length} chars)`);
      } else {
        console.error(`[integra-contador] Resultado inesperado do obtainProcuradorToken: ${JSON.stringify(procuradorResult)}`);
        return jsonResponse({
          success: false,
          stage: "autentica_procurador",
          error: "Token de procurador não retornado pelo SERPRO. A consulta não pode prosseguir sem autorização.",
          client_name: client.company_name,
          service: { idSistema, idServico, tipo },
        });
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

    // Call SERPRO API (with retry on 401)
    async function callSerproApi(bt: string, jt: string | undefined): Promise<MtlsTextResponse> {
      const apiUrl = new URL(`${SERPRO_API_BASE}/${tipo}`);
      console.log(`Chamando SERPRO API: ${apiUrl.toString()}`);

      const apiHeaders: Record<string, string> = {
        "Authorization": `Bearer ${bt}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (jt) {
        apiHeaders["jwt_token"] = jt;
      }

      if (procuradorToken) {
        apiHeaders["autenticar_procurador_token"] = procuradorToken;
        console.log(`[integra-contador] Header autenticar_procurador_token incluído na requisição`);
      }

      return requestWithFetchHttp1(
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
    }

    let apiResponse = await callSerproApi(bearerToken, jwtToken);
    console.log(`API response status: ${apiResponse.status}`);

    // Retry on 401 (token expired)
    if (apiResponse.status === 401) {
      console.log(`[integra-contador] API retornou 401, re-autenticando...`);
      const newAuth = await authenticateSerpro();
      bearerToken = newAuth.bearerToken;
      jwtToken = newAuth.jwtToken;
      apiResponse = await callSerproApi(bearerToken, jwtToken);
      console.log(`API response status (retry): ${apiResponse.status}`);
    }

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
