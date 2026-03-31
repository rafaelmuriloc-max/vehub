import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ConversationList, ConversationItem } from '@/components/chat/ConversationList';
import { MessageArea, ChatMessage } from '@/components/chat/MessageArea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Chat() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConvName, setActiveConvName] = useState<string | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;

    const { data: participations } = await supabase
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations || participations.length === 0) {
      setConversations([]);
      return;
    }

    const convIds = participations.map(p => p.conversation_id);

    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('*, client_id, avatar_url')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convs) return;

    // Get last messages and participant names for 1:1
    const items: ConversationItem[] = [];

    for (const conv of convs) {
      // Get last message
      const { data: lastMsgs } = await supabase
        .from('chat_messages')
        .select('content, created_at, sender_id, read_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Count unread
      const { count: unreadCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .is('read_at', null);

      // For 1:1, get other participant's name
      let name = conv.name || 'Conversa';

      // If conversation has a linked client, use contact_name as priority
      if (conv.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('contact_name, company_name')
          .eq('id', conv.client_id)
          .single();
        if (client) {
          name = client.contact_name || client.company_name || name;
        }
      } else if (!conv.is_group) {
        const { data: parts } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('conversation_id', conv.id)
          .neq('user_id', user.id);

        if (parts && parts.length > 0) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', parts[0].user_id)
            .single();
          if (prof?.full_name) name = prof.full_name;
        }
      }

      const lastMsg = lastMsgs?.[0];
      items.push({
        id: conv.id,
        name,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: lastMsg?.created_at || conv.created_at,
        unreadCount: unreadCount || 0,
        isGroup: conv.is_group,
      });
    }

    setConversations(items);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId || !user) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at, read_at, message_type')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true });

      if (!data) return;

      // Get sender names
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name || 'Usuário']) || []);

      setMessages(data.map(m => ({
        ...m,
        sender_name: nameMap.get(m.sender_id) || 'Usuário',
      })));

      // Mark unread messages as read
      const unreadIds = data
        .filter(m => m.sender_id !== user.id && !m.read_at)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('chat_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    };

    loadMessages();

    // Set conversation name
    const conv = conversations.find(c => c.id === activeConvId);
    setActiveConvName(conv?.name || null);
  }, [activeConvId, user, conversations]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMsg = payload.new as any;

          // If message is in active conversation, add it
          if (newMsg.conversation_id === activeConvId) {
            // Get sender name
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', newMsg.sender_id)
              .single();

            setMessages(prev => [...prev, {
              ...newMsg,
              sender_name: prof?.full_name || 'Usuário',
            }]);

            // Mark as read if from other user
            if (newMsg.sender_id !== user.id) {
              await supabase
                .from('chat_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMsg.id);
            }
          }

          // Refresh conversation list
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConvId, loadConversations]);

  const sendMessage = async (content: string) => {
    if (!user || !activeConvId) return;

    await supabase.from('chat_messages').insert({
      conversation_id: activeConvId,
      sender_id: user.id,
      content,
      message_type: 'text',
    });

    // Update conversation timestamp
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeConvId);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
  };

  const handleConversationCreated = (id: string) => {
    loadConversations();
    setActiveConvId(id);
  };

  const showList = isMobile ? !activeConvId : true;
  const showMessages = isMobile ? !!activeConvId : true;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border bg-background shadow-sm">
      {showList && (
        <div className={`${isMobile ? 'w-full' : 'w-[350px] shrink-0'}`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={handleSelectConversation}
            onCreated={handleConversationCreated}
          />
        </div>
      )}
      {showMessages && (
        <div className="flex-1 flex flex-col min-w-0">
          {isMobile && activeConvId && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 left-2 z-10"
              onClick={() => setActiveConvId(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
          <MessageArea
            conversationName={activeConvName}
            messages={messages}
            currentUserId={user?.id || ''}
            onSend={sendMessage}
            isGroup={conversations.find(c => c.id === activeConvId)?.isGroup}
          />
        </div>
      )}
    </div>
  );
}
