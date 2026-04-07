import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: convs } = await supabase
    .from("chat_conversations")
    .select("id, whatsapp_phone, name")
    .not("whatsapp_phone", "is", null)
    .is("avatar_url", null)
    .order("updated_at", { ascending: false });

  const results: { id: string; phone: string; avatar: string | null; name: string | null }[] = [];

  for (const conv of convs || []) {
    try {
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

      const profileRes = await fetch(
        `${evolutionUrl}/chat/fetchProfilePictureUrl/${evolutionInstance}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: conv.whatsapp_phone }),
        }
      );

      if (profileRes.ok) {
        const data = await profileRes.json();
        const avatarUrl = data?.profilePictureUrl || null;
        
        if (avatarUrl) {
          await supabase.from("chat_conversations")
            .update({ avatar_url: avatarUrl })
            .eq("id", conv.id);
        }

        results.push({ id: conv.id, phone: conv.whatsapp_phone, avatar: avatarUrl, name: conv.name });
      } else {
        results.push({ id: conv.id, phone: conv.whatsapp_phone, avatar: null, name: conv.name });
      }
    } catch (e) {
      console.error(`Error for ${conv.whatsapp_phone}:`, e);
      results.push({ id: conv.id, phone: conv.whatsapp_phone, avatar: null, name: conv.name });
    }
  }

  const updated = results.filter(r => r.avatar).length;
  return new Response(JSON.stringify({ total: results.length, updated, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
