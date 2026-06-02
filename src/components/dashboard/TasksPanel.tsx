import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from './MetricCard';
import { Card } from '@/components/ui/card';
import { CheckSquare, AlertTriangle, Trophy } from 'lucide-react';

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

      const [pending, inProgress, done, overdue, doneToday, completions] = await Promise.all([
        supabase.from('obligation_instances').select('id', { count: 'exact', head: true })
          .gte('reference_month', start).lt('reference_month', end).eq('status', 'pending').is('deleted_at', null),
        supabase.from('obligation_instances').select('id', { count: 'exact', head: true })
          .gte('reference_month', start).lt('reference_month', end).eq('status', 'in_progress').is('deleted_at', null),
        supabase.from('obligation_instances').select('id', { count: 'exact', head: true })
          .gte('reference_month', start).lt('reference_month', end).eq('status', 'done').is('deleted_at', null),
        supabase.from('obligation_instances').select('id', { count: 'exact', head: true })
          .lt('due_date', today).neq('status', 'done').is('deleted_at', null),
        supabase.from('obligation_activity_completions')
          .select('id', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('completed_at', td.start).lt('completed_at', td.end),
        supabase.from('obligation_activity_completions')
          .select('completed_by, profiles:completed_by(full_name, tag_color)')
          .eq('completed', true)
          .gte('completed_at', td.start).lt('completed_at', td.end)
          .not('completed_by', 'is', null)
          .limit(500),
      ]);

      const counts: Record<string, { name: string; color: string | null; count: number }> = {};
      (completions.data ?? []).forEach((row: any) => {
        const id = row.completed_by;
        if (!id) return;
        const name = row.profiles?.full_name ?? 'Usuário';
        const color = row.profiles?.tag_color ?? null;
        counts[id] = counts[id] || { name, color, count: 0 };
        counts[id].count += 1;
      });
      const ranking = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);

      return {
        pending: pending.count ?? 0,
        inProgress: inProgress.count ?? 0,
        done: done.count ?? 0,
        overdue: overdue.count ?? 0,
        doneToday: doneToday.count ?? 0,
        ranking,
      };
    },
  });

  return (
    <Card className="bg-card/40 border-border/40 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Tarefas do mês</h2>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
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
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Ranking de hoje</span>
        </div>
        {data?.ranking && data.ranking.length > 0 ? (
          <div className="space-y-1.5">
            {data.ranking.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-muted-foreground tabular-nums">{i + 1}.</span>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: r.color ?? 'hsl(var(--primary))' }}
                />
                <span className="flex-1 truncate">{r.name}</span>
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