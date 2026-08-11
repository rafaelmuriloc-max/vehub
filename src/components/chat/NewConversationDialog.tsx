import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';

interface Contact {
  phone: string;          // normalized digits
  displayPhone: string;   // original
  name: string;
  companyName?: string;
  clientId?: string;
  source: 'client' | 'department' | 'whatsapp';
}

const normalizePhone = (p?: string | null) => (p || '').replace(/\D/g, '');

// Canonicaliza para 13 dígitos: 55 + DDD + 9 + 8 dígitos (mesma lógica do whatsapp-webhook)
const canonicalizePhone = (p?: string | null): string => {
  let d = normalizePhone(p);
  // Sem código do país: prefixar 55
  if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) {
    d = '55' + d;
  }
  // 55 + DDD + 8 dígitos -> inserir 9 após DDD se local começar com 6/7/8/9
  if (d.length === 12 && d.startsWith('55')) {
    const localFirst = d[4];
    if (['6', '7', '8', '9'].includes(localFirst)) {
      d = d.slice(0, 4) + '9' + d.slice(4);
    }
  }
  return d;
};

const phoneVariants = (p: string): string[] => {
  const set = new Set<string>();
  const d = normalizePhone(p);
  set.add(d);
  set.add(canonicalizePhone(d));
  const c = canonicalizePhone(d);
  if (c.length === 13 && c.startsWith('55') && c[4] === '9') {
    set.add(c.slice(0, 4) + c.slice(5)); // variante sem o 9
  }
  return [...set].filter(Boolean);
};

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [clientsRes, deptRes, convRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, sci_code, company_name, contact_name, contact_phone')
          .not('contact_phone', 'is', null),
        supabase
          .from('client_department_contacts')
          .select('contact_name, contact_phone, client_id, clients(company_name)')
          .not('contact_phone', 'is', null),
        supabase
          .from('chat_conversations')
          .select('name, whatsapp_phone, client_id')
          .not('whatsapp_phone', 'is', null)
          .is('client_id', null),
      ]);

      const map = new Map<string, Contact>();

      // Priority: client > department > whatsapp. Insert clients last to override.
      for (const c of (convRes.data || []) as any[]) {
        const phone = normalizePhone(c.whatsapp_phone);
        if (!phone) continue;
        if (!map.has(phone)) {
          map.set(phone, {
            phone,
            displayPhone: c.whatsapp_phone,
            name: c.name || c.whatsapp_phone,
            source: 'whatsapp',
          });
        }
      }
      for (const d of (deptRes.data || []) as any[]) {
        const phone = normalizePhone(d.contact_phone);
        if (!phone) continue;
        const existing = map.get(phone);
        if (!existing || existing.source === 'whatsapp') {
          map.set(phone, {
            phone,
            displayPhone: d.contact_phone,
            name: d.contact_name || d.contact_phone,
            companyName: d.clients?.company_name,
            clientId: d.client_id,
            source: 'department',
          });
        }
      }
      for (const c of (clientsRes.data || []) as any[]) {
        const phone = normalizePhone(c.contact_phone);
        if (!phone) continue;
        map.set(phone, {
          phone,
          displayPhone: c.contact_phone,
          name: c.contact_name || c.company_name,
          companyName: c.company_name,
          clientId: c.id,
          source: 'client',
        });
      }

      const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setContacts(list);
    })();
  }, [open, user]);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(search.replace(/\D/g, '')) ||
      (c.companyName?.toLowerCase().includes(q) ?? false)
    );
  });

  const searchDigits = search.replace(/\D/g, '');
  const showPhoneOption =
    searchDigits.length >= 10 &&
    searchDigits.length <= 15 &&
    !contacts.some(c => c.phone === searchDigits);

  const startConversation = async (contact: Contact) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const canonical = canonicalizePhone(contact.phone);
      const variants = phoneVariants(canonical);

      // Procurar conversa existente por qualquer variante do telefone
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id, whatsapp_phone');
      const found = (existing || []).find((c: any) => {
        const norm = normalizePhone(c.whatsapp_phone);
        return variants.includes(norm) || variants.includes(canonicalizePhone(norm));
      });
      if (found) {
        onCreated(found.id);
        onOpenChange(false);
        setCreating(false);
        return;
      }

      const { data: conv, error } = await supabase
        .from('chat_conversations')
        .insert({
          name: contact.clientId ? contact.name : `+${canonical}`,
          created_by: user.id,
          is_group: false,
          assigned_to: user.id,
          whatsapp_phone: canonical,
          client_id: contact.clientId ?? null,
        } as any)
        .select('id')
        .single();

      if (error || !conv) throw error;

      await supabase.from('chat_participants').insert([
        { conversation_id: conv.id, user_id: user.id },
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>Selecione um contato para iniciar uma conversa no WhatsApp.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por nome, empresa ou digite um telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
          {showPhoneOption && (
            <button
              onClick={() =>
                startConversation({
                  phone: searchDigits,
                  displayPhone: searchDigits,
                  name: `+${searchDigits}`,
                  source: 'whatsapp',
                })
              }
              disabled={creating}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left border border-dashed border-primary/40"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Phone className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">Enviar mensagem para +{searchDigits}</p>
                <p className="text-xs text-muted-foreground truncate">Novo contato WhatsApp</p>
              </div>
            </button>
          )}
          {filtered.length === 0 && !showPhoneOption && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato encontrado</p>
          )}
          {filtered.map(c => (
            <button
              key={`${c.source}-${c.phone}`}
              onClick={() => startConversation(c)}
              disabled={creating}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.companyName || c.displayPhone || 'Contato WhatsApp'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
