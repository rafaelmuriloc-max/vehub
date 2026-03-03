import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Trash2, FileText, CheckSquare, MessageCircle, Mail, Upload, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Obligation = { id: string; department_id: string; name: string; description: string | null; recurrence: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; order: number; document_type_id: string | null };
type Instance = { id: string; obligation_id: string; client_id: string; reference_month: string; status: string; assigned_to: string | null; due_date: string | null };
type Completion = { id: string; instance_id: string; activity_id: string; completed: boolean; completed_at: string | null; file_url: string | null; notes: string | null };
type Department = { id: string; name: string };

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído' };

interface Props {
  clientId: string;
}

export default function ClientObligationsTab({ clientId }: Props) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const [newInstanceOpen, setNewInstanceOpen] = useState(false);
  const [instanceForm, setInstanceForm] = useState({ obligation_id: '', reference_month: '', due_date: '' });

  const [detailInstance, setDetailInstance] = useState<Instance | null>(null);

  useEffect(() => { loadData(); }, [clientId]);

  async function loadData() {
    const [dRes, oRes, aRes, iRes, cRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('*').order('name'),
      supabase.from('obligation_activities').select('*').order('order'),
      supabase.from('obligation_instances').select('*').eq('client_id', clientId).order('reference_month', { ascending: false }),
      supabase.from('obligation_activity_completions').select('*'),
    ]);
    if (dRes.data) setDepartments(dRes.data);
    if (oRes.data) setObligations(oRes.data);
    if (aRes.data) setActivities(aRes.data as Activity[]);
    if (iRes.data) setInstances(iRes.data as Instance[]);
    if (cRes.data) setCompletions(cRes.data as Completion[]);
  }

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('obligation_instances').insert({
      obligation_id: instanceForm.obligation_id,
      client_id: clientId,
      reference_month: instanceForm.reference_month,
      due_date: instanceForm.due_date || null,
    } as any);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Competência criada' });
    setNewInstanceOpen(false);
    loadData();
  }

  async function deleteInstance(id: string) {
    await supabase.from('obligation_instances').delete().eq('id', id);
    loadData();
  }

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
    loadData();
  }

  async function handleFileUpload(instanceId: string, activityId: string, file: File) {
    const path = `${clientId}/${instanceId}/${activityId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' }); return; }

    const existing = completions.find(c => c.instance_id === instanceId && c.activity_id === activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({
        completed: true, completed_at: new Date().toISOString(), file_url: path,
      }).eq('id', existing.id);
    } else {
      await supabase.from('obligation_activity_completions').insert({
        instance_id: instanceId, activity_id: activityId, completed: true, completed_at: new Date().toISOString(), file_url: path,
      });
    }
    toast({ title: 'Arquivo enviado' });
    loadData();
  }

  async function downloadFile(fileUrl: string) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 60);
    if (error || !data?.signedUrl) { toast({ title: 'Erro', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  }

  function getDeptName(id: string) { return departments.find(d => d.id === id)?.name || ''; }

  // Group instances by obligation
  const instancesByObligation = obligations.map(ob => ({
    obligation: ob,
    dept: getDeptName(ob.department_id),
    obActivities: activities.filter(a => a.obligation_id === ob.id),
    obInstances: instances.filter(i => i.obligation_id === ob.id),
  })).filter(g => g.obInstances.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Obrigações do Cliente</h3>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => {
            setInstanceForm({ obligation_id: obligations[0]?.id || '', reference_month: format(new Date(), 'yyyy-MM-01'), due_date: '' });
            setNewInstanceOpen(true);
          }}>
            <Plus className="h-3 w-3 mr-1" />Nova Competência
          </Button>
        )}
      </div>

      {instancesByObligation.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma competência gerada para este cliente.</p>
      )}

      {instancesByObligation.map(({ obligation, dept, obActivities, obInstances }) => (
        <Card key={obligation.id}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              {obligation.name}
              <Badge variant="outline" className="text-xs">{dept}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {obInstances.map(inst => {
              const instCompletions = completions.filter(c => c.instance_id === inst.id);
              const total = obActivities.length;
              const done = obActivities.filter(a => instCompletions.find(c => c.activity_id === a.id && c.completed)).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <div key={inst.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(new Date(inst.reference_month + 'T00:00:00'), 'MMMM yyyy', { locale: ptBR })}
                      </span>
                      <Badge variant="secondary" className="text-xs">{statusLabels[inst.status] || inst.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{done}/{total}</span>
                      <Button size="sm" variant="ghost" onClick={() => setDetailInstance(inst)}>Detalhes</Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => deleteInstance(inst.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* New Instance Dialog */}
      <Dialog open={newInstanceOpen} onOpenChange={setNewInstanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Competência</DialogTitle></DialogHeader>
          <form onSubmit={createInstance} className="space-y-4">
            <div className="space-y-2">
              <Label>Obrigação *</Label>
              <Select value={instanceForm.obligation_id} onValueChange={v => setInstanceForm({ ...instanceForm, obligation_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{obligations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competência *</Label>
              <Input type="date" value={instanceForm.reference_month} onChange={e => setInstanceForm({ ...instanceForm, reference_month: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={instanceForm.due_date} onChange={e => setInstanceForm({ ...instanceForm, due_date: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={!instanceForm.obligation_id || !instanceForm.reference_month}>Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailInstance} onOpenChange={() => setDetailInstance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailInstance && obligations.find(o => o.id === detailInstance.obligation_id)?.name} — {detailInstance && format(new Date(detailInstance.reference_month + 'T00:00:00'), 'MMMM yyyy', { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          {detailInstance && (
            <div className="space-y-3">
              {activities.filter(a => a.obligation_id === detailInstance.obligation_id).map(act => {
                const comp = completions.find(c => c.instance_id === detailInstance.id && c.activity_id === act.id);
                const isCompleted = comp?.completed || false;

                return (
                  <div key={act.id} className="flex items-center gap-3 p-2 border rounded">
                    {act.type === 'document' ? (
                      <div className="flex items-center gap-2 flex-1">
                        {activityTypeIcons[act.type]}
                        <span className={`text-sm flex-1 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{act.title}</span>
                        {comp?.file_url && (
                          <Button size="sm" variant="ghost" onClick={() => downloadFile(comp.file_url!)}>
                            <Download className="h-3 w-3 mr-1" />Baixar
                          </Button>
                        )}
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(detailInstance.id, act.id, file);
                            e.target.value = '';
                          }} />
                          <div className="flex items-center gap-1 text-sm text-primary hover:underline">
                            <Upload className="h-3 w-3" />{comp?.file_url ? 'Substituir' : 'Anexar'}
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox checked={isCompleted} onCheckedChange={() => toggleCompletion(detailInstance.id, act.id, isCompleted)} />
                        {activityTypeIcons[act.type]}
                        <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{act.title}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
