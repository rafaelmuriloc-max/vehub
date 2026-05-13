import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_THRESHOLD_MIN = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("company_settings")
      .select("chat_alert_whatsapp_group_id")
      .limit(1)
      .maybeSingle();

    const groupId = settings?.chat_alert_whatsapp_group_id?.trim();
    if (!groupId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_group_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thresholdIso = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();

    const { data: convs, error } = await supabase
      .from("chat_conversations")
      .select("id, name, whatsapp_phone, waiting_since, last_wait_alert_at")
      .eq("status", "open")
      .is("assigned_to", null)
      .not("waiting_since", "is", null)
      .lte("waiting_since", thresholdIso);

    if (error) throw error;

    const due = (convs || []).filter((c: any) => {
      if (!c.last_wait_alert_at) return true;
      return new Date(c.last_wait_alert_at).getTime() <= Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000;
    });

    let sent = 0;
    for (const c of due) {
      const minutes = Math.floor((Date.now() - new Date(c.waiting_since).getTime()) / 60000);
      const label = c.name || c.whatsapp_phone || "Conversa";
      const phoneLine = c.whatsapp_phone ? `\n📱 ${c.whatsapp_phone}` : "";
      const text = `⚠️ *Atendimento em espera*\n\n👤 ${label}${phoneLine}\n⏱️ Aguardando há *${minutes} min* sem atribuição.\n\nEntre no V-Hub para atender.`;

      try {
        const res = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({ number: groupId, text }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("Evolution send failed", res.status, body);
          continue;
        }
        await supabase
          .from("chat_conversations")
          .update({ last_wait_alert_at: new Date().toISOString() })
          .eq("id", c.id);
        sent++;
      } catch (e) {
        console.error("Send error for conv", c.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: convs?.length ?? 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-waiting-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});