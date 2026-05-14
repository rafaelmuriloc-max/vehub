import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
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
  if (normalized.length === 13 && normalized.startsWith("55") && normalized[4] === "9") {
    variants.add(normalized.slice(0, 4) + normalized.slice(5));
  }
  return [...variants];
}

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
    const { to, type, templateName, templateLanguage, templateParams, text, chatPreview, clientId, obligationId, instanceId, mediaUrl, mediaType, mediaFilename } = await req.json();

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
      const VHUB_MARKER = "\u200B\u200B\u200B";
      messagePayload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: (text || "") + VHUB_MARKER },
      };
    }

    console.log("WhatsApp payload:", JSON.stringify(messagePayload));

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
    console.log("Meta response status:", metaResponse.status, "body:", JSON.stringify(metaData));

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
    const messageContent = text || chatPreview || (templateName ? `[Template: ${templateName}]` : "Mensagem WhatsApp enviada");

    try {
      if (clientId) {
        const phoneVariants = getPhoneVariants(cleanPhone);
        const canonicalPhone = normalizePhone(cleanPhone);

        // 1. Try by whatsapp_phone first (avoids duplicates for same phone across clients)
        const { data: convByPhone } = await supabaseService
          .from("chat_conversations")
          .select("id, client_id, whatsapp_phone")
          .in("whatsapp_phone", phoneVariants)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let conversationId: string;

        if (convByPhone) {
          // Upgrade phone to canonical format if needed
          if (convByPhone.whatsapp_phone !== canonicalPhone) {
            await supabaseService.from("chat_conversations").update({ whatsapp_phone: canonicalPhone }).eq("id", convByPhone.id);
          }
          conversationId = convByPhone.id;
        } else {
          // 2. Fallback: by client_id
          const { data: existingConv } = await supabaseService
            .from("chat_conversations")
            .select("id")
            .eq("client_id", clientId)
            .limit(1)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
          } else {
            const { data: client } = await supabaseService
              .from("clients")
              .select("company_name, contact_name")
              .eq("id", clientId)
              .single();

            const displayName = client?.contact_name || client?.company_name;
            const convName = displayName || "WhatsApp";

            // Fetch avatar from EvolutionAPI before creating conversation
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
                    body: JSON.stringify({ number: canonicalPhone }),
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

            const { data: newConv } = await supabaseService
              .from("chat_conversations")
              .insert({
                name: convName,
                is_group: false,
                created_by: userId,
                client_id: clientId,
                whatsapp_phone: canonicalPhone,
                avatar_url: avatarUrl,
              })
              .select("id")
              .single();

            if (!newConv) throw new Error("Failed to create conversation");
            conversationId = newConv.id;
          }
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

        const hasMedia = !!(mediaUrl && mediaType);
        await supabaseService.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: hasMedia ? (mediaFilename || messageContent) : messageContent,
          message_type: hasMedia ? `whatsapp_${mediaType}` : "whatsapp",
          media_url: hasMedia ? mediaUrl : null,
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
