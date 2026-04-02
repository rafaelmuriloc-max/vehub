import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // silently fail if audio is blocked
  }
}

export function useChatNotification() {
  const location = useLocation();
  const { user } = useAuth();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          if (locationRef.current.startsWith('/chat')) return;

          const msg = payload.new as any;
          const type = msg.message_type || 'text';
          if (type === 'text' || type === 'whatsapp_outgoing') return;

          // Fetch conversation name
          let convName = 'Conversa';
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('name, whatsapp_phone')
            .eq('id', msg.conversation_id)
            .single();
          if (conv) {
            convName = conv.name || conv.whatsapp_phone || 'Conversa';
          }

          const preview = (msg.content || '').substring(0, 80);

          playNotificationSound();
          toast('💬 Nova mensagem', {
            description: `${convName}: ${preview}`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
