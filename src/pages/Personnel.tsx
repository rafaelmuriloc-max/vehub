import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Bell, Building2, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Download, FolderOpen, FolderSync,
  LayoutGrid, List, Loader2, LogOut, MoreVertical, Palmtree, Pencil, Plus, RefreshCw, Search, UserMinus, Users, Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Client { id: string; company_name: string; document: string | null; sci_code: string | null; status: string }
interface Employee {
  id: string; client_id: string; employee_code: string | null; full_name: string; cpf: string | null; position: string | null;
  admission_date: string | null; salary: number | null; termination_date: string | null;
  status: string; source: string;
  trial_end_1: string | null; trial_days_1: number | null;
  trial_end_2: string | null; trial_days_2: number | null;
}
interface EmployeeDoc {
  id: string; employee_id: string | null; client_id: string | null; file_name: string;
  drive_path: string | null; storage_path: string | null; doc_kind: string | null;
  status: string; error: string | null; updated_at: string;
}
interface DriveFolder { id: string; name: string; mimeType: string }
interface VacationPeriod {
  id: string; employee_id: string; client_id: string;
  acquisition_start: string | null; acquisition_end: string | null; days_right: number | null;
  enjoy_start: string | null; enjoy_end: string | null; deadline_date: string | null;
}
interface VacationAlert { employee: Employee; period: VacationPeriod; date: string; left: number }
interface TrialAlert { employee: Employee; which: 1 | 2; date: string; days: number | null; left: number }
interface SyncConfig { id: string; folder_id: string; folder_name: string; enabled: boolean; last_synced_at: string | null }

const emptyForm = {
  employee_code: '', full_name: '', cpf: '', position: '', admission_date: '', salary: '', termination_date: '', status: 'active',
  trial_end_1: '', trial_days_1: '', trial_end_2: '', trial_days_2: '',
};

// Hoje no fuso de São Paulo, para a contagem de dias até o vencimento.
function todayKeySP(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date(`${todayKeySP()}T12:00:00`).getTime();
  const target = new Date(`${date}T12:00:00`).getTime();
  if (!isFinite(target)) return null;
  return Math.round((target - today) / 86400000);
}

function trialTone(date: string | null): string {
  const d = daysUntil(date);
  if (d === null) return '';
  if (d < 0) return 'text-destructive font-medium';
  if (d <= 7) return 'text-amber-600 font-medium';
  return '';
}

function trialLeftLabel(left: number): string {
  if (left < 0) return `venceu há ${Math.abs(left)} d`;
  if (left === 0) return 'vence hoje';
  return `faltam ${left} d`;
}

function fmtDate(d: string | null): string {
  return d ? format(new Date(`${d}T12:00:00`), 'dd/MM/yyyy') : '—';
}

function fmtRange(a: string | null, b: string | null): string {
  if (!a && !b) return '—';
  return `${fmtDate(a)} a ${fmtDate(b)}`;
}

