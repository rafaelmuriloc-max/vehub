import { corsHeaders, jsonResponse, getSettings, asaasFetch } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { env } = await getSettings();
    const result = await asaasFetch(env, "/finance/balance", { method: "GET" });
    return jsonResponse({ ok: true, environment: env, balance: result });
  } catch (e) {
    return jsonResponse({ ok: false, error: (e as Error).message }, 200);
  }
});