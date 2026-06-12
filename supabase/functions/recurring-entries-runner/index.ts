import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/asaas.ts";

function advanceDate(d: string, freq: string, day_of_month: number | null): string {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  if (freq === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else if (freq === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else {
    date.setUTCMonth(date.getUTCMonth() + 1);
    if (day_of_month) {
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day_of_month, lastDay));
    }
  }
  return date.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = getServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: rules } = await sb.from("recurring_entries").select("*").eq("active", true).lte("next_run_date", today);
    let generated = 0;
    for (const r of rules || []) {
      if (r.end_date && r.end_date < today) continue;
      const { error } = await sb.from("financial_entries").insert({
        description: r.description, amount: r.amount, type: r.type, status: "pending",
        due_date: r.next_run_date, category_id: r.category_id, client_id: r.client_id,
        cost_center_id: r.cost_center_id, bank_account_id: r.bank_account_id,
        recurring_id: r.id, created_by: r.created_by,
      });
      if (!error) {
        generated++;
        const next = advanceDate(r.next_run_date, r.frequency, r.day_of_month);
        await sb.from("recurring_entries").update({ next_run_date: next }).eq("id", r.id);
      }
    }
    return jsonResponse({ ok: true, generated });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});