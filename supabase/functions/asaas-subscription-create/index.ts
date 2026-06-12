import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient, onlyDigits } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client_id, value, next_due_date, billing_type, description, cycle } = await req.json();
    if (!client_id || !value || !next_due_date) return jsonResponse({ error: "client_id, value, next_due_date required" }, 400);
    const sb = getServiceClient();
    const { env, settings } = await getSettings();

    let { data: ac } = await sb.from("asaas_customers").select("*").eq("client_id", client_id).eq("environment", env).maybeSingle();
    if (!ac) {
      const { data: client } = await sb.from("clients").select("id, company_name, cnpj, email, phone").eq("id", client_id).maybeSingle();
      if (!client) return jsonResponse({ error: "Cliente nao encontrado" }, 404);
      const customer = await asaasFetch(env, "/customers", { method: "POST", body: JSON.stringify({ name: client.company_name, cpfCnpj: onlyDigits(client.cnpj), email: client.email || undefined, phone: onlyDigits(client.phone) || undefined }) });
      const ins = await sb.from("asaas_customers").insert({ client_id, asaas_customer_id: customer.id, environment: env }).select().single();
      ac = ins.data;
    }

    const sub = await asaasFetch(env, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: ac!.asaas_customer_id,
        billingType: billing_type || settings.default_billing_type || "UNDEFINED",
        value: Number(value),
        nextDueDate: next_due_date,
        cycle: cycle || "MONTHLY",
        description: description || "Mensalidade",
      }),
    });

    await sb.from("asaas_subscriptions").insert({
      client_id, asaas_subscription_id: sub.id, value: sub.value, cycle: sub.cycle,
      billing_type: sub.billingType, next_due_date: sub.nextDueDate, status: sub.status,
      description: sub.description, environment: env, raw: sub,
    });
    return jsonResponse({ ok: true, subscription: sub });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});