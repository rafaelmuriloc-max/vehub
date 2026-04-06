import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get responsible contact
    const { data: settings } = await supabase
      .from("company_settings")
      .select("cert_responsible_phone, cert_responsible_name")
      .limit(1)
      .maybeSingle();

    const phone = settings?.cert_responsible_phone;
    if (!phone) {
      console.log("No cert_responsible_phone configured, skipping alert.");
      return new Response(JSON.stringify({ skipped: true, reason: "no phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get active clients with certificate expiry
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("company_name, digital_certificate_expiry")
      .eq("status", "active")
      .not("digital_certificate_expiry", "is", null);

    if (clientsErr) {
      console.error("Error fetching clients:", clientsErr);
      return new Response(JSON.stringify({ error: clientsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // End of week (Sunday)
    const endOfWeek = new Date(today);
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999);

    const expired: { name: string; date: string }[] = [];
    const expiringThisWeek: { name: string; date: string }[] = [];

    for (const c of clients || []) {
      const expiry = new Date(c.digital_certificate_expiry + "T00:00:00");
      const formatted = expiry.toLocaleDateString("pt-BR");

      if (expiry < today) {
        expired.push({ name: c.company_name, date: formatted });
      } else if (expiry <= endOfWeek) {
        expiringThisWeek.push({ name: c.company_name, date: formatted });
      }
    }

    // 3. If nothing to report, skip
    if (expired.length === 0 && expiringThisWeek.length === 0) {
      console.log("No expired or expiring certificates this week.");
      return new Response(JSON.stringify({ skipped: true, reason: "nothing to report" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Build message
    let message = "📋 *Relatório Semanal de Certificados Digitais*\n";

    if (expired.length > 0) {
      message += "\n🔴 *Certificados Vencidos*\n";
      for (const e of expired) {
        message += `• ${e.name} - Vencimento: ${e.date}\n`;
      }
    }

    if (expiringThisWeek.length > 0) {
      message += "\n⚠️ *Certificados que vencem esta semana*\n";
      for (const e of expiringThisWeek) {
        message += `• ${e.name} - Vencimento: ${e.date}\n`;
      }
    }

    message += "\n_Enviado automaticamente toda segunda-feira_";

    // 5. Send via Evolution API
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      console.error("Evolution API not configured");
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evoRes = await fetch(
      `${evolutionUrl}/message/sendText/${evolutionInstance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      }
    );

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error("Evolution API error:", evoRes.status, errText);
      return new Response(JSON.stringify({ error: `Evolution API: ${evoRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Alert sent: ${expired.length} expired, ${expiringThisWeek.length} expiring this week`);

    return new Response(JSON.stringify({
      ok: true,
      expired: expired.length,
      expiringThisWeek: expiringThisWeek.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cert-expiry-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
