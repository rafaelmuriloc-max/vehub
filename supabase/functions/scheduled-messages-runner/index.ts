import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Sao_Paulo";

/* ===== Holidays (BR national) ===== */
function getEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}
function holidaysFor(year: number): Set<string> {
  const e = getEaster(year);
  return new Set([
    `${year}-01-01`,
    ymd(addDaysUTC(e, -47)),
    ymd(addDaysUTC(e, -2)),
    ymd(e),
    `${year}-04-21`,
    `${year}-05-01`,
    ymd(addDaysUTC(e, 60)),
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
  ]);
}
function isWeekendUTC(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}
function previousBusinessDayUTC(d: Date): Date {
  let cur = d;
  for (let i = 0; i < 10; i++) {
    const h = holidaysFor(cur.getUTCFullYear());
    if (!isWeekendUTC(cur) && !h.has(ymd(cur))) return cur;
    cur = addDaysUTC(cur, -1);
  }
  return cur;
}

/* ===== BRT time helpers ===== */
function nowInBRT(): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

/* ===== Recurrence: should this schedule fire today? ===== */
function shouldFireToday(sched: any, today: Date): boolean {
  // today is in UTC representing the calendar date in BRT
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const weekday = today.getUTCDay();

  const baseFireDay = (): number | null => {
    switch (sched.recurrence) {
      case "daily": return day;
      case "weekly": return sched.weekly_day != null && Number(sched.weekly_day) === weekday ? day : null;
      case "monthly": return Number(sched.monthly_day) || null;
      case "quarterly": {
        if (![1, 4, 7, 10].includes(month)) return null;
        return Number(sched.monthly_day) || 1;
      }
      case "yearly": {
        if (Number(sched.annual_month) !== month) return null;
        return Number(sched.monthly_day) || 1;
      }
      case "custom_months": {
        const list: number[] = Array.isArray(sched.custom_months) ? sched.custom_months.map(Number) : [];
        if (!list.includes(month)) return null;
        return Number(sched.monthly_day) || 1;
      }
    }
    return null;
  };

  const targetDay = baseFireDay();
  if (targetDay == null) return false;

  // Compute target date in this month then anticipate
  let target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.min(targetDay, 28)));
  // Use real day; clamp to month length
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), Math.min(targetDay, lastDay)));

  if (sched.recurrence === "weekly" || sched.recurrence === "daily") {
    // For weekly/daily, "today" already matched; antecipation does not move across days
    return true;
  }

  if (sched.anticipate_weekend) {
    target = previousBusinessDayUTC(target);
  }
  return ymd(target) === ymd(today);
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function pickValidBrazilianWhatsAppPhone(raw: string | null | undefined): { phone: string | null; error?: string; candidates: string[] } {
  const text = String(raw || "").trim();
  if (!text) return { phone: null, error: "Sem telefone", candidates: [] };

  const parts = text
    .split(/(?:\s*[/;,|]\s*|\s+ou\s+|\s+e\s+)/i)
    .map((part) => part.replace(/\D/g, ""))
    .filter(Boolean);

  const fallbackDigits = text.replace(/\D/g, "");
  const candidates = (parts.length ? parts : [fallbackDigits]).filter(Boolean);

  for (let digits of candidates) {
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("55")) digits = digits.slice(2);

    // Brasil: DDD (2) + fixo (8) ou celular (9). Rejeita números fictícios/incompletos.
    if (!/^\d{10,11}$/.test(digits)) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (/^\d{2}0{8,9}$/.test(digits)) continue;

    const ddd = Number(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) continue;

    return { phone: `55${digits}`, candidates };
  }

  return { phone: null, error: `Telefone inválido para WhatsApp: ${text}`, candidates };
}

function describeApiError(payload: any): string {
  const message = payload?.response?.message ?? payload?.message ?? payload?.error;
  if (Array.isArray(message)) {
    return message.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("; ");
  }
  if (message && typeof message === "object") return JSON.stringify(message);
  if (message) return String(message);
  return JSON.stringify(payload);
}

