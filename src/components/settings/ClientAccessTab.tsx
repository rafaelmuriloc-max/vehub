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
import { KeyRound, Megaphone, Trash2, UserPlus, Link2 } from 'lucide-react';

type Client = { id: string; company_name: string; document: string | null; tax_regime: string | null };
type Access = { user_id: string; full_name: string | null; must_change_password: boolean; client_ids: string[] };
type Ann = { id: string; title: string; body: string; audience: string; tax_regime: string | null; client_id: string | null; expires_at: string | null; created_at: string };

const db = supabase as any;

function genPwd() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, n => a[n % a.length]).join('') + '!7';
}

function CompanyPicker({ clients, value, onChange }: { clients: Client[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const list = clients.filter(c => !q || `${c.company_name} ${c.document}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div className="space-y-2">
      <Input placeholder="Buscar empresa ou CNPJ" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar empresa" />
      <div className="max-h-56 overflow-auto rounded-md border border-border p-2 space-y-1">
        {list.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={value.includes(c.id)} onCheckedChange={v => onChange(v ? [...value, c.id] : value.filter(x => x !== c.id))} />
            <span className="truncate">{c.company_name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{c.tax_regime}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{value.length} empresa(s) selecionada(s)</p>
    </div>
  );
}

export function ClientAccessTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [accesses, setAccesses] = useState<Access[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', whatsapp: '', password: '', client_ids: [] as string[] });
  const [linkFor, setLinkFor] = useState<Access | null>(null);
  const [linkIds, setLinkIds] = useState<string[]>([]);
  const [annOpen, setAnnOpen] = useState(false);
  const [ann, setAnn] = useState({ title: '', body: '', audience: 'all', tax_regime: 'Simples Nacional', client_id: '', expires_at: '' });

  const clientName = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);

  async function load() {
    const [{ data: cl }, { data: roles }, { data: links }, { data: a }] = await Promise.all([
      supabase.from('clients').select('id, company_name, document, tax_regime').order('company_name'),
      db.from('user_roles').select('user_id, role').eq('role', 'client'),
      db.from('client_portal_links').select('user_id, client_id'),
      db.from('portal_announcements').select('*').order('created_at', { ascending: false }),
    ]);
    setClients((cl as Client[]) || []);
    setAnns((a as Ann[]) || []);
    const ids = ((roles as any[]) || []).map(r => r.user_id);
    if (!ids.length) { setAccesses([]); return; }
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name, must_change_password').in('user_id', ids);
    setAccesses(((profs as any[]) || []).map(p => ({
      user_id: p.user_id, full_name: p.full_name, must_change_password: !!p.must_change_password,
      client_ids: ((links as any[]) || []).filter(l => l.user_id === p.user_id).map(l => l.client_id),
    })));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.email || !form.full_name || form.client_ids.length === 0) {
      toast({ title: 'Preencha nome, e-mail e ao menos uma empresa', variant: 'destructive' }); return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'create', role: 'client', ...form } });
    setBusy(false);
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    toast({ title: 'Acesso criado', description: data.whatsapp_sent ? 'Credenciais enviadas por WhatsApp.' : `Senha temporária: ${form.password}${data.whatsapp_error ? ` (WhatsApp: ${data.whatsapp_error})` : ''}` });
    setCreateOpen(false); load();
  }

  async function resend(a: Access) {
    const phone = window.prompt(`WhatsApp para reenviar o acesso de ${a.full_name}:`);
    if (!phone) return;
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'send-access', user_id: a.user_id, whatsapp: phone } });
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    toast({ title: 'Nova senha gerada', description: data.whatsapp_sent ? 'Enviada por WhatsApp.' : `Senha: ${data.temp_password}` });
    load();
  }

  async function removeAccess(a: Access) {
    if (!window.confirm(`Desativar o acesso de ${a.full_name}?`)) return;
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'delete', user_id: a.user_id } });
    if (error || data?.error) { toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' }); return; }
    load();
  }

  async function saveLinks() {
    if (!linkFor) return;
    const toAdd = linkIds.filter(id => !linkFor.client_ids.includes(id));
    const toDel = linkFor.client_ids.filter(id => !linkIds.includes(id));
    if (toAdd.length) await db.from('client_portal_links').insert(toAdd.map(client_id => ({ user_id: linkFor.user_id, client_id })));
    if (toDel.length) await db.from('client_portal_links').delete().eq('user_id', linkFor.user_id).in('client_id', toDel);
    setLinkFor(null); load();
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Acessos da Área do Cliente</CardTitle>
          <Button onClick={() => { setForm({ full_name: '', email: '', whatsapp: '', password: genPwd(), client_ids: [] }); setCreateOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Novo acesso
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="hidden md:table-cell">Empresas</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {accesses.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum acesso criado.</TableCell></TableRow>}
              {accesses.map(a => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium">{a.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{a.client_ids.map(id => clientName.get(id)).filter(Boolean).join(', ') || '—'}</TableCell>
                  <TableCell>{a.must_change_password ? <Badge variant="secondary">Senha temporária</Badge> : <Badge>Ativo</Badge>}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" aria-label="Empresas vinculadas" onClick={() => { setLinkFor(a); setLinkIds(a.client_ids); }}><Link2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Reenviar acesso" onClick={() => resend(a)}><KeyRound className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Desativar acesso" onClick={() => removeAccess(a)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo acesso de cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="ca-name">Nome</Label><Input id="ca-name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="ca-email">E-mail de acesso</Label><Input id="ca-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="ca-wa">WhatsApp (envia as credenciais)</Label><Input id="ca-wa" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(48) 99999-9999" /></div>
            <div className="space-y-1"><Label htmlFor="ca-pwd">Senha temporária</Label><Input id="ca-pwd" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1"><Label>Empresas</Label><CompanyPicker clients={clients} value={form.client_ids} onChange={v => setForm({ ...form, client_ids: v })} /></div>
          </div>
          <DialogFooter><Button onClick={create} disabled={busy}>{busy ? 'Criando...' : 'Criar e enviar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkFor} onOpenChange={o => !o && setLinkFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Empresas de {linkFor?.full_name}</DialogTitle></DialogHeader>
          <CompanyPicker clients={clients} value={linkIds} onChange={setLinkIds} />
          <DialogFooter><Button onClick={saveLinks}>Salvar</Button></DialogFooter>
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
