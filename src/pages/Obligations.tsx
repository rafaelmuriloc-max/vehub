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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Pencil, Trash2, ClipboardList, FileText, CheckSquare, MessageCircle, Mail,
  ChevronDown, ChevronRight, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Department = { id: string; name: string };
type Obligation = { id: string; department_id: string; name: string; description: string | null; recurrence: string; created_at: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; order: number };
type Instance = {
  id: string; obligation_id: string; client_id: string; reference_month: string;
  status: string; assigned_to: string | null; due_date: string | null;
};
type Completion = {
  id: string; instance_id: string; activity_id: string; completed: boolean;
  completed_by: string | null; completed_at: string | null; file_url: string | null; notes: string | null;
};
type Client = { id: string; company_name: string };
type Profile = { id: string; user_id: string; full_name: string | null };

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};
const activityTypeLabels: Record<string, string> = {
  document: 'Documento', checklist: 'Checklist', whatsapp: 'WhatsApp', email: 'E-mail',
};
const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído' };
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', in_progress: 'bg-blue-100 text-blue-800', done: 'bg-green-100 text-green-800',
};

export default function Obligations() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Obligation dialog
  const [obligationOpen, setObligationOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [obligationForm, setObligationForm] = useState({ name: '', description: '', department_id: '', recurrence: 'mensal' });

  // Activity dialog
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ title: '', type: 'checklist', description: '', order: 0, obligation_id: '' });

  // Instance dialog
  const [instanceOpen, setInstanceOpen] = useState(false);
  const [instanceForm, setInstanceForm] = useState({ obligation_id: '', client_id: '', reference_month: '', due_date: '', assigned_to: '' });

  // Expanded obligations
  const [expandedObligation, setExpandedObligation] = useState<string | null>(null);

  // Instance detail dialog
  const [detailInstance, setDetailInstance] = useState<Instance | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dRes, oRes, aRes, iRes, cRes, clRes, pRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('*').order('name'),
      supabase.from('obligation_activities').select('*').order('order'),
      supabase.from('obligation_instances').select('*').order('reference_month', { ascending: false }),
      supabase.from('obligation_activity_completions').select('*'),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('profiles').select('id, user_id, full_name'),
    ]);
    if (dRes.data) setDepartments(dRes.data);
    if (oRes.data) setObligations(oRes.data);
    if (aRes.data) setActivities(aRes.data as Activity[]);
    if (iRes.data) setInstances(iRes.data as Instance[]);
    if (cRes.data) setCompletions(cRes.data as Completion[]);
    if (clRes.data) setClients(clRes.data);
    if (pRes.data) setProfiles(pRes.data);
  }

  // ---- Obligation CRUD ----
  function openNewObligation() {
    setEditingObligation(null);
    setObligationForm({ name: '', description: '', department_id: departments[0]?.id || '', recurrence: 'mensal' });
    setObligationOpen(true);
  }
  function openEditObligation(o: Obligation) {
    setEditingObligation(o);
    setObligationForm({ name: o.name, description: o.description || '', department_id: o.department_id, recurrence: o.recurrence });
    setObligationOpen(true);
  }
  async function saveObligation(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: obligationForm.name, description: obligationForm.description || null, department_id: obligationForm.department_id, recurrence: obligationForm.recurrence };
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
    setActivityForm({ title: '', type: 'checklist', description: '', order: activities.filter(a => a.obligation_id === obligationId).length, obligation_id: obligationId });
    setActivityOpen(true);
  }
  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setActivityForm({ title: a.title, type: a.type, description: a.description || '', order: a.order, obligation_id: a.obligation_id });
    setActivityOpen(true);
  }
  async function saveActivity(e: React.FormEvent) {
    e.preventDefault();
    const payload = { title: activityForm.title, type: activityForm.type as any, description: activityForm.description || null, order: activityForm.order, obligation_id: activityForm.obligation_id };
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

  // ---- Instance CRUD ----
  function openNewInstance(obligationId: string) {
    const today = new Date();
    setInstanceForm({
      obligation_id: obligationId,
      client_id: clients[0]?.id || '',
      reference_month: format(today, 'yyyy-MM-01'),
      due_date: '',
      assigned_to: '',
    });
    setInstanceOpen(true);
  }
  async function saveInstance(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      obligation_id: instanceForm.obligation_id,
      client_id: instanceForm.client_id,
      reference_month: instanceForm.reference_month,
      due_date: instanceForm.due_date || null,
      assigned_to: instanceForm.assigned_to || null,
    };
    const { error } = await supabase.from('obligation_instances').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Instância criada' });
    setInstanceOpen(false);
    loadAll();
  }
  async function deleteInstance(id: string) {
    const { error } = await supabase.from('obligation_instances').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    loadAll();
  }

  // ---- Completions ----
  async function toggleCompletion(instanceId: string, activityId: string, currentlyCompleted: boolean) {
    const existing = completions.find(c => c.instance_id === instanceId && c.activity_id === activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({
        completed: !currentlyCompleted,
        completed_at: !currentlyCompleted ? new Date().toISOString() : null,
      }).eq('id', existing.id);
    } else {
      await supabase.from('obligation_activity_completions').insert({
        instance_id: instanceId, activity_id: activityId, completed: true, completed_at: new Date().toISOString(),
      });
    }
    loadAll();
  }

  function getDeptName(id: string) { return departments.find(d => d.id === id)?.name || ''; }
  function getClientName(id: string) { return clients.find(c => c.id === id)?.company_name || ''; }
  function getProfileName(uid: string | null) { if (!uid) return '—'; return profiles.find(p => p.user_id === uid)?.full_name || '—'; }

  const groupedByDept = departments.map(dept => ({
    dept,
    items: obligations.filter(o => o.department_id === dept.id),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Obrigações</h1>
          <p className="text-muted-foreground">Obrigações recorrentes por departamento</p>
        </div>
        {admin && <Button onClick={openNewObligation}><Plus className="h-4 w-4 mr-2" />Nova Obrigação</Button>}
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
        </TabsList>

        {/* ===== CADASTRO TAB ===== */}
        <TabsContent value="cadastro" className="space-y-4">
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
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50" onClick={() => setExpandedObligation(isExpanded ? null : ob.id)}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{ob.name}</span>
                          <Badge variant="outline" className="ml-2">{ob.recurrence}</Badge>
                        </div>
                        {admin && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
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
                                  <TableHead>Descrição</TableHead>
                                  {admin && <TableHead className="w-20">Ações</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {obActivities.map((act, i) => (
                                  <TableRow key={act.id}>
                                    <TableCell>{i + 1}</TableCell>
                                    <TableCell className="font-medium">{act.title}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        {activityTypeIcons[act.type]}
                                        <span className="text-sm">{activityTypeLabels[act.type]}</span>
                                      </div>
                                    </TableCell>
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
                          {admin && (
                            <Button size="sm" variant="outline" onClick={() => openNewInstance(ob.id)}>
                              <Calendar className="h-3 w-3 mr-1" />Nova Instância
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ===== ACOMPANHAMENTO TAB ===== */}
        <TabsContent value="acompanhamento" className="space-y-4">
          {instances.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma instância criada.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      {admin && <TableHead className="w-20">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instances.map(inst => {
                      const ob = obligations.find(o => o.id === inst.obligation_id);
                      const obActivities = activities.filter(a => a.obligation_id === inst.obligation_id);
                      const instCompletions = completions.filter(c => c.instance_id === inst.id && c.completed);
                      const progress = obActivities.length > 0 ? Math.round((instCompletions.length / obActivities.length) * 100) : 0;
                      return (
                        <TableRow key={inst.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailInstance(inst)}>
                          <TableCell className="font-medium">{ob?.name || '—'}</TableCell>
                          <TableCell>{getClientName(inst.client_id)}</TableCell>
                          <TableCell>{format(new Date(inst.reference_month), 'MMM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell>{inst.due_date ? format(new Date(inst.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{getProfileName(inst.assigned_to)}</TableCell>
                          <TableCell><Badge className={statusColors[inst.status]}>{statusLabels[inst.status]}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          </TableCell>
                          {admin && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" onClick={() => deleteInstance(inst.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== OBLIGATION DIALOG ===== */}
      <Dialog open={obligationOpen} onOpenChange={setObligationOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingObligation ? 'Editar Obrigação' : 'Nova Obrigação'}</DialogTitle></DialogHeader>
          <form onSubmit={saveObligation} className="space-y-4">
            <div><Label>Nome</Label><Input value={obligationForm.name} onChange={e => setObligationForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Descrição</Label><Textarea value={obligationForm.description} onChange={e => setObligationForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Departamento</Label>
              <Select value={obligationForm.department_id} onValueChange={v => setObligationForm(f => ({ ...f, department_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Recorrência</Label>
              <Select value={obligationForm.recurrence} onValueChange={v => setObligationForm(f => ({ ...f, recurrence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!obligationForm.name || !obligationForm.department_id}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== ACTIVITY DIALOG ===== */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle></DialogHeader>
          <form onSubmit={saveActivity} className="space-y-4">
            <div><Label>Título</Label><Input value={activityForm.title} onChange={e => setActivityForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div><Label>Tipo</Label>
              <Select value={activityForm.type} onValueChange={v => setActivityForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Documento</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={activityForm.description} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Ordem</Label><Input type="number" value={activityForm.order} onChange={e => setActivityForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} /></div>
            <Button type="submit" disabled={!activityForm.title}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== INSTANCE DIALOG ===== */}
      <Dialog open={instanceOpen} onOpenChange={setInstanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Instância</DialogTitle></DialogHeader>
          <form onSubmit={saveInstance} className="space-y-4">
            <div><Label>Cliente</Label>
              <Select value={instanceForm.client_id} onValueChange={v => setInstanceForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Competência (mês)</Label><Input type="date" value={instanceForm.reference_month} onChange={e => setInstanceForm(f => ({ ...f, reference_month: e.target.value }))} required /></div>
            <div><Label>Vencimento</Label><Input type="date" value={instanceForm.due_date} onChange={e => setInstanceForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div><Label>Responsável</Label>
              <Select value={instanceForm.assigned_to} onValueChange={v => setInstanceForm(f => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!instanceForm.client_id || !instanceForm.reference_month}>Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== INSTANCE DETAIL DIALOG ===== */}
      <Dialog open={!!detailInstance} onOpenChange={() => setDetailInstance(null)}>
        <DialogContent className="max-w-2xl">
          {detailInstance && (() => {
            const ob = obligations.find(o => o.id === detailInstance.obligation_id);
            const obActivities = activities.filter(a => a.obligation_id === detailInstance.obligation_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{ob?.name} — {getClientName(detailInstance.client_id)}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Competência: {format(new Date(detailInstance.reference_month), 'MMMM/yyyy', { locale: ptBR })}
                    {detailInstance.due_date && ` | Vencimento: ${format(new Date(detailInstance.due_date), 'dd/MM/yyyy')}`}
                  </p>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {obActivities.map(act => {
                    const comp = completions.find(c => c.instance_id === detailInstance.id && c.activity_id === act.id);
                    const isCompleted = comp?.completed || false;
                    return (
                      <div key={act.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Checkbox checked={isCompleted} onCheckedChange={() => toggleCompletion(detailInstance.id, act.id, isCompleted)} />
                        <div className="flex items-center gap-2 flex-1">
                          {activityTypeIcons[act.type]}
                          <span className={isCompleted ? 'line-through text-muted-foreground' : ''}>{act.title}</span>
                          <Badge variant="outline" className="ml-auto">{activityTypeLabels[act.type]}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
