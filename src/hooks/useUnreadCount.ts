import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) { setTotalUnread(0); return; }

    // Get conversations assigned to this user that are open
    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('assigned_to', user.id)
      .eq('status', 'open');

    if (!convs || convs.length === 0) { setTotalUnread(0); return; }

    const convIds = convs.map(c => c.id);

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .is('read_at', null)
      .like('message_type', 'whatsapp_incoming%');

    setTotalUnread(count || 0);
  }, [user]);

  useEffect(() => {
    fetchUnread();

    const channel = supabase
      .channel('unread-count-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUnread]);

  return totalUnread;
}
