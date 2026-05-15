import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { X, ListTodo, Paperclip, Upload, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  phone: string | null;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}

interface TaskRow {
  id: string;
  task_number?: number | null;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  due_date: string | null;
  client_id: string | null;
  created_at: string;
  created_by: string | null;
  department_id: string | null;
  clients: { company_name: string } | null;
  departments?: { name: string } | null;
  task_assignments: { user_id: string }[];
  status?: string;
  notify_whatsapp?: boolean;
  notify_email?: boolean;
  notify_sent_at?: string | null;
}

const statusLabels: Record<string, string> = { todo: 'A Fazer', in_progress: 'Aguardando', done: 'Concluído' };
const statusColumns: string[] = ['todo', 'in_progress', 'done'];
const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};
const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

const today = () => new Date().toISOString().split('T')[0];
function getDueDateColor(due: string | null) {
  if (!due) return '';
  const t = today();
  if (due < t) return 'text-red-500';
  const diff = (new Date(due).getTime() - new Date(t).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return 'text-orange-500';
  return 'text-emerald-600';
}

const formatTaskNumber = (n: number | null | undefined) => n ? `#${String(n).padStart(6, '0')}` : '#------';
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function PendingTasksPanel({ phone, onClose, onCountChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, { input: number; output: number }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const loadAttachmentCounts = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) { setAttachmentCounts({}); return; }
    const { data } = await supabase
      .from('task_attachments')
      .select('task_id, direction')
      .in('task_id', taskIds);
    const counts: Record<string, { input: number; output: number }> = {};
    (data || []).forEach((a: any) => {
      const c = counts[a.task_id] || { input: 0, output: 0 };
      if (a.direction === 'output') c.output++; else c.input++;
      counts[a.task_id] = c;
    });
    setAttachmentCounts(counts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!phone) {
          if (!cancelled) { setTasks([]); onCountChangeRef.current?.(0); }
          return;
        }
        const digits = phone.replace(/\D/g, '');
        const search = digits.length > 4 ? digits.slice(-8) : digits;
        if (!search) {
          if (!cancelled) { setTasks([]); onCountChangeRef.current?.(0); }
          return;
        }
        const { data: contacts } = await supabase
          .from('client_department_contacts')
          .select('client_id, contact_phone');
        const ids = [...new Set((contacts || [])
          .filter((c: any) => c.contact_phone && c.contact_phone.replace(/\D/g, '').includes(search))
          .map((c: any) => c.client_id))] as string[];
        if (ids.length === 0) {
          if (!cancelled) { setTasks([]); onCountChangeRef.current?.(0); }
          return;
        }
        const { data } = await supabase
          .from('tasks')
          .select('id,task_number,title,priority,due_date,client_id,created_at,created_by,department_id,status,notify_whatsapp,notify_email,notify_sent_at,clients(company_name),departments(name),task_assignments(user_id)')
          .in('client_id', ids)
          .eq('status', 'todo')
          .order('due_date', { ascending: true, nullsFirst: false });
        if (!cancelled) {
          const rows = (data as any as TaskRow[]) || [];
          setTasks(rows);
          onCountChangeRef.current?.(rows.length);
          const userIds = [...new Set([
            ...rows.flatMap(r => (r.task_assignments || []).map(a => a.user_id)),
            ...rows.map(r => r.created_by).filter(Boolean) as string[],
          ])];
          if (userIds.length) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', userIds);
            const m: Record<string, string> = {};
            (profs || []).forEach((p: any) => { m[p.user_id] = p.full_name || ''; });
            if (!cancelled) setProfileMap(m);
          } else {
            setProfileMap({});
          }
          await loadAttachmentCounts(rows.map(r => r.id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phone, loadAttachmentCounts]);

  async function moveTask(taskId: string, newStatus: string) {
    const prev = tasks.find(t => t.id === taskId);
    setBusyId(taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus } as any).eq('id', taskId);
    if (error) { setBusyId(null); toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    if (newStatus === 'done' && prev && prev.status !== 'done'
        && (prev.notify_whatsapp || prev.notify_email)
        && !prev.notify_sent_at) {
      try {
        const { data, error: nErr } = await supabase.functions.invoke('task-notify-client', { body: { taskId } });
        if (nErr) {
          toast({ title: 'Falha ao notificar cliente', description: nErr.message, variant: 'destructive' });
        } else {
          const w = (data as any)?.whatsapp; const e = (data as any)?.email;
          const msgs: string[] = [];
          if (w) msgs.push(w.ok ? 'WhatsApp enviado' : `WhatsApp: ${w.error}`);
          if (e) msgs.push(e.ok ? 'E-mail enviado' : `E-mail: ${e.error}`);
          const anyOk = (w?.ok) || (e?.ok);
          toast({
            title: anyOk ? 'Cliente notificado' : 'Falha ao notificar cliente',
            description: msgs.join(' • '),
            variant: anyOk ? 'default' : 'destructive',
          });
        }
      } catch (err: any) {
        toast({ title: 'Erro ao notificar cliente', description: err.message, variant: 'destructive' });
      }
    }
    setBusyId(null);
    setTasks(curr => {
      const next = curr.filter(t => t.id !== taskId);
      onCountChangeRef.current?.(next.length);
      return next;
    });
    toast({ title: `Movida para ${statusLabels[newStatus] || newStatus}` });
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return;
    setBusyId(taskId);
    await supabase.from('task_assignments').delete().eq('task_id', taskId);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    setBusyId(null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTasks(prev => {
      const next = prev.filter(t => t.id !== taskId);
      onCountChangeRef.current?.(next.length);
      return next;
    });
    toast({ title: 'Tarefa excluída' });
  }

  async function uploadOutput(taskId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusyId(taskId);
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
    setBusyId(null);
    await loadAttachmentCounts(tasks.map(t => t.id));
    if (failed.length > 0) toast({ title: 'Alguns anexos falharam', description: failed.join(', '), variant: 'destructive' });
    else toast({ title: 'Arquivos para o cliente anexados' });
  }

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Tarefas pendentes</h2>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          )}
          {!loading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma tarefa "A Fazer" para as empresas vinculadas a este contato.
            </p>
          )}
          {!loading && tasks.map((task) => {
            const assignees = task.task_assignments || [];
            return (
              <Card
                key={task.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${busyId === task.id ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => window.open(`/tasks?id=${task.id}`, '_blank')}
              >
                <CardContent className="p-3 space-y-2">
                  <p className="font-medium text-sm">{task.title}</p>
                  <div className="flex flex-wrap gap-1 items-center">
                    <Badge className={priorityColors[task.priority]} variant="secondary">{priorityLabels[task.priority] || task.priority}</Badge>
                    {task.due_date && (
                      <span className={`text-xs ${getDueDateColor(task.due_date)}`}>
                        {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {task.clients?.company_name && (
                    <p className="text-xs text-muted-foreground">{task.clients.company_name}</p>
                  )}
                  {assignees.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {assignees.map(a => (
                        <Badge key={a.user_id} variant="outline" className="text-xs">{profileMap[a.user_id] || 'Sem nome'}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
                    {statusColumns.filter(s => s !== 'todo').slice(0, 2).map(s => (
                      <Button
                        key={s}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={(e) => { e.stopPropagation(); moveTask(task.id, s); }}
                      >
                        → {statusLabels[s]}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t mt-1">
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      {(attachmentCounts[task.id]?.input || 0) > 0 && (
                        <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{attachmentCounts[task.id].input}</span>
                      )}
                      {(attachmentCounts[task.id]?.output || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-primary"><Upload className="h-3 w-3" />{attachmentCounts[task.id].output}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="cursor-pointer text-xs flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        <Upload className="h-3 w-3" />Para o cliente
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => { uploadOutput(task.id, e.target.files); e.target.value = ''; }}
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}