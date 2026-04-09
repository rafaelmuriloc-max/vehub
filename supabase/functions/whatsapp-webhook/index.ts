import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Normalize Brazilian phone: ensure 13 digits (55 + 2-digit DDD + 9 + 8 digits)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // 12 digits: 55 + DD + 8 digits → insert 9 after DDD if local part starts with [6-9]
  if (digits.length === 12 && digits.startsWith("55")) {
    const localFirst = digits[4];
    if (["6","7","8","9"].includes(localFirst)) {
      return digits.slice(0, 4) + "9" + digits.slice(4);
    }
  }
  return digits;
}

function getPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const normalized = normalizePhone(digits);
  const variants = new Set<string>();
  variants.add(digits);
  variants.add(normalized);
  // Also add 12-digit variant (without the 9)
  if (normalized.length === 13 && normalized.startsWith("55") && normalized[4] === "9") {
    variants.add(normalized.slice(0, 4) + normalized.slice(5));
  }
  return [...variants];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload).substring(0, 500));

    const event = payload.event;
    if (event !== "messages.upsert") {
      console.log("Ignoring event:", event);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;
    if (!data) {
      return new Response(JSON.stringify({ error: "No data in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = data.key;
    const isFromMe = !!key?.fromMe;

    const remoteJid = key?.remoteJid || "";
    const phoneRaw = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!phoneRaw || phoneRaw.includes("@g.us")) {
      console.log("Skipping group or invalid jid:", remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "group_or_invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageObj = data.message || {};

    // Detect message type and extract text/caption
    let text: string | null = null;
    let messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_incoming";
    let mediaKey: string | null = null; // which media type key to use

    if (messageObj.conversation) {
      text = messageObj.conversation;
    } else if (messageObj.extendedTextMessage?.text) {
      text = messageObj.extendedTextMessage.text;
    } else if (messageObj.imageMessage) {
      text = messageObj.imageMessage.caption || "";
      messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_image";
      mediaKey = "imageMessage";
    } else if (messageObj.videoMessage) {
      text = messageObj.videoMessage.caption || "";
      messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_video";
      mediaKey = "videoMessage";
    } else if (messageObj.audioMessage) {
      text = "";
      messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_audio";
      mediaKey = "audioMessage";
    } else if (messageObj.documentMessage) {
      text = messageObj.documentMessage.caption || messageObj.documentMessage.fileName || "";
      messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_document";
      mediaKey = "documentMessage";
    } else if (messageObj.stickerMessage) {
      text = "";
      messageType = isFromMe ? "whatsapp_outgoing" : "whatsapp_image";
      mediaKey = "stickerMessage";
    }

    // Skip messages originated from vhub (contain invisible marker)
    const VHUB_MARKER = "\u200B\u200B\u200B";
    if (isFromMe && text !== null && text.includes(VHUB_MARKER)) {
      console.log("Skipping vhub-originated message (marker detected)");
      return new Response(JSON.stringify({ ok: true, skipped: "vhub_origin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no recognizable content at all, skip
    if (text === null) {
      console.log("No recognizable message content, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_content" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Download media if applicable
    let mediaUrl: string | null = null;
    if (mediaKey) {
      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
        const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

        if (evolutionUrl && evolutionApiKey && evolutionInstance) {
          console.log("Downloading media via EvolutionAPI...");
          const mediaRes = await fetch(
            `${evolutionUrl}/chat/getBase64FromMediaMessage/${evolutionInstance}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
              body: JSON.stringify({ message: { key, message: messageObj } }),
            }
          );

          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            const base64 = mediaData.base64;
            const mimetype = mediaData.mimetype || "application/octet-stream";
            const fileName = mediaData.fileName || `media_${Date.now()}`;

            if (base64) {
              // Determine file extension
              const extMap: Record<string, string> = {
                "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/mpeg": "mp3",
                "video/mp4": "mp4", "application/pdf": "pdf",
                "image/gif": "gif",
              };
              const ext = extMap[mimetype] || fileName.split(".").pop() || "bin";
              const storagePath = `chat-media/${phoneRaw}_${Date.now()}.${ext}`;

              // Convert base64 to Uint8Array
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }

              const { error: uploadErr } = await supabase.storage
                .from("chat-media")
                .upload(storagePath, bytes, { contentType: mimetype, upsert: false });

              if (uploadErr) {
                console.error("Storage upload error:", uploadErr);
              } else {
                const { data: pubUrl } = supabase.storage
                  .from("chat-media")
                  .getPublicUrl(storagePath);
                mediaUrl = pubUrl?.publicUrl || null;
                console.log("Media uploaded:", mediaUrl);
              }
            }
          } else {
            console.log("EvolutionAPI media download failed:", mediaRes.status);
          }
        }
      } catch (e) {
        console.error("Error downloading media:", e);
      }
    }

    // Find client by phone
    const phoneSuffixes = [phoneRaw];
    if (phoneRaw.startsWith("55") && phoneRaw.length >= 12) {
      phoneSuffixes.push(phoneRaw.substring(2));
    }
    const formatted: string[] = [];
    for (const p of phoneSuffixes) {
      formatted.push(p);
      if (p.length === 11) {
        formatted.push(`(${p.substring(0, 2)}) ${p.substring(2, 7)}-${p.substring(7)}`);
        formatted.push(`+55${p}`);
      }
      if (p.length === 13 && p.startsWith("55")) {
        formatted.push(`+${p}`);
      }
    }

    let clientId: string | null = null;
    let clientName = "Cliente";
    const pushName = data.pushName || null;

    for (const phone of formatted) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, company_name, contact_name, contact_phone")
        .ilike("contact_phone", `%${phone.replace(/\D/g, "").slice(-9)}%`)
        .limit(1);

      if (clients && clients.length > 0) {
        clientId = clients[0].id;
        clientName = clients[0].contact_name || clients[0].company_name;
        break;
      }
    }

    if (!clientId) {
      console.log("No client found for phone:", phoneRaw);
      clientName = pushName || `WhatsApp ${phoneRaw}`;
    }

    // === Find existing conversation by whatsapp_phone FIRST ===
    let conversationId: string | null = null;

    const phoneVariants = getPhoneVariants(phoneRaw);
    const canonicalPhone = normalizePhone(phoneRaw);

    const { data: convByPhone } = await supabase
      .from("chat_conversations")
      .select("id, client_id, status, whatsapp_phone")
      .in("whatsapp_phone", phoneVariants)
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (convByPhone && convByPhone.length > 0) {
      conversationId = convByPhone[0].id;
      const updates: Record<string, unknown> = {};
      if (clientId && !convByPhone[0].client_id) {
        updates.client_id = clientId;
      }
      // Always prefer pushName for conversation name
      if (pushName) {
        updates.name = pushName;
      }
      // Upgrade phone to canonical format
      if (convByPhone[0].whatsapp_phone !== canonicalPhone) {
        updates.whatsapp_phone = canonicalPhone;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("chat_conversations").update(updates).eq("id", conversationId);
      }
    }

    // Fallback: search by client_id
    if (!conversationId && clientId) {
      const { data: existingConv } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("client_id", clientId)
        .limit(1);

      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id;
        await supabase
          .from("chat_conversations")
          .update({ whatsapp_phone: canonicalPhone })
          .eq("id", conversationId);
      }
    }

    // Get ALL admin users
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const systemUserId = adminRoles?.[0]?.user_id;
    if (!systemUserId) {
      console.error("No admin user found to act as system user");
      return new Response(JSON.stringify({ error: "No system user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversationId) {
      let avatarUrl: string | null = null;
      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
        if (evolutionUrl && evolutionKey && evolutionInstance) {
          const profileRes = await fetch(
            `${evolutionUrl}/chat/fetchProfilePictureUrl/${evolutionInstance}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionKey },
              body: JSON.stringify({ number: phoneRaw }),
            }
          );
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            avatarUrl = profileData?.profilePictureUrl || null;
          }
        }
      } catch (e) {
        console.log("Failed to fetch profile picture:", e);
      }

      const { data: newConv, error: convErr } = await supabase
        .from("chat_conversations")
        .insert({
          name: pushName || clientName,
          is_group: false,
          created_by: systemUserId,
          client_id: clientId,
          avatar_url: avatarUrl,
          whatsapp_phone: canonicalPhone,
        })
        .select("id")
        .single();

      if (convErr || !newConv) {
        console.error("Error creating conversation:", convErr);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      conversationId = newConv.id;
    } else {
      // Existing conversation — check if avatar or name needs updating
      const { data: existingConvData } = await supabase
        .from("chat_conversations")
        .select("name, avatar_url")
        .eq("id", conversationId)
        .single();

      // Fetch avatar if missing
      if (existingConvData && !existingConvData.avatar_url) {
        try {
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
          const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
          if (evolutionUrl && evolutionKey && evolutionInstance) {
            const profileRes = await fetch(
              `${evolutionUrl}/chat/fetchProfilePictureUrl/${evolutionInstance}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evolutionKey },
                body: JSON.stringify({ number: phoneRaw }),
              }
            );
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              const avatarUrl = profileData?.profilePictureUrl || null;
              if (avatarUrl) {
                await supabase.from("chat_conversations").update({ avatar_url: avatarUrl }).eq("id", conversationId);
                console.log("Updated avatar for existing conversation:", conversationId);
              }
            }
          }
        } catch (e) {
          console.log("Failed to fetch profile picture for existing conv:", e);
        }
      }

      // Update name: prefer pushName, fallback to clientName for generic names
      if (pushName && existingConvData?.name !== pushName) {
        await supabase.from("chat_conversations").update({ name: pushName }).eq("id", conversationId);
      } else if (clientId && existingConvData?.name && /WhatsApp\s+\d+/.test(existingConvData.name)) {
        await supabase.from("chat_conversations").update({ name: clientName }).eq("id", conversationId);
      }
    }

    // Add ALL admins as participants
    for (const admin of adminRoles || []) {
      const { data: existing } = await supabase
        .from("chat_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", admin.user_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("chat_participants").insert({
          conversation_id: conversationId,
          user_id: admin.user_id,
        });
      }
    }

    // Deduplication for fromMe messages (avoid duplicating messages sent from our chat UI)
    if (isFromMe) {
      const tenSecsAgo = new Date(Date.now() - 10000).toISOString();
      const { data: duplicates } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("content", text || "")
        .eq("channel", "whatsapp")
        .gte("created_at", tenSecsAgo)
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        console.log("Skipping duplicate fromMe message");
        return new Response(JSON.stringify({ ok: true, skipped: "duplicate_fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert the message
    const insertData: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: systemUserId,
      content: text || "",
      message_type: messageType,
      channel: "whatsapp",
    };
    if (mediaUrl) {
      insertData.media_url = mediaUrl;
    }

    const { error: msgErr } = await supabase.from("chat_messages").insert(insertData);

    if (msgErr) {
      console.error("Error inserting message:", msgErr);
      return new Response(JSON.stringify({ error: "Failed to insert message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    console.log("Message saved successfully for conversation:", conversationId, "type:", messageType);

    return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
