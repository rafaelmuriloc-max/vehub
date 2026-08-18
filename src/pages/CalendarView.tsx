import { useEffect, useState, useMemo, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, FileText, CheckSquare, MessageCircle, Mail, Upload, Download, CalendarDays, Building2, ListChecks, Filter, Clock, Trash2, Check, ChevronsUpDown, X, AlertTriangle, Undo2, FileX, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import EmailComposeDialog from '@/components/EmailComposeDialog';
import { sendActivityEmail } from '@/lib/sendActivityEmail';
import { sendActivityWhatsApp } from '@/lib/sendActivityWhatsApp';
import { getHolidays, getHolidayMap, previousBusinessDay } from '@/lib/holidays';
import { sanitizeStorageName, formatClientLabel } from '@/lib/utils';
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog';

type Instance = { id: string; client_id: string; obligation_id: string; reference_month: string; due_date?: string | null; deleted_at?: string | null; status?: string | null; completion_kind?: string | null; on_hold?: boolean | null; hold_reason?: string | null; hold_at?: string | null; hold_by?: string | null };
type Obligation = { id: string; name: string; department_id: string; alert_day: number | null; target_day: number | null; due_day: number | null; competence_rule: string; system_code: string | null; recurrence?: string | null };
type Client = { id: string; sci_code?: string | null; company_name: string; services_suspended?: boolean };
type Department = { id: string; name: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; document_type_id: string | null; order: number; auto_start: boolean; email_department_id: string | null; email_subject: string | null; email_body: string | null; whatsapp_template_name: string | null; whatsapp_message_body: string | null; whatsapp_button_url: string | null; whatsapp_has_document_header: boolean };
type Completion = { id: string; instance_id: string; activity_id: string; completed: boolean; file_url: string | null; notes: string | null; completed_at: string | null };
type TaskRow = { id: string; task_number: number; title: string; status: string; priority: string; due_date: string; client_id: string | null; department_id: string | null };

type CalendarEvent = {
  clientId: string; clientName: string; obligationName: string; deptName: string;
  type: 'alert' | 'target' | 'due'; date: string; instanceId: string; obligationId: string;
  competenceLabel: string;
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
const DAY_ITEMS_PER_PAGE = 5;

function PaginationBlock({ page, totalPages, total, onPageChange, perPage = ITEMS_PER_PAGE }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void; perPage?: number }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const getVisiblePages = () => {
    // Mobile: show only current page and adjacent; Desktop: full range
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    const rangeStart = Math.max(1, page - 1);
    const rangeEnd = Math.min(totalPages, page + 1);
    if (rangeStart > 1) pages.push('ellipsis-start');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages) pages.push('ellipsis-end');
    return pages;
  };

  return (
    <div className="flex flex-col items-center gap-2 md:flex-row md:justify-between mt-4">
      <span className="text-[10px] md:text-xs text-muted-foreground">Mostrando {start}-{end} de {total}</span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="gap-0.5 md:gap-1">
          <PaginationItem>
            <PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }} className="gap-0 md:gap-1 px-2 md:pl-2.5 [&>span]:hidden md:[&>span]:inline" />
          </PaginationItem>
          {getVisiblePages().map((p) =>
            typeof p === 'string' ? (
              <PaginationItem key={p}><PaginationEllipsis className="w-6 md:w-9" /></PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink href="#" isActive={p === page} onClick={e => { e.preventDefault(); onPageChange(p); }} className="h-8 w-8 md:h-9 md:w-9 text-xs">{p}</PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext href="#" onClick={e => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }} className="gap-0 md:gap-1 px-2 md:pr-2.5 [&>span]:hidden md:[&>span]:inline" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function CalendarMain() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [deletedInstances, setDeletedInstances] = useState<Instance[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterDept, setFilterDept] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterObligation, setFilterObligation] = useState('all');
  const [filterLateDeliveries, setFilterLateDeliveries] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);
  const [dayPendingPage, setDayPendingPage] = useState(1);
  const [dayCompletedPage, setDayCompletedPage] = useState(1);
  const [monthPendingPage, setMonthPendingPage] = useState(1);
  const [monthCompletedPage, setMonthCompletedPage] = useState(1);
  const [monthDeletedPage, setMonthDeletedPage] = useState(1);
  const [monthSuspendedPage, setMonthSuspendedPage] = useState(1);
  const [monthLatePage, setMonthLatePage] = useState(1);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailActivityId, setEmailActivityId] = useState<string | null>(null);
  const [emailVariables, setEmailVariables] = useState<Record<string, string>>({});
  const [emailPrefill, setEmailPrefill] = useState<{ departmentId?: string; subject?: string; body?: string }>({});
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<{ fileUrl: string; fileName: string }[]>([]);
  const [deleteInstanceId, setDeleteInstanceId] = useState<string | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkCompleteConfirm, setShowBulkCompleteConfirm] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [semMovInstanceId, setSemMovInstanceId] = useState<string | null>(null);
  const [semMovLoading, setSemMovLoading] = useState(false);
  const [holdTarget, setHoldTarget] = useState<string[] | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [holdSaving, setHoldSaving] = useState(false);
  const [monthHoldPage, setMonthHoldPage] = useState(1);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  const toggleSelection = (id: string) => {
    setSelectedInstanceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedInstanceIds(new Set());

  async function handleSemMovimento(instanceId: string) {
    setSemMovLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pgdasd-sem-movimento', {
        body: { instance_id: instanceId },
      });
      if (error) {
        toast({ title: 'Erro ao declarar', description: error.message, variant: 'destructive' });
        return;
      }
      if (!data?.success) {
        toast({ title: 'Falha na declaração', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
        return;
      }
      const wppMsg = data.whatsapp_sent
        ? 'Cliente notificado via WhatsApp.'
        : `Declaração enviada, mas WhatsApp falhou: ${data.whatsapp_error || 'desconhecido'}`;
      toast({ title: 'Declarado sem movimento', description: wppMsg });
      setSemMovInstanceId(null);
      setDetailInstanceId(null);
      await loadData();
    } finally {
      setSemMovLoading(false);
    }
  }

  const loadData = useCallback(async () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const nextMonth = m + 1 > 11 ? 0 : m + 1;
    const nextYear = m + 1 > 11 ? y + 1 : y;
    const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

    const instCols = 'id, client_id, obligation_id, reference_month, due_date, deleted_at, status, completion_kind, on_hold, hold_reason, hold_at, hold_by';
    const [instByRefRes, instByDueRes, oblRes, cliRes, deptRes, actRes, taskRes] = await Promise.all([
      supabase.from('obligation_instances').select(instCols)
        .gte('reference_month', monthStart).lt('reference_month', monthEnd),
      supabase.from('obligation_instances').select(instCols)
        .gte('due_date', monthStart).lt('due_date', monthEnd),
      supabase.from('obligations').select('id, name, department_id, alert_day, target_day, due_day, competence_rule, system_code, recurrence'),
      supabase.from('clients').select('id, sci_code, company_name, services_suspended'),
      supabase.from('departments').select('id, name'),
      supabase.from('obligation_activities').select('id, obligation_id, title, type, description, document_type_id, order, auto_start, email_department_id, email_subject, email_body, whatsapp_template_name, whatsapp_message_body, whatsapp_button_url, whatsapp_has_document_header'),
      supabase.from('tasks').select('id, task_number, title, status, priority, due_date, client_id, department_id')
        .gte('due_date', monthStart).lt('due_date', monthEnd),
    ]);
    const byId = new Map<string, Instance>();
    for (const row of ((instByRefRes.data as Instance[]) || [])) byId.set(row.id, row);
    for (const row of ((instByDueRes.data as Instance[]) || [])) byId.set(row.id, row);
    const allMonthInstances = Array.from(byId.values());
    const monthInstances = allMonthInstances.filter(i => !i.deleted_at);
    const monthDeleted = allMonthInstances.filter(i => !!i.deleted_at);
    setInstances(monthInstances);
    setDeletedInstances(monthDeleted);
    setObligations((oblRes.data as Obligation[]) || []);
    setClients((cliRes.data as Client[]) || []);
    setDepartments((deptRes.data as Department[]) || []);
    setActivities((actRes.data as Activity[]) || []);
    setTasks((taskRes.data as TaskRow[]) || []);
    const holdUserIds = Array.from(new Set(allMonthInstances.map(i => i.hold_by).filter(Boolean))) as string[];
    if (holdUserIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', holdUserIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { if (p.full_name) map[p.user_id] = p.full_name; });
      setProfilesMap(map);
    }
    // Fetch completions only for the visible-month instances, in chunks to avoid the 1000-row cap
    const ids = allMonthInstances.map(i => i.id);
    const allComps: Completion[] = [];
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      const { data } = await supabase
        .from('obligation_activity_completions')
        .select('id, instance_id, activity_id, completed, file_url, notes, completed_at')
        .in('instance_id', slice);
      if (data) allComps.push(...(data as Completion[]));
    }
    setCompletions(allComps);
  }, [currentDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const oblMap = useMemo(() => new Map(obligations.map(o => [o.id, o])), [obligations]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  const holidays = useMemo(() => getHolidays(currentDate.getFullYear()), [currentDate]);
  const holidayMap = useMemo(() => getHolidayMap(currentDate.getFullYear()), [currentDate]);

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
      if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;
      if (filterLateDeliveries && !isInstanceLateDelivery(inst.id, obl.id)) continue;

      const refDate = new Date(inst.reference_month + 'T00:00:00');
      const y = refDate.getFullYear();
      const m = refDate.getMonth();
      const makeDate = (day: number | null) => {
        if (!day) return null;
        const raw = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return previousBusinessDay(raw, holidays);
      };

      // Calcular competência
      const compDate = obl.competence_rule === 'previous'
        ? new Date(y, m - 1, 1)
        : refDate;
      const compMonthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const competenceLabel = obl.recurrence === 'trimestral'
        ? `${String(refDate.getMonth() + 1).padStart(2, '0')}/${refDate.getFullYear()}`
        : `${compMonthNames[compDate.getMonth()]}/${compDate.getFullYear()}`;

      const base = { clientId: client.id, clientName: formatClientLabel(client), obligationName: obl.name, deptName: dept.name, instanceId: inst.id, obligationId: obl.id, competenceLabel };
      const isQuarterly = obl.recurrence === 'trimestral';
      const alertDate = isQuarterly ? null : makeDate(obl.alert_day);
      const targetDate = isQuarterly ? null : makeDate(obl.target_day);
      const dueDate = inst.due_date ?? makeDate(obl.due_day);
      if (alertDate) result.push({ ...base, type: 'alert', date: alertDate });
      if (targetDate) result.push({ ...base, type: 'target', date: targetDate });
      if (dueDate) result.push({ ...base, type: 'due', date: dueDate });
    }
    const priority: Record<string, number> = { due: 3, target: 2, alert: 1 };
    const deduped = new Map<string, CalendarEvent>();
    for (const ev of result) {
      const key = `${ev.instanceId}-${ev.date}`;
      const existing = deduped.get(key);
      if (!existing || (priority[ev.type] ?? 0) > (priority[existing.type] ?? 0)) {
        deduped.set(key, ev);
      }
    }
    return Array.from(deduped.values());
  }, [instances, oblMap, clientMap, deptMap, filterDept, filterClient, filterObligation, filterLateDeliveries, holidays, isInstanceLateDelivery]);

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

  function getTasksForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => {
      if (t.due_date !== dateStr) return false;
      if (filterDept !== 'all' && t.department_id !== filterDept) return false;
      if (filterClient !== 'all' && t.client_id !== filterClient) return false;
      return true;
    });
  }

  const taskStatusLabels: Record<string, string> = {
    todo: 'A Fazer',
    in_progress: 'Aguardando',
    in_review: 'Em Revisão',
    done: 'Concluída',
  };

  function isTaskOverdue(t: TaskRow) {
    return t.status !== 'done' && !!t.due_date && t.due_date < today;
  }

  const overdueMonthTasks = useMemo(
    () => tasks
      .filter(t => isTaskOverdue(t))
      .filter(t => filterDept === 'all' || t.department_id === filterDept)
      .filter(t => filterClient === 'all' || t.client_id === filterClient)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [tasks, filterDept, filterClient, today]
  );

  const [selectedOverdueTasks, setSelectedOverdueTasks] = useState<string[]>([]);
  const [closingTasks, setClosingTasks] = useState(false);

  async function completeTasks(ids: string[]) {
    if (ids.length === 0) return;
    setClosingTasks(true);
    const { error } = await supabase.from('tasks').update({ status: 'done' }).in('id', ids);
    setClosingTasks(false);
    if (error) {
      toast({ title: 'Erro ao concluir', description: error.message, variant: 'destructive' });
      return;
    }
    setSelectedOverdueTasks(prev => prev.filter(id => !ids.includes(id)));
    toast({ title: ids.length > 1 ? `${ids.length} tarefas concluídas` : 'Tarefa concluída' });
    await loadData();
  }

  function getDayDots(day: number) {
    const dayEvents = getEventsForDay(day);
    const counts = { alert: 0, target: 0, due: 0 };
    for (const e of dayEvents) counts[e.type]++;
    return counts;
  }

  function getDayObligationSummary(day: number) {
    const dayEvents = getEventsForDay(day);
    const grouped: Record<string, { name: string; type: 'alert' | 'target' | 'due'; count: number }> = {};
    for (const e of dayEvents) {
      const key = `${e.obligationName}-${e.type}`;
      if (!grouped[key]) grouped[key] = { name: e.obligationName, type: e.type, count: 0 };
      grouped[key].count++;
    }
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthFiltered = events.filter(e => e.date.startsWith(prefix));
    const byInstance = new Map<string, CalendarEvent>();
    const prio: Record<string, number> = { due: 3, target: 2, alert: 1 };
    for (const ev of monthFiltered) {
      const existing = byInstance.get(ev.instanceId);
      if (!existing || (prio[ev.type] ?? 0) > (prio[existing.type] ?? 0)) {
        byInstance.set(ev.instanceId, ev);
      }
    }
    return Array.from(byInstance.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [events, year, month]);

  // Earliest date per instance (alert > target > due) used as the obligation's "initial day"
  const instanceInitialDate = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthFiltered = events.filter(e => e.date.startsWith(prefix));
    const map = new Map<string, string>();
    for (const ev of monthFiltered) {
      const existing = map.get(ev.instanceId);
      if (!existing || ev.date < existing) map.set(ev.instanceId, ev.date);
    }
    return map;
  }, [events, year, month]);

  const isSuspendedEvent = useCallback((ev: CalendarEvent) => {
    const cli = clientMap.get(ev.clientId);
    if (!cli?.services_suspended) return false;
    const initial = instanceInitialDate.get(ev.instanceId) ?? ev.date;
    return today >= initial;
  }, [clientMap, instanceInitialDate, today]);

  const deletedMonthEvents = useMemo(() => {
    const result: CalendarEvent[] = [];
    for (const inst of deletedInstances) {
      const obl = oblMap.get(inst.obligation_id);
      if (!obl) continue;
      const client = clientMap.get(inst.client_id);
      if (!client) continue;
      const dept = deptMap.get(obl.department_id);
      if (!dept) continue;
      if (filterDept !== 'all' && obl.department_id !== filterDept) continue;
      if (filterClient !== 'all' && inst.client_id !== filterClient) continue;
      if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;
      if (filterLateDeliveries && !isInstanceLateDelivery(inst.id, obl.id)) continue;
      const refDate = new Date(inst.reference_month + 'T00:00:00');
      const compDate = obl.competence_rule === 'previous'
        ? new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
        : refDate;
      const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const competenceLabel = obl.recurrence === 'trimestral'
        ? `${String(refDate.getMonth() + 1).padStart(2, '0')}/${refDate.getFullYear()}`
        : `${names[compDate.getMonth()]}/${compDate.getFullYear()}`;
      const refDay = (obl.due_day ?? obl.target_day ?? obl.alert_day ?? 1);
      const date = inst.due_date ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(refDay).padStart(2, '0')}`;
      result.push({
        clientId: client.id, clientName: formatClientLabel(client),
        obligationName: obl.name, deptName: dept.name,
        type: 'due', date, instanceId: inst.id, obligationId: obl.id, competenceLabel,
      });
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [deletedInstances, oblMap, clientMap, deptMap, filterDept, filterClient, filterObligation, filterLateDeliveries, isInstanceLateDelivery]);

  useEffect(() => { setDayPendingPage(1); setDayCompletedPage(1); clearSelection(); }, [selectedDay]);
  useEffect(() => { setMonthPendingPage(1); setMonthCompletedPage(1); clearSelection(); }, [year, month, filterDept, filterClient, filterLateDeliveries]);

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
    const inst = instances.find(i => i.id === instanceId) || deletedInstances.find(i => i.id === instanceId);
    if (inst?.status === 'done') return true;
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

  function isQuickCompleted(instanceId: string, obligationId: string): boolean {
    const inst = instances.find(i => i.id === instanceId) || deletedInstances.find(i => i.id === instanceId);
    if (inst?.completion_kind === 'quick') return true;
    const oblActivities = activities.filter(a => a.obligation_id === obligationId);
    if (oblActivities.length === 0) return false;
    const comps = oblActivities.map(act => completions.find(c => c.instance_id === instanceId && c.activity_id === act.id));
    if (comps.some(c => !c?.completed)) return false;
    return comps.every(c => c?.notes === 'quick_complete');
  }

  function getInstanceCompletedAt(instanceId: string): string | null {
    const comps = completions.filter(c => c.instance_id === instanceId && c.completed && c.completed_at);
    if (comps.length === 0) return null;
    return comps.reduce((max, c) => (c.completed_at! > max ? c.completed_at! : max), comps[0].completed_at!);
  }

  function getInstanceDueDate(instanceId: string): string | null {
    const inst = instances.find(i => i.id === instanceId) || deletedInstances.find(i => i.id === instanceId);
    if (!inst) return null;
    if (inst.due_date) return inst.due_date;
    const obl = oblMap.get(inst.obligation_id);
    if (!obl?.due_day) return null;
    const refDate = new Date(inst.reference_month + 'T00:00:00');
    const raw = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(obl.due_day).padStart(2, '0')}`;
    return previousBusinessDay(raw, holidays);
  }

  function isInstanceLateDelivery(instanceId: string, obligationId: string): boolean {
    if (!isInstanceCompleted(instanceId, obligationId)) return false;
    const completedAt = getInstanceCompletedAt(instanceId);
    const dueDate = getInstanceDueDate(instanceId);
    if (!completedAt || !dueDate) return false;
    const completedDate = completedAt.split('T')[0];
    return completedDate > dueDate;
  }

  function getLateDeliveryDays(instanceId: string): number | null {
    const completedAt = getInstanceCompletedAt(instanceId);
    const dueDate = getInstanceDueDate(instanceId);
    if (!completedAt || !dueDate) return null;
    const completed = parseISO(completedAt.split('T')[0]);
    const due = parseISO(dueDate);
    const diff = Math.floor((completed.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
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

    // If user is un-checking an activity, clear quick-complete marker on the instance
    if (currentlyCompleted) {
      await supabase.from('obligation_instances').update({ status: 'pending', completion_kind: null }).eq('id', detailInstanceId);
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
        } else if (nextAct.type === 'whatsapp' && (nextAct.whatsapp_template_name || nextAct.whatsapp_message_body)) {
          const result = await sendActivityWhatsApp({
            activity: nextAct,
            instanceId: detailInstanceId,
            clientId: detailInstance.client_id,
            obligationName: detailObligation.name,
            referenceMonth: detailInstance.reference_month,
            dueDay: detailObligation.due_day,
            departmentId: detailObligation.department_id,
          });
          if (!result.success) {
            toast({ title: 'Erro no envio automático de WhatsApp', description: result.error, variant: 'destructive' });
            break;
          }
          toast({ title: `WhatsApp "${nextAct.title}" enviado automaticamente` });
        } else if (nextAct.type === 'whatsapp') {
          break;
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
    const safeName = sanitizeStorageName(file.name);
    const path = `obligations/${detailInstanceId}/${activityId}/${safeName}`;
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
      } else if (nextAct.type === 'whatsapp' && (nextAct.whatsapp_template_name || nextAct.whatsapp_message_body)) {
        const result = await sendActivityWhatsApp({
          activity: nextAct,
          instanceId: detailInstanceId,
          clientId: detailInstance.client_id,
          obligationName: detailObligation.name,
          referenceMonth: detailInstance.reference_month,
          dueDay: detailObligation.due_day,
          departmentId: detailObligation.department_id,
        });
        if (!result.success) {
          toast({ title: 'Erro no envio automático de WhatsApp', description: result.error, variant: 'destructive' });
          break;
        }
        toast({ title: `WhatsApp "${nextAct.title}" enviado automaticamente` });
      } else if (nextAct.type === 'whatsapp') {
        break;
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

  async function deleteInstance() {
    if (!deleteInstanceId) return;
    await supabase.from('obligation_instances').update({ deleted_at: new Date().toISOString() }).eq('id', deleteInstanceId);
    toast({ title: 'Obrigação movida para Excluídas' });
    setDeleteInstanceId(null);
    if (detailInstanceId === deleteInstanceId) setDetailInstanceId(null);
    await loadData();
  }

  async function deleteSelectedInstances() {
    const ids = Array.from(selectedInstanceIds);
    await supabase.from('obligation_instances').update({ deleted_at: new Date().toISOString() }).in('id', ids);
    toast({ title: `${ids.length} obrigação(ões) movida(s) para Excluídas` });
    clearSelection();
    setShowBulkDeleteConfirm(false);
    if (detailInstanceId && ids.includes(detailInstanceId)) setDetailInstanceId(null);
    await loadData();
  }

  async function quickCompleteSelectedInstances() {
    const ids = Array.from(selectedInstanceIds);
    const allInstances = [...instances, ...deletedInstances];
    const nowIso = new Date().toISOString();
    let done = 0, already = 0, skippedDeleted = 0, errors = 0;
    for (const instanceId of ids) {
      const inst = allInstances.find(i => i.id === instanceId);
      if (!inst) { errors++; continue; }
      if (inst.deleted_at) { skippedDeleted++; continue; }
      if (isInstanceCompleted(instanceId, inst.obligation_id)) { already++; continue; }
      const oblActs = activities.filter(a => a.obligation_id === inst.obligation_id);
      try {
        for (const act of oblActs) {
          const existing = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
          if (existing) {
            await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: nowIso, notes: 'quick_complete' }).eq('id', existing.id);
          } else {
            await supabase.from('obligation_activity_completions').insert({ instance_id: instanceId, activity_id: act.id, completed: true, completed_at: nowIso, notes: 'quick_complete' });
          }
        }
        await supabase.from('obligation_instances').update({ status: 'done', completion_kind: 'quick', on_hold: false, hold_reason: null, hold_at: null, hold_by: null }).eq('id', instanceId);
        done++;
      } catch {
        errors++;
      }
    }
    const parts = [`${done} concluída(s)`];
    if (already) parts.push(`${already} já concluída(s)`);
    if (skippedDeleted) parts.push(`${skippedDeleted} excluída(s) ignorada(s)`);
    if (errors) parts.push(`${errors} com erro`);
    toast({ title: 'Conclusão em massa', description: parts.join(' • ') });
    clearSelection();
    setShowBulkCompleteConfirm(false);
    await loadData();
  }

  async function restoreInstance(instanceId: string) {
    const { error } = await supabase.from('obligation_instances').update({ deleted_at: null }).eq('id', instanceId);
    if (error) {
      toast({ title: 'Erro ao restaurar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Obrigação restaurada' });
    await loadData();
  }

  async function confirmHold() {
    const ids = holdTarget || [];
    const reason = holdReason.trim();
    if (ids.length === 0 || !reason) return;
    setHoldSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from('obligation_instances').update({
      on_hold: true,
      hold_reason: reason,
      hold_at: new Date().toISOString(),
      hold_by: userRes?.user?.id ?? null,
    }).in('id', ids);
    setHoldSaving(false);
    if (error) {
      toast({ title: 'Erro ao colocar em espera', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: ids.length > 1 ? `${ids.length} obrigações em espera` : 'Obrigação aguardando' });
    setHoldTarget(null);
    setHoldReason('');
    clearSelection();
    if (detailInstanceId && ids.includes(detailInstanceId)) setDetailInstanceId(null);
    await loadData();
  }

  async function resumeInstance(instanceId: string) {
    const { error } = await supabase.from('obligation_instances')
      .update({ on_hold: false, hold_reason: null, hold_at: null, hold_by: null })
      .eq('id', instanceId);
    if (error) {
      toast({ title: 'Erro ao retomar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Obrigação retomada' });
    await loadData();
  }

  async function hardDeleteInstance(instanceId: string) {
    await supabase.from('obligation_activity_completions').delete().eq('instance_id', instanceId);
    const { error } = await supabase.from('obligation_instances').delete().eq('id', instanceId);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Obrigação excluída permanentemente' });
    await loadData();
  }

  async function quickCompleteInstance(instanceId: string, obligationId: string) {
    const oblActs = activities.filter(a => a.obligation_id === obligationId);
    const nowIso = new Date().toISOString();
    try {
      for (const act of oblActs) {
        const existing = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
        if (existing) {
          await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: nowIso, notes: 'quick_complete' }).eq('id', existing.id);
        } else {
          await supabase.from('obligation_activity_completions').insert({ instance_id: instanceId, activity_id: act.id, completed: true, completed_at: nowIso, notes: 'quick_complete' });
        }
      }
      await supabase.from('obligation_instances').update({ status: 'done', completion_kind: 'quick', on_hold: false, hold_reason: null, hold_at: null, hold_by: null }).eq('id', instanceId);
      await loadData();
      toast({ title: 'Obrigação concluída' });
    } catch (e: any) {
      toast({ title: 'Erro ao concluir', description: e?.message ?? String(e), variant: 'destructive' });
    }
  }

  const onHoldIds = useMemo(() => new Set(instances.filter(i => i.on_hold).map(i => i.id)), [instances]);
  const instanceMap = useMemo(() => new Map(instances.map(i => [i.id, i])), [instances]);
  const dayEventsPending = selectedEvents.filter(ev => !isInstanceCompleted(ev.instanceId, ev.obligationId) && !isSuspendedEvent(ev) && !onHoldIds.has(ev.instanceId));
  const dayEventsCompleted = selectedEvents.filter(ev => isInstanceCompleted(ev.instanceId, ev.obligationId) && !isSuspendedEvent(ev));
  const dayPendingTotalPages = Math.ceil(dayEventsPending.length / DAY_ITEMS_PER_PAGE);
  const dayCompletedTotalPages = Math.ceil(dayEventsCompleted.length / DAY_ITEMS_PER_PAGE);
  const paginatedDayPending = dayEventsPending.slice((dayPendingPage - 1) * DAY_ITEMS_PER_PAGE, dayPendingPage * DAY_ITEMS_PER_PAGE);
  const paginatedDayCompleted = dayEventsCompleted.slice((dayCompletedPage - 1) * DAY_ITEMS_PER_PAGE, dayCompletedPage * DAY_ITEMS_PER_PAGE);
  const monthEventsPending = monthEvents.filter(ev => !isInstanceCompleted(ev.instanceId, ev.obligationId) && !isSuspendedEvent(ev) && !onHoldIds.has(ev.instanceId));
  const monthEventsHold = monthEvents.filter(ev => onHoldIds.has(ev.instanceId) && !isInstanceCompleted(ev.instanceId, ev.obligationId));
  const monthHoldTotalPages = Math.ceil(monthEventsHold.length / ITEMS_PER_PAGE);
  const paginatedMonthHold = monthEventsHold.slice((monthHoldPage - 1) * ITEMS_PER_PAGE, monthHoldPage * ITEMS_PER_PAGE);
  const monthEventsCompleted = monthEvents.filter(ev => isInstanceCompleted(ev.instanceId, ev.obligationId) && !isSuspendedEvent(ev));
  const monthEventsSuspended = monthEvents.filter(ev => isSuspendedEvent(ev));
  const monthEventsLate = monthEventsCompleted
    .filter(ev => isInstanceLateDelivery(ev.instanceId, ev.obligationId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthPendingTotalPages = Math.ceil(monthEventsPending.length / ITEMS_PER_PAGE);
  const monthCompletedTotalPages = Math.ceil(monthEventsCompleted.length / ITEMS_PER_PAGE);
  const paginatedMonthPending = monthEventsPending.slice((monthPendingPage - 1) * ITEMS_PER_PAGE, monthPendingPage * ITEMS_PER_PAGE);
  const paginatedMonthCompleted = monthEventsCompleted.slice((monthCompletedPage - 1) * ITEMS_PER_PAGE, monthCompletedPage * ITEMS_PER_PAGE);
  const monthLateTotalPages = Math.ceil(monthEventsLate.length / ITEMS_PER_PAGE);
  const paginatedMonthLate = monthEventsLate.slice((monthLatePage - 1) * ITEMS_PER_PAGE, monthLatePage * ITEMS_PER_PAGE);
  const monthDeletedTotalPages = Math.ceil(deletedMonthEvents.length / ITEMS_PER_PAGE);
  const paginatedMonthDeleted = deletedMonthEvents.slice((monthDeletedPage - 1) * ITEMS_PER_PAGE, monthDeletedPage * ITEMS_PER_PAGE);
  const monthSuspendedTotalPages = Math.ceil(monthEventsSuspended.length / ITEMS_PER_PAGE);
  const paginatedMonthSuspended = monthEventsSuspended.slice((monthSuspendedPage - 1) * ITEMS_PER_PAGE, monthSuspendedPage * ITEMS_PER_PAGE);

  // Dialog progress
  const dialogProgress = detailInstance
    ? getInstanceProgress(detailInstance.id, detailInstance.obligation_id)
    : { completed: 0, total: 0, percent: 0 };

  return (
    <div className="space-y-6">
      {/* Header + Filters unified */}
      {(() => {
        const activeFilters = [filterDept, filterClient, filterObligation].filter(v => v !== 'all').length + (filterLateDeliveries ? 1 : 0);
        return (
          <div className="bg-card rounded-xl border p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Calendário</h1>
                  <p className="hidden md:block text-sm text-muted-foreground">Acompanhe prazos e obrigações dos seus clientes</p>
                </div>
              </div>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => { setFilterDept('all'); setFilterClient('all'); setFilterObligation('all'); setFilterLateDeliveries(false); setSelectedDay(null); }}
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar filtros
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{activeFilters}</Badge>
                </Button>
              )}
            </div>

            <div className="border-t pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select value={filterDept} onValueChange={v => { setFilterDept(v); setFilterObligation('all'); setSelectedDay(null); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os departamentos</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {filterClient === 'all' ? 'Todas as empresas' : formatClientLabel(clients.find(c => c.id === filterClient), 'Empresa')}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] md:w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar empresa..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="todas-as-empresas"
                            onSelect={() => { setFilterClient('all'); setSelectedDay(null); setClientOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${filterClient === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                            Todas as empresas
                          </CommandItem>
                          {clients.map(c => (
                            <CommandItem
                              key={c.id}
                              value={formatClientLabel(c)}
                              onSelect={() => { setFilterClient(c.id); setSelectedDay(null); setClientOpen(false); }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${filterClient === c.id ? 'opacity-100' : 'opacity-0'}`} />
                              {formatClientLabel(c)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Select value={filterObligation} onValueChange={v => { setFilterObligation(v); setSelectedDay(null); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Obrigação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as obrigações</SelectItem>
                    {obligations
                      .filter(o => filterDept === 'all' || o.department_id === filterDept)
                      .map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium">Fora do prazo</span>
                  <Switch
                    checked={filterLateDeliveries}
                    onCheckedChange={v => { setFilterLateDeliveries(v); setSelectedDay(null); }}
                    aria-label="Mostrar apenas obrigações entregues fora do prazo"
                  />
                </label>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Metric Cards */}
      {(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        const hols = getHolidays(y);

        const makeDate = (day: number | null, refMonth: string) => {
          if (!day) return null;
          const rd = new Date(refMonth + 'T00:00:00');
          const raw = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return previousBusinessDay(raw, hols);
        };

        let todo = 0, afterAlert = 0, afterTarget = 0, overdue = 0, doneOnTime = 0, doneLate = 0;

        // Filter instances for current month view
        const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
        const monthInstances = instances.filter(inst =>
          inst.reference_month.startsWith(monthPrefix) ||
          (inst.due_date ? inst.due_date.startsWith(monthPrefix) : false)
        );

        for (const inst of monthInstances) {
          const obl = oblMap.get(inst.obligation_id);
          if (!obl) continue;
          if (filterDept !== 'all' && obl.department_id !== filterDept) continue;
          if (filterClient !== 'all' && inst.client_id !== filterClient) continue;
          if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;

          const isQuarterly = obl.recurrence === 'trimestral';
          const alertDate = isQuarterly ? null : makeDate(obl.alert_day, inst.reference_month);
          const targetDate = isQuarterly ? null : makeDate(obl.target_day, inst.reference_month);
          const dueDate = inst.due_date ?? makeDate(obl.due_day, inst.reference_month);

          const completed = isInstanceCompleted(inst.id, inst.obligation_id);

          if (completed) {
            if (isInstanceLateDelivery(inst.id, inst.obligation_id)) {
              doneLate++;
            } else {
              doneOnTime++;
            }
          } else {
            if (dueDate && todayStr >= dueDate) {
              overdue++;
            } else if (targetDate && todayStr >= targetDate) {
              afterTarget++;
            } else if (alertDate && todayStr >= alertDate) {
              afterAlert++;
            } else {
              todo++;
            }
          }
        }

        const doneTotal = doneOnTime + doneLate;
        const toDoTotal = todo + afterAlert + afterTarget;
        const grandTotal = toDoTotal + overdue + doneTotal;
        const pct = (v: number) => grandTotal > 0 ? Math.round((v / grandTotal) * 100) : 0;
        const cards = [
          { label: 'A Fazer', value: toDoTotal, icon: ListChecks, sub: toDoTotal === 0 ? 'Nenhuma pendência' : 'Aguardando conclusão', pct: pct(toDoTotal),
            bg: 'bg-blue-50/60 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-900/40',
            iconBg: 'bg-blue-600', labelText: 'text-blue-700 dark:text-blue-300', valueText: 'text-blue-900 dark:text-blue-100',
            subText: 'text-blue-600/70 dark:text-blue-300/60', track: 'bg-blue-200/50 dark:bg-blue-900/40', bar: 'bg-blue-600' },
          { label: 'Atrasadas', value: overdue, icon: AlertTriangle, sub: overdue === 0 ? 'Tudo em dia' : 'Crítico', pct: pct(overdue),
            bg: 'bg-red-50/60 dark:bg-red-950/20', border: 'border-red-100 dark:border-red-900/40',
            iconBg: 'bg-red-600', labelText: 'text-red-700 dark:text-red-300', valueText: 'text-red-900 dark:text-red-100',
            subText: 'text-red-600/70 dark:text-red-300/60', track: 'bg-red-200/50 dark:bg-red-900/40', bar: 'bg-red-600' },
          { label: 'Concluídas', value: doneTotal, icon: CheckSquare, sub: `${doneOnTime} no prazo • ${doneLate} fora`, pct: pct(doneTotal),
            bg: 'bg-emerald-50/60 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/40',
            iconBg: 'bg-emerald-600', labelText: 'text-emerald-700 dark:text-emerald-300', valueText: 'text-emerald-900 dark:text-emerald-100',
            subText: 'text-emerald-600/70 dark:text-emerald-300/60', track: 'bg-emerald-200/50 dark:bg-emerald-900/40', bar: 'bg-emerald-600' },
        ];

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map(c => (
              <div key={c.label} className={`relative rounded-2xl border p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5 ${c.bg} ${c.border}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-white shadow-md ${c.iconBg}`}>
                    <c.icon className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-semibold text-xs sm:text-sm tracking-wide ${c.labelText}`}>{c.label}</span>
                    <span className={`text-2xl sm:text-3xl font-bold leading-tight ${c.valueText}`}>{c.value}</span>
                  </div>
                </div>
                <p className={`text-[11px] font-medium mb-3 mt-auto truncate ${c.subText}`}>{c.sub}</p>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${c.track}`}>
                  <div className={`${c.bar} h-full rounded-full transition-all`} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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
                <div key={d} className="p-1 md:p-2 text-center text-[10px] md:text-xs font-semibold text-muted-foreground uppercase md:tracking-wider">{d}</div>
              ))}
              {days.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[32px] md:min-h-[100px] p-0.5 md:p-1" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const isSelected = selectedDay === day;
                const isHoliday = holidayMap.has(dateStr);
                const holidayName = holidayMap.get(dateStr);
                const summary = getDayObligationSummary(day);
                const maxVisible = 3;
                const visible = summary.slice(0, maxVisible);
                const remaining = summary.length - maxVisible;
                const typeColor = { alert: 'bg-green-500', target: 'bg-orange-500', due: 'bg-red-500' };
                const dayTasks = getTasksForDay(day);
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    title={isHoliday ? holidayName : undefined}
                    className={`min-h-[32px] md:min-h-[100px] rounded-lg p-0.5 md:p-1.5 cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'bg-primary/15 border-2 border-primary shadow-md'
                        : isToday
                          ? 'bg-blue-50 border border-blue-400 dark:bg-blue-950 dark:border-blue-500'
                          : isHoliday
                            ? 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
                            : 'border border-border hover:bg-muted/60 hover:shadow-sm'
                      }`}
                  >
                    <span className={`inline-flex items-center justify-center text-[10px] md:text-xs font-semibold w-5 h-5 md:w-6 md:h-6 rounded-full
                      ${isToday ? 'bg-blue-500 text-white' : 'text-foreground'}`}>
                      {day}
                    </span>
                    {isHoliday && (
                      <span className="hidden md:block text-[9px] text-muted-foreground truncate leading-tight mt-0.5">{holidayName}</span>
                    )}
                    {(visible.length > 0 || dayTasks.length > 0) && (
                      <>
                        {/* Mobile: dots only */}
                        <div className="flex flex-wrap gap-0.5 mt-1 md:hidden">
                          {summary.slice(0, 5).map((item, idx) => (
                            <span key={idx} className={`w-1 h-1 rounded-full ${typeColor[item.type]}`} />
                          ))}
                          {dayTasks.length > 0 && (
                            <span className="w-1 h-1 rounded-full bg-primary" />
                          )}
                          {summary.length > 5 && <span className="text-[8px] text-muted-foreground">+{summary.length - 5}</span>}
                        </div>
                        {/* Desktop: full text */}
                        <div className="hidden md:flex flex-col gap-0.5 mt-1">
                          {visible.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeColor[item.type]}`} />
                              <span className="text-[10px] text-foreground truncate leading-tight">{item.name}</span>
                              <span className="text-[10px] text-muted-foreground font-medium shrink-0 ml-auto">{item.count}</span>
                            </div>
                          ))}
                          {remaining > 0 && (
                            <span className="text-[9px] text-muted-foreground pl-2.5">+{remaining} mais</span>
                          )}
                          {dayTasks.length > 0 && (
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-primary" />
                              <span className="text-[10px] text-foreground truncate leading-tight">Tarefas</span>
                              <span className="text-[10px] text-muted-foreground font-medium shrink-0 ml-auto">{dayTasks.length}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 md:gap-5 mt-4 px-3 py-2 rounded-md bg-muted/40 text-[10px] md:text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Alerta</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Meta</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Vencimento</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Tarefa</div>
            </div>
          </CardContent>
        </Card>

        {/* Day obligations - right side */}
        <Card className="flex-1 lg:flex-[1] max-w-2xl">
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
            {(() => { return null; })()}
            {!selectedDay ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Selecione um dia no calendário</p>
              </div>
            ) : selectedEvents.length === 0 && getTasksForDay(selectedDay).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Nada agendado neste dia</p>
              </div>
            ) : (
              <>
              {selectedEvents.length > 0 && (
              <Tabs defaultValue="pending">
                <TabsList className="mb-4 w-full grid grid-cols-2">
                  <TabsTrigger value="pending">
                    A Fazer
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{dayEventsPending.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Concluído
                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{dayEventsCompleted.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                {[
                  { key: 'pending', items: paginatedDayPending, allItems: dayEventsPending, page: dayPendingPage, totalPages: dayPendingTotalPages, total: dayEventsPending.length, setPage: setDayPendingPage },
                  { key: 'completed', items: paginatedDayCompleted, allItems: dayEventsCompleted, page: dayCompletedPage, totalPages: dayCompletedTotalPages, total: dayEventsCompleted.length, setPage: setDayCompletedPage },
                ].map(tab => {
                  const allIds = tab.allItems.map(e => e.instanceId);
                  const allSelected = allIds.length > 0 && allIds.every(id => selectedInstanceIds.has(id));
                  return (
                  <TabsContent key={tab.key} value={tab.key}>
                    {tab.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-muted-foreground text-sm">{tab.key === 'pending' ? 'Nenhuma obrigação pendente' : 'Nenhuma obrigação concluída'}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => {
                                if (allSelected) {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.delete(id)); return next; });
                                } else {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.add(id)); return next; });
                                }
                              }}
                            />
                            Selecionar todos
                          </label>
                        </div>
                        <div className="space-y-2">
                          {tab.items.map((ev, idx) => {
                            const completed = isInstanceCompleted(ev.instanceId, ev.obligationId);
                            const isLateDelivery = completed && isInstanceLateDelivery(ev.instanceId, ev.obligationId);
                            const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                            const isSelected = selectedInstanceIds.has(ev.instanceId);
                            const quick = completed && isQuickCompleted(ev.instanceId, ev.obligationId);
                            const obl = oblMap.get(ev.obligationId);
                            const isDasSn = obl?.system_code === 'das-simples-nacional';
                            return (
                              <div
                                key={idx}
                                onClick={() => setDetailInstanceId(ev.instanceId)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm
                                  ${isSelected ? 'ring-2 ring-primary/50' : ''}
                                  ${isLateDelivery
                                    ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                                    : completed
                                      ? (quick
                                          ? 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800'
                                          : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800')
                                      : 'border-border hover:border-primary/30 hover:bg-muted/30'
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelection(ev.instanceId)}
                                      onClick={e => e.stopPropagation()}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px]`}>
                                      {typeConfig[ev.type].label}
                                    </Badge>
                                    {isLateDelivery && (
                                      <Badge className="bg-orange-500 text-white border-0 text-[10px]">
                                        Fora do prazo
                                      </Badge>
                                    )}
                                    {!completed && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" title="Concluir obrigação" onClick={e => { e.stopPropagation(); quickCompleteInstance(ev.instanceId, ev.obligationId); }}>
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {!completed && isDasSn && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600" title="Declarar Sem Movimento" onClick={e => { e.stopPropagation(); setSemMovInstanceId(ev.instanceId); }}>
                                        <FileX className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteInstanceId(ev.instanceId); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                                  {progress.total > 0 && (
                                    <span className={`text-[10px] font-medium ${completed ? (quick ? 'text-sky-600 dark:text-sky-400' : 'text-green-600 dark:text-green-400') : 'text-muted-foreground'}`}>
                                      {progress.completed}/{progress.total} atividades
                                    </span>
                                  )}
                                </div>
                                {progress.total > 0 && (
                                  <Progress value={progress.percent} className="h-1 mt-2" />
                                )}
                                {completed && (() => {
                                  const completedAt = getInstanceCompletedAt(ev.instanceId);
                                  if (!completedAt) return null;
                                  return (
                                    <div className={`flex items-center gap-1 mt-2 text-[10px] ${quick ? 'text-sky-600 dark:text-sky-400' : 'text-green-600 dark:text-green-400'}`}>
                                      <Clock className="h-3 w-3" />
                                      <span>Concluído em {format(parseISO(completedAt), "dd/MM/yyyy 'às' HH:mm")}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                        <PaginationBlock page={tab.page} totalPages={tab.totalPages} total={tab.total} onPageChange={tab.setPage} perPage={DAY_ITEMS_PER_PAGE} />
                      </>
                    )}
                  </TabsContent>
                  );
                })}
              </Tabs>
              )}
              {selectedDay && getTasksForDay(selectedDay).length > 0 && (
                <div className={selectedEvents.length > 0 ? 'mt-6' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="text-sm font-semibold">Tarefas</h4>
                    <Badge variant="secondary" className="text-[10px] px-1.5">{getTasksForDay(selectedDay).length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {getTasksForDay(selectedDay).map(t => {
                      const cli = t.client_id ? clientMap.get(t.client_id) : null;
                      const dept = t.department_id ? deptMap.get(t.department_id) : null;
                      const prioColor: Record<string, string> = { low: 'bg-muted text-foreground', medium: 'bg-blue-500 text-white', high: 'bg-orange-500 text-white', urgent: 'bg-red-500 text-white' };
                      const overdue = isTaskOverdue(t);
                      return (
                        <div
                          key={t.id}
                          onClick={() => setEditingTaskId(t.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${overdue ? 'border-red-300 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 hover:border-red-400' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                <span className="text-muted-foreground mr-1">#{String(t.task_number).padStart(6, '0')}</span>
                                {t.title}
                              </p>
                              {cli && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{formatClientLabel(cli)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge className={`${prioColor[t.priority] || prioColor.medium} border-0 text-[10px]`}>{t.priority}</Badge>
                              {t.status !== 'done' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
                                  title="Marcar como concluída"
                                  disabled={closingTasks}
                                  onClick={(e) => { e.stopPropagation(); completeTasks([t.id]); }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-2">
                            {dept ? <Badge variant="outline" className="text-[10px]">{dept.name}</Badge> : <span />}
                            <div className="flex items-center gap-1">
                              {overdue && <Badge className="bg-red-600 text-white border-0 text-[10px]">Atrasada</Badge>}
                              <Badge variant="outline" className="text-[10px]">{taskStatusLabels[t.status] || t.status}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue tasks of the month */}
      {overdueMonthTasks.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <CardTitle className="text-lg">Tarefas atrasadas</CardTitle>
                  <CardDescription className="mt-0.5">{overdueMonthTasks.length} tarefa(s) vencida(s) ainda em aberto</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOverdueTasks(
                    selectedOverdueTasks.length === overdueMonthTasks.length ? [] : overdueMonthTasks.map(t => t.id)
                  )}
                >
                  {selectedOverdueTasks.length === overdueMonthTasks.length ? 'Limpar seleção' : 'Selecionar todas'}
                </Button>
                <Button
                  size="sm"
                  disabled={selectedOverdueTasks.length === 0 || closingTasks}
                  onClick={() => completeTasks(selectedOverdueTasks)}
                >
                  {closingTasks ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Concluir {selectedOverdueTasks.length > 0 ? `(${selectedOverdueTasks.length})` : ''}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueMonthTasks.map(t => {
                const cli = t.client_id ? clientMap.get(t.client_id) : null;
                const dept = t.department_id ? deptMap.get(t.department_id) : null;
                const checked = selectedOverdueTasks.includes(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => setSelectedOverdueTasks(prev => v ? [...prev, t.id] : prev.filter(id => id !== t.id))}
                    />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditingTaskId(t.id)}>
                      <p className="text-sm font-medium truncate">
                        <span className="text-muted-foreground mr-1">#{String(t.task_number).padStart(6, '0')}</span>
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {cli && (<><Building2 className="h-3 w-3 inline mr-1" />{formatClientLabel(cli)} · </>)}
                        Venceu em {format(parseISO(t.due_date), 'dd/MM/yyyy')}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {dept && <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{dept.name}</Badge>}
                      <Badge variant="outline" className="text-[10px]">{taskStatusLabels[t.status] || t.status}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                        title="Marcar como concluída"
                        disabled={closingTasks}
                        onClick={() => completeTasks([t.id])}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
          {monthEvents.length === 0 && deletedMonthEvents.length === 0 && monthEventsSuspended.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ListChecks className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma obrigação com data de meta neste mês</p>
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="pending">
                  A fazer
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{monthEventsPending.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Concluídas
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{monthEventsCompleted.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="late">
                  Fora do prazo
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{monthEventsLate.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="hold">
                  Aguardando
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{monthEventsHold.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="deleted">
                  Excluídas
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{deletedMonthEvents.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="suspended">
                  Suspensos
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{monthEventsSuspended.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {monthEventsPending.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Todas as obrigações foram concluídas!</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const allIds = monthEventsPending.map(e => e.instanceId);
                      const allSelected = allIds.length > 0 && allIds.every(id => selectedInstanceIds.has(id));
                      return (
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => {
                                if (allSelected) {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.delete(id)); return next; });
                                } else {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.add(id)); return next; });
                                }
                              }}
                            />
                            Selecionar todos
                          </label>
                        </div>
                      );
                    })()}
                    <div className="space-y-2">
                      {paginatedMonthPending.map((ev, idx) => {
                        const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                        const isSelected = selectedInstanceIds.has(ev.instanceId);
                        const obl = oblMap.get(ev.obligationId);
                        const isDasSn = obl?.system_code === 'das-simples-nacional';
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailInstanceId(ev.instanceId)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm border-border hover:border-primary/30 hover:bg-muted/30 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(ev.instanceId)}
                                onClick={e => e.stopPropagation()}
                                className="shrink-0"
                              />
                              <div className="w-14 shrink-0 text-sm font-semibold text-primary">
                                {ev.date.split('-').reverse().slice(0, 2).join('/')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px]`}>
                                  {typeConfig[ev.type].label}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" title="Concluir obrigação" onClick={e => { e.stopPropagation(); quickCompleteInstance(ev.instanceId, ev.obligationId); }}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                {isDasSn && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600" title="Declarar Sem Movimento" onClick={e => { e.stopPropagation(); setSemMovInstanceId(ev.instanceId); }}>
                                    <FileX className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600" title="Aguardar" onClick={e => { e.stopPropagation(); setHoldReason(''); setHoldTarget([ev.instanceId]); }}>
                                  <PauseCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteInstanceId(ev.instanceId); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                              {progress.total > 0 && (
                                <span className="text-[10px] font-medium text-muted-foreground">
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
                    <PaginationBlock page={monthPendingPage} totalPages={monthPendingTotalPages} total={monthEventsPending.length} onPageChange={setMonthPendingPage} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="completed">
                {monthEventsCompleted.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <ListChecks className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação concluída neste mês</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const allIds = monthEventsCompleted.map(e => e.instanceId);
                      const allSelected = allIds.length > 0 && allIds.every(id => selectedInstanceIds.has(id));
                      return (
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => {
                                if (allSelected) {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.delete(id)); return next; });
                                } else {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.add(id)); return next; });
                                }
                              }}
                            />
                            Selecionar todos
                          </label>
                        </div>
                      );
                    })()}
                    <div className="space-y-2">
                      {paginatedMonthCompleted.map((ev, idx) => {
                        const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                        const isSelected = selectedInstanceIds.has(ev.instanceId);
                        const quick = isQuickCompleted(ev.instanceId, ev.obligationId);
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailInstanceId(ev.instanceId)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${quick ? 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'} ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(ev.instanceId)}
                                onClick={e => e.stopPropagation()}
                                className="shrink-0"
                              />
                              <div className="w-14 shrink-0 text-sm font-semibold text-primary">
                                {ev.date.split('-').reverse().slice(0, 2).join('/')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px]`}>
                                  {typeConfig[ev.type].label}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteInstanceId(ev.instanceId); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                              {progress.total > 0 && (
                                <span className={`text-[10px] font-medium ${quick ? 'text-sky-600 dark:text-sky-400' : 'text-green-600 dark:text-green-400'}`}>
                                  {progress.completed}/{progress.total} atividades
                                </span>
                              )}
                            </div>
                            {progress.total > 0 && (
                              <Progress value={progress.percent} className="h-1 mt-2" />
                            )}
                            {(() => {
                              const completedAt = getInstanceCompletedAt(ev.instanceId);
                              if (!completedAt) return null;
                              return (
                                <div className={`flex items-center gap-1 mt-2 text-[10px] ${quick ? 'text-sky-600 dark:text-sky-400' : 'text-green-600 dark:text-green-400'}`}>
                                  <Clock className="h-3 w-3" />
                                  <span>Concluído em {format(parseISO(completedAt), "dd/MM/yyyy 'às' HH:mm")}</span>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                    <PaginationBlock page={monthCompletedPage} totalPages={monthCompletedTotalPages} total={monthEventsCompleted.length} onPageChange={setMonthCompletedPage} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="late">
                {monthEventsLate.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação entregue fora do prazo neste mês</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const allIds = monthEventsLate.map(e => e.instanceId);
                      const allSelected = allIds.length > 0 && allIds.every(id => selectedInstanceIds.has(id));
                      return (
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => {
                                if (allSelected) {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.delete(id)); return next; });
                                } else {
                                  setSelectedInstanceIds(prev => { const next = new Set(prev); allIds.forEach(id => next.add(id)); return next; });
                                }
                              }}
                            />
                            Selecionar todos
                          </label>
                        </div>
                      );
                    })()}
                    <div className="space-y-2">
                      {paginatedMonthLate.map((ev, idx) => {
                        const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                        const isSelected = selectedInstanceIds.has(ev.instanceId);
                        const lateDays = getLateDeliveryDays(ev.instanceId);
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailInstanceId(ev.instanceId)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(ev.instanceId)}
                                onClick={e => e.stopPropagation()}
                                className="shrink-0"
                              />
                              <div className="w-14 shrink-0 text-sm font-semibold text-primary">
                                {ev.date.split('-').reverse().slice(0, 2).join('/')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className="bg-orange-500 text-white border-0 text-[10px]">
                                  Fora do prazo
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteInstanceId(ev.instanceId); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                              {progress.total > 0 && (
                                <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                                  {progress.completed}/{progress.total} atividades
                                </span>
                              )}
                            </div>
                            {progress.total > 0 && (
                              <Progress value={progress.percent} className="h-1 mt-2" />
                            )}
                            {(() => {
                              const completedAt = getInstanceCompletedAt(ev.instanceId);
                              if (!completedAt) return null;
                              return (
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-orange-600 dark:text-orange-400">
                                  <Clock className="h-3 w-3" />
                                  <span>Concluído em {format(parseISO(completedAt), "dd/MM/yyyy 'às' HH:mm")}{lateDays ? ` · ${lateDays} dia${lateDays > 1 ? 's' : ''} de atraso` : ''}</span>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                    <PaginationBlock page={monthLatePage} totalPages={monthLateTotalPages} total={monthEventsLate.length} onPageChange={setMonthLatePage} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="hold">
                {monthEventsHold.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <PauseCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação aguardando neste mês</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedMonthHold.map((ev, idx) => {
                        const inst = instanceMap.get(ev.instanceId);
                        const by = inst?.hold_by ? profilesMap[inst.hold_by] : null;
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailInstanceId(ev.instanceId)}
                            className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-900/40 cursor-pointer transition-all hover:shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-14 shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-400">
                                {ev.date.split('-').reverse().slice(0, 2).join('/')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0 text-[10px]">Aguardando</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600" title="Editar motivo" onClick={e => { e.stopPropagation(); setHoldReason(inst?.hold_reason || ''); setHoldTarget([ev.instanceId]); }}>
                                  <PauseCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" title="Retomar" onClick={e => { e.stopPropagation(); resumeInstance(ev.instanceId); }}>
                                  <PlayCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 whitespace-pre-wrap">
                              <strong>Motivo:</strong> {inst?.hold_reason || '—'}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                              {inst?.hold_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {by ? `${by} • ` : ''}{format(parseISO(inst.hold_at), "dd/MM/yyyy HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <PaginationBlock page={monthHoldPage} totalPages={monthHoldTotalPages} total={monthEventsHold.length} onPageChange={setMonthHoldPage} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="deleted">
                {deletedMonthEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Trash2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação excluída neste mês</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedMonthDeleted.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-14 shrink-0 text-sm font-semibold text-muted-foreground line-through">
                              {ev.date.split('-').reverse().slice(0, 2).join('/')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-muted-foreground truncate line-through">{ev.obligationName} | {ev.competenceLabel}</p>
                              <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                                <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Excluída</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Restaurar" onClick={e => { e.stopPropagation(); restoreInstance(ev.instanceId); }}>
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Excluir permanentemente" onClick={e => { e.stopPropagation(); hardDeleteInstance(ev.instanceId); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <PaginationBlock page={monthDeletedPage} totalPages={monthDeletedTotalPages} total={deletedMonthEvents.length} onPageChange={setMonthDeletedPage} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="suspended">
                {monthEventsSuspended.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação suspensa neste mês</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedMonthSuspended.map((ev, idx) => (
                        <div
                          key={idx}
                          onClick={() => setDetailInstanceId(ev.instanceId)}
                          className="p-3 rounded-lg border border-orange-200 bg-orange-50/60 dark:bg-orange-900/10 dark:border-orange-900/40 cursor-pointer transition-all hover:shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-14 shrink-0 text-sm font-semibold text-orange-700 dark:text-orange-400">
                              {ev.date.split('-').reverse().slice(0, 2).join('/')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-0 text-[10px]">
                                Suspenso
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-[10px]">{ev.deptName}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <PaginationBlock page={monthSuspendedPage} totalPages={monthSuspendedTotalPages} total={monthEventsSuspended.length} onPageChange={setMonthSuspendedPage} />
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailInstanceId} onOpenChange={open => { if (!open) setDetailInstanceId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {detailObligation?.name}{detailInstance ? (() => { const rd = new Date(detailInstance.reference_month + 'T00:00:00'); const cd = detailObligation?.competence_rule === 'previous' ? new Date(rd.getFullYear(), rd.getMonth() - 1, 1) : rd; const mn = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; const label = detailObligation?.recurrence === 'trimestral' ? `${String(rd.getMonth() + 1).padStart(2, '0')}/${rd.getFullYear()}` : `${mn[cd.getMonth()]}/${cd.getFullYear()}`; return ` | ${label}`; })() : ''}
            </DialogTitle>
            {detailInstance && (
              <p className="text-sm text-muted-foreground mt-1">
                <Building2 className="h-3.5 w-3.5 inline mr-1" />
                {formatClientLabel(clientMap.get(detailInstance.client_id))}
              </p>
            )}
          </DialogHeader>

          {detailObligation?.system_code === 'das-simples-nacional' && detailInstance && (
            <Button
              variant="outline"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
              onClick={() => setSemMovInstanceId(detailInstance.id)}
            >
              <FileX className="h-4 w-4 mr-2" />
              Declarar Sem Movimento e Avisar Cliente
            </Button>
          )}

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
                        const clientName = detailInstance ? formatClientLabel(clientMap.get(detailInstance.client_id)) : '';
                        const refDate = detailInstance ? new Date(detailInstance.reference_month + 'T00:00:00') : new Date();
                        const competencia = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        const oblDueDay = detailObligation?.due_day;
                        const vencimento = oblDueDay
                          ? new Date(refDate.getFullYear(), refDate.getMonth(), oblDueDay).toLocaleDateString('pt-BR')
                          : '';
                        let recipient = '';
                        if (detailInstance && detailObligation) {
                          const [{ data: cli }, { data: deptContacts }] = await Promise.all([
                            supabase.from('clients').select('contact_email').eq('id', detailInstance.client_id).single(),
                            supabase.from('client_department_contacts').select('contact_email').eq('client_id', detailInstance.client_id).eq('department_id', detailObligation.department_id),
                          ]);
                          const deptEmails = (deptContacts || [])
                            .map((d: any) => (d.contact_email || '').trim())
                            .filter((e: string) => !!e);
                          recipient = deptEmails.length > 0 ? deptEmails.join(', ') : (cli?.contact_email || '');
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteInstanceId} onOpenChange={open => { if (!open) setDeleteInstanceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obrigação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta obrigação? Todas as atividades e arquivos associados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteInstance} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Bar */}
      {selectedInstanceIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedInstanceIds.size} selecionado(s)</span>
          <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowBulkCompleteConfirm(true)}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Concluir selecionados
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Excluir selecionados
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedInstanceIds.size} obrigação(ões)</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedInstanceIds.size} obrigação(ões)? Todas as atividades e arquivos associados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelectedInstances} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir {selectedInstanceIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Complete Confirmation */}
      <AlertDialog open={showBulkCompleteConfirm} onOpenChange={setShowBulkCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir {selectedInstanceIds.size} obrigação(ões)</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja concluir {selectedInstanceIds.size} obrigação(ões) selecionada(s)? Todas as atividades serão marcadas como concluídas automaticamente, sem anexos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={quickCompleteSelectedInstances} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Concluir {selectedInstanceIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sem Movimento Confirmation */}
      <AlertDialog open={!!semMovInstanceId} onOpenChange={open => { if (!open && !semMovLoading) setSemMovInstanceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declarar Sem Movimento</AlertDialogTitle>
            <AlertDialogDescription>
              Será transmitida ao SERPRO uma declaração PGDAS-D <strong>sem movimento</strong> para esta competência e enviada uma mensagem via WhatsApp ao cliente informando que o Simples Nacional foi declarado sem movimentação. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={semMovLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={semMovLoading}
              onClick={(e) => { e.preventDefault(); if (semMovInstanceId) handleSemMovimento(semMovInstanceId); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {semMovLoading ? (<><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>) : 'Confirmar e Enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskEditDialog
        open={editingTaskId !== null}
        onOpenChange={(v) => { if (!v) setEditingTaskId(null); }}
        taskId={editingTaskId}
        onSaved={() => loadData()}
      />
    </div>
  );
}

import { useState as _useState } from 'react';
import Documents from './Documents';
import Tasks from './Tasks';
import { FileText as _FileTextIcon, CheckSquare as _CheckSquareIcon, CalendarDays as _CalendarDaysIcon } from 'lucide-react';
import { Button as _ToggleButton } from '@/components/ui/button';

export default function CalendarView() {
  const [view, setView] = _useState<'calendar' | 'documents' | 'tasks'>('calendar');
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <_ToggleButton
          variant={view === 'calendar' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('calendar')}
        >
          <_CalendarDaysIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Calendário</span>
        </_ToggleButton>
        <_ToggleButton
          variant={view === 'documents' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('documents')}
        >
          <_FileTextIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Documentos</span>
        </_ToggleButton>
        <_ToggleButton
          variant={view === 'tasks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('tasks')}
        >
          <_CheckSquareIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Tarefas</span>
        </_ToggleButton>
      </div>
      {view === 'calendar' && <CalendarMain />}
      {view === 'documents' && <Documents />}
      {view === 'tasks' && <Tasks />}
    </div>
  );
}
