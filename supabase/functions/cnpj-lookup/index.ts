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

    // Fallback to publica.cnpj.ws (covers newly opened CNPJs)
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VelocitaCRM/1.0)",
          "Accept": "application/json",
        },
      });
      console.log("[cnpj-lookup] publica.cnpj.ws status:", res.status);
      if (res.ok) {
        const data = await res.json();
        const est = data.estabelecimento || {};
        const ativPrinc = est.atividade_principal || {};
        const phone = est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : "";
        const mapped = {
          razao_social: data.razao_social,
          nome_fantasia: est.nome_fantasia,
          cnpj: est.cnpj,
          logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" "),
          numero: est.numero,
          complemento: est.complemento,
          bairro: est.bairro,
          municipio: est.cidade?.nome,
          uf: est.estado?.sigla,
          cep: est.cep,
          email: est.email,
          ddd_telefone_1: phone,
          cnae_fiscal: parseInt((ativPrinc.subclasse || "").replace(/[.\-/]/g, "") || "0"),
          cnae_fiscal_descricao: ativPrinc.descricao,
          cnaes_secundarios: (est.atividades_secundarias || []).map((a: any) => ({
            codigo: parseInt((a.subclasse || "").replace(/[.\-/]/g, "") || "0"),
            descricao: a.descricao,
          })),
          qsa: (data.socios || []).map((s: any) => ({
            nome_socio: s.nome,
            qualificacao_socio: s.qualificacao_socio?.descricao,
          })),
          opcao_pelo_simples: data.simples?.simples === "Sim",
          opcao_pelo_mei: data.simples?.mei === "Sim",
          data_inicio_atividade: est.data_inicio_atividade,
        };
        return new Response(JSON.stringify(mapped), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.log("[cnpj-lookup] publica.cnpj.ws failed:", e.message);
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
