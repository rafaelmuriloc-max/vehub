import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TURNS = 5;

const DEFAULT_SYSTEM_PROMPT = `Você é {agent_name}, recepcionista virtual da Velocitä Contabilidade no WhatsApp.

Sua única função é fazer a TRIAGEM da conversa: descobrir educadamente o que o cliente precisa e identificar para qual departamento transferir.

Regras:
- Seja breve, cordial e em português brasileiro.
- Não responda dúvidas técnicas, fiscais ou contábeis — apenas faça a triagem.
- Se a primeira mensagem for um simples cumprimento (\"oi\", \"bom dia\"), cumprimente de volta e pergunte como pode ajudar.
- Quando souber o departamento com confiança, use a tool \"transfer\". Caso contrário, use \"ask_user\" para perguntar.
- Considere o contexto de toda a conversa, não apenas a última mensagem.
- Use os exemplos aprendidos abaixo (quando houver) como referência de roteamento correto.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lovableKey) {
      console.error("LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic claim — prevents two webhook events from triggering double replies.
    // Also accepts 'skipped' (legado da migration) e 'done' (cliente voltou) desde que
    // não exista atendente atribuído.
    const { data: claim, error: claimErr } = await supabase
      .from("chat_conversations")
      .update({ triage_status: "in_progress" })
      .eq("id", conversation_id)
      .in("triage_status", ["pending", "in_progress", "skipped", "done"])
      .is("assigned_to", null)
      .select("id, triage_turns, is_group, whatsapp_phone")
      .maybeSingle();

    if (claimErr || !claim) {
      console.log("triage skipped (claim failed):", conversation_id, claimErr?.message);
      return new Response(JSON.stringify({ ok: false, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (claim.is_group) {
      await supabase.from("chat_conversations")
        .update({ triage_status: "skipped" }).eq("id", conversation_id);
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Settings (must be enabled)
    const { data: settings } = await supabase
      .from("company_settings")
      .select("agent_name, triage_enabled, triage_fallback_department_id, triage_system_prompt")
      .limit(1).maybeSingle();
    if (!settings?.triage_enabled) {
      await supabase.from("chat_conversations")
        .update({ triage_status: "skipped" }).eq("id", conversation_id);
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const agentName = settings.agent_name || "Atendimento";

    // Departments
    const { data: depts } = await supabase
      .from("departments")
      .select("id, name, description, triage_keywords, triage_prompt")
      .order("name");
    if (!depts || depts.length === 0) {
      await supabase.from("chat_conversations")
        .update({ triage_status: "skipped" }).eq("id", conversation_id);
      return new Response(JSON.stringify({ ok: true, skipped: "no-departments" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // History (last 30, chronological)
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("content, message_type, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(30);
    const history = (msgs || []).reverse();

    // Build system prompt: company-wide editable prompt + per-department prompts
    const systemPromptTemplate = (settings as any).triage_system_prompt || DEFAULT_SYSTEM_PROMPT;
    const systemBase = systemPromptTemplate.replaceAll("{agent_name}", agentName);

    const deptLines = depts.map((d: any) => {
      const guidance = d.triage_prompt
        || [d.description, d.triage_keywords].filter(Boolean).join(" — ")
        || "(sem instrução)";
      return `- ${d.id} — ${d.name}: ${guidance}`;
    }).join("\n");

    // Fetch up to 8 most recent learnings, balanced by department
    let examplesBlock = "";
    try {
      const { data: learnings } = await supabase
        .from("triage_learnings")
        .select("user_messages, chosen_department_id, corrected_department_id, outcome")
        .in("outcome", ["auto_confirmed", "corrected"])
        .order("created_at", { ascending: false })
        .limit(40);
      const deptName = new Map(depts.map((d: any) => [d.id, d.name]));
      const perDept: Record<string, any[]> = {};
      (learnings || []).forEach((l: any) => {
        const did = l.corrected_department_id || l.chosen_department_id;
        if (!did || !deptName.has(did)) return;
        (perDept[did] ||= []).push(l);
      });
      const picked: { text: string; dept: string }[] = [];
      let added = true;
      while (added && picked.length < 8) {
        added = false;
        for (const did of Object.keys(perDept)) {
          if (picked.length >= 8) break;
          const l = perDept[did].shift();
          if (l) {
            const snippet = String(l.user_messages || "").trim().replace(/\s+/g, " ").slice(0, 240);
            picked.push({ text: snippet, dept: deptName.get(did) as string });
            added = true;
          }
        }
      }
      if (picked.length) {
        examplesBlock = "\n\nExemplos de triagens anteriores bem-sucedidas:\n" +
          picked.map((p, i) => `${i + 1}. Cliente: "${p.text}" → Departamento: ${p.dept}`).join("\n");
      }
    } catch (e) {
      console.warn("learnings fetch failed:", (e as Error).message);
    }

    const systemContent =
      `${systemBase}\n\nDepartamentos disponíveis (id — nome — instrução de quando usar):\n${deptLines}${examplesBlock}`;

    const aiMessages: any[] = [
      { role: "system", content: systemContent },
      ...history.map((m) => ({
        role: m.message_type?.startsWith("whatsapp_incoming") ? "user" : "assistant",
        content: m.content || "",
      })),
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "ask_user",
          description: "Envia uma pergunta/mensagem para o cliente no WhatsApp para entender melhor o que ele precisa.",
          parameters: {
            type: "object",
            properties: { text: { type: "string", description: "Mensagem a enviar ao cliente." } },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "transfer",
          description: "Transfere a conversa para o departamento responsável. Use quando souber com clareza o que o cliente precisa.",
          parameters: {
            type: "object",
            properties: {
              department_id: { type: "string", description: "UUID do departamento alvo (da lista acima)." },
              summary: { type: "string", description: "Resumo curto (1-2 frases) do que o cliente precisa, em PT-BR." },
            },
            required: ["department_id", "summary"],
            additionalProperties: false,
          },
        },
      },
    ];

    // Force fallback if too many turns
    const turns = claim.triage_turns ?? 0;
    let forceFallback = turns >= MAX_TURNS;

    let toolName: string | null = null;
    let toolArgs: any = null;

    if (!forceFallback) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          tools,
          tool_choice: "required",
        }),
      });
      if (aiRes.status === 429 || aiRes.status === 402) {
        console.error("AI rate/credit error:", aiRes.status);
        await supabase.from("chat_conversations")
          .update({ triage_status: "pending" }).eq("id", conversation_id);
        return new Response(JSON.stringify({ ok: false, error: aiRes.status }), {
          status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("AI error", aiRes.status, t);
        forceFallback = true;
      } else {
        const aiJson = await aiRes.json();
        const choice = aiJson?.choices?.[0]?.message;
        const call = choice?.tool_calls?.[0];
        toolName = call?.function?.name ?? null;
        try { toolArgs = call?.function?.arguments ? JSON.parse(call.function.arguments) : null; }
        catch { toolArgs = null; }
        if (!toolName || !toolArgs) {
          console.warn("AI returned no tool call, falling back");
          forceFallback = true;
        }
      }
    }

    if (forceFallback) {
      const deptId = settings.triage_fallback_department_id || depts[0].id;
      toolName = "transfer";
      toolArgs = { department_id: deptId, summary: "Triagem encaminhada para o departamento padrão." };
    }

    if (toolName === "ask_user") {
      const text = String(toolArgs.text || "").trim();
      if (!text) {
        await supabase.from("chat_conversations")
          .update({ triage_status: "pending" }).eq("id", conversation_id);
        return new Response(JSON.stringify({ ok: false, error: "empty text" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Send via whatsapp-send-text (uses Meta or Evolution as appropriate)
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ conversationId: conversation_id, text, senderName: agentName, agentName }),
      });
      if (!sendRes.ok) {
        console.error("triage send-text failed:", sendRes.status, await sendRes.text());
      }
      await supabase
        .from("chat_conversations")
        .update({ triage_turns: turns + 1, updated_at: new Date().toISOString() })
        .eq("id", conversation_id);
      return new Response(JSON.stringify({ ok: true, action: "ask_user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // transfer
    const targetDept = depts.find((d) => d.id === toolArgs.department_id) || depts[0];
    const summary = String(toolArgs.summary || "").trim();

    // Round-robin: pick employee in dept with fewest open assigned conversations
    const { data: candidates } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("department_id", targetDept.id)
      .order("full_name");

    let assignee: { user_id: string; full_name: string | null } | null = null;
    if (candidates && candidates.length > 0) {
      const counts = await Promise.all(
        candidates.map(async (c) => {
          const { count } = await supabase
            .from("chat_conversations")
            .select("id", { count: "exact", head: true })
            .eq("status", "open")
            .eq("assigned_to", c.user_id);
          return { c, n: count || 0 };
        }),
      );
      counts.sort((a, b) => a.n - b.n);
      assignee = counts[0]?.c || null;
    }

    const updates: Record<string, unknown> = {
      triage_status: "done",
      triage_department_id: targetDept.id,
      triaged_department_id: targetDept.id,
      triage_summary: summary,
      updated_at: new Date().toISOString(),
    };
    if (assignee) updates.assigned_to = assignee.user_id;

    await supabase.from("chat_conversations").update(updates).eq("id", conversation_id);

    // Record this triage as a learning example (will be reconciled in 30 minutes)
    try {
      const userText = history
        .filter((m) => m.message_type?.startsWith("whatsapp_incoming"))
        .map((m) => m.content || "")
        .join(" \n")
        .trim()
        .slice(0, 2000);
      if (userText) {
        await supabase.from("triage_learnings").insert({
          conversation_id,
          user_messages: userText,
          chosen_department_id: targetDept.id,
          summary,
          outcome: "auto_confirmed",
        });
      }
    } catch (e) {
      console.warn("learning insert failed:", (e as Error).message);
    }

    const assigneeName = assignee?.full_name?.split(" ")[0] || "um atendente";
    const transferText = assignee
      ? `Perfeito! Vou transferir você para o nosso *${targetDept.name}*. Em instantes ${assigneeName} continuará o atendimento por aqui. 😊`
      : `Perfeito! Vou encaminhar sua solicitação para o nosso *${targetDept.name}*. Assim que possível um atendente continuará por aqui. 😊`;

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ conversationId: conversation_id, text: transferText, senderName: agentName, agentName }),
    });
    if (!sendRes.ok) console.error("triage transfer send-text failed:", sendRes.status, await sendRes.text());

    return new Response(JSON.stringify({ ok: true, action: "transfer", department: targetDept.name, assignee: assignee?.user_id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-triage-agent error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});