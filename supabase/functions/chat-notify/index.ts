import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@velocitacontabilidade.com.br';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: 'message_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: msg } = await supabase
      .from('chat_messages')
      .select('id, sender_id, content, message_type, conversation_id, channel')
      .eq('id', message_id)
      .maybeSingle();

    if (!msg) return new Response(JSON.stringify({ skipped: 'no message' }), { headers: corsHeaders });

    // Skip outgoing whatsapp echoes
    if (msg.message_type === 'whatsapp_outgoing') {
      return new Response(JSON.stringify({ skipped: 'outgoing' }), { headers: corsHeaders });
    }

    // Incoming WhatsApp messages are stored with a "system" sender_id (admin placeholder).
    // For those, do NOT exclude sender from recipients — the real author is the external client.
    const isIncomingExternal =
      typeof msg.message_type === 'string' && msg.message_type.startsWith('whatsapp_incoming');
    console.log('[chat-notify] message', {
      id: msg.id,
      type: msg.message_type,
      channel: msg.channel,
      sender_id: msg.sender_id,
      isIncomingExternal,
    });

    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('id, name, whatsapp_phone, assigned_to, client_id')
      .eq('id', msg.conversation_id)
      .maybeSingle();

    if (!conv) return new Response(JSON.stringify({ skipped: 'no conv' }), { headers: corsHeaders });

    // Recipients = assigned_to ∪ admins, minus sender
    const recipientIds = new Set<string>();
    if (conv.assigned_to) recipientIds.add(conv.assigned_to);

    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    (admins || []).forEach((a: any) => recipientIds.add(a.user_id));

    // Only exclude sender for internal/manually-sent messages (real author = sender_id)
    if (msg.sender_id && !isIncomingExternal) recipientIds.delete(msg.sender_id);

    console.log('[chat-notify] recipients', Array.from(recipientIds));

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 'no recipients' }), { headers: corsHeaders });
    }

    const { data: subs } = await supabase
      .from('user_push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', Array.from(recipientIds));

    console.log('[chat-notify] subscriptions found:', subs?.length || 0);

    // Build title: "Contato · Empresa"
    let companyName: string | null = null;
    let contactName: string | null = conv.name || null;
    if (conv.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('company_name, contact_name')
        .eq('id', conv.client_id)
        .maybeSingle();
      if (client) {
        companyName = client.company_name || null;
        if (!contactName) contactName = client.contact_name || null;
      }
    }

    const formatPhone = (p: string | null | undefined) => {
      if (!p) return '';
      const d = p.replace(/\D/g, '');
      if (d.length === 13 && d.startsWith('55')) {
        return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
      }
      if (d.length === 11) {
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      }
      return p;
    };

    const contact = contactName || formatPhone(conv.whatsapp_phone) || 'Nova mensagem';
    const title = companyName && companyName !== contact
      ? `${contact} · ${companyName}`
      : contact;

    // Build body: message preview or media label
    const mediaLabels: Record<string, string> = {
      whatsapp_incoming_image: '📷 Imagem',
      whatsapp_incoming_video: '🎬 Vídeo',
      whatsapp_incoming_audio: '🎙️ Áudio',
      whatsapp_incoming_document: '📎 Documento',
      whatsapp_incoming_sticker: '🖼️ Sticker',
    };
    const rawContent = (msg.content || '').toString().trim();
    let body = rawContent.slice(0, 140);
    if (!body) {
      body = mediaLabels[msg.message_type as string] || 'Nova mensagem';
    } else if (mediaLabels[msg.message_type as string]) {
      body = `${mediaLabels[msg.message_type as string]} — ${body}`;
    }

    const payload = JSON.stringify({
      title,
      body,
      tag: `conv-${conv.id}`,
      url: '/chat',
    });

    console.log('[chat-notify] payload', { title, body, bodyLen: body.length });

    let sent = 0;
    let removed = 0;
    await Promise.all(
      (subs || []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            await supabase.from('user_push_subscriptions').delete().eq('id', s.id);
            removed++;
          } else {
            console.error('[chat-notify] push error', status, err?.body);
          }
        }
      })
    );

    return new Response(JSON.stringify({ sent, removed, total: subs?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[chat-notify] error', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});