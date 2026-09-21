import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  Building2, ChevronDown, ChevronLeft, ChevronRight, FolderOpen, FolderSync,
  Loader2, Pencil, Plus, RefreshCw, Search, UserMinus, Users, Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Client { id: string; company_name: string; document: string | null; sci_code: string | null }
interface Employee {
  id: string; client_id: string; full_name: string; cpf: string | null; position: string | null;
  admission_date: string | null; salary: number | null; termination_date: string | null;
  status: string; source: string;
}
interface EmployeeDoc {
  id: string; employee_id: string | null; client_id: string | null; file_name: string;
  drive_path: string | null; storage_path: string | null; doc_kind: string | null;
  status: string; error: string | null; updated_at: string;
}
interface DriveFolder { id: string; name: string; mimeType: string }
interface SyncConfig { id: string; folder_id: string; folder_name: string; enabled: boolean; last_synced_at: string | null }

const emptyForm = {
  full_name: '', cpf: '', position: '', admission_date: '', salary: '', termination_date: '', status: 'active',
};

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
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'terminated'>('all');
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [page, setPage] = useState(1);

  const [folderDialog, setFolderDialog] = useState(false);
  const [picking, setPicking] = useState(false);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);

  const [empDialog, setEmpDialog] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formClientId, setFormClientId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cliRes, empRes, docRes, cfgRes] = await Promise.all([
      supabase.from('clients').select('id, company_name, document, sci_code').eq('status', 'active').order('company_name'),
      supabase.from('client_employees').select('*').order('full_name'),
      supabase.from('employee_documents').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('employee_sync_config').select('*').order('created_at').limit(1),
    ]);
    if (cliRes.data) setClients(cliRes.data as Client[]);
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (docRes.data) setDocs(docRes.data as EmployeeDoc[]);
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

  const pendingDocs = useMemo(() => docs.filter(d => d.status !== 'imported'), [docs]);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const totalSalaries = useMemo(
    () => activeEmployees.reduce((sum, e) => sum + (e.salary ?? 0), 0),
    [activeEmployees],
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.company_name.toLowerCase().includes(q)
      || (c.document ?? '').toLowerCase().includes(q)
      || (c.sci_code ?? '').toLowerCase().includes(q),
    );
  }, [clients, search]);

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
    const list = employeesByClient.get(clientId) ?? [];
    if (statusFilter === 'all') return list;
    return list.filter(e => (statusFilter === 'active' ? e.status === 'active' : e.status !== 'active'));
  }

  async function syncNow() {
    if (!config) { setFolderDialog(true); return; }
    setSyncing(true);
    try {
      const total = { fichas_lidas: 0, funcionarios_encontrados: 0, funcionarios_criados: 0, funcionarios_atualizados: 0, revisao: 0 };
      let restantes = 0;
      // A leitura de PDF é pesada: a função processa poucos arquivos por vez,
      // então repetimos até acabar a fila.
      for (let round = 0; round < 20; round++) {
        const { data, error } = await supabase.functions.invoke('employee-folder-sync', {
          body: { force_reprocess: round === 0 },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.error);
        const s = data?.stats ?? {};
        total.fichas_lidas += s.fichas_lidas ?? 0;
        total.funcionarios_encontrados += s.funcionarios_encontrados ?? 0;
        total.funcionarios_criados += s.funcionarios_criados ?? 0;
        total.funcionarios_atualizados += s.funcionarios_atualizados ?? 0;
        total.revisao += s.revisao ?? 0;
        restantes = s.restantes ?? 0;
        if (restantes === 0) break;
      }
      toast({
        title: restantes > 0 ? 'Sincronização parcial' : 'Sincronização concluída',
        description: `${total.fichas_lidas} arquivo(s) lido(s), ${total.funcionarios_encontrados} funcionário(s) encontrado(s), ${total.funcionarios_criados} cadastrado(s), ${total.funcionarios_atualizados} atualizado(s), ${total.revisao} aguardando revisão.${restantes > 0 ? ` ${restantes} arquivo(s) ainda na fila — sincronize novamente.` : ''}`,
      });
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
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
      full_name: e.full_name,
      cpf: e.cpf ?? '',
      position: e.position ?? '',
      admission_date: e.admission_date ?? '',
      salary: e.salary != null ? String(e.salary) : '',
      termination_date: e.termination_date ?? '',
      status: e.status,
    });
    setEmpDialog(true);
  }

  async function saveEmployee() {
    if (!form.full_name.trim() || !formClientId) return;
    const payload = {
      client_id: formClientId,
      full_name: form.full_name.trim(),
      cpf: form.cpf.replace(/\D/g, '') || null,
      position: form.position.trim() || null,
      admission_date: form.admission_date || null,
      salary: form.salary ? Number(form.salary.replace(',', '.')) : null,
      termination_date: form.termination_date || null,
      status: form.termination_date ? 'terminated' : form.status,
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


  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pessoal</h1>
          <p className="text-sm text-muted-foreground">Funcionários dos clientes do escritório.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => { setFolder(null); setFolderDialog(true); }}>
              <FolderOpen className="h-4 w-4 mr-1" />
              {config ? config.folder_name : 'Definir pasta'}
            </Button>
          )}
          <Button size="sm" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FolderSync className="h-4 w-4 mr-1" />}
            Sincronizar pasta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Total de funcionários ativos
              </span>
              <div className="text-4xl font-bold tabular-nums leading-none text-foreground">
                {activeEmployees.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {employees.length - activeEmployees.length} desligado(s)
              </p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground/40 shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Total de salários
              </span>
              <div className="text-4xl font-bold tabular-nums leading-none text-foreground">
                {totalSalaries.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-muted-foreground">
                Folha dos {activeEmployees.length} funcionário(s) ativo(s)
              </p>
            </div>
            <Wallet className="h-8 w-8 text-muted-foreground/40 shrink-0" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar empresa por nome, CNPJ ou código SCI..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Somente ativos</SelectItem>
              <SelectItem value="terminated">Somente desligados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadAll}><RefreshCw className="h-4 w-4" /></Button>
        </CardContent>
      </Card>

      {config?.last_synced_at && (
        <p className="text-xs text-muted-foreground">
          Última sincronização: {format(new Date(config.last_synced_at), 'dd/MM/yyyy HH:mm')}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredClients.length === 0 && (
              <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma empresa encontrada.</p>
            )}
            {paginatedClients.map(c => {
              const list = employeesByClient.get(c.id) ?? [];
              const actives = list.filter(e => e.status === 'active').length;
              const terminated = list.length - actives;
              const isOpen = expanded === c.id;
              return (
                <div key={c.id}>
                  <button
                    className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 transition-colors', isOpen && 'bg-accent/40')}
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {c.sci_code ? `${c.sci_code} - ` : ''}{c.company_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.document ?? '—'}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" /> {list.length} no total
                      </Badge>
                      <Badge variant="outline" className="hidden sm:inline-flex bg-green-100 text-green-700 border-green-200">
                        {actives} ativos
                      </Badge>
                      {terminated > 0 && (
                        <Badge variant="outline" className="hidden sm:inline-flex bg-muted text-muted-foreground">
                          {terminated} desligados
                        </Badge>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-2 sm:px-4 pb-4">
                      <div className="flex justify-end mb-2">
                        <Button size="sm" variant="outline" onClick={() => openNew(c.id)}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar funcionário
                        </Button>
                      </div>
                      {visibleEmployees(c.id).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum funcionário nesta situação.</p>
                      ) : (
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="hidden md:table-cell">CPF</TableHead>
                                <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                                <TableHead className="hidden lg:table-cell">Admissão</TableHead>
                                <TableHead className="hidden lg:table-cell">Data de rescisão</TableHead>
                                <TableHead className="hidden lg:table-cell">Salário</TableHead>
                                <TableHead>Situação</TableHead>
                                <TableHead className="w-24" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleEmployees(c.id).map(e => {
                                return (
                                  <TableRow key={e.id}>
                                    <TableCell className="font-medium text-sm">{e.full_name}</TableCell>
                                    <TableCell className="hidden md:table-cell text-sm">{e.cpf ?? '—'}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-sm">{e.position ?? '—'}</TableCell>
                                    <TableCell className="hidden lg:table-cell text-sm">
                                      {e.admission_date ? format(new Date(`${e.admission_date}T12:00:00`), 'dd/MM/yyyy') : '—'}
                                    </TableCell>
                                     <TableCell className="hidden lg:table-cell text-sm">
                                       {e.termination_date ? format(new Date(`${e.termination_date}T12:00:00`), 'dd/MM/yyyy') : '—'}
                                     </TableCell>
                                    <TableCell className="hidden lg:table-cell text-sm">
                                      {e.salary != null ? e.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={e.status === 'active'
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-muted text-muted-foreground'}>
                                        {e.status === 'active' ? 'Ativo' : 'Desligado'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        {e.status === 'active' && (
                                          <Button variant="ghost" size="icon" onClick={() => terminate(e)}>
                                            <UserMinus className="h-4 w-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
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
          {filteredClients.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground order-2 sm:order-1">
                {filteredClients.length} empresa(s) — página {safePage} de {totalPages}
              </p>
              <div className="flex items-center gap-2 order-3 sm:order-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={v => { setPageSize(v === 'all' ? 'all' : Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 por página</SelectItem>
                    <SelectItem value="20">20 por página</SelectItem>
                    <SelectItem value="30">30 por página</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 order-1 sm:order-3">
                {totalPages > 1 && (
                  <>
                    <Button
                      variant="outline" size="icon"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2 tabular-nums">{safePage} / {totalPages}</span>
                    <Button
                      variant="outline" size="icon"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos aguardando revisão</CardTitle>
            <CardDescription>Não foi possível identificar a empresa ou o funcionário destes arquivos.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                  <TableHead className="hidden md:table-cell">Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDocs.slice(0, 50).map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate text-sm font-medium">{d.file_name}</div>
                      {d.drive_path && <div className="truncate text-xs text-muted-foreground">{d.drive_path}</div>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{d.error ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(d.updated_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
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
    </div>
  );
}
