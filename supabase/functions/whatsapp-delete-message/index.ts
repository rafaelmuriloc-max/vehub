import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, channel, message_type, wa_message_id, wa_remote_jid")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (msg.channel !== "whatsapp") {
      return new Response(JSON.stringify({ error: "Only WhatsApp messages handled here" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!msg.wa_message_id || !msg.wa_remote_jid) {
      return new Response(JSON.stringify({ error: "Mensagem não tem identificador do WhatsApp" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.wa_message_id.startsWith("wamid.")) {
      return new Response(JSON.stringify({ error: "Aguarde alguns segundos para o WhatsApp confirmar a mensagem antes de apagar." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromMe = msg.message_type === "whatsapp_outgoing";

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
    const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

    const url = new URL(`${EVOLUTION_API_URL}/chat/deleteMessageForEveryone/${EVOLUTION_INSTANCE_NAME}`);
    const evoRes = await fetch(url.toString(), {
      method: "DELETE",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({
        id: msg.wa_message_id,
        remoteJid: msg.wa_remote_jid,
        fromMe,
      }),
    });
    const evoJson = await evoRes.json().catch(() => ({}));
    if (!evoRes.ok) {
      console.error("Evolution deleteMessage failed:", evoRes.status, evoJson);
      return new Response(JSON.stringify({ error: `Evolution API ${evoRes.status}: ${JSON.stringify(evoJson)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-delete-message error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});