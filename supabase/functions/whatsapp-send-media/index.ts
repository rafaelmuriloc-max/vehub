import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const {
      conversationId,
      type, // 'image' | 'video' | 'document' | 'location' | 'contacts'
      mediaUrl,
      fileName,
      latitude,
      longitude,
      contactName,
      contactPhone,
      senderName,
    } = await req.json();

    if (!conversationId || !type) {
      return new Response(JSON.stringify({ error: "conversationId and type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get conversation
    const { data: conv, error: convErr } = await supabase
      .from("chat_conversations")
      .select("id, whatsapp_phone")
      .eq("id", conversationId)
      .single();

    if (convErr || !conv?.whatsapp_phone) {
      return new Response(JSON.stringify({ error: "Conversation not found or no WhatsApp phone" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawPhone = conv.whatsapp_phone.replace(/\D/g, "");
    const toPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

    // Check 24h window
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentIncoming } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("channel", "whatsapp")
      .eq("message_type", "whatsapp_incoming")
      .gte("created_at", since24h)
      .limit(1);

    const hasOpenWindow = recentIncoming && recentIncoming.length > 0;

    let sendSuccess = false;
    let messageContent = "";
    let messageType = "";
    let messageMediaUrl = mediaUrl || null;

    // Build content text with sender signature
    const VHUB_MARKER = "\u200B\u200B\u200B";
    const signPrefix = senderName ? `*${senderName}:*\n` : "";

    if (type === "image" || type === "video" || type === "document") {
      messageType = `whatsapp_${type}`;
      messageContent = fileName || type;

      if (hasOpenWindow) {
        // Meta API
        const payload: any = {
          messaging_product: "whatsapp",
          to: toPhone,
          type,
          [type]: { link: mediaUrl },
        };
        if (type === "document" && fileName) {
          payload[type].filename = fileName;
        }
        if (type === "image") {
          payload[type].caption = senderName ? `*${senderName}*${VHUB_MARKER}` : VHUB_MARKER;
        }

        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        sendSuccess = metaRes.ok;
        if (!sendSuccess) {
          const errText = await metaRes.text();
          console.error("Meta API error:", errText);
        }
      } else if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
        // Evolution API
        const evoRes = await fetch(
          `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: "POST",
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: toPhone,
              mediatype: type === "document" ? "document" : type,
              media: mediaUrl,
              fileName: fileName || undefined,
              caption: senderName ? `*${senderName}*` : undefined,
            }),
          }
        );
        sendSuccess = evoRes.ok;
        if (!sendSuccess) {
          const errText = await evoRes.text();
          console.error("Evolution API error:", errText);
        }
      }
    } else if (type === "location") {
      messageType = "whatsapp_location";
      messageContent = `${latitude},${longitude}`;

      if (hasOpenWindow) {
        const payload = {
          messaging_product: "whatsapp",
          to: toPhone,
          type: "location",
          location: {
            latitude: String(latitude),
            longitude: String(longitude),
            name: senderName || "Localização",
          },
        };

        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        sendSuccess = metaRes.ok;
      } else if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
        const evoRes = await fetch(
          `${EVOLUTION_API_URL}/message/sendLocation/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: "POST",
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: toPhone,
              latitude,
              longitude,
              name: senderName || "Localização",
            }),
          }
        );
        sendSuccess = evoRes.ok;
      }
    } else if (type === "contacts") {
      messageType = "whatsapp_contact";
      messageContent = `${contactName}|${contactPhone}`;

      const contactPhoneClean = contactPhone.replace(/\D/g, "");

      if (hasOpenWindow) {
        const payload = {
          messaging_product: "whatsapp",
          to: toPhone,
          type: "contacts",
          contacts: [
            {
              name: { formatted_name: contactName, first_name: contactName },
              phones: [{ phone: contactPhoneClean, type: "CELL" }],
            },
          ],
        };

        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        sendSuccess = metaRes.ok;
      } else if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
        const evoRes = await fetch(
          `${EVOLUTION_API_URL}/message/sendContact/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: "POST",
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: toPhone,
              contact: [
                {
                  fullName: contactName,
                  phoneNumber: contactPhoneClean,
                },
              ],
            }),
          }
        );
        sendSuccess = evoRes.ok;
      }
    }

    if (!sendSuccess) {
      return new Response(JSON.stringify({ error: "Failed to send message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find admin user for sender_id
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    const senderId = adminRole?.user_id || "00000000-0000-0000-0000-000000000000";

    // Insert chat message
    const { data: insertedMsg, error: insertErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: messageContent,
        message_type: messageType,
        media_url: messageMediaUrl,
        channel: "whatsapp",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert message error:", insertErr);
    }

    // Update conversation
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(JSON.stringify({ ok: true, message: insertedMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
