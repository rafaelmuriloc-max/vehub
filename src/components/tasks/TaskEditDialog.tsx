import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Upload, X, HardDrive } from 'lucide-react';
import { DrivePickerDialog } from '@/components/drive/DrivePickerDialog';
import { downloadDriveFile } from '@/components/drive/DriveBrowser';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

type Task = {
  id: string; title: string; description: string | null; status: TaskStatus;
  priority: TaskPriority; due_date: string | null; client_id: string | null;
  department_id: string | null;
  notify_whatsapp?: boolean; notify_email?: boolean; notify_sent_at?: string | null;
};
type Profile = { user_id: string; full_name: string | null };
type Client = { id: string; company_name: string };
type Department = { id: string; name: string };
type TaskAttachment = {
  id: string; file_name: string; file_url: string; file_type: string | null;
  file_size: number | null; uploaded_by: string | null; direction?: 'input' | 'output';
};

const statusLabels: Record<TaskStatus, string> = { todo: 'A Fazer', in_progress: 'Aguardando', done: 'Concluído' };
const statusColumns: TaskStatus[] = ['todo', 'in_progress', 'done'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: string | null;
  onSaved?: () => void;
}

export function TaskEditDialog({ open, onOpenChange, taskId, onSaved }: Props) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editAttachments, setEditAttachments] = useState<TaskAttachment[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerDir, setDrivePickerDir] = useState<'input' | 'output'>('input');

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo' as TaskStatus, priority: 'medium' as TaskPriority,
    due_date: '', client_id: '', department_id: '', assigned_to: [] as string[],
  });

  useEffect(() => {
    if (!open || !taskId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: a }, { data: att }, { data: p }, { data: c }, { data: d }] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
        supabase.from('task_assignments').select('user_id').eq('task_id', taskId),
        supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      if (cancelled) return;
      const task = t as Task | null;
      setEditing(task);
      setProfiles((p as Profile[]) || []);
      setClients((c as Client[]) || []);
      setDepartments((d as Department[]) || []);
      setEditAttachments((att as TaskAttachment[]) || []);
      setEditNewFiles([]);
      if (task) {
        setForm({
          title: task.title, description: task.description || '', status: task.status,
          priority: task.priority, due_date: task.due_date || '', client_id: task.client_id || '',
          department_id: task.department_id || '',
          assigned_to: ((a as any[]) || []).map((x) => x.user_id),
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, taskId]);

  async function downloadAttachment(att: TaskAttachment) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(att.file_url, 60);
    if (error || !data?.signedUrl) { toast({ title: 'Erro ao baixar', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function removeAttachment(att: TaskAttachment) {
    if (!confirm('Remover este anexo?')) return;
    await supabase.storage.from('documents').remove([att.file_url]);
    const { error } = await supabase.from('task_attachments').delete().eq('id', att.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditAttachments(prev => prev.filter(a => a.id !== att.id));
  }

  async function uploadEditFiles(direction: 'input' | 'output' = 'input') {
    if (!editing || editNewFiles.length === 0) return;
    setUploading(true);
    const failed: string[] = [];
    const inserted: TaskAttachment[] = [];
    for (const file of editNewFiles) {
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
      const path = `tasks/${editing.id}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
      if (up.error) { failed.push(file.name); continue; }
      const { data, error } = await supabase.from('task_attachments').insert({
        task_id: editing.id, file_url: path, file_name: file.name,
        file_type: file.type || null, file_size: file.size, uploaded_by: user?.id, direction,
      } as any).select('*').single();
      if (error || !data) { failed.push(file.name); continue; }
      inserted.push(data as TaskAttachment);
    }
    setEditAttachments(prev => [...prev, ...inserted]);
    setEditNewFiles([]);
    setUploading(false);
    if (inserted.length > 0 && direction === 'output') await promoteOnOutbound();
    if (failed.length > 0) toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
    else toast({ title: 'Anexos adicionados' });
  }

  // Ao anexar o documento de retorno, a tarefa deixa de ser "A Fazer" e vai para
  // "Aguardando" (falta apenas o envio ao cliente). Nunca rebaixa tarefas concluídas.
  async function promoteOnOutbound() {
    if (!editing || editing.status !== 'todo') return;
    const { error } = await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', editing.id);
    if (error) return;
    setEditing(prev => (prev ? { ...prev, status: 'in_progress' } : prev));
    setForm(prev => ({ ...prev, status: 'in_progress' as TaskStatus }));
  }

  async function triggerNotify(id: string) {
    try {
      const { data, error } = await supabase.functions.invoke('task-notify-client', { body: { taskId: id } });
      if (error) { toast({ title: 'Falha ao notificar cliente', description: error.message, variant: 'destructive' }); return; }
      const w = (data as any)?.whatsapp; const e = (data as any)?.email;
      const msgs: string[] = [];
      if (w) msgs.push(w.ok ? 'WhatsApp enviado' : `WhatsApp: ${w.error}`);
      if (e) msgs.push(e.ok ? 'E-mail enviado' : `E-mail: ${e.error}`);
      const anyOk = (w?.ok) || (e?.ok);
      toast({ title: anyOk ? 'Cliente notificado' : 'Falha ao notificar cliente', description: msgs.join(' • '), variant: anyOk ? 'default' : 'destructive' });
    } catch (err: any) {
      toast({ title: 'Erro ao notificar cliente', description: err.message, variant: 'destructive' });
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const wasDone = editing.status === 'done';
    const payload = {
      title: form.title, description: form.description || null, status: form.status,
      priority: form.priority, due_date: form.due_date || null, client_id: form.client_id || null,
      department_id: form.department_id || null,
    };
    const { error } = await supabase.from('tasks').update(payload as any).eq('id', editing.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('task_assignments').delete().eq('task_id', editing.id);
    if (form.assigned_to.length > 0) {
      await supabase.from('task_assignments').insert(form.assigned_to.map(uid => ({ task_id: editing.id, user_id: uid })));
    }
    if (form.status === 'done' && !wasDone && (editing.notify_whatsapp || editing.notify_email) && !editing.notify_sent_at) {
      await triggerNotify(editing.id);
    }
    onOpenChange(false);
    onSaved?.();
    toast({ title: 'Tarefa atualizada' });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
        {loading && <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>}
        {!loading && !editing && <p className="text-sm text-muted-foreground py-6 text-center">Tarefa não encontrada.</p>}
        {!loading && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusColumns.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Departamento</Label>
                <Select value={form.department_id || 'none'} onValueChange={v => setForm({ ...form, department_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem departamento —</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <div className="flex flex-wrap gap-2">
                {profiles.map(p => (
                  <Badge key={p.user_id} variant={form.assigned_to.includes(p.user_id) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => {
                      setForm(f => ({ ...f, assigned_to: f.assigned_to.includes(p.user_id) ? f.assigned_to.filter(x => x !== p.user_id) : [...f.assigned_to, p.user_id] }));
                    }}>
                    {p.full_name || 'Sem nome'}
                  </Badge>
                ))}
              </div>
            </div>
            {(editing.notify_whatsapp || editing.notify_email) && (
              <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30">
                Ao concluir, o cliente será notificado por
                {editing.notify_whatsapp ? ' WhatsApp' : ''}
                {editing.notify_whatsapp && editing.notify_email ? ' e' : ''}
                {editing.notify_email ? ' E-mail' : ''}.
                {editing.notify_sent_at && ' (Já enviado.)'}
              </div>
            )}
            {(['input', 'output'] as const).map(dir => {
              const list = editAttachments.filter(a => (a.direction || 'input') === dir);
              return (
                <div key={dir} className="space-y-2">
                  <Label>{dir === 'input' ? 'Anexos da solicitação' : 'Anexos para o cliente'}</Label>
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo</p>}
                  <div className="space-y-1">
                    {list.map(att => (
                      <div key={att.id} className="flex items-center gap-2 text-sm border rounded-md px-2 py-1.5">
                        {dir === 'input' ? <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" /> : <Upload className="h-4 w-4 text-primary shrink-0" />}
                        <button type="button" onClick={() => downloadAttachment(att)} className="flex-1 text-left truncate hover:underline text-primary">
                          {att.file_name}
                        </button>
                        {att.file_size != null && <span className="text-xs text-muted-foreground shrink-0">{(att.file_size / 1024).toFixed(1)} KB</span>}
                        {(att.uploaded_by === user?.id || isAdmin) && (
                          <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeAttachment(att)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                    <Input type="file" multiple onChange={e => setEditNewFiles(Array.from(e.target.files || []))} className="text-xs" />
                    <Button type="button" size="sm" className="w-full sm:w-auto" disabled={uploading || editNewFiles.length === 0} onClick={() => uploadEditFiles(dir)}>
                      {uploading ? 'Enviando...' : 'Anexar'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => { setDrivePickerDir(dir); setDrivePickerOpen(true); }}>
                      <HardDrive className="h-3.5 w-3.5 mr-1" />Drive
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        )}
      </DialogContent>
      <DrivePickerDialog
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        multiple
        onPick={async (picked) => {
          if (!editing || picked.length === 0) return;
          setUploading(true);
          const inserted: TaskAttachment[] = [];
          const failed: string[] = [];
          for (const df of picked) {
            try {
              const { blob, mimeType } = await downloadDriveFile(df.id);
              const safe = df.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
              const path = `tasks/${editing.id}/${Date.now()}_${safe}`;
              const file = new File([blob], df.name, { type: df.mimeType || mimeType });
              const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
              if (up.error) { failed.push(df.name); continue; }
              const { data, error } = await supabase.from('task_attachments').insert({
                task_id: editing.id, file_url: path, file_name: df.name,
                file_type: file.type || null, file_size: file.size, uploaded_by: user?.id, direction: drivePickerDir,
              } as any).select('*').single();
              if (error || !data) { failed.push(df.name); continue; }
              inserted.push(data as TaskAttachment);
            } catch {
              failed.push(df.name);
            }
          }
          setEditAttachments(prev => [...prev, ...inserted]);
          setUploading(false);
          if (inserted.length > 0 && drivePickerDir === 'output') await promoteOnOutbound();
          if (failed.length > 0) toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
          else toast({ title: 'Anexos adicionados do Drive' });
        }}
      />
    </Dialog>
  );
}