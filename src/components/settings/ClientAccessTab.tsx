import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Megaphone, Trash2, UserPlus, Ban, Search } from 'lucide-react';
import { portalStatus, type PortalStatus } from '@/lib/portal';

type Client = { id: string; company_name: string; document: string | null; tax_regime: string | null };
type Contact = { email: string; names: string[]; phones: string[]; client_ids: string[]; user_id: string | null; must_change_password: boolean; is_staff: boolean };
const STATUS_LABEL: Record<PortalStatus, string> = { none: 'Sem acesso', temp: 'Senha temporária', active: 'Ativo', staff: 'É funcionário' };
type Ann = { id: string; title: string; body: string; audience: string; tax_regime: string | null; client_id: string | null; expires_at: string | null; created_at: string };

const db = supabase as any;

function genPwd() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, n => a[n % a.length]).join('') + '!7';
}

export function ClientAccessTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PortalStatus>('all');
  const [anns, setAnns] = useState<Ann[]>([]);
  const [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState<{ c: Contact; name: string; whatsapp: string; password: string } | null>(null);
  const [annOpen, setAnnOpen] = useState(false);
  const [ann, setAnn] = useState({ title: '', body: '', audience: 'all', tax_regime: 'Simples Nacional', client_id: '', expires_at: '' });

  const clientName = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);

  async function load() {
    const [{ data: cl }, { data: ct, error }, { data: a }] = await Promise.all([
      supabase.from('clients').select('id, company_name, document, tax_regime').order('company_name'),
      db.rpc('admin_portal_contacts'),
      db.from('portal_announcements').select('*').order('created_at', { ascending: false }),
    ]);
    if (error) toast({ title: 'Erro ao carregar contatos', description: error.message, variant: 'destructive' });
    setClients((cl as Client[]) || []);
    setContacts((ct as Contact[]) || []);
    setAnns((a as Ann[]) || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = contacts.filter(c => {
    if (statusFilter !== 'all' && portalStatus(c) !== statusFilter) return false;
    if (!q) return true;
    const hay = `${c.email} ${c.names.join(' ')} ${c.client_ids.map(id => clientName.get(id)).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function confirmGrant() {
    if (!grant) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'create', role: 'client', email: grant.c.email, full_name: grant.name, whatsapp: grant.whatsapp, password: grant.password } });
    setBusy(false);
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    toast({ title: 'Acesso liberado', description: data.whatsapp_sent ? 'Credenciais enviadas por WhatsApp.' : `Senha temporária: ${grant.password}${data.whatsapp_error ? ` (WhatsApp: ${data.whatsapp_error})` : ''}` });
    setGrant(null); load();
  }

  async function resend(c: Contact) {
    const phone = window.prompt(`WhatsApp para reenviar o acesso de ${c.email}:`, c.phones[0] || '');
    if (!phone || !c.user_id) return;
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'send-access', user_id: c.user_id, whatsapp: phone } });
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    toast({ title: 'Nova senha gerada', description: data.whatsapp_sent ? 'Enviada por WhatsApp.' : `Senha: ${data.temp_password}` });
    load();
  }

  async function block(c: Contact) {
    if (!c.user_id || !window.confirm(`Bloquear o acesso de ${c.email}? O login será excluído; o contato continua no cadastro.`)) return;
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'delete', user_id: c.user_id } });
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    load();
  }

  async function publish() {
    if (!ann.title.trim() || !ann.body.trim()) { toast({ title: 'Título e mensagem são obrigatórios', variant: 'destructive' }); return; }
    if (ann.audience === 'client' && !ann.client_id) { toast({ title: 'Escolha a empresa', variant: 'destructive' }); return; }
    const { error } = await db.from('portal_announcements').insert({
      title: ann.title.trim(), body: ann.body.trim(), audience: ann.audience,
      tax_regime: ann.audience === 'regime' ? ann.tax_regime : null,
      client_id: ann.audience === 'client' ? ann.client_id : null,
      expires_at: ann.expires_at || null, created_by: user?.id,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setAnnOpen(false); setAnn({ ...ann, title: '', body: '' }); load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Acessos da Área do Cliente</CardTitle>
          <p className="text-sm text-muted-foreground">Os acessos vêm dos contatos cadastrados em cada empresa (contato principal e departamentos), agrupados por e-mail. Para incluir alguém, cadastre o contato na empresa.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome, e-mail ou empresa" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar contato" />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="sm:w-48" aria-label="Situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {(Object.keys(STATUS_LABEL) as PortalStatus[]).map(k => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Contato</TableHead><TableHead className="hidden md:table-cell">Empresas</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>}
              {filtered.slice(0, 300).map(c => {
                const st = portalStatus(c);
                return (
                  <TableRow key={c.email}>
                    <TableCell>
                      <p className="font-medium">{c.names[0] || '—'}</p>
                      <p className="text-xs text-muted-foreground">{c.email}{c.phones[0] ? ` · ${c.phones[0]}` : ''}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                      <span className="line-clamp-2">{c.client_ids.map(id => clientName.get(id)).filter(Boolean).join(', ')}</span>
                    </TableCell>
                    <TableCell><Badge variant={st === 'active' ? 'default' : st === 'none' ? 'outline' : 'secondary'}>{STATUS_LABEL[st]}</Badge></TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      {st === 'none' && <Button size="sm" variant="outline" onClick={() => setGrant({ c, name: c.names[0] || c.email, whatsapp: c.phones[0] || '', password: genPwd() })}><UserPlus className="h-4 w-4 mr-1" />Liberar</Button>}
                      {(st === 'temp' || st === 'active') && <>
                        <Button size="icon" variant="ghost" aria-label="Reenviar senha" onClick={() => resend(c)}><KeyRound className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Bloquear acesso" onClick={() => block(c)}><Ban className="h-4 w-4" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">{contacts.length} pessoa(s) com e-mail cadastrado. E-mails do escritório são ignorados.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Mural de Avisos</CardTitle>
          <Button variant="outline" onClick={() => setAnnOpen(true)}><Megaphone className="h-4 w-4 mr-1" /> Novo aviso</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {anns.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>}
          {anns.map(a => (
            <div key={a.id} className="flex items-start gap-3 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.audience === 'all' ? 'Todos os clientes' : a.audience === 'regime' ? a.tax_regime : clientName.get(a.client_id || '')}
                  {a.expires_at && ` · até ${a.expires_at.split('-').reverse().join('/')}`}
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Excluir aviso" onClick={async () => { await db.from('portal_announcements').delete().eq('id', a.id); load(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!grant} onOpenChange={o => !o && setGrant(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Liberar acesso</DialogTitle></DialogHeader>
          {grant && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{grant.c.email} verá {grant.c.client_ids.length} empresa(s): {grant.c.client_ids.map(id => clientName.get(id)).filter(Boolean).join(', ')}</p>
            <div className="space-y-1"><Label htmlFor="g-name">Nome</Label><Input id="g-name" value={grant.name} onChange={e => setGrant({ ...grant, name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="g-wa">WhatsApp (envia as credenciais)</Label><Input id="g-wa" value={grant.whatsapp} onChange={e => setGrant({ ...grant, whatsapp: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="g-pwd">Senha temporária</Label><Input id="g-pwd" value={grant.password} onChange={e => setGrant({ ...grant, password: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button onClick={confirmGrant} disabled={busy}>{busy ? 'Liberando...' : 'Liberar e enviar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo aviso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="an-t">Título</Label><Input id="an-t" value={ann.title} onChange={e => setAnn({ ...ann, title: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="an-b">Mensagem</Label><Textarea id="an-b" rows={4} value={ann.body} onChange={e => setAnn({ ...ann, body: e.target.value })} /></div>
            <div className="space-y-1"><Label>Público</Label>
              <Select value={ann.audience} onValueChange={v => setAnn({ ...ann, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os clientes</SelectItem><SelectItem value="regime">Por regime</SelectItem><SelectItem value="client">Empresa específica</SelectItem></SelectContent>
              </Select>
            </div>
            {ann.audience === 'regime' && (
              <Select value={ann.tax_regime} onValueChange={v => setAnn({ ...ann, tax_regime: v })}>
                <SelectTrigger aria-label="Regime"><SelectValue /></SelectTrigger>
                <SelectContent>{['MEI', 'mei', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {ann.audience === 'client' && (
              <Select value={ann.client_id} onValueChange={v => setAnn({ ...ann, client_id: v })}>
                <SelectTrigger aria-label="Empresa"><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="space-y-1"><Label htmlFor="an-e">Expira em (opcional)</Label><Input id="an-e" type="date" value={ann.expires_at} onChange={e => setAnn({ ...ann, expires_at: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={publish}>Publicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
