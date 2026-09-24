import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Clock, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { formatClientLabel } from '@/lib/utils';

export type GuiaStatus = 'pago' | 'aberto' | 'a_vencer';
export type StatusFilter = 'all' | GuiaStatus;

type Comp = { client_id: string; competencia: string; status: string; data_vencimento: string | null };
type Client = { id: string; sci_code?: string | null; company_name: string };

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function guiaStatus(c: Comp, today = new Date()): GuiaStatus {
  if (c.status === 'pago') return 'pago';
  let due: Date;
  if (c.data_vencimento) due = new Date(c.data_vencimento + 'T23:59:59');
  else {
    const [y, m] = c.competencia.split('-').map(Number);
    due = new Date(y, m, 20, 23, 59, 59); // dia 20 do mês seguinte
  }
  return due < today ? 'aberto' : 'a_vencer';
}

export function clientsByStatus(comps: Comp[], clientIds: Set<string>) {
  const map: Record<GuiaStatus, Set<string>> = { pago: new Set(), aberto: new Set(), a_vencer: new Set() };
  for (const c of comps) if (clientIds.has(c.client_id)) map[guiaStatus(c)].add(c.client_id);
  return map;
}

interface Props {
  clients: Client[];
  competencias: Comp[];
  year: number;
  statusFilter: StatusFilter;
  onFilter: (f: StatusFilter) => void;
  onPickClient: (id: string) => void;
}

export default function SimplesDashboard({ clients, competencias, year, statusFilter, onFilter, onPickClient }: Props) {
  const data = useMemo(() => {
    const ids = new Set(clients.map(c => c.id));
    const counts = { pago: 0, aberto: 0, a_vencer: 0 };
    const months = MESES.map(m => ({ mes: m, Pagas: 0, 'Em aberto': 0, 'A vencer': 0 }));
    const openByClient = new Map<string, number>();
    for (const c of competencias) {
      if (!ids.has(c.client_id)) continue;
      const s = guiaStatus(c);
      counts[s]++;
      const mi = Number(c.competencia.slice(5, 7)) - 1;
      if (months[mi]) months[mi][s === 'pago' ? 'Pagas' : s === 'aberto' ? 'Em aberto' : 'A vencer']++;
      if (s === 'aberto') openByClient.set(c.client_id, (openByClient.get(c.client_id) ?? 0) + 1);
    }
    const byId = new Map(clients.map(c => [c.id, c]));
    const top = [...openByClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([id, n]) => ({ client: byId.get(id)!, n }));
    const vencidas = counts.pago + counts.aberto;
    const pct = vencidas ? (counts.pago / vencidas) * 100 : 0;
    return { counts, months, top, pct };
  }, [clients, competencias]);

  const cards: { key: StatusFilter; label: string; value: string; icon: any; cls: string }[] = [
    { key: 'pago', label: 'Guias pagas', value: String(data.counts.pago), icon: CheckCircle2, cls: 'text-primary bg-primary/10' },
    { key: 'aberto', label: 'Em aberto (vencidas)', value: String(data.counts.aberto), icon: AlertCircle, cls: 'text-destructive bg-destructive/10' },
    { key: 'a_vencer', label: 'A vencer', value: String(data.counts.a_vencer), icon: Clock, cls: 'text-muted-foreground bg-muted' },
    { key: 'all', label: '% pagas (vencidas)', value: `${data.pct.toFixed(1)}%`, icon: Percent, cls: 'text-primary bg-primary/10' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          const active = statusFilter === c.key && c.key !== 'all';
          return (
            <Card key={c.label} onClick={() => onFilter(c.key)}
              className={`p-4 cursor-pointer transition-colors hover:bg-accent/30 ${active ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${c.cls}`}><Icon className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="text-2xl font-bold text-foreground tabular-nums">{c.value}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {statusFilter !== 'all' && (
        <Button variant="outline" size="sm" onClick={() => onFilter('all')}>Limpar filtro</Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-foreground mb-2">Guias por mês — {year}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="Pagas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Em aberto" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="A vencer" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-foreground mb-2">Empresas com guias em aberto</div>
          {data.top.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma guia vencida em aberto.</div>
          ) : (
            <div className="space-y-1">
              {data.top.map(({ client, n }) => (
                <button key={client.id} onClick={() => onPickClient(client.id)}
                  className="w-full flex items-center justify-between gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-accent/40">
                  <span className="truncate text-foreground">{formatClientLabel(client)}</span>
                  <span className="text-destructive font-semibold tabular-nums whitespace-nowrap">{n} {n === 1 ? 'mês' : 'meses'}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
