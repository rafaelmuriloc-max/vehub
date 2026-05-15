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
      senderId: senderIdInput,
      replyToMessageId,
      isForwarded,
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

    // Reply target lookup
    let replySnapshot: any = null;
    let replyMetaWamid: string | null = null;
    let replyEvolutionId: string | null = null;
    if (replyToMessageId) {
      const { data: replyMsg } = await supabase
        .from("chat_messages")
        .select("id, sender_id, content, message_type, media_url, wa_message_id, wa_evolution_id")
        .eq("id", replyToMessageId)
        .maybeSingle();
      if (replyMsg) {
        const wamid = replyMsg.wa_message_id || null;
        replyMetaWamid = wamid && wamid.startsWith("wamid.") ? wamid : null;
        replyEvolutionId = replyMsg.wa_evolution_id
          || (wamid && !wamid.startsWith("wamid.") ? wamid : null);
        let senderFullName = "";
        if (replyMsg.sender_id) {
          const { data: prof } = await supabase
            .from("profiles").select("full_name").eq("user_id", replyMsg.sender_id).maybeSingle();
          senderFullName = prof?.full_name || "";
        }
        replySnapshot = {
          sender_id: replyMsg.sender_id,
          sender_name: senderFullName,
          content: replyMsg.content,
          message_type: replyMsg.message_type,
          media_url: replyMsg.media_url,
        };
      }
    }
    const metaContext = replyMetaWamid ? { context: { message_id: replyMetaWamid } } : {};

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
    const evoQuoted = replyEvolutionId
      ? { quoted: { key: { id: replyEvolutionId, remoteJid: `${toPhone}@s.whatsapp.net`, fromMe: !!replyMetaWamid } } }
      : {};

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
    // If reply target lacks a Meta wamid, force Evolution path so the quote
    // appears on the contact's WhatsApp.
    const forceEvolutionForReply = !!(replyToMessageId && !replyMetaWamid && replyEvolutionId);

    let sendSuccess = false;
    let sendErrorDetail = "";
    let messageContent = "";
    let messageType = "";
    let messageMediaUrl = mediaUrl || null;
    let waMessageId: string | null = null;

    const captureWaId = async (res: Response, label: string): Promise<string> => {
      const json = await res.json().catch(() => ({} as any));
      if (res.ok) {
        waMessageId = json?.key?.id ?? json?.messages?.[0]?.id ?? waMessageId;
        return "";
      }
      return `${label} ${res.status}: ${JSON.stringify(json)}`;
    };

    // Build content text with sender signature
    const VHUB_MARKER = "\u200B\u200B\u200B";
    const signPrefix = senderName ? `*${senderName}:*\n` : "";

    // Helper: derive mimetype from fileName / type
    const guessMime = (): string => {
      const ext = (fileName || mediaUrl || "").split(".").pop()?.toLowerCase() || "";
      const map: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
        mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
        pdf: "application/pdf", doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        zip: "application/zip", txt: "text/plain",
      };
      if (map[ext]) return map[ext];
      if (type === "image") return "image/jpeg";
      if (type === "video") return "video/mp4";
      return "application/octet-stream";
    };

    if (type === "image" || type === "video" || type === "document") {
      messageType = `whatsapp_${type}`;
      messageContent = fileName || type;

      if (hasOpenWindow && !forceEvolutionForReply) {
        // Meta API
        const payload: any = {
          messaging_product: "whatsapp",
          to: toPhone,
          type,
          [type]: { link: mediaUrl },
          ...metaContext,
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
        { const _err = await captureWaId(metaRes, "Meta API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
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
              mimetype: guessMime(),
              media: mediaUrl,
              fileName: fileName || undefined,
              caption: senderName ? `*${senderName}*${VHUB_MARKER}` : VHUB_MARKER,
              ...evoQuoted,
            }),
          }
        );
        { const _err = await captureWaId(evoRes, "Evolution API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
      } else {
        sendErrorDetail = "No send channel available (no 24h window and Evolution API not configured)";
        console.error(sendErrorDetail);
      }
    } else if (type === "audio") {
      messageType = "whatsapp_audio";
      messageContent = fileName || "audio";

      // Prefer Evolution API for audio: Meta API rejects audio/webm;codecs=opus
      // produced by browser MediaRecorder. Evolution converts to PTT-compatible ogg.
      const audioExt = (fileName || mediaUrl || "").split(".").pop()?.toLowerCase() || "";
      const isMetaCompatible = ["ogg", "mp3", "m4a", "aac", "amr"].includes(audioExt);
      const useEvolutionForAudio = !!(EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) && !isMetaCompatible;

      if (useEvolutionForAudio) {
        console.log("Sending audio via Evolution API (browser format)");
        const evoRes = await fetch(
          `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: "POST",
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: toPhone,
              audio: mediaUrl,
              ...evoQuoted,
            }),
          }
        );
        { const _err = await captureWaId(evoRes, "Evolution API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
      } else if (hasOpenWindow) {
        const payload = {
          messaging_product: "whatsapp",
          to: toPhone,
          type: "audio",
          audio: { link: mediaUrl },
          ...metaContext,
        };
        console.log("Sending audio via Meta API");
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
        { const _err = await captureWaId(metaRes, "Meta API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
      } else if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
        const evoRes = await fetch(
          `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE_NAME}`,
          {
            method: "POST",
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: toPhone,
              audio: mediaUrl,
              ...evoQuoted,
            }),
          }
        );
        { const _err = await captureWaId(evoRes, "Evolution API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
      } else {
        sendErrorDetail = "No send channel available for audio";
        console.error(sendErrorDetail);
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
          ...metaContext,
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
        { const _err = await captureWaId(metaRes, "Meta API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
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
              address: `${latitude}, ${longitude}`,
            }),
          }
        );
        { const _err = await captureWaId(evoRes, "Evolution API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
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
          ...metaContext,
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
        { const _err = await captureWaId(metaRes, "Meta API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
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
        { const _err = await captureWaId(evoRes, "Evolution API"); sendSuccess = !_err; if (_err) sendErrorDetail = _err; }
      }
    }

    if (!sendSuccess) {
      return new Response(JSON.stringify({ error: sendErrorDetail || "Failed to send message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();
      senderId = adminRole?.user_id || "00000000-0000-0000-0000-000000000000";
    }
    console.log("Resolved senderId:", senderId);

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
        wa_message_id: waMessageId,
        wa_evolution_id: waMessageId && !waMessageId.startsWith("wamid.") ? waMessageId : null,
        wa_remote_jid: `${toPhone}@s.whatsapp.net`,
        reply_to_id: replyToMessageId || null,
        reply_to_snapshot: replySnapshot,
        is_forwarded: !!isForwarded,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert message error:", insertErr);
    }

    // Fire-and-forget audio transcription
    if (!insertErr && insertedMsg?.id && messageType === "whatsapp_audio") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/whatsapp-transcribe-audio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ message_id: insertedMsg.id }),
        }).catch((e) => console.error("transcribe trigger failed:", e));
      } catch (e) {
        console.error("transcribe trigger sync error:", e);
      }
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
