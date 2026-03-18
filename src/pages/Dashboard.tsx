import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Users, TrendingDown, CheckSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState({
    totalClients: 0, activeClients: 0, churnedClients: 0, churnRate: 0,
    mrr: 0, pendingTasks: 0, overdueTasks: 0,
    monthRevenue: 0, monthExpenses: 0, balance: 0,
  });
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    const [{ data: clients }, { data: tasks }, { data: entries }] = await Promise.all([
      supabase.from('clients').select('status, monthly_value'),
      supabase.from('tasks').select('status, due_date'),
      supabase.from('financial_entries').select('type, amount, status, due_date, paid_date'),
    ]);

    const active = clients?.filter(c => c.status === 'active') || [];
    const churned = clients?.filter(c => c.status === 'churned') || [];
    const total = clients?.length || 0;
    const mrr = active.reduce((sum, c) => sum + Number(c.monthly_value || 0), 0);

    const today = new Date().toISOString().split('T')[0];
    const pending = tasks?.filter(t => t.status !== 'done') || [];
    const overdue = pending.filter(t => t.due_date && t.due_date < today);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEntries = entries?.filter(e => e.due_date >= monthStart) || [];
    const monthRevenue = monthEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + Number(e.amount), 0);
    const monthExpenses = monthEntries.filter(e => e.type === 'payable').reduce((s, e) => s + Number(e.amount), 0);

    setMetrics({
      totalClients: total, activeClients: active.length, churnedClients: churned.length,
      churnRate: total > 0 ? (churned.length / total) * 100 : 0,
      mrr, pendingTasks: pending.length, overdueTasks: overdue.length,
      monthRevenue, monthExpenses, balance: monthRevenue - monthExpenses,
    });

    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const mEntries = entries?.filter(e => e.due_date >= start && e.due_date <= end) || [];
      months.push({
        month: d.toLocaleDateString('pt-BR', { month: 'short' }),
        receitas: mEntries.filter(e => e.type === 'receivable').reduce((s, e) => s + Number(e.amount), 0),
        despesas: mEntries.filter(e => e.type === 'payable').reduce((s, e) => s + Number(e.amount), 0),
      });
    }
    setCashFlowData(months);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const cards = [
    { title: 'Receita do Mês', value: `R$ ${metrics.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, iconBg: 'bg-emerald-100 text-emerald-600' },
    { title: 'Despesas do Mês', value: `R$ ${metrics.monthExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingDown, iconBg: 'bg-red-100 text-red-500' },
    { title: 'Saldo', value: `R$ ${metrics.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, iconBg: metrics.balance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500' },
    { title: 'Clientes Ativos', value: metrics.activeClients.toString(), icon: Users, iconBg: 'bg-primary/10 text-primary' },
    { title: 'MRR', value: `R$ ${metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, iconBg: 'bg-primary/10 text-primary' },
    { title: 'Churn Rate', value: `${metrics.churnRate.toFixed(1)}%`, icon: TrendingDown, iconBg: 'bg-amber-100 text-amber-600' },
    { title: 'Tarefas Pendentes', value: metrics.pendingTasks.toString(), icon: CheckSquare, iconBg: 'bg-secondary/10 text-secondary' },
    { title: 'Tarefas Atrasadas', value: metrics.overdueTasks.toString(), icon: AlertTriangle, iconBg: 'bg-red-100 text-red-500' },
  ];

  const pieData = [
    { name: 'Ativos', value: metrics.activeClients },
    { name: 'Inativos', value: metrics.totalClients - metrics.activeClients - metrics.churnedClients },
    { name: 'Churned', value: metrics.churnedClients },
  ].filter(d => d.value > 0);
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--destructive))'];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Aqui está o resumo do seu escritório</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => (
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

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de Caixa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="receitas" fill="hsl(var(--chart-1))" name="Receitas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="hsl(var(--chart-2))" name="Despesas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de Clientes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
