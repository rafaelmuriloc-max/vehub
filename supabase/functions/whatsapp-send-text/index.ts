import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { conversationId, text, senderName } = await req.json();
    const signedText = senderName ? `*${senderName}:*\n${text}` : text;

    if (!conversationId || !text) {
      return new Response(JSON.stringify({ error: "conversationId and text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get conversation
    const { data: conv, error: convErr } = await supabase
      .from("chat_conversations")
      .select("id, whatsapp_phone")
      .eq("id", conversationId)
      .single();

    if (convErr || !conv?.whatsapp_phone) {
      return new Response(JSON.stringify({ error: "Conversation not found or not a WhatsApp conversation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = conv.whatsapp_phone;

    // Check if there's an incoming message from the client in the last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentIncoming } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("channel", "whatsapp")
      .eq("message_type", "whatsapp_incoming")
      .gte("created_at", twentyFourHoursAgo)
      .limit(1);

    const hasOpenWindow = recentIncoming && recentIncoming.length > 0;
    let sendSuccess = false;
    let sendError: string | null = null;

    if (hasOpenWindow) {
      // Send via Meta API (official) - free text within 24h window
      console.log("Sending via Meta API (24h window open)");
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      if (!accessToken || !phoneNumberId) {
        return new Response(JSON.stringify({ error: "WhatsApp Meta API not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Format phone for Meta API (needs country code, no +)
      let metaPhone = phone.replace(/\D/g, "");
      if (!metaPhone.startsWith("55")) {
        metaPhone = "55" + metaPhone;
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaPhone,
            type: "text",
            text: { body: signedText },
          }),
        }
      );

      if (metaRes.ok) {
        sendSuccess = true;
        console.log("Meta API send success");
      } else {
        const errData = await metaRes.text();
        sendError = `Meta API error: ${metaRes.status} ${errData}`;
        console.error(sendError);
      }
    } else {
      // Send via Evolution API (to initiate conversation outside 24h window)
      console.log("Sending via Evolution API (outside 24h window)");
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
      const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

      if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
        return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const evoRes = await fetch(
        `${evolutionUrl}/message/sendText/${evolutionInstance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionApiKey,
          },
          body: JSON.stringify({
            number: phone,
            text: signedText,
          }),
        }
      );

      if (evoRes.ok) {
        sendSuccess = true;
        console.log("Evolution API send success");
      } else {
        const errData = await evoRes.text();
        sendError = `Evolution API error: ${evoRes.status} ${errData}`;
        console.error(sendError);
      }
    }

    if (!sendSuccess) {
      return new Response(JSON.stringify({ error: sendError || "Failed to send message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the sender (first admin user)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    const senderId = adminRoles?.[0]?.user_id;
    if (!senderId) {
      return new Response(JSON.stringify({ error: "No admin user found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert message into chat_messages
    const { data: insertedMsg, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: text,
        message_type: "whatsapp_outgoing",
        channel: "whatsapp",
      })
      .select("id, content, sender_id, created_at, read_at, message_type, media_url, channel")
      .single();

    if (msgErr) {
      console.error("Error inserting message:", msgErr);
      return new Response(JSON.stringify({ error: "Message sent but failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update conversation updated_at
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    console.log("Message sent and saved:", insertedMsg.id);

    return new Response(JSON.stringify({ ok: true, message: insertedMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-send-text error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
