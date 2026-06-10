import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Job de reconciliação para atividades de envio (WhatsApp/E-mail) que ficaram
 * presas em `in_progress` por falha externa (queda da Evolution, SMTP, etc.).
 *
 * Para cada obligation_instance com status='in_progress':
 *   - Para cada activity do tipo 'whatsapp' sem completion concluída:
 *       - conta destinatários esperados (contatos do departamento ou do cliente)
 *       - conta documentos anexados à instância (file_url em completions)
 *       - se whatsapp_logs.status='sent' já cobre (template + 1 log por doc) × destinatários,
 *         marca a completion como `completed = true` → trigger recalcula status para `done`
 *       - senão, incrementa retry_count e atualiza failure_reason (apenas observação;
 *         o reenvio real é feito pelo frontend quando o usuário reabre a obrigação,
 *         que agora resume a partir dos logs)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Race-safe upsert for the "marker" row (file_url IS NULL).
  // Relies on partial UNIQUE INDEX obligation_activity_completions_unique_marker.
  async function upsertMarker(instanceId: string, activityId: string, fields: Record<string, unknown>) {
    const { data: existing } = await supabase
      .from("obligation_activity_completions")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("activity_id", activityId)
      .is("file_url", null)
      .maybeSingle();
    if (existing) {
      await supabase.from("obligation_activity_completions").update(fields).eq("id", (existing as any).id);
      return;
    }
    const { error } = await supabase.from("obligation_activity_completions").insert({
      instance_id: instanceId,
      activity_id: activityId,
      ...fields,
    });
    if (error && (error as any).code === "23505") {
      const { data: again } = await supabase
        .from("obligation_activity_completions")
        .select("id")
        .eq("instance_id", instanceId)
        .eq("activity_id", activityId)
        .is("file_url", null)
        .maybeSingle();
      if (again) {
        await supabase.from("obligation_activity_completions").update(fields).eq("id", (again as any).id);
      }
    }
  }

  const summary = { scanned: 0, reconciled: 0, stillPending: 0, errors: [] as string[] };

  try {
    // 1) Buscar instâncias in_progress dos últimos 60 dias (escopo seguro)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: instances, error: instErr } = await supabase
      .from("obligation_instances")
      .select("id, client_id, obligation_id, reference_month")
      .eq("status", "in_progress")
      .is("deleted_at", null)
      .gte("reference_month", sixtyDaysAgo);
    if (instErr) throw instErr;

    for (const inst of instances || []) {
      summary.scanned++;

      // 2) Atividades whatsapp/email da obrigação
      const { data: activities } = await supabase
        .from("obligation_activities")
        .select("id, type")
        .eq("obligation_id", inst.obligation_id)
        .in("type", ["whatsapp", "email"]);
      if (!activities || activities.length === 0) continue;

      // 3) Completions atuais
      const { data: completions } = await supabase
        .from("obligation_activity_completions")
        .select("id, activity_id, completed, retry_count, file_url")
        .eq("instance_id", inst.id);

      const completionByActivity = new Map(
        (completions || []).map((c: any) => [c.activity_id, c])
      );
      const docCount = (completions || []).filter((c: any) => c.file_url).length;

      // 4) Departamento da obrigação (para escolher contatos)
      const { data: oblRow } = await supabase
        .from("obligations")
        .select("department_id")
        .eq("id", inst.obligation_id)
        .maybeSingle();
      const departmentId = (oblRow as any)?.department_id;

      // 5) Destinatários esperados
      let recipientCount = 0;
      if (departmentId) {
        const { data: deptContacts } = await supabase
          .from("client_department_contacts")
          .select("contact_phone")
          .eq("client_id", inst.client_id)
          .eq("department_id", departmentId);
        recipientCount = (deptContacts || []).filter((d: any) => d.contact_phone).length;
      }
      if (recipientCount === 0) {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("contact_phone")
          .eq("id", inst.client_id)
          .maybeSingle();
        recipientCount = (clientRow as any)?.contact_phone ? 1 : 0;
      }
      if (recipientCount === 0) continue; // sem destinatário: nada a reconciliar

      for (const act of activities) {
        const comp: any = completionByActivity.get(act.id);
        if (comp?.completed) continue;

        if (act.type === "whatsapp") {
          const expected = (1 + docCount) * recipientCount;
          const { count: sentCount } = await supabase
            .from("whatsapp_logs")
            .select("id", { count: "exact", head: true })
            .eq("instance_id", inst.id)
            .eq("activity_id", act.id)
            .eq("status", "sent");

          if ((sentCount || 0) >= expected) {
            // tudo já saiu — marca como concluída
            await upsertMarker(inst.id, act.id, {
              completed: true,
              completed_at: new Date().toISOString(),
              failure_reason: null,
              notes: comp ? undefined : "auto_reconciled",
            });
            summary.reconciled++;
          } else if (comp) {
            await supabase.from("obligation_activity_completions").update({
              retry_count: (comp.retry_count || 0) + 1,
              last_retry_at: new Date().toISOString(),
              failure_reason: `Aguardando reenvio: ${sentCount || 0}/${expected} mensagens entregues`,
            }).eq("id", comp.id);
            summary.stillPending++;
          }
        } else if (act.type === "email") {
          // E-mail: se houver log de envio bem-sucedido (email_logs.status='sent') para esta
          // instância e atividade, considera concluído. email_logs não tem activity_id, então
          // usamos (client_id, obligation_id, reference_month, status='sent') como prova.
          const { count: emailSent } = await supabase
            .from("email_logs")
            .select("id", { count: "exact", head: true })
            .eq("client_id", inst.client_id)
            .eq("obligation_id", inst.obligation_id)
            .eq("reference_month", inst.reference_month)
            .eq("status", "sent");

          if ((emailSent || 0) >= 1) {
            await upsertMarker(inst.id, act.id, {
              completed: true,
              completed_at: new Date().toISOString(),
              failure_reason: null,
              notes: comp ? undefined : "auto_reconciled",
            });
            summary.reconciled++;
          } else if (comp) {
            await supabase.from("obligation_activity_completions").update({
              retry_count: (comp.retry_count || 0) + 1,
              last_retry_at: new Date().toISOString(),
              failure_reason: "E-mail ainda não enviado",
            }).eq("id", comp.id);
            summary.stillPending++;
          }
        }
      }
    }
  } catch (e) {
    summary.errors.push(String((e as Error).message || e));
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});