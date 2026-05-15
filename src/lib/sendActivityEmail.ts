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

function formatCnpj(raw?: string | null): string {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}

function replaceVariables(text: string, variables: Record<string, string>, mustache?: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(key).join(value);
  }
  if (mustache) {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(mustache)) lower[k.toLowerCase()] = v ?? '';
    result = result.replace(/\{\{\s*([\w_]+)\s*\}\}/gi, (_m, name) => {
      const v = lower[String(name).toLowerCase()];
      return v === undefined ? '' : v;
    });
  }
  return result;
}

export async function sendActivityEmail(params: SendActivityEmailParams): Promise<{ success: boolean; error?: string }> {
  const { activity, instanceId, clientId, obligationName, referenceMonth, dueDay, departmentId } = params;

  if (!activity.email_department_id || !activity.email_subject || !activity.email_body) {
    return { success: false, error: 'Atividade de e-mail sem configuração completa' };
  }

  // Fetch client info
  const { data: client } = await supabase.from('clients').select('company_name, contact_email, cnpj').eq('id', clientId).single();

  // Try department-specific contacts first (multiple allowed)
  let recipientEmails: string[] = [];
  if (departmentId) {
    const { data: deptContacts } = await supabase
      .from('client_department_contacts')
      .select('contact_email')
      .eq('client_id', clientId)
      .eq('department_id', departmentId);
    recipientEmails = (deptContacts || [])
      .map((d: any) => (d.contact_email || '').trim())
      .filter((e: string) => !!e);
  }
  if (recipientEmails.length === 0 && client?.contact_email) {
    recipientEmails = [client.contact_email];
  }
  if (recipientEmails.length === 0) {
    return { success: false, error: 'Cliente sem e-mail de contato cadastrado' };
  }
  const recipientEmail = recipientEmails.join(', ');

  // Fetch obligation_id from instance for logging
  const { data: instanceData } = await supabase
    .from('obligation_instances')
    .select('obligation_id, reference_month')
    .eq('id', instanceId)
    .single();

  // Fetch competence_rule from obligation
  let competenceRule = 'current';
  if (instanceData?.obligation_id) {
    const { data: oblData } = await supabase.from('obligations').select('competence_rule').eq('id', instanceData.obligation_id).single();
    if ((oblData as any)?.competence_rule) competenceRule = (oblData as any).competence_rule;
  }

  const refDate = new Date(referenceMonth + 'T00:00:00');
  const competenceDate = competenceRule === 'previous' ? new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1) : refDate;
  const competencia = competenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const vencimento = dueDay
    ? new Date(refDate.getFullYear(), refDate.getMonth(), dueDay).toLocaleDateString('pt-BR')
    : '';

  const variables: Record<string, string> = {
    '[Nome_da_Empresa]': client.company_name || '',
    '[Competencia]': competencia,
    '[Nome_da_Obrigação]': obligationName,
    '[Vencimento]': vencimento,
  };

  // Current user (responsavel) for {{responsavel}}
  let responsavel = '';
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('user_id', u.user.id).maybeSingle();
      responsavel = (prof as any)?.full_name || '';
    }
  } catch { /* ignore */ }

  const mustacheVars: Record<string, string> = {
    cliente: client.company_name || '',
    cnpj: formatCnpj((client as any).cnpj),
    tarefa: obligationName,
    vencimento,
    descricao: '',
    responsavel,
    data_hoje: new Date().toLocaleDateString('pt-BR'),
    competencia,
  };

  const finalSubject = replaceVariables(activity.email_subject, variables, mustacheVars);
  const finalBody = replaceVariables(activity.email_body, variables, mustacheVars);

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

  // Get current user's name for sender
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  let senderName: string | undefined;
  if (currentUser) {
    const { data: profileData } = await supabase.from('profiles').select('full_name').eq('user_id', currentUser.id).single();
    senderName = profileData?.full_name || undefined;
  }

  const { data, error } = await supabase.functions.invoke('smtp-send', {
    body: {
      departmentId: activity.email_department_id,
      to: recipientEmail,
      subject: finalSubject,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      senderName,
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
