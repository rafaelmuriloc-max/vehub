import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token") || req.headers.get("asaas-access-token");
    const sb = getServiceClient();
    const { data: settings } = await sb.from("asaas_settings").select("webhook_token").limit(1).maybeSingle();
    if (!settings || tokenParam !== settings.webhook_token) {
      return jsonResponse({ error: "Token invalido" }, 401);
    }

    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment;

    const { data: ev } = await sb.from("asaas_webhook_events").insert({ event, payload: body }).select().single();

    try {
      if (payment?.id) {
        await sb.from("asaas_charges").update({
          status: payment.status,
          paid_at: payment.paymentDate ? new Date(payment.paymentDate + "T00:00:00").toISOString() : null,
          raw: payment,
        }).eq("asaas_charge_id", payment.id);

        const newStatus = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status) ? "paid"
          : payment.status === "OVERDUE" ? "overdue"
          : null;
        if (newStatus) {
          await sb.from("financial_entries").update({
            status: newStatus,
            paid_date: newStatus === "paid" ? (payment.paymentDate || new Date().toISOString().split("T")[0]) : null,
          }).eq("asaas_charge_id", payment.id);
        }
      }
      if (ev) await sb.from("asaas_webhook_events").update({ processed: true }).eq("id", ev.id);
    } catch (procErr) {
      if (ev) await sb.from("asaas_webhook_events").update({ error: (procErr as Error).message }).eq("id", ev.id);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});