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
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Load conversations - optimized with batch queries and parallelization
  const loadConversations = useCallback(async () => {
    if (!user) return;

    setLoadingConversations(true);

    const { data: participations } = await supabase
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations || participations.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const convIds = participations.map(p => p.conversation_id);

    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('*, client_id, avatar_url')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convs) {
      setLoadingConversations(false);
      return;
    }

    // Batch: fetch all client IDs at once
    const allClientIds = [...new Set(convs.filter(c => c.client_id).map(c => c.client_id!))];
    const oneToOneConvIds = convs.filter(c => !c.is_group && !c.client_id).map(c => c.id);
    const whatsappConvs = convs.filter(c => c.whatsapp_phone);

    // Parallel batch queries
    const [clientsResult, participantsResult, allMessagesResult, whatsappContactsResult] = await Promise.all([
      // 1. All linked clients in one query
      allClientIds.length > 0
        ? supabase.from('clients').select('id, contact_name, company_name').in('id', allClientIds)
        : Promise.resolve({ data: [] }),
      // 2. All participants for 1:1 conversations
      oneToOneConvIds.length > 0
        ? supabase.from('chat_participants').select('conversation_id, user_id').in('conversation_id', oneToOneConvIds).neq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      // 3. All recent messages for all conversations (we'll group client-side)
      supabase.from('chat_messages')
        .select('conversation_id, content, created_at, sender_id, read_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
      // 4. All whatsapp phone contacts
      whatsappConvs.length > 0
        ? supabase.from('client_department_contacts').select('client_id, contact_phone')
        : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const clientMap = new Map((clientsResult.data || []).map(c => [c.id, c]));

    // Get profile names for 1:1 participants
    const otherUserIds = [...new Set((participantsResult.data || []).map(p => p.user_id))];
    const profilesResult = otherUserIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', otherUserIds)
      : { data: [] };
    const profileMap = new Map((profilesResult.data || []).map(p => [p.user_id, p.full_name || 'Usuário']));
    const participantMap = new Map((participantsResult.data || []).map(p => [p.conversation_id, p.user_id]));

    // Group messages by conversation - pick latest per conversation
    const lastMsgMap = new Map<string, { content: string; created_at: string; sender_id: string; read_at: string | null }>();
    for (const msg of (allMessagesResult.data || [])) {
      if (!lastMsgMap.has(msg.conversation_id)) {
        lastMsgMap.set(msg.conversation_id, msg);
      }
    }

    // Count unread per conversation
    const unreadMap = new Map<string, number>();
    for (const msg of (allMessagesResult.data || [])) {
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      }
    }

    // Build whatsapp phone → client_ids map
    const allContacts = whatsappContactsResult.data || [];
    
    // Build company lookup for whatsapp conversations
    const whatsappCompanyMap = new Map<string, string[]>();
    if (whatsappConvs.length > 0 && allContacts.length > 0) {
      const contactClientIds = [...new Set(allContacts.filter(c => c.client_id).map(c => c.client_id))];
      const { data: contactClients } = contactClientIds.length > 0
        ? await supabase.from('clients').select('id, company_name').in('id', contactClientIds)
        : { data: [] };
      const contactClientMap = new Map((contactClients || []).map(c => [c.id, c.company_name]));

      for (const conv of whatsappConvs) {
        const digits = conv.whatsapp_phone!.replace(/\D/g, '');
        const searchPhone = digits.length > 4 ? digits.slice(-8) : digits;
        const matchedClientIds = [...new Set(
          allContacts
            .filter(c => c.contact_phone && c.contact_phone.includes(searchPhone))
            .map(c => c.client_id)
        )];
        const names = matchedClientIds.map(id => contactClientMap.get(id)).filter(Boolean) as string[];
        if (names.length > 0) whatsappCompanyMap.set(conv.id, names);
      }
    }

    // Assemble items
    const items: ConversationItem[] = convs.map(conv => {
      let name = conv.name || 'Conversa';

      if (conv.client_id && clientMap.has(conv.client_id)) {
        const client = clientMap.get(conv.client_id)!;
        name = client.contact_name || client.company_name || name;
      } else if (!conv.is_group && !conv.client_id) {
        const otherUserId = participantMap.get(conv.id);
        if (otherUserId) {
          name = profileMap.get(otherUserId) || name;
        }
      }

      const lastMsg = lastMsgMap.get(conv.id);

      return {
        id: conv.id,
        name,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: lastMsg?.created_at || conv.created_at,
        unreadCount: unreadMap.get(conv.id) || 0,
        isGroup: conv.is_group,
        avatarUrl: conv.avatar_url || undefined,
        companyNames: whatsappCompanyMap.get(conv.id) || [],
        whatsappPhone: conv.whatsapp_phone || undefined,
      };
    });

    setConversations(items);
    setLoadingConversations(false);
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
        .select('id, content, sender_id, created_at, read_at, message_type, media_url')
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

          if (newMsg.conversation_id === activeConvId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', newMsg.sender_id)
              .single();

            setMessages(prev => [...prev, {
              ...newMsg,
              sender_name: prof?.full_name || 'Usuário',
            }]);

            if (newMsg.sender_id !== user.id) {
              await supabase
                .from('chat_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMsg.id);
            }
          }

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

    const activeConv = conversations.find(c => c.id === activeConvId);

    if (activeConv?.whatsappPhone) {
      // Send via WhatsApp edge function
      const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { conversationId: activeConvId, text: content },
      });

      if (error) {
        console.error('Error sending WhatsApp message:', error);
        const { toast } = await import('@/hooks/use-toast');
        toast({ title: 'Erro ao enviar mensagem', description: 'Tente novamente.', variant: 'destructive' });
        return;
      }

      // The realtime subscription will pick up the new message
    } else {
      // Internal chat message
      await supabase.from('chat_messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content,
        message_type: 'text',
      });

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId);
    }
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
            loading={loadingConversations}
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
            avatarUrl={conversations.find(c => c.id === activeConvId)?.avatarUrl}
            companyNames={conversations.find(c => c.id === activeConvId)?.companyNames}
          />
        </div>
      )}
    </div>
  );
}
