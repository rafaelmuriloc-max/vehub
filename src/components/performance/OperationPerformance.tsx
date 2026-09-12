import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BarChart3, CheckSquare, Clock, ListChecks, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getHolidays, previousBusinessDay } from '@/lib/holidays';
import { DepartmentGauge, OfficeGauge } from './gauges';

type Instance = { id: string; client_id: string; obligation_id: string; reference_month: string; due_date?: string | null; deleted_at?: string | null; status?: string | null; on_hold?: boolean | null };
type Obligation = { id: string; department_id: string; alert_day: number | null; target_day: number | null; due_day: number | null; recurrence?: string | null };
type Department = { id: string; name: string };
type Activity = { id: string; obligation_id: string };
type Completion = { id: string; instance_id: string; activity_id: string; completed: boolean; completed_at: string | null };

const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}-`;
const dayKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function OperationPerformance() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const previousDate = new Date(year, month - 1, 1);
  const rangeStart = dayKey(previousDate.getFullYear(), previousDate.getMonth(), 1);
  const nextDate = new Date(year, month + 1, 1);
  const rangeEnd = dayKey(nextDate.getFullYear(), nextDate.getMonth(), 1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['operation-performance', rangeStart, rangeEnd],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const instCols = 'id, client_id, obligation_id, reference_month, due_date, deleted_at, status, on_hold';
      const [oblRes, deptRes, actRes, byRefRes, byDueRes, complRes, cliRes] = await Promise.all([
        supabase.from('obligations').select('id, department_id, alert_day, target_day, due_day, recurrence'),
        supabase.from('departments').select('id, name'),
        supabase.from('obligation_activities').select('id, obligation_id'),
        supabase.from('obligation_instances').select(instCols).gte('reference_month', rangeStart).lt('reference_month', rangeEnd),
        supabase.from('obligation_instances').select(instCols).gte('due_date', rangeStart).lt('due_date', rangeEnd),
        supabase.rpc('get_calendar_month_completions', { p_start: rangeStart, p_end: rangeEnd }),
        supabase.from('clients').select('id, services_suspended'),
      ]);
      const firstErr = oblRes.error || deptRes.error || actRes.error || byRefRes.error || byDueRes.error || complRes.error || cliRes.error;
      if (firstErr) throw new Error(firstErr.message);

      const byId = new Map<string, Instance>();
      for (const row of ((byRefRes.data as Instance[]) || [])) byId.set(row.id, row);
      for (const row of ((byDueRes.data as Instance[]) || [])) byId.set(row.id, row);

      const suspendedClients = new Set(
        ((cliRes.data as { id: string; services_suspended: boolean | null }[]) || [])
          .filter(c => c.services_suspended)
          .map(c => c.id),
      );

      return {
        obligations: (oblRes.data as Obligation[]) || [],
        departments: (deptRes.data as Department[]) || [],
        activities: (actRes.data as Activity[]) || [],
        instances: Array.from(byId.values()).filter(i => !i.deleted_at && !i.on_hold && !suspendedClients.has(i.client_id)),
        completions: (complRes.data as Completion[]) || [],
      };
    },
  });

  const computed = useMemo(() => {
    const empty = {
      stats: { current: { toDo: 0, overdue: 0, completed: 0, doneLate: 0, dueToday: 0, total: 0, performance: 0 }, change: 0 },
      departments: [] as { id: string; name: string; value: number; change: number }[],
    };
    if (!data) return empty;

    const { obligations, departments, activities, instances, completions } = data;
    const oblMap = new Map(obligations.map(o => [o.id, o]));

    const activitiesByObligation = new Map<string, string[]>();
    for (const act of activities) {
      const list = activitiesByObligation.get(act.obligation_id) || [];
      list.push(act.id);
      activitiesByObligation.set(act.obligation_id, list);
    }
    const completionMap = new Map<string, Completion>();
    for (const comp of completions) completionMap.set(`${comp.instance_id}|${comp.activity_id}`, comp);

    const isCompleted = (inst: Instance) => {
      if (inst.status === 'done') return true;
      const acts = activitiesByObligation.get(inst.obligation_id) || [];
      if (acts.length === 0) return false;
      return acts.every(actId => completionMap.get(`${inst.id}|${actId}`)?.completed === true);
    };

    const completedAt = (instanceId: string) => {
      let max: string | null = null;
      for (const comp of completions) {
        if (comp.instance_id !== instanceId || !comp.completed || !comp.completed_at) continue;
        if (!max || comp.completed_at > max) max = comp.completed_at;
      }
      return max;
    };

    const dueDateOf = (inst: Instance, holidays: ReturnType<typeof getHolidays>) => {
      if (inst.due_date) return inst.due_date;
      const obl = oblMap.get(inst.obligation_id);
      if (!obl?.due_day) return null;
      const refDate = new Date(inst.reference_month + 'T00:00:00');
      return previousBusinessDay(dayKey(refDate.getFullYear(), refDate.getMonth(), obl.due_day), holidays);
    };

    const isLateDelivery = (inst: Instance, holidays: ReturnType<typeof getHolidays>) => {
      if (!isCompleted(inst)) return false;
      const done = completedAt(inst.id);
      const due = dueDateOf(inst, holidays);
      if (!done || !due) return false;
      return done.split('T')[0] > due;
    };

    const calculate = (targetYear: number, targetMonth: number) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const prefix = monthKey(targetYear, targetMonth);
      const hols = getHolidays(targetYear);
      let todo = 0, afterAlert = 0, afterTarget = 0, overdue = 0, doneOnTime = 0, doneLate = 0, dueToday = 0;

      const makeDate = (day: number | null, refMonth: string) => {
        if (!day) return null;
        const rd = new Date(refMonth + 'T00:00:00');
        return previousBusinessDay(dayKey(rd.getFullYear(), rd.getMonth(), day), hols);
      };

      for (const inst of instances) {
        if (!inst.reference_month.startsWith(prefix) && !inst.due_date?.startsWith(prefix)) continue;
        const obl = oblMap.get(inst.obligation_id);
        if (!obl) continue;

        const isQuarterly = obl.recurrence === 'trimestral';
        const alertDate = isQuarterly ? null : makeDate(obl.alert_day, inst.reference_month);
        const targetDate = isQuarterly ? null : makeDate(obl.target_day, inst.reference_month);
        const dueDate = inst.due_date ?? makeDate(obl.due_day, inst.reference_month);
        const completed = isCompleted(inst);

        if (completed) {
          if (isLateDelivery(inst, hols)) doneLate++;
          else doneOnTime++;
        } else if (dueDate && todayStr > dueDate) overdue++;
        else if (dueDate && todayStr === dueDate) dueToday++;
        else if (targetDate && todayStr >= targetDate) afterTarget++;
        else if (alertDate && todayStr >= alertDate) afterAlert++;
        else todo++;
      }

      const completed = doneOnTime + doneLate;
      const toDo = todo + afterAlert + afterTarget + dueToday;
      const total = toDo + overdue + completed;
      return { toDo, overdue, completed, doneOnTime, doneLate, dueToday, total, performance: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    const current = calculate(year, month);
    const previous = calculate(previousDate.getFullYear(), previousDate.getMonth());

    const performanceFor = (departmentId: string, targetYear: number, targetMonth: number) => {
      const prefix = monthKey(targetYear, targetMonth);
      const hols = getHolidays(targetYear);
      let completed = 0;
      let total = 0;
      for (const inst of instances) {
        if (!inst.reference_month.startsWith(prefix) && !inst.due_date?.startsWith(prefix)) continue;
        const obl = oblMap.get(inst.obligation_id);
        if (!obl || obl.department_id !== departmentId) continue;
        total++;
        if (isCompleted(inst)) completed++;
      }
      void hols;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    };

    const departmentOrder = ['fiscal', 'contabil', 'pessoal'];
    const visibleDepartments = departments
      .filter(dep => departmentOrder.some(term => dep.name.toLocaleLowerCase('pt-BR').includes(term)))
      .sort((a, b) => {
        const ai = departmentOrder.findIndex(term => a.name.toLocaleLowerCase('pt-BR').includes(term));
        const bi = departmentOrder.findIndex(term => b.name.toLocaleLowerCase('pt-BR').includes(term));
        return ai - bi;
      })
      .map(dep => {
        const value = performanceFor(dep.id, year, month);
        const prev = performanceFor(dep.id, previousDate.getFullYear(), previousDate.getMonth());
        const displayName = dep.name.replace(/^Depto\s+/i, '');
        return { id: dep.id, name: displayName, value, change: value - prev };
      });

    return {
      stats: { current, change: current.performance - previous.performance },
      departments: visibleDepartments,
    };
  }, [data, year, month, previousDate]);

  if (isLoading) {
    return (
      <Card className="rounded-md shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-md shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os indicadores das obrigações.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const stats = computed.stats.current;
  const cards = [
    { label: 'A fazer', value: stats.toDo, detail: stats.dueToday > 0 ? `${stats.dueToday} vencem hoje` : 'Em andamento', progress: stats.total ? Math.round((stats.toDo / stats.total) * 100) : 0, icon: ListChecks, tone: 'text-calendar-blue', surface: 'bg-calendar-blue-soft border-calendar-blue/20', iconBg: 'bg-calendar-blue', progressTone: '[&>div]:bg-calendar-blue', showPercent: true },
    { label: 'Atrasadas', value: stats.overdue, detail: `Crítico • ${stats.overdue} vencida${stats.overdue === 1 ? '' : 's'}`, progress: stats.total ? Math.round((stats.overdue / stats.total) * 100) : 0, icon: AlertTriangle, tone: 'text-calendar-red', surface: 'bg-calendar-red-soft border-calendar-red/20', iconBg: 'bg-calendar-red', progressTone: '[&>div]:bg-calendar-red', showPercent: false },
    { label: 'Concluídas', value: stats.completed, detail: `de ${stats.total} no período`, progress: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0, icon: CheckSquare, tone: 'text-calendar-green', surface: 'bg-calendar-green-soft border-calendar-green/20', iconBg: 'bg-calendar-green', progressTone: '[&>div]:bg-calendar-green', showPercent: true },
    { label: 'Fora do prazo', value: stats.doneLate, detail: 'Revisar e regularizar', progress: stats.total ? Math.round((stats.doneLate / stats.total) * 100) : 0, icon: Clock, tone: 'text-muted-foreground', surface: 'bg-muted/40 border-border', iconBg: 'bg-muted-foreground/70', progressTone: '[&>div]:bg-muted-foreground/60', showPercent: false },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-center gap-3 xl:grid-cols-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
          {cards.map(item => (
            <Card key={item.label} className={`rounded-xl border shadow-none ${item.surface}`}>
              <CardContent className="flex h-full flex-col justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${item.iconBg}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate font-calendarHeading text-base font-bold ${item.tone}`}>{item.label}</p>
                    <p className="font-calendarHeading text-3xl font-extrabold leading-tight text-calendar-navy">{item.value}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={item.progress} className={`h-2 flex-1 rounded-full bg-background ${item.progressTone}`} />
                  {item.showPercent && <span className={`w-9 text-right text-xs font-semibold ${item.tone}`}>{item.progress}%</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="flex h-full flex-col rounded-md border-border bg-card shadow-sm">
          <CardContent className="flex h-full flex-col items-center gap-1 px-5 py-4">
            <div className="flex items-start gap-2.5 self-start">
              <BarChart3 className="mt-1 h-6 w-6 text-calendar-orange" />
              <div>
                <p className="font-calendarHeading text-2xl font-bold text-calendar-navy">Desempenho geral da operação</p>
                <p className="text-xs text-muted-foreground">Visão consolidada de todos os departamentos</p>
              </div>
            </div>
            <OfficeGauge value={stats.performance} change={computed.stats.change} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-sm shadow-none">
        <CardContent className="p-0">
          <div className="flex gap-2.5 border-b border-border px-4 py-3">
            <BarChart3 className="mt-0.5 h-5 w-5 text-calendar-orange" />
            <div>
              <h2 className="font-calendarHeading text-xl font-bold text-calendar-navy">Desempenho geral dos departamentos</h2>
              <p className="text-[11px] text-muted-foreground">Acompanhe o desempenho de cada departamento no cumprimento das obrigações.</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto px-3 py-3">
            {computed.departments.length > 0
              ? computed.departments.map(dep => <DepartmentGauge key={dep.id} name={dep.name} value={dep.value} change={dep.change} />)
              : <p className="w-full py-8 text-center text-sm text-muted-foreground">Nenhum departamento encontrado.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
