import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Building2, CalendarClock, ChevronRight, Palmtree, Users, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PersonnelEvolutionChart, brlMil, usePayrollMonthly } from './PersonnelEvolutionChart';

type Tone = 'primary' | 'success' | 'danger' | 'warning';
const TONE: Record<Tone, { box: string; bar: string }> = {
  primary: { box: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  success: { box: 'bg-success/10 text-success', bar: 'bg-success' },
  danger: { box: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
  warning: { box: 'bg-warning/10 text-warning', bar: 'bg-warning' },
};

type Props = {
  clientIds: string[];
  activeCount: number;
  terminatedCount: number;
  companiesWithActive: number;
  totalSalaries: number;
  trialSoon: number;
  trialOverdue: number;
  vacationSoon: number;
  vacationOverdue: number;
  onTrial: () => void;
  onVacation: () => void;
};

const pct = (a?: number, b?: number) => (a == null || !b ? null : ((a - b) / b) * 100);

function Kpi({ title, badge, value, delta, invert, footer, Icon, tone, bars, onClick }: {
  title: string; badge?: string; value: string; delta: number | null; invert?: boolean;
  footer: React.ReactNode; Icon: LucideIcon; tone: Tone; bars: number[]; onClick?: () => void;
}) {
  const max = Math.max(...bars, 1);
  const up = (delta ?? 0) >= 0;
  const good = invert ? !up : up;
  return (
    <Card className={cn('rounded-2xl border-border/70 shadow-sm', onClick && 'cursor-pointer hover:border-primary/30 transition-colors')} onClick={onClick}>
      <CardContent className="p-5 flex gap-4 min-h-[150px]">
        <div className={cn('h-14 w-14 rounded-2xl shrink-0 flex items-center justify-center', TONE[tone].box)}><Icon className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{title}</p>
            {badge && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">{badge}</span>}
            <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold tabular-nums truncate mt-1">{value}</p>
          <div className="flex items-end justify-between gap-2 mt-auto">
            <div className="min-w-0 space-y-1.5">
              {delta != null && (
                <p className="text-xs flex items-center gap-1">
                  <span className={cn('inline-flex items-center gap-0.5 font-semibold', good ? 'text-success' : 'text-destructive')}>
                    {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    {up ? '+' : ''}{delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground">vs. mês anterior</span>
                </p>
              )}
              <div className="text-xs text-muted-foreground">{footer}</div>
            </div>
            <div className="h-9 w-16 flex items-end gap-[3px] shrink-0" aria-hidden="true">
              {bars.map((b, i) => <span key={i} className={cn('flex-1 rounded-t-sm', TONE[tone].bar)} style={{ height: `${Math.max(15, (b / max) * 100)}%`, opacity: 0.35 + (i / bars.length) * 0.65 }} />)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonnelOverview(p: Props) {
  const { months, loading } = usePayrollMonthly(p.clientIds);
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const recent = months.slice(-8);
  const empBars = recent.length ? recent.map(m => m.funcionarios) : [4, 6, 5, 7, 6, 8, 7, 9];
  const salBars = recent.length ? recent.map(m => m.salarios) : [4, 6, 5, 7, 6, 8, 7, 9];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="Funcionários ativos" value={p.activeCount.toLocaleString('pt-BR')} delta={pct(last?.funcionarios, prev?.funcionarios)}
          Icon={Users} tone="primary" bars={empBars}
          footer={<span className="flex flex-wrap gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{p.companiesWithActive} empresas</span><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.terminatedCount} desligados</span></span>} />
        <Kpi title="Total de salários" value={brlMil(p.totalSalaries)} delta={pct(last?.salarios, prev?.salarios)}
          Icon={Wallet} tone="success" bars={salBars} footer={`Folha dos ${p.activeCount.toLocaleString('pt-BR')} funcionários`} />
        <Kpi title="Experiências a vencer" badge="15 dias" value={p.trialSoon.toLocaleString('pt-BR')} delta={null}
          Icon={CalendarClock} tone="danger" bars={[3, 5, 2, 7, 4, 9, 3, 6]} footer={`${p.trialOverdue} prazo(s) já vencidos`} onClick={p.onTrial} />
        <Kpi title="Férias a vencer" badge="60 dias" value={p.vacationSoon.toLocaleString('pt-BR')} delta={null}
          Icon={Palmtree} tone="warning" bars={[2, 4, 3, 5, 4, 7, 6, 9]} footer={`${p.vacationOverdue} período(s) já vencidos`} onClick={p.onVacation} />
      </div>
      <PersonnelEvolutionChart months={months} loading={loading} />
    </>
  );
}
