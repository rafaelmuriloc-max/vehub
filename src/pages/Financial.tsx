import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users, CheckSquare, Receipt, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { IntegrationsTab } from '@/components/financial/IntegrationsTab';
import { BankAccountsTab } from '@/components/financial/BankAccountsTab';
import { CostCentersTab } from '@/components/financial/CostCentersTab';
import { RecurringEntriesTab } from '@/components/financial/RecurringEntriesTab';
import { AsaasChargesTab } from '@/components/financial/AsaasChargesTab';
import { DreTab } from '@/components/financial/DreTab';
import { BillPaymentDialog } from '@/components/financial/BillPaymentDialog';

type Entry = {
  id: string; description: string; amount: number; type: 'receivable' | 'payable';
  status: 'pending' | 'paid' | 'overdue'; due_date: string; paid_date: string | null;
  category_id: string | null; client_id: string | null; created_by: string | null;
  cost_center_id?: string | null; bank_account_id?: string | null; asaas_charge_id?: string | null;
};
type Category = { id: string; name: string; type: 'receivable' | 'payable' };
type Client = { id: string; company_name: string };
type ClientFull = { status: string; monthly_value: number | null; start_date: string | null; end_date: string | null; created_at: string | null; opening_date: string | null };
type TaskRow = { status: string; due_date: string | null };

const statusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-emerald-100 text-emerald-800', overdue: 'bg-red-100 text-red-800' };
const statusLabels: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido' };

