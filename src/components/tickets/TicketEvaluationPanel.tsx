import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function NpsBadge({ score, status }: { score: number | null; status?: string | null }) {
  if (score == null) {
    if (status === 'not_applicable') return <span className="text-xs text-muted-foreground">N/A</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const cls = score >= 9
    ? 'bg-primary/15 text-primary'
    : score >= 7
      ? 'bg-muted text-foreground'
      : 'bg-destructive/15 text-destructive';
  return <span className={`inline-flex min-w-7 justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>{score}</span>;
}

type Props = {
  sinceIso: string | null;
  agent: string;
  dept: string;
  profileMap: Record<string, { name: string; color: string | null }>;
  deptMap: Record<string, string>;
  onOpenTicket: (t: any) => void;
};

type Row = {
  id: string; ticket_number: number; assigned_to: string | null; department_id: string | null;
  nps_score: number | null; empathy_score: number | null; clarity_score: number | null; resolution_score: number | null;
  evaluation_status: string; contact_name: string | null; contact_phone: string | null; subject: string | null;
  closed_at: string | null; feedback_improvements: string | null;
};

function npsOf(list: Row[]) {
  const s = list.filter(r => r.nps_score != null);
  if (!s.length) return null;
  const p = s.filter(r => r.nps_score! >= 9).length;
  const d = s.filter(r => r.nps_score! <= 6).length;
  return Math.round(((p - d) / s.length) * 100);
}
const avg = (arr: (number | null)[]) => {
  const v = arr.filter((x): x is number => x != null);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const f1 = (n: number | null) => (n == null ? '—' : n.toFixed(1));

export function TicketEvaluationPanel({ sinceIso, agent, dept, profileMap, deptMap, onOpenTicket }: Props) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['tickets-eval', sinceIso, agent, dept],
    queryFn: async () => {
      let q = supabase
        .from('support_tickets')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(2000);
      if (sinceIso) q = q.gte('closed_at', sinceIso);
      if (agent !== 'all') q = q.eq('assigned_to', agent);
      if (dept !== 'all') q = q.eq('department_id', dept);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const stats = useMemo(() => {
    const all = data ?? [];
    const done = all.filter(r => r.evaluation_status === 'done' && r.nps_score != null);
    const group = (key: 'assigned_to' | 'department_id', label: (id: string) => string) => {
      const m = new Map<string, Row[]>();
      done.forEach(r => { const k = r[key] ?? '__none'; m.set(k, [...(m.get(k) ?? []), r]); });
      return [...m.entries()].map(([id, list]) => ({
        id, name: id === '__none' ? 'Sem definição' : label(id), count: list.length,
        nps: npsOf(list), avg: avg(list.map(r => r.nps_score)),
      })).sort((a, b) => (b.nps ?? -999) - (a.nps ?? -999));
    };
    return {
      total: all.length,
      evaluated: done.length,
      pending: all.filter(r => r.evaluation_status === 'pending').length,
      na: all.filter(r => r.evaluation_status === 'not_applicable').length,
      nps: npsOf(done),
      promoters: done.filter(r => r.nps_score! >= 9).length,
      neutrals: done.filter(r => r.nps_score! >= 7 && r.nps_score! <= 8).length,
      detractors: done.filter(r => r.nps_score! <= 6).length,
      empathy: avg(done.map(r => r.empathy_score)),
      clarity: avg(done.map(r => r.clarity_score)),
      resolution: avg(done.map(r => r.resolution_score)),
      byAgent: group('assigned_to', id => profileMap[id]?.name ?? 'Atendente'),
      byDept: group('department_id', id => deptMap[id] ?? '—'),
      critical: done.filter(r => r.nps_score! <= 6).slice(0, 30),
    };
  }, [data, profileMap, deptMap]);

  const runBackfill = async () => {
    setRunning(true);
    let totalEval = 0;
    try {
      for (let i = 0; i < 40; i++) {
        const { data: res, error } = await supabase.functions.invoke('ticket-summarize', {
          body: { evaluate_backfill: true, days: 30, limit: 8 },
        });
        if (error) throw error;
        totalEval += res?.evaluated ?? 0;
        if (!res?.remaining || !res?.evaluated) break;
      }
      toast({ title: 'Avaliação concluída', description: `${totalEval} atendimento(s) avaliados.` });
    } catch (e: any) {
      toast({ title: 'Avaliação interrompida', description: e?.message, variant: 'destructive' });
    } finally {
      setRunning(false);
      refetch();
    }
  };

  const Ranking = ({ title, items }: { title: string; items: typeof stats.byAgent }) => (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">{title}</div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Sem avaliações.</p> : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr>
            <th className="text-left font-medium py-1">Nome</th><th className="text-right font-medium">Avaliados</th>
            <th className="text-right font-medium">Média</th><th className="text-right font-medium">NPS</th>
          </tr></thead>
          <tbody>{items.map(i => (
            <tr key={i.id} className="border-t border-border/40">
              <td className="py-1.5 truncate max-w-[180px]">{i.name}</td>
              <td className="text-right tabular-nums">{i.count}</td>
              <td className="text-right tabular-nums">{f1(i.avg)}</td>
              <td className="text-right tabular-nums font-semibold">{i.nps ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Card>
  );

  const Metric = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stats.evaluated} avaliados · {stats.na} não avaliáveis · {stats.pending} pendentes (de {stats.total} encerrados)
        </p>
        <Button size="sm" variant="outline" onClick={runBackfill} disabled={running}>
          <Sparkles className="h-4 w-4 mr-2" /> {running ? 'Avaliando...' : 'Avaliar últimos 30 dias'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="NPS geral" value={stats.nps ?? '—'}
          hint={`${stats.promoters} promotores · ${stats.neutrals} neutros · ${stats.detractors} detratores`} />
        <Metric label="Empatia" value={f1(stats.empathy)} hint="de 1 a 5" />
        <Metric label="Clareza técnica" value={f1(stats.clarity)} hint="de 1 a 5" />
        <Metric label="Resolução" value={f1(stats.resolution)} hint="de 1 a 5" />
        <Metric label="Críticos" value={stats.detractors} hint="nota 6 ou menor" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Ranking title="Por atendente" items={stats.byAgent} />
        <Ranking title="Por departamento" items={stats.byDept} />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Atendimentos críticos
        </div>
        {stats.critical.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum atendimento crítico no período.</p> : (
          <div className="divide-y divide-border/40">
            {stats.critical.map(r => (
              <button key={r.id} onClick={() => onOpenTicket(r)} className="w-full text-left py-2 flex items-start gap-3 hover:bg-muted/40 px-2 rounded">
                <NpsBadge score={r.nps_score} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">#{r.ticket_number} · {r.contact_name || r.contact_phone || '—'} · {r.subject || 'Sem assunto'}</p>
                  {r.feedback_improvements && <p className="text-xs text-muted-foreground truncate">{r.feedback_improvements}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{r.assigned_to ? profileMap[r.assigned_to]?.name ?? '—' : '—'}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
