import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Você analisa atendimentos (chamados) de um escritório de contabilidade no WhatsApp.
A partir da transcrição da conversa, produza:
- "subject": título curto do assunto (máx. 60 caracteres);
- "summary": resumo objetivo em 2 a 4 linhas, em português, dizendo o que o cliente pediu e o que foi resolvido/encaminhado;
- "category": uma categoria curta (ex.: Fiscal, Contábil, Departamento Pessoal, Financeiro, Certificado Digital, Documentos, Outros).
Responda SOMENTE via a tool "registrar_resumo".`;

type Msg = {
  content: string | null;
  message_type: string;
  created_at: string;
  agent_name: string | null;
  transcription: string | null;
};

function renderTranscript(msgs: Msg[]): string {
  return msgs
    .map((m) => {
      const incoming = (m.message_type || "").includes("incoming");
      const who = incoming ? "Cliente" : m.agent_name ? `Atendente (${m.agent_name})` : "Atendente";
      let text = m.transcription || m.content || "";
      if (!text && m.message_type) text = `[${m.message_type}]`;
      return `${who}: ${text}`.slice(0, 1200);
    })
    .join("\n")
    .slice(0, 24000);
}

async function summarize(lovableKey: string, transcript: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcrição do atendimento:\n\n${transcript}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_resumo",
            description: "Registra o resumo do chamado",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string" },
                summary: { type: "string" },
                category: { type: "string" },
              },
              required: ["subject", "summary", "category"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "registrar_resumo" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI sem tool_call");
  const args = JSON.parse(call.function.arguments || "{}");
  return {
    subject: (args.subject || "").slice(0, 120) || null,
    summary: args.summary || null,
    category: (args.category || "").slice(0, 60) || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const payload = await req.json().catch(() => ({}));
    const { ticket_id, backfill, since, limit } = payload as {
      ticket_id?: string;
      backfill?: boolean;
      since?: string;
      limit?: number;
    };

    // ---------- Backfill: cria chamados para conversas com mensagens no período ----------
    if (backfill) {
      const sinceIso = since || new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
      const { data: recentMsgs } = await supabase
        .from("chat_messages")
        .select("conversation_id, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .limit(5000);

      const firstByConv = new Map<string, string>();
      for (const m of recentMsgs || []) {
        if (!firstByConv.has(m.conversation_id)) firstByConv.set(m.conversation_id, m.created_at);
      }

      let created = 0;
      for (const [convId, firstAt] of firstByConv) {
        const { data: conv } = await supabase
          .from("chat_conversations")
          .select("id, name, whatsapp_phone, client_id, assigned_to, status, closed_at, triaged_department_id, total_wait_seconds, is_group")
          .eq("id", convId)
          .maybeSingle();
        if (!conv) continue;

        const { data: exists } = await supabase
          .from("support_tickets")
          .select("id")
          .eq("conversation_id", convId)
          .gte("opened_at", sinceIso)
          .limit(1);
        if (exists && exists.length > 0) continue;

        const { error: insErr } = await supabase.from("support_tickets").insert({
          conversation_id: conv.id,
          client_id: conv.client_id,
          contact_name: conv.name,
          contact_phone: conv.whatsapp_phone,
          department_id: conv.triaged_department_id,
          assigned_to: conv.assigned_to,
          status: conv.status === "closed" ? "closed" : "open",
          opened_at: firstAt,
          closed_at: conv.status === "closed" ? conv.closed_at : null,
          wait_seconds: conv.total_wait_seconds ?? 0,
          summary_status: "pending",
        });
        if (!insErr) created++;
      }

      // Gera resumos pendentes
      const { data: pending } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("summary_status", "pending")
        .gte("opened_at", sinceIso)
        .limit(limit ?? 200);

      let summarized = 0;
      for (const t of pending || []) {
        try {
          await summarizeTicket(supabase, lovableKey, t.id);
          summarized++;
        } catch (e) {
          console.error("summarize failed", t.id, (e as Error).message);
        }
      }

      return json({ ok: true, created, summarized });
    }

    if (!ticket_id) return json({ error: "ticket_id obrigatório" }, 400);
    const result = await summarizeTicket(supabase, lovableKey, ticket_id);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("ticket-summarize error", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});

async function summarizeTicket(supabase: any, lovableKey: string, ticketId: string) {
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, conversation_id, opened_at, closed_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw new Error("chamado não encontrado");

  let q = supabase
    .from("chat_messages")
    .select("content, message_type, created_at, agent_name, transcription")
    .eq("conversation_id", ticket.conversation_id)
    .is("deleted_at", null)
    .gte("created_at", ticket.opened_at)
    .order("created_at", { ascending: true })
    .limit(300);
  if (ticket.closed_at) q = q.lte("created_at", ticket.closed_at);

  const { data: msgs } = await q;

  if (!msgs || msgs.length === 0) {
    await supabase
      .from("support_tickets")
      .update({ summary_status: "empty", subject: "Sem mensagens", messages_count: 0 })
      .eq("id", ticketId);
    return { subject: "Sem mensagens", summary: null, category: null };
  }

  const transcript = renderTranscript(msgs as Msg[]);
  const result = await summarize(lovableKey, transcript);

  await supabase
    .from("support_tickets")
    .update({
      subject: result.subject,
      summary: result.summary,
      category: result.category,
      messages_count: msgs.length,
      first_response_at:
        (msgs as Msg[]).find((m) => !(m.message_type || "").includes("incoming"))?.created_at ?? null,
      summary_status: "done",
    })
    .eq("id", ticketId);

  return result;
}
