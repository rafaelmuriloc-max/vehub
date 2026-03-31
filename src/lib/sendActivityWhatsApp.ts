import { supabase } from '@/integrations/supabase/client';

interface SendActivityWhatsAppParams {
  activity: {
    id: string;
    whatsapp_template_name: string | null;
    whatsapp_message_body: string | null;
  };
  instanceId: string;
  clientId: string;
  obligationName: string;
  referenceMonth: string;
  dueDay?: number | null;
  departmentId?: string;
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(key).join(value);
  }
  return result;
}

export async function sendActivityWhatsApp(params: SendActivityWhatsAppParams): Promise<{ success: boolean; error?: string }> {
  const { activity, instanceId, clientId, obligationName, referenceMonth, dueDay, departmentId } = params;

  if (!activity.whatsapp_template_name && !activity.whatsapp_message_body) {
    return { success: false, error: 'Atividade de WhatsApp sem configuração completa' };
  }

  // Fetch client info
  const { data: client } = await supabase.from('clients').select('company_name, contact_phone').eq('id', clientId).single();

  // Try department-specific contact first
  let recipientPhone = client?.contact_phone || null;
  if (departmentId) {
    const { data: deptContact } = await supabase
      .from('client_department_contacts')
      .select('contact_phone')
      .eq('client_id', clientId)
      .eq('department_id', departmentId)
      .maybeSingle();
    if (deptContact?.contact_phone) {
      recipientPhone = deptContact.contact_phone;
    }
  }

  if (!recipientPhone) {
    return { success: false, error: 'Cliente sem telefone de contato cadastrado' };
  }

  const refDate = new Date(referenceMonth + 'T00:00:00');
  const competencia = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const vencimento = dueDay
    ? new Date(refDate.getFullYear(), refDate.getMonth(), dueDay).toLocaleDateString('pt-BR')
    : '';

  const variables: Record<string, string> = {
    '[Nome_da_Empresa]': client?.company_name || '',
    '[Competencia]': competencia,
    '[Nome_da_Obrigação]': obligationName,
    '[Vencimento]': vencimento,
  };

  // Fetch obligation_id from instance
  const { data: instanceData } = await supabase
    .from('obligation_instances')
    .select('obligation_id')
    .eq('id', instanceId)
    .single();

  // Build request body
  const body: Record<string, unknown> = {
    to: recipientPhone,
    clientId,
    obligationId: instanceData?.obligation_id || null,
    instanceId,
  };

  if (activity.whatsapp_template_name) {
    body.type = 'template';
    body.templateName = activity.whatsapp_template_name;
    body.templateLanguage = 'pt_BR';
  } else {
    body.type = 'text';
    body.text = replaceVariables(activity.whatsapp_message_body!, variables);
  }

  const { data, error } = await supabase.functions.invoke('whatsapp-send', { body });

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
