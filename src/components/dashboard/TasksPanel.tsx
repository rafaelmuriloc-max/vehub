import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from './MetricCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, AlertTriangle, Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

export function TasksPanel() {
  const { data } = useQuery({
    queryKey: ['dashboard-tasks'],
    refetchInterval: 30000,
    queryFn: async () => {
      const { start, end } = monthRange();
      const today = new Date().toISOString().slice(0, 10);
      const td = todayRange();

      const [pending, pendingNoDate, inProgress, done, overdue, doneToday, doneTodayIds] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', start).lt('due_date', end).eq('status', 'todo'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .is('due_date', null).eq('status', 'todo'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', start).lt('due_date', end).in('status', ['in_progress', 'in_review']),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', start).lt('due_date', end).eq('status', 'done'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', start).lt('due_date', today).neq('status', 'done'),
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
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Tarefas do mês</h2>
            <p className="text-xs text-muted-foreground font-medium">
              {totalPending > 0 ? `${totalPending} ${totalPending === 1 ? 'pendente' : 'pendentes'}` : 'Tudo em dia'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary hover:bg-primary/10" onClick={() => navigate('/tasks')}>
          Ver tudo <ArrowRight className="h-4 w-4" />
        </Button>
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