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

async function parsePfx(pfxBytes: Uint8Array, password: string): Promise<{ certPem: string; keyPem: string }> {
  // Use Web Crypto + ASN.1 parsing for PFX
  // For Deno, we use the built-in node:crypto compatibility
  const { createPrivateKey, createPublicKey, X509Certificate } = await import("node:crypto");
  const { Buffer } = await import("node:buffer");

  const pfxBuffer = Buffer.from(pfxBytes);

  // Parse PKCS12 using node:crypto (available in Deno)
  const key = createPrivateKey({
    key: pfxBuffer,
    format: "der",
    type: "pkcs12",
    passphrase: password,
  });

  const keyPem = key.export({ type: "pkcs8", format: "pem" }) as string;

  // Extract certificate
  const cert = new X509Certificate(pfxBuffer);
  const certPem = cert.toString();

  return { certPem, keyPem };
}

function buildDistributionRequest(cnpj: string, competencia: string): string {
  // Build XML request for NFS-e distribution endpoint
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
  // Use Deno.createHttpClient for mTLS
  const httpClient = Deno.createHttpClient({
    certChain: certPem,
    privateKey: keyPem,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml",
    },
    body,
    // @ts-ignore - Deno specific
    client: httpClient,
  });

  return response;
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
