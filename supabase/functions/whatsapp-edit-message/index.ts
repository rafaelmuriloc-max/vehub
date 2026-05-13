import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messageId, newText } = await req.json();
    if (!messageId || typeof newText !== "string") {
      return new Response(JSON.stringify({ error: "messageId and newText required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, channel, message_type, wa_message_id, wa_remote_jid, created_at, conversation_id")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (msg.channel !== "whatsapp" || msg.message_type !== "whatsapp_outgoing") {
      return new Response(JSON.stringify({ error: "Only outgoing WhatsApp text messages can be edited" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!msg.wa_message_id || !msg.wa_remote_jid) {
      return new Response(JSON.stringify({ error: "Mensagem não tem identificador do WhatsApp (anterior à atualização)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Meta wamid is not editable via Evolution. The webhook backfills the Evolution id within seconds —
    // ask the user to retry shortly.
    if (msg.wa_message_id.startsWith("wamid.")) {
      return new Response(JSON.stringify({ error: "Aguarde alguns segundos para o WhatsApp confirmar a mensagem antes de editar." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ageMin = (Date.now() - new Date(msg.created_at).getTime()) / 60000;
    if (ageMin > 15) {
      return new Response(JSON.stringify({ error: "Limite de 15 minutos para edição no WhatsApp expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
    const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

    const number = msg.wa_remote_jid.replace(/@.*/, "");
    const evoRes = await fetch(
      `${EVOLUTION_API_URL}/chat/updateMessage/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          number,
          key: { remoteJid: msg.wa_remote_jid, fromMe: true, id: msg.wa_message_id },
          text: newText,
        }),
      },
    );
    const evoJson = await evoRes.json().catch(() => ({}));
    if (!evoRes.ok) {
      console.error("Evolution updateMessage failed:", evoRes.status, evoJson);
      return new Response(JSON.stringify({ error: `Evolution API ${evoRes.status}: ${JSON.stringify(evoJson)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("chat_messages")
      .update({ content: newText, edited_at: new Date().toISOString() })
      .eq("id", messageId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-edit-message error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});