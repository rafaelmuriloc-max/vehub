import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check for EvolutionAPI webhook verification
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

    // EvolutionAPI sends different event types
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
    // Skip messages sent by us
    if (key?.fromMe) {
      console.log("Skipping fromMe message");
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract phone number from remoteJid (e.g. "5511999999999@s.whatsapp.net")
    const remoteJid = key?.remoteJid || "";
    const phoneRaw = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!phoneRaw || phoneRaw.includes("@g.us")) {
      console.log("Skipping group or invalid jid:", remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "group_or_invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message text
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

    // Init Supabase with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Try to find the client by phone number (try multiple formats)
    const phoneSuffixes = [phoneRaw]; // e.g. "5511999999999"
    // Also try without country code
    if (phoneRaw.startsWith("55") && phoneRaw.length >= 12) {
      phoneSuffixes.push(phoneRaw.substring(2)); // "11999999999"
    }
    // Try with formatting patterns
    const formatted: string[] = [];
    for (const p of phoneSuffixes) {
      formatted.push(p);
      // Common formats: (11) 99999-9999, 11999999999, +5511999999999
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

    // Search by any phone format match
    for (const phone of formatted) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, company_name, contact_phone")
        .ilike("contact_phone", `%${phone.replace(/\D/g, "").slice(-9)}%`)
        .limit(1);

      if (clients && clients.length > 0) {
        clientId = clients[0].id;
        clientName = clients[0].company_name;
        break;
      }
    }

    if (!clientId) {
      console.log("No client found for phone:", phoneRaw);
      // Still store the message — create conversation with phone as name
      clientName = `WhatsApp ${phoneRaw}`;
    }

    // Find or create WhatsApp conversation for this client/phone
    let conversationId: string | null = null;

    if (clientId) {
      const { data: existingConv } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("client_id", clientId)
        .ilike("name", "%WhatsApp%")
        .limit(1);

      if (existingConv && existingConv.length > 0) {
        conversationId = existingConv[0].id;
      }
    }

    // Get a system user (first admin) to act as conversation owner for incoming msgs
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    const systemUserId = adminRole?.[0]?.user_id;
    if (!systemUserId) {
      console.error("No admin user found to act as system user");
      return new Response(JSON.stringify({ error: "No system user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversationId) {
      // Create new conversation
      const convName = clientId
        ? `${clientName} (WhatsApp)`
        : `${clientName}`;

      const { data: newConv, error: convErr } = await supabase
        .from("chat_conversations")
        .insert({
          name: convName,
          is_group: false,
          created_by: systemUserId,
          client_id: clientId,
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

      // Add system user as participant
      await supabase.from("chat_participants").insert({
        conversation_id: conversationId,
        user_id: systemUserId,
      });
    }

    // Insert the received message
    // Use systemUserId as sender_id but mark with channel='whatsapp' and a prefix to identify incoming
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

    // Update conversation timestamp
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
