import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERPRO_AUTH_URL =
  "https://apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token";
const SERPRO_CNPJ_URL =
  "https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-empresa/v2/empresa";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
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

    const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch(SERPRO_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`SERPRO auth failed [${tokenRes.status}]: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Query CNPJ
    const cnpjRes = await fetch(`${SERPRO_CNPJ_URL}/${digits}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!cnpjRes.ok) {
      const errText = await cnpjRes.text();
      return new Response(
        JSON.stringify({ error: `CNPJ não encontrado [${cnpjRes.status}]`, details: errText }),
        { status: cnpjRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await cnpjRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cnpj-query error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
