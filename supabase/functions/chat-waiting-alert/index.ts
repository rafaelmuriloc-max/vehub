import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_THRESHOLD_MIN = 10;

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

/** Returns {date: 'YYYY-MM-DD', dow: 0-6 (Sun=0), minutes: minutes since midnight} in given tz */
function nowInTz(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("company_settings")
      .select("chat_alert_whatsapp_group_id, service_hours_enabled, service_open_time, service_close_time, service_lunch_start, service_lunch_end, service_timezone")
      .limit(1)
      .maybeSingle();

    const groupId = settings?.chat_alert_whatsapp_group_id?.trim();
    if (!groupId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_group_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce business hours / weekdays / holidays
    const tz = settings?.service_timezone || "America/Sao_Paulo";
    const { date, dow, minutes } = nowInTz(tz);

    if (dow === 0 || dow === 6) {
      return new Response(JSON.stringify({ ok: true, skipped: "weekend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const year = parseInt(date.slice(0, 4));
    if (getHolidaySet(year).has(date)) {
      return new Response(JSON.stringify({ ok: true, skipped: "holiday" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (settings?.service_hours_enabled) {
      const open = timeToMinutes(settings.service_open_time);
      const close = timeToMinutes(settings.service_close_time);
      const lunchStart = timeToMinutes(settings.service_lunch_start);
      const lunchEnd = timeToMinutes(settings.service_lunch_end);
      if (open !== null && close !== null && (minutes < open || minutes >= close)) {
        return new Response(JSON.stringify({ ok: true, skipped: "off_hours" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lunchStart !== null && lunchEnd !== null && minutes >= lunchStart && minutes < lunchEnd) {
        return new Response(JSON.stringify({ ok: true, skipped: "lunch" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thresholdIso = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();

    const { data: convs, error } = await supabase
      .from("chat_conversations")
      .select("id, name, whatsapp_phone, waiting_since, last_wait_alert_at")
      .eq("status", "open")
      .is("assigned_to", null)
      .not("waiting_since", "is", null)
      .lte("waiting_since", thresholdIso);

    if (error) throw error;

    const due = (convs || []).filter((c: any) => {
      if (!c.last_wait_alert_at) return true;
      return new Date(c.last_wait_alert_at).getTime() <= Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000;
    });

    let sent = 0;
    for (const c of due) {
      const minutes = Math.floor((Date.now() - new Date(c.waiting_since).getTime()) / 60000);
      const label = c.name || c.whatsapp_phone || "Conversa";
      const phoneLine = c.whatsapp_phone ? `\n📱 ${c.whatsapp_phone}` : "";
      const text = `⚠️ *Atendimento em espera*\n\n👤 ${label}${phoneLine}\n⏱️ Aguardando há *${minutes} min* sem atribuição.\n\nEntre no V-Hub para atender.`;

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
          .update({ last_wait_alert_at: new Date().toISOString() })
          .eq("id", c.id);
        sent++;
      } catch (e) {
        console.error("Send error for conv", c.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: convs?.length ?? 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-waiting-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});