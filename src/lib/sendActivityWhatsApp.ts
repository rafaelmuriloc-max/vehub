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
  const { data: client } = await supabase.from('clients').select('company_name, contact_phone, contact_name, document').eq('id', clientId).single();

  // Fetch company settings for nome_contabilidade
  const { data: companySettings } = await supabase.from('company_settings').select('company_name').limit(1).single();

  // Try department-specific contacts first (multiple allowed)
  let recipients: { phone: string; name: string }[] = [];
  if (departmentId) {
    const { data: deptContacts } = await supabase
      .from('client_department_contacts')
      .select('contact_phone, contact_name')
      .eq('client_id', clientId)
      .eq('department_id', departmentId);
    recipients = (deptContacts || [])
      .filter((d: any) => d.contact_phone)
      .map((d: any) => ({ phone: d.contact_phone, name: d.contact_name || '' }));
  }
  if (recipients.length === 0 && client?.contact_phone) {
    recipients = [{ phone: client.contact_phone, name: client.contact_name || '' }];
  }
  if (recipients.length === 0) {
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

  let responsavel = '';
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('user_id', u.user.id).maybeSingle();
      responsavel = (prof as any)?.full_name || '';
    }
  } catch { /* ignore */ }

  const mustacheVars: Record<string, string> = {
    cliente: client?.company_name || '',
    cnpj: formatCnpj((client as any)?.document),
    tarefa: obligationName,
    vencimento,
    descricao: '',
    responsavel,
    data_hoje: new Date().toLocaleDateString('pt-BR'),
    competencia,
  };

  // Check for attached documents in this instance
  const { data: attachedDocs } = await supabase
    .from('obligation_activity_completions')
    .select('file_url')
    .eq('instance_id', instanceId)
    .not('file_url', 'is', null);

  const hasDocuments = !!(attachedDocs && attachedDocs.length > 0);

  const buildSharedComponents = (contactName: string) => {
    const templateVars: Record<string, string> = {
      'tratamento_contato': contactName || client?.company_name || 'Prezado(a)',
      'nome_contabilidade': companySettings?.company_name || 'Contabilidade',
      'cliente': client?.company_name || 'Cliente',
      'nome_tipo_tarefa': obligationName || 'Obrigação',
      'nome_da_obrigacao': obligationName || 'Obrigação',
      'titulo_doc_anexo': obligationName || 'Documento',
      'competencia': competencia || '-',
      'vencimento': vencimento || '-',
    };
    const sharedComponents: Record<string, unknown>[] = [];
    let chatPreview = '';
    if (activity.whatsapp_template_name && activity.whatsapp_template_name.trim()) {
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
        chatPreview = activity.whatsapp_message_body.replace(
          /\{\{(\w+)\}\}/g,
          (_: string, name: string) => templateVars[name] ?? ''
        );
      }
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
    return { sharedComponents, chatPreview };
  };

  // Pre-resolve signed URLs for all attached documents (Evolution will fetch them)
  const signedDocs: { url: string; fileName: string }[] = [];
  if (hasDocuments) {
    for (const doc of attachedDocs!) {
      const fileUrl = doc.file_url!;
      const filePath = fileUrl.includes('/documents/')
        ? fileUrl.split('/documents/').pop()!
        : fileUrl;
      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 604800);
      if (signedData?.signedUrl) {
        signedDocs.push({
          url: signedData.signedUrl,
          fileName: filePath.split('/').pop() || 'documento.pdf',
        });
      }
    }
  }

  const allErrors: string[] = [];
  let anySuccess = false;

  for (const recipient of recipients) {
    const { sharedComponents, chatPreview } = buildSharedComponents(recipient.name);
    const recipientPhone = recipient.phone;

    // 1) Send Meta template (text-only — never with document header)
    const templateBody: Record<string, unknown> = {
      to: recipientPhone,
      clientId,
      obligationId: instanceData?.obligation_id || null,
      instanceId,
    };
    if (activity.whatsapp_template_name && activity.whatsapp_template_name.trim()) {
      templateBody.type = 'template';
      templateBody.templateName = activity.whatsapp_template_name;
      templateBody.templateLanguage = 'pt_BR';
      if (sharedComponents.length > 0) templateBody.templateParams = sharedComponents;
      if (chatPreview) templateBody.chatPreview = chatPreview;
    } else if (activity.whatsapp_message_body) {
      templateBody.type = 'text';
      templateBody.text = replaceVariables(activity.whatsapp_message_body, variables, mustacheVars);
    }
    const { data: tplData, error: tplErr } = await supabase.functions.invoke('whatsapp-send', { body: templateBody });
    const tplError = tplErr?.message || tplData?.error;
    if (tplError) {
      allErrors.push(`Template para ${recipientPhone}: ${tplError}`);
      continue; // skip docs if template failed for this recipient
    }

    // 2) Send each document via Evolution API
    let recipientFailed = false;
    for (const doc of signedDocs) {
      const docBody: Record<string, unknown> = {
        to: recipientPhone,
        clientId,
        obligationId: instanceData?.obligation_id || null,
        instanceId,
        forceEvolutionDocument: true,
        mediaUrl: doc.url,
        mediaType: 'document',
        mediaFilename: doc.fileName,
      };
      const { data: docData, error: docErr } = await supabase.functions.invoke('whatsapp-send', { body: docBody });
      const docError = docErr?.message || docData?.error;
      if (docError) {
        allErrors.push(`Documento ${doc.fileName} para ${recipientPhone}: ${docError}`);
        recipientFailed = true;
      }
    }
    if (!recipientFailed) anySuccess = true;
  }

  if (!anySuccess || allErrors.length > 0) {
    return {
      success: false,
      error: allErrors.join('; ') || 'Falha ao enviar WhatsApp',
    };
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