/* ===== Client selection ===== */
async function resolveClients(supabase: any, sched: any): Promise<any[]> {
  if (sched.assignment_mode === "all") {
    const { data } = await supabase.from("clients").select("id, company_name, contact_phone").eq("status", "active");
    return data || [];
  }
  if (sched.assignment_mode === "manual") {
    const { data: links } = await supabase
      .from("scheduled_message_clients").select("client_id").eq("scheduled_message_id", sched.id);
    const ids = (links || []).map((l: any) => l.client_id);
    if (!ids.length) return [];
    const { data } = await supabase.from("clients").select("id, company_name, contact_phone").in("id", ids);
    return data || [];
  }
  if (sched.assignment_mode === "segment") {
    const f = sched.segment_filters || {};
    let q = supabase.from("clients").select("id, company_name, contact_phone, tax_regime, payroll_type, address").eq("status", "active");
    if (Array.isArray(f.tax_regimes) && f.tax_regimes.length) q = q.in("tax_regime", f.tax_regimes);
    if (f.payroll_type) q = q.eq("payroll_type", f.payroll_type);
    const { data } = await q;
    let list = data || [];
    if (f.city) {
      const city = String(f.city).toLowerCase();
      list = list.filter((c: any) => (c.address || "").toLowerCase().includes(city));
    }
    return list;
  }
  return [];
}

/* ===== Ensure WA conversation for phone ===== */
async function ensureConversation(supabase: any, client: any, deptPhone: string | null, deptContactName: string | null, adminId: string): Promise<string | null> {
  const phone = (deptPhone || client.contact_phone || "").replace(/\D/g, "");
  if (!phone) return null;
  const normalized = phone.startsWith("55") ? phone : `55${phone}`;
  const { data: existing } = await supabase
    .from("chat_conversations").select("id").eq("whatsapp_phone", normalized).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created } = await supabase.from("chat_conversations").insert({
    name: deptContactName || client.company_name,
    whatsapp_phone: normalized,
    client_id: client.id,
    created_by: adminId,
    status: "open",
  }).select("id").single();
  return created?.id || null;
}

