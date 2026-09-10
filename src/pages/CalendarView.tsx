import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, FileText, CheckSquare, MessageCircle, Mail, Upload, Download, CalendarDays, Building2, ListChecks, Filter, Clock, Trash2, Check, ChevronsUpDown, X, AlertTriangle, Undo2, FileX, Loader2, PauseCircle, PlayCircle, Plus, BarChart3, Search, Bell, CircleHelp, SlidersHorizontal } from 'lucide-react';
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
import { TimeTracker } from '@/components/time-tracking/TimeTracker';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';

const tabListClass =
  "w-full justify-start gap-1 sm:gap-4 bg-transparent p-0 h-auto border-b border-border rounded-none overflow-x-auto flex-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function ObligationTab({ value, label, count }: { value: string; label: string; count: number }) {
  return (
    <TabsTrigger
      value={value}
      className="relative shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      <span className="whitespace-nowrap">{label}</span>
      {count > 0 && (
        <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
      )}
    </TabsTrigger>
  );
}

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

function GaugeArc({
  value,
  gradientId,
  strokeWidth = 16,
  showValue = false,
  valueFontSize = 24,
  viewBoxWidth = 220,
  viewBoxHeight = 110,
  cx = 110,
  cy = 105,
  radius = 90,
}: {
  value: number;
  gradientId: string;
  strokeWidth?: number;
  showValue?: boolean;
  valueFontSize?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  cx?: number;
  cy?: number;
  radius?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const innerRadius = radius - strokeWidth / 2;
  const angleRad = Math.PI - (clamped * 1.8 * Math.PI) / 180;
  const pivotY = cy - valueFontSize * 1.05;
  const needleLen = innerRadius * 0.45;
  const tipX = cx + needleLen * Math.cos(angleRad);
  const tipY = pivotY - needleLen * Math.sin(angleRad);
  const hubRadius = strokeWidth / 2.4;
  const baseHalf = strokeWidth / 4.5;
  const ux = Math.cos(angleRad);
  const uy = -Math.sin(angleRad);
  const px = -uy * baseHalf;
  const py = ux * baseHalf;
  const base1X = cx + px;
  const base1Y = pivotY + py;
  const base2X = cx - px;
  const base2Y = pivotY - py;
  return (
    <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E23B2E" />
          <stop offset="22%" stopColor="#F0722A" />
          <stop offset="45%" stopColor="#F5C518" />
          <stop offset="70%" stopColor="#B9D336" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>
      </defs>
      <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" className="stroke-muted" />
      <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" stroke={`url(#${gradientId})`} />
      <path
        d={`M ${base1X} ${base1Y} L ${tipX} ${tipY} L ${base2X} ${base2Y} Z`}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={strokeWidth / 8}
        className="fill-foreground stroke-foreground"
      />
      <circle cx={cx} cy={pivotY} r={hubRadius} className="fill-foreground" />
      {showValue && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="auto" className="fill-calendar-navy font-calendarHeading font-bold" style={{ fontSize: valueFontSize }}>
          {clamped}%
        </text>
      )}
    </svg>
  );
}

