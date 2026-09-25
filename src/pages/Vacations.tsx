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
  AlertTriangle, ArrowLeft, Building2, CalendarX, Check, ChevronsUpDown, Clock,
  Loader2, MoreVertical, RefreshCw, Search, Users, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setPage(0); }, [search, statusFilter, sortKey, companyId, reference, pageSize]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = analysis.filter(a =>
      (!q || a.name.toLowerCase().includes(q) || a.companyName.toLowerCase().includes(q)
        || (a.code ?? '').replace(/^0+/, '') === q.replace(/^0+/, ''))
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pct = (v: number) => (kpis.totalDays > 0 ? (v / kpis.totalDays) * 100 : 0);
  const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const companyBars = [...companyTotals].filter(t => t[barMetric] > 0).sort((a, b) => b[barMetric] - a[barMetric]);
  const shownBars = showAllCompanies ? companyBars : companyBars.slice(0, 5);
  const metricLabel: Record<typeof barMetric, string> = {
    overdueDays: 'Dias vencidos', acquiredDays: 'Dias adquiridos', accruingDays: 'Dias em formação', totalDays: 'Total de dias',
  };
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  const composition = [
    { key: 'overdue' as const, label: 'Vencidas', value: kpis.overdueDays, bar: 'bg-pr-red', dot: 'bg-pr-red' },
    { key: 'ok' as const, label: 'Adquiridas no prazo', value: kpis.acquiredDays, bar: 'bg-pr-green', dot: 'bg-pr-green' },
    { key: 'accruing' as const, label: 'Em formação', value: kpis.accruingDays, bar: 'bg-blue-600', dot: 'bg-blue-600' },
  ];

  const kpiCards: { key: CardKey; label: string; value: string; hint: string; tone: 'red' | 'blue'; icon: typeof Users; tip: string }[] = [
    { key: 'overduePeople', label: 'Colaboradores com férias vencidas', value: String(kpis.overduePeople), hint: 'pessoas únicas', tone: 'red', icon: Users, tip: 'Colaboradores com ao menos um período com prazo de concessão ultrapassado.' },
    { key: 'overdueDays', label: 'Dias de férias vencidas', value: fmtDays(kpis.overdueDays), hint: 'saldo em dias', tone: 'red', icon: CalendarX, tip: 'Soma dos dias de direito dos períodos vencidos.' },
    { key: 'companies', label: 'Empresas com pendências', value: String(kpis.companiesWithIssues), hint: 'com férias vencidas', tone: 'red', icon: Building2, tip: 'Empresas com pelo menos um colaborador com férias vencidas.' },
    { key: 'soon', label: 'Próximos vencimentos', value: String(kpis.soonPeople), hint: `colaborador(es) — nos próximos ${horizon} dias`, tone: 'blue', icon: Clock, tip: 'Colaboradores com prazo que vence dentro do horizonte escolhido.' },
  ];

  return (
    <div className="-m-6 min-h-full bg-pr-bg text-pr-text p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center gap-2 text-sm text-pr-muted">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Voltar para Pessoal" onClick={() => navigate('/personnel')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span>Departamento pessoal</span><span>/</span><span className="font-semibold text-pr-text">Férias</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Gestão de férias</h1>
          <p className="text-pr-muted mt-1">Antecipe vencimentos e acompanhe os saldos da sua carteira.</p>
        </div>
        <Button onClick={syncVacations} disabled={syncing} className="bg-pr-orange hover:bg-pr-orange/90 text-pr-navy-fg h-11 px-5 rounded-[10px]">
          <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin motion-reduce:animate-none')} />
          {syncing ? 'Sincronizando...' : 'Sincronizar férias'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-label="Empresa" className="w-full sm:w-72 justify-between bg-pr-surface border-pr-border h-11 rounded-[10px] font-normal">
              <span className="flex items-center gap-2 truncate"><Building2 className="h-4 w-4 text-pr-muted" />{selectedCompanyName}</span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
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
                    <CommandItem key={c.id} value={`${c.company_name} ${c.document ?? ''} ${c.sci_code ?? ''}`}
                      onSelect={() => { setCompanyId(c.id); setCompanyOpen(false); }}>
                      <Check className={cn('mr-2 h-4 w-4', companyId === c.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{c.sci_code ? `${c.sci_code} - ` : ''}{c.company_name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input type="date" aria-label="Data de referência" className="w-full sm:w-48 h-11 bg-pr-surface border-pr-border rounded-[10px]"
          value={reference} onChange={e => setReference(e.target.value || todayKeySP())} />
        <Select value={String(horizon)} onValueChange={v => setHorizon(Number(v))}>
          <SelectTrigger aria-label="Horizonte de vencimentos" className="w-full sm:w-52 h-11 bg-pr-surface border-pr-border rounded-[10px]">
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-pr-muted" /><SelectValue /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        {companyId !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setCompanyId('all')}><X className="h-4 w-4 mr-1" />Limpar empresa</Button>
        )}
        <span className="sm:ml-auto text-sm text-pr-muted tabular-nums">
          {kpis.people} colaboradores · {companyTotals.length} empresas
        </span>
      </div>

      {reference > todayKeySP() && (
        <div className="flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          A data escolhida é posterior a hoje: os saldos podem estar desatualizados até uma nova importação
          {lastReport ? ` (último arquivo: ${lastReport})` : ''}.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : periods.length === 0 ? (
        <div className="rounded-xl border border-pr-border bg-pr-surface py-12 text-center text-sm text-pr-muted">
          Nenhum período de férias importado ainda. Use o botão “Sincronizar férias”.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map(k => (
              <button key={k.key} title={k.tip} onClick={() => setCardDialog(k.key)}
                className={cn('text-left rounded-xl border p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  k.tone === 'red' ? 'bg-destructive/5 border-destructive/15' : 'bg-blue-500/5 border-blue-500/15')}>
                <div className="flex items-start gap-3">
                  <span className={cn('h-11 w-11 rounded-lg flex items-center justify-center shrink-0',
                    k.tone === 'red' ? 'bg-destructive/10 text-destructive' : 'bg-blue-500/10 text-blue-600')}>
                    <k.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{k.label}</p>
                    <p className={cn('text-4xl font-extrabold tabular-nums mt-2 leading-none', k.tone === 'red' ? 'text-destructive' : 'text-blue-600')}>{k.value}</p>
                    <p className="text-xs text-pr-muted mt-2">{k.hint}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-pr-border bg-pr-surface p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold">Composição do saldo de férias</h2>
              <span className="text-sm font-semibold tabular-nums">{fmtDays(kpis.totalDays)} dias no total</span>
            </div>
            {kpis.totalDays <= 0 ? (
              <p className="text-sm text-pr-muted py-4">Sem saldo de férias neste recorte.</p>
            ) : (
              <>
                <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label="Composição do saldo">
                  {composition.filter(c => c.value > 0).map(c => (
                    <button key={c.key} title={`${c.label}: ${fmtDays(c.value)} dias (${fmtPct(pct(c.value))})`}
                      onClick={() => setStatusFilter(c.key)}
                      className={cn(c.bar, 'h-full flex items-center justify-center text-xs font-semibold text-pr-navy-fg min-w-[4px]')}
                      style={{ width: `${pct(c.value)}%` }}>
                      {pct(c.value) >= 6 ? fmtPct(pct(c.value)) : ''}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {composition.map(c => (
                    <div key={c.key} className="flex items-start gap-2">
                      <span className={cn('h-3 w-3 rounded-full mt-1', c.dot)} />
                      <div>
                        <p className="text-sm text-pr-muted">{c.label} · {fmtPct(pct(c.value))}</p>
                        <p className="text-lg font-bold tabular-nums">{fmtDays(c.value)} dias</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <section className="lg:col-span-3 rounded-xl border border-pr-border bg-pr-surface p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold">Vencimentos por mês</h2>
                <span className="text-xs text-pr-muted">Dias com prazo de concessão no mês</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pr-border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--pr-muted))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--pr-muted))' }} axisLine={false} tickLine={false} width={36}
                      label={{ value: 'dias', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--pr-muted))' }} />
                    <RTooltip cursor={{ fill: 'hsl(var(--pr-border) / 0.5)' }} formatter={(v: number) => [`${fmtDays(v)} dia(s)`, 'A vencer']} />
                    <Bar dataKey="days" fill="hsl(var(--pr-orange))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="lg:col-span-2 rounded-xl border border-pr-border bg-pr-surface p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-lg font-bold">{metricLabel[barMetric]} por empresa</h2>
                <Select value={barMetric} onValueChange={v => setBarMetric(v as typeof barMetric)}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overdueDays">Dias vencidos</SelectItem>
                    <SelectItem value="acquiredDays">Dias adquiridos</SelectItem>
                    <SelectItem value="accruingDays">Dias em formação</SelectItem>
                    <SelectItem value="totalDays">Total de dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {shownBars.length === 0 ? (
                <p className="text-sm text-pr-muted py-12 text-center">Nenhuma empresa com dias nesta medida.</p>
              ) : (
                <div style={{ height: Math.max(180, shownBars.length * 38) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shownBars} layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="companyName" width={130} axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--pr-text))' }}
                        tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
                      <RTooltip formatter={(v: number) => [`${fmtDays(v)} dia(s)`, metricLabel[barMetric]]} />
                      <Bar dataKey={barMetric} radius={[0, 4, 4, 0]} className="cursor-pointer" barSize={18}
                        fill={barMetric === 'overdueDays' ? 'hsl(var(--pr-red) / 0.55)' : 'hsl(217 91% 60% / 0.6)'}
                        onClick={(d: { clientId?: string }) => d?.clientId && setCompanyId(d.clientId)}>
                        <LabelList dataKey={barMetric} position="right" fontSize={11} formatter={(v: number) => fmtDays(v)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {companyBars.length > 5 && (
                <Button variant="link" size="sm" className="px-0 text-pr-orange" onClick={() => setShowAllCompanies(s => !s)}>
                  {showAllCompanies ? 'Mostrar só as 5 maiores' : `Ver todas (${companyBars.length})`}
                </Button>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-pr-border bg-pr-surface">
            <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold">Férias por colaborador</h2>
                <p className="text-xs text-pr-muted">{filtered.length} resultado(s) · saldos em dias</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pr-muted" />
                  <Input className="pl-9" placeholder="Buscar colaborador, empresa ou código..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overdue">Mais dias vencidos</SelectItem>
                    <SelectItem value="total">Maior saldo</SelectItem>
                    <SelectItem value="due">Prazo mais antigo</SelectItem>
                    <SelectItem value="name">Nome</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-pr-bg/60">
                    <TableHead>Colaborador / empresa</TableHead>
                    <TableHead className="text-right">Vencidas</TableHead>
                    <TableHead className="text-right">Adquiridas</TableHead>
                    <TableHead className="text-right">Em formação</TableHead>
                    <TableHead className="text-right">Saldo total</TableHead>
                    <TableHead>Prazo de concessão</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-pr-muted py-8">Nenhum colaborador nesta seleção.</TableCell></TableRow>
                  ) : pageRows.map(a => {
                    const due = a.periods.find(p => p.dueDate === a.nextDueDate);
                    const late = due?.daysLeft !== null && due?.daysLeft !== undefined && due.daysLeft < 0;
                    return (
                      <TableRow key={a.employeeId} className="cursor-pointer hover:bg-pr-bg/60" onClick={() => setDetail(a)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="h-9 w-9 rounded-full bg-pr-bg border border-pr-border flex items-center justify-center text-xs font-semibold text-pr-muted shrink-0">{initials(a.name)}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate max-w-[240px]">{a.name}</p>
                              <p className="text-xs text-pr-muted truncate max-w-[240px]">{a.companyName}{a.code ? ` · cód. ${a.code}` : ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right tabular-nums', a.overdueDays > 0 ? 'text-destructive font-bold' : 'text-pr-muted')}>{fmtDays(a.overdueDays)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtDays(a.acquiredDays)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtDays(a.accruingDays)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fmtDays(a.totalDays)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <p className={cn('text-sm font-semibold tabular-nums', late && 'text-destructive')}>{fmtDate(a.nextDueDate)}</p>
                          <p className={cn('text-xs', late ? 'text-destructive' : 'text-pr-muted')}>
                            {!a.nextDueDate ? 'Sem prazo informado' : late ? 'Prazo ultrapassado' : statusLabel[a.status]}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ver períodos de ${a.name}`}
                            onClick={e => { e.stopPropagation(); setDetail(a); }}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-pr-border text-sm text-pr-muted">
              <div className="flex items-center gap-2">
                <span>Por página</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span>Página {page + 1} de {pageCount}</span>
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          </section>
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
