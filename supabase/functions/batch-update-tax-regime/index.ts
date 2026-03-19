import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, document, tax_regime")
    .not("document", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cnpjClients = (clients || []).filter(
    (c) => c.document && c.document.replace(/\D/g, "").length === 14
  );

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const client of cnpjClients) {
    const cnpj = client.document!.replace(/\D/g, "");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) {
        errors.push(`${cnpj}: HTTP ${res.status}`);
        await res.text();
        await sleep(300);
        continue;
      }

      const data = await res.json();
      const newRegime = data.opcao_pelo_mei
        ? "mei"
        : data.opcao_pelo_simples
        ? "simples_nacional"
        : "lucro_presumido";

      if (client.tax_regime === newRegime) {
        skipped++;
      } else {
        const { error: updateErr } = await supabase
          .from("clients")
          .update({ tax_regime: newRegime })
          .eq("id", client.id);

        if (updateErr) {
          errors.push(`${cnpj}: ${updateErr.message}`);
        } else {
          updated++;
        }
      }
    } catch (e) {
      errors.push(`${cnpj}: ${e.message}`);
    }

    await sleep(300);
  }

  return new Response(
    JSON.stringify({ total: cnpjClients.length, updated, skipped, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
