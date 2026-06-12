import { corsHeaders, jsonResponse, getSettings, asaasFetch, getServiceClient, onlyDigits } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { entry_id, billing_type } = await req.json();
    if (!entry_id) return jsonResponse({ error: "entry_id required" }, 400);

    const sb = getServiceClient();
    const { env, settings } = await getSettings();

    const { data: entry, error: eErr } = await sb.from("financial_entries").select("*").eq("id", entry_id).maybeSingle();
    if (eErr || !entry) return jsonResponse({ error: "Lançamento não encontrado" }, 404);
    if (!entry.client_id) return jsonResponse({ error: "Lançamento sem cliente vinculado" }, 400);

    // Garante customer
    let { data: ac } = await sb.from("asaas_customers").select("*").eq("client_id", entry.client_id).eq("environment", env).maybeSingle();
    if (!ac) {
      const { data: client } = await sb.from("clients").select("id, company_name, cnpj, email, phone").eq("id", entry.client_id).maybeSingle();
      if (!client) return jsonResponse({ error: "Cliente não encontrado" }, 404);
      const customer = await asaasFetch(env, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: client.company_name,
          cpfCnpj: onlyDigits(client.cnpj),
          email: client.email || undefined,
          phone: onlyDigits(client.phone) || undefined,
        }),
      });
      const ins = await sb.from("asaas_customers").insert({ client_id: entry.client_id, asaas_customer_id: customer.id, environment: env }).select().single();
      ac = ins.data;
    }

    const charge = await asaasFetch(env, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: ac!.asaas_customer_id,
        billingType: billing_type || settings.default_billing_type || "UNDEFINED",
        value: Number(entry.amount),
        dueDate: entry.due_date,
        description: entry.description,
        externalReference: entry.id,
      }),
    });

    // Busca PIX QR Code se aplicável
    let pix: any = null;
    if (charge.billingType === "PIX" || charge.billingType === "UNDEFINED") {
      try { pix = await asaasFetch(env, `/payments/${charge.id}/pixQrCode`, { method: "GET" }); } catch { /* ignore */ }
    }

    await sb.from("asaas_charges").insert({
      entry_id: entry.id,
      client_id: entry.client_id,
      asaas_charge_id: charge.id,
      billing_type: charge.billingType,
      status: charge.status,
      invoice_url: charge.invoiceUrl,
      bank_slip_url: charge.bankSlipUrl,
      pix_qr_code: pix?.encodedImage || null,
      pix_copy_paste: pix?.payload || null,
      value: charge.value,
      due_date: charge.dueDate,
      environment: env,
      raw: charge,
    });

    await sb.from("financial_entries").update({ asaas_charge_id: charge.id }).eq("id", entry.id);

    return jsonResponse({ ok: true, charge, pix });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});