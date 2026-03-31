import { supabase } from '@/integrations/supabase/client';

interface SendActivityEmailParams {
  activity: {
    id: string;
    email_department_id: string | null;
    email_subject: string | null;
    email_body: string | null;
  };
  instanceId: string;
  clientId: string;
  obligationName: string;
  referenceMonth: string;
  dueDay?: number | null;
  /** department_id da obrigação, usado para buscar contato específico */
  departmentId?: string;
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(key).join(value);
  }
  return result;
}

export async function sendActivityEmail(params: SendActivityEmailParams): Promise<{ success: boolean; error?: string }> {
  const { activity, instanceId, clientId, obligationName, referenceMonth, dueDay, departmentId } = params;

  if (!activity.email_department_id || !activity.email_subject || !activity.email_body) {
    return { success: false, error: 'Atividade de e-mail sem configuração completa' };
  }

  // Fetch client info
  const { data: client } = await supabase.from('clients').select('company_name, contact_email').eq('id', clientId).single();

  // Try department-specific contact first
  let recipientEmail = client?.contact_email || null;
  if (departmentId) {
    const { data: deptContact } = await supabase
      .from('client_department_contacts')
      .select('contact_email')
      .eq('client_id', clientId)
      .eq('department_id', departmentId)
      .maybeSingle();
    if (deptContact?.contact_email) {
      recipientEmail = deptContact.contact_email;
    }
  }

  if (!recipientEmail) {
    return { success: false, error: 'Cliente sem e-mail de contato cadastrado' };
  }

  const refDate = new Date(referenceMonth + 'T00:00:00');
  const competencia = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const vencimento = dueDay
    ? new Date(refDate.getFullYear(), refDate.getMonth(), dueDay).toLocaleDateString('pt-BR')
    : '';

  const variables: Record<string, string> = {
    '[Nome_da_Empresa]': client.company_name || '',
    '[Competencia]': competencia,
    '[Nome_da_Obrigação]': obligationName,
    '[Vencimento]': vencimento,
  };

  const finalSubject = replaceVariables(activity.email_subject, variables);
  const finalBody = replaceVariables(activity.email_body, variables);

  // Collect attachments from completed document activities of the same instance
  const { data: fileCompletions } = await supabase
    .from('obligation_activity_completions')
    .select('file_url')
    .eq('instance_id', instanceId)
    .not('file_url', 'is', null);

  const attachments = (fileCompletions || [])
    .filter(fc => fc.file_url)
    .map(fc => ({
      fileUrl: fc.file_url!,
      fileName: fc.file_url!.split('/').pop() || 'attachment',
    }));

  // Fetch obligation_id from instance for logging
  const { data: instanceData } = await supabase
    .from('obligation_instances')
    .select('obligation_id, reference_month')
    .eq('id', instanceId)
    .single();

  // Insert log first to get id for tracking pixel
  const { data: logData } = await supabase.from('email_logs').insert({
    department_id: activity.email_department_id,
    recipient_email: recipientEmail,
    subject: finalSubject,
    body_html: finalBody,
    client_id: clientId,
    obligation_id: instanceData?.obligation_id || null,
    reference_month: referenceMonth,
    status: 'sent',
  }).select('id').single();

  const trackingPixel = logData?.id
    ? `<img src="https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/email-track?id=${logData.id}" width="1" height="1" style="display:none" />`
    : '';

  const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap;">${finalBody}</div>${trackingPixel}`;

  const { data, error } = await supabase.functions.invoke('smtp-send', {
    body: {
      departmentId: activity.email_department_id,
      to: recipientEmail,
      subject: finalSubject,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };

  // Mark activity as completed
  const { data: existing } = await supabase
    .from('obligation_activity_completions')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('activity_id', activity.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('obligation_activity_completions').update({
      completed: true, completed_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('obligation_activity_completions').insert({
      instance_id: instanceId, activity_id: activity.id, completed: true, completed_at: new Date().toISOString(),
    });
  }

  return { success: true };
}
