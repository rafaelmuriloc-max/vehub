import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Calendar, ListChecks } from 'lucide-react';

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

export function ObligationsPanel() {
  const { data } = useQuery({
    queryKey: ['dashboard-obligations'],
    refetchInterval: 30000,
    queryFn: async () => {
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const in7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().slice(0, 10);
      const { start, end } = monthRange();

      const [upcoming, monthAll] = await Promise.all([
        supabase
          .from('obligation_instances')
          .select('id, due_date, status, client:client_id(company_name), obligation:obligation_id(name, department:department_id(name))')
          .gte('due_date', todayISO)
          .lte('due_date', in7)
          .neq('status', 'done')
          .is('deleted_at', null)
          .order('due_date', { ascending: true })
          .limit(12),
        supabase
          .from('obligation_instances')
          .select('status, obligation:obligation_id(department:department_id(id, name))')
          .gte('reference_month', start)
          .lt('reference_month', end)
          .is('deleted_at', null),
      ]);

      const byDept: Record<string, { name: string; total: number; done: number }> = {};
      (monthAll.data ?? []).forEach((row: any) => {
        const dept = row.obligation?.department;
        if (!dept?.id) return;
        byDept[dept.id] = byDept[dept.id] || { name: dept.name, total: 0, done: 0 };
        byDept[dept.id].total += 1;
        if (row.status === 'done') byDept[dept.id].done += 1;
      });
      const departments = Object.values(byDept).sort((a, b) => b.total - a.total);

      return { upcoming: upcoming.data ?? [], departments };
    },
  });

  return (
    <Card className="bg-card/40 border-border/40 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Obrigações</h2>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Conclusão do mês por departamento</span>
        </div>
        <div className="space-y-2">
          {data?.departments && data.departments.length > 0 ? data.departments.map((d, i) => {
            const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{d.done}/{d.total} · <strong className="text-foreground">{pct}%</strong></span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Vencendo nos próximos 7 dias</div>
        <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
          {data?.upcoming && data.upcoming.length > 0 ? data.upcoming.map((o: any) => {
            const d = o.due_date ? new Date(o.due_date + 'T00:00:00') : null;
            const today = new Date(); today.setHours(0,0,0,0);
            const days = d ? Math.round((d.getTime() - today.getTime()) / 86400000) : null;
            const danger = days !== null && days <= 1;
            return (
              <div key={o.id} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md hover:bg-muted/30">
                <div className={`tabular-nums font-bold w-14 text-center rounded-md py-1 text-xs ${danger ? 'bg-red-500/20 text-red-300' : 'bg-primary/15 text-primary'}`}>
                  {d?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{o.obligation?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.client?.company_name}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{o.obligation?.department?.name}</span>
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">Sem obrigações nos próximos 7 dias.</p>}
        </div>
      </div>
    </Card>
  );
}