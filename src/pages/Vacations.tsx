import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, Building2, Calendar as CalendarIcon, Check, ChevronsUpDown, Clock,
  FolderSync, Loader2, Palmtree, Search, Users,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  analyzeEmployees, dueByMonth, fmtDate, fmtDays, statusClass, statusLabel, todayKeySP,
  totalsByCompany, type EmployeeAnalysis, type PeriodStatus, type VacationPeriodRow,
} from '@/lib/vacations';

interface Client { id: string; company_name: string; document: string | null; sci_code: string | null; status: string }
interface Employee { id: string; client_id: string; full_name: string; employee_code: string | null; status: string }

type SortKey = 'overdue' | 'total' | 'due' | 'name';
type CardKey = 'people' | 'overduePeople' | 'overdueDays' | 'acquired' | 'accruing' | 'soon' | 'total' | 'companies';

const CHART_COLORS = ['hsl(var(--destructive))', 'hsl(38 92% 50%)', 'hsl(142 71% 40%)', 'hsl(217 91% 60%)'];

export default function Vacations() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<VacationPeriodRow[]>([]);

  const [companyId, setCompanyId] = useState<string>('all');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [reference, setReference] = useState(todayKeySP());
  const [horizon, setHorizon] = useState(30);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PeriodStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('overdue');
  const [barMetric, setBarMetric] = useState<'totalDays' | 'overdueDays' | 'acquiredDays' | 'accruingDays'>('overdueDays');

  const [detail, setDetail] = useState<EmployeeAnalysis | null>(null);
  const [cardDialog, setCardDialog] = useState<CardKey | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cliRes, empRes, vacRes] = await Promise.all([
      supabase.from('clients').select('id, company_name, document, sci_code, status').order('company_name'),
      supabase.from('client_employees').select('id, client_id, full_name, employee_code, status'),
      supabase.from('employee_vacation_periods').select('*'),
    ]);
    if (cliRes.data) setClients((cliRes.data as Client[]).filter(c => c.status === 'active'));
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (vacRes.data) setPeriods(vacRes.data as unknown as VacationPeriodRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function syncVacations() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-folder-sync', {
        body: { only: 'ferias', force_reprocess: true },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error);
      const s = data?.stats ?? {};
      toast({
        title: 'Relatório de férias sincronizado',
        description: `${s.fichas_lidas ?? 0} arquivo(s) lido(s), ${s.ferias_periodos ?? 0} período(s) de ${s.ferias_funcionarios ?? 0} colaborador(es).`,
      });
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
      loadAll();
    }
  }

  // Colaboradores ativos de empresas ativas apenas
  const activeClientIds = useMemo(() => new Set(clients.map(c => c.id)), [clients]);
  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'active' && activeClientIds.has(e.client_id)),
    [employees, activeClientIds],
  );

  const allAnalysis = useMemo(
    () => analyzeEmployees(periods, activeEmployees, clients, reference),
    [periods, activeEmployees, clients, reference],
  );

  const analysis = useMemo(
    () => (companyId === 'all' ? allAnalysis : allAnalysis.filter(a => a.clientId === companyId)),
    [allAnalysis, companyId],
  );

  const companies = useMemo(() => {
    const ids = new Set(allAnalysis.map(a => a.clientId));
    return clients.filter(c => ids.has(c.id));
  }, [clients, allAnalysis]);

  const kpis = useMemo(() => {
    let overdueDays = 0, acquiredDays = 0, accruingDays = 0, totalDays = 0;
    let overduePeople = 0, soonPeople = 0;
    for (const a of analysis) {
      overdueDays += a.overdueDays;
      acquiredDays += a.acquiredDays;
      accruingDays += a.accruingDays;
      totalDays += a.totalDays;
      if (a.overdueDays > 0) overduePeople++;
      if (a.periods.some(p => p.days > 0 && p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= horizon)) soonPeople++;
    }
    const companiesWithIssues = new Set(analysis.filter(a => a.overdueDays > 0).map(a => a.clientId)).size;
    return { people: analysis.length, overduePeople, overdueDays, acquiredDays, accruingDays, soonPeople, totalDays, companiesWithIssues };
  }, [analysis, horizon]);

  const companyTotals = useMemo(() => totalsByCompany(analysis), [analysis]);
  const monthly = useMemo(() => dueByMonth(analysis, reference), [analysis, reference]);

  const pieData = useMemo(() => [
    { key: 'overdue', name: 'Vencidas', value: kpis.overdueDays },
    { key: 'acquired', name: 'Adquiridas no prazo', value: kpis.acquiredDays },
    { key: 'accruing', name: 'Em formação', value: kpis.accruingDays },
  ].filter(d => d.value > 0), [kpis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = analysis.filter(a =>
      (!q || a.name.toLowerCase().includes(q) || (a.code ?? '').toLowerCase() === q)
      && (statusFilter === 'all' || a.status === statusFilter),
    );
    list = [...list].sort((a, b) => {
      if (sortKey === 'overdue') return b.overdueDays - a.overdueDays || a.name.localeCompare(b.name, 'pt-BR');
      if (sortKey === 'total') return b.totalDays - a.totalDays || a.name.localeCompare(b.name, 'pt-BR');
      if (sortKey === 'due') return (a.nextDueDate ?? '9999').localeCompare(b.nextDueDate ?? '9999');
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return list;
  }, [analysis, search, statusFilter, sortKey]);

  const lastReport = useMemo(() => {
    // Data mais recente de prazo importado serve apenas para o aviso de defasagem.
    return periods.length > 0 ? periods[0].source_file : null;
  }, [periods]);

  const cardList = useMemo((): { title: string; items: EmployeeAnalysis[] } | null => {
    if (!cardDialog) return null;
    const map: Record<CardKey, { title: string; items: EmployeeAnalysis[] }> = {
      people: { title: 'Colaboradores', items: analysis },
      overduePeople: { title: 'Colaboradores com férias vencidas', items: analysis.filter(a => a.overdueDays > 0) },
      overdueDays: { title: 'Dias de férias vencidas', items: analysis.filter(a => a.overdueDays > 0) },
      acquired: { title: 'Férias adquiridas dentro do prazo', items: analysis.filter(a => a.acquiredDays > 0) },
      accruing: { title: 'Dias em formação', items: analysis.filter(a => a.accruingDays > 0) },
      soon: {
        title: `Próximos vencimentos (${horizon} dias)`,
        items: analysis.filter(a => a.periods.some(p => p.days > 0 && p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= horizon)),
      },
      total: { title: 'Saldo total de férias', items: analysis },
      companies: { title: 'Empresas com pendências', items: analysis.filter(a => a.overdueDays > 0) },
    };
    return map[cardDialog];
  }, [cardDialog, analysis, horizon]);

  const selectedCompanyName = companyId === 'all'
    ? 'Todas as empresas'
    : clients.find(c => c.id === companyId)?.company_name ?? 'Empresa';

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const kpiCards: { key: CardKey; label: string; value: string; hint?: string; danger?: boolean; icon: typeof Users }[] = [
    { key: 'people', label: 'Total de colaboradores', value: String(kpis.people), hint: `${companyTotals.length} empresa(s)`, icon: Users },
    { key: 'overduePeople', label: 'Colaboradores com férias vencidas', value: String(kpis.overduePeople), danger: true, hint: 'Prazo de concessão ultrapassado', icon: AlertTriangle },
    { key: 'overdueDays', label: 'Dias de férias vencidas', value: fmtDays(kpis.overdueDays), danger: true, icon: AlertTriangle },
    { key: 'acquired', label: 'Férias adquiridas', value: fmtDays(kpis.acquiredDays), hint: 'Dias dentro do prazo', icon: Palmtree },
    { key: 'accruing', label: 'Dias em formação', value: fmtDays(kpis.accruingDays), hint: 'Períodos não concluídos', icon: Clock },
    { key: 'soon', label: `Próximos vencimentos (${horizon} d)`, value: String(kpis.soonPeople), hint: 'Colaboradores', icon: CalendarIcon },
    { key: 'total', label: 'Saldo total de férias', value: fmtDays(kpis.totalDays), hint: 'Todos os períodos', icon: Palmtree },
  ];
  if (companyId === 'all') {
    kpiCards.push({ key: 'companies', label: 'Empresas com pendências', value: String(kpis.companiesWithIssues), danger: true, icon: Building2 });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Férias</h1>
          <p className="text-sm text-muted-foreground">
            Períodos aquisitivos importados do SCI — {selectedCompanyName}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full sm:w-72 justify-between">
                <span className="truncate">{selectedCompanyName}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por nome, CNPJ ou código..." />
                <CommandList>
                  <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="Todas as empresas" onSelect={() => { setCompanyId('all'); setCompanyOpen(false); }}>
                      <Check className={cn('mr-2 h-4 w-4', companyId === 'all' ? 'opacity-100' : 'opacity-0')} />
                      Todas as empresas
                    </CommandItem>
                    {companies.map(c => (
                      <CommandItem
                        key={c.id}
                        value={`${c.company_name} ${c.document ?? ''} ${c.sci_code ?? ''}`}
                        onSelect={() => { setCompanyId(c.id); setCompanyOpen(false); }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', companyId === c.id ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{c.sci_code ? `${c.sci_code} - ` : ''}{c.company_name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Data de referência</span>
            <Input type="date" className="w-40" value={reference} onChange={e => setReference(e.target.value || todayKeySP())} />
          </div>

          <Select value={String(horizon)} onValueChange={v => setHorizon(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="60">Próximos 60 dias</SelectItem>
              <SelectItem value="90">Próximos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={syncVacations} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FolderSync className="h-4 w-4 mr-1" />}
            Sincronizar férias
          </Button>
        </div>
      </div>

      {reference > todayKeySP() && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          A data escolhida é posterior a hoje: os saldos podem estar desatualizados até uma nova importação
          {lastReport ? ` (último arquivo: ${lastReport})` : ''}.
        </div>
      )}

      {periods.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum período de férias importado ainda. Use o botão “Sincronizar férias”.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map(k => (
              <Card
                key={k.key}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => setCardDialog(k.key)}
              >
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{k.label}</span>
                    <div className={cn('text-3xl font-bold tabular-nums leading-none', k.danger && Number(k.value.replace(/\D/g, '')) > 0 ? 'text-destructive' : 'text-foreground')}>
                      {k.value}
                    </div>
                    {k.hint && <p className="text-xs text-muted-foreground truncate">{k.hint}</p>}
                  </div>
                  <k.icon className="h-7 w-7 text-muted-foreground/40 shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Situação das férias</CardTitle></CardHeader>
              <CardContent className="h-72">
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">Sem dias registrados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}
                        onClick={(d: { key?: string }) => setStatusFilter(d?.key === 'overdue' ? 'overdue' : d?.key === 'accruing' ? 'accruing' : 'all')}
                      >
                        {pieData.map((d, i) => <Cell key={d.key} fill={CHART_COLORS[i === 0 ? 0 : i === 1 ? 2 : 3]} className="cursor-pointer" />)}
                      </Pie>
                      <RTooltip formatter={(v: number, n: string) => [`${fmtDays(v)} dia(s)`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap justify-center gap-3 -mt-2">
                  {pieData.map((d, i) => (
                    <span key={d.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i === 0 ? 0 : i === 1 ? 2 : 3] }} />
                      {d.name}: {fmtDays(d.value)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {companyId === 'all' ? (
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Férias por empresa</CardTitle>
                  <Select value={barMetric} onValueChange={v => setBarMetric(v as typeof barMetric)}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overdueDays">Dias vencidos</SelectItem>
                      <SelectItem value="acquiredDays">Dias adquiridos</SelectItem>
                      <SelectItem value="accruingDays">Dias em formação</SelectItem>
                      <SelectItem value="totalDays">Total de dias</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...companyTotals].sort((a, b) => b[barMetric] - a[barMetric]).slice(0, 12)}
                      layout="vertical" margin={{ left: 8, right: 16 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="companyName" width={140} tick={{ fontSize: 10 }} />
                      <RTooltip formatter={(v: number) => [`${fmtDays(v)} dia(s)`, 'Dias']} />
                      <Bar
                        dataKey={barMetric} radius={[0, 4, 4, 0]} className="cursor-pointer"
                        fill={barMetric === 'overdueDays' ? CHART_COLORS[0] : CHART_COLORS[3]}
                        onClick={(d: { clientId?: string }) => d?.clientId && setCompanyId(d.clientId)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Resumo da empresa</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {companyTotals.map(t => (
                    <div key={t.clientId} className="space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Colaboradores</span><span className="tabular-nums">{t.employees}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Com férias vencidas</span><span className="tabular-nums text-destructive">{t.employeesOverdue}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Dias vencidos</span><span className="tabular-nums">{fmtDays(t.overdueDays)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Dias adquiridos no prazo</span><span className="tabular-nums">{fmtDays(t.acquiredDays)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Dias em formação</span><span className="tabular-nums">{fmtDays(t.accruingDays)}</span></div>
                      <div className="flex justify-between font-medium"><span>Saldo total</span><span className="tabular-nums">{fmtDays(t.totalDays)}</span></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Vencimentos nos próximos 12 meses</CardTitle></CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: number) => [`${fmtDays(v)} dia(s)`, 'Dias a vencer']} />
                  <Bar dataKey="days" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar colaborador por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="overdue">Vencidas</SelectItem>
                  <SelectItem value="soon">A vencer</SelectItem>
                  <SelectItem value="ok">No prazo</SelectItem>
                  <SelectItem value="accruing">Em formação</SelectItem>
                  <SelectItem value="empty">Sem saldo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overdue">Mais dias vencidos</SelectItem>
                  <SelectItem value="total">Maior saldo</SelectItem>
                  <SelectItem value="due">Prazo mais próximo</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Código</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                    <TableHead className="text-right">Vencidas</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Adquiridas</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Em formação</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="hidden md:table-cell">Próximo prazo</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum colaborador nesta seleção.
                    </TableCell></TableRow>
                  ) : filtered.map(a => (
                    <TableRow key={a.employeeId} className="cursor-pointer" onClick={() => setDetail(a)}>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">{a.code ?? '—'}</TableCell>
                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[220px]">{a.companyName}</TableCell>
                      <TableCell className={cn('text-right text-sm tabular-nums', a.overdueDays > 0 && 'text-destructive font-medium')}>{fmtDays(a.overdueDays)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums hidden sm:table-cell">{fmtDays(a.acquiredDays)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums hidden md:table-cell">{fmtDays(a.accruingDays)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">{fmtDays(a.totalDays)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm whitespace-nowrap">{fmtDate(a.nextDueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass[a.status]}>{statusLabel[a.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  {detail.companyName} · código {detail.code ?? '—'} · saldo {fmtDays(detail.totalDays)} dia(s)
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Dias vencidos</p>
                  <p className="text-xl font-bold tabular-nums text-destructive">{fmtDays(detail.overdueDays)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Adquiridos no prazo</p>
                  <p className="text-xl font-bold tabular-nums">{fmtDays(detail.acquiredDays)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Em formação</p>
                  <p className="text-xl font-bold tabular-nums">{fmtDays(detail.accruingDays)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Períodos aquisitivos</p>
                  <p className="text-xl font-bold tabular-nums">{detail.periods.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                {detail.periods.map(p => (
                  <div key={p.period.id} className="rounded-md border p-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {fmtDate(p.period.acquisition_start)} a {fmtDate(p.period.acquisition_end)}
                      </span>
                      <Badge variant="outline" className={statusClass[p.status]}>{statusLabel[p.status]}</Badge>
                    </div>
                    <div className="text-muted-foreground">Dias de direito: <span className="text-foreground tabular-nums">{fmtDays(p.days)}</span></div>
                    <div className="text-muted-foreground">
                      Deverá gozar entre: <span className="text-foreground">{fmtDate(p.period.enjoy_start)} a {fmtDate(p.period.enjoy_end)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Prazo final sem dobro: <span className="text-foreground">{fmtDate(p.period.deadline_date)}</span>
                      {p.daysLeft !== null && (
                        <span className={cn('ml-1', p.daysLeft < 0 ? 'text-destructive' : p.daysLeft <= 60 ? 'text-amber-600' : '')}>
                          {p.daysLeft < 0 ? `· ${Math.abs(p.daysLeft)} dia(s) de atraso` : p.daysLeft === 0 ? '· vence hoje' : `· faltam ${p.daysLeft} dia(s)`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!cardDialog} onOpenChange={o => !o && setCardDialog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cardList?.title}</DialogTitle>
            <DialogDescription>
              {cardList?.items.length ?? 0} colaborador(es) em {selectedCompanyName.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y border rounded-md">
            {(cardList?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nada a mostrar.</p>
            ) : cardList!.items.map(a => (
              <button
                key={a.employeeId}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent/50"
                onClick={() => { setCardDialog(null); setDetail(a); }}
              >
                <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">{a.code ?? '—'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{a.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{a.companyName}</span>
                </span>
                <span className="text-right shrink-0 text-xs">
                  <span className={cn('block tabular-nums', a.overdueDays > 0 && 'text-destructive font-medium')}>
                    {fmtDays(a.overdueDays)} vencido(s)
                  </span>
                  <span className="block text-muted-foreground tabular-nums">saldo {fmtDays(a.totalDays)}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
