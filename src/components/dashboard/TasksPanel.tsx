import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from './MetricCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, AlertTriangle, Trophy, ArrowRight, CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Period = 'month' | 'last7' | 'last30' | 'year' | 'custom';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface Range {
  start: string;
  end: string;
}

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function computeRange(period: Period, custom: DateRange): Range {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'month': {
      const start = startOfMonth(today).toISOString();
      const end = addDays(endOfMonth(today), 1).toISOString();
      return { start, end };
    }
    case 'last7': {
      const start = subDays(today, 6).toISOString();
      const end = addDays(today, 1).toISOString();
      return { start, end };
    }
    case 'last30': {
      const start = subDays(today, 29).toISOString();
      const end = addDays(today, 1).toISOString();
      return { start, end };
    }
    case 'year': {
      const start = startOfYear(today).toISOString();
      const end = addDays(endOfYear(today), 1).toISOString();
      return { start, end };
    }
    case 'custom': {
      const from = custom.from ?? today;
      const to = custom.to ?? from;
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString();
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString();
      return { start, end };
    }
  }
}

function periodLabel(period: Period, custom: DateRange): string {
  switch (period) {
    case 'month':
      return 'Mês atual';
    case 'last7':
      return 'Últimos 7 dias';
    case 'last30':
      return 'Últimos 30 dias';
    case 'year':
      return 'Ano atual';
    case 'custom':
      if (custom.from && custom.to) {
        return `${format(custom.from, 'dd/MM/yyyy')} a ${format(custom.to, 'dd/MM/yyyy')}`;
      }
      return 'Personalizado';
  }
}

function periodSubtitle(period: Period, custom: DateRange): string {
  const { start, end } = computeRange(period, custom);
  const from = format(new Date(start), 'dd/MM/yyyy');
  const to = format(new Date(new Date(end).getTime() - 1), 'dd/MM/yyyy');
  return `${from} a ${to}`;
}

export function TasksPanel() {
  const [period, setPeriod] = useState<Period>('month');
  const [customRange, setCustomRange] = useState<DateRange>({});

  const range = useMemo(() => computeRange(period, customRange), [period, customRange]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const td = todayRange();

  const { data } = useQuery({
    queryKey: ['dashboard-tasks', period, customRange.from?.toISOString(), customRange.to?.toISOString()],
    refetchInterval: 30000,
    queryFn: async () => {
      const [pending, pendingNoDate, inProgress, done, overdue, doneToday, doneTodayIds] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', range.start).lt('due_date', range.end).eq('status', 'todo'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .is('due_date', null).eq('status', 'todo'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', range.start).lt('due_date', range.end).in('status', ['in_progress', 'in_review']),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', range.start).lt('due_date', range.end).eq('status', 'done'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', range.start).lt('due_date', todayStr).neq('status', 'done'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('status', 'done').gte('updated_at', td.start).lt('updated_at', td.end),
        supabase.from('tasks').select('id')
          .eq('status', 'done').gte('updated_at', td.start).lt('updated_at', td.end)
          .limit(500),
      ]);

      const taskIds = (doneTodayIds.data ?? []).map((t: any) => t.id);
      let assignments: { user_id: string }[] = [];
      if (taskIds.length > 0) {
        const { data: asg } = await supabase
          .from('task_assignments')
          .select('user_id')
          .in('task_id', taskIds);
        assignments = (asg ?? []) as any;
      }

      const userIds = Array.from(new Set(assignments.map((r) => r.user_id).filter(Boolean)));
      const profileMap: Record<string, { name: string; color: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, tag_color')
          .in('user_id', userIds);
        (profs ?? []).forEach((p: any) => {
          profileMap[p.user_id] = { name: p.full_name ?? 'Usuário', color: p.tag_color ?? null };
        });
      }

      const counts: Record<string, { name: string; color: string | null; count: number }> = {};
      assignments.forEach((row) => {
        const id = row.user_id;
        if (!id) return;
        const prof = profileMap[id];
        counts[id] = counts[id] || { name: prof?.name ?? 'Usuário', color: prof?.color ?? null, count: 0 };
        counts[id].count += 1;
      });
      const ranking = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);

      return {
        pending: (pending.count ?? 0) + (pendingNoDate.count ?? 0),
        inProgress: inProgress.count ?? 0,
        done: done.count ?? 0,
        overdue: overdue.count ?? 0,
        doneToday: doneToday.count ?? 0,
        ranking,
      };
    },
  });

  const navigate = useNavigate();
  const totalPending = (data?.pending ?? 0) + (data?.inProgress ?? 0);

  return (
    <Card className="relative overflow-hidden bg-card border-2 border-border/70 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-5 h-full">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Tarefas</h2>
              <p className="text-xs text-muted-foreground font-medium">
                {totalPending > 0 ? `${totalPending} ${totalPending === 1 ? 'pendente' : 'pendentes'}` : 'Tudo em dia'}
                {' · '}
                {periodLabel(period, customRange)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary hover:bg-primary/10 shrink-0" onClick={() => navigate('/tasks')}>
            Ver tudo <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="last7">Últimos 7 dias</SelectItem>
              <SelectItem value="last30">Últimos 30 dias</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 justify-start text-left font-normal text-xs w-auto gap-2',
                    !customRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customRange.from && customRange.to
                    ? `${format(customRange.from, 'dd/MM/yyyy')} - ${format(customRange.to, 'dd/MM/yyyy')}`
                    : customRange.from
                      ? format(customRange.from, 'dd/MM/yyyy')
                      : 'Selecione o período'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                  initialFocus
                  numberOfMonths={2}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {periodSubtitle(period, customRange)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
        <MetricCard label="Pendentes" value={data?.pending ?? '—'} />
        <MetricCard label="Em andamento" value={data?.inProgress ?? '—'} accent="warning" />
        <MetricCard label="Concluídas" value={data?.done ?? '—'} accent="success" />
        <MetricCard
          label="Atrasadas"
          value={data?.overdue ?? '—'}
          accent="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard label="Hoje" value={data?.doneToday ?? '—'} accent="success" />
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Ranking de hoje</span>
        </div>
        {data?.ranking && data.ranking.length > 0 ? (
          <div className="space-y-2">
            {data.ranking.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md hover:bg-muted/40">
                <span className="w-5 text-muted-foreground tabular-nums font-medium">{i + 1}.</span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: r.color ?? 'hsl(var(--primary))' }}
                />
                <span className="flex-1 truncate font-medium">{r.name}</span>
                <span className="tabular-nums font-semibold">{r.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma conclusão ainda hoje.</p>
        )}
      </div>
    </Card>
  );
}
