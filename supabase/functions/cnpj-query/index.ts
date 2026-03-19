import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Try both gateway URLs for the CNPJ query
const SERPRO_CNPJ_URLS = [
  "https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df/v2/empresa",
  "https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-empresa/v2/empresa",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    console.log("[cnpj-query] Received CNPJ:", cnpj);

    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const digits = cnpj.replace(/\D/g, "");

    // OAuth2 client_credentials
    const consumerKey = Deno.env.get("SERPRO_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");
    if (!consumerKey || !consumerSecret) {
      throw new Error("SERPRO credentials not configured");
    }

    // Try auth endpoints with timeout
    const authUrls = [
      "https://gateway.apiserpro.serpro.gov.br/token",
      "https://apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token",
    ];

    let accessToken: string | null = null;
    const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);

    for (const authUrl of authUrls) {
      try {
        console.log(`[cnpj-query] Trying auth at: ${authUrl}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const tokenRes = await fetch(authUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const responseText = await tokenRes.text();
        console.log(`[cnpj-query] Auth response [${tokenRes.status}]: ${responseText.substring(0, 200)}`);

        if (tokenRes.ok) {
          const tokenData = JSON.parse(responseText);
          accessToken = tokenData.access_token;
          console.log("[cnpj-query] Got access token from:", authUrl);
          break;
        }
      } catch (authErr) {
        console.log(`[cnpj-query] Auth failed at ${authUrl}:`, authErr.message);
      }
    }

    if (!accessToken) {
      throw new Error("Failed to authenticate with SERPRO on all auth endpoints");
    }

    // Query CNPJ - try multiple endpoints
    let cnpjData: any = null;
    let lastError = "";

    for (const baseUrl of SERPRO_CNPJ_URLS) {
      try {
        const cnpjUrl = `${baseUrl}/${digits}`;
        console.log("[cnpj-query] Querying:", cnpjUrl);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const cnpjRes = await fetch(cnpjUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const responseText = await cnpjRes.text();
        console.log(`[cnpj-query] CNPJ response [${cnpjRes.status}]: ${responseText.substring(0, 500)}`);

        if (cnpjRes.ok) {
          cnpjData = JSON.parse(responseText);
          break;
        } else {
          lastError = responseText;
        }
      } catch (queryErr) {
        console.log(`[cnpj-query] Query failed at ${baseUrl}:`, queryErr.message);
        lastError = queryErr.message;
      }
    }

    if (!cnpjData) {
      return new Response(
        JSON.stringify({ error: `CNPJ não encontrado`, details: lastError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(cnpjData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cnpj-query] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
