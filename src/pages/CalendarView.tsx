import { useEffect, useState, useMemo, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, FileText, CheckSquare, MessageCircle, Mail, Upload, Download, CalendarDays, Building2, ListChecks, Filter, Clock, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EmailComposeDialog from '@/components/EmailComposeDialog';
import { sendActivityEmail } from '@/lib/sendActivityEmail';

type Instance = { id: string; client_id: string; obligation_id: string; reference_month: string };
type Obligation = { id: string; name: string; department_id: string; alert_day: number | null; target_day: number | null; due_day: number | null };
type Client = { id: string; company_name: string };
type Department = { id: string; name: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; document_type_id: string | null; order: number; auto_start: boolean; email_department_id: string | null; email_subject: string | null; email_body: string | null };
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

function PaginationBlock({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(page * ITEMS_PER_PAGE, total);
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-muted-foreground">Mostrando {start}-{end} de {total}</span>
      <Pagination className="mx-0 w-auto">
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
    </div>
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
  const [monthPendingPage, setMonthPendingPage] = useState(1);
  const [monthCompletedPage, setMonthCompletedPage] = useState(1);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailActivityId, setEmailActivityId] = useState<string | null>(null);
  const [emailVariables, setEmailVariables] = useState<Record<string, string>>({});
  const [emailPrefill, setEmailPrefill] = useState<{ departmentId?: string; subject?: string; body?: string }>({});
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<{ fileUrl: string; fileName: string }[]>([]);

  const loadData = useCallback(async () => {
    const [instRes, oblRes, cliRes, deptRes, actRes, compRes] = await Promise.all([
      supabase.from('obligation_instances').select('id, client_id, obligation_id, reference_month'),
      supabase.from('obligations').select('id, name, department_id, alert_day, target_day, due_day'),
      supabase.from('clients').select('id, company_name'),
      supabase.from('departments').select('id, name'),
      supabase.from('obligation_activities').select('id, obligation_id, title, type, description, document_type_id, order, auto_start, email_department_id, email_subject, email_body'),
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
    const counts = { alert: 0, target: 0, due: 0 };
    for (const e of dayEvents) counts[e.type]++;
    return counts;
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    return events.filter(e => e.date.startsWith(prefix) && e.type === 'target').sort((a, b) => a.date.localeCompare(b.date));
  }, [events, year, month]);

  useEffect(() => { setDayPage(1); }, [selectedDay]);
  useEffect(() => { setMonthPage(1); }, [year, month, filterDept, filterClient]);

  const detailInstance = instances.find(i => i.id === detailInstanceId);
  const detailObligation = detailInstance ? oblMap.get(detailInstance.obligation_id) : null;
  const detailActivities = detailObligation
    ? activities.filter(a => a.obligation_id === detailObligation.id).sort((a, b) => a.order - b.order)
    : [];

  function getCompletion(activityId: string) {
    if (!detailInstanceId) return null;
    return completions.find(c => c.instance_id === detailInstanceId && c.activity_id === activityId) || null;
  }

  function isInstanceCompleted(instanceId: string, obligationId: string): boolean {
    const oblActivities = activities.filter(a => a.obligation_id === obligationId);
    if (oblActivities.length === 0) return false;
    return oblActivities.every(act => {
      const comp = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
      return comp?.completed === true;
    });
  }

  function getInstanceProgress(instanceId: string, obligationId: string) {
    const oblActivities = activities.filter(a => a.obligation_id === obligationId);
    if (oblActivities.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completedCount = oblActivities.filter(act => {
      const comp = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
      return comp?.completed === true;
    }).length;
    return { completed: completedCount, total: oblActivities.length, percent: Math.round((completedCount / oblActivities.length) * 100) };
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

    // Auto-start chain
    if (!currentlyCompleted && detailObligation && detailInstance) {
      const oblActivities = activities.filter(a => a.obligation_id === detailObligation.id).sort((a, b) => a.order - b.order);
      const currentIdx = oblActivities.findIndex(a => a.id === activityId);
      for (let i = currentIdx + 1; i < oblActivities.length; i++) {
        const nextAct = oblActivities[i];
        if (!nextAct.auto_start) break;
        const nextComp = completions.find(c => c.instance_id === detailInstanceId && c.activity_id === nextAct.id);
        if (nextComp?.completed) break;

        // Auto-send email activities
        if (nextAct.type === 'email' && nextAct.email_department_id && nextAct.email_subject && nextAct.email_body) {
          const result = await sendActivityEmail({
            activity: nextAct,
            instanceId: detailInstanceId,
            clientId: detailInstance.client_id,
            obligationName: detailObligation.name,
            referenceMonth: detailInstance.reference_month,
            dueDay: detailObligation.due_day,
            departmentId: detailObligation.department_id,
          });
          if (!result.success) {
            toast({ title: 'Erro no envio automático de e-mail', description: result.error, variant: 'destructive' });
            break;
          }
          toast({ title: `E-mail "${nextAct.title}" enviado automaticamente` });
        } else if (nextAct.type === 'email') {
          break; // email without full config, stop chain
        } else {
          if (nextComp) {
            await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', nextComp.id);
          } else {
            await supabase.from('obligation_activity_completions').insert({ instance_id: detailInstanceId, activity_id: nextAct.id, completed: true, completed_at: new Date().toISOString() });
          }
        }
      }
    }

    await loadData();
  }

  async function handleFileUpload(activityId: string, file: File) {
    if (!detailInstanceId || !detailInstance || !detailObligation) return;
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

    // Trigger auto-start chain after document upload
    const oblActivities = activities.filter(a => a.obligation_id === detailObligation.id).sort((a, b) => a.order - b.order);
    const currentIdx = oblActivities.findIndex(a => a.id === activityId);
    for (let i = currentIdx + 1; i < oblActivities.length; i++) {
      const nextAct = oblActivities[i];
      if (!nextAct.auto_start) break;
      const nextComp = completions.find(c => c.instance_id === detailInstanceId && c.activity_id === nextAct.id);
      if (nextComp?.completed) break;

      if (nextAct.type === 'email' && nextAct.email_department_id && nextAct.email_subject && nextAct.email_body) {
        const result = await sendActivityEmail({
          activity: nextAct,
          instanceId: detailInstanceId,
          clientId: detailInstance.client_id,
          obligationName: detailObligation.name,
          referenceMonth: detailInstance.reference_month,
          dueDay: detailObligation.due_day,
          departmentId: detailObligation.department_id,
        });
        if (!result.success) {
          toast({ title: 'Erro no envio automático de e-mail', description: result.error, variant: 'destructive' });
          break;
        }
        toast({ title: `E-mail "${nextAct.title}" enviado automaticamente` });
      } else if (nextAct.type === 'email') {
        break;
      } else {
        if (nextComp) {
          await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', nextComp.id);
        } else {
          await supabase.from('obligation_activity_completions').insert({ instance_id: detailInstanceId, activity_id: nextAct.id, completed: true, completed_at: new Date().toISOString() });
        }
      }
    }

    await loadData();
  }

  async function deleteFile(activityId: string, fileUrl: string) {
    if (!detailInstanceId) return;
    await supabase.storage.from('documents').remove([fileUrl]);
    const existing = getCompletion(activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({ completed: false, completed_at: null, file_url: null }).eq('id', existing.id);
    }
    toast({ title: 'Arquivo excluído' });
    await loadData();
  }

  async function downloadFile(fileUrl: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  const dayTotalPages = Math.ceil(selectedEvents.length / ITEMS_PER_PAGE);
  const paginatedDayEvents = selectedEvents.slice((dayPage - 1) * ITEMS_PER_PAGE, dayPage * ITEMS_PER_PAGE);
  const monthTotalPages = Math.ceil(monthEvents.length / ITEMS_PER_PAGE);
  const paginatedMonthEvents = monthEvents.slice((monthPage - 1) * ITEMS_PER_PAGE, monthPage * ITEMS_PER_PAGE);

  // Dialog progress
  const dialogProgress = detailInstance
    ? getInstanceProgress(detailInstance.id, detailInstance.obligation_id)
    : { completed: 0, total: 0, percent: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendário</h1>
            <p className="text-sm text-muted-foreground">Acompanhe prazos e obrigações dos seus clientes</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtros</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Departamento</label>
              <Select value={filterDept} onValueChange={v => { setFilterDept(v); setSelectedDay(null); }}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Select value={filterClient} onValueChange={v => { setFilterClient(v); setSelectedDay(null); }}>
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar + Day list side by side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <Card className="flex-1 lg:flex-[2]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="capitalize text-xl">{monthNames[month]} {year}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekdays.map(d => (
                <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
              ))}
              {days.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[80px] p-1" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const isSelected = selectedDay === day;
                const counts = getDayDots(day);
                const hasAny = counts.alert > 0 || counts.target > 0 || counts.due > 0;
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[80px] rounded-lg p-2 cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'bg-primary/15 border-2 border-primary shadow-md'
                        : isToday
                          ? 'bg-blue-50 border border-blue-400 dark:bg-blue-950 dark:border-blue-500'
                          : 'border border-border hover:bg-muted/60 hover:shadow-sm'
                      }`}
                  >
                    <span className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full
                      ${isToday ? 'bg-blue-500 text-white' : 'text-foreground'}`}>
                      {day}
                    </span>
                    {hasAny && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {counts.alert > 0 && (
                          <span className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] text-muted-foreground">{counts.alert}</span>
                          </span>
                        )}
                        {counts.target > 0 && (
                          <span className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-[10px] text-muted-foreground">{counts.target}</span>
                          </span>
                        )}
                        {counts.due > 0 && (
                          <span className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[10px] text-muted-foreground">{counts.due}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-5 mt-4 px-3 py-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Alerta</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Meta</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Vencimento</div>
            </div>
          </CardContent>
        </Card>

        {/* Day obligations - right side */}
        <Card className="flex-1 lg:flex-[1]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  {selectedDay
                    ? `Dia ${String(selectedDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`
                    : 'Obrigações do dia'}
                </CardTitle>
              </div>
              {selectedDay && selectedEvents.length > 0 && (
                <Badge variant="secondary" className="text-xs">{selectedEvents.length}</Badge>
              )}
            </div>
            {selectedDay && (
              <CardDescription className="mt-1">
                {selectedEvents.length === 0 ? 'Nenhuma obrigação neste dia' : `${selectedEvents.length} obrigação(ões) encontrada(s)`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Selecione um dia no calendário</p>
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma obrigação neste dia</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedDayEvents.map((ev, idx) => {
                    const completed = isInstanceCompleted(ev.instanceId, ev.obligationId);
                    const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                    return (
                      <div
                        key={idx}
                        onClick={() => setDetailInstanceId(ev.instanceId)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm
                          ${completed
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                            : 'border-border hover:border-primary/30 hover:bg-muted/30'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{ev.obligationName}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                            </p>
                          </div>
                          <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px] shrink-0`}>
                            {typeConfig[ev.type].label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                          {progress.total > 0 && (
                            <span className={`text-[10px] font-medium ${completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {progress.completed}/{progress.total} atividades
                            </span>
                          )}
                        </div>
                        {progress.total > 0 && (
                          <Progress value={progress.percent} className="h-1 mt-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <PaginationBlock page={dayPage} totalPages={dayTotalPages} total={selectedEvents.length} onPageChange={setDayPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Month obligations - below */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Obrigações de {monthNames[month]} {year}</CardTitle>
                <CardDescription className="mt-0.5">{monthEvents.length} obrigação(ões) com data de meta</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {monthEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ListChecks className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma obrigação com data de meta neste mês</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedMonthEvents.map((ev, idx) => {
                  const completed = isInstanceCompleted(ev.instanceId, ev.obligationId);
                  const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                  return (
                    <div
                      key={idx}
                      onClick={() => setDetailInstanceId(ev.instanceId)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm
                        ${completed
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 shrink-0 text-sm font-semibold text-primary">
                          {ev.date.split('-').reverse().slice(0, 2).join('/')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{ev.obligationName}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                          </p>
                        </div>
                        <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px] shrink-0`}>
                          {typeConfig[ev.type].label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                        {progress.total > 0 && (
                          <span className={`text-[10px] font-medium ${completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {progress.completed}/{progress.total} atividades
                          </span>
                        )}
                      </div>
                      {progress.total > 0 && (
                        <Progress value={progress.percent} className="h-1 mt-2" />
                      )}
                    </div>
                  );
                })}
              </div>
              <PaginationBlock page={monthPage} totalPages={monthTotalPages} total={monthEvents.length} onPageChange={setMonthPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailInstanceId} onOpenChange={open => { if (!open) setDetailInstanceId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {detailObligation?.name}
            </DialogTitle>
            {detailInstance && (
              <p className="text-sm text-muted-foreground mt-1">
                <Building2 className="h-3.5 w-3.5 inline mr-1" />
                {clientMap.get(detailInstance.client_id)?.company_name}
              </p>
            )}
          </DialogHeader>

          {/* Progress bar */}
          {dialogProgress.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Progresso</span>
                <span className={`text-xs font-medium ${dialogProgress.percent === 100 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {dialogProgress.completed}/{dialogProgress.total} concluída(s)
                </span>
              </div>
              <Progress value={dialogProgress.percent} className="h-2" />
            </div>
          )}

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {detailActivities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada para esta obrigação.</p>
              </div>
            )}
            {detailActivities.map(act => {
              const comp = getCompletion(act.id);
              const isCompleted = comp?.completed ?? false;
              return (
                <div
                  key={act.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200
                    ${isCompleted
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'border-border hover:border-muted-foreground/30'
                    }`}
                >
                  <div className={`mt-0.5 ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    {activityTypeIcons[act.type] || <CheckSquare className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{act.title}</p>
                    {act.description && <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>}
                    {act.type === 'document' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(act.id, e.target.files[0]); }} />
                            <Upload className="h-3 w-3 mr-1" /> {comp?.file_url ? 'Substituir' : 'Anexar'}
                          </label>
                        </Button>
                        {comp?.file_url && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadFile(comp.file_url!)}>
                              <Download className="h-3 w-3 mr-1" /> Baixar
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteFile(act.id, comp.file_url!)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {act.type === 'email' ? (
                    <Button
                      size="sm"
                      variant={isCompleted ? 'ghost' : 'default'}
                      className="shrink-0"
                      onClick={async () => {
                        const clientName = detailInstance ? clientMap.get(detailInstance.client_id)?.company_name || '' : '';
                        const refDate = detailInstance ? new Date(detailInstance.reference_month + 'T00:00:00') : new Date();
                        const competencia = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        const oblDueDay = detailObligation?.due_day;
                        const vencimento = oblDueDay
                          ? new Date(refDate.getFullYear(), refDate.getMonth(), oblDueDay).toLocaleDateString('pt-BR')
                          : '';
                        let recipient = '';
                        if (detailInstance && detailObligation) {
                          const [{ data: cli }, { data: deptContact }] = await Promise.all([
                            supabase.from('clients').select('contact_email').eq('id', detailInstance.client_id).single(),
                            supabase.from('client_department_contacts').select('contact_email').eq('client_id', detailInstance.client_id).eq('department_id', detailObligation.department_id).maybeSingle(),
                          ]);
                          recipient = deptContact?.contact_email || cli?.contact_email || '';
                        }
                        setEmailRecipient(recipient);
                        setEmailVariables({
                          '[Nome_da_Empresa]': clientName,
                          '[Competencia]': competencia,
                          '[Nome_da_Obrigação]': detailObligation?.name || '',
                          '[Vencimento]': vencimento,
                        });
                        setEmailPrefill({
                          departmentId: act.email_department_id || undefined,
                          subject: act.email_subject || undefined,
                          body: act.email_body || undefined,
                        });
                        // Collect attachments
                        if (detailInstanceId) {
                          const { data: fileComps } = await supabase
                            .from('obligation_activity_completions')
                            .select('file_url')
                            .eq('instance_id', detailInstanceId)
                            .not('file_url', 'is', null);
                          setEmailAttachments((fileComps || []).filter(fc => fc.file_url).map(fc => ({ fileUrl: fc.file_url!, fileName: fc.file_url!.split('/').pop() || 'anexo' })));
                        }
                        setEmailActivityId(act.id);
                        setEmailDialogOpen(true);
                      }}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      {isCompleted ? 'Reenviar' : 'Enviar'}
                    </Button>
                  ) : act.type !== 'document' && (
                    <Checkbox checked={isCompleted} onCheckedChange={() => toggleCompletion(act.id, isCompleted)} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <EmailComposeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        recipientEmail={emailRecipient}
        variables={emailVariables}
        prefillDepartmentId={emailPrefill.departmentId}
        prefillSubject={emailPrefill.subject}
        prefillBody={emailPrefill.body}
        attachments={emailAttachments}
        onSent={async () => {
          if (emailActivityId) {
            await toggleCompletion(emailActivityId, false);
          }
          setEmailActivityId(null);
        }}
      />
    </div>
  );
}