function DepartmentGauge({ name, value, change }: { name: string; value: number; change: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const gradientId = `gauge-dep-${name.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="flex min-w-[200px] flex-1 flex-col items-center border-border px-3 py-2 lg:border-l first:border-l-0">
      <div className="relative h-[95px] w-[180px]" role="img" aria-label={`${name}: ${clamped}%`}>
        <GaugeArc value={clamped} gradientId={gradientId} strokeWidth={18} showValue valueFontSize={28} />
      </div>
      <p className="mt-1 max-w-[145px] truncate text-center font-calendarHeading text-sm font-semibold text-calendar-navy">{name}</p>
      <p className={`mt-1 text-[10px] font-semibold ${change >= 0 ? 'text-calendar-green' : 'text-calendar-red'}`}>
        {change >= 0 ? '▲ +' : '▼ '}{change}% <span className="font-normal text-muted-foreground">vs. mês anterior</span>
      </p>
    </div>
  );
}

function OfficeGauge({ value, change }: { value: number; change: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[120px] w-[240px] md:h-[140px] md:w-[280px]" role="img" aria-label={`Desempenho geral da operação: ${clamped}%`}>
        <GaugeArc value={clamped} gradientId="gauge-office" strokeWidth={20} showValue valueFontSize={34} />
      </div>
      <p className={`mt-1.5 text-xs font-semibold ${change >= 0 ? 'text-calendar-green' : 'text-calendar-red'}`}>
        {change >= 0 ? '▲ +' : '▼ '}{change}% <span className="font-normal text-muted-foreground">vs. mês anterior</span>
      </p>
    </div>
  );
}

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
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
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
  const [dayOverduePage, setDayOverduePage] = useState(1);
  const [monthOverduePage, setMonthOverduePage] = useState(1);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [headerSearch, setHeaderSearch] = useState('');

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
    const previousMonthDate = new Date(y, m - 1, 1);
    const monthStart = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
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

  function isOverdueEvent(instanceId: string, obligationId: string): boolean {
    if (isInstanceCompleted(instanceId, obligationId)) return false;
    const dueDate = getInstanceDueDate(instanceId);
    if (!dueDate) return false;
    return format(new Date(), 'yyyy-MM-dd') > dueDate;
  }

  function getOverdueDays(instanceId: string): number | null {
    const dueDate = getInstanceDueDate(instanceId);
    if (!dueDate) return null;
    const today = parseISO(format(new Date(), 'yyyy-MM-dd'));
    const diff = Math.floor((today.getTime() - parseISO(dueDate).getTime()) / (1000 * 60 * 60 * 24));
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
  const dayEventsOverdue = dayEventsPending
    .filter(ev => isOverdueEvent(ev.instanceId, ev.obligationId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const dayOverdueTotalPages = Math.ceil(dayEventsOverdue.length / DAY_ITEMS_PER_PAGE);
  const paginatedDayOverdue = dayEventsOverdue.slice((dayOverduePage - 1) * DAY_ITEMS_PER_PAGE, dayOverduePage * DAY_ITEMS_PER_PAGE);
  const monthEventsOverdue = monthEventsPending
    .filter(ev => isOverdueEvent(ev.instanceId, ev.obligationId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthOverdueTotalPages = Math.ceil(monthEventsOverdue.length / ITEMS_PER_PAGE);
  const paginatedMonthOverdue = monthEventsOverdue.slice((monthOverduePage - 1) * ITEMS_PER_PAGE, monthOverduePage * ITEMS_PER_PAGE);

  // Dialog progress
  const dialogProgress = detailInstance
    ? getInstanceProgress(detailInstance.id, detailInstance.obligation_id)
    : { completed: 0, total: 0, percent: 0 };

  const dashboardStats = useMemo(() => {
    const calculate = (targetYear: number, targetMonth: number) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const monthPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-`;
      const hols = getHolidays(targetYear);
      let todo = 0;
      let afterAlert = 0;
      let afterTarget = 0;
      let overdue = 0;
      let doneOnTime = 0;
      let doneLate = 0;
      let dueToday = 0;

      const makeDate = (day: number | null, refMonth: string) => {
        if (!day) return null;
        const rd = new Date(refMonth + 'T00:00:00');
        const raw = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return previousBusinessDay(raw, hols);
      };

      for (const inst of instances) {
        if (!inst.reference_month.startsWith(monthPrefix) && !inst.due_date?.startsWith(monthPrefix)) continue;
        const obl = oblMap.get(inst.obligation_id);
        if (!obl) continue;
        if (filterDept !== 'all' && obl.department_id !== filterDept) continue;
        if (filterClient !== 'all' && inst.client_id !== filterClient) continue;
        if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;
        if (filterLateDeliveries && !isInstanceLateDelivery(inst.id, inst.obligation_id)) continue;

        const isQuarterly = obl.recurrence === 'trimestral';
        const alertDate = isQuarterly ? null : makeDate(obl.alert_day, inst.reference_month);
        const targetDate = isQuarterly ? null : makeDate(obl.target_day, inst.reference_month);
        const dueDate = inst.due_date ?? makeDate(obl.due_day, inst.reference_month);
        const completed = isInstanceCompleted(inst.id, inst.obligation_id);

        if (completed) {
          if (isInstanceLateDelivery(inst.id, inst.obligation_id)) doneLate++;
          else doneOnTime++;
        } else if (dueDate && todayStr > dueDate) overdue++;
        else if (dueDate && todayStr === dueDate) dueToday++;
        else if (targetDate && todayStr >= targetDate) afterTarget++;
        else if (alertDate && todayStr >= alertDate) afterAlert++;
        else todo++;
      }

      const completed = doneOnTime + doneLate;
      const toDo = todo + afterAlert + afterTarget + dueToday;
      const total = toDo + overdue + completed;
      return {
        toDo,
        overdue,
        completed,
        doneOnTime,
        doneLate,
        dueToday,
        total,
        performance: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    };

    const current = calculate(year, month);
    const previousDate = new Date(year, month - 1, 1);
    const previous = calculate(previousDate.getFullYear(), previousDate.getMonth());
    return { current, previous, change: current.performance - previous.performance };
  }, [instances, completions, activities, oblMap, filterDept, filterClient, filterObligation, filterLateDeliveries, year, month]);

  const departmentPerformance = useMemo(() => {
    const calculateForDepartment = (departmentId: string, targetYear: number, targetMonth: number) => {
      const prefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-`;
      let completed = 0;
      let total = 0;
      for (const inst of instances) {
        if (!inst.reference_month.startsWith(prefix) && !inst.due_date?.startsWith(prefix)) continue;
        const obligation = oblMap.get(inst.obligation_id);
        if (!obligation || obligation.department_id !== departmentId) continue;
        if (filterClient !== 'all' && inst.client_id !== filterClient) continue;
        if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;
        if (filterLateDeliveries && !isInstanceLateDelivery(inst.id, inst.obligation_id)) continue;
        total++;
        if (isInstanceCompleted(inst.id, inst.obligation_id)) completed++;
      }
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    };
    const previousDate = new Date(year, month - 1, 1);
    const departmentOrder = ['fiscal', 'contabil', 'pessoal'];
    const visibleDepartments = departments
      .filter(department => filterDept === 'all' || department.id === filterDept)
      .filter(department => departmentOrder.some(term => department.name.toLocaleLowerCase('pt-BR').includes(term)))
      .sort((a, b) => {
        const aIndex = departmentOrder.findIndex(term => a.name.toLocaleLowerCase('pt-BR').includes(term));
        const bIndex = departmentOrder.findIndex(term => b.name.toLocaleLowerCase('pt-BR').includes(term));
        return aIndex - bIndex;
      })
      .slice(0, 5);
    return visibleDepartments.map(department => {
      const value = calculateForDepartment(department.id, year, month);
      const previous = calculateForDepartment(department.id, previousDate.getFullYear(), previousDate.getMonth());
      const displayName = department.name.toLocaleLowerCase('pt-BR').includes('sucesso') ? 'Atendimento' : department.name.replace(/^Depto\s+/i, '');
      return { ...department, name: displayName, value, change: value - previous };
    });
  }, [departments, filterDept, filterClient, filterObligation, filterLateDeliveries, instances, oblMap, completions, activities, year, month]);

  const activeFilters = [filterDept, filterClient, filterObligation].filter(value => value !== 'all').length + (filterLateDeliveries ? 1 : 0);

  function submitHeaderSearch() {
    const term = headerSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return;
    const client = clients.find(item => formatClientLabel(item).toLocaleLowerCase('pt-BR').includes(term));
    if (client) {
      setFilterClient(client.id);
      setSelectedDay(null);
      return;
    }
    const obligation = obligations.find(item => item.name.toLocaleLowerCase('pt-BR').includes(term));
    if (obligation) {
      setFilterObligation(obligation.id);
      setSelectedDay(null);
      return;
    }
    toast({ title: 'Nenhum resultado encontrado', description: 'Busque pelo nome da empresa ou obrigação.' });
  }

  function exportCalendarReport() {
    const stats = dashboardStats.current;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Relatório de obrigações', 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Período: ${monthNames[month]} de ${year}`, 14, 26);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
    doc.setDrawColor(220);
    doc.line(14, 38, 283, 38);
    const items = [
      ['A fazer', stats.toDo],
      ['Atrasadas', stats.overdue],
      ['Concluídas', stats.completed],
      ['Fora do prazo', stats.doneLate],
      ['Desempenho geral', `${stats.performance}%`],
    ];
    items.forEach(([label, value], index) => {
      const x = 14 + index * 53.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(label), x, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(String(value), x, 62);
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Os totais respeitam os filtros selecionados na tela.', 14, 78);
    doc.save(`Obrigacoes_${year}-${String(month + 1).padStart(2, '0')}.pdf`);
  }

  return (
    <div className="space-y-5 font-calendarBody">
      <section className="space-y-3">
        <div className="hidden h-11 items-center justify-between border-b border-border pb-2 lg:flex">
          <div className="relative w-[430px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={headerSearch}
              onChange={event => setHeaderSearch(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') submitHeaderSearch(); }}
              placeholder="Buscar cliente, CNPJ ou obrigação..."
              className="h-8 rounded-sm bg-card pl-9 pr-9 text-xs"
            />
            {headerSearch && (
              <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8" onClick={() => setHeaderSearch('')} aria-label="Limpar busca">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-calendar-red" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ajuda"><CircleHelp className="h-4 w-4" /></Button>
            <div className="h-6 w-px bg-border" />
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
              <AvatarFallback className="bg-calendar-orange-soft text-xs font-semibold text-calendar-orange">{profile?.full_name?.slice(0, 2).toUpperCase() || 'VH'}</AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="max-w-[150px] truncate text-xs font-semibold text-calendar-navy">{profile?.full_name || 'Equipe Vehub'}</p>
              <p className="text-[10px] text-muted-foreground">{profile?.job_title || (isAdmin ? 'Administrador' : 'Colaborador')}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium capitalize text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</p>
            <h1 className="mt-0.5 font-calendarHeading text-2xl font-bold text-calendar-navy">Bom dia, {profile?.full_name?.trim().split(/\s+/)[0] || 'Equipe'}!</h1>
            <p className="text-xs text-muted-foreground">Aqui está o panorama das suas obrigações e prazos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCalendarReport} className="h-9 gap-2 rounded-sm"><Download className="h-3.5 w-3.5" />Exportar</Button>
            {isAdmin && <Button size="sm" onClick={() => navigate('/obligations')} className="h-9 gap-2 rounded-sm bg-calendar-orange hover:bg-calendar-orange/90"><Plus className="h-3.5 w-3.5" />Nova obrigação</Button>}
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-3 xl:grid-cols-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
            {[
              { label: 'A fazer', value: dashboardStats.current.toDo, detail: dashboardStats.current.dueToday > 0 ? `${dashboardStats.current.dueToday} vencem hoje` : 'Em andamento', progress: dashboardStats.current.total ? Math.round((dashboardStats.current.toDo / dashboardStats.current.total) * 100) : 0, icon: ListChecks, tone: 'text-calendar-blue', surface: 'bg-calendar-blue-soft', progressTone: '[&>div]:bg-calendar-blue' },
              { label: 'Atrasadas', value: dashboardStats.current.overdue, detail: `Crítico • ${dashboardStats.current.overdue} vencida${dashboardStats.current.overdue === 1 ? '' : 's'}`, progress: dashboardStats.current.total ? Math.round((dashboardStats.current.overdue / dashboardStats.current.total) * 100) : 0, icon: AlertTriangle, tone: 'text-calendar-red', surface: 'bg-calendar-red-soft', progressTone: '[&>div]:bg-calendar-red' },
              { label: 'Concluídas', value: dashboardStats.current.completed, detail: `de ${dashboardStats.current.total} no período`, progress: dashboardStats.current.total ? Math.round((dashboardStats.current.completed / dashboardStats.current.total) * 100) : 0, icon: CheckSquare, tone: 'text-calendar-green', surface: 'bg-calendar-green-soft', progressTone: '[&>div]:bg-calendar-green' },
              { label: 'Fora do prazo', value: dashboardStats.current.doneLate, detail: 'Revisar e regularizar', progress: dashboardStats.current.total ? Math.round((dashboardStats.current.doneLate / dashboardStats.current.total) * 100) : 0, icon: Clock, tone: 'text-muted-foreground', surface: 'bg-muted', progressTone: '[&>div]:bg-muted-foreground/50' },
            ].map(item => (
              <Card key={item.label} className={`rounded-sm border-border shadow-none ${item.surface}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-background ${item.tone}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate font-calendarHeading text-xs font-bold ${item.tone}`}>{item.label}</p>
                      <p className="font-calendarHeading text-2xl font-bold leading-tight text-calendar-navy">{item.value}</p>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.detail}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={item.progress} className={`h-1.5 flex-1 rounded-sm ${item.progressTone}`} />
                    <span className={`w-8 text-right text-[10px] font-semibold ${item.tone}`}>{item.progress}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="flex h-full min-h-[230px] flex-col rounded-sm border-border shadow-none">
            <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4">
              <div className="flex items-start gap-2 self-start">
                <BarChart3 className="mt-0.5 h-5 w-5 text-calendar-orange" />
                <div>
                  <p className="font-calendarHeading text-lg font-bold text-calendar-navy">Desempenho geral da operação</p>
                  <p className="text-[11px] text-muted-foreground">Visão consolidada de todos os departamentos</p>
                </div>
              </div>
              <OfficeGauge value={dashboardStats.current.performance} change={dashboardStats.change} />
            </CardContent>
          </Card>
        </div>


        <Card className="rounded-sm shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-2.5">
                <BarChart3 className="mt-0.5 h-5 w-5 text-calendar-orange" />
                <div><h2 className="font-calendarHeading text-base font-bold text-calendar-navy">Desempenho geral dos departamentos</h2><p className="text-[11px] text-muted-foreground">Acompanhe o desempenho de cada departamento no cumprimento das obrigações.</p></div>
              </div>
              <Select value={`${year}-${month}`} onValueChange={value => { const [nextYear, nextMonth] = value.split('-').map(Number); setCurrentDate(new Date(nextYear, nextMonth, 1)); setSelectedDay(null); }}>
                <SelectTrigger className="h-8 w-[160px] rounded-sm text-xs"><CalendarDays className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index} value={`${year}-${index}`}>{monthNames[index]} {year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex overflow-x-auto px-2 py-2">
              {departmentPerformance.length > 0 ? departmentPerformance.map(department => <DepartmentGauge key={department.id} name={department.name} value={department.value} change={department.change} />) : <p className="w-full py-8 text-center text-sm text-muted-foreground">Nenhum departamento encontrado.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-2 rounded-sm border bg-card p-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <Select value={filterDept} onValueChange={v => { setFilterDept(v); setFilterObligation('all'); setSelectedDay(null); }}>
                  <SelectTrigger className="h-9 w-full rounded-sm text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
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
                      className="h-9 w-full justify-between rounded-sm text-xs font-normal"
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
                  <SelectTrigger className="h-9 w-full rounded-sm text-xs"><SelectValue placeholder="Obrigação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as obrigações</SelectItem>
                    {obligations
                      .filter(o => filterDept === 'all' || o.department_id === filterDept)
                      .map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={`${year}-${month}`} onValueChange={value => { const [nextYear, nextMonth] = value.split('-').map(Number); setCurrentDate(new Date(nextYear, nextMonth, 1)); setSelectedDay(null); }}>
                  <SelectTrigger className="h-9 w-full rounded-sm text-xs"><CalendarDays className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index} value={`${year}-${index}`}>{monthNames[index]} {year}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" className={`h-9 rounded-sm text-xs ${filterLateDeliveries ? 'border-calendar-orange text-calendar-orange' : ''}`} onClick={() => { setFilterLateDeliveries(value => !value); setSelectedDay(null); }}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />Filtros{activeFilters > 0 && <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 py-0 text-[10px]">{activeFilters}</Badge>}
                </Button>
        </div>
      </section>

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
                <TabsList className={`mb-4 ${tabListClass}`}>
                  <ObligationTab value="pending" label="A Fazer" count={dayEventsPending.length} />
                  <ObligationTab value="overdue" label="Atrasadas" count={dayEventsOverdue.length} />
                  <ObligationTab value="completed" label="Concluído" count={dayEventsCompleted.length} />
                </TabsList>
                {[
                  { key: 'pending', items: paginatedDayPending, allItems: dayEventsPending, page: dayPendingPage, totalPages: dayPendingTotalPages, total: dayEventsPending.length, setPage: setDayPendingPage },
                  { key: 'overdue', items: paginatedDayOverdue, allItems: dayEventsOverdue, page: dayOverduePage, totalPages: dayOverdueTotalPages, total: dayEventsOverdue.length, setPage: setDayOverduePage },
                  { key: 'completed', items: paginatedDayCompleted, allItems: dayEventsCompleted, page: dayCompletedPage, totalPages: dayCompletedTotalPages, total: dayEventsCompleted.length, setPage: setDayCompletedPage },
                ].map(tab => {
                  const allIds = tab.allItems.map(e => e.instanceId);
                  const allSelected = allIds.length > 0 && allIds.every(id => selectedInstanceIds.has(id));
                  return (
                  <TabsContent key={tab.key} value={tab.key}>
                    {tab.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-muted-foreground text-sm">{tab.key === 'pending' ? 'Nenhuma obrigação pendente' : tab.key === 'overdue' ? 'Nenhuma obrigação atrasada' : 'Nenhuma obrigação concluída'}</p>
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
                            const isOverdue = !completed && isOverdueEvent(ev.instanceId, ev.obligationId);
                            const overdueDays = isOverdue ? getOverdueDays(ev.instanceId) : null;
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
                                      : isOverdue
                                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
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
                                    <TimeTracker instanceId={ev.instanceId} />
                                    <Badge className={`${typeConfig[ev.type].color} text-white border-0 text-[10px]`}>
                                      {typeConfig[ev.type].label}
                                    </Badge>
                                    {isLateDelivery && (
                                      <Badge className="bg-orange-500 text-white border-0 text-[10px]">
                                        Fora do prazo
                                      </Badge>
                                    )}
                                    {isOverdue && (
                                      <Badge className="bg-red-600 text-white border-0 text-[10px]">
                                        {overdueDays ? `Atrasada • ${overdueDays}d` : 'Atrasada'}
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
                                    {!completed && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600" title="Aguardar" onClick={e => { e.stopPropagation(); setHoldReason(''); setHoldTarget([ev.instanceId]); }}>
                                        <PauseCircle className="h-3.5 w-3.5" />
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
              <TabsList className={`mb-4 ${tabListClass}`}>
                <ObligationTab value="pending" label="A fazer" count={monthEventsPending.length} />
                <ObligationTab value="overdue" label="Atrasadas" count={monthEventsOverdue.length} />
                <ObligationTab value="completed" label="Concluídas" count={monthEventsCompleted.length} />
                <ObligationTab value="late" label="Fora do prazo" count={monthEventsLate.length} />
                <ObligationTab value="hold" label="Aguardando" count={monthEventsHold.length} />
                <ObligationTab value="deleted" label="Excluídas" count={deletedMonthEvents.length} />
                <ObligationTab value="suspended" label="Suspensos" count={monthEventsSuspended.length} />
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
                                 <TimeTracker instanceId={ev.instanceId} />
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

              <TabsContent value="overdue">
                {monthEventsOverdue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma obrigação atrasada</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const allIds = monthEventsOverdue.map(e => e.instanceId);
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
                      {paginatedMonthOverdue.map((ev, idx) => {
                        const progress = getInstanceProgress(ev.instanceId, ev.obligationId);
                        const isSelected = selectedInstanceIds.has(ev.instanceId);
                        const obl = oblMap.get(ev.obligationId);
                        const isDasSn = obl?.system_code === 'das-simples-nacional';
                        const overdueDays = getOverdueDays(ev.instanceId);
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailInstanceId(ev.instanceId)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(ev.instanceId)}
                                onClick={e => e.stopPropagation()}
                                className="shrink-0"
                              />
                              <div className="w-14 shrink-0 text-sm font-semibold text-red-600 dark:text-red-400">
                                {ev.date.split('-').reverse().slice(0, 2).join('/')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{ev.obligationName} | {ev.competenceLabel}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  <Building2 className="h-3 w-3 inline mr-1" />{ev.clientName}
                                </p>
                              </div>
                               <div className="flex items-center gap-1 shrink-0">
                                 <TimeTracker instanceId={ev.instanceId} />
                                 <Badge className="bg-red-600 text-white border-0 text-[10px]">
                                  {overdueDays ? `${overdueDays} ${overdueDays === 1 ? 'dia' : 'dias'} de atraso` : 'Atrasada'}
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
                    <PaginationBlock page={monthOverduePage} totalPages={monthOverdueTotalPages} total={monthEventsOverdue.length} onPageChange={setMonthOverduePage} />
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
                                 <TimeTracker instanceId={ev.instanceId} />
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
                                 <TimeTracker instanceId={ev.instanceId} />
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
                                 <TimeTracker instanceId={ev.instanceId} />
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

          {detailInstance && <TimeTracker instanceId={detailInstance.id} compact={false} />}

          {detailInstance && (
            detailInstance.on_hold ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap">
                  <strong>Aguardando:</strong> {detailInstance.hold_reason}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setHoldReason(detailInstance.hold_reason || ''); setHoldTarget([detailInstance.id]); }}>
                    Editar motivo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resumeInstance(detailInstance.id)}>
                    <PlayCircle className="h-4 w-4 mr-1" /> Retomar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
                onClick={() => { setHoldReason(''); setHoldTarget([detailInstance.id]); }}
              >
                <PauseCircle className="h-4 w-4 mr-2" />
                Aguardar
              </Button>
            )
          )}

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
          <Button variant="outline" size="sm" onClick={() => { setHoldReason(''); setHoldTarget(Array.from(selectedInstanceIds)); }}>
            <PauseCircle className="h-3.5 w-3.5 mr-1" />
            Aguardar selecionadas
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

      <Dialog open={holdTarget !== null} onOpenChange={(v) => { if (!v) { setHoldTarget(null); setHoldReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Colocar em espera</DialogTitle>
            <DialogDescription>
              {holdTarget && holdTarget.length > 1
                ? `${holdTarget.length} obrigações irão para a aba Aguardando.`
                : 'A obrigação irá para a aba Aguardando até ser retomada.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo <span className="text-destructive">*</span></label>
            <Textarea
              value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              placeholder="Descreva o motivo pelo qual esta obrigação não pode ser concluída agora"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHoldTarget(null); setHoldReason(''); }}>Cancelar</Button>
            <Button onClick={confirmHold} disabled={!holdReason.trim() || holdSaving}>
              {holdSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PauseCircle className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
