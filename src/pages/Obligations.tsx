import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Pencil, Trash2, ClipboardList, FileText, CheckSquare, MessageCircle, Mail,
  ChevronDown, ChevronRight, Zap,
} from 'lucide-react';

type Department = { id: string; name: string };
type Obligation = { id: string; department_id: string; name: string; description: string | null; recurrence: string; due_day: number | null; target_day: number | null; alert_day: number | null };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; order: number; document_type_id: string | null; auto_start: boolean; email_department_id: string | null; email_subject: string | null; email_body: string | null; whatsapp_template_name: string | null; whatsapp_message_body: string | null; whatsapp_button_url: string | null };
type DocumentType = { id: string; name: string };

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};
const activityTypeLabels: Record<string, string> = {
  document: 'Documento', checklist: 'Checklist', whatsapp: 'WhatsApp', email: 'E-mail',
};

export default function Obligations() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  const [obligationOpen, setObligationOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [obligationForm, setObligationForm] = useState({ name: '', description: '', department_id: '', recurrence: 'mensal', alert_day: '' as string, target_day: '' as string, due_day: '' as string });

  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ title: '', type: 'checklist', description: '', order: 0, obligation_id: '', document_type_id: '', auto_start: false, email_department_id: '', email_subject: '', email_body: '', whatsapp_template_name: '', whatsapp_message_body: '', whatsapp_button_url: '' });

  const [expandedObligation, setExpandedObligation] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dRes, oRes, aRes, dtRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('*').order('name'),
      supabase.from('obligation_activities').select('*').order('order'),
      supabase.from('document_types').select('id, name').order('name'),
    ]);
    if (dRes.data) setDepartments(dRes.data);
    if (oRes.data) setObligations(oRes.data);
    if (aRes.data) setActivities(aRes.data as Activity[]);
    if (dtRes.data) setDocumentTypes(dtRes.data as DocumentType[]);
  }

  // ---- Obligation CRUD ----
  function openNewObligation() {
    setEditingObligation(null);
    setObligationForm({ name: '', description: '', department_id: departments[0]?.id || '', recurrence: 'mensal', alert_day: '', target_day: '', due_day: '' });
    setObligationOpen(true);
  }
  function openEditObligation(o: Obligation) {
    setEditingObligation(o);
    setObligationForm({ name: o.name, description: o.description || '', department_id: o.department_id, recurrence: o.recurrence, alert_day: o.alert_day?.toString() || '', target_day: o.target_day?.toString() || '', due_day: o.due_day?.toString() || '' });
    setObligationOpen(true);
  }
  async function saveObligation(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: obligationForm.name,
      description: obligationForm.description || null,
      department_id: obligationForm.department_id,
      recurrence: obligationForm.recurrence,
      alert_day: obligationForm.alert_day ? Number(obligationForm.alert_day) : null,
      target_day: obligationForm.target_day ? Number(obligationForm.target_day) : null,
      due_day: obligationForm.due_day ? Number(obligationForm.due_day) : null,
    };
    const { error } = editingObligation
      ? await supabase.from('obligations').update(payload).eq('id', editingObligation.id)
      : await supabase.from('obligations').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingObligation ? 'Atualizado' : 'Criado' });
    setObligationOpen(false);
    loadAll();
  }
  async function deleteObligation(id: string) {
    const { error } = await supabase.from('obligations').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Excluído' });
    loadAll();
  }

  // ---- Activity CRUD ----
  function openNewActivity(obligationId: string) {
    setEditingActivity(null);
    setActivityForm({ title: '', type: 'checklist', description: '', order: activities.filter(a => a.obligation_id === obligationId).length, obligation_id: obligationId, document_type_id: '', auto_start: false, email_department_id: '', email_subject: '', email_body: '', whatsapp_template_name: '', whatsapp_message_body: '', whatsapp_button_url: '' });
    setActivityOpen(true);
  }
  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setActivityForm({ title: a.title, type: a.type, description: a.description || '', order: a.order, obligation_id: a.obligation_id, document_type_id: a.document_type_id || '', auto_start: a.auto_start, email_department_id: a.email_department_id || '', email_subject: a.email_subject || '', email_body: a.email_body || '', whatsapp_template_name: (a as any).whatsapp_template_name || '', whatsapp_message_body: (a as any).whatsapp_message_body || '', whatsapp_button_url: (a as any).whatsapp_button_url || '' });
    setActivityOpen(true);
  }
  async function saveActivity(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { title: activityForm.title, type: activityForm.type as any, description: activityForm.description || null, order: activityForm.order, obligation_id: activityForm.obligation_id, auto_start: activityForm.auto_start };
    if (activityForm.type === 'document' && activityForm.document_type_id) {
      payload.document_type_id = activityForm.document_type_id;
    } else {
      payload.document_type_id = null;
    }
    if (activityForm.type === 'email') {
      payload.email_department_id = activityForm.email_department_id || null;
      payload.email_subject = activityForm.email_subject || null;
      payload.email_body = activityForm.email_body || null;
    } else {
      payload.email_department_id = null;
      payload.email_subject = null;
      payload.email_body = null;
    }
    if (activityForm.type === 'whatsapp') {
      payload.whatsapp_template_name = activityForm.whatsapp_template_name || null;
      payload.whatsapp_message_body = activityForm.whatsapp_message_body || null;
      payload.whatsapp_button_url = activityForm.whatsapp_button_url || null;
    } else {
      payload.whatsapp_template_name = null;
      payload.whatsapp_message_body = null;
      payload.whatsapp_button_url = null;
    }
    const { error } = editingActivity
      ? await supabase.from('obligation_activities').update(payload).eq('id', editingActivity.id)
      : await supabase.from('obligation_activities').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingActivity ? 'Atualizado' : 'Criado' });
    setActivityOpen(false);
    loadAll();
  }
  async function deleteActivity(id: string) {
    const { error } = await supabase.from('obligation_activities').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    loadAll();
  }

  function getDeptName(id: string) { return departments.find(d => d.id === id)?.name || ''; }
  function getDocTypeName(id: string | null) { if (!id) return ''; return documentTypes.find(d => d.id === id)?.name || ''; }

  const groupedByDept = departments.map(dept => ({
    dept,
    items: obligations.filter(o => o.department_id === dept.id),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Obrigações</h1>
          <p className="text-sm text-muted-foreground">Cadastro de obrigações e atividades por departamento</p>
        </div>
        {admin && <Button onClick={openNewObligation} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Nova Obrigação</Button>}
      </div>

      {groupedByDept.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma obrigação cadastrada.</CardContent></Card>
      )}
      {groupedByDept.map(({ dept, items }) => (
        <Card key={dept.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{dept.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(ob => {
              const isExpanded = expandedObligation === ob.id;
              const obActivities = activities.filter(a => a.obligation_id === ob.id);
              return (
                <div key={ob.id} className="border rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 cursor-pointer hover:bg-muted/50" onClick={() => setExpandedObligation(isExpanded ? null : ob.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{ob.name}</span>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{ob.recurrence}</Badge>
                        {ob.alert_day && <Badge className="bg-green-500 text-white border-0">🟢 D{ob.alert_day}</Badge>}
                        {ob.target_day && <Badge className="bg-orange-500 text-white border-0">🟠 D{ob.target_day}</Badge>}
                        {ob.due_day && <Badge className="bg-red-500 text-white border-0">🔴 D{ob.due_day}</Badge>}
                      </div>
                    </div>
                    {admin && (
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => openEditObligation(ob)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteObligation(ob.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="border-t p-3 space-y-3">
                      {ob.description && <p className="text-sm text-muted-foreground">{ob.description}</p>}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Atividades ({obActivities.length})</h4>
                        {admin && <Button size="sm" variant="outline" onClick={() => openNewActivity(ob.id)}><Plus className="h-3 w-3 mr-1" />Atividade</Button>}
                      </div>
                      {obActivities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>Título</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Tipo Doc.</TableHead>
                              <TableHead>Descrição</TableHead>
                              {admin && <TableHead className="w-20">Ações</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {obActivities.map((act, i) => (
                              <TableRow key={act.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {act.title}
                                    {act.auto_start && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                        <Zap className="h-3 w-3 mr-0.5" />Auto
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {activityTypeIcons[act.type]}
                                    <span className="text-sm">{activityTypeLabels[act.type]}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{getDocTypeName(act.document_type_id) || '—'}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{act.description || '—'}</TableCell>
                                {admin && (
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="ghost" onClick={() => openEditActivity(act)}><Pencil className="h-3 w-3" /></Button>
                                      <Button size="icon" variant="ghost" onClick={() => deleteActivity(act.id)}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Obligation Dialog */}
      <Dialog open={obligationOpen} onOpenChange={setObligationOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingObligation ? 'Editar Obrigação' : 'Nova Obrigação'}</DialogTitle></DialogHeader>
          <form onSubmit={saveObligation} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={obligationForm.name} onChange={e => setObligationForm({ ...obligationForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={obligationForm.description} onChange={e => setObligationForm({ ...obligationForm, description: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select value={obligationForm.department_id} onValueChange={v => setObligationForm({ ...obligationForm, department_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={obligationForm.recurrence} onValueChange={v => setObligationForm({ ...obligationForm, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 inline-block" />
                  Dia Alerta
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 1" value={obligationForm.alert_day} onChange={e => setObligationForm({ ...obligationForm, alert_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Início da execução</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500 inline-block" />
                  Dia Meta
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 15" value={obligationForm.target_day} onChange={e => setObligationForm({ ...obligationForm, target_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Prazo interno</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 inline-block" />
                  Dia Vencimento
                </Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 20" value={obligationForm.due_day} onChange={e => setObligationForm({ ...obligationForm, due_day: e.target.value })} />
                <p className="text-xs text-muted-foreground">Prazo final (multa)</p>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!obligationForm.name || !obligationForm.department_id}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle></DialogHeader>
          <form onSubmit={saveActivity} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={activityForm.title} onChange={e => setActivityForm({ ...activityForm, title: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={activityForm.type} onValueChange={v => setActivityForm({ ...activityForm, type: v, document_type_id: v !== 'document' ? '' : activityForm.document_type_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activityForm.type === 'document' && (
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={activityForm.document_type_id} onValueChange={v => setActivityForm({ ...activityForm, document_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de documento" /></SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activityForm.type === 'whatsapp' && (
              <>
                <div className="space-y-2">
                  <Label>Nome do Template (opcional)</Label>
                  <Input value={activityForm.whatsapp_template_name} onChange={e => setActivityForm({ ...activityForm, whatsapp_template_name: e.target.value })} placeholder="Ex: lembrete_obrigacao" />
                  <p className="text-xs text-muted-foreground">Se preenchido, envia como template aprovado pela Meta</p>
                </div>
                <div className="space-y-2">
                  <Label>Corpo da Mensagem</Label>
                  <Textarea rows={5} value={activityForm.whatsapp_message_body} onChange={e => setActivityForm({ ...activityForm, whatsapp_message_body: e.target.value })} placeholder="Use variáveis: [Nome_da_Empresa], [Competencia], [Nome_da_Obrigação], [Vencimento]" />
                  <div className="flex flex-wrap gap-1">
                    {['[Nome_da_Empresa]', '[Competencia]', '[Nome_da_Obrigação]', '[Vencimento]'].map(v => (
                      <Badge key={v} variant="outline" className="text-xs cursor-pointer hover:bg-muted" onClick={() => setActivityForm(f => ({ ...f, whatsapp_message_body: f.whatsapp_message_body + v }))}>
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL do Botão (opcional)</Label>
                  <Input value={activityForm.whatsapp_button_url} onChange={e => setActivityForm({ ...activityForm, whatsapp_button_url: e.target.value })} placeholder="Ex: https://seusite.com/pagamento" />
                  <p className="text-xs text-muted-foreground">URL dinâmica para botões do template (se aplicável)</p>
                </div>
              </>
            )}
            {activityForm.type === 'email' && (
              <>
                <div className="space-y-2">
                  <Label>Departamento Remetente</Label>
                  <Select value={activityForm.email_department_id} onValueChange={v => setActivityForm({ ...activityForm, email_department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">O e-mail será enviado com as credenciais SMTP deste departamento</p>
                </div>
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input value={activityForm.email_subject} onChange={e => setActivityForm({ ...activityForm, email_subject: e.target.value })} placeholder="Ex: Lembrete de [Nome_da_Obrigação] - [Competencia]" />
                </div>
                <div className="space-y-2">
                  <Label>Corpo do E-mail</Label>
                  <Textarea rows={5} value={activityForm.email_body} onChange={e => setActivityForm({ ...activityForm, email_body: e.target.value })} placeholder="Use variáveis: [Nome_da_Empresa], [Competencia], [Nome_da_Obrigação], [Vencimento]" />
                  <div className="flex flex-wrap gap-1">
                    {['[Nome_da_Empresa]', '[Competencia]', '[Nome_da_Obrigação]', '[Vencimento]'].map(v => (
                      <Badge key={v} variant="outline" className="text-xs cursor-pointer hover:bg-muted" onClick={() => setActivityForm(f => ({ ...f, email_body: f.email_body + v }))}>
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={activityForm.order} onChange={e => setActivityForm({ ...activityForm, order: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" />Execução automática</Label>
                <p className="text-xs text-muted-foreground">Inicia automaticamente após a atividade anterior ser concluída</p>
              </div>
              <Switch checked={activityForm.auto_start} onCheckedChange={v => setActivityForm({ ...activityForm, auto_start: v })} />
            </div>
            <Button type="submit" className="w-full" disabled={!activityForm.title}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
