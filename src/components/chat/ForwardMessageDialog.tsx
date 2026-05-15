import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Forward, Loader2, Search } from 'lucide-react';

export interface ForwardMessageData {
  id: string;
  content: string;
  message_type?: string;
  media_url?: string | null;
}

interface ConvOption {
  id: string;
  name: string;
  avatar_url?: string | null;
  whatsapp_phone?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  message: ForwardMessageData | null;
  currentConversationId?: string | null;
  senderName?: string | null;
}

const MAX_TARGETS = 5;

export function ForwardMessageDialog({ open, onOpenChange, message, currentConversationId, senderName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [convs, setConvs] = useState<ConvOption[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch('');
    (async () => {
      const { data } = await supabase
        .from('chat_conversations')
        .select('id, name, avatar_url, whatsapp_phone')
        .order('updated_at', { ascending: false })
        .limit(200);
      setConvs((data || []) as any);
    })();
  }, [open]);

  const filtered = convs
    .filter(c => c.id !== currentConversationId)
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.whatsapp_phone || '').includes(search.replace(/\D/g, ''));
    });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_TARGETS) next.add(id);
      else toast({ title: `Máximo de ${MAX_TARGETS} conversas`, variant: 'destructive' });
      return next;
    });
  };

  const handleForward = async () => {
    if (!user || !message || selected.size === 0) return;
    setSending(true);
    const targets = convs.filter(c => selected.has(c.id));
    const mediaKind = message.message_type?.replace(/^whatsapp_(incoming_)?/, '') || '';
    const isMedia = ['image', 'video', 'audio', 'document'].includes(mediaKind) && !!message.media_url;
    let okCount = 0;
    let failCount = 0;

    for (const conv of targets) {
      try {
        if (conv.whatsapp_phone) {
          if (isMedia) {
            const { error } = await supabase.functions.invoke('whatsapp-send-media', {
              body: {
                conversationId: conv.id,
                type: mediaKind,
                mediaUrl: message.media_url,
                fileName: message.content || 'arquivo',
                senderName: senderName || undefined,
                senderId: user.id,
              },
            });
            if (error) throw error;
          } else {
            const { error } = await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                conversationId: conv.id,
                text: message.content,
                senderName: senderName || undefined,
                senderId: user.id,
              },
            });
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            sender_id: user.id,
            content: message.content,
            message_type: isMedia ? `whatsapp_${mediaKind}` : 'text',
            media_url: isMedia ? message.media_url : null,
          });
          if (error) throw error;
          await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id);
        }
        okCount++;
      } catch (err: any) {
        console.error('Forward error:', err);
        failCount++;
      }
    }

    setSending(false);
    if (okCount > 0) {
      toast({ title: `Encaminhada para ${okCount} conversa(s)`, description: failCount > 0 ? `${failCount} falharam` : undefined });
    } else {
      toast({ title: 'Falha ao encaminhar', variant: 'destructive' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Forward className="h-4 w-4" /> Encaminhar mensagem</DialogTitle>
          <DialogDescription>Selecione até {MAX_TARGETS} conversas.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa…"
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 mt-2 min-h-0">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conversa encontrada</p>
          )}
          {filtered.map(c => {
            const isSel = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${isSel ? 'bg-primary/10' : 'hover:bg-muted'}`}
              >
                <Checkbox checked={isSel} onCheckedChange={() => toggle(c.id)} />
                <Avatar className="h-9 w-9">
                  {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name || 'Sem nome'}</p>
                  {c.whatsapp_phone && (
                    <p className="text-xs text-muted-foreground truncate">+{c.whatsapp_phone}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={handleForward} disabled={sending || selected.size === 0} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            Encaminhar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}