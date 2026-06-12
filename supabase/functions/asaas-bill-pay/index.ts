import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { entry_id, bar_code, pix_qr_code, scheduled_date, description } = await req.json();
    if (!entry_id) return jsonResponse({ error: "entry_id required" }, 400);
    if (!bar_code && !pix_qr_code) return jsonResponse({ error: "bar_code ou pix_qr_code obrigatorio" }, 400);
    const sb = getServiceClient();
    const { env } = await getSettings();

    const { data: entry } = await sb.from("financial_entries").select("*").eq("id", entry_id).maybeSingle();
    if (!entry) return jsonResponse({ error: "Lancamento nao encontrado" }, 404);

    let result: any;
    if (bar_code) {
      result = await asaasFetch(env, "/bill", {
        method: "POST",
        body: JSON.stringify({
          identificationField: bar_code,
          scheduleDate: scheduled_date || entry.due_date,
          description: description || entry.description,
          dueDate: entry.due_date,
          value: Number(entry.amount),
        }),
      });
    } else {
      result = await asaasFetch(env, "/transfers", {
        method: "POST",
        body: JSON.stringify({
          pixAddressKey: pix_qr_code,
          pixAddressKeyType: "EVP",
          value: Number(entry.amount),
          description: description || entry.description,
        }),
      });
    }

    await sb.from("bill_payments").insert({
      entry_id, asaas_payment_id: result.id, bar_code: bar_code || null,
      pix_qr_code: pix_qr_code || null, description: description || entry.description,
      value: Number(entry.amount), due_date: entry.due_date,
      scheduled_date: scheduled_date || entry.due_date,
      status: result.status || "PENDING", environment: env, raw: result,
    });

    return jsonResponse({ ok: true, payment: result });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});