import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Users, Wallet, Hourglass, Palmtree, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { KpiCard, SectionCard, brl, MONTHS } from './PortalWidgets';
import { trialStatus, vacationTone, daysBetween, type TrialStatus } from '@/lib/portalPersonnel';

type Emp = { id: string; employee_code: string | null; full_name: string; cpf_masked: string | null; position: string | null; admission_date: string | null; salary: number | null; termination_date: string | null; status: string; trial_end_1: string | null; trial_days_1: number | null; trial_end_2: string | null; trial_days_2: number | null };
type Pay = { competence: string; active_count: number | null; qty_employees: number | null; gross: number | null };
type Vac = { id: string; employee_name: string; acquisition_start: string | null; acquisition_end: string | null; days_right: number | null; enjoy_start: string | null; enjoy_end: string | null; deadline_date: string | null };

const fmt = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
const isActive = (e: Emp) => e.status !== 'terminated' && e.status !== 'demitido' && !e.termination_date;
const TONE = { danger: 'bg-destructive/10 text-destructive', warning: 'bg-warning/10 text-warning', neutral: 'bg-portal-blue-soft text-portal-ink', ok: 'bg-success/10 text-success', none: 'bg-muted text-muted-foreground' };

function trialLabel(s: TrialStatus) {
  if (s.kind === 'open') return { text: s.days === 0 ? 'Vence hoje' : `Vence em ${s.days} dia${s.days > 1 ? 's' : ''}`, cls: TONE[s.tone] };
  if (s.kind === 'expired') return { text: 'Vencido', cls: TONE.danger };
  return { text: 'Encerrado', cls: TONE.none };
}

