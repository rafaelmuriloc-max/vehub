import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { FileText, Image as ImageIcon, Mic, Paperclip, Video, MessageSquare } from 'lucide-react';

export interface PickedItem {
  id: string;
  kind: 'text' | 'media';
  content: string;
  media_url?: string | null;
  message_type?: string | null;
  sender_name: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  initialSelectedIds?: string[];
  onConfirm: (items: PickedItem[]) => void;
}

function iconFor(type?: string | null) {
  if (!type) return <MessageSquare className="h-4 w-4" />;
  if (type.includes('image')) return <ImageIcon className="h-4 w-4" />;
  if (type.includes('audio')) return <Mic className="h-4 w-4" />;
  if (type.includes('video')) return <Video className="h-4 w-4" />;
  if (type.includes('document') || type.includes('pdf')) return <FileText className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
}

export function MessagePicker({ open, onOpenChange, conversationId, initialSelectedIds = [], onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !conversationId) return;
    setSelected(Object.fromEntries(initialSelectedIds.map((id) => [id, true])));
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, message_type, media_url, created_at, sender_id, agent_name, deleted_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      const list = (data || []) as any[];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.sender_id).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        const m: Record<string, string> = {};
        (profs || []).forEach((p: any) => { m[p.user_id] = p.full_name || ''; });
        setProfileMap(m);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.content || '').toLowerCase().includes(q));
  }, [rows, search]);

  const senderName = (r: any) => {
    if (r.message_type?.startsWith('whatsapp_incoming')) return 'Cliente';
    return r.agent_name || profileMap[r.sender_id] || 'Sistema';
  };

  const isMedia = (r: any) => !!r.media_url;

  function confirm() {
    const items: PickedItem[] = rows
      .filter((r) => selected[r.id])
      .map((r) => ({
        id: r.id,
        kind: isMedia(r) ? 'media' : 'text',
        content: r.content || '',
        media_url: r.media_url || null,
        message_type: r.message_type || null,
        sender_name: senderName(r),
        created_at: r.created_at,
      }));
    onConfirm(items);
    onOpenChange(false);
  }

  const count = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar da conversa</DialogTitle>
        </DialogHeader>
        <Input placeholder="Buscar mensagens..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <ScrollArea className="h-[420px] border rounded-md">
          <div className="divide-y">
            {loading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
            {!loading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma mensagem</p>}
            {!loading && filtered.map((r) => {
              const fileName = isMedia(r) ? decodeURIComponent((r.media_url || '').split('/').pop() || 'arquivo').replace(/^\d+_/, '') : '';
              return (
                <label key={r.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={!!selected[r.id]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: !!v }))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {iconFor(r.message_type)}
                      <span className="font-medium text-foreground">{senderName(r)}</span>
                      <span>{new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {isMedia(r) ? (
                      <p className="text-sm truncate mt-0.5"><Paperclip className="inline h-3 w-3 mr-1" />{fileName}</p>
                    ) : (
                      <p className="text-sm mt-0.5 line-clamp-2 whitespace-pre-wrap">{r.content || <span className="italic text-muted-foreground">(sem conteúdo)</span>}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={count === 0}>Anexar {count > 0 ? `(${count})` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}