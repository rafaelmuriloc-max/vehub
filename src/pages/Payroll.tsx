import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsUpDown, RefreshCw, Search, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatClientLabel } from '@/lib/utils';

interface Client { id: string; company_name: string; document: string | null; sci_code: string | null; status: string | null }
interface Summary {
  client_id: string; competence: string;
  qty_total: number; gross: number; discounts: number; net: number;
  inss_value: number; fgts_value: number; inss_base: number; fgts_base: number;
  active_count: number; admitted_count: number; dismissed_count: number;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (v: number) => 'R$ ' + new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const monthLabel = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
const monthLong = (c: string) => `${MONTHS[+c.slice(5, 7) - 1]} de ${c.slice(0, 4)}`;
const monthShort = (c: string, withYear: boolean) => MONTHS_SHORT[+c.slice(5, 7) - 1] + (withYear ? `/${c.slice(2, 4)}` : '');

type SortKey = 'gross' | 'active_count' | 'net' | 'charges';
type ChartMode = 'folha' | 'encargos' | 'colaboradores';

export default function Payroll() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Summary[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [selMonths, setSelMonths] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const toggleClient = (id: string) => setClientIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleMonth = (m: string) => setSelMonths((p) => p.includes(m) ? (p.length > 1 ? p.filter((x) => x !== m) : p) : [...p, m].sort());

  const [sortBy, setSortBy] = useState<SortKey>('gross');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [chartMode, setChartMode] = useState<ChartMode>('folha');
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([
        supabase.from('clients').select('id, company_name, document, sci_code, status').order('company_name'),
        supabase.from('payroll_summaries' as any).select('client_id, competence, qty_total, gross, discounts, net, inss_value, fgts_value, inss_base, fgts_base, active_count, admitted_count, dismissed_count').limit(10000),
      ]);
      if (c.error) throw c.error;
      if (s.error) throw s.error;
      const act = ((c.data ?? []) as Client[]).filter((x) => x.status === 'active');
      const ids = new Set(act.map((x) => x.id));
      const data = ((s.data ?? []) as unknown as Summary[])
        .filter((r) => ids.has(r.client_id))
        .map((r) => ({ ...r, gross: +r.gross, discounts: +r.discounts, net: +r.net, inss_value: +r.inss_value, fgts_value: +r.fgts_value, inss_base: +r.inss_base, fgts_base: +r.fgts_base }));
      setClients(act);
      setRows(data);
      const months = [...new Set(data.map((r) => r.competence))].sort();
      setSelMonths(months.length ? [months[months.length - 1]] : []);
    } catch (e) {
      setLoadError((e as Error).message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncPayroll() {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-folder-sync', { body: { only: 'folha' } });
      if (error) throw error;
      if (data?.ok === false) {
        throw new Error(data.error === 'Nenhuma pasta configurada'
          ? 'Nenhuma pasta definida. Defina a pasta pelo botão Funcionários, na página Pessoal.'
          : data.error);
      }
      const st = data?.stats ?? {};
      const meses = (st.meses ?? []).map((m: string) => monthLabel(m)).join(', ');
      toast({
        title: 'Resumo da folha sincronizado',
        description: `${st.arquivos ?? 0} arquivo(s) lido(s)${meses ? ` (${meses})` : ''}, ${st.empresas_gravadas ?? 0} empresa(s) gravada(s)${(st.sem_empresa ?? 0) > 0 ? `, ${st.sem_empresa} sem empresa cadastrada` : ''}. ${st.salarios_atualizados ?? 0} salário(s) atualizado(s)${(st.nao_localizados ?? 0) > 0 ? `, ${st.nao_localizados} funcionário(s) não localizado(s)` : ''}.`,
      });
      await load();
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const months = useMemo(() => [...new Set(rows.map((r) => r.competence))].sort(), [rows]);
  const clientSet = useMemo(() => new Set(clientIds), [clientIds]);
  const scoped = useMemo(() => (!clientIds.length ? rows : rows.filter((r) => clientSet.has(r.client_id))), [rows, clientIds, clientSet]);
  const monthSet = useMemo(() => new Set(selMonths), [selMonths]);
  const lastMonth = selMonths[selMonths.length - 1] ?? '';
  const current = useMemo(() => scoped.filter((r) => monthSet.has(r.competence)), [scoped, monthSet]);
  const periodLabel = !selMonths.length ? '' : selMonths.length === 1 ? monthLabel(selMonths[0]) : `${monthLabel(selMonths[0])} a ${monthLabel(lastMonth)}`;

  const totals = useMemo(() => current.reduce((a, r) => ({
    gross: a.gross + r.gross, discounts: a.discounts + r.discounts, net: a.net + r.net,
    inss: a.inss + r.inss_value, fgts: a.fgts + r.fgts_value,
    active: a.active + (r.competence === lastMonth ? r.active_count : 0), admitted: a.admitted + r.admitted_count, dismissed: a.dismissed + r.dismissed_count,
  }), { gross: 0, discounts: 0, net: 0, inss: 0, fgts: 0, active: 0, admitted: 0, dismissed: 0 }), [current, lastMonth]);
  const balance = totals.admitted - totals.dismissed;

  const evoMonths = useMemo(() => {
    const base = selMonths.length > 1 ? selMonths : months;
    const withData = new Set(scoped.map((r) => r.competence));
    return base.filter((m) => withData.has(m));
  }, [selMonths, months, scoped]);
  const multiYear = new Set(evoMonths.map((m) => m.slice(0, 4))).size > 1;
  const evolution = useMemo(() => evoMonths.map((m) => {
    const list = scoped.filter((r) => r.competence === m);
    const sum = (f: (r: Summary) => number) => list.reduce((a, r) => a + f(r), 0);
    return {
      mes: monthShort(m, multiYear), comp: m,
      Proventos: +sum((r) => r.gross).toFixed(2),
      'Líquido': +sum((r) => r.net).toFixed(2),
      'INSS (GPS)': +sum((r) => r.inss_value).toFixed(2),
      FGTS: +sum((r) => r.fgts_value).toFixed(2),
      Colaboradores: sum((r) => r.active_count),
    };
  }), [evoMonths, scoped, multiYear]);
  const evoRange = evoMonths.length ? (evoMonths.length === 1 ? monthLong(evoMonths[0]) : `${monthShort(evoMonths[0], true)} — ${monthShort(evoMonths[evoMonths.length - 1], true)}`) : '';

  // agregado por empresa no período selecionado, respeitando o filtro de empresas
  const byCompany = useMemo(() => {
    const agg = new Map<string, Summary>();
    for (const r of current) {
      const o = agg.get(r.client_id);
      if (!o) { agg.set(r.client_id, { ...r, active_count: r.competence === lastMonth ? r.active_count : 0 }); continue; }
      o.gross += r.gross; o.net += r.net; o.discounts += r.discounts; o.inss_value += r.inss_value; o.fgts_value += r.fgts_value;
      if (r.competence === lastMonth) o.active_count = r.active_count;
    }
    return [...agg.values()].map((r) => {
      const c = clientById.get(r.client_id);
      return { id: r.client_id, name: c?.company_name ?? 'Informação não disponível', code: c?.sci_code ?? '', r, charges: r.inss_value + r.fgts_value };
    });
  }, [current, lastMonth, clientById]);

  const top5 = useMemo(() => [...byCompany].sort((a, b) => b.r.gross - a.r.gross).slice(0, 5), [byCompany]);
  const topMax = top5[0]?.r.gross || 1;

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const f = q ? byCompany.filter((x) => x.name.toLowerCase().includes(q) || x.code.toLowerCase().includes(q)) : byCompany;
    const val = (x: typeof byCompany[number]) => sortBy === 'gross' ? x.r.gross : sortBy === 'active_count' ? x.r.active_count : sortBy === 'net' ? x.r.net : x.charges;
    return [...f].sort((a, b) => val(b) - val(a));
  }, [byCompany, query, sortBy]);
  const pageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [query, sortBy, pageSize, clientIds, selMonths]);

