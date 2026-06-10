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

const TEXT_ONLY_OBLIGATION_TEMPLATE = 'send_output_informations_template_3_header';
const LEGACY_DOCUMENT_HEADER_TEMPLATES = new Set(['envio_doc']);
const DEFAULT_OBLIGATION_TEMPLATE_PARAMS = [
  'tratamento_contato',
  'nome_contabilidade',
  'cliente',
  'nome_tipo_tarefa',
];

async function logWhatsappSend(opts: {
  instanceId: string;
  activityId: string;
  clientId: string;
  obligationId: string | null;
  recipientPhone: string;
  templateName?: string | null;
  mediaFilename?: string | null;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
}) {
  try {
    await supabase.from('whatsapp_logs').insert({
      instance_id: opts.instanceId,
      activity_id: opts.activityId,
      client_id: opts.clientId,
      obligation_id: opts.obligationId,
      recipient_phone: opts.recipientPhone,
      template_name: opts.templateName || null,
      media_filename: opts.mediaFilename || null,
      status: opts.status,
      error_message: opts.errorMessage || null,
    });
  } catch (e) {
    console.error('Failed to write whatsapp_logs:', e);
  }
}

/**
 * Marca a atividade como concluída SE todos os envios esperados
 * (template + documentos) × destinatários estão presentes em whatsapp_logs com status='sent'.
 * Caso contrário, incrementa retry_count e grava failure_reason.
 */
async function reconcileActivityCompletion(opts: {
  instanceId: string;
  activityId: string;
  recipients: { phone: string }[];
  docFilenames: string[];
  templateName: string | null;
  errors: string[];
}) {
  const { instanceId, activityId, recipients, docFilenames, templateName, errors } = opts;

  // Expected count: per recipient = (1 template if templateName) + N docs
  const perRecipient = (templateName ? 1 : 0) + docFilenames.length;
  const expected = perRecipient * recipients.length;

  let sentCount = 0;
  if (expected > 0) {
    const { count } = await supabase
      .from('whatsapp_logs')
      .select('id', { count: 'exact', head: true })
      .eq('instance_id', instanceId)
      .eq('activity_id', activityId)
      .eq('status', 'sent');
    sentCount = count || 0;
  }

  const fullyDelivered = expected === 0 || sentCount >= expected;

  if (fullyDelivered) {
    await upsertActivityCompletionMarker(instanceId, activityId, {
      completed: true,
      completed_at: new Date().toISOString(),
      failure_reason: null,
    });
    return { ok: true };
  }

  const failureReason = errors.join('; ') || `Envios parciais: ${sentCount}/${expected}`;
  await upsertActivityCompletionMarker(instanceId, activityId, {
    completed: false,
    last_retry_at: new Date().toISOString(),
    failure_reason: failureReason,
  }, { incrementRetry: true });
  return { ok: false, reason: failureReason };
}

/**
 * Insere ou atualiza a linha "marker" (file_url IS NULL) de uma completion,
 * de forma segura contra race conditions. Depende do índice único parcial
 * `obligation_activity_completions_unique_marker`.
 */
export async function upsertActivityCompletionMarker(
  instanceId: string,
  activityId: string,
  fields: Record<string, unknown>,
  opts?: { incrementRetry?: boolean }
) {
  // 1) UPDATE primeiro (marker existente). Se afetar linha, terminamos.
  const baseQuery = supabase
    .from('obligation_activity_completions')
    .select('id, retry_count')
    .eq('instance_id', instanceId)
    .eq('activity_id', activityId)
    .is('file_url', null)
    .maybeSingle();
  const { data: existing } = await baseQuery;

  if (existing) {
    const patch: Record<string, unknown> = { ...fields };
    if (opts?.incrementRetry) {
      patch.retry_count = ((existing as any).retry_count || 0) + 1;
    }
    await supabase.from('obligation_activity_completions').update(patch).eq('id', (existing as any).id);
    return;
  }

  // 2) Tentar INSERT. Se 23505 (race), refaz UPDATE.
  const insertRow: Record<string, unknown> = {
    instance_id: instanceId,
    activity_id: activityId,
    ...fields,
  };
  if (opts?.incrementRetry) insertRow.retry_count = 1;

  const { error } = await supabase
    .from('obligation_activity_completions')
    .insert(insertRow as any);
  if (error && (error as any).code === '23505') {
    const { data: again } = await supabase
      .from('obligation_activity_completions')
      .select('id, retry_count')
      .eq('instance_id', instanceId)
      .eq('activity_id', activityId)
      .is('file_url', null)
      .maybeSingle();
    if (again) {
      const patch: Record<string, unknown> = { ...fields };
      if (opts?.incrementRetry) {
        patch.retry_count = ((again as any).retry_count || 0) + 1;
      }
      await supabase.from('obligation_activity_completions').update(patch).eq('id', (again as any).id);
    }
  }
}

