import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reconciles auto_confirmed triage learnings created >30 min ago.
// If the conversation's current assignee is in a different department, mark as corrected.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: pending, error } = await supabase
    .from("triage_learnings")
    .select("id, conversation_id, chosen_department_id")
    .eq("outcome", "auto_confirmed")
    .is("confirmed_at", null)
    .lt("created_at", cutoff)
    .limit(200);

  if (error) {
    console.error("reconcile fetch error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let confirmed = 0, corrected = 0, rejected = 0;
  const now = new Date().toISOString();

  for (const l of pending || []) {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("assigned_to, status, triaged_department_id")
      .eq("id", l.conversation_id)
      .maybeSingle();

    if (!conv) {
      await supabase.from("triage_learnings")
        .update({ outcome: "rejected", confirmed_at: now }).eq("id", l.id);
      rejected++;
      continue;
    }

    let actualDept: string | null = null;
    if (conv.assigned_to) {
      const { data: prof } = await supabase
        .from("profiles").select("department_id").eq("user_id", conv.assigned_to).maybeSingle();
      actualDept = prof?.department_id || null;
    }

    if (!actualDept) {
      // No assignee yet — keep waiting (don't confirm)
      continue;
    }

    if (actualDept === l.chosen_department_id) {
      await supabase.from("triage_learnings")
        .update({ confirmed_at: now }).eq("id", l.id);
      confirmed++;
    } else {
      await supabase.from("triage_learnings")
        .update({ outcome: "corrected", corrected_department_id: actualDept, confirmed_at: now })
        .eq("id", l.id);
      corrected++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: pending?.length || 0, confirmed, corrected, rejected }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});