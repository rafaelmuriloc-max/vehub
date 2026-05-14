import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_TEXT = `*Atenção ao atendimentos*

Revise todos os chamados em aberto e feche os que já foram resolvidos.

Não deixem chamados abertos de um dia para o outro.

Atenciosamente
CEO`;

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
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, dow: dowMap[parts.weekday] ?? 0 };
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
      .select("chat_alert_whatsapp_group_id, service_timezone")
      .limit(1)
      .maybeSingle();

    const groupId = settings?.chat_alert_whatsapp_group_id?.trim();
    if (!groupId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_group_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tz = settings?.service_timezone || "America/Sao_Paulo";
    const { date, dow } = nowInTz(tz);

    if (dow === 0 || dow === 6) {
      return new Response(JSON.stringify({ ok: true, skipped: "weekend", date }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const year = parseInt(date.slice(0, 4));
    if (getHolidaySet(year).has(date)) {
      return new Response(JSON.stringify({ ok: true, skipped: "holiday", date }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const res = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify({ number: groupId, text: REMINDER_TEXT }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Evolution send failed", res.status, body);
      return new Response(JSON.stringify({ ok: false, status: res.status, body }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: true, date }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-cs-reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});