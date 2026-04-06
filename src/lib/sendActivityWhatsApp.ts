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

  // Prevent duplicate sends within a short window (2 min)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: alreadySent } = await supabase
    .from('whatsapp_logs')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('template_name', activity.whatsapp_template_name || '')
    .eq('status', 'sent')
    .gte('created_at', twoMinutesAgo)
    .limit(1);

  if (alreadySent && alreadySent.length > 0) {
    console.log(`WhatsApp already sent for instance ${instanceId}, activity ${activity.id}, skipping`);
    return { success: true };
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

  // Build shared body/button components once
  const sharedComponents: Record<string, unknown>[] = [];

  if (activity.whatsapp_template_name && activity.whatsapp_template_name.trim()) {
    // Extract {{var}} from message body to build named parameters
    if (activity.whatsapp_message_body) {
      const matches = [...activity.whatsapp_message_body.matchAll(/\{\{(\w+)\}\}/g)];
      if (matches.length > 0) {
        sharedComponents.push({
          type: 'body',
          parameters: matches.map(m => ({
            type: 'text',
            parameter_name: m[1],
            text: templateVars[m[1]] || '',
          })),
        });
      }
    }

    // Button URL param
    if (activity.whatsapp_button_url && activity.whatsapp_button_url.trim()) {
      const buttonValue = hasDocuments ? instanceId : activity.whatsapp_button_url;
      sharedComponents.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: buttonValue }],
      });
    }
  }

  // Determine if we need multi-send (one message per document)
  const needsMultiSend = activity.whatsapp_has_document_header && hasDocuments && attachedDocs && attachedDocs.length > 0
    && activity.whatsapp_template_name && activity.whatsapp_template_name.trim();

  if (needsMultiSend) {
    // Send one message per attached document
    const errors: string[] = [];

    for (const doc of attachedDocs!) {
      const fileUrl = doc.file_url!;
      const filePath = fileUrl.includes('/documents/')
        ? fileUrl.split('/documents/').pop()!
        : fileUrl;
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 604800);

      if (!signedData?.signedUrl) {
        errors.push(`Não foi possível gerar URL para ${filePath}`);
        continue;
      }

      const fileName = filePath.split('/').pop() || 'documento.pdf';
      const components: Record<string, unknown>[] = [
        {
          type: 'header',
          parameters: [{
            type: 'document',
            document: { link: signedData.signedUrl, filename: fileName },
          }],
        },
        ...sharedComponents,
      ];

      const msgBody: Record<string, unknown> = {
        to: recipientPhone,
        clientId,
        obligationId: instanceData?.obligation_id || null,
        instanceId,
        type: 'template',
        templateName: activity.whatsapp_template_name,
        templateLanguage: 'pt_BR',
        ...(components.length > 0 ? { templateParams: components } : {}),
      };

      const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: msgBody });
      if (error) errors.push(error.message);
      else if (data?.error) errors.push(data.error);
    }

    if (errors.length > 0 && errors.length === attachedDocs!.length) {
      return { success: false, error: errors.join('; ') };
    }
  } else {
    // Single message (no document header or text fallback)
    const body: Record<string, unknown> = {
      to: recipientPhone,
      clientId,
      obligationId: instanceData?.obligation_id || null,
      instanceId,
    };

    if (activity.whatsapp_template_name && activity.whatsapp_template_name.trim()) {
      body.type = 'template';
      body.templateName = activity.whatsapp_template_name;
      body.templateLanguage = 'pt_BR';
      if (sharedComponents.length > 0) {
        body.templateParams = sharedComponents;
      }
    } else if (activity.whatsapp_message_body) {
      body.type = 'text';
      body.text = replaceVariables(activity.whatsapp_message_body, variables);
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-send', { body });
    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };
  }

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
