import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  user_id: string;
  full_name: string | null;
  job_title: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from('profiles')
      .select('user_id, full_name, job_title')
      .neq('user_id', user.id)
      .then(({ data }) => setUsers(data || []));
  }, [open, user]);

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const startConversation = async (otherUserId: string, otherName: string) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      // Check if 1:1 conversation already exists
      const { data: myParticipations } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (myParticipations && myParticipations.length > 0) {
        const convIds = myParticipations.map(p => p.conversation_id);
        const { data: otherParticipations } = await supabase
          .from('chat_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', convIds);

        if (otherParticipations && otherParticipations.length > 0) {
          // Check if any is a 1:1 (not group)
          for (const op of otherParticipations) {
            const { data: conv } = await supabase
              .from('chat_conversations')
              .select('id, is_group')
              .eq('id', op.conversation_id)
              .eq('is_group', false)
              .single();
            if (conv) {
              onCreated(conv.id);
              onOpenChange(false);
              setCreating(false);
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: conv, error } = await supabase
        .from('chat_conversations')
        .insert({ name: otherName, created_by: user.id, is_group: false })
        .select('id')
        .single();

      if (error || !conv) throw error;

      // Add both participants
      await supabase.from('chat_participants').insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);

      onCreated(conv.id);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao criar conversa', description: err?.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>Selecione um usuário para iniciar uma conversa.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
          )}
          {filtered.map(u => (
            <button
              key={u.user_id}
              onClick={() => startConversation(u.user_id, u.full_name || 'Usuário')}
              disabled={creating}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{u.full_name || 'Usuário'}</p>
                {u.job_title && <p className="text-xs text-muted-foreground">{u.job_title}</p>}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
