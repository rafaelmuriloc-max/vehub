import { useState, useEffect, useCallback, useRef } from 'react';
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
import { RegisterContactDialog } from '@/components/chat/RegisterContactDialog';


export type ChatTab = 'mine' | 'in_progress' | 'all';

export default function Chat() {
  const { user, profile, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConvName, setActiveConvName] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeTab, setActiveTab] = useState<ChatTab>('mine');
  const [refreshingAvatars, setRefreshingAvatars] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [mineCount, setMineCount] = useState(0);

  const loadWaitingCount = useCallback(async () => {
    const { count } = await supabase
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .is('assigned_to', null)
      .not('whatsapp_phone', 'is', null);
    setWaitingCount(count || 0);
  }, []);

  const loadMineCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('assigned_to', user.id);
    setMineCount(count || 0);
  }, [user]);

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

    const { data: convs, error: rpcErr } = await supabase.rpc('get_chat_inbox', {
      p_user: user.id,
      p_tab: currentTab,
    });
    if (rpcErr) console.error('get_chat_inbox error:', rpcErr);

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const allClientIds = [...new Set(convs.filter((c: any) => c.client_id).map((c: any) => c.client_id as string))];
    const oneToOneConvIds = convs.filter(c => !c.is_group && !c.client_id).map(c => c.id);
    const whatsappConvs = convs.filter((c: any) => c.whatsapp_phone);

    const [clientsResult, participantsResult, whatsappContactsResult] = await Promise.all([
      allClientIds.length > 0
        ? supabase.from('clients').select('id, contact_name, company_name').in('id', allClientIds)
        : Promise.resolve({ data: [] }),
      oneToOneConvIds.length > 0
        ? supabase.from('chat_participants').select('conversation_id, user_id').in('conversation_id', oneToOneConvIds).neq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      whatsappConvs.length > 0
        ? supabase.from('client_department_contacts').select('client_id, contact_phone')
        : Promise.resolve({ data: [] }),
    ]);

    const clientMap = new Map((clientsResult.data || []).map(c => [c.id, c]));

    const otherUserIds = [...new Set((participantsResult.data || []).map(p => p.user_id))];
    const profilesResult = otherUserIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', otherUserIds)
      : { data: [] };
    const profileMap = new Map((profilesResult.data || []).map(p => [p.user_id, p.full_name || 'Usuário']));
    const participantMap = new Map((participantsResult.data || []).map(p => [p.conversation_id, p.user_id]));

    const allContacts = whatsappContactsResult.data || [];
    const whatsappCompanyMap = new Map<string, string[]>();
    if (whatsappConvs.length > 0 && allContacts.length > 0) {
      const contactClientIds = [...new Set(allContacts.filter(c => c.client_id).map(c => c.client_id))];
      const { data: contactClients } = contactClientIds.length > 0
        ? await supabase.from('clients').select('id, company_name').in('id', contactClientIds)
        : { data: [] };
      const contactClientMap = new Map((contactClients || []).map(c => [c.id, c.company_name]));

      for (const conv of whatsappConvs) {
        const digits = (conv as any).whatsapp_phone.replace(/\D/g, '');
        const searchPhone = digits.length > 4 ? digits.slice(-8) : digits;
        const matchedClientIds = [...new Set(
          allContacts
            .filter(c => c.contact_phone && c.contact_phone.includes(searchPhone))
            .map(c => c.client_id)
        )];
        const names = matchedClientIds.map(id => contactClientMap.get(id)).filter(Boolean) as string[];
        if (names.length > 0) whatsappCompanyMap.set((conv as any).id, names);
      }
    }

    const items: ConversationItem[] = convs.map((conv: any) => {
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

      return {
        id: conv.id,
        name,
        lastMessage: conv.last_message || '',
        lastMessageAt: conv.last_message_at || conv.created_at,
        unreadCount: conv.unread_count || 0,
        isGroup: conv.is_group,
        avatarUrl: conv.avatar_url || undefined,
        companyNames: whatsappCompanyMap.get(conv.id) || [],
        whatsappPhone: conv.whatsapp_phone || undefined,
        clientId: conv.client_id || null,
        status: conv.status || 'open',
        assignedToName: conv.assigned_to_name || null,
        assignedToColor: (conv as any).assigned_to_color || null,
        waitingSince: conv.waiting_since || null,
        totalWaitSeconds: conv.total_wait_seconds || 0,
      };
    });

    items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(items);
    setLoadingConversations(false);
  }, [user, activeTab]);

  // Stable ref for loadConversations + debounced version (used by realtime)
  const loadConversationsRef = useRef(loadConversations);
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedReloadConversations = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      loadConversationsRef.current();
    }, 250);
  }, []);

  useEffect(() => {
    loadConversations();
    loadWaitingCount();
    loadMineCount();
  }, [loadConversations, loadWaitingCount, loadMineCount]);

  // Realtime: atualiza contadores quando conversas mudam (atribuição/status)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-conversations-counters')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => {
          loadWaitingCount();
          loadMineCount();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadWaitingCount, loadMineCount]);

  const handleTabChange = (tab: ChatTab) => {
    setActiveTab(tab);
    setActiveConvId(null);
    setActiveConvName(null);
    setMessages([]);
    loadConversations(tab);
  };

  // Load messages for active conversation (does NOT depend on `conversations`)
  useEffect(() => {
    if (!activeConvId || !user) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at, read_at, message_type, media_url, edited_at, deleted_at, deleted_for, channel, wa_message_id, wa_remote_jid')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!data || cancelled) return;

      const filtered = (data as any[]).filter(m => !(m.deleted_for || []).includes(user.id));
      const ordered = [...filtered].reverse();
      const senderIds = [...new Set(ordered.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
      if (cancelled) return;

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name || 'Usuário']) || []);

      setMessages(ordered.map(m => ({
        ...m,
        sender_name: nameMap.get(m.sender_id) || 'Usuário',
      })));

      const unreadIds = ordered
        .filter(m => m.message_type !== 'text' && m.message_type !== 'whatsapp_outgoing' && !m.read_at)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('chat_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
        // O canal realtime de chat_conversations já dispara refresh de contadores;
        // usamos versão debounced para evitar rajadas.
        debouncedReloadConversations();
      }
    };

    loadMessages();
    return () => { cancelled = true; };
  }, [activeConvId, user, debouncedReloadConversations]);

  // Sync active conversation name when the list changes (cheap, no message reload)
  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv) setActiveConvName(prev => (prev === conv.name ? prev : conv.name));
  }, [activeConvId, conversations]);

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

          debouncedReloadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConvId, debouncedReloadConversations]);

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
        body: { conversationId: activeConvId, text: content, senderName: profile?.full_name || undefined, senderId: user.id },
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
  const [registerContactOpen, setRegisterContactOpen] = useState(false);

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

  const editMessage = async (id: string, newContent: string) => {
    if (!newContent.trim()) return;
    const msg = messages.find(m => m.id === id) as any;
    const isWhatsAppOutgoing = msg?.channel === 'whatsapp' && msg?.message_type === 'whatsapp_outgoing';
    if (isWhatsAppOutgoing) {
      const { data, error } = await supabase.functions.invoke('whatsapp-edit-message', {
        body: { messageId: id, newText: newContent.trim() },
      });
      if (error || (data as any)?.error) {
        const reason = (data as any)?.error || error?.message || 'Falha desconhecida';
        toast({
          title: 'Não foi possível editar no WhatsApp',
          description: reason,
          variant: 'destructive',
        });
        return;
      }
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent.trim(), edited_at: new Date().toISOString() } : m));
      return;
    }
    const { error } = await supabase
      .from('chat_messages')
      .update({ content: newContent.trim(), edited_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao editar mensagem', description: error.message, variant: 'destructive' });
      return;
    }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent.trim(), edited_at: new Date().toISOString() } : m));
  };

  const deleteMessageForMe = async (id: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === id);
    const current: string[] = (msg as any)?.deleted_for || [];
    if (current.includes(user.id)) return;
    const next = [...current, user.id];
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_for: next } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const deleteMessageForAll = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    const isWhatsApp = (msg as any)?.channel === 'whatsapp' && !!(msg as any)?.wa_message_id;
    if (isWhatsApp) {
      const { data, error } = await supabase.functions.invoke('whatsapp-delete-message', {
        body: { messageId: id },
      });
      if (error || (data as any)?.error) {
        const reason = (data as any)?.error || error?.message || 'Falha desconhecida';
        toast({
          title: 'Não foi possível apagar no WhatsApp',
          description: reason,
          variant: 'destructive',
        });
        return;
      }
    }
    // Try to remove media file from storage
    if (msg?.media_url) {
      try {
        const idx = msg.media_url.indexOf('/chat-media/');
        if (idx >= 0) {
          const path = msg.media_url.substring(idx + '/chat-media/'.length).split('?')[0];
          await supabase.storage.from('chat-media').remove([decodeURIComponent(path)]);
        }
      } catch (e) { console.warn('Falha ao remover mídia:', e); }
    }
    const { error } = await supabase
      .from('chat_messages')
      .update({ content: '', media_url: null, deleted_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao apagar mensagem', description: error.message, variant: 'destructive' });
      return;
    }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: '', media_url: undefined, deleted_at: new Date().toISOString() } as any : m));
    loadConversations();
  };

  const deleteConversation = async () => {
    if (!activeConvId) return;
    const { error } = await supabase.rpc('delete_conversation_cascade' as any, { p_id: activeConvId });
    if (error) {
      toast({ title: 'Erro ao excluir conversa', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conversa excluída' });
    setActiveConvId(null);
    setActiveConvName(null);
    setMessages([]);
    loadConversations();
  };

  const renameConversation = async (newName: string) => {
    if (!activeConvId) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from('chat_conversations')
      .update({ name: trimmed, name_locked: true } as any)
      .eq('id', activeConvId);
    if (error) {
      toast({ title: 'Erro ao renomear', description: error.message, variant: 'destructive' });
      return;
    }
    setActiveConvName(trimmed);
    toast({ title: 'Contato renomeado' });
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
            totalUnread={mineCount}
            waitingCount={waitingCount}
            onNavigateBack={() => {
              if (window.location.pathname === '/chat/popup') {
                window.close();
              } else {
                navigate('/');
              }
            }}
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
            isAdmin={isAdmin}
            onEditMessage={editMessage}
            onDeleteMessageForMe={deleteMessageForMe}
            onDeleteMessageForAll={deleteMessageForAll}
            onDeleteConversation={deleteConversation}
            onRenameConversation={renameConversation}
            onRegisterContact={() => setRegisterContactOpen(true)}
          />
        </div>
      )}
      </div>

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

      <RegisterContactDialog
        open={registerContactOpen}
        onOpenChange={setRegisterContactOpen}
        conversationId={activeConvId}
        initialName={activeConvName}
        initialPhone={activeConv?.whatsappPhone || null}
        onSaved={() => { void loadConversations?.(); }}
      />
    </div>
  );
}
