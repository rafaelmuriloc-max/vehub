import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (key?.fromMe) {
      console.log("Skipping fromMe message");
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = key?.remoteJid || "";
    const phoneRaw = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!phoneRaw || phoneRaw.includes("@g.us")) {
      console.log("Skipping group or invalid jid:", remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "group_or_invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageObj = data.message || {};
    const text =
      messageObj.conversation ||
      messageObj.extendedTextMessage?.text ||
      messageObj.imageMessage?.caption ||
      messageObj.videoMessage?.caption ||
      messageObj.documentMessage?.caption ||
      null;

    if (!text) {
      console.log("No text content in message, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      clientName = pushName ? `${pushName} (WhatsApp)` : `WhatsApp ${phoneRaw}`;
    }

    // Find existing WhatsApp conversation for this client
    let conversationId: string | null = null;

    if (clientId) {
      const { data: existingConv } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("client_id", clientId)
        .limit(1);

      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id;
      } else {
        // Fallback: busca por número no nome (conversa criada antes do vínculo)
        const { data: convByPhone } = await supabase
          .from("chat_conversations")
          .select("id")
          .ilike("name", `%${phoneRaw}%`)
          .limit(1);

        if (convByPhone && convByPhone.length > 0) {
          conversationId = convByPhone[0].id;
          // Vincular client_id e atualizar nome
            await supabase
            .from("chat_conversations")
            .update({ client_id: clientId, name: clientName })
            .eq("id", conversationId);
          console.log("Linked orphan conversation to client:", clientId);
        }
      }
    } else {
      // No client — look for conversation by phone in name
      const { data: existingConv } = await supabase
        .from("chat_conversations")
        .select("id")
        .ilike("name", `%${phoneRaw}%`)
        .limit(1);

      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id;
        // Update name with pushName if available and still has generic phone format
        if (pushName) {
          await supabase
            .from("chat_conversations")
            .update({ name: pushName })
            .eq("id", conversationId)
            .ilike("name", `WhatsApp%`);
        }
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
      const convName = clientId ? clientName : clientName;

      // Fetch WhatsApp profile picture from EvolutionAPI
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
            console.log("Profile picture URL:", avatarUrl);
          }
        }
      } catch (e) {
        console.log("Failed to fetch profile picture:", e);
      }

      const { data: newConv, error: convErr } = await supabase
        .from("chat_conversations")
        .insert({
          name: convName,
          is_group: false,
          created_by: systemUserId,
          client_id: clientId,
          avatar_url: avatarUrl,
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
    } else if (clientId) {
      // Update conversation name if it still has a generic phone-number format
      const { data: existingConvData } = await supabase
        .from("chat_conversations")
        .select("name")
        .eq("id", conversationId)
        .single();

      if (existingConvData?.name && /WhatsApp\s+\d+/.test(existingConvData.name)) {
        await supabase
          .from("chat_conversations")
          .update({ name: clientName })
          .eq("id", conversationId);
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

    // Insert the received message
    const { error: msgErr } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: systemUserId,
      content: text,
      message_type: "whatsapp_incoming",
      channel: "whatsapp",
    });

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

    console.log("Message saved successfully for conversation:", conversationId);

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
