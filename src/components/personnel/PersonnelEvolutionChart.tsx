import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarDays, ChevronDown } from 'lucide-react';
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
              <div className="rounded-xl border p-4">
                <p className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" />Funcionários</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <defs>
                        <linearGradient id="pe-bar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.75} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} axisLine={false} tickLine={false} domain={[0, (max: number) => Math.ceil((max * 1.2) / 10) * 10]} />
                      <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.empresas ?? 0} empresa(s)`} />
                      <Bar dataKey="funcionarios" name="Funcionários" fill="url(#pe-bar)" radius={[4, 4, 0, 0]} maxBarSize={80}>
                        <LabelList dataKey="funcionarios" position="top" fontSize={13} fontWeight={700} style={{ fill: 'hsl(var(--foreground))' }} formatter={(v: number) => v.toLocaleString('pt-BR')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" />Salários (R$)</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={brlMil} width={84} axisLine={false} tickLine={false} domain={[0, (max: number) => max * 1.1]} />
                      <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.empresas ?? 0} empresa(s)`} />
                      <Bar dataKey="salarios" name="Salários (R$)" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={80}>
                        <LabelList dataKey="salarios" content={(props: any) => {
                          const { x, y, width, height, value } = props;
                          if (value == null || Number(height) < 22) return null;
                          return (
                            <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) - 10} textAnchor="middle"
                              fontSize={11} fontWeight={700} fill="hsl(var(--primary-foreground))">{brlMil(Number(value))}</text>
                          );
                        }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
