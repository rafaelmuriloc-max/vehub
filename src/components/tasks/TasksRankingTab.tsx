import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatClientLabel } from '@/lib/utils';

type RankTask = {
  id: string;
  status: string;
  due_date: string | null;
  client_id: string | null;
  department_id?: string | null;
  template_id?: string | null;
  title: string;
};
type Client = { id: string; sci_code?: string | null; company_name: string };
type Department = { id: string; name: string };
type TaskTemplate = { id: string; name: string };

type Props = {
  tasks: RankTask[];
  clients: Client[];
  departments: Department[];
  templates: TaskTemplate[];
};

type Row = {
  key: string;
  label: string;
  total: number;
  todo: number;
  progress: number;
  done: number;
  late: number;
};

const periodOptions = [
  { value: 'month', label: 'Mês atual' },
  { value: 'quarter', label: 'Últimos 3 meses' },
  { value: 'year', label: 'Ano atual' },
  { value: 'all', label: 'Tudo' },
];

export function TasksRankingTab({ tasks, clients, departments, templates }: Props) {
  const [groupBy, setGroupBy] = useState<'client' | 'template' | 'department'>('client');
  const [period, setPeriod] = useState<string>('month');
  const [sortBy, setSortBy] = useState<'total' | 'late' | 'done'>('total');

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date | null = null;
    if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'quarter') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (period === 'year') from = new Date(now.getFullYear(), 0, 1);
    const to = period === 'month'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
      : period === 'quarter'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
        : period === 'year'
          ? new Date(now.getFullYear(), 11, 31)
          : null;

    const clientMap = new Map(clients.map(c => [c.id, formatClientLabel(c)]));
    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const tplMap = new Map(templates.map(t => [t.id, t.name]));

    const map = new Map<string, Row>();

    for (const t of tasks) {
      if (from) {
        if (!t.due_date) continue;
        const d = new Date(t.due_date + 'T00:00:00');
        if (d < from) continue;
        if (to && d > to) continue;
      }

      let key: string;
      let label: string;
      if (groupBy === 'client') {
        key = t.client_id ?? 'none';
        label = (t.client_id && clientMap.get(t.client_id)) || 'Sem empresa';
      } else if (groupBy === 'department') {
        key = t.department_id ?? 'none';
        label = (t.department_id && deptMap.get(t.department_id)) || 'Sem departamento';
      } else {
        key = t.template_id ?? `title:${t.title}`;
        label = (t.template_id && tplMap.get(t.template_id)) || t.title || 'Sem modelo';
      }

      let row = map.get(key);
      if (!row) {
        row = { key, label, total: 0, todo: 0, progress: 0, done: 0, late: 0 };
        map.set(key, row);
      }
      row.total += 1;
      if (t.status === 'done') row.done += 1;
      else if (t.status === 'todo') row.todo += 1;
      else row.progress += 1;

      if (t.status !== 'done' && t.due_date) {
        const d = new Date(t.due_date + 'T00:00:00');
        if (d < today) row.late += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => (b[sortBy] - a[sortBy]) || (b.total - a.total) || a.label.localeCompare(b.label));
  }, [tasks, clients, departments, templates, groupBy, period, sortBy]);

  const max = rows.length ? Math.max(...rows.map(r => r[sortBy] || r.total), 1) : 1;

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ranking de tarefas</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Por empresa</SelectItem>
                <SelectItem value="template">Por tarefa</SelectItem>
                <SelectItem value="department">Por departamento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Ordenar por total</SelectItem>
                <SelectItem value="late">Ordenar por atrasadas</SelectItem>
                <SelectItem value="done">Ordenar por concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">Nenhuma tarefa no período selecionado</p>
        )}
        {rows.map((r, i) => {
          const value = r[sortBy] || 0;
          const pct = Math.round((value / max) * 100);
          return (
            <div key={r.key} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">{r.label}</span>
                <span className="text-sm font-semibold">{r.total}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">A fazer: {r.todo}</Badge>
                <Badge variant="outline">Em andamento: {r.progress}</Badge>
                <Badge variant="secondary">Concluídas: {r.done}</Badge>
                {r.late > 0 && <Badge variant="destructive">Atrasadas: {r.late}</Badge>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
