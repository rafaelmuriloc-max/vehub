import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Folder, FileText, Download, Trash2, Pencil, FolderPlus, Upload, Search,
  ExternalLink, ChevronRight, ChevronDown, RefreshCw, Loader2, Plus, Share2,
  MoreVertical, List, LayoutGrid, Filter, Users, Clock, ArrowUp, ArrowDown,
  FileImage, FileSpreadsheet, FileArchive, FolderInput, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
  owners?: { displayName?: string; photoLink?: string }[];
};

type BreadcrumbEntry = { id: string; name: string };
type TabKey = 'all' | 'folders' | 'files' | 'shared' | 'recent';
type SortKey = 'name-asc' | 'name-desc' | 'modified' | 'size';
type TypeFilter = 'any' | 'pdf' | 'image' | 'sheet' | 'doc' | 'zip';

interface DriveBrowserProps {
  mode?: 'manage' | 'picker';
  multiple?: boolean;
  onPick?: (files: DriveFile[]) => void;
  onClose?: () => void;
  showHeader?: boolean;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function callDrive(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('drive-api', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || 'Erro no Google Drive');
  return data.data;
}

export async function downloadDriveFile(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
  const res = await callDrive('download', { fileId });
  const bin = atob(res.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: res.mimeType }), mimeType: res.mimeType };
}

function DriveLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function fileIcon(f: DriveFile, cls = 'h-5 w-5') {
  if (f.mimeType === FOLDER_MIME) return <Folder className={cn(cls, 'fill-warning text-warning')} />;
  if (f.mimeType.startsWith('image/')) return <FileImage className={cn(cls, 'text-primary')} />;
  if (f.mimeType.includes('sheet') || f.mimeType.includes('excel') || f.mimeType.includes('csv')) return <FileSpreadsheet className={cn(cls, 'text-success')} />;
  if (f.mimeType.includes('zip') || f.mimeType.includes('compressed') || f.mimeType.includes('rar')) return <FileArchive className={cn(cls, 'text-muted-foreground')} />;
  return <FileText className={cn(cls, f.mimeType === 'application/pdf' ? 'text-destructive' : 'text-primary')} />;
}

function matchesType(f: DriveFile, t: TypeFilter) {
  if (t === 'any' || f.mimeType === FOLDER_MIME) return true;
  const m = f.mimeType;
  if (t === 'pdf') return m === 'application/pdf';
  if (t === 'image') return m.startsWith('image/');
  if (t === 'sheet') return m.includes('sheet') || m.includes('excel') || m.includes('csv');
  if (t === 'doc') return m.includes('document') || m.includes('word') || m.startsWith('text/');
  if (t === 'zip') return m.includes('zip') || m.includes('compressed') || m.includes('rar');
  return true;
}

