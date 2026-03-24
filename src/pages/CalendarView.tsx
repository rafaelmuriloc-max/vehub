import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Instance = { id: string; client_id: string; obligation_id: string; reference_month: string };
type Obligation = { id: string; name: string; department_id: string; alert_day: number | null; target_day: number | null; due_day: number | null };
type Client = { id: string; company_name: string };
type Department = { id: string; name: string };

type CalendarEvent = {
  clientId: string; clientName: string; obligationName: string; deptName: string;
  type: 'alert' | 'target' | 'due'; date: string;
};

const typeConfig = {
  alert: { label: 'Alerta', color: 'bg-green-500' },
  target: { label: 'Meta', color: 'bg-orange-500' },
  due: { label: 'Vencimento', color: 'bg-red-500' },
};

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarView() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterDept, setFilterDept] = useState('all');
  const [filterClient, setFilterClient] = useState('all');

  useEffect(() => {
    Promise.all([
      supabase.from('obligation_instances').select('id, client_id, obligation_id, reference_month'),
      supabase.from('obligations').select('id, name, department_id, alert_day, target_day, due_day'),
      supabase.from('clients').select('id, company_name'),
      supabase.from('departments').select('id, name'),
    ]).then(([instRes, oblRes, cliRes, deptRes]) => {
      setInstances((instRes.data as Instance[]) || []);
      setObligations((oblRes.data as Obligation[]) || []);
      setClients((cliRes.data as Client[]) || []);
      setDepartments((deptRes.data as Department[]) || []);
    });
  }, []);

  const oblMap = useMemo(() => new Map(obligations.map(o => [o.id, o])), [obligations]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  const events = useMemo(() => {
    const result: CalendarEvent[] = [];
    for (const inst of instances) {
      const obl = oblMap.get(inst.obligation_id);
      if (!obl) continue;
      const client = clientMap.get(inst.client_id);
      if (!client) continue;
      const dept = deptMap.get(obl.department_id);
      if (!dept) continue;

      if (filterDept !== 'all' && obl.department_id !== filterDept) continue;
      if (filterClient !== 'all' && inst.client_id !== filterClient) continue;

      const refDate = new Date(inst.reference_month + 'T00:00:00');
      const y = refDate.getFullYear();
      const m = refDate.getMonth();

      const makeDate = (day: number | null) => {
        if (!day) return null;
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      };

      const base = { clientId: client.id, clientName: client.company_name, obligationName: obl.name, deptName: dept.name };

      const alertDate = makeDate(obl.alert_day);
      const targetDate = makeDate(obl.target_day);
      const dueDate = makeDate(obl.due_day);

      if (alertDate) result.push({ ...base, type: 'alert', date: alertDate });
      if (targetDate) result.push({ ...base, type: 'target', date: targetDate });
      if (dueDate) result.push({ ...base, type: 'due', date: dueDate });
    }
    return result;
  }, [instances, oblMap, clientMap, deptMap, filterDept, filterClient]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  function getEventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  }

  function getDayDots(day: number) {
    const dayEvents = getEventsForDay(day);
    const has = { alert: false, target: false, due: false };
    for (const e of dayEvents) has[e.type] = true;
    return has;
  }

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Calendário</h1>

      <div className="flex flex-wrap gap-4">
        <Select value={filterDept} onValueChange={v => { setFilterDept(v); setSelectedDay(null); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={v => { setFilterClient(v); setSelectedDay(null); }}>
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="capitalize">{monthNames[month]} {year}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {weekdays.map(d => (
              <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[70px] p-1" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = selectedDay === day;
              const dots = getDayDots(day);
              const hasAny = dots.alert || dots.target || dots.due;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[70px] border rounded-md p-1 cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary/20 border-primary ring-1 ring-primary' : isToday ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted/50'}`}
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                  {hasAny && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {dots.alert && <span className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                      {dots.target && <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                      {dots.due && <span className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Alerta</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Meta</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Vencimento</div>
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Obrigações do dia {String(selectedDay).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}/{year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma obrigação neste dia.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Obrigação</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEvents.map((ev, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{ev.clientName}</TableCell>
                      <TableCell>{ev.obligationName}</TableCell>
                      <TableCell>{ev.deptName}</TableCell>
                      <TableCell>
                        <Badge className={`${typeConfig[ev.type].color} text-white border-0`}>
                          {typeConfig[ev.type].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
