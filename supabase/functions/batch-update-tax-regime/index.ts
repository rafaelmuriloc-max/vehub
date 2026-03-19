import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  console.log(`Starting batch: offset=${offset}, limit=${limit}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, document, tax_regime")
    .not("document", "is", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("DB error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cnpjClients = (clients || []).filter(
    (c) => c.document && c.document.replace(/\D/g, "").length === 14
  );

  console.log(`Found ${cnpjClients.length} clients with CNPJ`);

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const client of cnpjClients) {
    const cnpj = client.document!.replace(/\D/g, "");
    try {
      console.log(`Fetching CNPJ: ${cnpj}`);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const body = await res.text();
      
      if (!res.ok) {
        console.log(`CNPJ ${cnpj}: HTTP ${res.status}`);
        errors.push(`${cnpj}: HTTP ${res.status}`);
        continue;
      }

      const data = JSON.parse(body);
      const newRegime = data.opcao_pelo_mei
        ? "mei"
        : data.opcao_pelo_simples
        ? "simples_nacional"
        : "lucro_presumido";

      console.log(`CNPJ ${cnpj}: mei=${data.opcao_pelo_mei}, simples=${data.opcao_pelo_simples} -> ${newRegime}`);

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
      console.error(`Error for ${cnpj}:`, e.message);
      errors.push(`${cnpj}: ${e.message}`);
    }
  }

  const result = {
    batch: { offset, limit },
    processed: cnpjClients.length,
    updated,
    skipped,
    errors,
    next_offset: clients && clients.length === limit ? offset + limit : null,
  };

  console.log("Result:", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
