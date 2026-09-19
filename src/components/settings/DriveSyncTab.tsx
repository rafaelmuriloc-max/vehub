import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, ChevronsUpDown, FolderOpen, FolderSync, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SyncConfig {
  id: string;
  folder_id: string;
  folder_name: string;
  department_id: string | null;
  obligation_id: string | null;
  allowed_doc_type_ids: string[];
  enabled: boolean;
  last_synced_at: string | null;
}

interface SyncedFile {
  id: string;
  drive_name: string | null;
  drive_path: string | null;
  status: string;
  error: string | null;
  updated_at: string;
  client_id: string | null;
}

interface Department { id: string; name: string }
interface Obligation { id: string; name: string; department_id: string }
interface DocType { id: string; name: string }
interface DriveFolder { id: string; name: string; mimeType: string }

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  imported: { label: 'Importado', className: 'bg-green-100 text-green-700 border-green-200' },
  pending_review: { label: 'Aguardando revisão', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  error: { label: 'Erro', className: 'bg-red-100 text-red-700 border-red-200' },
  ignored: { label: 'Ignorado', className: 'bg-muted text-muted-foreground' },
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

export function DriveSyncTab() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [files, setFiles] = useState<SyncedFile[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [obligationId, setObligationId] = useState('');
  const [allowedIds, setAllowedIds] = useState<string[]>([]);
  const [oblPopoverOpen, setOblPopoverOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfgRes, fileRes, deptRes, oblRes, typeRes, clientRes] = await Promise.all([
      supabase.from('drive_sync_configs').select('*').order('created_at'),
      supabase.from('drive_synced_files').select('id, drive_name, drive_path, status, error, updated_at, client_id').order('updated_at', { ascending: false }).limit(100),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('id, name, department_id').order('name'),
      supabase.from('document_types').select('id, name').order('name'),
      supabase.from('clients').select('id, company_name'),
    ]);
    if (cfgRes.data) setConfigs(cfgRes.data as SyncConfig[]);
    if (fileRes.data) setFiles(fileRes.data as SyncedFile[]);
    if (deptRes.data) setDepartments(deptRes.data);
    if (oblRes.data) setObligations(oblRes.data as Obligation[]);
    if (typeRes.data) setDocTypes(typeRes.data);
    if (clientRes.data) setClients(Object.fromEntries(clientRes.data.map(c => [c.id, c.company_name])));
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const deptName = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments]);
  const oblName = useMemo(() => Object.fromEntries(obligations.map(o => [o.id, o.name])), [obligations]);

  const filteredObligations = useMemo(
    () => obligations.filter(o => o.department_id === departmentId),
    [obligations, departmentId],
  );

  async function handleSave() {
    if (!folder || !departmentId || allowedIds.length === 0) return;
    const { error } = await supabase.from('drive_sync_configs').insert({
      folder_id: folder.id,
      folder_name: folder.name,
      department_id: departmentId,
      obligation_id: obligationId || null,
      allowed_doc_type_ids: allowedIds,
    } as any);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Monitoramento criado' });
    setDialogOpen(false);
    setFolder(null); setDepartmentId(''); setObligationId(''); setAllowedIds([]);
    loadAll();
  }

  async function toggleEnabled(cfg: SyncConfig) {
    await supabase.from('drive_sync_configs').update({ enabled: !cfg.enabled } as any).eq('id', cfg.id);
    loadAll();
  }

  async function removeConfig(id: string) {
    if (!confirm('Remover este monitoramento? Os documentos já importados serão mantidos.')) return;
    await supabase.from('drive_sync_configs').delete().eq('id', id);
    loadAll();
  }

  async function syncNow(configId?: string) {
    setSyncing(configId ?? 'all');
    try {
      const { data, error } = await supabase.functions.invoke('drive-folder-sync', {
        body: configId ? { config_id: configId } : {},
      });
      if (error) throw error;
      const s = (data?.summary ?? []) as any[];
      const tot = s.reduce((acc, x) => acc + (x.novos || 0) + (x.atualizados || 0), 0);
      toast({ title: 'Sincronização concluída', description: `${tot} documento(s) importado(s), ${s.reduce((a, x) => a + (x.revisao || 0), 0)} aguardando revisão.` });
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(null);
      loadAll();
    }
  }

  function toggleType(id: string) {
    setAllowedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><FolderSync className="h-5 w-5" /> Monitoramento do Google Drive</CardTitle>
            <CardDescription>
              Pastas vigiadas a cada 10 minutos. Arquivos novos ou modificados são importados automaticamente para os Documentos.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => syncNow()} disabled={syncing !== null || configs.length === 0}>
              {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1">Sincronizar agora</span>
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>Adicionar pasta</Button>
          </div>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pasta monitorada. Clique em "Adicionar pasta" para começar.</p>
          ) : (
            <div className="space-y-3">
              {configs.map(cfg => (
                <div key={cfg.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border rounded-md p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{cfg.folder_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cfg.department_id ? deptName[cfg.department_id] : '—'}
                      {cfg.obligation_id ? ` · ${oblName[cfg.obligation_id]}` : ''}
                      {` · ${cfg.allowed_doc_type_ids.length} tipo(s)`}
                      {cfg.last_synced_at ? ` · última sincronização ${format(new Date(cfg.last_synced_at), 'dd/MM/yyyy HH:mm')}` : ' · nunca sincronizada'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={cfg.enabled} onCheckedChange={() => toggleEnabled(cfg)} />
                    <Button variant="outline" size="icon" onClick={() => syncNow(cfg.id)} disabled={syncing !== null}>
                      {syncing === cfg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeConfig(cfg.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivos processados</CardTitle>
          <CardDescription>Últimos 100 arquivos encontrados nas pastas monitoradas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4 sm:px-0">Nenhum arquivo processado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="hidden md:table-cell">Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map(f => {
                  const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.error;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="max-w-[220px]">
                        <div className="truncate text-sm font-medium">{f.drive_name}</div>
                        {f.drive_path && <div className="truncate text-xs text-muted-foreground">{f.drive_path}</div>}
                        {f.error && <div className="text-xs text-destructive mt-0.5">{f.error}</div>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{f.client_id ? clients[f.client_id] ?? '—' : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('whitespace-nowrap', st.className)}>{st.label}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {format(new Date(f.updated_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Monitorar pasta do Drive</DialogTitle>
            <DialogDescription>
              Escolha a pasta (subpastas incluídas) e o contexto padrão para os documentos importados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>1. Pasta do Google Drive</Label>
              {picking ? (
                <FolderPicker onPick={setFolder} onClose={() => setPicking(false)} />
              ) : (
                <Button type="button" variant="outline" className="w-full justify-start font-normal" onClick={() => setPicking(true)}>
                  <FolderOpen className="mr-2 h-4 w-4 text-primary" />
                  {folder ? folder.name : 'Escolher pasta...'}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>2. Departamento</Label>
              <Select value={departmentId} onValueChange={v => { setDepartmentId(v); setObligationId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>3. Obrigação (opcional)</Label>
              <Popover open={oblPopoverOpen} onOpenChange={setOblPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" disabled={!departmentId} className="w-full justify-between font-normal">
                    <span className="truncate">{obligationId ? oblName[obligationId] : 'Selecione a obrigação'}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar obrigação..." />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty>Nenhuma obrigação.</CommandEmpty>
                      <CommandGroup>
                        {filteredObligations.map(o => (
                          <CommandItem key={o.id} value={o.name} onSelect={() => { setObligationId(o.id); setOblPopoverOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', obligationId === o.id ? 'opacity-100' : 'opacity-0')} />
                            <span className="text-sm">{o.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>4. Tipos de documento aceitos</Label>
              <div className="border rounded-md divide-y max-h-44 overflow-y-auto">
                {docTypes.map(t => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent">
                    <Checkbox checked={allowedIds.includes(t.id)} onCheckedChange={() => toggleType(t.id)} />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!folder || !departmentId || allowedIds.length === 0}>Ativar monitoramento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
