import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { to, type, templateName, templateLanguage, templateParams, text, clientId, obligationId, instanceId } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: "Campo 'to' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleanPhone = to.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "55" + cleanPhone.slice(1);
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

    let messagePayload: Record<string, unknown>;

    if (type === "template" && templateName && templateName.trim()) {
      messagePayload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage || "pt_BR" },
          ...(templateParams && templateParams.length > 0 ? { components: templateParams } : {}),
        },
      };
    } else {
      messagePayload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: text || "" },
      };
    }

    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta API error:", JSON.stringify(metaData));
      return new Response(
        JSON.stringify({ error: metaData.error?.message || "Erro ao enviar WhatsApp", details: metaData }),
        { status: metaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wamid = metaData.messages?.[0]?.id || null;

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseService.from("whatsapp_logs").insert({
      client_id: clientId || null,
      obligation_id: obligationId || null,
      instance_id: instanceId || null,
      recipient_phone: cleanPhone,
      template_name: templateName || null,
      template_params: templateParams || null,
      body_text: text || null,
      status: "sent",
      wamid,
      sent_by: userId,
    });

    // --- Insert message into chat system ---
    const messageContent = text || (templateName ? `[Template: ${templateName}]` : "Mensagem WhatsApp enviada");

    try {
      if (clientId) {
        // Find existing conversation for this client
        const { data: existingConv } = await supabaseService
          .from("chat_conversations")
          .select("id")
          .eq("client_id", clientId)
          .limit(1)
          .single();

        let conversationId: string;

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: client } = await supabaseService
            .from("clients")
            .select("company_name")
            .eq("id", clientId)
            .single();

          const convName = client?.company_name
            ? `${client.company_name} (WhatsApp)`
            : "WhatsApp";

          const { data: newConv } = await supabaseService
            .from("chat_conversations")
            .insert({
              name: convName,
              is_group: false,
              created_by: userId,
              client_id: clientId,
            })
            .select("id")
            .single();

          if (!newConv) throw new Error("Failed to create conversation");
          conversationId = newConv.id;
        }

        // Add ALL admins as participants
        const { data: adminRoles } = await supabaseService
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        for (const admin of adminRoles || []) {
          const { data: existingPart } = await supabaseService
            .from("chat_participants")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("user_id", admin.user_id)
            .maybeSingle();

          if (!existingPart) {
            await supabaseService.from("chat_participants").insert({
              conversation_id: conversationId,
              user_id: admin.user_id,
            });
          }
        }

        // Ensure sender is also a participant (may not be admin)
        const senderIsAdmin = (adminRoles || []).some(a => a.user_id === userId);
        if (!senderIsAdmin) {
          const { data: senderPart } = await supabaseService
            .from("chat_participants")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("user_id", userId)
            .maybeSingle();

          if (!senderPart) {
            await supabaseService.from("chat_participants").insert({
              conversation_id: conversationId,
              user_id: userId,
            });
          }
        }

        await supabaseService.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: messageContent,
          message_type: "whatsapp",
          channel: "whatsapp",
        });

        await supabaseService
          .from("chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    } catch (chatErr) {
      console.error("Error inserting chat message:", chatErr);
    }

    return new Response(JSON.stringify({ success: true, wamid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
