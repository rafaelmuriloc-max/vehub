/* obligations-v2 */
import { useState, useEffect, useMemo } from 'react';
import { getHolidays, previousBusinessDay } from '@/lib/holidays';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Pencil, Trash2, ClipboardList, FileText, CheckSquare, MessageCircle, Mail,
  ChevronDown, ChevronRight, Zap, Copy, Users, Search, CalendarDays,
} from 'lucide-react';

type Department = { id: string; name: string };
type Obligation = { id: string; department_id: string; name: string; description: string | null; recurrence: string; due_day: number | null; target_day: number | null; alert_day: number | null; competence_rule: string; is_tax: boolean; tax_sphere: string | null; assignment_mode: string; segment_filters: any; annual_month: number | null; is_retention: boolean; retention_tax_type: string | null; system_code: string | null };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; order: number; document_type_id: string | null; auto_start: boolean; email_department_id: string | null; email_subject: string | null; email_body: string | null; whatsapp_template_name: string | null; whatsapp_message_body: string | null; whatsapp_button_url: string | null; whatsapp_has_document_header: boolean };
type DocumentType = { id: string; name: string };
type Client = { id: string; company_name: string; document: string | null; tax_regime: string | null; payroll_type: string | null; address: string | null; status: string };
type ClientDeptObligation = { id: string; client_id: string; department_id: string; obligation_id: string };

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};
const activityTypeLabels: Record<string, string> = {
  document: 'Documento', checklist: 'Checklist', whatsapp: 'WhatsApp', email: 'E-mail',
};

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const taxRegimeOptions = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
];

