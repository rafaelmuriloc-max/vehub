import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient, onlyDigits } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client_id } = await req.json();
    if (!client_id) return jsonResponse({ error: "client_id required" }, 400);

    const sb = getServiceClient();
    const { env } = await getSettings();

    const { data: client, error: cErr } = await sb.from("clients").select("id, company_name, cnpj, email, phone, address, city, state, zip_code").eq("id", client_id).maybeSingle();
    if (cErr || !client) return jsonResponse({ error: "Cliente não encontrado" }, 404);

    const { data: existing } = await sb.from("asaas_customers").select("*").eq("client_id", client_id).eq("environment", env).maybeSingle();

    const body = {
      name: client.company_name,
      cpfCnpj: onlyDigits(client.cnpj),
      email: client.email || undefined,
      phone: onlyDigits(client.phone) || undefined,
      address: client.address || undefined,
      postalCode: onlyDigits(client.zip_code) || undefined,
      province: client.city || undefined,
      state: client.state || undefined,
      notificationDisabled: false,
    };

    let result;
    if (existing?.asaas_customer_id) {
      result = await asaasFetch(env, `/customers/${existing.asaas_customer_id}`, { method: "POST", body: JSON.stringify(body) });
      await sb.from("asaas_customers").update({ synced_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      result = await asaasFetch(env, "/customers", { method: "POST", body: JSON.stringify(body) });
      await sb.from("asaas_customers").insert({ client_id, asaas_customer_id: result.id, environment: env });
    }
    return jsonResponse({ ok: true, customer: result });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});