export default function Financial() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsFull, setClientsFull] = useState<ClientFull[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [billDialog, setBillDialog] = useState<Entry | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const { isAdmin, user, profile } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    description: '', amount: '', type: 'receivable' as 'receivable' | 'payable',
    status: 'pending' as 'pending' | 'paid' | 'overdue', due_date: '', paid_date: '',
    category_id: '', client_id: '', cost_center_id: '', bank_account_id: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: e }, { data: c }, { data: cl }, { data: clFull }, { data: tk }, { data: cc }, { data: ba }] = await Promise.all([
      supabase.from('financial_entries').select('*').order('due_date', { ascending: false }),
      supabase.from('financial_categories').select('*').order('name'),
      supabase.from('clients').select('id, company_name').order('company_name'),
      supabase.from('clients').select('status, monthly_value, start_date, end_date, created_at, opening_date').eq('without_monthly_fee', false),
      supabase.from('tasks').select('status, due_date'),
      supabase.from('cost_centers').select('id, name').eq('active', true),
      supabase.from('bank_accounts').select('id, name').eq('active', true),
    ]);
    setEntries((e as Entry[]) || []);
    setCategories((c as Category[]) || []);
    setClients((cl as Client[]) || []);
    setClientsFull((clFull as ClientFull[]) || []);
    setTasks((tk as TaskRow[]) || []);
    setCostCenters(cc || []);
    setBankAccounts(ba || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ description: '', amount: '', type: 'receivable', status: 'pending', due_date: '', paid_date: '', category_id: '', client_id: '', cost_center_id: '', bank_account_id: '' });
    setDialogOpen(true);
  }

  function openEdit(entry: Entry) {
    setEditing(entry);
    setForm({
      description: entry.description, amount: String(entry.amount), type: entry.type,
      status: entry.status, due_date: entry.due_date, paid_date: entry.paid_date || '',
      category_id: entry.category_id || '', client_id: entry.client_id || '',
      cost_center_id: (entry as any).cost_center_id || '', bank_account_id: (entry as any).bank_account_id || '',
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      description: form.description, amount: Number(form.amount), type: form.type,
      status: form.status, due_date: form.due_date, paid_date: form.paid_date || null,
      category_id: form.category_id || null, client_id: form.client_id || null,
      cost_center_id: form.cost_center_id || null, bank_account_id: form.bank_account_id || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('financial_entries').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('financial_entries').insert({ ...payload, created_by: user?.id }));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setDialogOpen(false); loadData(); toast({ title: editing ? 'Lançamento atualizado' : 'Lançamento criado' }); }
  }

  async function generateCharge(entry: Entry) {
    if (!entry.client_id) { toast({ title: 'Vincule um cliente ao lançamento', variant: 'destructive' }); return; }
    setGenerating(entry.id);
    const { data, error } = await supabase.functions.invoke('asaas-charge-create', { body: { entry_id: entry.id } });
    setGenerating(null);
    if (error || data?.error) toast({ title: 'Erro', description: error?.message || data?.error, variant: 'destructive' });
    else { toast({ title: 'Cobrança gerada', description: data.charge?.invoiceUrl ? 'Veja na aba Cobranças Asaas' : '' }); loadData(); }
  }

  const filtered = entries.filter(e => {
    return (filterType === 'all' || e.type === filterType) && (filterStatus === 'all' || e.status === filterStatus);
  });

  const totalReceivable = entries.filter(e => e.type === 'receivable').reduce((s, e) => s + Number(e.amount), 0);
  const totalPayable = entries.filter(e => e.type === 'payable').reduce((s, e) => s + Number(e.amount), 0);
  const totalOverdue = entries.filter(e => e.status === 'overdue').reduce((s, e) => s + Number(e.amount), 0);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEntries = entries.filter(e => e.due_date >= monthStartStr);
  const monthRevenue = monthEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = monthEntries.filter(e => e.type === 'payable').reduce((s, e) => s + Number(e.amount), 0);
  const balance = monthRevenue - monthExpenses;

  const activeClients = clientsFull.filter(c => c.status === 'active');
  const churnedClients = clientsFull.filter(c => c.status === 'churned');
  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const churnRate = clientsFull.length > 0 ? (churnedClients.length / clientsFull.length) * 100 : 0;
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < todayStr);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const kpiCards = [
    { title: 'Receita do Mês', value: `R$ ${monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, iconBg: 'bg-emerald-100 text-emerald-600' },
    { title: 'Despesas do Mês', value: `R$ ${monthExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingDown, iconBg: 'bg-red-100 text-red-500' },
    { title: 'Saldo', value: `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, iconBg: balance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500' },
    { title: 'Clientes Ativos', value: activeClients.length.toString(), icon: Users, iconBg: 'bg-primary/10 text-primary' },
    { title: 'MRR', value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, iconBg: 'bg-primary/10 text-primary' },
    { title: 'Churn Rate', value: `${churnRate.toFixed(1)}%`, icon: TrendingDown, iconBg: 'bg-amber-100 text-amber-600' },
    { title: 'Tarefas Pendentes', value: pendingTasks.length.toString(), icon: CheckSquare, iconBg: 'bg-secondary/10 text-secondary' },
    { title: 'Tarefas Atrasadas', value: overdueTasks.length.toString(), icon: AlertTriangle, iconBg: 'bg-red-100 text-red-500' },
  ];

  const pieData = [
    { name: 'Ativos', value: activeClients.length },
    { name: 'Inativos', value: clientsFull.length - activeClients.length - churnedClients.length },
    { name: 'Churned', value: churnedClients.length },
  ].filter(d => d.value > 0);
  const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--destructive))'];

  // Evolution data desde jan/2021
  const evoData: { month: string; clientes: number; novos: number; mrr: number }[] = [];
  const startEvo = new Date(2021, 0, 1);
  for (let d = new Date(startEvo); d <= now; d.setMonth(d.getMonth() + 1)) {
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const mStart = d.toISOString().split('T')[0];
    const openedUntil = clientsFull.filter(c => c.opening_date && c.opening_date <= mEnd);
    const activeIn = clientsFull.filter(c => {
      const start = c.start_date || c.created_at?.split('T')[0];
      if (!start || start > mEnd) return false;
      if (c.end_date && c.end_date < mStart) return false;
      return true;
    });
    const newIn = clientsFull.filter(c => c.opening_date && c.opening_date >= mStart && c.opening_date <= mEnd);
    evoData.push({
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      clientes: openedUntil.length,
      novos: newIn.length,
      mrr: activeIn.reduce((s, c) => s + Number(c.monthly_value || 0), 0),
    });
  }

  // Cash flow data (6 meses)
  const cashFlowData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const start = d.toISOString().split('T')[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const mEntries = entries.filter(e => e.due_date >= start && e.due_date <= end);
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short' }),
      receitas: mEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + Number(e.amount), 0),
      despesas: mEntries.filter(e => e.type === 'payable').reduce((s, e) => s + Number(e.amount), 0),
    };
  });

  const filteredCategories = categories.filter(c => c.type === form.type);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Aqui está o resumo do seu escritório</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Financeiro</h2>
        {isAdmin && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Lançamento</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(card => (
          <Card key={card.title} className="border-l-4 border-l-primary/30 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A Receber (total)</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-emerald-600">R$ {totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A Pagar (total)</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-red-500">R$ {totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo (total)</CardTitle></CardHeader><CardContent><p className={`text-xl font-bold ${totalReceivable - totalPayable >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>R$ {(totalReceivable - totalPayable).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Inadimplência</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-orange-500">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="entries">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="entries">Lançamentos</TabsTrigger>
          <TabsTrigger value="recurring">Recorrências</TabsTrigger>
          <TabsTrigger value="accounts">Contas Bancárias</TabsTrigger>
          <TabsTrigger value="costcenters">Centros de Custo</TabsTrigger>
          <TabsTrigger value="asaas">Cobranças Asaas</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="space-y-4">
          <div className="flex gap-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="receivable">A Receber</SelectItem>
                <SelectItem value="payable">A Pagar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{entry.type === 'receivable' ? 'Receber' : 'Pagar'}</TableCell>
                      <TableCell>R$ {Number(entry.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{new Date(entry.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell><Badge className={statusColors[entry.status]}>{statusLabels[entry.status]}</Badge></TableCell>
                      <TableCell>{isAdmin && <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>Editar</Button>}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cashflow">
          <Card>
            <CardHeader><CardTitle>Fluxo de Caixa - Últimos 6 meses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="receitas" fill="hsl(var(--chart-1))" name="Receitas" />
                  <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição de Clientes</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução de Clientes (por abertura)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="clientes" stroke="hsl(var(--chart-1))" name="Acumulado" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="novos" stroke="hsl(var(--chart-3))" name="Novos no Mês" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução do MRR</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Line type="monotone" dataKey="mrr" stroke="hsl(var(--chart-3))" name="MRR" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receivable">A Receber</SelectItem>
                    <SelectItem value="payable">A Pagar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data Pagamento</Label><Input type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Salvar' : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
