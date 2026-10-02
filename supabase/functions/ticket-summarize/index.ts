import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "openai/gpt-6-astra";

const SYSTEM_PROMPT = `Você analisa atendimentos (chamados) de um escritório de contabilidade no WhatsApp.
A partir da transcrição, produza um JSON com:
- subject: título curto do assunto (máx. 60 caracteres);
- summary: resumo objetivo em 2 a 4 linhas, em português (o que o cliente pediu e o que foi resolvido/encaminhado);
- category: categoria curta (Fiscal, Contábil, Departamento Pessoal, Financeiro, Certificado Digital, Documentos, Outros);
- applicable: false se o atendimento tiver só respostas automáticas ou interação humana insuficiente para avaliar; senão true;
- nps_score (0-10): probabilidade de o cliente recomendar o escritório com base na CONDUÇÃO do atendimento (cordialidade, agilidade, clareza, resolução). Não penalize pelo assunto em si (ex.: imposto alto). null se applicable=false;
- empathy_score, clarity_score, resolution_score (1-5): empatia, clareza técnica e resolução. null se applicable=false;
- sentiment_start / sentiment_end: humor do cliente no início e no fim ("positivo", "neutro", "negativo"). null se applicable=false;
- feedback_strengths: até 2 linhas com pontos fortes do atendente; null se não aplicável;
- feedback_improvements: 1 linha com ponto de melhoria; null se não aplicável.`;

const nInt = (min: number, max: number) => ({ type: ["integer", "null"], minimum: min, maximum: max });
const nSent = { type: ["string", "null"], enum: ["positivo", "neutro", "negativo", null] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "summary", "category", "applicable", "nps_score", "empathy_score", "clarity_score", "resolution_score", "sentiment_start", "sentiment_end", "feedback_strengths", "feedback_improvements"],
  properties: {
    subject: { type: "string" },
    summary: { type: "string" },
    category: { type: "string" },
    applicable: { type: "boolean" },
    nps_score: nInt(0, 10),
    empathy_score: nInt(1, 5),
    clarity_score: nInt(1, 5),
    resolution_score: nInt(1, 5),
    sentiment_start: nSent,
    sentiment_end: nSent,
    feedback_strengths: { type: ["string", "null"] },
    feedback_improvements: { type: ["string", "null"] },
  },
};