function formatSize(s?: string) {
  if (!s) return '—';
  const n = Number(s);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

const TABS: { key: TabKey; label: string; icon: typeof Folder }[] = [
  { key: 'all', label: 'Todos', icon: Folder },
  { key: 'folders', label: 'Pastas', icon: Folder },
  { key: 'files', label: 'Arquivos', icon: FileText },
  { key: 'shared', label: 'Compartilhados', icon: Users },
  { key: 'recent', label: 'Recentes', icon: Clock },
];

export function DriveBrowser({ mode = 'manage', multiple = true, onPick, onClose, showHeader }: DriveBrowserProps) {
  const { isAdmin } = useAuth();
  const manage = mode === 'manage';
  const header = showHeader ?? manage;
  const [folderId, setFolderId] = useState<string>('root');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: 'root', name: 'Meu Drive' }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('any');
  const [tab, setTab] = useState<TabKey>('all');
  const [sort, setSort] = useState<SortKey>('name-asc');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<Record<string, DriveFile>>({});
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [renameName, setRenameName] = useState('');
  const [moveTarget, setMoveTarget] = useState<DriveFile | null>(null);
  const [moveDest, setMoveDest] = useState<string>('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected({});
    try {
      const res = await callDrive('list', { folderId, q: appliedSearch || undefined, pageSize: 300, filter: tab });
      const list: DriveFile[] = res.files || [];
      setFiles(list);
      const folderIds = list.filter((f) => f.mimeType === FOLDER_MIME).map((f) => f.id);
      if (folderIds.length) {
        callDrive('countChildren', { folderIds })
          .then((r) => setCounts((c) => ({ ...c, ...(r?.counts || {}) })))
          .catch(() => { /* função ainda não publicada */ });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao listar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [folderId, appliedSearch, tab]);

  useEffect(() => { load(); }, [load]);

  const isFolder = (f: DriveFile) => f.mimeType === FOLDER_MIME;

  const visible = useMemo(() => {
    let list = files.filter((f) => matchesType(f, typeFilter));
    if (tab === 'folders') list = list.filter(isFolder);
    if (tab === 'files') list = list.filter((f) => !isFolder(f));
    if (tab === 'recent') return list;
    const sorted = [...list].sort((a, b) => {
      if (isFolder(a) !== isFolder(b)) return isFolder(a) ? -1 : 1;
      switch (sort) {
        case 'name-desc': return b.name.localeCompare(a.name, 'pt-BR');
        case 'modified': return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
        case 'size': return Number(b.size || 0) - Number(a.size || 0);
        default: return a.name.localeCompare(b.name, 'pt-BR');
      }
    });
    return sorted;
  }, [files, typeFilter, tab, sort]);

  function enterFolder(f: DriveFile) {
    setBreadcrumb((b) => (tab === 'all' || tab === 'folders' ? [...b, { id: f.id, name: f.name }] : [{ id: 'root', name: 'Meu Drive' }, { id: f.id, name: f.name }]));
    if (tab !== 'all' && tab !== 'folders') setTab('all');
    setFolderId(f.id);
    setSearch(''); setAppliedSearch('');
  }

  function navigateTo(idx: number) {
    const next = breadcrumb.slice(0, idx + 1);
    setBreadcrumb(next);
    setFolderId(next[next.length - 1].id);
    setSearch(''); setAppliedSearch('');
  }

  function toggleSelect(f: DriveFile) {
    if (!manage && isFolder(f)) return;
    setSelected((cur) => {
      const copy = multiple || manage ? { ...cur } : {};
      if (cur[f.id]) delete copy[f.id]; else copy[f.id] = f;
      return copy;
    });
  }

  const selectable = manage ? visible : visible.filter((f) => !isFolder(f));
  const allSelected = selectable.length > 0 && selectable.every((f) => selected[f.id]);
  function toggleAll() {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(selectable.map((f) => [f.id, f])));
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of Array.from(filesList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = ''; const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        await callDrive('upload', {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parents: folderId === 'root' ? undefined : folderId,
          base64: btoa(bin),
        });
        ok++;
      } catch (e) {
        console.error(e); fail++;
      }
    }
    setUploading(false);
    toast({ title: 'Upload', description: `${ok} enviado(s)${fail ? `, ${fail} falha(s)` : ''}` });
    load();
  }

  async function deleteFiles(list: DriveFile[]) {
    if (!list.length) return;
    if (!confirm(list.length === 1 ? `Excluir "${list[0].name}"? Será movido para a lixeira do Drive.` : `Excluir ${list.length} itens? Serão movidos para a lixeira do Drive.`)) return;
    let fail = 0;
    for (const f of list) {
      try { await callDrive('delete', { fileId: f.id }); } catch { fail++; }
    }
    toast({ title: fail ? `${fail} falha(s) ao excluir` : 'Excluído', variant: fail ? 'destructive' : undefined });
    load();
  }

  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await callDrive('rename', { fileId: renameTarget.id, name: renameName.trim() });
      setRenameTarget(null);
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao renomear', description: e.message, variant: 'destructive' });
    }
  }

  async function handleMove() {
    if (!moveTarget || !moveDest) return;
    try {
      await callDrive('move', {
        fileId: moveTarget.id,
        addParents: moveDest,
        removeParents: moveTarget.parents?.join(',') || folderId,
      });
      setMoveTarget(null);
      toast({ title: 'Movido' });
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao mover', description: e.message, variant: 'destructive' });
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await callDrive('createFolder', { name: newFolderName.trim(), parents: folderId === 'root' ? undefined : folderId });
      setNewFolderOpen(false);
      setNewFolderName('');
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao criar pasta', description: e.message, variant: 'destructive' });
    }
  }

  async function handleDownload(f: DriveFile) {
    try {
      toast({ title: 'Baixando...', description: f.name });
      const { blob } = await downloadDriveFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e.message, variant: 'destructive' });
    }
  }

  async function handleShare(f: DriveFile) {
    if (!f.webViewLink) return;
    await navigator.clipboard.writeText(f.webViewLink);
    toast({ title: 'Link copiado', description: f.name });
  }

  function openItem(f: DriveFile) {
    if (isFolder(f)) enterFolder(f);
    else if (manage) handleDownload(f);
    else toggleSelect(f);
  }

  const selectedList = Object.values(selected);
  const moveOptions = files.filter((f) => isFolder(f) && f.id !== moveTarget?.id);
  const parentCrumb = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;

  const RowActions = ({ f }: { f: DriveFile }) => (
    <div className="flex items-center justify-end gap-1">
      {f.webViewLink && (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Compartilhar (copiar link)" onClick={(e) => { e.stopPropagation(); handleShare(f); }}>
          <Share2 className="h-4 w-4" />
        </Button>
      )}
      {f.webViewLink && (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" asChild title="Abrir no Drive">
          <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" /></a>
        </Button>
      )}
      {manage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isFolder(f) && <DropdownMenuItem onClick={() => handleDownload(f)}><Download className="h-4 w-4 mr-2" />Baixar</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => { setRenameTarget(f); setRenameName(f.name); }}><Pencil className="h-4 w-4 mr-2" />Renomear</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setMoveTarget(f); setMoveDest(''); }}><FolderInput className="h-4 w-4 mr-2" />Mover</DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFiles([f])}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const subtitle = (f: DriveFile) => isFolder(f)
    ? (counts[f.id] !== undefined ? `${counts[f.id]} ${counts[f.id] === 1 ? 'item' : 'itens'}` : '—')
    : formatSize(f.size);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }} />

      {header && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <DriveLogo className="h-9 w-9 sm:h-10 sm:w-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Google Drive</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Arquivos da conta do escritório</p>
            </div>
          </div>
          {manage && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={() => setNewFolderOpen(true)} className="bg-card">
                <FolderPlus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nova pasta</span>
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading} className="bg-card">
                {uploading ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Upload className="h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">Upload</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Novo</span>
                    <ChevronDown className="h-4 w-4 ml-1 sm:ml-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setNewFolderOpen(true)}><FolderPlus className="h-4 w-4 mr-2" />Nova pasta</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload de arquivo</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className={cn('flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 pb-3', !header && 'pt-3')}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); if (t.key === 'shared' || t.key === 'recent') { setBreadcrumb([{ id: 'root', name: 'Meu Drive' }]); setFolderId('root'); } }}
                className={cn(
                  'flex items-center gap-2 h-9 px-3 rounded-md border text-sm shrink-0 transition-colors',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-md border bg-card overflow-hidden">
            <button onClick={() => setView('list')} className={cn('h-9 w-10 flex items-center justify-center', view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} title="Lista">
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView('grid')} className={cn('h-9 w-10 flex items-center justify-center border-l', view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')} title="Grade">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 bg-card" onClick={load} title="Atualizar">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <span className="hidden md:inline text-sm text-muted-foreground ml-1">Ordenar por</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)} disabled={tab === 'recent'}>
            <SelectTrigger className="h-9 w-[150px] bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
              <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
              <SelectItem value="modified">Mais recentes</SelectItem>
              <SelectItem value="size">Tamanho</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 bg-card relative">
                <Filter className="h-4 w-4 mr-2" />Filtros
                {(appliedSearch || typeFilter !== 'any') && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <form onSubmit={(e) => { e.preventDefault(); setAppliedSearch(search.trim()); }} className="space-y-1.5">
                <Label className="text-xs">Nome contém</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8" />
                </div>
              </form>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de arquivo</Label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="image">Imagens</SelectItem>
                    <SelectItem value="sheet">Planilhas</SelectItem>
                    <SelectItem value="doc">Documentos</SelectItem>
                    <SelectItem value="zip">Compactados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setAppliedSearch(''); setTypeFilter('any'); }}>Limpar</Button>
                <Button size="sm" onClick={() => setAppliedSearch(search.trim())}>Aplicar</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Trilha */}
      {breadcrumb.length > 1 && (
        <div className="flex items-center gap-1 text-sm px-4 sm:px-6 pb-3 overflow-x-auto">
          {breadcrumb.map((b, idx) => (
            <div key={b.id} className="flex items-center gap-1 shrink-0">
              <button onClick={() => navigateTo(idx)} className={cn('hover:underline', idx === breadcrumb.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {b.name}
              </button>
              {idx < breadcrumb.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}

      {/* Barra de lote */}
      {manage && selectedList.length > 0 && (
        <div className="mx-4 sm:mx-6 mb-3 flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selectedList.length} selecionado(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="bg-card" onClick={async () => { for (const f of selectedList.filter((x) => !isFolder(x))) await handleDownload(f); }}>
              <Download className="h-4 w-4 mr-1" />Baixar
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" className="bg-card text-destructive" onClick={() => deleteFiles(selectedList)}>
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected({})}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4">
        {view === 'list' ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr className="border-b">
                  <th className="w-12 px-4 py-3 text-left">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                  </th>
                  <th className="px-2 py-3 text-left font-medium">
                    <button
                      className="flex items-center gap-1 text-foreground"
                      onClick={() => setSort(sort === 'name-asc' ? 'name-desc' : 'name-asc')}
                    >
                      Nome
                      {sort === 'name-desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </button>
                  </th>
                  <th className="hidden lg:table-cell px-2 py-3 text-left font-medium w-48">Proprietário</th>
                  <th className="hidden md:table-cell px-2 py-3 text-left font-medium w-44">Última modificação</th>
                  <th className="hidden lg:table-cell px-2 py-3 text-left font-medium w-32">Tamanho</th>
                  <th className="px-4 py-3 text-left font-medium w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && visible.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum item</td></tr>
                )}
                {parentCrumb && tab === 'all' && (
                  <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => navigateTo(breadcrumb.length - 2)}>
                    <td className="px-4 py-3" />
                    <td className="px-2 py-3" colSpan={5}>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Folder className="h-7 w-7 fill-warning text-warning" />
                        <span>.. voltar para {parentCrumb.name}</span>
                      </div>
                    </td>
                  </tr>
                )}
                {visible.map((f) => {
                  const folder = isFolder(f);
                  const sel = !!selected[f.id];
                  const owner = f.owners?.[0]?.displayName;
                  return (
                    <tr key={f.id} className={cn('hover:bg-muted/40 cursor-pointer', sel && 'bg-primary/5')} onClick={() => openItem(f)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {(manage || !folder) && <Checkbox checked={sel} onCheckedChange={() => toggleSelect(f)} />}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {folder ? <Folder className="h-7 w-7 shrink-0 fill-warning text-warning" /> : <span className="h-7 w-7 flex items-center justify-center shrink-0">{fileIcon(f, 'h-6 w-6')}</span>}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{f.name}</div>
                            <div className="text-xs text-muted-foreground">{subtitle(f)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-3">
                        {owner ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-6 w-6 rounded-full bg-success text-success-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">{initials(owner)}</span>
                            <span className="truncate text-muted-foreground">{owner}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="hidden md:table-cell px-2 py-3 text-muted-foreground whitespace-nowrap">{formatDate(f.modifiedTime)}</td>
                      <td className="hidden lg:table-cell px-2 py-3 text-muted-foreground">{folder ? '—' : formatSize(f.size)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><RowActions f={f} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {loading && visible.length === 0 && <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</div>}
            {!loading && visible.length === 0 && <div className="py-12 text-center text-muted-foreground">Nenhum item</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {visible.map((f) => {
                const sel = !!selected[f.id];
                return (
                  <div
                    key={f.id}
                    onClick={() => openItem(f)}
                    className={cn('group relative rounded-lg border bg-card p-3 cursor-pointer hover:shadow-md transition-shadow', sel && 'ring-2 ring-primary')}
                  >
                    <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                      {(manage || !isFolder(f)) && <Checkbox checked={sel} onCheckedChange={() => toggleSelect(f)} />}
                    </div>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      {manage && <RowActions f={f} />}
                    </div>
                    <div className="flex items-center justify-center h-20">{fileIcon(f, 'h-12 w-12')}</div>
                    <div className="text-sm font-medium truncate" title={f.name}>{f.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(f.modifiedTime)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {mode === 'picker' && (
        <div className="border-t p-3 flex items-center justify-between bg-card">
          <span className="text-sm text-muted-foreground">{selectedList.length} arquivo(s) selecionado(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={selectedList.length === 0} onClick={() => { onPick?.(selectedList.filter((f) => !isFolder(f))); onClose?.(); }}>
              Anexar
            </Button>
          </div>
        </div>
      )}

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Novo nome</Label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mover "{moveTarget?.name}"</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Destino</Label>
            <Select value={moveDest} onValueChange={setMoveDest}>
              <SelectTrigger><SelectValue placeholder="Escolha uma pasta" /></SelectTrigger>
              <SelectContent>
                {parentCrumb && <SelectItem value={parentCrumb.id}>.. {parentCrumb.name}</SelectItem>}
                {folderId !== 'root' && !parentCrumb && <SelectItem value="root">Meu Drive</SelectItem>}
                {moveOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancelar</Button>
            <Button disabled={!moveDest} onClick={handleMove}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