  const clientBtn = !clientIds.length ? 'Todas as empresas' : clientIds.length === 1 ? formatClientLabel(clientById.get(clientIds[0])) : `${clientIds.length} empresas`;
  const monthBtn = !selMonths.length ? 'Selecione' : selMonths.length === 1 ? monthLong(selMonths[0]) : `${selMonths.length} competências`;

  const surface = 'rounded-xl border border-pr-border bg-pr-surface';
  const tooltipStyle = { background: 'hsl(var(--pr-surface))', border: '1px solid hsl(var(--pr-border))', borderRadius: 10, color: 'hsl(var(--pr-text))', fontSize: 12 };
  const axisTick = { fill: 'hsl(var(--pr-muted))', fontSize: 12 };
  const toggleSeries = (o: { dataKey?: unknown }) => { const k = String(o.dataKey ?? ''); setHidden((h) => ({ ...h, [k]: !h[k] })); };

  return (
    <div className="-m-6 min-h-[100dvh] bg-pr-bg text-pr-text p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-pr-text" aria-label="Voltar para Pessoal" onClick={() => navigate('/personnel')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <nav aria-label="Caminho" className="text-sm text-pr-muted">
            <span>Departamento pessoal</span><span className="mx-2">/</span><span className="text-pr-text font-medium">Folha de pagamento</span>
          </nav>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Folha de pagamento</h1>
            <p className="text-sm text-pr-muted mt-1">Uma visão clara dos valores e das movimentações da sua carteira.</p>
          </div>
          <Button onClick={syncPayroll} disabled={syncing} aria-busy={syncing}
            className="bg-pr-orange text-pr-navy-fg hover:bg-pr-orange/90 focus-visible:ring-2 focus-visible:ring-pr-orange focus-visible:ring-offset-2 self-start">
            <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin motion-reduce:animate-none')} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5">
            <span id="lbl-empresa" className="text-xs font-medium text-pr-muted">Empresa</span>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-labelledby="lbl-empresa" className="w-full sm:w-72 justify-between bg-pr-surface border-pr-border text-pr-text">
                  <span className="flex items-center gap-2 truncate"><Building2 className="h-4 w-4 text-pr-muted shrink-0" /><span className="truncate">{clientBtn}</span></span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Nome, CNPJ ou código..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="todas as empresas limpar selecao" onSelect={() => setClientIds([])}>
                        <Check className={cn('h-4 w-4 mr-2', !clientIds.length ? 'opacity-100' : 'opacity-0')} />Todas as empresas
                      </CommandItem>
                      {clients.map((c) => (
                        <CommandItem key={c.id} value={`${c.sci_code ?? ''} ${c.company_name} ${c.document ?? ''}`} onSelect={() => toggleClient(c.id)}>
                          <Check className={cn('h-4 w-4 mr-2', clientSet.has(c.id) ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{formatClientLabel(c)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <span id="lbl-comp" className="text-xs font-medium text-pr-muted">Competência</span>
            <Popover open={monthOpen} onOpenChange={setMonthOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-labelledby="lbl-comp" className="w-full sm:w-56 justify-between bg-pr-surface border-pr-border text-pr-text" disabled={!months.length}>
                  <span className="flex items-center gap-2 truncate"><CalendarDays className="h-4 w-4 text-pr-muted shrink-0" />{monthBtn}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      <CommandItem value="ultimo mes" onSelect={() => setSelMonths(months.length ? [months[months.length - 1]] : [])}>Último mês</CommandItem>
                      <CommandItem value="todos" onSelect={() => setSelMonths([...months])}>Todos</CommandItem>
                    </CommandGroup>
                    <CommandGroup>
                      {[...months].reverse().map((m) => (
                        <CommandItem key={m} value={m} onSelect={() => toggleMonth(m)}>
                          <Check className={cn('h-4 w-4 mr-2', monthSet.has(m) ? 'opacity-100' : 'opacity-0')} />{monthLong(m)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {periodLabel && <span className="sm:ml-auto text-xs text-pr-muted pb-2">{selMonths.length > 1 ? 'Resumo do período' : 'Resumo mensal'} · {periodLabel}</span>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Carregando">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-14 rounded-xl" />
          <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-80 rounded-xl lg:col-span-2" /><Skeleton className="h-80 rounded-xl" /></div>
        </div>
      ) : loadError ? (
        <div className={cn(surface, 'p-8 text-center space-y-3')} role="alert">
          <AlertCircle className="h-6 w-6 mx-auto text-pr-red" />
          <p className="text-sm">Não foi possível carregar a folha: {loadError}</p>
          <Button variant="outline" onClick={load}>Tentar novamente</Button>
        </div>
      ) : !rows.length ? (
        <div className={cn(surface, 'p-10 text-center text-sm text-pr-muted')}>
          Nenhum resumo da folha importado ainda. Clique em "Sincronizar" para ler o relatório da pasta do Drive.
        </div>
      ) : (
        <>
          {/* Indicadores financeiros */}
          {!current.length ? (
            <div className={cn(surface, 'p-6 text-sm text-pr-muted')}>Informação não disponível para a seleção em {periodLabel}.</div>
          ) : (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl bg-pr-navy text-pr-navy-fg p-5 flex flex-col gap-2">
                <span className="text-sm opacity-80">Total de proventos</span>
                <span className="text-2xl xl:text-3xl font-bold tabular-nums"><span className="text-sm font-medium mr-1">R$</span>{num(totals.gross)}</span>
                <span className="text-xs opacity-70">Remuneração bruta da carteira</span>
              </div>
              {[
                { label: 'Líquido da folha', value: totals.net, hint: 'Valor informado no resumo' },
                { label: 'Descontos', value: totals.discounts, hint: 'Total de deduções' },
                { label: 'Encargos informados', value: totals.inss + totals.fgts, hint: 'INSS (GPS) + FGTS' },
              ].map((c) => (
                <div key={c.label} className={cn(surface, 'p-5 flex flex-col gap-2')}>
                  <span className="text-sm text-pr-muted">{c.label}</span>
                  <span className="text-2xl xl:text-3xl font-bold tabular-nums"><span className="text-sm font-medium mr-1 text-pr-muted">R$</span>{num(c.value)}</span>
                  <span className="text-xs text-pr-muted">{c.hint}</span>
                </div>
              ))}
            </div>
          )}

          {/* Equipe */}
          {current.length > 0 && (
            <div className={cn(surface, 'px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm')}>
              <span><strong className="tabular-nums">{totals.active.toLocaleString('pt-BR')}</strong> <span className="text-pr-muted">colaboradores ativos</span></span>
              <span><strong className="tabular-nums">{totals.admitted.toLocaleString('pt-BR')}</strong> <span className="text-pr-muted">admissões</span></span>
              <span><strong className="tabular-nums">{totals.dismissed.toLocaleString('pt-BR')}</strong> <span className="text-pr-muted">desligamentos</span></span>
              <span className={cn('sm:ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border',
                balance > 0 ? 'text-pr-green border-pr-green/30 bg-pr-green/10' : balance < 0 ? 'text-pr-red border-pr-red/30 bg-pr-red/10' : 'text-pr-muted border-pr-border')}>
                {balance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : balance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {balance > 0 ? '+' : balance < 0 ? '−' : ''}{Math.abs(balance)} saldo de movimentações
              </span>
            </div>
          )}

          {/* Gráficos */}
          <div className="grid lg:grid-cols-3 gap-4">
            <section className={cn(surface, 'p-5 lg:col-span-2 flex flex-col')} aria-labelledby="evo-title">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 id="evo-title" className="font-semibold">Evolução da folha</h2>
                  <p className="text-xs text-pr-muted">{evoRange}</p>
                </div>
                <div role="tablist" aria-label="Métrica" className="inline-flex rounded-lg border border-pr-border p-0.5 text-xs">
                  {([['folha', 'Folha'], ['encargos', 'Encargos'], ['colaboradores', 'Colaboradores']] as [ChartMode, string][]).map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={chartMode === k} onClick={() => setChartMode(k)}
                      className={cn('px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pr-orange',
                        chartMode === k ? 'bg-pr-navy text-pr-navy-fg' : 'text-pr-muted hover:text-pr-text')}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="h-72">
                {!evolution.length ? (
                  <p className="text-sm text-pr-muted py-10 text-center">Informação não disponível.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolution} margin={{ left: 4, right: 4 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--pr-border))" />
                      <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                      {chartMode === 'colaboradores' ? (
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={48}
                          label={{ value: 'Pessoas', angle: -90, position: 'insideLeft', fill: 'hsl(var(--pr-muted))', fontSize: 11 }} />
                      ) : (
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={72} />
                      )}
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--pr-border) / 0.5)' }}
                        formatter={(v: number, n: string) => (n === 'Colaboradores' ? `${v} pessoas` : brl(v))} />
                      <Legend onClick={toggleSeries} wrapperStyle={{ fontSize: 12, cursor: 'pointer' }} />
                      {chartMode === 'folha' && <>
                        <Bar dataKey="Proventos" fill="hsl(var(--pr-orange))" radius={[4, 4, 0, 0]} hide={hidden['Proventos']} isAnimationActive={false} />
                        <Bar dataKey="Líquido" fill="hsl(var(--pr-green))" radius={[4, 4, 0, 0]} hide={hidden['Líquido']} isAnimationActive={false} />
                      </>}
                      {chartMode === 'encargos' && <>
                        <Bar dataKey="INSS (GPS)" fill="hsl(var(--pr-navy))" radius={[4, 4, 0, 0]} hide={hidden['INSS (GPS)']} isAnimationActive={false} />
                        <Bar dataKey="FGTS" fill="hsl(var(--pr-orange-soft))" radius={[4, 4, 0, 0]} hide={hidden['FGTS']} isAnimationActive={false} />
                      </>}
                      {chartMode === 'colaboradores' && (
                        <Bar dataKey="Colaboradores" fill="hsl(var(--pr-navy))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-auto pt-4 border-t border-pr-border flex flex-wrap justify-between gap-2 text-sm">
                <span><span className="text-pr-muted mr-2">INSS (GPS)</span><strong className="tabular-nums">{brl(totals.inss)}</strong></span>
                <span><span className="text-pr-muted mr-2">FGTS</span><strong className="tabular-nums">{brl(totals.fgts)}</strong></span>
              </div>
            </section>

            <section className={cn(surface, 'p-5')} aria-labelledby="top-title">
              <h2 id="top-title" className="font-semibold">Maiores folhas</h2>
              <p className="text-xs text-pr-muted mb-4">Top 5 · proventos</p>
              {!top5.length ? (
                <p className="text-sm text-pr-muted">Informação não disponível.</p>
              ) : (
                <ol className="space-y-4">
                  {top5.map((x, i) => (
                    <li key={x.id}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium break-words" title={x.name}>{x.name}</span>
                        <span className="tabular-nums shrink-0">{brl(x.r.gross)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-pr-border overflow-hidden" aria-hidden>
                        <div className={cn('h-full rounded-full', i === 0 ? 'bg-pr-orange' : 'bg-pr-orange-soft')} style={{ width: `${(x.r.gross / topMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {periodLabel && <p className="text-xs text-pr-muted mt-4">Valores por empresa em {selMonths.length === 1 ? monthLong(selMonths[0]).toLowerCase() : periodLabel}</p>}
            </section>
          </div>

          {/* Tabela */}
          <section className={cn(surface, 'p-5 space-y-4')} aria-labelledby="tbl-title">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <h2 id="tbl-title" className="font-semibold">Folha por empresa</h2>
                <p className="text-xs text-pr-muted">{tableRows.length} {tableRows.length === 1 ? 'empresa' : 'empresas'} no recorte</p>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-pr-muted" />
                <Input aria-label="Buscar por nome ou código" placeholder="Buscar por nome ou código" value={query} onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 w-full md:w-64 bg-pr-surface border-pr-border" />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger aria-label="Ordenar" className="w-full md:w-48 bg-pr-surface border-pr-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Maior folha</SelectItem>
                  <SelectItem value="active_count">Mais colaboradores</SelectItem>
                  <SelectItem value="net">Maior líquido</SelectItem>
                  <SelectItem value="charges">Maiores encargos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-pr-muted border-b border-pr-border">
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 px-3 font-medium text-right">Ativos</th>
                    <th className="py-2 px-3 font-medium text-right">Proventos</th>
                    <th className="py-2 px-3 font-medium text-right">Líquido</th>
                    <th className="py-2 pl-3 font-medium text-right">Encargos</th>
                  </tr>
                </thead>
                <tbody>
                  {!pageRows.length ? (
                    <tr><td colSpan={5} className="py-8 text-center text-pr-muted">Nenhuma empresa encontrada.</td></tr>
                  ) : pageRows.map((x) => (
                    <tr key={x.id} tabIndex={0} onClick={() => toggleClient(x.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleClient(x.id); } }}
                      aria-pressed={clientSet.has(x.id)} title="Clique para filtrar por esta empresa"
                      className={cn('border-b border-pr-border last:border-0 cursor-pointer hover:bg-pr-bg focus-visible:outline-none focus-visible:bg-pr-bg', clientSet.has(x.id) && 'bg-pr-bg')}>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{x.name}</div>
                        <div className="text-xs text-pr-muted">{x.code ? `Código ${x.code}` : 'Sem código'}</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">{x.r.active_count}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{brl(x.r.gross)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-pr-green">{brl(x.r.net)}</td>
                      <td className="py-3 pl-3 text-right tabular-nums">{brl(x.charges)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-pr-muted">
              <div className="flex items-center gap-2">
                <span>Por página</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(+v)}>
                  <SelectTrigger aria-label="Empresas por página" className="w-20 h-8 bg-pr-surface border-pr-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{[5, 10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">
                  {tableRows.length ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, tableRows.length)} de ${tableRows.length} empresas` : '0 empresas'}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página anterior" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Próxima página" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
