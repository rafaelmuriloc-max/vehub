import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const emptyExtraction = {
  cnpj: "",
  company_name: "",
  reference_month: "",
  document_type_name: "",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, document_types } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Texto do documento vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typesList = (document_types || [])
      .map((dt: { name: string; description?: string }) => `- ${dt.name}${dt.description ? ` (${dt.description})` : ""}`)
      .join("\n");

    const systemPrompt = `Você é um assistente especializado em documentos fiscais e contábeis brasileiros.
Analise o texto extraído de um documento PDF e identifique:
1. CNPJ da empresa (apenas números, 14 dígitos)
2. Nome/Razão Social da empresa
3. Mês de competência/referência (formato YYYY-MM)
4. Tipo de documento

Tipos de documento cadastrados no sistema:
${typesList}

Se não encontrar alguma informação, retorne string vazia para aquele campo.
Para o tipo de documento, use exatamente o nome de um dos tipos cadastrados acima. Se nenhum corresponder, retorne string vazia.
Para o CNPJ, retorne apenas os 14 dígitos numéricos sem formatação.
Para a competência, interprete datas como "03/2026", "março 2026", "competência março/2026" etc. e retorne no formato YYYY-MM.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analise este documento e extraia as informações:\n\n${text.substring(0, 4000)}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_document",
                description: "Retorna os dados extraídos do documento fiscal/contábil",
                parameters: {
                  type: "object",
                  properties: {
                    cnpj: { type: "string", description: "CNPJ 14 dígitos" },
                    company_name: { type: "string", description: "Razão Social" },
                    reference_month: { type: "string", description: "YYYY-MM" },
                    document_type_name: { type: "string", description: "Tipo de documento cadastrado" },
                  },
                  required: ["cnpj", "company_name", "reference_month", "document_type_name"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "classify_document" } },
        }),
      });
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        console.warn("classify-document timeout after 55s, returning empty extraction");
        return new Response(JSON.stringify(emptyExtraction), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro ao classificar documento");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(emptyExtraction), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("classify-document error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