class GatewayError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

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
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcrição do atendimento:\n\n${transcript}` },
      ],
      text: { format: { type: "json_schema", name: "avaliacao_chamado", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new GatewayError(res.status, `AI ${res.status}: ${body.slice(0, 300)}`);
  }
  // Consome SSE
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", finalText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.output_text.done" && ev.text) finalText = ev.text;
        else if (ev.type === "response.failed" || ev.type === "error") {
          throw new GatewayError(500, `AI falhou: ${JSON.stringify(ev).slice(0, 300)}`);
        }
      } catch (e) {
        if (e instanceof GatewayError) throw e;
      }
    }
  }
  const raw = finalText || text;
  if (!raw.trim()) throw new GatewayError(200, "AI sem resposta (possível recusa)");
  const a = JSON.parse(raw);
  const applicable = !!a.applicable && a.nps_score != null;
  const nps = applicable ? Math.max(0, Math.min(10, Math.round(a.nps_score))) : null;
  return {
    subject: (a.subject || "").slice(0, 120) || null,
    summary: a.summary || null,
    category: (a.category || "").slice(0, 60) || null,
    evaluation: applicable
      ? {
          nps_score: nps,
          nps_category: nps! >= 9 ? "promoter" : nps! >= 7 ? "neutral" : "detractor",
          empathy_score: a.empathy_score,
          clarity_score: a.clarity_score,
          resolution_score: a.resolution_score,
          sentiment_start: a.sentiment_start,
          sentiment_end: a.sentiment_end,
          feedback_strengths: a.feedback_strengths,
          feedback_improvements: a.feedback_improvements,
          evaluation_status: "done",
        }
      : { ...EMPTY_EVAL, evaluation_status: "not_applicable" },
  };
}

const EMPTY_EVAL = {
  nps_score: null, nps_category: null, empathy_score: null, clarity_score: null, resolution_score: null,
  sentiment_start: null, sentiment_end: null, feedback_strengths: null, feedback_improvements: null,
};

const isBlocking = (e: unknown) => e instanceof GatewayError && [401, 402, 403, 429].includes(e.status);

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
    const { ticket_id, backfill, since, limit, evaluate_backfill, days } = payload as {
      evaluate_backfill?: boolean;
      days?: number;
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
          .select("id, name, whatsapp_phone, client_id, assigned_to, status, closed_at, created_at, triaged_department_id, total_wait_seconds, is_group")
          .eq("id", convId)
          .maybeSingle();
        if (!conv) continue;

        // Evita duplicar: considera chamados abertos ou já fechados que cobrem o período.
        const { data: exists } = await supabase
          .from("support_tickets")
          .select("id")
          .eq("conversation_id", convId)
          .or(`status.eq.open,opened_at.gte.${sinceIso},closed_at.gte.${sinceIso}`)
          .limit(1);
        if (exists && exists.length > 0) continue;

        // Última mensagem do período (fallback de fechamento coerente)
        let lastAt = firstAt;
        for (const m of recentMsgs || []) {
          if (m.conversation_id === convId && m.created_at > lastAt) lastAt = m.created_at;
        }
        const openedAt = conv.created_at && conv.created_at < firstAt ? conv.created_at : firstAt;
        let closedAt: string | null = null;
        if (conv.status === "closed") {
          closedAt = conv.closed_at && conv.closed_at >= openedAt ? conv.closed_at : lastAt;
        }

        let clientId = conv.client_id as string | null;
        if (!clientId && conv.whatsapp_phone) {
          const { data: resolved } = await supabase.rpc("resolve_client_by_phone", { _phone: conv.whatsapp_phone });
          clientId = (resolved as string | null) ?? null;
        }

        const { error: insErr } = await supabase.from("support_tickets").insert({
          conversation_id: conv.id,
          client_id: clientId,
          contact_name: conv.name,
          contact_phone: conv.whatsapp_phone,
          department_id: conv.triaged_department_id,
          assigned_to: conv.assigned_to,
          status: conv.status === "closed" ? "closed" : "open",
          opened_at: openedAt,
          closed_at: closedAt,
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
          if (isBlocking(e)) return json({ ok: false, created, summarized, error: (e as Error).message }, (e as GatewayError).status);
        }
      }

      return json({ ok: true, created, summarized });
    }

    if (evaluate_backfill) {
      const d = Math.min(Math.max(Number(days) || 30, 1), 90);
      const sinceEval = new Date(Date.now() - d * 86400000).toISOString();
      const { data: list } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("status", "closed")
        .eq("evaluation_status", "pending")
        .gte("closed_at", sinceEval)
        .order("closed_at", { ascending: false })
        .limit(Math.min(limit ?? 8, 20));
      let evaluated = 0;
      for (const t of list || []) {
        try {
          await summarizeTicket(supabase, lovableKey, t.id);
          evaluated++;
        } catch (e) {
          console.error("evaluate failed", t.id, (e as Error).message);
          if (isBlocking(e)) return json({ ok: false, evaluated, error: (e as Error).message }, (e as GatewayError).status);
          await supabase.from("support_tickets").update({ evaluation_status: "failed" }).eq("id", t.id);
        }
      }
      const { count: remaining } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "closed")
        .eq("evaluation_status", "pending")
        .gte("closed_at", sinceEval);
      return json({ ok: true, evaluated, remaining: remaining ?? 0 });
    }

    if (!ticket_id) return json({ error: "ticket_id obrigatório" }, 400);
    const result = await summarizeTicket(supabase, lovableKey, ticket_id);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("ticket-summarize error", (e as Error).message);
    const st = e instanceof GatewayError && e.status >= 400 ? e.status : 500;
    return json({ error: (e as Error).message }, st);
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
      .update({ summary_status: "empty", subject: "Sem mensagens", messages_count: 0, ...EMPTY_EVAL, evaluation_status: "not_applicable", evaluated_at: new Date().toISOString() })
      .eq("id", ticketId);
    return { subject: "Sem mensagens", summary: null, category: null };
  }

  const transcript = renderTranscript(msgs as Msg[]);
  const result = await summarize(lovableKey, transcript);
  const evaluation = msgs.length < 3 ? { ...EMPTY_EVAL, evaluation_status: "not_applicable" } : result.evaluation;

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
      ...evaluation,
      evaluated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  return { subject: result.subject, summary: result.summary, category: result.category, ...evaluation };
}
