import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { formatClientLabel } from '@/lib/utils';
import { formatDuration } from '@/components/time-tracking/TimeTracker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Entry = {
  id: string;
  user_id: string;
  task_id: string | null;
  instance_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  task?: { client_id: string | null; title: string; department_id?: string | null } | null;
  instance?: { client_id: string; reference_month: string; obligation?: { name: string; department_id?: string | null } | null } | null;
};
type ProfileRate = { user_id: string; full_name: string | null; hourly_rate: number | null };
type ClientInfo = { id: string; sci_code?: string | null; company_name: string; monthly_value: number | null };
type Dept = { id: string; name: string };

type DetailRow = { label: string; user: string; seconds: number; cost: number };
type ClientRow = {
  clientId: string;
  label: string;
  taskSeconds: number;
  oblSeconds: number;
  cost: number;
  fee: number | null;
  missingRate: boolean;
  details: DetailRow[];
};

function monthRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'month') return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (period === 'quarter') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (period === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ClientCostReport() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<ProfileRate[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [sortBy, setSortBy] = useState<'cost' | 'hours' | 'margin'>('cost');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [e, p, c, d] = await Promise.all([
        supabase.from('time_entries' as any).select('*, task:task_id(client_id, title, department_id), instance:instance_id(client_id, reference_month, obligation:obligation_id(name, department_id))'),
        supabase.from('profiles').select('user_id, full_name, hourly_rate' as any),
        supabase.from('clients').select('id, sci_code, company_name, monthly_value'),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      setEntries(((e.data as any[]) || []) as Entry[]);
      setProfiles(((p.data as any[]) || []) as ProfileRate[]);
      setClients(((c.data as any[]) || []) as ClientInfo[]);
      setDepartments(((d.data as any[]) || []) as Dept[]);
      setLoading(false);
    })();
  }, []);

  const range = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59.999') };
    }
    return monthRange(period);
  }, [period, customStart, customEnd]);

  const rows = useMemo<ClientRow[]>(() => {
    const rateMap = new Map(profiles.map(p => [p.user_id, p.hourly_rate]));
    const nameMap = new Map(profiles.map(p => [p.user_id, p.full_name || 'Sem nome']));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const byClient = new Map<string, ClientRow>();

    for (const e of entries) {
      const started = new Date(e.started_at);
      if (started < range.start || started > range.end) continue;
      const secs = e.ended_at ? (e.duration_seconds || 0) : Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
      if (secs <= 0) continue;

      const isTask = !!e.task_id;
      const clientId = isTask ? e.task?.client_id : e.instance?.client_id;
      if (!clientId) continue;
      const deptId = isTask ? e.task?.department_id : e.instance?.obligation?.department_id;
      if (filterDept !== 'all' && deptId !== filterDept) continue;

      const client = clientMap.get(clientId);
      const label = client ? formatClientLabel(client) : 'Cliente removido';
      const rate = rateMap.get(e.user_id);
      const cost = rate != null ? (secs / 3600) * Number(rate) : 0;
      const itemLabel = isTask
        ? `Tarefa: ${e.task?.title || '—'}`
        : `Obrigação: ${e.instance?.obligation?.name || '—'} (${e.instance?.reference_month?.slice(0, 7) || '—'})`;

      let row = byClient.get(clientId);
      if (!row) {
        row = { clientId, label, taskSeconds: 0, oblSeconds: 0, cost: 0, fee: client?.monthly_value ?? null, missingRate: false, details: [] };
        byClient.set(clientId, row);
      }
      if (isTask) row.taskSeconds += secs; else row.oblSeconds += secs;
      row.cost += cost;
      if (rate == null) row.missingRate = true;

      const det = row.details.find(x => x.label === itemLabel && x.user === nameMap.get(e.user_id));
      if (det) { det.seconds += secs; det.cost += cost; }
      else row.details.push({ label: itemLabel, user: nameMap.get(e.user_id) || 'Sem nome', seconds: secs, cost });
    }

    const arr = Array.from(byClient.values());
    arr.forEach(r => r.details.sort((a, b) => b.seconds - a.seconds));
    arr.sort((a, b) => {
      if (sortBy === 'hours') return (b.taskSeconds + b.oblSeconds) - (a.taskSeconds + a.oblSeconds);
      if (sortBy === 'margin') {
        const ma = a.fee != null ? (a.fee - a.cost) : Infinity;
        const mb = b.fee != null ? (b.fee - b.cost) : Infinity;
        return ma - mb;
      }
      return b.cost - a.cost;
    });
    return arr;
  }, [entries, profiles, clients, range, filterDept, sortBy]);

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Custo por Cliente', 14, 14);
    doc.setFontSize(9);
    doc.text(`Período: ${range.start.toLocaleDateString('pt-BR')} a ${range.end.toLocaleDateString('pt-BR')} · Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20);
    autoTable(doc, {
      startY: 24,
      head: [['Cliente', 'Horas Tarefas', 'Horas Obrigações', 'Horas Totais', 'Custo (R$)', 'Honorário (R$)', 'Resultado (R$)', 'Margem %']],
      body: rows.map(r => {
        const total = r.taskSeconds + r.oblSeconds;
        const result = r.fee != null ? r.fee - r.cost : null;
        const margin = r.fee != null && r.fee > 0 ? ((result! / r.fee) * 100).toFixed(1) + '%' : '—';
        return [r.label, formatDuration(r.taskSeconds), formatDuration(r.oblSeconds), formatDuration(total), brl(r.cost), r.fee != null ? brl(r.fee) : '—', result != null ? brl(result) : '—', margin];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    doc.save(`custo-por-cliente-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando registros de tempo...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Período</span>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="quarter">Últimos 3 meses</SelectItem>
                <SelectItem value="year">Ano atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">De</span>
                <Input type="date" className="w-40" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Até</span>
                <Input type="date" className="w-40" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Departamento</span>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Ordenar por</span>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cost">Custo</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="margin">Margem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="ml-auto" onClick={exportPdf} disabled={rows.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />Exportar PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Horas Tarefas</TableHead>
                <TableHead className="text-right">Horas Obrigações</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Honorário</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const total = r.taskSeconds + r.oblSeconds;
                const result = r.fee != null ? r.fee - r.cost : null;
                const negative = result != null && result < 0;
                const margin = r.fee != null && r.fee > 0 ? (result! / r.fee) * 100 : null;
                const isOpen = !!expanded[r.clientId];
                return (
                  <>
                    <TableRow key={r.clientId} className="cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, [r.clientId]: !prev[r.clientId] }))}>
                      <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">
                        {r.label}
                        {r.missingRate && (
                          <span title="Há registros de usuários sem valor/hora — custo parcial">
                            <AlertTriangle className="h-3.5 w-3.5 inline ml-1 text-amber-500" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(r.taskSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(r.oblSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatDuration(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(r.cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.fee != null ? brl(r.fee) : '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${negative ? 'text-red-500' : 'text-emerald-600'}`}>
                        {result != null ? brl(result) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {margin != null ? <Badge variant={negative ? 'destructive' : 'secondary'}>{margin.toFixed(1)}%</Badge> : '—'}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${r.clientId}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/40 p-0">
                          <div className="px-8 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Responsável</TableHead>
                                  <TableHead className="text-right">Tempo</TableHead>
                                  <TableHead className="text-right">Custo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {r.details.map((d, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-sm">{d.label}</TableCell>
                                    <TableCell className="text-sm">{d.user}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">{formatDuration(d.seconds)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">{brl(d.cost)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro de tempo no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