/* ===== Send via WhatsApp (Meta first, Evolution fallback) ===== */
async function sendWhatsAppMessage(opts: {
  phone: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}): Promise<{ ok: boolean; waId: string | null; error?: string }> {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const evoUrl = Deno.env.get("EVOLUTION_API_URL");
  const evoKey = Deno.env.get("EVOLUTION_API_KEY");
  const evoInst = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  const VHUB_MARKER = "\u200B\u200B\u200B";
  const signed = `*Agendador:*\n${opts.text}${VHUB_MARKER}`;

  // Scheduled messages are outside a guaranteed 24h window → prefer Evolution.
  if (evoUrl && evoKey && evoInst) {
    try {
      // Always send text first
      const rt = await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: opts.phone, text: signed }),
      });
      const jt = await rt.json().catch(() => ({} as any));
      if (!rt.ok) {
        return { ok: false, waId: null, error: `Evolution text ${rt.status}: ${describeApiError(jt)}` };
      }
      const textWaId = jt?.key?.id ?? null;

      if (!opts.attachmentUrl) {
        return { ok: true, waId: textWaId };
      }

      // Then send media WITHOUT caption, with retry/backoff
      const ext = (opts.attachmentName || opts.attachmentUrl || "").split(".").pop()?.toLowerCase() || "";
      const isImage = /^(jpe?g|png|gif|webp)$/.test(ext) || (opts.attachmentMime || "").startsWith("image/");
      const isVideo = /^(mp4|mov|webm)$/.test(ext) || (opts.attachmentMime || "").startsWith("video/");
      const mediatype = isImage ? "image" : isVideo ? "video" : "document";
      const fallbackName = `arquivo${ext ? "." + ext : ""}`;
      const mediaPayload = {
        number: opts.phone,
        mediatype,
        mimetype: opts.attachmentMime || (mediatype === "image" ? "image/jpeg" : "application/octet-stream"),
        media: opts.attachmentUrl,
        fileName: opts.attachmentName || fallbackName,
      };

      const delays = [0, 2000, 5000];
      let lastErr = "";
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        const rm = await fetch(`${evoUrl}/message/sendMedia/${evoInst}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify(mediaPayload),
        });
        const jm = await rm.json().catch(() => ({} as any));
        if (rm.ok) return { ok: true, waId: jm?.key?.id ?? textWaId };
        lastErr = `Evolution media ${rm.status}: ${describeApiError(jm)}`;
      }
      return { ok: false, waId: null, error: lastErr };
    } catch (e) {
      return { ok: false, waId: null, error: `Evolution exception: ${String(e)}` };
    }
  }

  // Fallback to Meta (will only succeed inside 24h)
  if (accessToken && phoneNumberId) {
    try {
      // Text first
      const rt = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to: opts.phone, type: "text", text: { body: signed } }),
      });
      const jt = await rt.json().catch(() => ({} as any));
      if (!rt.ok) return { ok: false, waId: null, error: `Meta text ${rt.status}: ${describeApiError(jt)}` };
      const textWaId = jt?.messages?.[0]?.id ?? null;
      if (!opts.attachmentUrl) return { ok: true, waId: textWaId };

      const isImage = (opts.attachmentMime || "").startsWith("image/");
      const type = isImage ? "image" : "document";
      const mediaBody: any = {
        messaging_product: "whatsapp",
        to: opts.phone,
        type,
        [type]: {
          link: opts.attachmentUrl,
          ...(opts.attachmentName ? { filename: opts.attachmentName } : {}),
        },
      };
      const delays = [0, 2000, 5000];
      let lastErr = "";
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        const rm = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(mediaBody),
        });
        const jm = await rm.json().catch(() => ({} as any));
        if (rm.ok) return { ok: true, waId: jm?.messages?.[0]?.id ?? textWaId };
        lastErr = `Meta media ${rm.status}: ${describeApiError(jm)}`;
      }
      return { ok: false, waId: null, error: lastErr };
    } catch (e) {
      return { ok: false, waId: null, error: `Meta exception: ${String(e)}` };
    }
  }
  return { ok: false, waId: null, error: "No WhatsApp channel configured" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional ?id=<uuid> to manually fire a single schedule (for testing)
  const url = new URL(req.url);
  const forceId = url.searchParams.get("id");

  const brt = nowInBRT();
  const todayUTC = new Date(Date.UTC(brt.year, brt.month - 1, brt.day));

  // Window: fire if send_time is within last 30 min (cron runs every 15 min)
  const minutesNow = brt.hour * 60 + brt.minute;

  let q = supabase.from("scheduled_messages").select("*").eq("active", true);
  if (forceId) q = q.eq("id", forceId);
  const { data: schedules, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // First admin (fallback sender_id)
  const { data: adminRow } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
  const adminId = adminRow?.user_id || "00000000-0000-0000-0000-000000000000";

  const results: any[] = [];

  for (const sched of schedules || []) {
    try {
      if (!forceId) {
        if (sched.start_date && ymd(todayUTC) < sched.start_date) continue;
        if (sched.end_date && ymd(todayUTC) > sched.end_date) continue;
        if (!shouldFireToday(sched, todayUTC)) continue;
        // Time check
        const [hh, mm] = String(sched.send_time || "09:00").split(":").map(Number);
        const targetMinutes = hh * 60 + mm;
        const diff = minutesNow - targetMinutes;
        // Fire only at the configured minute; tolerate up to 2 min of cron latency.
        if (diff < 0 || diff > 2) continue;
      }

      // Idempotency: one run per (schedule, day)
      const runIso = new Date(Date.UTC(brt.year, brt.month - 1, brt.day, 12, 0, 0)).toISOString();
      const { data: existingRun } = await supabase
        .from("scheduled_message_runs")
        .select("id")
        .eq("scheduled_message_id", sched.id)
        .eq("run_at", runIso)
        .maybeSingle();
      let run: { id: string } | null = null;
      let retryFailedOnly = false;
      let alreadySentIds = new Set<string>();
      let alreadySkippedIds = new Set<string>();
      let failedDeliveryIds: string[] = [];

      if (existingRun) {
        run = existingRun as any;
        // Check failed deliveries to reprocess
        const { data: prev } = await supabase
          .from("scheduled_message_deliveries")
          .select("id, client_id, status")
          .eq("run_id", existingRun.id);
        for (const d of prev || []) {
          if (d.status === "sent") alreadySentIds.add(d.client_id);
          else if (d.status === "skipped") alreadySkippedIds.add(d.client_id);
          else if (d.status === "failed") failedDeliveryIds.push(d.id);
        }
        if (!forceId && failedDeliveryIds.length === 0) {
          results.push({ id: sched.id, skipped: "already_ran_today" });
          continue;
        }
        retryFailedOnly = true;
      } else {
        const { data: created, error: runErr } = await supabase
          .from("scheduled_message_runs")
          .insert({ scheduled_message_id: sched.id, run_at: runIso, status_summary: {} })
          .select("id").single();
        if (runErr || !created) {
          results.push({ id: sched.id, error: runErr?.message || "run insert failed" });
          continue;
        }
        run = created;
      }

      let clients = await resolveClients(supabase, sched);
      if (retryFailedOnly) {
        // Only clients with failed deliveries; delete those rows so they get reinserted
        const { data: failedRows } = await supabase
          .from("scheduled_message_deliveries")
          .select("client_id")
          .in("id", failedDeliveryIds);
        const retryIds = new Set((failedRows || []).map((r: any) => r.client_id));
        clients = clients.filter((c: any) => retryIds.has(c.id));
        if (failedDeliveryIds.length) {
          await supabase.from("scheduled_message_deliveries").delete().in("id", failedDeliveryIds);
        }
      }
      let sent = 0, failed = 0, skipped = 0;

      // Department contact map
      const clientIds = clients.map((c: any) => c.id);
      const { data: deptContacts } = clientIds.length
        ? await supabase
            .from("client_department_contacts")
            .select("client_id, contact_name, contact_phone")
            .eq("department_id", sched.department_id)
            .in("client_id", clientIds)
        : { data: [] as any[] };
      const contactMap = new Map<string, { name: string | null; phone: string | null }>();
      for (const c of deptContacts || []) contactMap.set(c.client_id, { name: c.contact_name, phone: c.contact_phone });

      const { data: dept } = await supabase.from("departments").select("name").eq("id", sched.department_id).maybeSingle();

      for (const client of clients) {
        const contact = contactMap.get(client.id);
        const phoneRaw = (contact?.phone || client.contact_phone || "").replace(/\D/g, "");
        if (!phoneRaw) {
          await supabase.from("scheduled_message_deliveries").insert({
            run_id: run.id, client_id: client.id, status: "skipped", error: "Sem telefone",
          });
          skipped++;
          continue;
        }
        const phone = phoneRaw.startsWith("55") ? phoneRaw : `55${phoneRaw}`;

        const convId = await ensureConversation(supabase, client, phone, contact?.name || null, adminId);
        if (!convId) {
          await supabase.from("scheduled_message_deliveries").insert({
            run_id: run.id, client_id: client.id, status: "failed", error: "Falha ao criar conversa",
          });
          failed++;
          continue;
        }

        const text = renderTemplate(sched.message_body || "", {
          cliente: client.company_name || "",
          departamento: dept?.name || "",
          data: `${String(brt.day).padStart(2, "0")}/${String(brt.month).padStart(2, "0")}/${brt.year}`,
        });

        const send = await sendWhatsAppMessage({
          phone,
          text,
          attachmentUrl: sched.attachment_url,
          attachmentName: sched.attachment_name,
          attachmentMime: sched.attachment_mime,
        });

        if (!send.ok) {
          await supabase.from("scheduled_message_deliveries").insert({
            run_id: run.id, client_id: client.id, status: "failed", error: send.error || "send failed",
          });
          failed++;
          continue;
        }

        const msgType = sched.attachment_url
          ? ((sched.attachment_mime || "").startsWith("image/") ? "whatsapp_image"
             : (sched.attachment_mime || "").startsWith("video/") ? "whatsapp_video"
             : "whatsapp_document")
          : "whatsapp_outgoing";

        const { data: chatMsg } = await supabase.from("chat_messages").insert({
          conversation_id: convId,
          sender_id: adminId,
          content: sched.attachment_url ? (sched.attachment_name || text) : text,
          message_type: msgType,
          channel: "whatsapp",
          media_url: sched.attachment_url || null,
          wa_message_id: send.waId,
          wa_evolution_id: send.waId && !send.waId.startsWith("wamid.") ? send.waId : null,
          wa_remote_jid: `${phone}@s.whatsapp.net`,
          agent_name: "Agendador",
        }).select("id").single();

        await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

        await supabase.from("scheduled_message_deliveries").insert({
          run_id: run.id, client_id: client.id, status: "sent", chat_message_id: chatMsg?.id || null,
        });
        sent++;

        await new Promise(r => setTimeout(r, 600));
      }

      const totalSent = sent + alreadySentIds.size;
      const totalSkipped = skipped + alreadySkippedIds.size;
      const totalAll = totalSent + totalSkipped + failed;
      await supabase.from("scheduled_message_runs")
        .update({ status_summary: { sent: totalSent, failed, skipped: totalSkipped, total: totalAll } })
        .eq("id", run.id);
      await supabase.from("scheduled_messages").update({ last_run_at: new Date().toISOString() }).eq("id", sched.id);

      results.push({ id: sched.id, sent: totalSent, failed, skipped: totalSkipped, retried: retryFailedOnly });
    } catch (e) {
      console.error("schedule error", sched.id, e);
      results.push({ id: sched.id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});