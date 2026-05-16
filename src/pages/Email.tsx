import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox, Star, Send, Archive, Trash2, Mail, MailOpen, RefreshCw, Loader2,
  Pencil, Reply, Forward, Paperclip, Building2, ArrowLeft, X, Tag, FileText, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Folder = 'inbox' | 'starred' | 'sent' | 'archived' | 'trash';

interface EmailMessage {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_trashed: boolean;
  is_sent: boolean;
  has_attachments: boolean;
  labels: string[];
  client_id: string | null;
}

interface Attachment {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
}

interface Client { id: string; company_name: string; }

const FOLDERS: { id: Folder; label: string; icon: any }[] = [
  { id: 'inbox', label: 'Caixa de entrada', icon: Inbox },
  { id: 'starred', label: 'Com estrela', icon: Star },
  { id: 'sent', label: 'Enviados', icon: Send },
  { id: 'archived', label: 'Arquivados', icon: Archive },
  { id: 'trash', label: 'Lixeira', icon: Trash2 },
];

const SYSTEM_LABELS = new Set([
  'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT',
  'CATEGORY_PERSONAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL',
  'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CHAT',
]);

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const yr = d.getFullYear() === today.getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}${yr}`;
}

export default function Email() {
  const { toast } = useToast();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInit, setComposeInit] = useState<Partial<ComposeInit>>({});
  const [counts, setCounts] = useState<{ unread: number }>({ unread: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('email_messages').select('*').order('received_at', { ascending: false }).limit(200);
    switch (folder) {
      case 'inbox':
        q = q.eq('is_trashed', false).eq('is_archived', false).eq('is_sent', false);
        break;
      case 'starred':
        q = q.eq('is_starred', true).eq('is_trashed', false);
        break;
      case 'sent':
        q = q.eq('is_sent', true).eq('is_trashed', false);
        break;
      case 'archived':
        q = q.eq('is_archived', true).eq('is_trashed', false);
        break;
      case 'trash':
        q = q.eq('is_trashed', true);
        break;
    }
    const { data, error } = await q;
    if (error) {
      toast({ title: 'Erro ao carregar e-mails', description: error.message, variant: 'destructive' });
    } else {
      setMessages((data as any[]) || []);
    }
    setLoading(false);
  }, [folder, toast]);

  const loadUnread = useCallback(async () => {
    const { count } = await supabase
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false).eq('is_trashed', false).eq('is_archived', false).eq('is_sent', false);
    setCounts({ unread: count || 0 });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadUnread(); }, [loadUnread]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('email_messages_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_messages' }, () => {
        load();
        loadUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, loadUnread]);

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const s = search.toLowerCase();
    return messages.filter(m =>
      (m.subject || '').toLowerCase().includes(s) ||
      (m.from_email || '').toLowerCase().includes(s) ||
      (m.from_name || '').toLowerCase().includes(s) ||
      (m.snippet || '').toLowerCase().includes(s),
    );
  }, [messages, search]);

  const selected = useMemo(() => messages.find(m => m.id === selectedId) || null, [messages, selectedId]);

  const userLabels = useMemo(() => {
    const set = new Set<string>();
    messages.forEach(m => (m.labels || []).forEach(l => {
      if (!SYSTEM_LABELS.has(l) && !l.startsWith('CATEGORY_')) set.add(l);
    }));
    return Array.from(set).sort();
  }, [messages]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-sync', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Sincronizado`, description: `${data?.inserted ?? 0} novas mensagens.` });
      load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const modify = async (id: string, action: string) => {
    const { error } = await supabase.functions.invoke('gmail-modify', { body: { messageId: id, action } });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  const openMessage = async (m: EmailMessage) => {
    setSelectedId(m.id);
    if (!m.is_read && !m.is_sent) {
      modify(m.id, 'mark_read');
    }
  };

  const openReply = (forward: boolean) => {
    if (!selected) return;
    setComposeInit({
      to: forward ? [] : [selected.from_email || ''],
      subject: (forward ? 'Fwd: ' : 'Re: ') + (selected.subject || ''),
      html: `<br><br><blockquote style="border-left:2px solid #ccc;padding-left:8px;color:#555">
        <p><strong>De:</strong> ${selected.from_name || ''} &lt;${selected.from_email || ''}&gt;<br>
        <strong>Data:</strong> ${new Date(selected.received_at).toLocaleString('pt-BR')}<br>
        <strong>Assunto:</strong> ${selected.subject || ''}</p>
        ${selected.body_html || `<pre>${selected.body_text || ''}</pre>`}
      </blockquote>`,
      inReplyTo: selected.gmail_message_id,
      threadId: selected.gmail_thread_id || undefined,
    });
    setComposeOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-4 md:-m-6 bg-background">
      {/* Sidebar 2-coluna estilo Gmail */}
      <aside className="w-64 shrink-0 border-r bg-muted/20 hidden md:flex flex-col overflow-hidden">
        <div className="p-3">
          <Button
            onClick={() => { setComposeInit({}); setComposeOpen(true); }}
            className="w-full h-12 rounded-2xl shadow-sm justify-start gap-3 text-sm font-medium"
          >
            <Pencil className="h-4 w-4" /> Escrever
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {FOLDERS.map(f => {
            const Icon = f.icon;
            const active = folder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); setSelectedId(null); }}
                className={cn(
                  'w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-r-full text-sm transition-colors',
                  active
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'hover:bg-muted text-foreground/80',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{f.label}</span>
                {f.id === 'inbox' && counts.unread > 0 && (
                  <span className="text-xs font-semibold">{counts.unread}</span>
                )}
              </button>
            );
          })}

          {userLabels.length > 0 && (
            <div className="pt-4">
              <div className="px-6 py-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Marcadores
              </div>
              {userLabels.map(l => (
                <div
                  key={l}
                  className="flex items-center gap-3 pl-6 pr-3 py-2 rounded-r-full text-sm hover:bg-muted text-foreground/80"
                >
                  <Tag className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{l}</span>
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* Coluna principal */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          {selectedId && (
            <Button size="icon" variant="ghost" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={handleSync} disabled={syncing} title="Atualizar">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Input
            placeholder="Buscar e-mails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-md ml-2"
          />
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filtered.length} {filtered.length === 1 ? 'e-mail' : 'e-mails'}
          </span>
        </div>

        {/* Conteúdo: lista OU leitor */}
        {selected ? (
          <MessageReader
            message={selected}
            onClose={() => setSelectedId(null)}
            onModify={(action) => modify(selected.id, action)}
            onReply={openReply}
          />
        ) : loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum e-mail.</div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y">
            {filtered.map(m => (
              <EmailRow key={m.id} m={m} onOpen={() => openMessage(m)} onModify={modify} />
            ))}
          </ul>
        )}
      </main>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        init={composeInit}
        onSent={() => { setComposeOpen(false); load(); }}
      />
    </div>
  );
}

// =====================================================================

function EmailRow({
  m, onOpen, onModify,
}: {
  m: EmailMessage;
  onOpen: () => void;
  onModify: (id: string, action: string) => void;
}) {
  const unread = !m.is_read && !m.is_sent;
  const senderLabel = m.is_sent
    ? `Para: ${m.to_emails?.[0] || '—'}`
    : (m.from_name || m.from_email || '—');
  return (
    <li
      onClick={onOpen}
      className={cn(
        'group flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
        'hover:shadow-sm hover:z-10 relative',
        unread ? 'bg-background' : 'bg-muted/30',
        'hover:bg-muted/60',
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onModify(m.id, m.is_starred ? 'unstar' : 'star'); }}
        className="shrink-0 text-muted-foreground hover:text-yellow-500"
      >
        <Star className={cn('h-4 w-4', m.is_starred && 'fill-yellow-500 text-yellow-500')} />
      </button>

      <div className={cn('w-44 shrink-0 truncate text-sm', unread && 'font-semibold text-foreground')}>
        {senderLabel}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
        <span className={cn('truncate', unread ? 'font-semibold text-foreground' : 'text-foreground/90')}>
          {m.subject || '(sem assunto)'}
        </span>
        <span className="text-muted-foreground truncate hidden sm:inline">
          — {m.snippet}
        </span>
      </div>

      {m.has_attachments && (
        <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-background text-xs text-muted-foreground shrink-0">
          <FileText className="h-3 w-3" /> anexo
        </span>
      )}

      <div className="shrink-0 w-16 text-right text-xs text-muted-foreground tabular-nums">
        {fmtDate(m.received_at)}
      </div>
    </li>
  );
}

// =====================================================================

function MessageReader({
  message, onClose, onModify, onReply,
}: {
  message: EmailMessage;
  onClose: () => void;
  onModify: (action: string) => void;
  onReply: (forward: boolean) => void;
}) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!message.has_attachments) { setAttachments([]); return; }
    supabase.from('email_attachments').select('id, filename, mime_type, size_bytes')
      .eq('message_id', message.id).then(({ data }) => setAttachments((data as any) || []));
  }, [message.id, message.has_attachments]);

  const downloadAttachment = async (att: Attachment) => {
    setDownloadingId(att.id);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-attachment', {
        body: { attachmentRowId: att.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e.message, variant: 'destructive' });
    } finally { setDownloadingId(null); }
  };

  const srcDoc = useMemo(() => {
    const html = message.body_html || `<pre style="white-space:pre-wrap;font-family:sans-serif">${(message.body_text || '').replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;')}</pre>`;
    return `<!doctype html><html><head><base target="_blank"><style>body{font-family:sans-serif;font-size:14px;color:#111;padding:8px;margin:0}img{max-width:100%;height:auto}a{color:#2563eb}</style></head><body>${html}</body></html>`;
  }, [message.body_html, message.body_text]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center gap-1 flex-wrap">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onModify(message.is_starred ? 'unstar' : 'star')}>
          <Star className={cn('h-4 w-4', message.is_starred && 'fill-yellow-500 text-yellow-500')} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onModify(message.is_read ? 'mark_unread' : 'mark_read')}>
          {message.is_read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
        </Button>
        {!message.is_archived && !message.is_trashed && !message.is_sent && (
          <Button size="sm" variant="ghost" onClick={() => onModify('archive')}>
            <Archive className="h-4 w-4" />
          </Button>
        )}
        {message.is_archived && (
          <Button size="sm" variant="ghost" onClick={() => onModify('unarchive')}>
            <Inbox className="h-4 w-4" />
          </Button>
        )}
        {!message.is_trashed ? (
          <Button size="sm" variant="ghost" onClick={() => onModify('trash')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onModify('untrash')}>
            <Inbox className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => onReply(false)}>
          <Reply className="h-4 w-4 mr-1" /> Responder
        </Button>
        <Button size="sm" variant="outline" onClick={() => onReply(true)}>
          <Forward className="h-4 w-4 mr-1" /> Encaminhar
        </Button>
      </div>

      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold mb-2">{message.subject || '(sem assunto)'}</h2>
        <div className="text-sm">
          <div><strong>De:</strong> {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}</div>
          <div><strong>Para:</strong> {message.to_emails?.join(', ')}</div>
          {message.cc_emails?.length > 0 && (
            <div><strong>Cc:</strong> {message.cc_emails.join(', ')}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">{new Date(message.received_at).toLocaleString('pt-BR')}</div>
        </div>
        <div className="mt-2">
          <ClientLinkPopover message={message} />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <iframe
          title="email-body"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={srcDoc}
          className="w-full h-full border-0"
        />
      </div>

      {attachments.length > 0 && (
        <div className="border-t px-4 py-2 flex gap-2 flex-wrap">
          {attachments.map(att => (
            <Button
              key={att.id} variant="outline" size="sm"
              disabled={downloadingId === att.id}
              onClick={() => downloadAttachment(att)}
            >
              {downloadingId === att.id
                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                : <Paperclip className="h-3 w-3 mr-1" />}
              {att.filename}
              {att.size_bytes ? <span className="text-xs text-muted-foreground ml-1">({Math.round(att.size_bytes / 1024)} KB)</span> : null}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================

function ClientLinkPopover({ message }: { message: EmailMessage }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [linked, setLinked] = useState<Client | null>(null);

  useEffect(() => {
    supabase.from('clients').select('id, company_name').order('company_name').limit(2000)
      .then(({ data }) => setClients((data as any) || []));
  }, []);

  useEffect(() => {
    if (!message.client_id) { setLinked(null); return; }
    supabase.from('clients').select('id, company_name').eq('id', message.client_id).maybeSingle()
      .then(({ data }) => setLinked((data as any) || null));
  }, [message.client_id]);

  const link = async (clientId: string | null) => {
    const { error } = await supabase.from('email_messages').update({ client_id: clientId }).eq('id', message.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: clientId ? 'Cliente vinculado' : 'Vínculo removido' });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Building2 className="h-3 w-3 mr-1" />
          {linked ? linked.company_name : 'Vincular cliente'}
          {linked && (
            <X className="h-3 w-3 ml-2 hover:text-destructive" onClick={(e) => { e.stopPropagation(); link(null); }} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente.</CommandEmpty>
            <CommandGroup>
              {clients.map(c => (
                <CommandItem key={c.id} value={c.company_name} onSelect={() => link(c.id)}>
                  {c.company_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================

interface ComposeInit {
  to: string[]; cc?: string[]; subject?: string; html?: string;
  inReplyTo?: string; threadId?: string;
}

function ComposeDialog({
  open, onOpenChange, init, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  init: Partial<ComposeInit>;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo((init.to || []).join(', '));
      setCc((init.cc || []).join(', '));
      setSubject(init.subject || '');
      setHtml(init.html || '');
      setFiles([]);
    }
  }, [open, init]);

  const send = async () => {
    const toArr = to.split(',').map(s => s.trim()).filter(Boolean);
    const ccArr = cc.split(',').map(s => s.trim()).filter(Boolean);
    if (toArr.length === 0 || !subject) {
      toast({ title: 'Preencha destinatário e assunto', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // Upload attachments
      const attMeta: { storage_path: string; filename: string; mime: string }[] = [];
      for (const f of files) {
        const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_');
        const path = `outgoing/${crypto.randomUUID()}/${safeName}`;
        const { error } = await supabase.storage.from('email-attachments').upload(path, f, {
          contentType: f.type || 'application/octet-stream',
        });
        if (error) throw error;
        attMeta.push({ storage_path: path, filename: f.name, mime: f.type || 'application/octet-stream' });
      }

      const { data, error } = await supabase.functions.invoke('gmail-send', {
        body: {
          to: toArr, cc: ccArr.length ? ccArr : undefined, subject,
          html, inReplyTo: init.inReplyTo, threadId: init.threadId,
          attachments: attMeta,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'E-mail enviado' });
      onSent();
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo e-mail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Para</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@exemplo.com, outro@exemplo.com" />
          </div>
          <div>
            <Label>Cc</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional" />
          </div>
          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem (HTML básico aceito)</Label>
            <Textarea value={html} onChange={(e) => setHtml(e.target.value)} className="min-h-[200px] font-mono text-sm" />
          </div>
          <div>
            <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos</Label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground" />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {files.length} arquivo(s): {files.map(f => f.name).join(', ')}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}