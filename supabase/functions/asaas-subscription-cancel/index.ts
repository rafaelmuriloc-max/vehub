import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { asaas_subscription_id } = await req.json();
    if (!asaas_subscription_id) return jsonResponse({ error: "asaas_subscription_id required" }, 400);
    const sb = getServiceClient();
    const { env } = await getSettings();
    await asaasFetch(env, `/subscriptions/${asaas_subscription_id}`, { method: "DELETE" });
    await sb.from("asaas_subscriptions").update({ status: "CANCELLED" }).eq("asaas_subscription_id", asaas_subscription_id);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});