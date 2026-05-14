import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INACTIVITY_THRESHOLD_MIN = 30;
const CLOSE_AFTER_ALERT_MIN = 5;

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function getHolidaySet(year: number): Set<string> {
  const easter = getEasterDate(year);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const add = (d: Date, n: number) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  return new Set([
    `${year}-01-01`,
    fmt(add(easter, -47)),
    fmt(add(easter, -2)),
    fmt(easter),
    `${year}-04-21`,
    `${year}-05-01`,
    fmt(add(easter, 60)),
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
  ]);
}

function nowInTz(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = parseInt(parts.hour) * 60 + parseInt(parts.minute);
  return { date, dow: dowMap[parts.weekday] ?? 0, minutes };
}

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return parseInt(h) * 60 + parseInt(m || "0");
}

function isBusinessHours(settings: any): { ok: boolean; reason?: string } {
  const tz = settings?.service_timezone || "America/Sao_Paulo";
  const { date, dow, minutes } = nowInTz(tz);
  if (dow === 0 || dow === 6) return { ok: false, reason: "weekend" };
  const year = parseInt(date.slice(0, 4));
  if (getHolidaySet(year).has(date)) return { ok: false, reason: "holiday" };
  if (settings?.service_hours_enabled) {
    const open = timeToMinutes(settings.service_open_time);
    const close = timeToMinutes(settings.service_close_time);
    const lunchStart = timeToMinutes(settings.service_lunch_start);
    const lunchEnd = timeToMinutes(settings.service_lunch_end);
    if (open !== null && close !== null && (minutes < open || minutes >= close)) {
      return { ok: false, reason: "off_hours" };
    }
    if (lunchStart !== null && lunchEnd !== null && minutes >= lunchStart && minutes < lunchEnd) {
      return { ok: false, reason: "lunch" };
    }
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("company_settings")
      .select("chat_alert_whatsapp_group_id, service_hours_enabled, service_open_time, service_close_time, service_lunch_start, service_lunch_end, service_timezone")
      .limit(1)
      .maybeSingle();

    const groupId = settings?.chat_alert_whatsapp_group_id?.trim();
    const business = isBusinessHours(settings);

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    const now = Date.now();
    const inactivityThresholdIso = new Date(now - INACTIVITY_THRESHOLD_MIN * 60_000).toISOString();

    // Fetch open + assigned conversations
    const { data: convs, error } = await supabase
      .from("chat_conversations")
      .select("id, name, whatsapp_phone, client_id, assigned_to, last_inactivity_alert_at, updated_at")
      .eq("status", "open")
      .not("assigned_to", "is", null);

    if (error) throw error;

    let alerted = 0;
    let closed = 0;
    let cancelled = 0;

    for (const c of convs || []) {
      // Last message in this conversation
      const { data: lastMsg } = await supabase
        .from("chat_messages")
        .select("created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastMsgAt = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : new Date(c.updated_at).getTime();
      const alertAt = c.last_inactivity_alert_at ? new Date(c.last_inactivity_alert_at).getTime() : null;

      // ---- Phase 2: close-check ----
      if (alertAt && now - alertAt >= CLOSE_AFTER_ALERT_MIN * 60_000) {
        if (lastMsgAt <= alertAt) {
          // Still inactive → close
          await supabase
            .from("chat_conversations")
            .update({ status: "closed", closed_at: new Date().toISOString(), last_inactivity_alert_at: null })
            .eq("id", c.id);
          closed++;
        } else {
          // New activity arrived → cancel pending close
          await supabase
            .from("chat_conversations")
            .update({ last_inactivity_alert_at: null })
            .eq("id", c.id);
          cancelled++;
        }
        continue;
      }

      // ---- Phase 1: send alert ----
      // Only send during business hours; outside business hours → close silently
      if (lastMsgAt > now - INACTIVITY_THRESHOLD_MIN * 60_000) continue;
      if (alertAt) continue; // already alerted, waiting for close-check window

      if (!business.ok) {
        // Outside business hours → close ticket without sending notice
        await supabase
          .from("chat_conversations")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", c.id);
        closed++;
        continue;
      }

      if (!groupId || !evolutionUrl || !evolutionApiKey || !evolutionInstance) continue;

      // Resolve names
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", c.assigned_to)
        .maybeSingle();

      let companyName = "—";
      if (c.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("company_name")
          .eq("id", c.client_id)
          .maybeSingle();
        if (client?.company_name) companyName = client.company_name;
      }

      const inactiveMin = Math.floor((now - lastMsgAt) / 60_000);
      const contact = c.name || c.whatsapp_phone || "—";
      const text = `*Chamado sem atividade*\n\n👤 Atendente: ${profile?.full_name || "—"}\n📞 Contato: ${contact}\n🏢 Empresa: ${companyName}\n⏱️ Inatividade: ${inactiveMin} min\n\nSeu chamado será fechado por tempo de inatividade.`;

      try {
        const res = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({ number: groupId, text }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("Evolution send failed", res.status, body);
          continue;
        }
        await supabase
          .from("chat_conversations")
          .update({ last_inactivity_alert_at: new Date().toISOString() })
          .eq("id", c.id);
        alerted++;
      } catch (e) {
        console.error("Send error for conv", c.id, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: convs?.length ?? 0, alerted, closed, cancelled, business }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("chat-inactivity-monitor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});