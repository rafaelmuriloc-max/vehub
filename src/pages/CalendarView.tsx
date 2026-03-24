import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, FileText, CheckSquare, MessageCircle, Mail, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Instance = { id: string; client_id: string; obligation_id: string; reference_month: string };
type Obligation = { id: string; name: string; department_id: string; alert_day: number | null; target_day: number | null; due_day: number | null };
type Client = { id: string; company_name: string };
type Department = { id: string; name: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; document_type_id: string | null; order: number };
type Completion = { id: string; instance_id: string; activity_id: string; completed: boolean; file_url: string | null };

type CalendarEvent = {
  clientId: string; clientName: string; obligationName: string; deptName: string;
  type: 'alert' | 'target' | 'due'; date: string; instanceId: string; obligationId: string;
};

const typeConfig = {
  alert: { label: 'Alerta', color: 'bg-green-500' },
  target: { label: 'Meta', color: 'bg-orange-500' },
  due: { label: 'Vencimento', color: 'bg-red-500' },
};

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ITEMS_PER_PAGE = 10;

function PaginationBlock({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }} />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <PaginationItem key={p}>
            <PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); onPageChange(p); }}>{p}</PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="#" onClick={e => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default function CalendarView() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterDept, setFilterDept] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1);
  const [monthPage, setMonthPage] = useState(1);

  const loadData = useCallback(async () => {
    const [instRes, oblRes, cliRes, deptRes, actRes, compRes] = await Promise.all([
      supabase.from('obligation_instances').select('id, client_id, obligation_id, reference_month'),
      supabase.from('obligations').select('id, name, department_id, alert_day, target_day, due_day'),
      supabase.from('clients').select('id, company_name'),
      supabase.from('departments').select('id, name'),
      supabase.from('obligation_activities').select('id, obligation_id, title, type, description, document_type_id, order'),
      supabase.from('obligation_activity_completions').select('id, instance_id, activity_id, completed, file_url'),
    ]);
    setInstances((instRes.data as Instance[]) || []);
    setObligations((oblRes.data as Obligation[]) || []);
    setClients((cliRes.data as Client[]) || []);
    setDepartments((deptRes.data as Department[]) || []);
    setActivities((actRes.data as Activity[]) || []);
    setCompletions((compRes.data as Completion[]) || []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

      const base = { clientId: client.id, clientName: client.company_name, obligationName: obl.name, deptName: dept.name, instanceId: inst.id, obligationId: obl.id };
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

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // Month events: all events in the current month, sorted by date
  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    return events.filter(e => e.date.startsWith(prefix) && e.type === 'target').sort((a, b) => a.date.localeCompare(b.date));
  }, [events, year, month]);

  // Reset pages when context changes
  useEffect(() => { setDayPage(1); }, [selectedDay]);
  useEffect(() => { setMonthPage(1); }, [year, month, filterDept, filterClient]);

  // Detail dialog logic
  const detailInstance = instances.find(i => i.id === detailInstanceId);
  const detailObligation = detailInstance ? oblMap.get(detailInstance.obligation_id) : null;
  const detailActivities = detailObligation
    ? activities.filter(a => a.obligation_id === detailObligation.id).sort((a, b) => a.order - b.order)
    : [];

  function getCompletion(activityId: string) {
    if (!detailInstanceId) return null;
    return completions.find(c => c.instance_id === detailInstanceId && c.activity_id === activityId) || null;
  }

  async function toggleCompletion(activityId: string, currentlyCompleted: boolean) {
    if (!detailInstanceId) return;
    const existing = getCompletion(activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({
        completed: !currentlyCompleted,
        completed_at: !currentlyCompleted ? new Date().toISOString() : null,
      }).eq('id', existing.id);
    } else {
      await supabase.from('obligation_activity_completions').insert({
        instance_id: detailInstanceId,
        activity_id: activityId,
        completed: true,
        completed_at: new Date().toISOString(),
      });
    }
    await loadData();
  }

  async function handleFileUpload(activityId: string, file: File) {
    if (!detailInstanceId) return;
    const path = `obligations/${detailInstanceId}/${activityId}/${file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (upErr) { toast({ title: 'Erro ao enviar arquivo', description: upErr.message, variant: 'destructive' }); return; }

    const existing = getCompletion(activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({ file_url: path, completed: true, completed_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('obligation_activity_completions').insert({ instance_id: detailInstanceId, activity_id: activityId, completed: true, completed_at: new Date().toISOString(), file_url: path });
    }
    toast({ title: 'Arquivo enviado com sucesso' });
    await loadData();
  }

  async function downloadFile(fileUrl: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  function isInstanceCompleted(instanceId: string, obligationId: string): boolean {
    const oblActivities = activities.filter(a => a.obligation_id === obligationId);
    if (oblActivities.length === 0) return false;
    return oblActivities.every(act => {
      const comp = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
      return comp?.completed === true;
    });
  }

  // Pagination helpers
  const dayTotalPages = Math.ceil(selectedEvents.length / ITEMS_PER_PAGE);
  const paginatedDayEvents = selectedEvents.slice((dayPage - 1) * ITEMS_PER_PAGE, dayPage * ITEMS_PER_PAGE);
  const monthTotalPages = Math.ceil(monthEvents.length / ITEMS_PER_PAGE);
  const paginatedMonthEvents = monthEvents.slice((monthPage - 1) * ITEMS_PER_PAGE, monthPage * ITEMS_PER_PAGE);

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

      {/* Calendar + Day list side by side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <Card className="flex-1 lg:flex-[2]">
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

        {/* Day obligations - right side */}
        <Card className="flex-1 lg:flex-[1]">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDay
                ? `Obrigações do dia ${String(selectedDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
                : 'Obrigações do dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <p className="text-muted-foreground text-sm">Selecione um dia no calendário.</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma obrigação neste dia.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDayEvents.map((ev, idx) => {
                      const completed = isInstanceCompleted(ev.instanceId, ev.obligationId);
                      return (
                        <TableRow key={idx} className={`cursor-pointer hover:bg-muted/50 ${completed ? 'bg-green-100 dark:bg-green-900/40' : ''}`} onClick={() => setDetailInstanceId(ev.instanceId)}>
                          <TableCell className="text-sm">{ev.clientName}</TableCell>
                          <TableCell className="text-sm">{ev.obligationName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-xs`}>
                                {typeConfig[ev.type].label}
                              </Badge>
                              {completed && <Badge className="bg-green-600 text-white border-0 text-xs">Concluída</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <PaginationBlock page={dayPage} totalPages={dayTotalPages} onPageChange={setDayPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Month obligations - below */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todas as obrigações de {monthNames[month]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma obrigação neste mês.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Obrigação</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMonthEvents.map((ev, idx) => {
                    const dayNum = ev.date.split('-')[2];
                    const completed = isInstanceCompleted(ev.instanceId, ev.obligationId);
                    return (
                      <TableRow key={idx} className={`cursor-pointer hover:bg-muted/50 ${completed ? 'bg-green-100 dark:bg-green-900/40' : ''}`} onClick={() => setDetailInstanceId(ev.instanceId)}>
                        <TableCell>{dayNum}</TableCell>
                        <TableCell>{ev.clientName}</TableCell>
                        <TableCell>{ev.obligationName}</TableCell>
                        <TableCell>{ev.deptName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-xs`}>
                              {typeConfig[ev.type].label}
                            </Badge>
                            {completed && <Badge className="bg-green-600 text-white border-0 text-xs">Concluída</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationBlock page={monthPage} totalPages={monthTotalPages} onPageChange={setMonthPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailInstanceId} onOpenChange={open => { if (!open) setDetailInstanceId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailObligation?.name} — {detailInstance ? clientMap.get(detailInstance.client_id)?.company_name : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {detailActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada para esta obrigação.</p>
            )}
            {detailActivities.map(act => {
              const comp = getCompletion(act.id);
              const isCompleted = comp?.completed ?? false;
              return (
                <div key={act.id} className={`flex items-start gap-3 p-3 rounded-md border ${isCompleted ? 'bg-muted/50' : ''}`}>
                  <div className="mt-0.5 text-muted-foreground">{activityTypeIcons[act.type] || <CheckSquare className="h-4 w-4" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{act.title}</p>
                    {act.description && <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>}
                    {act.type === 'document' && (
                      <div className="flex items-center gap-2 mt-2">
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(act.id, e.target.files[0]); }} />
                          <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Upload className="h-3 w-3" /> {comp?.file_url ? 'Substituir' : 'Anexar'}
                          </span>
                        </label>
                        {comp?.file_url && (
                          <button onClick={() => downloadFile(comp.file_url!)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Download className="h-3 w-3" /> Baixar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {act.type !== 'document' && (
                    <Checkbox checked={isCompleted} onCheckedChange={() => toggleCompletion(act.id, isCompleted)} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
