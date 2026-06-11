import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    const digits = (cnpj || "").replace(/\D/g, "");

    if (digits.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try BrasilAPI first
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (res.ok) {
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.log("[cnpj-lookup] BrasilAPI failed:", e.message);
    }

    // Fallback to ReceitaWS
    try {
      const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status !== "ERROR") {
          // Map ReceitaWS format to BrasilAPI format
          const mapped = {
            razao_social: data.nome,
            nome_fantasia: data.fantasia,
            cnpj: data.cnpj,
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            email: data.email,
            ddd_telefone_1: data.telefone,
            cnae_fiscal: data.atividade_principal?.[0]?.code?.replace(/[.\-/]/g, ''),
            cnae_fiscal_descricao: data.atividade_principal?.[0]?.text,
            cnaes_secundarios: (data.atividades_secundarias || []).map((a: any) => ({
              codigo: parseInt(a.code?.replace(/[.\-/]/g, '') || '0'),
              descricao: a.text,
            })),
            qsa: (data.qsa || []).map((s: any) => ({
              nome_socio: s.nome,
              qualificacao_socio: s.qual,
            })),
            opcao_pelo_simples: data.simples?.optante === true,
            opcao_pelo_mei: data.simei?.optante === true,
          };
          return new Response(JSON.stringify(mapped), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.log("[cnpj-lookup] ReceitaWS failed:", e.message);
    }

    return new Response(
      JSON.stringify({ error: "CNPJ_NOT_FOUND", fallback: true, message: "CNPJ não encontrado em nenhuma fonte" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cnpj-lookup] Error:", err);
    return new Response(
      JSON.stringify({ error: "SERVICE_FAILED", fallback: true, message: err.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
