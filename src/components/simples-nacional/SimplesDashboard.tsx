import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle2, AlertCircle, Clock, Percent, BarChart3, Building2, Building, ChevronRight, ArrowRight } from 'lucide-react';
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
    const all = [...openByClient.entries()].sort((a, b) => b[1] - a[1])
      .filter(([id]) => byId.has(id))
      .map(([id, n]) => ({ client: byId.get(id)!, n }));
    const top = all.slice(0, 8);
    const vencidas = counts.pago + counts.aberto;
    const pct = vencidas ? (counts.pago / vencidas) * 100 : 0;
    return { counts, months, top, all, pct };
  }, [clients, competencias]);

  const [allOpen, setAllOpen] = useState(false);

  const cards: { key: StatusFilter; label: string; value: string; icon: any; circle: string; valueCls: string }[] = [
    { key: 'pago', label: 'Guias pagas', value: String(data.counts.pago), icon: CheckCircle2, circle: 'bg-success/10 text-success', valueCls: 'text-success' },
    { key: 'aberto', label: 'Em aberto (vencidas)', value: String(data.counts.aberto), icon: AlertCircle, circle: 'bg-destructive/10 text-destructive', valueCls: 'text-destructive' },
    { key: 'a_vencer', label: 'A vencer', value: String(data.counts.a_vencer), icon: Clock, circle: 'bg-muted text-muted-foreground', valueCls: 'text-foreground' },
    { key: 'all', label: '% pagas (vencidas)', value: `${data.pct.toFixed(1)}%`, icon: Percent, circle: 'bg-primary/10 text-primary', valueCls: 'text-foreground' },
  ];

  const Row = ({ client, n, onDone }: { client: Client; n: number; onDone?: () => void }) => (
    <button onClick={() => { onPickClient(client.id); onDone?.(); }} title={formatClientLabel(client)}
      className="w-full flex items-center gap-3 text-left text-sm px-1 py-2.5 hover:bg-muted/50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Building className="h-4 w-4 text-primary shrink-0" />
      <span className="truncate flex-1 text-foreground">{formatClientLabel(client)}</span>
      <span className="text-destructive font-medium tabular-nums whitespace-nowrap">{n} {n === 1 ? 'mês' : 'meses'}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          const active = statusFilter === c.key && c.key !== 'all';
          return (
            <Card key={c.label} role="button" tabIndex={0} aria-pressed={active}
              onClick={() => onFilter(c.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFilter(c.key); } }}
              className={`p-5 rounded-2xl shadow-sm cursor-pointer transition-all duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${c.circle}`}><Icon className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{c.label}</div>
                  <div className={`text-3xl font-bold tabular-nums leading-tight ${c.valueCls}`}>{c.value}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {statusFilter !== 'all' && (
        <Button variant="outline" size="sm" onClick={() => onFilter('all')}>Limpar filtro</Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Guias por mês — {year}</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={32} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Pagas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="Em aberto" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="A vencer" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-5 w-5 text-foreground shrink-0" />
              <h2 className="text-base font-semibold text-foreground truncate">Empresas com guias em aberto</h2>
            </div>
            {data.all.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 rounded-lg shrink-0" onClick={() => setAllOpen(true)}>
                Ver todas<ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
          {data.top.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma guia vencida em aberto.</div>
          ) : (
            <div className="divide-y divide-border">
              {data.top.map(({ client, n }) => <Row key={client.id} client={client} n={n} />)}
            </div>
          )}
        </Card>
      </div>

      <Sheet open={allOpen} onOpenChange={setAllOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Empresas com guias em aberto ({data.all.length})</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-border mt-4">
            {data.all.map(({ client, n }) => <Row key={client.id} client={client} n={n} onDone={() => setAllOpen(false)} />)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
