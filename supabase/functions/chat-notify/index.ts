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

    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('id, name, whatsapp_phone, assigned_to')
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

    if (msg.sender_id) recipientIds.delete(msg.sender_id);

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 'no recipients' }), { headers: corsHeaders });
    }

    const { data: subs } = await supabase
      .from('user_push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', Array.from(recipientIds));

    const title = conv.name || conv.whatsapp_phone || 'Nova mensagem';
    const body = (msg.content || '').toString().slice(0, 120) || 'Nova mensagem';
    const payload = JSON.stringify({
      title,
      body,
      tag: `conv-${conv.id}`,
      url: '/chat',
    });

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