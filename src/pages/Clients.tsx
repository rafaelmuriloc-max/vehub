import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Users, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

type Client = {
  id: string; company_name: string; document: string | null; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; address: string | null;
  status: 'active' | 'inactive' | 'churned'; monthly_value: number; start_date: string | null;
  end_date: string | null; notes: string | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-muted text-muted-foreground', churned: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', churned: 'Churned' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    company_name: '', document: '', contact_name: '', contact_email: '',
    contact_phone: '', address: '', status: 'active' as 'active' | 'inactive' | 'churned', monthly_value: '',
    start_date: '', end_date: '', notes: '',
  });

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    setClients((data as Client[]) || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ company_name: '', document: '', contact_name: '', contact_email: '', contact_phone: '', address: '', status: 'active', monthly_value: '', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' });
    setDialogOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      company_name: c.company_name, document: c.document || '', contact_name: c.contact_name || '',
      contact_email: c.contact_email || '', contact_phone: c.contact_phone || '', address: c.address || '',
      status: c.status, monthly_value: String(c.monthly_value || ''), start_date: c.start_date || '',
      end_date: c.end_date || '', notes: c.notes || '',
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      company_name: form.company_name, document: form.document || null, contact_name: form.contact_name || null,
      contact_email: form.contact_email || null, contact_phone: form.contact_phone || null, address: form.address || null,
      status: form.status as 'active' | 'inactive' | 'churned', monthly_value: Number(form.monthly_value) || 0,
      start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('clients').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('clients').insert({ ...payload, created_by: user?.id }));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setDialogOpen(false); loadClients(); toast({ title: editing ? 'Cliente atualizado' : 'Cliente criado' }); }
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = clients.filter(c => c.status === 'active').length;
  const churnedCount = clients.filter(c => c.status === 'churned').length;
  const mrr = clients.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const churnRate = clients.length > 0 ? (churnedCount / clients.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        {isAdmin && (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">MRR</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Churn Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">{churnRate.toFixed(1)}%</p></CardContent></Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.document || '-'}</TableCell>
                  <TableCell>{c.contact_name || '-'}</TableCell>
                  <TableCell>R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge></TableCell>
                  <TableCell>
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Razão Social *</Label><Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>CNPJ/CPF</Label><Input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contato</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <div className="col-span-2 space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={form.monthly_value} onChange={e => setForm({ ...form, monthly_value: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data Saída</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Salvar' : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
