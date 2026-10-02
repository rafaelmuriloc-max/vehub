import { useEffect, useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, ChevronDown, Users, Wallet } from 'lucide-react';

function ChartHeader({ Icon, tone, title, subtitle, delta }: { Icon: LucideIcon; tone: 'primary' | 'success'; title: string; subtitle: string; delta: number | null }) {
  const up = (delta ?? 0) >= 0;
  const box = tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success';
  const pill = !up ? 'bg-destructive/10 text-destructive' : box;
  return (
    <div className="flex items-start gap-3">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${box}`}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {delta != null && (
        <div className={`rounded-xl px-3 py-1.5 text-center shrink-0 ${pill}`}>
          <p className="text-sm font-bold inline-flex items-center gap-1">{up ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}{up ? '+' : ''}{delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>
          <p className="text-[11px] text-muted-foreground leading-none">no período</p>
        </div>
      )}
    </div>
  );
}
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthLabel = (k: string) => `${MES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlMil = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

export type PayrollMonth = { key: string; funcionarios: number; salarios: number; empresas: number };
type Row = { client_id: string; competence: string; qty_employees: number | null; gross: number | null };

export function usePayrollMonthly(clientIds: string[]) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('payroll_summaries')
          .select('client_id, competence, qty_employees, gross').order('competence').range(from, from + 999);
        if (error || !data?.length) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (alive) { setRows(all); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  const key = clientIds.slice().sort().join(',');
  const months = useMemo(() => {
    const ids = new Set(key.split(','));
    const map = new Map<string, PayrollMonth>();
    for (const r of rows) {
      if (!ids.has(r.client_id)) continue;
      const k = r.competence.slice(0, 7);
      const m = map.get(k) ?? { key: k, funcionarios: 0, salarios: 0, empresas: 0 };
      m.funcionarios += Number(r.qty_employees ?? 0);
      m.salarios += Number(r.gross ?? 0);
      m.empresas += 1;
      map.set(k, m);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, key]);
  return { months, loading };
}

type Gran = 'mensal' | 'trimestral' | 'anual';

export function PersonnelEvolutionChart({ months, loading }: { months: PayrollMonth[]; loading: boolean }) {
  const [gran, setGran] = useState<Gran>('mensal');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const keys = months.map(m => m.key);
  const start = from && keys.includes(from) ? from : keys[0] ?? '';
  const end = to && keys.includes(to) ? to : keys[keys.length - 1] ?? '';

  const data = useMemo(() => {
    const inRange = months.filter(m => m.key >= start && m.key <= end);
    if (gran === 'mensal') return inRange.map(m => ({ ...m, label: monthLabel(m.key) }));
    const groups = new Map<string, PayrollMonth[]>();
    for (const m of inRange) {
      const y = m.key.slice(0, 4);
      const g = gran === 'anual' ? y : `${Math.floor((Number(m.key.slice(5)) - 1) / 3) + 1}T/${y.slice(2)}`;
      groups.set(g, [...(groups.get(g) ?? []), m]);
    }
    return [...groups.entries()].map(([label, ms]) => ({
      key: label, label,
      funcionarios: Math.round(ms.reduce((s, m) => s + m.funcionarios, 0) / ms.length),
      salarios: ms.reduce((s, m) => s + m.salarios, 0),
      empresas: Math.max(...ms.map(m => m.empresas)),
    }));
  }, [months, start, end, gran]);
  const deltaOf = (k: 'funcionarios' | 'salarios') => {
    if (data.length < 2) return null;
    const a = data[0][k], b = data[data.length - 1][k];
    return a ? ((b - a) / a) * 100 : null;
  };
  const salMax = Math.max(0, ...data.map(d => d.salarios));
  const salTop = Math.max(250_000, Math.ceil((salMax * 1.1) / 250_000) * 250_000);

  return (
    <Card className="border-border/70 shadow-sm rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-info/10 text-info flex items-center justify-center shrink-0"><BarChart3 className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">Evolução de funcionários e salários</h2>
              <p className="text-sm text-muted-foreground">Considera só as empresas com relatório de folha sincronizado.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border bg-muted/40 p-1">
              {(['mensal', 'trimestral', 'anual'] as Gran[]).map(g => (
                <button key={g} onClick={() => setGran(g)} className={cn('px-4 py-1.5 text-sm rounded-lg capitalize transition-colors', gran === g ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-foreground hover:bg-muted')}>{g}</button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm hover:bg-muted/50" disabled={!keys.length}>
                  <CalendarDays className="h-4 w-4" />{start ? `${monthLabel(start)} – ${monthLabel(end)}` : 'Sem período'}<ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                {[['De', start, setFrom], ['Até', end, setTo]].map(([lab, val, set]: any) => (
                  <div key={lab} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{lab}</p>
                    <Select value={val} onValueChange={set}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{keys.map(k => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground py-16 text-center">Carregando...</p>
          : !data.length ? <p className="text-sm text-muted-foreground py-16 text-center">Sincronize a Folha para ver a evolução.</p>
          : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/70 p-5 shadow-sm">
                <ChartHeader Icon={Users} tone="primary" title="Funcionários" subtitle="Evolução do total de funcionários ativos." delta={deltaOf('funcionarios')} />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 30, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="pe-bar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false}
                        domain={[(min: number) => Math.max(0, Math.floor((min * 0.8) / 20) * 20), (max: number) => Math.ceil((max * 1.1) / 20) * 20]} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} formatter={(v: number) => v.toLocaleString('pt-BR')} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.empresas ?? 0} empresa(s)`} />
                      <Bar dataKey="funcionarios" name="Funcionários ativos" fill="url(#pe-bar)" radius={[8, 8, 0, 0]} maxBarSize={56}>
                        <LabelList dataKey="funcionarios" content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (value == null) return null;
                          const t = Number(value).toLocaleString('pt-BR');
                          const w = t.length * 8 + 16; const cx = Number(x) + Number(width) / 2;
                          return <g><rect x={cx - w / 2} y={Number(y) - 28} width={w} height={22} rx={6} fill="hsl(var(--primary) / 0.12)" />
                            <text x={cx} y={Number(y) - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(var(--primary))">{t}</text></g>;
                        }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="h-3 w-3 rounded-full bg-primary" />Funcionários ativos</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-5 shadow-sm">
                <ChartHeader Icon={Wallet} tone="success" title="Salários (R$)" subtitle="Evolução do total da folha de pagamento." delta={deltaOf('salarios')} />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 30, right: 24, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pe-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} padding={{ left: 24, right: 24 }} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={90} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false}
                        tickFormatter={(v: number) => v === 0 ? 'R$ 0' : `R$ ${(v / 1000).toLocaleString('pt-BR')} mil`}
                        domain={[0, salTop]} ticks={[0, 1, 2, 3, 4].map(i => (salTop / 4) * i)} />
                      <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.empresas ?? 0} empresa(s)`} />
                      <Area dataKey="salarios" stroke="none" fill="url(#pe-area)" tooltipType="none" legendType="none" />
                      <Line dataKey="salarios" name="Total da folha" stroke="hsl(var(--success))" strokeWidth={3} type="monotone"
                        dot={{ r: 5, fill: 'hsl(var(--card))', stroke: 'hsl(var(--success))', strokeWidth: 2.5 }} activeDot={{ r: 6 }}>
                        <LabelList dataKey="salarios" content={(props: any) => {
                          const { x, y, value } = props;
                          if (value == null) return null;
                          const t = brlMil(Number(value)); const w = t.length * 6.4 + 14;
                          return <g><rect x={Number(x) - w / 2} y={Number(y) - 32} width={w} height={20} rx={6} fill="hsl(var(--success) / 0.14)" />
                            <text x={Number(x)} y={Number(y) - 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="hsl(var(--success))">{t}</text></g>;
                        }} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="h-3 w-3 rounded-full bg-success" />Total da folha de pagamento (R$)</p>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
