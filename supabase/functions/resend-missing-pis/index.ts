import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIS_COFINS_OBLIGATION_ID = "c6359c67-8a38-4f90-8bc6-ec25c25ed126";
const ACTIVITY_DARF_PIS = "8553779a-bcbf-4815-a644-8a8ac8472e03";
const ACTIVITY_ENVIA_DARF_WHATSAPP = "07869e4e-2471-40ee-957b-bbd6d94998ef";
const FISCAL_DEPT = "7403523f-3518-4f8e-b6c3-5f252ced0f34";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const body = await req.json().catch(() => ({}));
  const referenceMonth: string = body.referenceMonth || "2026-05-01";

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")!;
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY")!;
  const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

  // 1) Find instances in PA where PIS file_url exists but no PIS log sent
  const { data: instances, error: instErr } = await supabase
    .from("obligation_instances")
    .select("id, client_id, clients(company_name, contact_phone, contact_name)")
    .eq("obligation_id", PIS_COFINS_OBLIGATION_ID)
    .eq("reference_month", referenceMonth);
  if (instErr) {
    return new Response(JSON.stringify({ error: instErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const inst of instances || []) {
    const instanceId = (inst as any).id;
    const clientId = (inst as any).client_id;
    const company = (inst as any).clients;

    // Get PIS completion (file_url)
    const { data: pisComp } = await supabase
      .from("obligation_activity_completions")
      .select("file_url")
      .eq("instance_id", instanceId)
      .eq("activity_id", ACTIVITY_DARF_PIS)
      .not("file_url", "is", null)
      .maybeSingle();
    if (!pisComp?.file_url) continue;

    // Already sent?
    const { count: sentCount } = await supabase
      .from("whatsapp_logs")
      .select("id", { count: "exact", head: true })
      .eq("instance_id", instanceId)
      .eq("activity_id", ACTIVITY_ENVIA_DARF_WHATSAPP)
      .eq("status", "sent")
      .ilike("media_filename", "%PIS%");
    if ((sentCount || 0) > 0) continue;

    // Recipients: fiscal dept first, else client.contact_phone
    let recipients: { phone: string; name: string }[] = [];
    const { data: deptContacts } = await supabase
      .from("client_department_contacts")
      .select("contact_phone, contact_name")
      .eq("client_id", clientId)
      .eq("department_id", FISCAL_DEPT);
    if (deptContacts && deptContacts.length > 0) {
      recipients = deptContacts
        .filter((d: any) => d.contact_phone)
        .map((d: any) => ({ phone: d.contact_phone, name: d.contact_name || "" }));
    }
    if (recipients.length === 0 && company?.contact_phone) {
      recipients = [{ phone: company.contact_phone, name: company.contact_name || "" }];
    }
    if (recipients.length === 0) {
      results.push({ instanceId, company: company?.company_name, skipped: "sem telefone" });
      continue;
    }

    // Sign URL
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(pisComp.file_url, 604800);
    if (!signed?.signedUrl) {
      results.push({ instanceId, company: company?.company_name, error: "falha ao assinar URL" });
      continue;
    }
    const fileName = pisComp.file_url.split("/").pop() || "darf_pis.pdf";

    let allOk = true;
    for (const r of recipients) {
      let phone = String(r.phone).replace(/\D/g, "");
      if (phone.startsWith("0")) phone = "55" + phone.slice(1);
      if (!phone.startsWith("55")) phone = "55" + phone;

      const evoRes = await fetch(`${evolutionUrl}/message/sendMedia/${evolutionInstance}`, {
        method: "POST",
        headers: { apikey: evolutionKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: phone,
          mediatype: "document",
          mimetype: "application/pdf",
          media: signed.signedUrl,
          fileName,
        }),
      });
      const evoJson = await evoRes.json().catch(() => ({}));
      const ok = evoRes.ok;

      await supabase.from("whatsapp_logs").insert({
        instance_id: instanceId,
        activity_id: ACTIVITY_ENVIA_DARF_WHATSAPP,
        client_id: clientId,
        obligation_id: PIS_COFINS_OBLIGATION_ID,
        recipient_phone: r.phone,
        media_filename: fileName,
        status: ok ? "sent" : "failed",
        error_message: ok ? null : JSON.stringify(evoJson).slice(0, 500),
      });

      if (!ok) allOk = false;
      results.push({
        instanceId,
        company: company?.company_name,
        phone,
        status: ok ? "sent" : "failed",
        error: ok ? undefined : evoJson,
      });
    }

    // Mark "Envia Darf WhatsApp" marker as completed if all ok
    if (allOk) {
      const { data: marker } = await supabase
        .from("obligation_activity_completions")
        .select("id")
        .eq("instance_id", instanceId)
        .eq("activity_id", ACTIVITY_ENVIA_DARF_WHATSAPP)
        .is("file_url", null)
        .maybeSingle();
      const patch = {
        completed: true,
        completed_at: new Date().toISOString(),
        failure_reason: null,
      };
      if (marker) {
        await supabase.from("obligation_activity_completions").update(patch).eq("id", (marker as any).id);
      } else {
        await supabase.from("obligation_activity_completions").insert({
          instance_id: instanceId,
          activity_id: ACTIVITY_ENVIA_DARF_WHATSAPP,
          ...patch,
        });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});