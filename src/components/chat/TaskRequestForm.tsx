import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, X, MessageSquare } from 'lucide-react';
import { MessagePicker, type PickedItem } from './MessagePicker';

type TaskTemplate = {
  id: string; name: string; department_id: string; description: string | null; default_due_days: number;
  notify_whatsapp?: boolean; notify_email?: boolean; notify_message?: string | null; notify_email_subject?: string | null;
};
type Client = { id: string; company_name: string };
type Profile = { user_id: string; full_name: string | null; department_id: string | null };
type Department = { id: string; name: string };

interface TaskRequestFormProps {
  defaultClientId?: string | null;
  defaultTemplateId?: string | null;
  restrictToPhone?: string | null;
  conversationId?: string | null;
  onCreated?: () => void;
}

export function TaskRequestForm({ defaultClientId, defaultTemplateId, restrictToPhone, conversationId, onCreated }: TaskRequestFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [linkedClientIds, setLinkedClientIds] = useState<string[] | null>(null);

  const [requestTemplate, setRequestTemplate] = useState<TaskTemplate | null>(null);
  const [requestCustomTitle, setRequestCustomTitle] = useState('');
  const [requestForm, setRequestForm] = useState({
    client_id: defaultClientId || '',
    due_date: '',
    assigned_to: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    description: '',
    department_id: '',
  });
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: tpl }, { data: c }, { data: p }, { data: d }] = await Promise.all([
        supabase.from('task_templates').select('*').order('name'),
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('profiles').select('user_id, full_name, department_id'),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      setTemplates((tpl as TaskTemplate[]) || []);
      setClients((c as Client[]) || []);
      setProfiles((p as Profile[]) || []);
      setDepartments((d as Department[]) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!restrictToPhone) { setLinkedClientIds(null); return; }
      const digits = restrictToPhone.replace(/\D/g, '');
      const search = digits.length > 4 ? digits.slice(-8) : digits;
      if (!search) { setLinkedClientIds([]); return; }
      const { data } = await supabase
        .from('client_department_contacts')
        .select('client_id, contact_phone');
      const ids = [...new Set((data || [])
        .filter((c: any) => c.contact_phone && c.contact_phone.replace(/\D/g, '').includes(search))
        .map((c: any) => c.client_id))] as string[];
      setLinkedClientIds(ids);
      if (ids.length === 1) setRequestForm(f => ({ ...f, client_id: f.client_id || ids[0] }));
    })();
  }, [restrictToPhone]);

  useEffect(() => {
    if (defaultClientId) {
      setRequestForm(f => ({ ...f, client_id: defaultClientId }));
    }
  }, [defaultClientId]);

  useEffect(() => {
    if (defaultTemplateId && templates.length > 0) {
      const tpl = templates.find(t => t.id === defaultTemplateId) || null;
      if (tpl) {
        setRequestTemplate(tpl);
        const due = new Date(); due.setDate(due.getDate() + (tpl.default_due_days || 7));
        setRequestForm(f => ({ ...f, description: tpl.description || '', due_date: due.toISOString().split('T')[0] }));
      }
    }
  }, [defaultTemplateId, templates]);

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
      department_id: requestTemplate?.department_id || requestForm.department_id || null,
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
    if (data?.id && pickedItems.length > 0) {
      const failed: string[] = [];
      const mediaItems = pickedItems.filter((i) => i.kind === 'media' && i.media_url);
      const textItems = pickedItems.filter((i) => i.kind === 'text');
      // Media: download from public URL, re-upload to documents bucket
      for (const item of mediaItems) {
        try {
          const resp = await fetch(item.media_url!);
          if (!resp.ok) { failed.push(item.media_url!.split('/').pop() || 'mídia'); continue; }
          const blob = await resp.blob();
          const rawName = decodeURIComponent((item.media_url || '').split('/').pop() || 'arquivo').replace(/^\d+_/, '');
          const safe = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
          const path = `tasks/${data.id}/${Date.now()}_${safe}`;
          const up = await supabase.storage.from('documents').upload(path, blob, { contentType: blob.type || undefined });
          if (up.error) { failed.push(rawName); continue; }
          const ins = await supabase.from('task_attachments').insert({
            task_id: data.id,
            file_url: path,
            file_name: rawName,
            file_type: blob.type || null,
            file_size: blob.size,
            uploaded_by: user?.id,
            direction: 'input',
          } as any);
          if (ins.error) failed.push(rawName);
        } catch {
          failed.push('mídia da conversa');
        }
      }
      // Text messages: bundle into a single .txt
      if (textItems.length > 0) {
        const lines = textItems
          .slice()
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((i) => {
            const dt = new Date(i.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `[${dt}] ${i.sender_name}:\n${i.content || '(sem conteúdo)'}\n`;
          });
        const content = `Mensagens selecionadas da conversa\n\n${lines.join('\n')}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const fileName = `mensagens-da-conversa-${Date.now()}.txt`;
        const path = `tasks/${data.id}/${fileName}`;
        const up = await supabase.storage.from('documents').upload(path, blob, { contentType: 'text/plain' });
        if (up.error) { failed.push(fileName); }
        else {
          const ins = await supabase.from('task_attachments').insert({
            task_id: data.id,
            file_url: path,
            file_name: fileName,
            file_type: 'text/plain',
            file_size: blob.size,
            uploaded_by: user?.id,
            direction: 'input',
          } as any);
          if (ins.error) failed.push(fileName);
        }
      }
      if (failed.length > 0) {
        toast({ title: 'Alguns itens da conversa falharam', description: failed.join(', '), variant: 'destructive' });
      }
    }
    setUploading(false);
    setRequestTemplate(null);
    setRequestCustomTitle('');
    setRequestForm({ client_id: defaultClientId || '', due_date: '', assigned_to: [], priority: 'medium', description: '', department_id: '' });
    setRequestFiles([]);
    setPickedItems([]);
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
                setRequestForm(f => ({ ...f, description: tpl.description || '', due_date: due.toISOString().split('T')[0], assigned_to: [] }));
                setRequestCustomTitle('');
              } else {
                setRequestForm(f => ({ ...f, assigned_to: [] }));
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
        {(() => {
          const list = linkedClientIds === null ? clients : clients.filter(c => linkedClientIds.includes(c.id));
          if (linkedClientIds !== null && list.length === 0) {
            return <p className="text-sm text-muted-foreground">Nenhum cliente vinculado a este contato.</p>;
          }
          return (
            <Select value={requestForm.client_id} onValueChange={v => setRequestForm({ ...requestForm, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {list.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        })()}
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} rows={3} placeholder="Detalhes da solicitação" />
      </div>
      {!requestTemplate && (
        <div className="space-y-2">
          <Label>Departamento</Label>
          <Select
            value={requestForm.department_id || 'none'}
            onValueChange={v => setRequestForm(f => ({ ...f, department_id: v === 'none' ? '' : v }))}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem departamento —</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
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
        <Select
          value={requestForm.assigned_to[0] || 'none'}
          onValueChange={(v) => setRequestForm(f => ({ ...f, assigned_to: v === 'none' ? [] : [v] }))}
        >
          <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Livre para o departamento —</SelectItem>
            {profiles
              .filter(p => !requestTemplate?.department_id || p.department_id === requestTemplate.department_id)
              .map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || 'Sem nome'}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Anexos (documentos/imagens)</Label>
        {conversationId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPickerOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Selecionar da conversa{pickedItems.length > 0 ? ` (${pickedItems.length})` : ''}
          </Button>
        )}
        {pickedItems.length > 0 && (
          <div className="space-y-1">
            {pickedItems.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm bg-muted px-2 py-1 rounded">
                <span className="truncate">
                  <span className="text-muted-foreground text-xs mr-1">{p.kind === 'media' ? '📎' : '💬'}</span>
                  {p.kind === 'media'
                    ? decodeURIComponent((p.media_url || '').split('/').pop() || 'arquivo').replace(/^\d+_/, '')
                    : (p.content?.slice(0, 60) || '(sem conteúdo)') + ((p.content || '').length > 60 ? '…' : '')}
                  <span className="text-muted-foreground text-xs ml-1">— {p.sender_name}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPickedItems((prev) => prev.filter((x) => x.id !== p.id))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
      {conversationId && (
        <MessagePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          conversationId={conversationId}
          initialSelectedIds={pickedItems.map((p) => p.id)}
          onConfirm={(items) => setPickedItems(items)}
        />
      )}
    </form>
  );
}