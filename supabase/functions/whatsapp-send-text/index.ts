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
    const VHUB_MARKER = "\u200B\u200B\u200B";
    const { conversationId, text, senderName, senderId: senderIdInput } = await req.json();
    const signedText = senderName ? `*${senderName}:*\n${text}${VHUB_MARKER}` : `${text}${VHUB_MARKER}`;

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
    let waMessageId: string | null = null;
    let metaPhoneDigits = "";

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
      metaPhoneDigits = metaPhone;

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

      const metaJson = await metaRes.json().catch(() => ({} as any));
      if (metaRes.ok) {
        sendSuccess = true;
        waMessageId = metaJson?.messages?.[0]?.id ?? null;
        console.log("Meta API send success, wamid:", waMessageId);
      } else {
        sendError = `Meta API error: ${metaRes.status} ${JSON.stringify(metaJson)}`;
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

      let evoPhone = phone.replace(/\D/g, "");
      if (!evoPhone.startsWith("55")) evoPhone = "55" + evoPhone;
      metaPhoneDigits = evoPhone;

      const evoRes = await fetch(
        `${evolutionUrl}/message/sendText/${evolutionInstance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionApiKey,
          },
          body: JSON.stringify({
            number: evoPhone,
            text: signedText,
          }),
        }
      );

      const evoJson = await evoRes.json().catch(() => ({} as any));
      if (evoRes.ok) {
        sendSuccess = true;
        waMessageId = evoJson?.key?.id ?? null;
        console.log("Evolution API send success, key.id:", waMessageId);
      } else {
        sendError = `Evolution API error: ${evoRes.status} ${JSON.stringify(evoJson)}`;
        console.error(sendError);
      }
    }

    if (!sendSuccess) {
      return new Response(JSON.stringify({ error: sendError || "Failed to send message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use caller's user_id when provided; fallback to first admin
    // Priority: JWT (auth.uid) > body senderId > first admin
    let senderId = "";
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabase.auth.getUser(jwt);
        if (userData?.user?.id) senderId = userData.user.id;
      } catch (e) {
        console.error("getUser failed:", e);
      }
    }
    if (!senderId) senderId = senderIdInput || "";
    if (!senderId) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1);
      senderId = adminRoles?.[0]?.user_id || "";
      if (!senderId) {
        return new Response(JSON.stringify({ error: "No admin user found" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    console.log("Resolved senderId:", senderId);

    // Insert message into chat_messages
    const { data: insertedMsg, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: text,
        message_type: "whatsapp_outgoing",
        channel: "whatsapp",
        wa_message_id: waMessageId,
        wa_remote_jid: metaPhoneDigits ? `${metaPhoneDigits}@s.whatsapp.net` : null,
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
