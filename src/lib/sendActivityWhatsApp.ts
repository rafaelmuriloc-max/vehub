import { supabase } from '@/integrations/supabase/client';

interface SendActivityWhatsAppParams {
  activity: {
    id: string;
    whatsapp_template_name: string | null;
    whatsapp_message_body: string | null;
    whatsapp_button_url?: string | null;
    whatsapp_has_document_header?: boolean;
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
  const { data: client } = await supabase.from('clients').select('company_name, contact_phone, contact_name').eq('id', clientId).single();

  // Fetch company settings for nome_contabilidade
  const { data: companySettings } = await supabase.from('company_settings').select('company_name').limit(1).single();

  // Try department-specific contact first
  let recipientPhone = client?.contact_phone || null;
  let contactName = client?.contact_name || '';
  if (departmentId) {
    const { data: deptContact } = await supabase
      .from('client_department_contacts')
      .select('contact_phone, contact_name')
      .eq('client_id', clientId)
      .eq('department_id', departmentId)
      .maybeSingle();
    if (deptContact?.contact_phone) {
      recipientPhone = deptContact.contact_phone;
    }
    if (deptContact?.contact_name) {
      contactName = deptContact.contact_name;
    }
  }

  if (!recipientPhone) {
    return { success: false, error: 'Cliente sem telefone de contato cadastrado' };
  }

  // Fetch obligation_id from instance
  const { data: instanceData } = await supabase
    .from('obligation_instances')
    .select('obligation_id')
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

  // Variables for [bracket] replacement (text fallback)
  const variables: Record<string, string> = {
    '[Nome_da_Empresa]': client?.company_name || '',
    '[Competencia]': competencia,
    '[Nome_da_Obrigação]': obligationName,
    '[Vencimento]': vencimento,
  };

  // Variables for {{mustache}} replacement (template params)
  const templateVars: Record<string, string> = {
    'tratamento_contato': contactName,
    'nome_contabilidade': companySettings?.company_name || '',
    'cliente': client?.company_name || '',
    'nome_tipo_tarefa': obligationName,
    'nome_da_obrigacao': obligationName,
    'titulo_doc_anexo': obligationName,
    'competencia': competencia,
    'vencimento': vencimento,
  };


  // Check for attached documents in this instance
  const { data: attachedDocs } = await supabase
    .from('obligation_activity_completions')
    .select('file_url')
    .eq('instance_id', instanceId)
    .not('file_url', 'is', null);

  const hasDocuments = attachedDocs && attachedDocs.length > 0;

  // Build request body
  const body: Record<string, unknown> = {
    to: recipientPhone,
    clientId,
    obligationId: instanceData?.obligation_id || null,
    instanceId,
  };

  if (activity.whatsapp_template_name && activity.whatsapp_template_name.trim()) {
    // Template message (required for business-initiated conversations)
    body.type = 'template';
    body.templateName = activity.whatsapp_template_name;
    body.templateLanguage = 'pt_BR';

    const components: Record<string, unknown>[] = [];

    // Only add DOCUMENT header if template has a button URL configured (document-sharing templates)
    if (hasDocuments && attachedDocs && attachedDocs.length > 0 && activity.whatsapp_button_url && activity.whatsapp_button_url.trim()) {
      const firstFileUrl = attachedDocs[0].file_url!;
      const filePath = firstFileUrl.includes('/documents/') 
        ? firstFileUrl.split('/documents/').pop()! 
        : firstFileUrl;
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 604800); // 7 days
      
      if (signedData?.signedUrl) {
        const fileName = filePath.split('/').pop() || 'documento.pdf';
        components.push({
          type: 'header',
          parameters: [{
            type: 'document',
            document: {
              link: signedData.signedUrl,
              filename: fileName,
            },
          }],
        });
      }
    }

    // Extract {{var}} from message body to build named parameters
    if (activity.whatsapp_message_body) {
      const matches = [...activity.whatsapp_message_body.matchAll(/\{\{(\w+)\}\}/g)];
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map(m => ({
            type: 'text',
            parameter_name: m[1],
            text: templateVars[m[1]] || '',
          })),
        });
      }
    }

    // Button URL param (index 0) — only if template has a button (whatsapp_button_url configured)
    if (activity.whatsapp_button_url && activity.whatsapp_button_url.trim()) {
      const buttonValue = hasDocuments ? instanceId : activity.whatsapp_button_url;
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: buttonValue }],
      });
    }

    if (components.length > 0) {
      body.templateParams = components;
    }
  } else if (activity.whatsapp_message_body) {
    // Text fallback (only works within 24h conversation window)
    body.type = 'text';
    body.text = replaceVariables(activity.whatsapp_message_body, variables);
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
