import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { main_activity, secondary_activities, classify_anexo } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // --- Mode: classify_anexo ---
    if (classify_anexo) {
      if (!main_activity) {
        return new Response(JSON.stringify({ anexo: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em tributação brasileira e Simples Nacional.
Analise o CNAE (atividade principal) fornecido e determine em qual Anexo do Simples Nacional (I, II, III, IV ou V) essa atividade se enquadra, conforme a Lei Complementar 123/2006.
- Anexo I: Comércio
- Anexo II: Indústria
- Anexo III: Serviços (ex: instalação, reparação, agências de viagem, escritórios contábeis, etc.)
- Anexo IV: Serviços (ex: construção civil, vigilância, limpeza, advocacia)
- Anexo V: Serviços (ex: engenharia, medicina, odontologia, publicidade, jornalismo, TI, consultoria)
Use a função classify_anexo para retornar sua resposta.`,
            },
            {
              role: "user",
              content: `Atividade Principal (CNAE): ${main_activity}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_anexo",
                description: "Retorna o anexo do Simples Nacional",
                parameters: {
                  type: "object",
                  properties: {
                    anexo: {
                      type: "string",
                      enum: ["I", "II", "III", "IV", "V"],
                      description: "O número romano do anexo do Simples Nacional",
                    },
                  },
                  required: ["anexo"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "classify_anexo" } },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        return new Response(JSON.stringify({ anexo: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ anexo: args.anexo || "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ anexo: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Mode: classify segment (original) ---
    if (!main_activity && !secondary_activities) {
      return new Response(JSON.stringify({ classification: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em classificação de empresas brasileiras por CNAE.
Analise os CNAEs (atividade principal e secundárias) fornecidos e classifique a empresa em uma das 4 categorias:
- Comércio: empresas que compram e revendem mercadorias (CNAEs divisões 45-47)
- Indústria: empresas que transformam matéria-prima em produtos (CNAEs divisões 10-33)
- Serviço: empresas que prestam serviços
- Misto: empresas que combinam mais de uma das categorias acima

Considere TODOS os CNAEs (principal e secundários) para determinar se a empresa é Mista.
Use a função classify_segment para retornar sua resposta.`,
          },
          {
            role: "user",
            content: `Atividade Principal: ${main_activity || "Não informada"}\nAtividades Secundárias: ${secondary_activities || "Nenhuma"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_segment",
              description: "Retorna a classificação do segmento da empresa",
              parameters: {
                type: "object",
                properties: {
                  classification: {
                    type: "string",
                    enum: ["Comércio", "Serviço", "Indústria", "Misto"],
                    description: "A classificação do segmento da empresa",
                  },
                },
                required: ["classification"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_segment" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ classification: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ classification: args.classification || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ classification: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-segment error:", e);
    return new Response(JSON.stringify({ classification: "" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