function fmtDays(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Data que determina o vencimento das férias: prazo final para iniciar sem
// dobro e, quando o relatório não traz, o fim do período para gozar.
function vacationDue(p: VacationPeriod): string | null {
  return p.deadline_date ?? p.enjoy_end ?? null;
}

function vacationTone(p: VacationPeriod): string {
  const left = daysUntil(vacationDue(p));
  if (left === null) return '';
  if (left < 0) return 'text-destructive font-medium';
  if (left <= 60) return 'text-amber-600 font-medium';
  return '';
}

function TrialCells({ date, days }: { date: string | null; days: number | null }) {
  const left = daysUntil(date);
  return (
    <>
      <TableCell className={cn('hidden lg:table-cell text-sm', trialTone(date))}>
        {date ? format(new Date(`${date}T12:00:00`), 'dd/MM/yyyy') : '—'}
      </TableCell>
      <TableCell className={cn('hidden lg:table-cell text-sm whitespace-nowrap', trialTone(date))}>
        {days != null ? `${days} d` : '—'}
        {left !== null && (
          <span className="text-xs text-muted-foreground ml-1">
            {left < 0 ? `· venceu há ${Math.abs(left)} d` : left === 0 ? '· vence hoje' : `· faltam ${left}`}
          </span>
        )}
      </TableCell>
    </>
  );
}

function FolderPicker({ onPick, onClose }: { onPick: (f: { id: string; name: string }) => void; onClose: () => void }) {
  const [folderId, setFolderId] = useState('root');
  const [folderName, setFolderName] = useState('Meu Drive');
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-api', {
        body: { action: 'list', folderId: id, pageSize: 200, orderBy: 'name' },
      });
      if (error) throw error;
      const files = (data?.data?.files ?? []) as DriveFolder[];
      setFolders(files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(folderId); }, [folderId, load]);

  return (
    <div className="border rounded-md">
      <div className="flex items-center gap-1 px-3 py-2 border-b text-xs text-muted-foreground overflow-x-auto">
        <button className="hover:underline shrink-0" onClick={() => { setFolderId('root'); setFolderName('Meu Drive'); setTrail([]); }}>
          Meu Drive
        </button>
        {trail.map(t => (
          <span key={t.id} className="flex items-center gap-1 shrink-0">
            <span>/</span>
            <button
              className="hover:underline"
              onClick={() => {
                const idx = trail.findIndex(x => x.id === t.id);
                setTrail(trail.slice(0, idx + 1));
                setFolderId(t.id);
                setFolderName(t.name);
              }}
            >{t.name}</button>
          </span>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto divide-y">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : folders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma subpasta aqui.</p>
        ) : folders.map(f => (
          <button
            key={f.id}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => { setTrail([...trail, { id: folderId, name: folderName }]); setFolderId(f.id); setFolderName(f.name); }}
          >
            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t">
        <span className="text-xs text-muted-foreground truncate">Pasta atual: <strong>{folderName}</strong></span>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" onClick={() => { onPick({ id: folderId, name: folderName }); onClose(); }}>
            Selecionar esta pasta
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Personnel() {
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const unreadCount = useUnreadCount();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingTrial, setSyncingTrial] = useState(false);
  const [syncingVacation, setSyncingVacation] = useState(false);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'terminated'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => (sessionStorage.getItem('personnel-view') === 'cards' ? 'cards' : 'table'));
  const [systemSearch, setSystemSearch] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [page, setPage] = useState(1);

  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [picking, setPicking] = useState(false);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);

  const [empDialog, setEmpDialog] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formClientId, setFormClientId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cliRes, empRes, docRes, cfgRes, vacRes] = await Promise.all([
      supabase.from('clients').select('id, company_name, document, sci_code, status').order('company_name'),
      supabase.from('client_employees').select('*').order('full_name'),
      supabase.from('employee_documents').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('employee_sync_config').select('*').order('created_at').limit(1),
      supabase.from('employee_vacation_periods').select('*').order('acquisition_start'),
    ]);
    if (cliRes.data) setClients(cliRes.data as Client[]);
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (docRes.data) setDocs(docRes.data as EmployeeDoc[]);
    if (vacRes.data) setVacations(vacRes.data as unknown as VacationPeriod[]);
    setConfig((cfgRes.data?.[0] as SyncConfig) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const employeesByClient = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const e of employees) {
      const arr = map.get(e.client_id) ?? [];
      arr.push(e);
      map.set(e.client_id, arr);
    }
    return map;
  }, [employees]);


  // Somente empresas ativas entram nos números e na lista
  const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);
  const activeClientIds = useMemo(() => new Set(activeClients.map(c => c.id)), [activeClients]);
  const scopedEmployees = useMemo(() => employees.filter(e => activeClientIds.has(e.client_id)), [employees, activeClientIds]);
  const activeEmployees = useMemo(() => scopedEmployees.filter(e => e.status === 'active'), [scopedEmployees]);
  const totalSalaries = useMemo(
    () => activeEmployees.reduce((sum, e) => sum + (e.salary ?? 0), 0),
    [activeEmployees],
  );
  const clientsWithActive = useMemo(
    () => new Set(activeEmployees.map(e => e.client_id)).size,
    [activeEmployees],
  );

  // Prazos de experiência dos funcionários ativos
  const trialSoon = useMemo(() => activeEmployees.filter(e =>
    [e.trial_end_1, e.trial_end_2].some(d => {
      const left = daysUntil(d);
      return left !== null && left >= 0 && left <= 15;
    })).length, [activeEmployees]);

  const trialOverdue = useMemo(() => activeEmployees.filter(e =>
    [e.trial_end_1, e.trial_end_2].some(d => {
      const left = daysUntil(d);
      return left !== null && left < 0;
    })).length, [activeEmployees]);

  // Alertas de experiência (a vencer em 15 dias e já vencidos), agrupados por empresa
  const trialAlerts = useMemo(() => {
    const soon: TrialAlert[] = [];
    const overdue: TrialAlert[] = [];
    for (const e of activeEmployees) {
      const prazos: [string | null, number | null, 1 | 2][] = [
        [e.trial_end_1, e.trial_days_1, 1],
        [e.trial_end_2, e.trial_days_2, 2],
      ];
      for (const [date, days, which] of prazos) {
        if (!date) continue;
        const left = daysUntil(date);
        if (left === null) continue;
        const alert: TrialAlert = { employee: e, which, date, days, left };
        if (left < 0) overdue.push(alert);
        else if (left <= 15) soon.push(alert);
      }
    }
    const byCompany = (list: TrialAlert[]) => {
      const map = new Map<string, { name: string; items: TrialAlert[] }>();
      for (const a of list) {
        const entry = map.get(a.employee.client_id) ?? {
          name: clients.find(c => c.id === a.employee.client_id)?.company_name ?? 'Empresa não identificada',
          items: [],
        };
        entry.items.push(a);
        map.set(a.employee.client_id, entry);
      }
      return [...map.values()]
        .map(g => ({ ...g, items: g.items.sort((x, y) => x.left - y.left) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    };
    return { soon: byCompany(soon), overdue: byCompany(overdue) };
  }, [activeEmployees, clients]);

  // Períodos de férias por funcionário, do mais antigo para o mais novo
  const vacationsByEmployee = useMemo(() => {
    const map = new Map<string, VacationPeriod[]>();
    for (const p of vacations) {
      const arr = map.get(p.employee_id) ?? [];
      arr.push(p);
      map.set(p.employee_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.acquisition_start ?? '').localeCompare(b.acquisition_start ?? ''));
    }
    return map;
  }, [vacations]);

  // Férias a vencer em 60 dias (e já vencidas), por empresa
  const vacationAlerts = useMemo(() => {
    const soon: VacationAlert[] = [];
    let overdue = 0;
    const activeIds = new Map(activeEmployees.map(e => [e.id, e]));
    for (const p of vacations) {
      const emp = activeIds.get(p.employee_id);
      if (!emp) continue;
      const date = vacationDue(p);
      const left = daysUntil(date);
      if (date === null || left === null) continue;
      if (left < 0) { overdue++; continue; }
      if (left <= 60) soon.push({ employee: emp, period: p, date, left });
    }
    const map = new Map<string, { name: string; items: VacationAlert[] }>();
    for (const a of soon) {
      const entry = map.get(a.employee.client_id) ?? {
        name: clients.find(c => c.id === a.employee.client_id)?.company_name ?? 'Empresa não identificada',
        items: [],
      };
      entry.items.push(a);
      map.set(a.employee.client_id, entry);
    }
    const groups = [...map.values()]
      .map(g => ({ ...g, items: g.items.sort((x, y) => x.left - y.left) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { groups, count: soon.length, overdue };
  }, [vacations, activeEmployees, clients]);


  const filteredClients = useMemo(() => {
    const idsWithActive = new Set(activeEmployees.map(e => e.client_id));
    const base = activeClients.filter(c => idsWithActive.has(c.id));
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(c =>
      c.company_name.toLowerCase().includes(q)
      || (c.document ?? '').toLowerCase().includes(q)
      || (c.sci_code ?? '').toLowerCase().includes(q)
      // também encontra pela pessoa: nome, CPF ou código da ficha
      || (employeesByClient.get(c.id) ?? []).some(e =>
        e.full_name.toLowerCase().includes(q)
        || (e.cpf ?? '').toLowerCase().includes(q)
        || (e.employee_code ?? '').toLowerCase() === q,
      ),
    );
  }, [activeClients, activeEmployees, employeesByClient, search]);

  const totalPages = pageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedClients = useMemo(() => {
    if (pageSize === 'all') return filteredClients;
    const start = (safePage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, pageSize, safePage]);

  function visibleEmployees(clientId: string) {
    const all = employeesByClient.get(clientId) ?? [];
    const list = statusFilter === 'all'
      ? all
      : all.filter(e => (statusFilter === 'active' ? e.status === 'active' : e.status !== 'active'));
    // Ordena por código (numérico quando possível); sem código, pelo nome no fim.
    return [...list].sort((a, b) => {
      const ca = a.employee_code?.trim();
      const cb = b.employee_code?.trim();
      if (ca && cb) {
        const na = Number(ca), nb = Number(cb);
        if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
        if (ca !== cb) return ca.localeCompare(cb, 'pt-BR');
      } else if (ca) return -1;
      else if (cb) return 1;
      return a.full_name.localeCompare(b.full_name, 'pt-BR');
    });
  }

  async function syncNow(onlyTrial = false) {
    if (!config) { setFolderDialog(true); return; }
    if (onlyTrial) setSyncingTrial(true); else setSyncing(true);
    try {
      const total = { fichas_lidas: 0, fichas_html: 0, funcionarios_encontrados: 0, funcionarios_criados: 0, funcionarios_ignorados: 0, funcionarios_atualizados: 0, experiencias_atualizadas: 0, revisao: 0, linhas_ignoradas: 0, linhas_sem_empresa: 0, empresas_atendidas: 0 };
      let restantes = 0;
      // A leitura de PDF é pesada: a função processa poucos arquivos por vez,
      // então repetimos até acabar a fila.
      for (let round = 0; round < (onlyTrial ? 1 : 40); round++) {
        const { data, error } = await supabase.functions.invoke('employee-folder-sync', {
          body: onlyTrial
            ? { only: 'experiencia', force_reprocess: true }
            : { force_reprocess: round === 0 },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.error);
        const s = data?.stats ?? {};
        total.fichas_lidas += s.fichas_lidas ?? 0;
        total.fichas_html += s.fichas_html ?? 0;
        total.funcionarios_encontrados += s.funcionarios_encontrados ?? 0;
        total.funcionarios_criados += s.funcionarios_criados ?? 0;
        total.funcionarios_ignorados += s.funcionarios_ignorados ?? 0;
        total.funcionarios_atualizados += s.funcionarios_atualizados ?? 0;
        total.experiencias_atualizadas += s.experiencias_atualizadas ?? 0;
        total.revisao += s.revisao ?? 0;
        total.linhas_ignoradas += s.linhas_ignoradas ?? 0;
        total.linhas_sem_empresa += s.linhas_sem_empresa ?? 0;
        total.empresas_atendidas = Math.max(total.empresas_atendidas, s.empresas_atendidas ?? 0);
        restantes = s.restantes ?? 0;
        if (restantes === 0) break;
      }
      toast({
        title: onlyTrial
          ? 'Relatório de experiência sincronizado'
          : restantes > 0 ? 'Sincronização parcial' : 'Sincronização concluída',
        description: `${total.fichas_lidas} arquivo(s) lido(s)${total.fichas_html > 0 ? `, ${total.fichas_html} ficha(s) de registro` : ''}, ${total.funcionarios_encontrados} funcionário(s) encontrado(s) em ${total.empresas_atendidas} empresa(s), ${total.funcionarios_criados} cadastrado(s), ${total.funcionarios_ignorados} já cadastrado(s) ignorado(s)${total.funcionarios_atualizados > 0 ? `, ${total.funcionarios_atualizados} atualizado(s) com rescisão` : ''}${total.experiencias_atualizadas > 0 ? `, ${total.experiencias_atualizadas} com prazo de experiência atualizado` : ''}, ${total.revisao} aguardando revisão.${total.linhas_ignoradas > 0 ? ` ${total.linhas_ignoradas} ficha(s)/linha(s) ignorada(s).` : ''}${total.linhas_sem_empresa > 0 ? ` ${total.linhas_sem_empresa} sem empresa reconhecida.` : ''}${restantes > 0 ? ` ${restantes} arquivo(s) ainda na fila — sincronize novamente.` : ''}`,
      });

    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      if (onlyTrial) setSyncingTrial(false); else setSyncing(false);
      loadAll();
    }
  }

  // Lê somente o relatório de acompanhamento de vencimento de férias.
  async function syncVacations() {
    if (!config) { setFolderDialog(true); return; }
    setSyncingVacation(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-folder-sync', {
        body: { only: 'ferias', force_reprocess: true },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error);
      const s = data?.stats ?? {};
      toast({
        title: 'Relatório de férias sincronizado',
        description: `${s.fichas_lidas ?? 0} arquivo(s) lido(s), ${s.ferias_periodos ?? 0} período(s) de férias de ${s.ferias_funcionarios ?? 0} funcionário(s)${(s.funcionarios_criados ?? 0) > 0 ? `, ${s.funcionarios_criados} funcionário(s) cadastrado(s)` : ''}.`,
      });
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncingVacation(false);
      loadAll();
    }
  }



  async function saveFolder() {
    if (!folder) return;
    if (config) {
      await supabase.from('employee_sync_config')
        .update({ folder_id: folder.id, folder_name: folder.name, enabled: true } as never)
        .eq('id', config.id);
    } else {
      const { error } = await supabase.from('employee_sync_config')
        .insert({ folder_id: folder.id, folder_name: folder.name } as never);
      if (error) {
        toast({ title: 'Erro ao salvar pasta', description: error.message, variant: 'destructive' });
        return;
      }
    }
    toast({ title: 'Pasta definida', description: folder.name });
    setFolderDialog(false);
    setFolder(null);
    loadAll();
  }

  function openNew(clientId: string) {
    setEditing(null);
    setFormClientId(clientId);
    setForm(emptyForm);
    setEmpDialog(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setFormClientId(e.client_id);
    setForm({
      employee_code: e.employee_code ?? '',
      full_name: e.full_name,
      cpf: e.cpf ?? '',
      position: e.position ?? '',
      admission_date: e.admission_date ?? '',
      salary: e.salary != null ? String(e.salary) : '',
      termination_date: e.termination_date ?? '',
      status: e.status,
      trial_end_1: e.trial_end_1 ?? '',
      trial_days_1: e.trial_days_1 != null ? String(e.trial_days_1) : '',
      trial_end_2: e.trial_end_2 ?? '',
      trial_days_2: e.trial_days_2 != null ? String(e.trial_days_2) : '',
    });
    setEmpDialog(true);
  }

  async function saveEmployee() {
    if (!form.full_name.trim() || !formClientId) return;
    const payload = {
      client_id: formClientId,
      employee_code: form.employee_code.trim() || null,
      full_name: form.full_name.trim(),
      cpf: form.cpf.replace(/\D/g, '') || null,
      position: form.position.trim() || null,
      admission_date: form.admission_date || null,
      salary: form.salary ? Number(form.salary.replace(',', '.')) : null,
      termination_date: form.termination_date || null,
      status: form.termination_date ? 'terminated' : form.status,
      trial_end_1: form.trial_end_1 || null,
      trial_days_1: form.trial_days_1 ? Number(form.trial_days_1) : null,
      trial_end_2: form.trial_end_2 || null,
      trial_days_2: form.trial_days_2 ? Number(form.trial_days_2) : null,
    };
    const res = editing
      ? await supabase.from('client_employees').update(payload as never).eq('id', editing.id)
      : await supabase.from('client_employees').insert(payload as never);
    if (res.error) {
      toast({ title: 'Erro ao salvar', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Funcionário atualizado' : 'Funcionário cadastrado' });
    setEmpDialog(false);
    loadAll();
  }

  async function terminate(e: Employee) {
    const date = prompt('Data de desligamento (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!date) return;
    await supabase.from('client_employees')
      .update({ termination_date: date, status: 'terminated' } as never).eq('id', e.id);
    loadAll();
  }


  const companyMetrics = useMemo(() => {
    const map = new Map<string, { total: number; active: number; terminated: number; salaries: number; vacations: number; trials: number }>();
    for (const c of activeClients) map.set(c.id, { total: 0, active: 0, terminated: 0, salaries: 0, vacations: 0, trials: 0 });
    for (const e of employees) {
      const metric = map.get(e.client_id);
      if (!metric) continue;
      metric.total++;
      if (e.status === 'active') {
        metric.active++;
        metric.salaries += e.salary ?? 0;
        for (const date of [e.trial_end_1, e.trial_end_2]) {
          const left = daysUntil(date);
          if (left !== null && left >= 0 && left <= 15) metric.trials++;
        }
      } else metric.terminated++;
    }
    for (const p of vacations) {
      const employee = employees.find(e => e.id === p.employee_id && e.status === 'active');
      if (!employee) continue;
      const left = daysUntil(vacationDue(p));
      if (left !== null && left >= 0 && left <= 60) {
        const metric = map.get(employee.client_id);
        if (metric) metric.vacations++;
      }
    }
    return map;
  }, [activeClients, employees, vacations]);

  function selectView(mode: 'table' | 'cards') {
    setViewMode(mode);
    sessionStorage.setItem('personnel-view', mode);
  }

  function handleSystemSearch() {
    const value = systemSearch.trim().toLowerCase();
    if (!value) return;
    const destinations = [
      { words: ['férias', 'ferias'], path: '/ferias' }, { words: ['cliente', 'empresa'], path: '/clients' },
      { words: ['fiscal', 'nota'], path: '/fiscal' }, { words: ['calendário', 'calendario'], path: '/calendar' },
      { words: ['chat', 'whatsapp'], path: '/chat' }, { words: ['drive', 'arquivo'], path: '/drive' },
    ];
    const destination = destinations.find(item => item.words.some(word => value.includes(word)));
    if (destination) navigate(destination.path); else setSearch(systemSearch);
  }

  function exportCompanies() {
    const rows = filteredClients.map(c => {
      const m = companyMetrics.get(c.id) ?? { total: 0, active: 0, terminated: 0, salaries: 0, vacations: 0, trials: 0 };
      return [c.sci_code ?? '', c.company_name, c.document ?? '', m.total, m.active, m.terminated, m.salaries.toFixed(2).replace('.', ','), m.vacations, m.trials];
    });
    const csv = '\ufeff' + [['Código SCI', 'Empresa', 'CNPJ', 'Funcionários', 'Ativos', 'Desligados', 'Salários (R$)', 'Férias a vencer', 'Experiências a vencer'], ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pessoal-empresas-${todayKeySP()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderEmployeeDetails(c: Client) {
    return (
      <div className="px-3 pb-4 pt-2 bg-muted/20">
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={() => openNew(c.id)}><Plus className="h-4 w-4 mr-1" />Adicionar funcionário</Button>
        </div>
        {visibleEmployees(c.id).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum funcionário nesta situação.</p> : (
          <div className="border rounded-md overflow-x-auto bg-background">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-20">Código</TableHead><TableHead>Nome</TableHead><TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead className="hidden sm:table-cell">Cargo</TableHead><TableHead className="hidden lg:table-cell">Admissão</TableHead>
                <TableHead className="hidden lg:table-cell">Prazo 1</TableHead><TableHead className="hidden lg:table-cell">Dias</TableHead>
                <TableHead className="hidden lg:table-cell">Prazo 2</TableHead><TableHead className="hidden lg:table-cell">Dias</TableHead>
                <TableHead className="hidden lg:table-cell">Data de rescisão</TableHead><TableHead className="hidden lg:table-cell">Salário</TableHead>
                <TableHead>Situação</TableHead><TableHead className="w-24" />
              </TableRow></TableHeader>
              <TableBody>{visibleEmployees(c.id).map(e => {
                const periods = vacationsByEmployee.get(e.id) ?? [];
                const openVac = expandedEmployee === e.id;
                return <Fragment key={e.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandedEmployee(openVac ? null : e.id)}>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">{e.employee_code ?? '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{e.full_name}</TableCell><TableCell className="hidden md:table-cell text-sm">{e.cpf ?? '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{e.position ?? '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{e.admission_date ? fmtDate(e.admission_date) : '—'}</TableCell>
                    <TrialCells date={e.trial_end_1} days={e.trial_days_1} /><TrialCells date={e.trial_end_2} days={e.trial_days_2} />
                    <TableCell className="hidden lg:table-cell text-sm">{e.termination_date ? fmtDate(e.termination_date) : '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{e.salary != null ? e.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={e.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>{e.status === 'active' ? 'Ativo' : 'Desligado'}</Badge></TableCell>
                    <TableCell><div className="flex gap-1 justify-end" onClick={event => event.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      {e.status === 'active' && <Button variant="ghost" size="icon" onClick={() => terminate(e)}><UserMinus className="h-4 w-4 text-destructive" /></Button>}
                    </div></TableCell>
                  </TableRow>
                  {openVac && <TableRow className="bg-muted/40 hover:bg-muted/40"><TableCell colSpan={13} className="p-3">
                    {periods.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum período de férias importado para este funcionário. Use o botão “Sincronizar” e escolha “Férias”.</p> : (
                      <div className="rounded-md border bg-background overflow-x-auto"><Table><TableHeader><TableRow>
                        <TableHead className="w-28">Dias de direito</TableHead><TableHead>Referente Período Aquisitivo</TableHead>
                        <TableHead>Deverá gozar as férias entre o período</TableHead><TableHead>Prazo final p/ iniciar as férias sem gerar dobro</TableHead>
                      </TableRow></TableHeader><TableBody>{periods.map(p => <TableRow key={p.id} className={vacationTone(p)}>
                        <TableCell className="text-sm tabular-nums">{fmtDays(p.days_right)}</TableCell><TableCell className="text-sm whitespace-nowrap">{fmtRange(p.acquisition_start, p.acquisition_end)}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{fmtRange(p.enjoy_start, p.enjoy_end)}</TableCell><TableCell className="text-sm whitespace-nowrap">{fmtDate(p.deadline_date)}</TableCell>
                      </TableRow>)}</TableBody></Table></div>
                    )}
                  </TableCell></TableRow>}
                </Fragment>;
              })}</TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const initials = (profile?.full_name || 'Usuário').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const syncingAny = syncing || syncingTrial || syncingVacation;

  return (
    <div className="space-y-4 pb-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Pessoal</h1><p className="text-sm text-muted-foreground">Funcionários dos clientes do escritório.</p></div>
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={systemSearch} onChange={e => setSystemSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSystemSearch()} placeholder="Buscar no sistema..." className="h-9 pl-9 pr-12 bg-card" />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
          </div>
          <Button variant="outline" size="icon" className="relative h-9 w-9" onClick={() => navigate('/chat')} aria-label="Notificações">
            <Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />}
          </Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0">
            <Avatar className="h-9 w-9"><AvatarImage src={profile?.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
          </Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => navigate('/settings')}>{profile?.full_name || 'Meu perfil'}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Funcionários ativos', value: activeEmployees.length.toLocaleString('pt-BR'), hint: `${scopedEmployees.length - activeEmployees.length} desligado(s)`, hint2: `${clientsWithActive} empresa(s) com funcionários · ${activeClients.length - clientsWithActive} sem funcionário(s)`, Icon: Users, tone: 'primary', bars: [4,7,11,9,8,12,10,15] },
          { label: 'Total de salários', value: totalSalaries.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), hint: `Folha dos ${activeEmployees.length} funcionários ativos`, Icon: Wallet, tone: 'success', bars: [3,5,8,7,9,8,10,12] },
          { label: 'Experiências a vencer (15 dias)', value: trialSoon.toLocaleString('pt-BR'), hint: `${trialOverdue} prazo(s) já vencido(s)`, Icon: CalendarClock, tone: 'danger', bars: [7,4,10,6,12,8,5,9], action: () => setTrialDialogOpen(true) },
          { label: 'Férias a vencer (60 dias)', value: vacationAlerts.count.toLocaleString('pt-BR'), hint: `${vacationAlerts.overdue} período(s) já vencido(s)`, Icon: Palmtree, tone: 'warning', bars: [3,5,8,7,5,8,10,12], action: () => setVacationDialogOpen(true) },
        ].map(({ label, value, hint, hint2, Icon, tone, bars, action }) => (
          <Card key={label} className={cn('overflow-hidden border-border/70 shadow-sm', action && 'cursor-pointer hover:border-primary/30 transition-colors')} onClick={action}>
            <CardContent className="p-4 min-h-[118px] flex gap-3">
              <div className={cn('h-10 w-10 rounded-full shrink-0 flex items-center justify-center', tone === 'primary' && 'bg-primary/10 text-primary', tone === 'success' && 'bg-success/10 text-success', tone === 'violet' && 'bg-accent text-accent-foreground', tone === 'danger' && 'bg-destructive/10 text-destructive', tone === 'warning' && 'bg-warning/10 text-warning')}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground leading-tight min-h-7">{label}</p><p className="text-2xl font-bold tabular-nums truncate">{value}</p><p className="text-[11px] text-muted-foreground truncate">{hint}</p>{hint2 && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{hint2}</p>}</div>
              <div className="self-end h-10 w-16 flex items-end gap-1 opacity-60" aria-hidden="true">{bars.map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-primary/50" style={{ height: `${height * 2}px` }} />)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-sm flex flex-col xl:flex-row gap-2 xl:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9 h-10" placeholder="Buscar empresa por nome, CNPJ, código SCI ou funcionário..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}><SelectTrigger className="h-10 w-full xl:w-36"><div className="text-left"><span className="block text-[10px] leading-none text-muted-foreground">Situação</span><SelectValue /></div></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="terminated">Desligados</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={loadAll} aria-label="Recarregar"><RefreshCw className="h-4 w-4" /></Button>
        <Button className="h-10 shrink-0" onClick={() => navigate('/clients?new=1')}><Plus className="h-4 w-4 mr-1" />Nova empresa</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Mais ações"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => navigate('/ferias')}><Palmtree className="h-4 w-4 mr-2" />Gestão de férias</DropdownMenuItem>
          {isAdmin && <DropdownMenuItem onClick={() => { setFolder(null); setFolderDialog(true); }}><FolderOpen className="h-4 w-4 mr-2" />{config ? `Pasta: ${config.folder_name}` : 'Definir pasta'}</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => syncNow()} disabled={syncingAny}>{syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderSync className="h-4 w-4 mr-2" />}Sincronizar fichas</DropdownMenuItem>
          <DropdownMenuItem onClick={() => syncNow(true)} disabled={syncingAny}>{syncingTrial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}Sincronizar experiência</DropdownMenuItem>
          <DropdownMenuItem onClick={syncVacations} disabled={syncingAny}>{syncingVacation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Palmtree className="h-4 w-4 mr-2" />}Sincronizar férias</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div>

      {config?.last_synced_at && <p className="text-xs text-muted-foreground">Última sincronização: {format(new Date(config.last_synced_at), 'dd/MM/yyyy HH:mm')}</p>}

      <section className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="p-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h2 className="text-lg font-bold">Empresas <span className="text-sm font-medium text-muted-foreground">({filteredClients.length})</span></h2><p className="text-xs text-muted-foreground">Lista de empresas e seu quadro de funcionários</p></div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5 bg-muted/50"><Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => selectView('table')}><List className="h-4 w-4 mr-1" />Tabela</Button><Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => selectView('cards')}><LayoutGrid className="h-4 w-4 mr-1" />Cards</Button></div>
            <Button variant="outline" size="sm" className="h-9" onClick={exportCompanies}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          </div>
        </div>

        {filteredClients.length === 0 ? <p className="text-sm text-muted-foreground p-8 text-center">Nenhuma empresa encontrada.</p> : viewMode === 'table' ? (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10">#</TableHead><TableHead>Empresa</TableHead><TableHead>CNPJ / Código SCI</TableHead><TableHead className="text-center">Funcionários</TableHead><TableHead className="text-center">Ativos</TableHead><TableHead className="text-center">Desligados</TableHead><TableHead>Salários (R$)</TableHead><TableHead className="text-center">Férias a vencer<br /><span className="text-[10px]">(60 dias)</span></TableHead><TableHead className="text-center">Experiências a vencer<br /><span className="text-[10px]">(15 dias)</span></TableHead><TableHead className="w-12">Ações</TableHead>
          </TableRow></TableHeader><TableBody>{paginatedClients.map(c => {
            const m = companyMetrics.get(c.id) ?? { total: 0, active: 0, terminated: 0, salaries: 0, vacations: 0, trials: 0 };
            const isOpen = expanded === c.id;
            return <Fragment key={c.id}><TableRow className={cn('cursor-pointer', isOpen && 'bg-muted/30')} onClick={() => setExpanded(isOpen ? null : c.id)}>
              <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
              <TableCell><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-warning shrink-0" /><span className="font-medium text-sm">{c.company_name}</span></div></TableCell>
              <TableCell><div className="text-xs">{c.document ?? '—'}</div><div className="text-[11px] text-muted-foreground">SCI {c.sci_code ?? '—'}</div></TableCell>
              <TableCell className="text-center"><Badge variant="secondary">{m.total}</Badge></TableCell><TableCell className="text-center"><Badge className="bg-success/10 text-success border-success/20">{m.active}</Badge></TableCell><TableCell className="text-center"><Badge className={m.terminated ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground'}>{m.terminated}</Badge></TableCell>
              <TableCell className="text-sm tabular-nums">{m.salaries.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell><TableCell className="text-center"><Badge className={m.vacations ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground'}>{m.vacations}</Badge></TableCell><TableCell className="text-center"><Badge className={m.trials ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground'}>{m.trials}</Badge></TableCell>
              <TableCell><Button variant="ghost" size="icon" onClick={event => { event.stopPropagation(); setExpanded(isOpen ? null : c.id); }}><MoreVertical className="h-4 w-4" /></Button></TableCell>
            </TableRow>{isOpen && <TableRow><TableCell colSpan={10} className="p-0">{renderEmployeeDetails(c)}</TableCell></TableRow>}</Fragment>;
          })}</TableBody></Table></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">{paginatedClients.map(c => {
            const m = companyMetrics.get(c.id) ?? { total: 0, active: 0, terminated: 0, salaries: 0, vacations: 0, trials: 0 }; const isOpen = expanded === c.id;
            return <Card key={c.id} className="overflow-hidden"><Button type="button" variant="ghost" className="block w-full h-auto rounded-none whitespace-normal text-left p-4 hover:bg-muted/30" onClick={() => setExpanded(isOpen ? null : c.id)}><div className="flex items-start gap-3"><div className="h-9 w-9 rounded-md bg-warning/10 text-warning flex items-center justify-center"><Building2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{c.company_name}</p><p className="text-xs text-muted-foreground">SCI {c.sci_code ?? '—'} · {c.document ?? 'Sem CNPJ'}</p></div>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div><div className="grid grid-cols-3 gap-2 mt-4 text-center"><div><p className="text-lg font-bold">{m.active}</p><p className="text-[10px] text-muted-foreground">Ativos</p></div><div><p className="text-lg font-bold">{m.vacations}</p><p className="text-[10px] text-muted-foreground">Férias</p></div><div><p className="text-lg font-bold">{m.trials}</p><p className="text-[10px] text-muted-foreground">Experiências</p></div></div><p className="text-xs text-muted-foreground mt-3">Folha: {m.salaries.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></Button>{isOpen && renderEmployeeDetails(c)}</Card>;
          })}</div>
        )}

        {filteredClients.length > 0 && <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t"><p className="text-xs text-muted-foreground">{filteredClients.length} empresa(s) — página {safePage} de {totalPages}</p><Select value={String(pageSize)} onValueChange={value => { setPageSize(value === 'all' ? 'all' : Number(value)); setPage(1); }}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 por página</SelectItem><SelectItem value="20">20 por página</SelectItem><SelectItem value="30">30 por página</SelectItem><SelectItem value="all">Todas</SelectItem></SelectContent></Select><div className="flex items-center gap-1">{totalPages > 1 && <><Button variant="outline" size="icon" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm px-2 tabular-nums">{safePage} / {totalPages}</span><Button variant="outline" size="icon" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button></>}</div></div>}
      </section>

      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pasta do Google Drive</DialogTitle>
            <DialogDescription>
              Escolha a pasta (subpastas incluídas) com os arquivos usados para montar a lista de funcionários.
            </DialogDescription>
          </DialogHeader>
          {picking ? (
            <FolderPicker onPick={setFolder} onClose={() => setPicking(false)} />
          ) : (
            <Button type="button" variant="outline" className="w-full justify-start font-normal" onClick={() => setPicking(true)}>
              <FolderOpen className="mr-2 h-4 w-4 text-primary" />
              {folder ? folder.name : config ? config.folder_name : 'Escolher pasta...'}
            </Button>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(false)}>Cancelar</Button>
            <Button onClick={saveFolder} disabled={!folder}>Salvar pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={empDialog} onOpenChange={setEmpDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Admissão</Label>
                <Input type="date" value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Salário</Label>
                <Input inputMode="decimal" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo 1 da experiência</Label>
                <Input type="date" value={form.trial_end_1} onChange={e => setForm({ ...form, trial_end_1: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Dias do prazo 1</Label>
                <Input inputMode="numeric" value={form.trial_days_1} onChange={e => setForm({ ...form, trial_days_1: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo 2 da experiência</Label>
                <Input type="date" value={form.trial_end_2} onChange={e => setForm({ ...form, trial_end_2: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Dias do prazo 2</Label>
                <Input inputMode="numeric" value={form.trial_days_2} onChange={e => setForm({ ...form, trial_days_2: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Desligamento</Label>
                <Input type="date" value={form.termination_date} onChange={e => setForm({ ...form, termination_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="terminated">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialog(false)}>Cancelar</Button>
            <Button onClick={saveEmployee} disabled={!form.full_name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Experiências a vencer</DialogTitle>
            <DialogDescription>
              Funcionários ativos com prazo de experiência vencendo nos próximos 15 dias, por empresa.
            </DialogDescription>
          </DialogHeader>

          {trialAlerts.soon.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma experiência a vencer nos próximos 15 dias.
            </p>
          ) : (
            <div className="space-y-4">
              {trialAlerts.soon.map(g => (
                <div key={g.name} className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 border-b">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{g.name}</span>
                    <Badge variant="outline" className="ml-auto shrink-0">{g.items.length}</Badge>
                  </div>
                  <div className="divide-y">
                    {g.items.map((a, i) => (
                      <div key={`${a.employee.id}-${a.which}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                          {a.employee.employee_code ?? '—'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{a.employee.full_name}</div>
                          {a.employee.position && (
                            <div className="text-xs text-muted-foreground truncate">{a.employee.position}</div>
                          )}
                        </div>
                        <div className={cn('text-right shrink-0', trialTone(a.date))}>
                          <div className="text-xs">{a.which}º prazo · {format(new Date(`${a.date}T12:00:00`), 'dd/MM/yyyy')}</div>
                          <div className="text-xs text-muted-foreground">{trialLeftLabel(a.left)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </DialogContent>
      </Dialog>

      <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Férias a vencer</DialogTitle>
            <DialogDescription>
              Funcionários ativos com férias vencendo nos próximos 60 dias, por empresa.
            </DialogDescription>
          </DialogHeader>

          {vacationAlerts.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma férias a vencer nos próximos 60 dias.
            </p>
          ) : (
            <div className="space-y-4">
              {vacationAlerts.groups.map(g => (
                <div key={g.name} className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 border-b">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{g.name}</span>
                    <Badge variant="outline" className="ml-auto shrink-0">{g.items.length}</Badge>
                  </div>
                  <div className="divide-y">
                    {g.items.map(a => (
                      <div key={a.period.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                          {a.employee.employee_code ?? '—'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{a.employee.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {fmtDays(a.period.days_right)} dia(s) · {fmtRange(a.period.acquisition_start, a.period.acquisition_end)}
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-amber-600">
                          <div className="text-xs">{format(new Date(`${a.date}T12:00:00`), 'dd/MM/yyyy')}</div>
                          <div className="text-xs text-muted-foreground">{trialLeftLabel(a.left)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
