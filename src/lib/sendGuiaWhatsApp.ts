import { supabase } from '@/integrations/supabase/client';

export type SendOption = { label: string; phone: string; conversationId: string | null };

export const canonicalizePhone = (p?: string | null): string => {
  let d = (p || '').replace(/\D/g, '');
  if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) d = '55' + d;
  if (d.length === 12 && d.startsWith('55') && ['6', '7', '8', '9'].includes(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
};
export const phoneVariants = (p: string): string[] => {
  const raw = (p || '').replace(/\D/g, '');
  const c = canonicalizePhone(raw);
  const set = new Set([raw, c]);
  if (c.length === 13 && c.startsWith('55') && c[4] === '9') set.add(c.slice(0, 4) + c.slice(5));
  return [...set].filter(Boolean);
};

/** Ordem: conversas do Chat (não grupo) > contato principal > contatos de departamento > telefone da empresa. */
export function buildSendOptions(
  convs: { id: string; name?: string | null; whatsapp_phone: string | null; is_group?: boolean | null }[],
  cli: { contact_name?: string | null; contact_phone?: string | null; phone?: string | null } | null,
  deps: { contact_name?: string | null; contact_phone?: string | null }[],
): SendOption[] {
  const options: SendOption[] = [];
  const seen = new Set<string>();
  const add = (label: string, phone: string | null | undefined, conversationId: string | null) => {
    const c = canonicalizePhone(phone);
    if (c.length < 12 || seen.has(c)) return;
    phoneVariants(c).forEach(v => seen.add(v));
    options.push({ label, phone: c, conversationId });
  };
  convs.filter(c => !c.is_group).forEach(c => add(`${c.name || 'Conversa'} (Chat)`, c.whatsapp_phone, c.id));
  add(cli?.contact_name || 'Contato principal', cli?.contact_phone, null);
  deps.forEach(d => add(d.contact_name || 'Contato do departamento', d.contact_phone, null));
  add('Telefone da empresa', cli?.phone, null);
  return options;
}

export async function loadSendOptions(clientId: string): Promise<SendOption[]> {
  const [{ data: convs }, { data: cli }, { data: deps }] = await Promise.all([
    supabase.from('chat_conversations').select('id, name, whatsapp_phone, is_group, updated_at')
      .eq('client_id', clientId).not('whatsapp_phone', 'is', null).order('updated_at', { ascending: false }).limit(10),
    supabase.from('clients').select('contact_name, contact_phone, phone').eq('id', clientId).maybeSingle(),
    supabase.from('client_department_contacts').select('contact_name, contact_phone').eq('client_id', clientId),
  ]);
  return buildSendOptions((convs || []) as any, (cli as any) || null, (deps || []) as any);
}

export async function ensureConversation(opt: SendOption, clientId: string, name: string, userId: string): Promise<string> {
  if (opt.conversationId) return opt.conversationId;
  const { data: existing } = await supabase.from('chat_conversations').select('id, whatsapp_phone, is_group').in('whatsapp_phone', phoneVariants(opt.phone));
  const found = (existing || []).find((c: any) => !c.is_group);
  if (found) return found.id;
  const { data: conv, error } = await supabase.from('chat_conversations').insert({
    name, created_by: userId, is_group: false, assigned_to: userId, whatsapp_phone: opt.phone, client_id: clientId,
  } as any).select('id').single();
  if (error || !conv) throw error || new Error('Falha ao criar conversa');
  await supabase.from('chat_participants').insert([{ conversation_id: conv.id, user_id: userId }]);
  return conv.id;
}

export async function sendGuia(p: {
  opt: SendOption; clientId: string; clientName: string; file: File; text: string;
  userId: string; senderName?: string;
}) {
  const conversationId = await ensureConversation(p.opt, p.clientId, p.clientName, p.userId);
  const path = `${conversationId}/${Date.now()}_${p.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('chat-media').upload(path, p.file);
  if (upErr) throw upErr;
  const mediaUrl = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
  if (p.text.trim()) {
    const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
      body: { conversationId, text: p.text.trim(), senderName: p.senderName, senderId: p.userId },
    });
    if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
  }
  const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
    body: { conversationId, type: 'document', mediaUrl, fileName: p.file.name, senderName: p.senderName, senderId: p.userId },
  });
  if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
}

export function fillTemplate(t: string, vars: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
