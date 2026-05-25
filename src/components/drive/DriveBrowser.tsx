import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Folder, FileText, Download, Trash2, Pencil, FolderPlus, Upload, Search,
  ExternalLink, ChevronRight, ArrowLeft, RefreshCw, Loader2, Check,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
};

type BreadcrumbEntry = { id: string; name: string };

interface DriveBrowserProps {
  mode?: 'manage' | 'picker';
  multiple?: boolean;
  onPick?: (files: DriveFile[]) => void;
  onClose?: () => void;
}

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

export function DriveBrowser({ mode = 'manage', multiple = true, onPick, onClose }: DriveBrowserProps) {
  const { isAdmin } = useAuth();
  const [folderId, setFolderId] = useState<string>('root');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: 'root', name: 'Meu Drive' }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, DriveFile>>({});
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [renameName, setRenameName] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (fId: string, q?: string) => {
    setLoading(true);
    try {
      const res = await callDrive('list', { folderId: fId, q, pageSize: 200 });
      setFiles(res.files || []);
    } catch (e: any) {
      toast({ title: 'Erro ao listar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(folderId, search || undefined); }, [folderId, load]);

  const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';

  function enterFolder(f: DriveFile) {
    setBreadcrumb((b) => [...b, { id: f.id, name: f.name }]);
    setFolderId(f.id);
    setSearch('');
  }

  function navigateTo(idx: number) {
    const next = breadcrumb.slice(0, idx + 1);
    setBreadcrumb(next);
    setFolderId(next[next.length - 1].id);
    setSearch('');
  }

  function toggleSelect(f: DriveFile) {
    if (isFolder(f)) return;
    setSelected((cur) => {
      const copy = multiple ? { ...cur } : {};
      if (cur[f.id]) delete copy[f.id]; else copy[f.id] = f;
      return copy;
    });
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of Array.from(filesList)) {
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = ''; const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        const base64 = btoa(bin);
        await callDrive('upload', {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parents: folderId === 'root' ? undefined : folderId,
          base64,
        });
        ok++;
      } catch (e: any) {
        console.error(e); fail++;
      }
    }
    setUploading(false);
    toast({ title: 'Upload', description: `${ok} enviado(s)${fail ? `, ${fail} falha(s)` : ''}` });
    load(folderId);
  }

  async function handleDelete(f: DriveFile) {
    if (!confirm(`Excluir "${f.name}"? O arquivo será movido para a lixeira do Drive.`)) return;
    try {
      await callDrive('delete', { fileId: f.id });
      toast({ title: 'Excluído' });
      load(folderId);
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await callDrive('rename', { fileId: renameTarget.id, name: renameName.trim() });
      setRenameTarget(null);
      setRenameName('');
      load(folderId);
    } catch (e: any) {
      toast({ title: 'Erro ao renomear', description: e.message, variant: 'destructive' });
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await callDrive('createFolder', {
        name: newFolderName.trim(),
        parents: folderId === 'root' ? undefined : folderId,
      });
      setNewFolderOpen(false);
      setNewFolderName('');
      load(folderId);
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(folderId, search || undefined);
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 p-3 border-b bg-card">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          {breadcrumb.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => navigateTo(breadcrumb.length - 2)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {breadcrumb.map((b, idx) => (
            <div key={b.id} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigateTo(idx)}
                className={`hover:underline ${idx === breadcrumb.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {b.name}
              </button>
              {idx < breadcrumb.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nesta pasta..."
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Buscar</Button>
          </form>
          <div className="flex gap-2">
            {mode === 'manage' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-1" />Pasta
                </Button>
                <label>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
                  />
                  <Button size="sm" variant="outline" disabled={uploading} asChild>
                    <span className="cursor-pointer">
                      {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => load(folderId, search || undefined)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && files.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        )}
        {!loading && files.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">Pasta vazia</div>
        )}
        <ul className="divide-y">
          {files.map((f) => {
            const folder = isFolder(f);
            const isSel = !!selected[f.id];
            return (
              <li key={f.id} className={`flex items-center gap-2 px-3 py-2 hover:bg-muted/50 ${isSel ? 'bg-primary/10' : ''}`}>
                {mode === 'picker' && !folder && (
                  <button
                    onClick={() => toggleSelect(f)}
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}
                  >
                    {isSel && <Check className="h-3 w-3" />}
                  </button>
                )}
                <button
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  onClick={() => folder ? enterFolder(f) : (mode === 'picker' ? toggleSelect(f) : handleDownload(f))}
                >
                  {folder
                    ? <Folder className="h-4 w-4 text-amber-600 shrink-0" />
                    : <FileText className="h-4 w-4 text-primary shrink-0" />}
                  <span className="truncate text-sm">{f.name}</span>
                </button>
                <span className="hidden sm:inline text-xs text-muted-foreground shrink-0 w-20 text-right">
                  {f.size ? `${(Number(f.size) / 1024).toFixed(0)} KB` : '—'}
                </span>
                <span className="hidden md:inline text-xs text-muted-foreground shrink-0 w-24 text-right">
                  {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('pt-BR') : ''}
                </span>
                {mode === 'manage' && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!folder && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(f)} title="Baixar">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {f.webViewLink && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild title="Abrir no Drive">
                        <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setRenameTarget(f); setRenameName(f.name); }} title="Renomear">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(f)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Picker footer */}
      {mode === 'picker' && (
        <div className="border-t p-3 flex items-center justify-between bg-card">
          <span className="text-sm text-muted-foreground">
            {selectedCount} arquivo(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={selectedCount === 0}
              onClick={() => { onPick?.(Object.values(selected)); onClose?.(); }}
            >
              Anexar
            </Button>
          </div>
        </div>
      )}

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Novo nome</Label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}