export default function Obligations() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientDeptObligations, setClientDeptObligations] = useState<ClientDeptObligation[]>([]);

  const [obligationOpen, setObligationOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [obligationForm, setObligationForm] = useState({
    name: '', description: '', department_id: '', recurrence: 'mensal',
    alert_day: '' as string, target_day: '' as string, due_day: '' as string,
    competence_rule: 'current', is_tax: false, tax_sphere: '',
    assignment_mode: 'manual',
    segment_payroll_filter: '' as string,
    segment_tax_regimes: [] as string[],
    segment_city: '',
    annual_month: '' as string,
    is_retention: false, retention_tax_type: '',
    system_code: '' as string,
  });
  const [manualSelectedClients, setManualSelectedClients] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  // Generation state
  const [generateStartMonth, setGenerateStartMonth] = useState('');
  const [generateStartYear, setGenerateStartYear] = useState('');
  const [generating, setGenerating] = useState(false);

  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ title: '', type: 'checklist', description: '', order: 0, obligation_id: '', document_type_id: '', auto_start: false, email_department_id: '', email_subject: '', email_body: '', whatsapp_template_name: '', whatsapp_message_body: '', whatsapp_button_url: '', whatsapp_has_document_header: false });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterFreq, setFilterFreq] = useState('all');
  const [expandedObligation, setExpandedObligation] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dRes, oRes, aRes, dtRes, cRes, cdoRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('*').order('name'),
      supabase.from('obligation_activities').select('*').order('order'),
      supabase.from('document_types').select('id, name').order('name'),
      supabase.from('clients').select('id, company_name, document, tax_regime, payroll_type, address, status').eq('status', 'active').order('company_name'),
      supabase.from('client_department_obligations').select('*'),
    ]);
    if (dRes.data) setDepartments(dRes.data);
    if (oRes.data) setObligations(oRes.data as Obligation[]);
    if (aRes.data) setActivities(aRes.data as Activity[]);
    if (dtRes.data) setDocumentTypes(dtRes.data as DocumentType[]);
    if (cRes.data) setClients(cRes.data as Client[]);
    if (cdoRes.data) setClientDeptObligations(cdoRes.data as ClientDeptObligation[]);
  }

  // ---- Segment filtering ----
  function getFilteredClients(filters: { payroll_filter: string; tax_regimes: string[]; city: string }) {
    return clients.filter(c => {
      if (filters.payroll_filter === 'all' && !c.payroll_type) return false;
      if (filters.payroll_filter === 'normal' && c.payroll_type !== 'normal') return false;
      if (filters.payroll_filter === 'pro_labore' && c.payroll_type !== 'pro_labore') return false;
      if (filters.tax_regimes.length > 0 && (!c.tax_regime || !filters.tax_regimes.includes(c.tax_regime))) return false;
      if (filters.city && c.address && !c.address.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.city && !c.address) return false;
      return true;
    });
  }

  const segmentPreviewClients = useMemo(() => {
    if (obligationForm.assignment_mode === 'all') return clients;
    if (obligationForm.assignment_mode === 'segment') {
      return getFilteredClients({
        payroll_filter: obligationForm.segment_payroll_filter,
        tax_regimes: obligationForm.segment_tax_regimes,
        city: obligationForm.segment_city,
      });
    }
    return clients.filter(c => manualSelectedClients.includes(c.id));
  }, [obligationForm.assignment_mode, obligationForm.segment_payroll_filter, obligationForm.segment_tax_regimes, obligationForm.segment_city, manualSelectedClients, clients]);

  const filteredManualClients = useMemo(() => {
    if (!clientSearch) return clients;
    const s = clientSearch.toLowerCase();
    return clients.filter(c => c.company_name.toLowerCase().includes(s) || (c.document && c.document.includes(s)));
  }, [clients, clientSearch]);

  // ---- Obligation CRUD ----
  function openNewObligation() {
    setEditingObligation(null);
    setObligationForm({ name: '', description: '', department_id: departments[0]?.id || '', recurrence: 'mensal', alert_day: '', target_day: '', due_day: '', competence_rule: 'current', is_tax: false, tax_sphere: '', assignment_mode: 'manual', segment_payroll_filter: '', segment_tax_regimes: [], segment_city: '', annual_month: '', is_retention: false, retention_tax_type: '', system_code: '' });
    setManualSelectedClients([]);
    setGenerateStartMonth('');
    setGenerateStartYear('');
    setObligationOpen(true);
  }
  function openEditObligation(o: Obligation) {
    setEditingObligation(o);
    const filters = (o.segment_filters && typeof o.segment_filters === 'object') ? o.segment_filters : {};
    setObligationForm({
      name: o.name, description: o.description || '', department_id: o.department_id,
      recurrence: o.recurrence, alert_day: o.alert_day?.toString() || '',
      target_day: o.target_day?.toString() || '', due_day: o.due_day?.toString() || '',
      competence_rule: o.competence_rule || 'current',
      is_tax: o.is_tax || false, tax_sphere: o.tax_sphere || '',
      assignment_mode: o.assignment_mode || 'manual',
      segment_payroll_filter: filters.payroll_type || (filters.has_payroll ? 'all' : ''),
      segment_tax_regimes: filters.tax_regime || [],
      segment_city: filters.city || '',
      annual_month: o.annual_month?.toString() || '',
      is_retention: o.is_retention || false, retention_tax_type: o.retention_tax_type || '',
      system_code: o.system_code || '',
    });
    // Load manual selections
    const linked = clientDeptObligations.filter(cdo => cdo.obligation_id === o.id).map(cdo => cdo.client_id);
    setManualSelectedClients(linked);
    setGenerateStartMonth('');
    setGenerateStartYear('');
    setObligationOpen(true);
  }

  async function saveObligation(e: React.FormEvent) {
    e.preventDefault();
    const segmentFilters = obligationForm.assignment_mode === 'segment' ? {
      payroll_type: obligationForm.segment_payroll_filter || undefined,
      tax_regime: obligationForm.segment_tax_regimes.length > 0 ? obligationForm.segment_tax_regimes : undefined,
      city: obligationForm.segment_city || undefined,
    } : {};

    const payload: any = {
      name: obligationForm.name,
      description: obligationForm.description || null,
      department_id: obligationForm.department_id,
      recurrence: obligationForm.recurrence,
      alert_day: obligationForm.alert_day ? Number(obligationForm.alert_day) : null,
      target_day: obligationForm.target_day ? Number(obligationForm.target_day) : null,
      due_day: obligationForm.due_day ? Number(obligationForm.due_day) : null,
      competence_rule: ['mensal', 'anual', 'trimestral'].includes(obligationForm.recurrence) ? obligationForm.competence_rule : 'current',
      annual_month: obligationForm.recurrence === 'anual' && obligationForm.annual_month ? Number(obligationForm.annual_month) : null,
      is_tax: obligationForm.is_tax,
      tax_sphere: obligationForm.is_tax && obligationForm.tax_sphere ? obligationForm.tax_sphere : null,
      is_retention: obligationForm.is_tax && obligationForm.is_retention,
      retention_tax_type: obligationForm.is_tax && obligationForm.is_retention && obligationForm.retention_tax_type ? obligationForm.retention_tax_type : null,
      assignment_mode: obligationForm.is_retention ? 'retention_auto' : obligationForm.assignment_mode,
      segment_filters: segmentFilters,
      system_code: obligationForm.system_code || null,
    };

    let obligationId = editingObligation?.id;

    if (editingObligation) {
      const { error } = await supabase.from('obligations').update(payload).eq('id', editingObligation.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('obligations').insert(payload).select().single();
      if (error || !data) { toast({ title: 'Erro', description: error?.message, variant: 'destructive' }); return; }
      obligationId = data.id;
    }

    // Sync client_department_obligations
    if (obligationId && !(obligationForm.is_tax && obligationForm.is_retention)) {
      await syncClientObligations(obligationId, obligationForm.department_id);
    }

    toast({ title: editingObligation ? 'Atualizado' : 'Criado' });
    setObligationOpen(false);
    loadAll();
  }

  async function syncClientObligations(obligationId: string, departmentId: string) {
    // Delete existing links for this obligation
    await supabase.from('client_department_obligations').delete().eq('obligation_id', obligationId);

    let targetClients: string[] = [];
    if (obligationForm.assignment_mode === 'all') {
      targetClients = clients.map(c => c.id);
    } else if (obligationForm.assignment_mode === 'segment') {
      targetClients = segmentPreviewClients.map(c => c.id);
    } else {
      targetClients = manualSelectedClients;
    }

    if (targetClients.length > 0) {
      const rows = targetClients.map(clientId => ({
        client_id: clientId,
        department_id: departmentId,
        obligation_id: obligationId,
      }));
      await supabase.from('client_department_obligations').insert(rows);
    }
  }

  async function generateObligationInstances(obligationId: string) {
    const ob = obligations.find(o => o.id === obligationId);
    const isAnnual = ob?.recurrence === 'anual';

    if (isAnnual) {
      if (!generateStartYear) return;
    } else {
      if (!generateStartMonth) return;
    }

    const linked = clientDeptObligations.filter(cdo => cdo.obligation_id === obligationId);
    let clientIds = linked.map(cdo => cdo.client_id);
    if (clientIds.length === 0) {
      clientIds = segmentPreviewClients.map(c => c.id);
    }

    if (clientIds.length === 0) {
      toast({ title: 'Nenhuma empresa vinculada', variant: 'destructive' });
      return;
    }

    setGenerating(true);

    const { data: existing } = await supabase
      .from('obligation_instances')
      .select('client_id, reference_month')
      .eq('obligation_id', obligationId);

    const existingSet = new Set((existing || []).map(e => `${e.client_id}_${e.reference_month}`));

    const rows: any[] = [];

    if (isAnnual && ob.annual_month) {
      const calendarYear = Number(generateStartYear);
      // If competence is 'previous', the obligation is delivered in the NEXT year
      const instanceYear = ob.competence_rule === 'previous' ? calendarYear + 1 : calendarYear;
      const month = ob.annual_month;
      const refDate = `${instanceYear}-${String(month).padStart(2, '0')}-01`;
      const rawDueDate = ob.due_day ? `${instanceYear}-${String(month).padStart(2, '0')}-${String(Math.min(ob.due_day, 28)).padStart(2, '0')}` : null;
      const dueDate = rawDueDate ? previousBusinessDay(rawDueDate, getHolidays(instanceYear)) : null;

      for (const clientId of clientIds) {
        const key = `${clientId}_${refDate}`;
        if (!existingSet.has(key)) {
          rows.push({
            obligation_id: obligationId,
            client_id: clientId,
            reference_month: refDate,
            due_date: dueDate,
            status: 'pending',
          });
        }
      }
    } else {
      const startMonth = Number(generateStartMonth);
      const year = new Date().getFullYear();
      const monthsToGenerate = Array.from({ length: 12 - startMonth + 1 }, (_, i) => startMonth + i);

      for (const month of monthsToGenerate) {
        const refDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const rawDueDate = ob?.due_day ? `${year}-${String(month).padStart(2, '0')}-${String(Math.min(ob.due_day, 28)).padStart(2, '0')}` : null;
        const dueDate = rawDueDate ? previousBusinessDay(rawDueDate, getHolidays(year)) : null;

        for (const clientId of clientIds) {
          const key = `${clientId}_${refDate}`;
          if (!existingSet.has(key)) {
            rows.push({
              obligation_id: obligationId,
              client_id: clientId,
              reference_month: refDate,
              due_date: dueDate,
              status: 'pending',
            });
          }
        }
      }
    }

    if (rows.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase.from('obligation_instances').insert(batch);
        if (error) {
          toast({ title: 'Erro ao gerar', description: error.message, variant: 'destructive' });
          setGenerating(false);
          return;
        }
      }
      toast({ title: `${rows.length} instâncias geradas com sucesso` });
    } else {
      toast({ title: 'Todas as instâncias já existem' });
    }

    setGenerating(false);
  }

  async function deleteObligation(id: string) {
    const { error } = await supabase.from('obligations').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Excluído' });
    loadAll();
  }

  // ---- Activity CRUD ----
  function openNewActivity(obligationId: string) {
    setEditingActivity(null);
    setActivityForm({ title: '', type: 'checklist', description: '', order: activities.filter(a => a.obligation_id === obligationId).length, obligation_id: obligationId, document_type_id: '', auto_start: false, email_department_id: '', email_subject: '', email_body: '', whatsapp_template_name: '', whatsapp_message_body: '', whatsapp_button_url: '', whatsapp_has_document_header: false });
    setActivityOpen(true);
  }
  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setActivityForm({ title: a.title, type: a.type, description: a.description || '', order: a.order, obligation_id: a.obligation_id, document_type_id: a.document_type_id || '', auto_start: a.auto_start, email_department_id: a.email_department_id || '', email_subject: a.email_subject || '', email_body: a.email_body || '', whatsapp_template_name: a.whatsapp_template_name || '', whatsapp_message_body: a.whatsapp_message_body || '', whatsapp_button_url: a.whatsapp_button_url || '', whatsapp_has_document_header: a.whatsapp_has_document_header || false });
    setActivityOpen(true);
  }
  async function saveActivity(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { title: activityForm.title, type: activityForm.type as any, description: activityForm.description || null, order: activityForm.order, obligation_id: activityForm.obligation_id, auto_start: activityForm.auto_start };
    if (activityForm.type === 'document' && activityForm.document_type_id) {
      payload.document_type_id = activityForm.document_type_id;
    } else {
      payload.document_type_id = null;
    }
    if (activityForm.type === 'email') {
      payload.email_department_id = activityForm.email_department_id || null;
      payload.email_subject = activityForm.email_subject || null;
      payload.email_body = activityForm.email_body || null;
    } else {
      payload.email_department_id = null;
      payload.email_subject = null;
      payload.email_body = null;
    }
    if (activityForm.type === 'whatsapp') {
      payload.whatsapp_template_name = activityForm.whatsapp_template_name || null;
      payload.whatsapp_message_body = activityForm.whatsapp_message_body || null;
      payload.whatsapp_button_url = activityForm.whatsapp_button_url || null;
      payload.whatsapp_has_document_header = activityForm.whatsapp_has_document_header;
    } else {
      payload.whatsapp_template_name = null;
      payload.whatsapp_message_body = null;
      payload.whatsapp_button_url = null;
      payload.whatsapp_has_document_header = false;
    }
    const { error } = editingActivity
      ? await supabase.from('obligation_activities').update(payload).eq('id', editingActivity.id)
      : await supabase.from('obligation_activities').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingActivity ? 'Atualizado' : 'Criado' });
    setActivityOpen(false);
    loadAll();
  }
  async function deleteActivity(id: string) {
    const { error } = await supabase.from('obligation_activities').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    loadAll();
  }

  async function cloneObligation(ob: Obligation) {
    const { id, ...rest } = ob;
    const { data: newOb, error } = await supabase.from('obligations').insert({ ...rest, name: `${ob.name} (cópia)` } as any).select().single();
    if (error || !newOb) { toast({ title: 'Erro ao clonar', description: error?.message, variant: 'destructive' }); return; }
    const obActivities = activities.filter(a => a.obligation_id === ob.id);
    if (obActivities.length > 0) {
      const cloned = obActivities.map(({ id: _id, obligation_id: _oid, ...attrs }) => ({ ...attrs, type: attrs.type as any, obligation_id: newOb.id }));
      await supabase.from('obligation_activities').insert(cloned);
    }
    toast({ title: 'Obrigação clonada com sucesso' });
    loadAll();
  }

  function getDeptName(id: string) { return departments.find(d => d.id === id)?.name || ''; }
  function getDocTypeName(id: string | null) { if (!id) return ''; return documentTypes.find(d => d.id === id)?.name || ''; }

  const groupedByDept = departments.map(dept => ({
    dept,
    items: obligations.filter(o => o.department_id === dept.id),
  })).filter(g => g.items.length > 0);

  function getLinkedCount(obligationId: string) {
    return clientDeptObligations.filter(cdo => cdo.obligation_id === obligationId).length;
  }


  const deptColorMap: Record<string, string> = {};
  const defaultColors = ['#6366F1', '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];
  departments.forEach((d, i) => {
    const name = d.name.toLowerCase();
    if (name.includes('fiscal')) deptColorMap[d.id] = '#6366F1';
    else if (name.includes('pessoal')) deptColorMap[d.id] = '#0EA5E9';
    else deptColorMap[d.id] = defaultColors[i % defaultColors.length];
  });

  const filteredGrouped = groupedByDept
    .filter(g => filterDept === 'all' || g.dept.id === filterDept)
    .map(g => ({
      ...g,
      items: g.items.filter(ob => {
        if (searchTerm && !ob.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterFreq !== 'all' && ob.recurrence !== filterFreq) return false;
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Obrigações</h1>
          <p className="text-sm text-muted-foreground">Cadastro de obrigações e atividades por departamento</p>
        </div>
        {admin && <Button onClick={openNewObligation} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Nova Obrigação</Button>}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-[10px] flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar obrigação..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white rounded-[10px] outline-none transition-all"
            style={{ border: '1px solid #E3E8F2' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#E8710A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,113,10,.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E3E8F2'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
        <div style={{ width: 1, height: 28, background: '#E3E8F2' }} />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="h-10 px-3 text-sm bg-white rounded-[10px] outline-none min-w-[150px] appearance-none cursor-pointer"
          style={{ border: '1px solid #E3E8F2', color: '#64748B' }}
        >
          <option value="all">Todos os deptos</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filterFreq}
          onChange={e => setFilterFreq(e.target.value)}
          className="h-10 px-3 text-sm bg-white rounded-[10px] outline-none min-w-[150px] appearance-none cursor-pointer"
          style={{ border: '1px solid #E3E8F2', color: '#64748B' }}
        >
          <option value="all">Todas frequências</option>
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="quinzenal">Quinzenal</option>
          <option value="mensal">Mensal</option>
          <option value="trimestral">Trimestral</option>
          <option value="anual">Anual</option>
        </select>
      </div>

      {filteredGrouped.length === 0 && (
        <div className="rounded-[14px] bg-white py-8 text-center text-sm" style={{ border: '1px solid #E3E8F2', color: '#94A3B8' }}>Nenhuma obrigação encontrada.</div>
      )}

      {filteredGrouped.map(({ dept, items }) => {
        const color = deptColorMap[dept.id] || '#6366F1';
        return (
          <div key={dept.id} className="space-y-2">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <div style={{ width: 3, height: 16, background: color, borderRadius: 99 }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.9px', color: '#64748B', textTransform: 'uppercase' as const }}>{dept.name}</span>
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px]" style={{ background: '#F0F3FA', border: '1px solid #E3E8F2', borderRadius: 99, color: '#64748B' }}>{items.length}</span>
            </div>
            {/* Section card */}
            <div className="overflow-hidden" style={{ background: 'white', border: '1px solid #E3E8F2', borderLeft: `3px solid ${color}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)' }}>
              {items.map((ob, obIdx) => {
                const isExpanded = expandedObligation === ob.id;
                const obActivities = activities.filter(a => a.obligation_id === ob.id);
                const linkedCount = getLinkedCount(ob.id);
                const isLast = obIdx === items.length - 1;
                return (
                  <div key={ob.id}>
                    {/* Obligation row */}
                    <div
                      className="group flex items-center gap-[10px] cursor-pointer transition-colors duration-[120ms]"
                      style={{ padding: '13px 18px', borderBottom: isLast && !isExpanded ? 'none' : '1px solid #E3E8F2' }}
                      onClick={() => setExpandedObligation(isExpanded ? null : ob.id)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0F3FA'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* 1. Chevron */}
                      <ChevronRight
                        className="shrink-0 transition-transform duration-300"
                        style={{
                          width: 18, height: 18,
                          color: isExpanded ? '#E8710A' : '#94A3B8',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
                        }}
                      />
                      {/* 2. Icon box */}
                      <div className="shrink-0 flex items-center justify-center group-hover:bg-white transition-colors" style={{ width: 34, height: 34, background: '#F0F3FA', border: '1px solid #E3E8F2', borderRadius: 6 }}>
                        <ClipboardList style={{ width: 14, height: 14, color: '#94A3B8' }} />
                      </div>
                      {/* 3. Name */}
                      <span className="flex-1 truncate" style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{ob.name}</span>
                      {/* 4. Badge frequência */}
                      <span className="hidden sm:inline-flex shrink-0 items-center" style={{ background: '#F0F3FA', border: '1px solid #E3E8F2', color: '#64748B', fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>{ob.recurrence}</span>
                      {/* 5. Badge tipo imposto */}
                      {ob.is_tax && (
                        <span className="hidden sm:inline-flex shrink-0 items-center" style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 11.5, padding: '4px 10px', borderRadius: 99 }}>
                          Imposto{ob.tax_sphere ? ` ${ob.tax_sphere.charAt(0).toUpperCase() + ob.tax_sphere.slice(1)}` : ''}
                        </span>
                      )}
                      {/* Badge retenção */}
                      {ob.is_retention && (
                        <span className="hidden sm:inline-flex shrink-0 items-center" style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 11.5, padding: '4px 10px', borderRadius: 99 }}>
                          Retenção {ob.retention_tax_type?.toUpperCase() || ''}
                        </span>
                      )}
                      {/* 6. Badge clientes */}
                      {linkedCount > 0 && (
                        <span className="hidden sm:inline-flex shrink-0 items-center gap-1" style={{ background: '#F0F3FA', border: '1px solid #E3E8F2', color: '#64748B', fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>
                          <Users style={{ width: 11, height: 11 }} />{linkedCount}
                        </span>
                      )}
                      {/* 7. Badges prazo */}
                      <div className="hidden md:flex items-center gap-[5px] shrink-0">
                        {ob.alert_day && (
                          <span className="inline-flex items-center gap-1" style={{ background: '#ECFDF5', color: '#065F46', fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />D{ob.alert_day}
                          </span>
                        )}
                        {ob.target_day && (
                          <span className="inline-flex items-center gap-1" style={{ background: '#FFFBEB', color: '#92400E', fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />D{ob.target_day}
                          </span>
                        )}
                        {ob.due_day && (
                          <span className="inline-flex items-center gap-1" style={{ background: '#FEF2F2', color: '#991B1B', fontSize: 11, padding: '4px 10px', borderRadius: 99 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />D{ob.due_day}
                          </span>
                        )}
                      </div>
                      {/* 8. Action buttons */}
                      {admin && (
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
                          <button
                            className="flex items-center justify-center rounded-[6px] transition-colors"
                            style={{ width: 30, height: 30 }}
                            onClick={() => openEditObligation(ob)}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ECFDF5'; (e.currentTarget as HTMLElement).style.color = '#065F46'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = ''; }}
                          ><Pencil style={{ width: 14, height: 14 }} /></button>
                          <button
                            className="flex items-center justify-center rounded-[6px] transition-colors"
                            style={{ width: 30, height: 30 }}
                            onClick={() => cloneObligation(ob)}
                            title="Clonar"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EEF2FF'; (e.currentTarget as HTMLElement).style.color = '#4338CA'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = ''; }}
                          ><Copy style={{ width: 14, height: 14 }} /></button>
                          <button
                            className="flex items-center justify-center rounded-[6px] transition-colors"
                            style={{ width: 30, height: 30 }}
                            onClick={() => deleteObligation(ob.id)}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#991B1B'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = ''; }}
                          ><Trash2 style={{ width: 14, height: 14 }} /></button>
                        </div>
                      )}
                    </div>
                    {/* Expanded accordion content */}
                    {isExpanded && (
                      <div style={{ background: 'linear-gradient(to bottom, #F0F3FA, #F5F7FC)', borderTop: '1px solid #E3E8F2', padding: '16px 20px 16px 64px' }}>
                        {ob.description && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                              <div style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.6px', color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>Descrição</div>
                              <div style={{ fontSize: 13, color: '#64748B' }}>{ob.description}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.6px', color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>Competência</div>
                              <div style={{ fontSize: 13, color: '#64748B' }}>{ob.competence_rule === 'previous' ? 'Mês/Ano anterior' : 'Mês/Ano atual'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.6px', color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>Atribuição</div>
                              <div style={{ fontSize: 13, color: '#64748B' }}>{ob.assignment_mode === 'all' ? 'Todas as empresas' : ob.assignment_mode === 'segment' ? 'Por segmento' : 'Manual'}</div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-3">
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Atividades ({obActivities.length})</h4>
                          {admin && <Button size="sm" variant="outline" onClick={() => openNewActivity(ob.id)}><Plus className="h-3 w-3 mr-1" />Atividade</Button>}
                        </div>
                        {obActivities.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhuma atividade cadastrada.</p>
                        ) : (
                          <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="hidden md:table-cell">Tipo Doc.</TableHead>
                                <TableHead className="hidden md:table-cell">Descrição</TableHead>
                                {admin && <TableHead className="w-20">Ações</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {obActivities.map((act, i) => (
                                <TableRow key={act.id}>
                                  <TableCell>{i + 1}</TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {act.title}
                                      {act.auto_start && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                          <Zap className="h-3 w-3 mr-0.5" />Auto
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {activityTypeIcons[act.type]}
                                      <span className="text-sm">{activityTypeLabels[act.type]}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-sm">{getDocTypeName(act.document_type_id) || '—'}</TableCell>
                                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{act.description || '—'}</TableCell>
                                  {admin && (
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => openEditActivity(act)}><Pencil className="h-3 w-3" /></Button>
                                        <Button size="icon" variant="ghost" onClick={() => deleteActivity(act.id)}><Trash2 className="h-3 w-3" /></Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Obligation Dialog */}
      <Dialog open={obligationOpen} onOpenChange={setObligationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingObligation ? 'Editar Obrigação' : 'Nova Obrigação'}</DialogTitle></DialogHeader>
          <form onSubmit={saveObligation} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={obligationForm.name} onChange={e => setObligationForm({ ...obligationForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={obligationForm.description} onChange={e => setObligationForm({ ...obligationForm, description: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select value={obligationForm.department_id} onValueChange={v => setObligationForm({ ...obligationForm, department_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={obligationForm.recurrence} onValueChange={v => setObligationForm({ ...obligationForm, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(obligationForm.recurrence === 'mensal' || obligationForm.recurrence === 'trimestral') && (
              <div className="space-y-2">
                <Label>Competência</Label>
                <Select value={obligationForm.competence_rule} onValueChange={v => setObligationForm({ ...obligationForm, competence_rule: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">{obligationForm.recurrence === 'trimestral' ? 'Trimestre atual' : 'Mês atual (competência = mês de referência)'}</SelectItem>
                    <SelectItem value="previous">{obligationForm.recurrence === 'trimestral' ? 'Trimestre anterior' : 'Mês anterior (ex: Folha de Pagamento)'}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define se a competência nas mensagens é o mês de referência ou o mês anterior</p>
              </div>
            )}
            {obligationForm.recurrence === 'anual' && (
              <>
                <div className="space-y-2">
                  <Label>Mês de referência *</Label>
                  <Select value={obligationForm.annual_month} onValueChange={v => setObligationForm({ ...obligationForm, annual_month: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                    <SelectContent>
                      {monthNames.map((name, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Mês em que a obrigação anual deve ser cumprida</p>
                </div>
                <div className="space-y-2">
                  <Label>Competência</Label>
                  <Select value={obligationForm.competence_rule} onValueChange={v => setObligationForm({ ...obligationForm, competence_rule: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Ano atual</SelectItem>
                      <SelectItem value="previous">Ano anterior (ex: RAIS, DIRF)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Define se a competência se refere ao ano atual ou ao ano anterior</p>
                </div>
              </>
            )}
            <div className="flex items-center space-x-3">
              <Switch
                checked={obligationForm.is_tax}
                onCheckedChange={v => setObligationForm({ ...obligationForm, is_tax: v, tax_sphere: v ? obligationForm.tax_sphere : '' })}
              />
              <Label>É Imposto?</Label>
            </div>
            <div className="space-y-2">
              <Label>Integração de Sistema</Label>
              <Select
                value={obligationForm.system_code || 'none'}
                onValueChange={v => setObligationForm({ ...obligationForm, system_code: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="das-simples-nacional">DAS – Simples Nacional (PGDAS-D)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Habilita ações automatizadas no calendário (ex.: botão "Sem Movimento").</p>
            </div>
            {obligationForm.is_tax && (
              <>
                <div className="space-y-2">
                  <Label>Esfera Tributária *</Label>
                  <Select value={obligationForm.tax_sphere} onValueChange={v => setObligationForm({ ...obligationForm, tax_sphere: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a esfera" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federal">Federal</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="municipal">Municipal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={obligationForm.is_retention}
                    onCheckedChange={v => setObligationForm({ ...obligationForm, is_retention: v, retention_tax_type: v ? obligationForm.retention_tax_type : '' })}
                  />
                  <Label>É Retenção?</Label>
                </div>
                {obligationForm.is_retention && (
                  <div className="space-y-2">
                    <Label>Tipo de Retenção *</Label>
                    <Select value={obligationForm.retention_tax_type} onValueChange={v => setObligationForm({ ...obligationForm, retention_tax_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iss">ISS</SelectItem>
                        <SelectItem value="inss">INSS</SelectItem>
                        <SelectItem value="irrf">IRRF</SelectItem>
                        <SelectItem value="pis">PIS</SelectItem>
                        <SelectItem value="cofins">COFINS</SelectItem>
                        <SelectItem value="csll">CSLL</SelectItem>
                        <SelectItem value="cp">CP</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">A obrigação será gerada automaticamente para clientes com essa retenção em notas tomadas</p>
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 inline-block" />
                  Dia Alerta
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 1" value={obligationForm.alert_day} onChange={e => setObligationForm({ ...obligationForm, alert_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Início da execução</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500 inline-block" />
                  Dia Meta
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 15" value={obligationForm.target_day} onChange={e => setObligationForm({ ...obligationForm, target_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Prazo interno</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 inline-block" />
                  Dia Vencimento
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 20" value={obligationForm.due_day} onChange={e => setObligationForm({ ...obligationForm, due_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Prazo final (multa)</p>
              </div>
            </div>

            <Separator />

            {/* === Empresas Vinculadas === */}
            {obligationForm.is_retention ? (
              <div className="rounded-lg border p-3 space-y-1" style={{ background: '#FFF7ED', borderColor: '#FDBA74' }}>
                <p className="text-sm font-medium" style={{ color: '#C2410C' }}>Vinculação automática por retenção</p>
                <p className="text-xs text-muted-foreground">As instâncias serão geradas automaticamente no dia 1 de cada mês para clientes com {obligationForm.retention_tax_type?.toUpperCase() || 'imposto'} retido em notas de serviços tomados do mês anterior.</p>
              </div>
            ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Empresas Vinculadas</Label>
              </div>
              <Select value={obligationForm.assignment_mode} onValueChange={v => setObligationForm({ ...obligationForm, assignment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas ativas</SelectItem>
                  <SelectItem value="segment">Por segmento (filtros)</SelectItem>
                  <SelectItem value="manual">Seleção manual</SelectItem>
                </SelectContent>
              </Select>

              {obligationForm.assignment_mode === 'segment' && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="seg_payroll"
                      checked={!!obligationForm.segment_payroll_filter}
                      onCheckedChange={v => setObligationForm({ ...obligationForm, segment_payroll_filter: v ? 'all' : '' })}
                    />
                    <Label htmlFor="seg_payroll">Empresas com Folha de Pagamento</Label>
                  </div>
                  {!!obligationForm.segment_payroll_filter && (
                    <Select value={obligationForm.segment_payroll_filter} onValueChange={v => setObligationForm({ ...obligationForm, segment_payroll_filter: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as folhas</SelectItem>
                        <SelectItem value="normal">Folha Normal</SelectItem>
                        <SelectItem value="pro_labore">Só Pró-labore</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <div className="flex flex-wrap gap-2">
                      {taxRegimeOptions.map(opt => (
                        <div key={opt.value} className="flex items-center space-x-1.5">
                          <Checkbox
                            id={`regime_${opt.value}`}
                            checked={obligationForm.segment_tax_regimes.includes(opt.value)}
                            onCheckedChange={v => {
                              const regimes = v
                                ? [...obligationForm.segment_tax_regimes, opt.value]
                                : obligationForm.segment_tax_regimes.filter(r => r !== opt.value);
                              setObligationForm({ ...obligationForm, segment_tax_regimes: regimes });
                            }}
                          />
                          <Label htmlFor={`regime_${opt.value}`} className="text-sm">{opt.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade (contido no endereço)</Label>
                    <Input
                      placeholder="Ex: São Paulo"
                      value={obligationForm.segment_city}
                      onChange={e => setObligationForm({ ...obligationForm, segment_city: e.target.value })}
                    />
                  </div>
                  <p className="text-sm font-medium text-primary">
                    {segmentPreviewClients.length} empresa(s) correspondem aos filtros
                  </p>
                </div>
              )}

              {obligationForm.assignment_mode === 'manual' && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CNPJ..."
                      className="pl-9"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{manualSelectedClients.length} selecionada(s)</p>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => setManualSelectedClients(clients.map(c => c.id))}>
                        Selecionar todas
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setManualSelectedClients([])}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="space-y-1">
                      {filteredManualClients.map(c => (
                        <div key={c.id} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`client_${c.id}`}
                            checked={manualSelectedClients.includes(c.id)}
                            onCheckedChange={v => {
                              setManualSelectedClients(v
                                ? [...manualSelectedClients, c.id]
                                : manualSelectedClients.filter(id => id !== c.id)
                              );
                            }}
                          />
                          <Label htmlFor={`client_${c.id}`} className="text-sm flex-1 cursor-pointer">
                            {c.company_name}
                            {c.document && <span className="text-muted-foreground ml-1">({c.document})</span>}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {obligationForm.assignment_mode === 'all' && (
                <p className="text-sm text-muted-foreground">Todas as {clients.length} empresas ativas serão vinculadas.</p>
              )}
            </div>
            )}

            <Separator />

            {/* === Gerar Obrigações === */}
            {editingObligation && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Gerar Obrigações</Label>
                </div>
                <div className="rounded-lg border p-3 space-y-3">
                  {editingObligation.recurrence === 'anual' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Ano de início (ano-calendário)</Label>
                        <Select value={generateStartYear} onValueChange={setGenerateStartYear}>
                          <SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {generateStartYear && editingObligation.annual_month && (
                        <p className="text-sm text-muted-foreground">
                          Será gerada obrigação <strong>{editingObligation.name}</strong> em{' '}
                          <strong>{monthNames[editingObligation.annual_month - 1]}/{editingObligation.competence_rule === 'previous' ? Number(generateStartYear) + 1 : generateStartYear}</strong>{' '}
                          referente ao ano-calendário <strong>{generateStartYear}</strong> para{' '}
                          <strong>{segmentPreviewClients.length}</strong> empresa(s)
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Mês de início</Label>
                        <Select value={generateStartMonth} onValueChange={setGenerateStartMonth}>
                          <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                          <SelectContent>
                            {monthNames.map((name, i) => (
                              <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {generateStartMonth && (
                        <p className="text-sm text-muted-foreground">
                          Serão geradas obrigações de <strong>{monthNames[Number(generateStartMonth) - 1]}</strong> a <strong>Dezembro/{new Date().getFullYear()}</strong> para <strong>{segmentPreviewClients.length}</strong> empresa(s)
                        </p>
                      )}
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={editingObligation.recurrence === 'anual' ? (!generateStartYear || generating) : (!generateStartMonth || generating)}
                    onClick={() => generateObligationInstances(editingObligation.id)}
                    className="w-full"
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {generating ? 'Gerando...' : 'Gerar Obrigações'}
                  </Button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!obligationForm.name || !obligationForm.department_id}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle></DialogHeader>
          <form onSubmit={saveActivity} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={activityForm.title} onChange={e => setActivityForm({ ...activityForm, title: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={activityForm.type} onValueChange={v => setActivityForm({ ...activityForm, type: v, document_type_id: v !== 'document' ? '' : activityForm.document_type_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activityForm.type === 'document' && (
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={activityForm.document_type_id} onValueChange={v => setActivityForm({ ...activityForm, document_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de documento" /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activityForm.type === 'whatsapp' && (
              <>
                <div className="space-y-2">
                  <Label>Nome do Template (opcional)</Label>
                  <Input value={activityForm.whatsapp_template_name} onChange={e => setActivityForm({ ...activityForm, whatsapp_template_name: e.target.value })} placeholder="Ex: lembrete_obrigacao" />
                  <p className="text-xs text-muted-foreground">Se preenchido, envia como template aprovado pela Meta</p>
                </div>
                <div className="space-y-2">
                  <Label>Corpo da Mensagem</Label>
                  <Textarea rows={5} value={activityForm.whatsapp_message_body} onChange={e => setActivityForm({ ...activityForm, whatsapp_message_body: e.target.value })} placeholder="Use variáveis: [Nome_da_Empresa], [Competencia], [Nome_da_Obrigação], [Vencimento]" />
                  <div className="flex flex-wrap gap-1">
                    {['[Nome_da_Empresa]', '[Competencia]', '[Nome_da_Obrigação]', '[Vencimento]'].map(v => (
                      <Badge key={v} variant="outline" className="text-xs cursor-pointer hover:bg-muted" onClick={() => setActivityForm(f => ({ ...f, whatsapp_message_body: f.whatsapp_message_body + v }))}>
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="whatsapp_has_document_header" checked={activityForm.whatsapp_has_document_header} onCheckedChange={v => setActivityForm({ ...activityForm, whatsapp_has_document_header: !!v })} />
                  <Label htmlFor="whatsapp_has_document_header">Template com documento no header</Label>
                </div>
                <p className="text-xs text-muted-foreground">Marque se o template envia documento diretamente no cabeçalho (header tipo DOCUMENT)</p>
                <div className="space-y-2">
                  <Label>URL do Botão (opcional)</Label>
                  <Input value={activityForm.whatsapp_button_url} onChange={e => setActivityForm({ ...activityForm, whatsapp_button_url: e.target.value })} placeholder="Ex: https://seusite.com/pagamento" />
                  <p className="text-xs text-muted-foreground">URL dinâmica para botões do template (se aplicável)</p>
                </div>
              </>
            )}
            {activityForm.type === 'email' && (
              <>
                <div className="space-y-2">
                  <Label>Departamento Remetente</Label>
                  <Select value={activityForm.email_department_id} onValueChange={v => setActivityForm({ ...activityForm, email_department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">O e-mail será enviado com as credenciais SMTP deste departamento</p>
                </div>
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input value={activityForm.email_subject} onChange={e => setActivityForm({ ...activityForm, email_subject: e.target.value })} placeholder="Ex: Lembrete de [Nome_da_Obrigação] - [Competencia]" />
                </div>
                <div className="space-y-2">
                  <Label>Corpo do E-mail</Label>
                  <Textarea rows={5} value={activityForm.email_body} onChange={e => setActivityForm({ ...activityForm, email_body: e.target.value })} placeholder="Use variáveis: [Nome_da_Empresa], [Competencia], [Nome_da_Obrigação], [Vencimento]" />
                  <div className="flex flex-wrap gap-1">
                    {['[Nome_da_Empresa]', '[Competencia]', '[Nome_da_Obrigação]', '[Vencimento]'].map(v => (
                      <Badge key={v} variant="outline" className="text-xs cursor-pointer hover:bg-muted" onClick={() => setActivityForm(f => ({ ...f, email_body: f.email_body + v }))}>
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={activityForm.order} onChange={e => setActivityForm({ ...activityForm, order: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" />Execução automática</Label>
                <p className="text-xs text-muted-foreground">Inicia automaticamente após a atividade anterior ser concluída</p>
              </div>
              <Switch checked={activityForm.auto_start} onCheckedChange={v => setActivityForm({ ...activityForm, auto_start: v })} />
            </div>
            <Button type="submit" className="w-full" disabled={!activityForm.title}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