export async function sendActivityWhatsApp(params: SendActivityWhatsAppParams): Promise<{ success: boolean; error?: string }> {
  const { activity, instanceId, clientId, obligationName, referenceMonth, dueDay, departmentId } = params;

  const rawTemplateName = activity.whatsapp_template_name?.trim() || '';
  const templateName = (activity.whatsapp_has_document_header || LEGACY_DOCUMENT_HEADER_TEMPLATES.has(rawTemplateName))
    ? TEXT_ONLY_OBLIGATION_TEMPLATE
    : rawTemplateName;

  if (!templateName && !activity.whatsapp_message_body) {
    return { success: false, error: 'Atividade de WhatsApp sem configuração completa' };
  }

  // Per-send dedup happens below by skipping recipients/docs that already
  // have a `sent` log for this (instance_id, activity_id). This also enables
  // resume-on-retry after partial failures.

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
    if (templateName) {
      const matches = activity.whatsapp_message_body
        ? [...activity.whatsapp_message_body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
        : [];
      const bodyParams = matches.length > 0
        ? matches
        : (templateName === TEXT_ONLY_OBLIGATION_TEMPLATE ? DEFAULT_OBLIGATION_TEMPLATE_PARAMS : []);
      if (bodyParams.length > 0) {
        sharedComponents.push({
          type: 'body',
          parameters: bodyParams.map(name => ({
            type: 'text',
            parameter_name: name,
            text: templateVars[name] || '',
          })),
        });
      }
      chatPreview = activity.whatsapp_message_body?.replace(
        /\{\{(\w+)\}\}/g,
        (_: string, name: string) => templateVars[name] ?? ''
      ) || `Olá, ${templateVars.tratamento_contato},\n\nEssa é uma mensagem automática de ${templateVars.nome_contabilidade}\n\nReferente à empresa: ${templateVars.cliente}\n\n📌 Assunto: ${templateVars.nome_tipo_tarefa}`;
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

  // Load already-sent logs for this (instance, activity) so we resume after partial failures.
  const { data: existingLogs } = await supabase
    .from('whatsapp_logs')
    .select('recipient_phone, template_name, media_filename, status')
    .eq('instance_id', instanceId)
    .eq('activity_id', activity.id)
    .eq('status', 'sent');

  const sentKey = (phone: string, kind: 'template' | string) =>
    `${phone}::${kind}`;
  const alreadySentSet = new Set<string>(
    (existingLogs || []).map((l: any) =>
      sentKey(l.recipient_phone, l.media_filename ? l.media_filename : 'template')
    )
  );

  const allErrors: string[] = [];

  for (const recipient of recipients) {
    const { sharedComponents, chatPreview } = buildSharedComponents(recipient.name);
    const recipientPhone = recipient.phone;
    const obligationId = instanceData?.obligation_id || null;

    // 1) Template Meta — skip if already sent for this recipient
    let templateOk = alreadySentSet.has(sentKey(recipientPhone, 'template'));
    if (!templateOk && (templateName || activity.whatsapp_message_body)) {
      const templateBody: Record<string, unknown> = {
        to: recipientPhone,
        clientId,
        obligationId,
        instanceId,
      };
      if (templateName) {
        templateBody.type = 'template';
        templateBody.templateName = templateName;
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
        await logWhatsappSend({
          instanceId, activityId: activity.id, clientId, obligationId,
          recipientPhone, templateName, status: 'failed', errorMessage: String(tplError),
        });
        // Continue trying docs even if template failed — they may still arrive on next retry
      } else {
        templateOk = true;
        // whatsapp-send already inserts a whatsapp_logs row for template sends,
        // but without activity_id/media_filename. Backfill activity_id so reconciliation works.
        // Insert our own row so the count matches expected.
        await logWhatsappSend({
          instanceId, activityId: activity.id, clientId, obligationId,
          recipientPhone, templateName, status: 'sent',
        });
      }
    } else if (!templateName && !activity.whatsapp_message_body) {
      templateOk = true; // no template configured, only docs
    }

    // 2) Documentos via Evolution — independente do template, tenta cada doc faltante
    for (const doc of signedDocs) {
      if (alreadySentSet.has(sentKey(recipientPhone, doc.fileName))) continue;
      const docBody: Record<string, unknown> = {
        to: recipientPhone,
        clientId,
        obligationId,
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
        await logWhatsappSend({
          instanceId, activityId: activity.id, clientId, obligationId,
          recipientPhone, mediaFilename: doc.fileName, status: 'failed', errorMessage: String(docError),
        });
      } else {
        await logWhatsappSend({
          instanceId, activityId: activity.id, clientId, obligationId,
          recipientPhone, mediaFilename: doc.fileName, status: 'sent',
        });
      }
    }
  }

  // Reconcile completion based on actual sent logs (handles partial / resumed sends)
  const reconcile = await reconcileActivityCompletion({
    instanceId,
    activityId: activity.id,
    recipients,
    docFilenames: signedDocs.map(d => d.fileName),
    templateName: (templateName || activity.whatsapp_message_body) ? (templateName || 'inline') : null,
    errors: allErrors,
  });

  if (!reconcile.ok) {
    return { success: false, error: reconcile.reason || allErrors.join('; ') || 'Envio incompleto — será reenviado automaticamente' };
  }
  return { success: true };
}