export default function PortalPersonnel({ clientId }: { clientId: string }) {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [pay, setPay] = useState<Pay[]>([]);
  const [vacs, setVacs] = useState<Vac[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sit, setSit] = useState<'ativos' | 'demitidos' | 'todos'>('ativos');
  const [trialFilter, setTrialFilter] = useState<'avencer' | 'vencidos' | 'todos'>('avencer');

  useEffect(() => {
    let off = false;
    setLoading(true);
    const rpc = supabase.rpc as any;
    Promise.all([rpc('portal_employees', { _client_id: clientId }), rpc('portal_payroll', { _client_id: clientId }), rpc('portal_vacations', { _client_id: clientId })]).then(([e, p, v]) => {
      if (off) return;
      setEmps(e.data || []); setPay(p.data || []); setVacs(v.data || []); setLoading(false);
    });
    return () => { off = true; };
  }, [clientId]);

  const today = new Date();
  const active = emps.filter(isActive);
  const salaries = active.reduce((s, e) => s + (Number(e.salary) || 0), 0);
  const trials = useMemo(() => active.map(e => ({ e, s: trialStatus({ end1: e.trial_end_1, days1: e.trial_days_1, end2: e.trial_end_2, days2: e.trial_days_2 }) })).filter(x => x.s.kind === 'open' || x.s.kind === 'expired' || (x.s.kind === 'closed')), [emps]);
  const trialsShown = trials
    .filter(x => (trialFilter === 'avencer' ? x.s.kind === 'open' : trialFilter === 'vencidos' ? x.s.kind === 'expired' : true))
    .sort((a, b) => ((a.s as any).end || '9').localeCompare((b.s as any).end || '9'));
  const trialsSoon = trials.filter(x => x.s.kind === 'open' && x.s.days <= 30).length;
  const vacPending = vacs.filter(v => !v.enjoy_start);
  const vacSoon = vacPending.filter(v => v.deadline_date && daysBetween(today, v.deadline_date) <= 60).length;

  const chart = pay.slice(-12).map(p => { const [y, m] = p.competence.split('-'); return { label: `${MONTHS[Number(m) - 1]}/${y.slice(2)}`, qtd: p.active_count ?? p.qty_employees ?? 0, valor: Number(p.gross) || 0 }; });
  const list = emps.filter(e => (sit === 'todos' ? true : sit === 'ativos' ? isActive(e) : !isActive(e)))
    .filter(e => !q || `${e.full_name} ${e.position || ''} ${e.employee_code || ''}`.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <p className="text-sm text-muted-foreground py-10 text-center">Carregando…</p>;

  const Chip = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={cn('h-9 px-3 rounded-full text-sm border', on ? 'bg-portal-blue text-primary-foreground border-transparent' : 'bg-card text-portal-ink border-border')}>{children}</button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="h-6 w-6" />} iconClass="bg-portal-blue-soft text-portal-blue" title="Funcionários ativos" value={active.length} hint={`${emps.length - active.length} desligado(s)`} />
        <KpiCard icon={<Wallet className="h-6 w-6" />} iconClass="bg-success/10 text-success" title="Total de salários" value={brl(salaries)} hint="Funcionários ativos" />
        <KpiCard icon={<Hourglass className="h-6 w-6" />} iconClass="bg-warning/10 text-warning" title="Experiências" value={trialsSoon} hint="Vencem em 30 dias" />
        <KpiCard icon={<Palmtree className="h-6 w-6" />} iconClass="bg-destructive/10 text-destructive" title="Férias" value={vacSoon} hint="Vencem em 60 dias" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard>
          <h2 className="text-lg font-bold text-portal-ink mb-2">Evolução de funcionários</h2>
          {chart.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de folha ainda.</p> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 20, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Bar dataKey="qtd" fill="hsl(var(--portal-blue-strong))" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="qtd" position="top" style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--portal-ink))' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </SectionCard>
        <SectionCard>
          <h2 className="text-lg font-bold text-portal-ink mb-2">Evolução de salários</h2>
          {chart.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de folha ainda.</p> : (
            <div className="h-56"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Area dataKey="valor" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.15)" strokeWidth={2}>
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : v)} style={{ fontSize: 10, fill: 'hsl(var(--portal-ink))' }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-portal-ink">Contratos de experiência</h2>
          <div className="flex gap-2 overflow-x-auto"><Chip on={trialFilter === 'avencer'} onClick={() => setTrialFilter('avencer')}>A vencer</Chip><Chip on={trialFilter === 'vencidos'} onClick={() => setTrialFilter('vencidos')}>Vencidos</Chip><Chip on={trialFilter === 'todos'} onClick={() => setTrialFilter('todos')}>Todos</Chip></div>
        </div>
        {trialsShown.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum contrato de experiência nesta situação.</p>}
        <div className="divide-y divide-border/70">
          {trialsShown.map(({ e, s }) => { const l = trialLabel(s); return (
            <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-portal-ink truncate">{e.full_name}</p><p className="text-xs text-muted-foreground truncate">{e.position || 'Cargo não informado'} · Admissão {fmt(e.admission_date)}</p></div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:w-72">
                <div><p className="text-muted-foreground">1º período</p><p className={cn('font-medium tabular-nums', s.kind === 'open' && s.phase === 1 && 'text-portal-ink font-semibold')}>{e.trial_days_1 ? `${e.trial_days_1} dias · ` : ''}{fmt(e.trial_end_1)}</p></div>
                <div><p className="text-muted-foreground">Prorrogação</p><p className={cn('font-medium tabular-nums', s.kind === 'open' && s.phase === 2 && 'text-portal-ink font-semibold')}>{e.trial_end_2 ? `${e.trial_days_2 ? `${e.trial_days_2} dias · ` : ''}${fmt(e.trial_end_2)}` : '—'}</p></div>
              </div>
              <span className={cn('self-start sm:self-center inline-flex rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap', l.cls)}>{l.text}</span>
            </div>
          ); })}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-portal-ink">Funcionários</h2>
          <div className="flex gap-2 overflow-x-auto"><Chip on={sit === 'ativos'} onClick={() => setSit('ativos')}>Ativos</Chip><Chip on={sit === 'demitidos'} onClick={() => setSit('demitidos')}>Demitidos</Chip><Chip on={sit === 'todos'} onClick={() => setSit('todos')}>Todos</Chip></div>
        </div>
        <div className="relative mb-2"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar funcionário" placeholder="Buscar por nome, cargo ou código" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-11" /></div>
        {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum funcionário encontrado.</p>}
        <div className="divide-y divide-border/70">
          {list.map(e => (
            <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-portal-ink truncate">{e.employee_code ? <span className="text-muted-foreground font-normal mr-1">{e.employee_code}</span> : null}{e.full_name}</p><p className="text-xs text-muted-foreground truncate">{e.position || 'Cargo não informado'}{e.cpf_masked ? ` · ${e.cpf_masked}` : ''}</p></div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="text-muted-foreground">Admissão {fmt(e.admission_date)}</span>
                <span className="font-semibold tabular-nums text-portal-ink">{e.salary != null ? brl(Number(e.salary)) : '—'}</span>
                <span className={cn('rounded-md px-2 py-0.5 font-medium', isActive(e) ? TONE.ok : TONE.none)}>{isActive(e) ? 'Ativo' : `Demitido ${fmt(e.termination_date)}`}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-bold text-portal-ink mb-3">Férias</h2>
        {vacs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum período de férias cadastrado.</p>}
        <div className="divide-y divide-border/70">
          {vacs.map(v => { const t = vacationTone(v.deadline_date, !!v.enjoy_start, today); return (
            <div key={v.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-portal-ink truncate">{v.employee_name}</p><p className="text-xs text-muted-foreground">Aquisitivo {fmt(v.acquisition_start)} a {fmt(v.acquisition_end)}{v.days_right != null ? ` · ${Number(v.days_right)} dias` : ''}</p></div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:w-72">
                <div><p className="text-muted-foreground">Gozo</p><p className="font-medium tabular-nums">{v.enjoy_start ? `${fmt(v.enjoy_start)} a ${fmt(v.enjoy_end)}` : 'Não programado'}</p></div>
                <div><p className="text-muted-foreground">Data limite</p><p className={cn('inline-flex rounded px-1.5 font-medium tabular-nums', TONE[t])}>{fmt(v.deadline_date)}</p></div>
              </div>
            </div>
          ); })}
        </div>
      </SectionCard>
    </div>
  );
}
