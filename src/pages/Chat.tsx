import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ConversationList, ConversationItem } from '@/components/chat/ConversationList';
import { MessageArea, ChatMessage } from '@/components/chat/MessageArea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AttachFromObligationDialog } from '@/components/chat/AttachFromObligationDialog';
import { EnableNotificationsBanner } from '@/components/chat/EnableNotificationsBanner';


export type ChatTab = 'mine' | 'in_progress' | 'all';

export default function Chat() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConvName, setActiveConvName] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeTab, setActiveTab] = useState<ChatTab>('mine');
  const [refreshingAvatars, setRefreshingAvatars] = useState(false);

  const handleRefreshAvatars = async () => {
    setRefreshingAvatars(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-refresh-avatars', {
        body: { onlyMissing: false },
      });
      if (error) throw error;
      toast({
        title: 'Fotos atualizadas',
        description: `${data?.updated ?? 0} atualizadas, ${data?.unchanged ?? 0} sem alteração, ${data?.failed ?? 0} falharam.`,
      });
      await loadConversations();
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar fotos', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshingAvatars(false);
    }
  };

  // Load conversations based on active tab
  const loadConversations = useCallback(async (tab?: ChatTab) => {
    if (!user) return;
    const currentTab = tab || activeTab;

    setLoadingConversations(true);

    let query = supabase.from('chat_conversations').select('*');

    if (currentTab === 'mine') {
      query = query.eq('assigned_to', user.id).eq('status', 'open');
    } else if (currentTab === 'in_progress') {
      query = query
        .eq('status', 'open')
        .or(`assigned_to.neq.${user.id},assigned_to.is.null`);
    } else {
      // all: todas as conversas (abertas e fechadas)
      // sem filtro — admins veem tudo via RLS
    }

    const { data: convs } = await query.order('updated_at', { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const convIds = convs.map(c => c.id);
    const allClientIds = [...new Set(convs.filter(c => c.client_id).map(c => c.client_id!))];
    const oneToOneConvIds = convs.filter(c => !c.is_group && !c.client_id).map(c => c.id);
    const whatsappConvs = convs.filter(c => c.whatsapp_phone);

    const [clientsResult, participantsResult, allMessagesResult, whatsappContactsResult] = await Promise.all([
      allClientIds.length > 0
        ? supabase.from('clients').select('id, contact_name, company_name').in('id', allClientIds)
        : Promise.resolve({ data: [] }),
      oneToOneConvIds.length > 0
        ? supabase.from('chat_participants').select('conversation_id, user_id').in('conversation_id', oneToOneConvIds).neq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      supabase.from('chat_messages')
        .select('conversation_id, content, created_at, sender_id, read_at, message_type')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
      whatsappConvs.length > 0
        ? supabase.from('client_department_contacts').select('client_id, contact_phone')
        : Promise.resolve({ data: [] }),
    ]);

    const clientMap = new Map((clientsResult.data || []).map(c => [c.id, c]));

    const otherUserIds = [...new Set((participantsResult.data || []).map(p => p.user_id))];
    const assignedUserIds = [...new Set(convs.filter(c => c.assigned_to).map(c => c.assigned_to as string))];
    const allProfileIds = [...new Set([...otherUserIds, ...assignedUserIds])];
    const profilesResult = allProfileIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', allProfileIds)
      : { data: [] };
    const profileMap = new Map((profilesResult.data || []).map(p => [p.user_id, p.full_name || 'Usuário']));
    const participantMap = new Map((participantsResult.data || []).map(p => [p.conversation_id, p.user_id]));

    const lastMsgMap = new Map<string, { content: string; created_at: string; sender_id: string; read_at: string | null }>();
    for (const msg of (allMessagesResult.data || [])) {
      if (!lastMsgMap.has(msg.conversation_id)) {
        lastMsgMap.set(msg.conversation_id, msg);
      }
    }

    const unreadMap = new Map<string, number>();
    for (const msg of (allMessagesResult.data || [])) {
      if (msg.message_type !== 'text' && msg.message_type !== 'whatsapp_outgoing' && !msg.read_at) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      }
    }

    const allContacts = whatsappContactsResult.data || [];
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

    const items: ConversationItem[] = convs.map(conv => {
      let name = conv.name || 'Conversa';

      if (conv.whatsapp_phone && conv.name) {
        name = conv.name;
      } else if (conv.client_id && clientMap.has(conv.client_id)) {
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
        clientId: conv.client_id || null,
        status: (conv as any).status || 'open',
        assignedToName: conv.assigned_to ? (profileMap.get(conv.assigned_to) || null) : null,
      };
    });

    items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(items);
    setLoadingConversations(false);
  }, [user, activeTab]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleTabChange = (tab: ChatTab) => {
    setActiveTab(tab);
    setActiveConvId(null);
    setActiveConvName(null);
    setMessages([]);
    loadConversations(tab);
  };

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

      const unreadIds = data
        .filter(m => m.message_type !== 'text' && m.message_type !== 'whatsapp_outgoing' && !m.read_at)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('chat_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
        loadConversations();
      }
    };

    loadMessages();

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

            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, {
                ...newMsg,
                sender_name: prof?.full_name || 'Usuário',
              }];
            });

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

  const activeConv = conversations.find(c => c.id === activeConvId);
  const isClosed = activeConv?.status === 'closed';

  const ensureAssignedToMe = async (convId: string) => {
    if (!user) return;
    // 1) Garantir que o usuário é participante ANTES do UPDATE
    //    (a RLS de UPDATE em chat_conversations exige ser participante).
    const { data: existing } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', convId)
      .eq('user_id', user.id);
    if (!existing || existing.length === 0) {
      await supabase.from('chat_participants').insert({
        conversation_id: convId,
        user_id: user.id,
      });
    }
    // 2) Agora reatribuir a conversa ao usuário atual
    const { error: updErr } = await supabase
      .from('chat_conversations')
      .update({ assigned_to: user.id })
      .eq('id', convId);
    if (updErr) {
      toast({
        title: 'Erro ao assumir a conversa',
        description: updErr.message,
        variant: 'destructive',
      });
      return;
    }
    // 3) Refletir a nova atribuição na lista
    loadConversations();
  };

  const sendMessage = async (content: string) => {
    if (!user || !activeConvId || isClosed) return;

    await ensureAssignedToMe(activeConvId);

    if (activeConv?.whatsappPhone) {
      const { error } = await supabase.functions.invoke('whatsapp-send-text', {
        body: { conversationId: activeConvId, text: content, senderName: profile?.full_name || undefined },
      });

      if (error) {
        console.error('Error sending WhatsApp message:', error);
        toast({ title: 'Erro ao enviar mensagem', description: 'Tente novamente.', variant: 'destructive' });
      }
    } else {
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

  const sendMedia = async (file: File, type: 'image' | 'video' | 'document' | 'audio') => {
    if (!user || !activeConvId || isClosed) return;

    await ensureAssignedToMe(activeConvId);

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${activeConvId}/${Date.now()}_${sanitizedName}`;

    const { error: uploadErr } = await supabase.storage
      .from('chat-media')
      .upload(path, file);

    if (uploadErr) {
      toast({ title: 'Erro ao enviar arquivo', description: uploadErr.message, variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
    const mediaUrl = urlData.publicUrl;

    if (activeConv?.whatsappPhone) {
      const { data: respData, error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId: activeConvId, type, mediaUrl, fileName: file.name, senderName: profile?.full_name || undefined, senderId: user.id },
      });
      if (error || (respData && (respData as any).error)) {
        const detail = (respData as any)?.error || error?.message || '';
        console.error('Erro envio mídia:', detail, error);
        toast({ title: 'Erro ao enviar mídia', description: String(detail).slice(0, 200), variant: 'destructive' });
      }
    } else {
      await supabase.from('chat_messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: file.name,
        message_type: `whatsapp_${type}`,
        media_url: mediaUrl,
      });
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvId);
    }
  };

  const sendExistingMedia = async (mediaUrl: string, fileName: string, type: 'image' | 'video' | 'document' | 'audio') => {
    if (!user || !activeConvId || isClosed) return;
    await ensureAssignedToMe(activeConvId);

    if (activeConv?.whatsappPhone) {
      const { data: respData, error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId: activeConvId, type, mediaUrl, fileName, senderName: profile?.full_name || undefined, senderId: user.id },
      });
      if (error || (respData && (respData as any).error)) {
        const detail = (respData as any)?.error || error?.message || '';
        toast({ title: 'Erro ao enviar mídia', description: String(detail).slice(0, 200), variant: 'destructive' });
      }
    } else {
      await supabase.from('chat_messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: fileName,
        message_type: `whatsapp_${type}`,
        media_url: mediaUrl,
      });
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvId);
    }
  };

  const [attachObligationOpen, setAttachObligationOpen] = useState(false);

  const sendLocation = async (lat: number, lng: number) => {
    if (!user || !activeConvId || isClosed) return;

    await ensureAssignedToMe(activeConvId);

    if (activeConv?.whatsappPhone) {
      const { error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId: activeConvId, type: 'location', latitude: lat, longitude: lng, senderName: profile?.full_name || undefined, senderId: user.id },
      });
      if (error) {
        toast({ title: 'Erro ao enviar localização', variant: 'destructive' });
      }
    } else {
      await supabase.from('chat_messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: `${lat},${lng}`,
        message_type: 'whatsapp_location',
      });
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvId);
    }
  };

  const sendContact = async (name: string, phone: string) => {
    if (!user || !activeConvId || isClosed) return;

    await ensureAssignedToMe(activeConvId);

    if (activeConv?.whatsappPhone) {
      const { error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId: activeConvId, type: 'contacts', contactName: name, contactPhone: phone, senderName: profile?.full_name || undefined, senderId: user.id },
      });
      if (error) {
        toast({ title: 'Erro ao enviar contato', variant: 'destructive' });
      }
    } else {
      await supabase.from('chat_messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: `${name}|${phone}`,
        message_type: 'whatsapp_contact',
      });
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvId);
    }
  };

  const closeTicket = async () => {
    if (!activeConvId) return;
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'closed', closed_at: new Date().toISOString(), assigned_to: null } as any)
      .eq('id', activeConvId);

    if (error) {
      toast({ title: 'Erro ao fechar chamado', variant: 'destructive' });
      return;
    }

    toast({ title: 'Chamado fechado com sucesso' });
    setActiveConvId(null);
    setActiveConvName(null);
    loadConversations();
  };

  const reopenTicket = async () => {
    if (!activeConvId) return;
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'open', closed_at: null } as any)
      .eq('id', activeConvId);

    if (error) {
      toast({ title: 'Erro ao reabrir chamado', variant: 'destructive' });
      return;
    }

    toast({ title: 'Chamado reaberto com sucesso' });
    loadConversations();
  };

  // Transfer ticket
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string; job_title: string | null }[]>([]);

  const openTransferDialog = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, job_title');
    setTeamMembers((profiles || []).filter(p => p.user_id !== user?.id));
    setTransferDialogOpen(true);
  };

  const transferTicket = async (targetUserId: string) => {
    if (!activeConvId) return;

    // Update assigned_to
    const { error } = await supabase
      .from('chat_conversations')
      .update({ assigned_to: targetUserId })
      .eq('id', activeConvId);

    if (error) {
      toast({ title: 'Erro ao transferir chamado', variant: 'destructive' });
      return;
    }

    // Add as participant if not already
    const { data: existing } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', activeConvId)
      .eq('user_id', targetUserId);

    if (!existing || existing.length === 0) {
      await supabase.from('chat_participants').insert({
        conversation_id: activeConvId,
        user_id: targetUserId,
      });
    }

    const targetName = teamMembers.find(m => m.user_id === targetUserId)?.full_name || 'usuário';
    toast({ title: `Chamado transferido para ${targetName}` });
    setTransferDialogOpen(false);
    setActiveConvId(null);
    setActiveConvName(null);
    loadConversations();
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
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background md:h-screen">
      <EnableNotificationsBanner />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {showList && (
        <div className={`${isMobile ? 'w-full' : 'w-[350px] shrink-0'}`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={handleSelectConversation}
            onCreated={handleConversationCreated}
            loading={loadingConversations}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            totalUnread={conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
            onNavigateBack={() => navigate('/')}
            onRefreshAvatars={handleRefreshAvatars}
            refreshingAvatars={refreshingAvatars}
          />
        </div>
      )}
      {showMessages && (
        <div className="flex-1 flex flex-col min-w-0">
          <MessageArea
            conversationName={activeConvName}
            messages={messages}
            currentUserId={user?.id || ''}
            onSend={sendMessage}
            onSendMedia={sendMedia}
            onSendLocation={sendLocation}
            onSendContact={sendContact}
            onPickFromObligation={() => setAttachObligationOpen(true)}
            isGroup={activeConv?.isGroup}
            avatarUrl={activeConv?.avatarUrl}
            currentUserName={profile?.full_name || undefined}
            companyNames={activeConv?.companyNames}
            isClosed={isClosed}
            onCloseTicket={closeTicket}
            onReopenTicket={reopenTicket}
            onTransferTicket={openTransferDialog}
            whatsappPhone={activeConv?.whatsappPhone}
            onBack={isMobile ? () => setActiveConvId(null) : undefined}
          />
        </div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transferir Chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {teamMembers.map(member => (
              <button
                key={member.user_id}
                onClick={() => transferTicket(member.user_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                    {(member.full_name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name || 'Usuário'}</p>
                  {member.job_title && (
                    <p className="text-xs text-muted-foreground truncate">{member.job_title}</p>
                  )}
                </div>
              </button>
            ))}
            {teamMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AttachFromObligationDialog
        open={attachObligationOpen}
        onOpenChange={setAttachObligationOpen}
        conversationClientId={activeConv?.clientId || null}
        whatsappPhone={activeConv?.whatsappPhone || null}
        onSend={sendExistingMedia}
      />
    </div>
  );
}
