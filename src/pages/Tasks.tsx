import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Send, Paperclip, X, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

type Task = {
  id: string; title: string; description: string | null; status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent'; due_date: string | null; client_id: string | null;
  created_by: string | null; created_at: string; department_id?: string | null; template_id?: string | null;
  notify_whatsapp?: boolean; notify_email?: boolean; notify_message?: string | null;
  notify_email_subject?: string | null; notify_sent_at?: string | null;
};
type Profile = { user_id: string; full_name: string | null };
type Client = { id: string; company_name: string };
type Department = { id: string; name: string };
type TaskTemplate = {
  id: string; name: string; department_id: string; description: string | null; default_due_days: number;
  notify_whatsapp?: boolean; notify_email?: boolean; notify_message?: string | null; notify_email_subject?: string | null;
};
type TaskAttachment = { id: string; file_name: string; file_url: string; file_type: string | null; file_size: number | null; uploaded_by: string | null; direction?: 'input' | 'output' };

const statusLabels: Record<string, string> = { todo: 'A Fazer', in_progress: 'Aguardando', done: 'Concluído' };
const statusColumns: string[] = ['todo', 'in_progress', 'done'];
const priorityColors: Record<string, string> = { low: 'bg-muted text-muted-foreground', medium: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };
const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo' as Task['status'], priority: 'medium' as Task['priority'],
    due_date: '', client_id: '', assigned_to: [] as string[],
  });

  // Templates state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '', department_id: '', description: '', default_due_days: '7',
    notify_whatsapp: false, notify_email: false, notify_message: '', notify_email_subject: '',
  });
  const [templateFilterDept, setTemplateFilterDept] = useState<string>('all');

  // Solicitar state
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTemplate, setRequestTemplate] = useState<TaskTemplate | null>(null);
  const [requestForm, setRequestForm] = useState({ client_id: '', due_date: '', assigned_to: [] as string[], priority: 'medium' as Task['priority'] });
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editAttachments, setEditAttachments] = useState<TaskAttachment[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, { input: number; output: number }>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: t }, { data: p }, { data: c }, { data: a }, { data: d }, { data: tpl }, { data: att }] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('clients').select('id, company_name').order('company_name'),
      supabase.from('task_assignments').select('task_id, user_id'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('task_templates').select('*').order('name'),
      supabase.from('task_attachments').select('task_id, direction'),
    ]);
    setTasks((t as Task[]) || []);
    setProfiles((p as Profile[]) || []);
    setClients((c as Client[]) || []);
    setDepartments((d as Department[]) || []);
    setTemplates((tpl as TaskTemplate[]) || []);
    const aMap: Record<string, string[]> = {};
    (a || []).forEach((x: any) => { if (!aMap[x.task_id]) aMap[x.task_id] = []; aMap[x.task_id].push(x.user_id); });
    setAssignments(aMap);
    const cMap: Record<string, { input: number; output: number }> = {};
    (att || []).forEach((x: any) => {
      if (!cMap[x.task_id]) cMap[x.task_id] = { input: 0, output: 0 };
      const dir = (x.direction || 'input') as 'input' | 'output';
      cMap[x.task_id][dir]++;
    });
    setAttachmentCounts(cMap);
  }

  function openNew() {
    setEditing(null);
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', client_id: '', assigned_to: [] });
    setDialogOpen(true);
  }

  async function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title, description: task.description || '', status: task.status,
      priority: task.priority, due_date: task.due_date || '', client_id: task.client_id || '',
      assigned_to: assignments[task.id] || [],
    });
    setEditNewFiles([]);
    setEditAttachments([]);
    setDialogOpen(true);
    const { data } = await supabase.from('task_attachments').select('*').eq('task_id', task.id).order('created_at', { ascending: true });
    setEditAttachments((data as TaskAttachment[]) || []);
  }

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
    loadData();
    if (failed.length > 0) toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
    else toast({ title: 'Anexos adicionados' });
  }

  async function uploadCardOutputFiles(taskId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
      const path = `tasks/${taskId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
      if (up.error) { failed.push(file.name); continue; }
      const { error } = await supabase.from('task_attachments').insert({
        task_id: taskId, file_url: path, file_name: file.name,
        file_type: file.type || null, file_size: file.size, uploaded_by: user?.id, direction: 'output',
      } as any);
      if (error) failed.push(file.name);
    }
    setUploading(false);
    loadData();
    if (failed.length > 0) toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
    else toast({ title: 'Arquivos para o cliente anexados' });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title, description: form.description || null, status: form.status,
      priority: form.priority, due_date: form.due_date || null, client_id: form.client_id || null,
    };
    let error;
    let taskId: string;
    const wasDone = editing?.status === 'done';
    if (editing) {
      taskId = editing.id;
      ({ error } = await supabase.from('tasks').update(payload as any).eq('id', editing.id));
    } else {
      const { data, error: err } = await supabase.from('tasks').insert({ ...payload, created_by: user?.id } as any).select('id').single();
      error = err;
      taskId = data?.id || '';
    }
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    // Update assignments
    if (editing) await supabase.from('task_assignments').delete().eq('task_id', taskId);
    if (form.assigned_to.length > 0) {
      await supabase.from('task_assignments').insert(form.assigned_to.map(uid => ({ task_id: taskId, user_id: uid })));
    }

    setDialogOpen(false);
    if (form.status === 'done' && !wasDone && editing && (editing.notify_whatsapp || editing.notify_email) && !editing.notify_sent_at) {
      await triggerNotify(taskId);
    }
    loadData();
    toast({ title: editing ? 'Tarefa atualizada' : 'Tarefa criada' });
  }

  async function moveTask(taskId: string, newStatus: Task['status']) {
    const prev = tasks.find(t => t.id === taskId);
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (newStatus === 'done' && prev?.status !== 'done' && (prev?.notify_whatsapp || prev?.notify_email) && !prev?.notify_sent_at) {
      await triggerNotify(taskId);
    }
    loadData();
  }

  async function triggerNotify(taskId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('task-notify-client', { body: { taskId } });
      if (error) { toast({ title: 'Falha ao notificar cliente', description: error.message, variant: 'destructive' }); return; }
      const w = data?.whatsapp; const e = data?.email;
      const msgs: string[] = [];
      if (w) msgs.push(w.ok ? 'WhatsApp enviado' : `WhatsApp: ${w.error}`);
      if (e) msgs.push(e.ok ? 'E-mail enviado' : `E-mail: ${e.error}`);
      const anyOk = (w?.ok) || (e?.ok);
      toast({ title: anyOk ? 'Cliente notificado' : 'Falha ao notificar cliente', description: msgs.join(' • '), variant: anyOk ? 'default' : 'destructive' });
    } catch (err: any) {
      toast({ title: 'Erro ao notificar cliente', description: err.message, variant: 'destructive' });
    }
  }

  const today = new Date().toISOString().split('T')[0];

  function getDueDateColor(due: string | null) {
    if (!due) return '';
    if (due < today) return 'text-red-500';
    const diff = (new Date(due).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 3) return 'text-orange-500';
    return 'text-emerald-600';
  }

  const getClientName = (id: string | null) => clients.find(c => c.id === id)?.company_name || '';
  const getProfileName = (uid: string) => profiles.find(p => p.user_id === uid)?.full_name || 'Sem nome';
  const getDeptName = (id: string | null | undefined) => departments.find(d => d.id === id)?.name || '';

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', department_id: '', description: '', default_due_days: '7',
      notify_whatsapp: false, notify_email: false, notify_message: '', notify_email_subject: '' });
    setTemplateDialogOpen(true);
  }
  function openEditTemplate(tpl: TaskTemplate) {
    setEditingTemplate(tpl);
    setTemplateForm({
      name: tpl.name, department_id: tpl.department_id, description: tpl.description || '',
      default_due_days: String(tpl.default_due_days),
      notify_whatsapp: !!tpl.notify_whatsapp,
      notify_email: !!tpl.notify_email,
      notify_message: tpl.notify_message || '',
      notify_email_subject: tpl.notify_email_subject || '',
    });
    setTemplateDialogOpen(true);
  }
  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!templateForm.name || !templateForm.department_id) {
      toast({ title: 'Preencha nome e departamento', variant: 'destructive' }); return;
    }
    const payload = {
      name: templateForm.name,
      department_id: templateForm.department_id,
      description: templateForm.description || null,
      default_due_days: parseInt(templateForm.default_due_days) || 7,
      notify_whatsapp: templateForm.notify_whatsapp,
      notify_email: templateForm.notify_email,
      notify_message: templateForm.notify_message || null,
      notify_email_subject: templateForm.notify_email_subject || null,
    };
    const { error } = editingTemplate
      ? await supabase.from('task_templates').update(payload as any).eq('id', editingTemplate.id)
      : await supabase.from('task_templates').insert({ ...payload, created_by: user?.id } as any);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTemplateDialogOpen(false); loadData();
    toast({ title: editingTemplate ? 'Tarefa atualizada' : 'Tarefa cadastrada' });
  }
  async function deleteTemplate(id: string) {
    if (!confirm('Excluir esta tarefa do cadastro?')) return;
    const { error } = await supabase.from('task_templates').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    loadData(); toast({ title: 'Removida' });
  }

  function openRequest(tpl: TaskTemplate) {
    setRequestTemplate(tpl);
    const due = new Date(); due.setDate(due.getDate() + (tpl.default_due_days || 7));
    setRequestForm({ client_id: '', due_date: due.toISOString().split('T')[0], assigned_to: [], priority: 'medium' });
    setRequestFiles([]);
    setRequestOpen(true);
  }
  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestTemplate || !requestForm.client_id) {
      toast({ title: 'Selecione o cliente', variant: 'destructive' }); return;
    }
    setUploading(true);
    const { data, error } = await supabase.from('tasks').insert({
      title: requestTemplate.name,
      description: requestTemplate.description || null,
      status: 'todo',
      priority: requestForm.priority,
      due_date: requestForm.due_date || null,
      client_id: requestForm.client_id,
      department_id: requestTemplate.department_id,
      template_id: requestTemplate.id,
      created_by: user?.id,
      notify_whatsapp: !!requestTemplate.notify_whatsapp,
      notify_email: !!requestTemplate.notify_email,
      notify_message: requestTemplate.notify_message || null,
      notify_email_subject: requestTemplate.notify_email_subject || null,
    } as any).select('id').single();
    if (error) { setUploading(false); toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    if (requestForm.assigned_to.length > 0 && data?.id) {
      await supabase.from('task_assignments').insert(requestForm.assigned_to.map(uid => ({ task_id: data.id, user_id: uid })));
    }
    if (data?.id && requestFiles.length > 0) {
      const failed: string[] = [];
      for (const file of requestFiles) {
        const safe = file.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w.\-]+/g, '_');
        const path = `tasks/${data.id}/${Date.now()}_${safe}`;
        const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
        if (up.error) { failed.push(file.name); continue; }
        const ins = await supabase.from('task_attachments').insert({
          task_id: data.id,
          file_url: path,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: user?.id,
        } as any);
        if (ins.error) failed.push(file.name);
      }
      if (failed.length > 0) {
        toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
      }
    }
    setUploading(false);
    setRequestOpen(false); loadData();
    toast({ title: 'Tarefa solicitada' });
  }

  const filteredTemplates = templates.filter(t => templateFilterDept === 'all' || t.department_id === templateFilterDept);

  const filteredTasks = tasks.filter(t => {
    return (filterStatus === 'all' || t.status === filterStatus) && (filterPriority === 'all' || t.priority === filterPriority);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Tarefa</Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="catalog">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="grid gap-4 md:grid-cols-3">
            {statusColumns.map(col => (
              <div key={col} className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{statusLabels[col]}
                  <Badge variant="secondary" className="ml-2">{tasks.filter(t => t.status === col).length}</Badge>
                </h3>
                <div className="space-y-2 min-h-[200px]">
                  {tasks.filter(t => t.status === col).map(task => (
                    <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(task)}>
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={priorityColors[task.priority]} variant="secondary">{priorityLabels[task.priority]}</Badge>
                          {task.due_date && <span className={`text-xs ${getDueDateColor(task.due_date)}`}>{new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        </div>
                        {task.client_id && <p className="text-xs text-muted-foreground">{getClientName(task.client_id)}</p>}
                        {assignments[task.id]?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {assignments[task.id].map(uid => (
                              <Badge key={uid} variant="outline" className="text-xs">{getProfileName(uid)}</Badge>
                            ))}
                          </div>
                        )}
                        {col !== 'done' && (
                          <div className="flex gap-1 pt-1">
                            {statusColumns.filter(s => s !== col).slice(0, 2).map(s => (
                              <Button key={s} variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={(e) => { e.stopPropagation(); moveTask(task.id, s as Task['status']); }}>
                                → {statusLabels[s]}
                              </Button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t mt-1">
                          <div className="flex gap-1 text-xs text-muted-foreground">
                            {(attachmentCounts[task.id]?.input || 0) > 0 && (
                              <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{attachmentCounts[task.id].input}</span>
                            )}
                            {(attachmentCounts[task.id]?.output || 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-primary"><Upload className="h-3 w-3" />{attachmentCounts[task.id].output}</span>
                            )}
                          </div>
                          <label className="cursor-pointer text-xs flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            <Upload className="h-3 w-3" />Para o cliente
                            <input type="file" multiple className="hidden" onChange={(e) => { uploadCardOutputFiles(task.id, e.target.files); e.target.value = ''; }} />
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusColumns.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(task)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{task.title}</p>
                    <div className="flex gap-2 items-center">
                      <Badge className={priorityColors[task.priority]} variant="secondary">{priorityLabels[task.priority]}</Badge>
                      <Badge variant="outline">{statusLabels[task.status]}</Badge>
                      {task.due_date && <span className={`text-sm ${getDueDateColor(task.due_date)}`}>{new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      {task.client_id && <span className="text-sm text-muted-foreground">{getClientName(task.client_id)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {assignments[task.id]?.map(uid => (
                      <Badge key={uid} variant="outline" className="text-xs">{getProfileName(uid)}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredTasks.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada</p>}
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Select value={templateFilterDept} onValueChange={setTemplateFilterDept}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button onClick={openNewTemplate}><Plus className="mr-2 h-4 w-4" />Nova Tarefa Cadastrada</Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Prazo (dias)</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(tpl => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell>{getDeptName(tpl.department_id)}</TableCell>
                      <TableCell>{tpl.default_due_days}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-md truncate">{tpl.description}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="default" onClick={() => openRequest(tpl)}>
                          <Send className="h-3 w-3 mr-1" />Solicitar
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEditTemplate(tpl)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteTemplate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma tarefa cadastrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusColumns.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as any })}>
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
            {editing && (
              <>
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
                      <div className="flex items-center gap-2 pt-1">
                        <Input type="file" multiple onChange={e => setEditNewFiles(Array.from(e.target.files || []))} className="text-xs" />
                        <Button type="button" size="sm" disabled={uploading || editNewFiles.length === 0} onClick={() => uploadEditFiles(dir)}>
                          {uploading ? 'Enviando...' : 'Anexar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            <Button type="submit" className="w-full">{editing ? 'Salvar' : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template CRUD Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Editar Tarefa Cadastrada' : 'Nova Tarefa Cadastrada'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select value={templateForm.department_id} onValueChange={v => setTemplateForm({ ...templateForm, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Prazo de entrega (dias)</Label><Input type="number" min="1" value={templateForm.default_due_days} onChange={e => setTemplateForm({ ...templateForm, default_due_days: e.target.value })} /></div>
            <Button type="submit" className="w-full">{editingTemplate ? 'Salvar' : 'Cadastrar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Solicitar Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Solicitar: {requestTemplate?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={requestForm.client_id} onValueChange={v => setRequestForm({ ...requestForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={requestForm.due_date} onChange={e => setRequestForm({ ...requestForm, due_date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={requestForm.priority} onValueChange={v => setRequestForm({ ...requestForm, priority: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Atribuir a (opcional — vazio = livre para o departamento)</Label>
              <div className="flex flex-wrap gap-2">
                {profiles.map(p => (
                  <Badge key={p.user_id} variant={requestForm.assigned_to.includes(p.user_id) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => {
                      setRequestForm(f => ({ ...f, assigned_to: f.assigned_to.includes(p.user_id) ? f.assigned_to.filter(x => x !== p.user_id) : [...f.assigned_to, p.user_id] }));
                    }}>
                    {p.full_name || 'Sem nome'}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Anexos (documentos/imagens)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                onChange={(e) => {
                  const fs = Array.from(e.target.files || []);
                  setRequestFiles(prev => [...prev, ...fs]);
                  e.target.value = '';
                }}
              />
              {requestFiles.length > 0 && (
                <div className="space-y-1">
                  {requestFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted px-2 py-1 rounded">
                      <span className="truncate">{f.name} <span className="text-muted-foreground text-xs">({(f.size / 1024).toFixed(0)} KB)</span></span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setRequestFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? 'Enviando…' : 'Solicitar Tarefa'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
