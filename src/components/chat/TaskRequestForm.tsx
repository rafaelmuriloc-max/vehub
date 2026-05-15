import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, X } from 'lucide-react';

type TaskTemplate = {
  id: string; name: string; department_id: string; description: string | null; default_due_days: number;
  notify_whatsapp?: boolean; notify_email?: boolean; notify_message?: string | null; notify_email_subject?: string | null;
};
type Client = { id: string; company_name: string };
type Profile = { user_id: string; full_name: string | null };

interface TaskRequestFormProps {
  defaultClientId?: string | null;
  onCreated?: () => void;
}

export function TaskRequestForm({ defaultClientId, onCreated }: TaskRequestFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [requestTemplate, setRequestTemplate] = useState<TaskTemplate | null>(null);
  const [requestCustomTitle, setRequestCustomTitle] = useState('');
  const [requestForm, setRequestForm] = useState({
    client_id: defaultClientId || '',
    due_date: '',
    assigned_to: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    description: '',
  });
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: tpl }, { data: c }, { data: p }] = await Promise.all([
        supabase.from('task_templates').select('*').order('name'),
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      setTemplates((tpl as TaskTemplate[]) || []);
      setClients((c as Client[]) || []);
      setProfiles((p as Profile[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (defaultClientId) {
      setRequestForm(f => ({ ...f, client_id: defaultClientId }));
    }
  }, [defaultClientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requestForm.client_id) {
      toast({ title: 'Selecione o cliente', variant: 'destructive' }); return;
    }
    if (!requestTemplate && !requestCustomTitle.trim()) {
      toast({ title: 'Informe o nome ou selecione uma tarefa cadastrada', variant: 'destructive' }); return;
    }
    setUploading(true);
    const { data, error } = await supabase.from('tasks').insert({
      title: requestTemplate ? requestTemplate.name : requestCustomTitle.trim(),
      description: requestForm.description || null,
      status: 'todo',
      priority: requestForm.priority,
      due_date: requestForm.due_date || null,
      client_id: requestForm.client_id,
      department_id: requestTemplate?.department_id || null,
      template_id: requestTemplate?.id || null,
      created_by: user?.id,
      notify_whatsapp: !!requestTemplate?.notify_whatsapp,
      notify_email: !!requestTemplate?.notify_email,
      notify_message: requestTemplate?.notify_message || null,
      notify_email_subject: requestTemplate?.notify_email_subject || null,
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
    setRequestTemplate(null);
    setRequestCustomTitle('');
    setRequestForm({ client_id: defaultClientId || '', due_date: '', assigned_to: [], priority: 'medium', description: '' });
    setRequestFiles([]);
    toast({ title: 'Tarefa solicitada' });
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Tarefa cadastrada (opcional)</Label>
        <Select
          value={requestTemplate?.id || 'none'}
          onValueChange={(v) => {
            if (v === 'none') {
              setRequestTemplate(null);
            } else {
              const tpl = templates.find(t => t.id === v) || null;
              setRequestTemplate(tpl);
              if (tpl) {
                const due = new Date(); due.setDate(due.getDate() + (tpl.default_due_days || 7));
                setRequestForm(f => ({ ...f, description: tpl.description || '', due_date: due.toISOString().split('T')[0] }));
                setRequestCustomTitle('');
              }
            }
          }}
        >
          <SelectTrigger><SelectValue placeholder="Selecione uma tarefa do cadastro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Nenhuma (digitar nome livre) —</SelectItem>
            {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!requestTemplate && (
        <div className="space-y-2">
          <Label>Nome da tarefa *</Label>
          <Input value={requestCustomTitle} onChange={e => setRequestCustomTitle(e.target.value)} placeholder="Ex.: Enviar declaração para o cliente" />
        </div>
      )}
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select value={requestForm.client_id} onValueChange={v => setRequestForm({ ...requestForm, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} rows={3} placeholder="Detalhes da solicitação" />
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
  );
}