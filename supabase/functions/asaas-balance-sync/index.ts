import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { env } = await getSettings();
    const sb = getServiceClient();
    const balance = await asaasFetch(env, "/finance/balance", { method: "GET" });
    const value = Number(balance?.totalBalance ?? balance?.balance ?? 0);
    await sb.from("bank_accounts").update({ current_balance: value, updated_at: new Date().toISOString() }).eq("is_asaas", true);
    await sb.from("asaas_settings").update({ last_sync_at: new Date().toISOString() }).neq("id", "00000000-0000-0000-0000-000000000000");
    return jsonResponse({ ok: true, balance: value });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});