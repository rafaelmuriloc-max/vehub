const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `${evolutionUrl}/group/fetchAllGroups/${evolutionInstance}?getParticipants=false`,
      {
        method: "GET",
        headers: { apikey: evolutionApiKey },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Evolution API error:", res.status, errText);
      return new Response(
        JSON.stringify({ groups: [], error: `Evolution API ${res.status}`, transient: res.status >= 500 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groups = await res.json();

    const simplified = (Array.isArray(groups) ? groups : []).map((g: any) => ({
      id: g.id || g.jid || g.remoteJid,
      name: g.subject || g.name || g.id,
    }));

    return new Response(JSON.stringify(simplified), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("evolution-list-groups error:", err);
    return new Response(
      JSON.stringify({ groups: [], error: String(err), transient: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
