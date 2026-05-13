import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let onlyMissing = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      onlyMissing = !!body?.onlyMissing;
    } else {
      onlyMissing = new URL(req.url).searchParams.get("onlyMissing") === "true";
    }
  } catch (_) {}

  let query = supabase
    .from("chat_conversations")
    .select("id, whatsapp_phone, avatar_url")
    .not("whatsapp_phone", "is", null);
  if (onlyMissing) query = query.is("avatar_url", null);

  const { data: convs, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const conv of convs || []) {
    try {
      const res = await fetch(
        `${evolutionUrl}/chat/fetchProfilePictureUrl/${evolutionInstance}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: conv.whatsapp_phone }),
        }
      );
      if (!res.ok) { failed++; continue; }
      const data = await res.json();
      const newUrl: string | null = data?.profilePictureUrl || null;
      if (newUrl && newUrl !== conv.avatar_url) {
        await supabase
          .from("chat_conversations")
          .update({ avatar_url: newUrl })
          .eq("id", conv.id);
        updated++;
      } else {
        unchanged++;
      }
    } catch (_) {
      failed++;
    }
    // small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 80));
  }

  return new Response(
    JSON.stringify({ total: convs?.length || 0, updated, unchanged, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});