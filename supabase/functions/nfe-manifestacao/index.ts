// Manifestação do Destinatário (Ciência da Operação - tpEvento 210210)
// AN endpoint: NFeRecepcaoEvento4
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AN_URL = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
const AN_WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4";
const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
// SEFAZ AN espera a operação "nfeRecepcaoEventoNF" para eventos da NF-e modelo 55
const SOAP_ACTION = `${AN_WSDL_NS}/nfeRecepcaoEventoNF`;
const SOAP_CONTENT_TYPE = `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`;
const NFE_PROXY_URL = Deno.env.get("NFE_PROXY_URL") || "";
const NFE_PROXY_TOKEN = Deno.env.get("NFE_PROXY_TOKEN") || "";

const DEFAULT_TP_EVENTO = "210210";
const MAX_LOTE = 20;
const DESC_EVENTO_MAP: Record<string, string> = {
  "210200": "Confirmacao da Operacao",
  "210210": "Ciencia da Operacao",
  "210220": "Desconhecimento da Operacao",
  "210240": "Operacao nao Realizada",
};

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
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const tpEvento: string = body.tpEvento || DEFAULT_TP_EVENTO;
    if (!DESC_EVENTO_MAP[tpEvento]) return jsonResponse({ error: "tpEvento inválido" }, 400);

    const ids: string[] = Array.isArray(body.nfe_invoice_ids)
      ? body.nfe_invoice_ids.filter((x: unknown) => typeof x === "string")
      : body.nfe_invoice_id
      ? [body.nfe_invoice_id]
      : [];
    if (ids.length === 0) return jsonResponse({ error: "nfe_invoice_ids é obrigatório" }, 400);
    if (ids.length > MAX_LOTE) {
      return jsonResponse({ error: `Máximo de ${MAX_LOTE} notas por lote` }, 400);
    }

    const { data: invoices, error: invError } = await adminClient
      .from("nfe_invoices")
      .select("id, access_key, client_id, status")
      .in("id", ids);
    if (invError) return jsonResponse({ error: invError.message }, 500);
    if (!invoices || invoices.length === 0) return jsonResponse({ error: "NF-e não encontrada" }, 404);

    const valid = invoices.filter((i) => !!i.access_key);
    if (valid.length === 0) return jsonResponse({ error: "NF-e sem chave de acesso" }, 400);

    const clientId: string = body.client_id || valid[0].client_id;
    const mismatch = valid.find((i) => i.client_id !== clientId);
    if (mismatch) return jsonResponse({ error: "Todas as notas do lote devem ser do mesmo cliente" }, 400);

    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, document, digital_certificate_url, digital_certificate_password")
      .eq("id", clientId).single();
    if (clientError || !client) return jsonResponse({ error: "Cliente não encontrado" }, 404);
    if (!client.digital_certificate_url || !client.digital_certificate_password) {
      return jsonResponse({
        error: "Certificado A1 da empresa não cadastrado.",
        reason: "client_cert_missing",
      }, 400);
    }

    const { data: certData, error: certError } = await adminClient.storage
      .from("certificates").download(client.digital_certificate_url);
    if (certError || !certData) return jsonResponse({ error: "Erro ao baixar certificado" }, 500);

    const pfxBytes = new Uint8Array(await certData.arrayBuffer());
    const parsed = parsePfx(pfxBytes, client.digital_certificate_password || "");

    const cnpj = (client.document || "").replace(/\D/g, "");
    const dhEvento = isoNowSP();

    const eventosXml = valid
      .map((inv) => signEvento(inv.access_key as string, cnpj, tpEvento, dhEvento, parsed))
      .join("");

    const envEvento =
      `<envEvento xmlns="${NFE_NS}" versao="1.00">` +
      `<idLote>${Date.now().toString().slice(-15)}</idLote>` +
      eventosXml +
      `</envEvento>`;

    const soapBody =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap:Body>` +
      `<nfeDadosMsg xmlns="${AN_WSDL_NS}">${envEvento}</nfeDadosMsg>` +
      `</soap:Body>` +
      `</soap:Envelope>`;

    console.log(`[nfe-manifestacao] lote=${valid.length} CNPJ=${cnpj} tpEvento=${tpEvento}`);

    const response = await requestTextWithMTLS(new URL(AN_URL), {
      method: "POST",
      headers: {
        "Content-Type": SOAP_CONTENT_TYPE,
        Accept: "application/soap+xml, text/xml, application/xml, */*",
      },
      body: soapBody,
    }, parsed.certPem, parsed.keyPem);

    console.log(`[nfe-manifestacao] status=${response.status} bodyLen=${response.bodyText.length}`);
    console.log(`[nfe-manifestacao] body=${response.bodyText.slice(0, 1500)}`);

    const retEnvBlock = extractTagContent(response.bodyText, "retEnvEvento") || response.bodyText;
    const retEventoBlocks = extractAllTags(retEnvBlock, "retEvento");
    // cStat of the batch is the first cStat outside the retEvento blocks
    let loteXml = retEnvBlock;
    for (const b of retEventoBlocks) loteXml = loteXml.replace(b, "");
    const cStatLote = extractTagContent(loteXml, "cStat");
    const xMotivoLote = extractTagContent(loteXml, "xMotivo");
    const faultString = extractTagContent(response.bodyText, "faultstring");

    const results: Array<{ access_key: string; cStat: string | null; id: string; ok: boolean; xMotivo: string | null }> = [];

    const loteFailed = response.status >= 400 ||
      retEventoBlocks.length === 0 ||
      (cStatLote !== null && cStatLote !== "128");

    if (loteFailed) {
      const msg = cStatLote
        ? `${cStatLote} - ${xMotivoLote || ""}`.trim()
        : `HTTP ${response.status}: ${faultString || response.bodyText.slice(0, 300)}`;
      for (const inv of valid) {
        await markError(adminClient, inv.id as string, msg);
        results.push({
          access_key: inv.access_key as string,
          cStat: cStatLote,
          id: inv.id as string,
          ok: false,
          xMotivo: xMotivoLote || faultString,
        });
      }
      return jsonResponse({
        enviadas: 0,
        erros: results.length,
        error: msg,
        results,
        success: false,
      }, 400);
    }

    for (const inv of valid) {
      const chave = inv.access_key as string;
      const block = retEventoBlocks.find((b) => (extractTagContent(b, "chNFe") || "") === chave);
      if (!block) {
        const msg = "Sem retorno do AN para esta chave";
        await markError(adminClient, inv.id as string, msg);
        results.push({ access_key: chave, cStat: null, id: inv.id as string, ok: false, xMotivo: msg });
        continue;
      }
      const cStat = extractTagContent(block, "cStat");
      const xMotivo = extractTagContent(block, "xMotivo");
      const ok = ["135", "136", "573"].includes(cStat || "");
      if (ok) {
        const update: Record<string, unknown> = {
          manifest_error: null,
          manifest_status: "enviada",
          manifested_at: new Date().toISOString(),
        };
        if (inv.status !== "xml_baixado") update.status = "aguardando_ciencia";
        await adminClient.from("nfe_invoices").update(update).eq("id", inv.id);
      } else {
        await markError(adminClient, inv.id as string, `${cStat || "?"} - ${xMotivo || ""}`.trim());
      }
      results.push({ access_key: chave, cStat, id: inv.id as string, ok, xMotivo });
    }

    const enviadas = results.filter((r) => r.ok).length;
    return jsonResponse({
      enviadas,
      erros: results.length - enviadas,
      results,
      success: true,
    });
  } catch (error) {
    console.error("[nfe-manifestacao] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

async function markError(adminClient: any, id: string, message: string): Promise<void> {
  const { data: current } = await adminClient
    .from("nfe_invoices").select("manifest_attempts").eq("id", id).single();
  await adminClient.from("nfe_invoices").update({
    manifest_attempts: (current?.manifest_attempts || 0) + 1,
    manifest_error: message.slice(0, 500),
    manifest_status: "erro",
  }).eq("id", id);
}

function signEvento(
  chave: string,
  cnpj: string,
  tpEvento: string,
  dhEvento: string,
  parsed: { certPem: string; privateKey: any },
): string {
  const cOrgao = "91";
  const tpAmb = "1";
  const nSeqEvento = "1";
  const verEvento = "1.00";
  const descEvento = DESC_EVENTO_MAP[tpEvento];
  const idEvento = `ID${tpEvento}${chave}${nSeqEvento.padStart(2, "0")}`;

  const detEvento =
    `<detEvento versao="${verEvento}">` +
    `<descEvento>${descEvento}</descEvento>` +
    `</detEvento>`;

  const infEventoCanon =
    `<infEvento Id="${idEvento}">` +
    `<cOrgao>${cOrgao}</cOrgao>` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${chave}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento>` +
    `<tpEvento>${tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
    `<verEvento>${verEvento}</verEvento>` +
    detEvento +
    `</infEvento>`;

  const infEventoCanonForDigest = infEventoCanon.replace(
    `<infEvento Id="${idEvento}">`,
    `<infEvento xmlns="${NFE_NS}" Id="${idEvento}">`,
  );

  const digest = sha1Base64(infEventoCanonForDigest);

  const signedInfoCanon =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${idEvento}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const signatureValue = rsaSha1SignBase64(signedInfoCanon, parsed.privateKey);
  const certBase64 = pemToBase64(parsed.certPem);

  const signature =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfoCanon +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  return `<evento xmlns="${NFE_NS}" versao="${verEvento}">` + infEventoCanon + signature + `</evento>`;
}

function extractAllTags(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi");
  return xml.match(regex) || [];
}

function isoNowSP(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}-03:00`;
}

function sha1Base64(s: string): string {
  const md = forge.md.sha1.create();
  md.update(s, "utf8");
  return forge.util.encode64(md.digest().bytes());
}

function rsaSha1SignBase64(s: string, privateKey: any): string {
  const md = forge.md.sha1.create();
  md.update(s, "utf8");
  const sig = privateKey.sign(md);
  return forge.util.encode64(sig);
}

function pemToBase64(pem: string): string {
  return pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
}

function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

type MtlsTextResponse = { bodyText: string; status: number; statusText: string };

async function requestTextWithMTLS(
  url: URL,
  init: { body?: string; headers?: Record<string, string>; method: string },
  certPem: string,
  keyPem: string,
): Promise<MtlsTextResponse> {
  if (NFE_PROXY_URL) {
    try {
      const proxyResponse = await fetch(NFE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Token": NFE_PROXY_TOKEN },
        body: JSON.stringify({
          soap_body: init.body || "",
          cert_pem: certPem,
          key_pem: keyPem,
          url: url.toString(),
          soap_action: init.headers?.SOAPAction || SOAP_ACTION,
          content_type: init.headers?.["Content-Type"] || SOAP_CONTENT_TYPE,
        }),
      });
      const proxyData = await proxyResponse.json();
      if (proxyData.success && proxyData.body) {
        return { bodyText: proxyData.body, status: proxyData.status || 200, statusText: "OK" };
      }
      console.warn(`[nfe-manifestacao] Proxy falhou:`, proxyData.error);
    } catch (e) {
      console.warn(`[nfe-manifestacao] Erro proxy:`, (e as Error).message);
    }
  }
  const httpClient = (Deno as any).createHttpClient({ cert: certPem, http1: true, http2: false, key: keyPem });
  try {
    const response = await fetch(url, { body: init.body, client: httpClient, headers: init.headers, method: init.method } as any);
    const bodyText = await response.text();
    return { bodyText, status: response.status, statusText: response.statusText };
  } finally { httpClient.close(); }
}

function parsePfx(pfxBytes: Uint8Array, password: string): { certPem: string; keyPem: string; privateKey: any } {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < pfxBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...pfxBytes.subarray(i, i + chunkSize));
  }
  const asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada");
  const privateKey = keyBag.key;
  const keyPem = forge.pki.privateKeyToPem(privateKey);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = ((certBags[forge.pki.oids.certBag] || []) as Array<any>).filter((b) => b?.cert);
  if (certs.length === 0) throw new Error("Certificado não encontrado no PFX");
  const leaf = certs.find((c: any) => {
    const s = stringifyDN(c.cert.subject); const i = stringifyDN(c.cert.issuer);
    return s !== i;
  }) || certs[0];
  const certPem = forge.pki.certificateToPem(leaf.cert);
  return { certPem, keyPem, privateKey };
}

function stringifyDN(dn: { attributes?: Array<{ shortName?: string; name?: string; value?: string }> }): string {
  return (dn.attributes || []).map((a) => `${a.shortName || a.name || "attr"}=${a.value || ""}`).join(",");
}
