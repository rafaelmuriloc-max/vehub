import { useState, useEffect } from 'react';
import { getHolidays, previousBusinessDay } from '@/lib/holidays';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  FileText, CheckSquare, MessageCircle, Mail, Upload, Download, Check, Loader2, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmailComposeDialog from '@/components/EmailComposeDialog';
import { sendActivityEmail } from '@/lib/sendActivityEmail';
import { sendActivityWhatsApp } from '@/lib/sendActivityWhatsApp';

type Obligation = { id: string; department_id: string; name: string; description: string | null; recurrence: string; due_day: number | null; annual_month: number | null; competence_rule: string };
type Activity = { id: string; obligation_id: string; title: string; type: string; description: string | null; order: number; document_type_id: string | null; auto_start: boolean; email_department_id: string | null; email_subject: string | null; email_body: string | null; whatsapp_template_name: string | null; whatsapp_message_body: string | null; whatsapp_button_url: string | null; whatsapp_has_document_header: boolean };
type Instance = { id: string; obligation_id: string; client_id: string; reference_month: string; status: string; assigned_to: string | null; due_date: string | null };
type Completion = { id: string; instance_id: string; activity_id: string; completed: boolean; completed_at: string | null; file_url: string | null; notes: string | null };
type Department = { id: string; name: string };
type ClientObligation = { obligation_id: string; department_id: string };

const activityTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
  const [clientObligations, setClientObligations] = useState<ClientObligation[]>([]);
  const [generating, setGenerating] = useState(false);

  const [detailInstance, setDetailInstance] = useState<Instance | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailActivityId, setEmailActivityId] = useState<string | null>(null);
  const [emailVariables, setEmailVariables] = useState<Record<string, string>>({});
  const [emailPrefill, setEmailPrefill] = useState<{ departmentId?: string; subject?: string; body?: string }>({});
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<{ fileUrl: string; fileName: string }[]>([]);
  useEffect(() => { loadData(); }, [clientId]);

  async function loadData() {
    const [dRes, oRes, aRes, iRes, cRes, coRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('obligations').select('*').order('name'),
      supabase.from('obligation_activities').select('*').order('order'),
      supabase.from('obligation_instances').select('*').eq('client_id', clientId).order('reference_month'),
      supabase.from('obligation_activity_completions').select('*'),
      supabase.from('client_department_obligations').select('obligation_id, department_id').eq('client_id', clientId),
    ]);
    if (dRes.data) setDepartments(dRes.data);
    if (oRes.data) setObligations(oRes.data);
    if (aRes.data) setActivities(aRes.data as Activity[]);
    if (iRes.data) setInstances(iRes.data as Instance[]);
    if (cRes.data) setCompletions(cRes.data as Completion[]);
    if (coRes.data) setClientObligations(coRes.data as ClientObligation[]);
  }

  // Months from current month to December
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const months = Array.from({ length: 12 - currentMonth }, (_, i) => currentMonth + i);

  function monthKey(monthIdx: number) {
    const m = (monthIdx + 1).toString().padStart(2, '0');
    return `${currentYear}-${m}-01`;
  }

  function findInstance(obligationId: string, monthIdx: number): Instance | undefined {
    const key = monthKey(monthIdx);
    return instances.find(i => i.obligation_id === obligationId && i.reference_month === key);
  }

  // Linked obligations with their details
  const linkedObligations = clientObligations
    .map(co => {
      const obl = obligations.find(o => o.id === co.obligation_id);
      const dept = departments.find(d => d.id === co.department_id);
      return obl ? { obligation: obl, deptName: dept?.name || '' } : null;
    })
    .filter(Boolean) as { obligation: Obligation; deptName: string }[];

  async function generateObligations() {
    if (linkedObligations.length === 0) {
      toast({ title: 'Nenhuma obrigação vinculada', description: 'Vincule obrigações nas abas do departamento primeiro.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const toInsert: { obligation_id: string; client_id: string; reference_month: string; due_date?: string | null }[] = [];

      for (const { obligation } of linkedObligations) {
        if (obligation.recurrence === 'anual' && obligation.annual_month) {
          const instanceYear = obligation.competence_rule === 'previous' ? currentYear + 1 : currentYear;
          const month = obligation.annual_month;
          const refDate = `${instanceYear}-${String(month).padStart(2, '0')}-01`;
          const exists = instances.find(i => i.obligation_id === obligation.id && i.reference_month === refDate);
          if (!exists) {
            const rawDue = obligation.due_day ? `${instanceYear}-${String(month).padStart(2, '0')}-${String(Math.min(obligation.due_day, 28)).padStart(2, '0')}` : null;
            const dueDate = rawDue ? previousBusinessDay(rawDue, getHolidays(instanceYear)) : null;
            toInsert.push({ obligation_id: obligation.id, client_id: clientId, reference_month: refDate, due_date: dueDate });
          }
        } else {
          for (const monthIdx of months) {
            const key = monthKey(monthIdx);
            const exists = instances.find(i => i.obligation_id === obligation.id && i.reference_month === key);
            if (!exists) {
              const m = monthIdx + 1;
              const rawDue = obligation.due_day ? `${currentYear}-${String(m).padStart(2, '0')}-${String(Math.min(obligation.due_day, 28)).padStart(2, '0')}` : null;
              const dueDate = rawDue ? previousBusinessDay(rawDue, getHolidays(currentYear)) : null;
              toInsert.push({ obligation_id: obligation.id, client_id: clientId, reference_month: key, due_date: dueDate });
            }
          }
        }
      }

      if (toInsert.length === 0) {
        toast({ title: 'Todas as obrigações já foram geradas para os meses restantes.' });
        setGenerating(false);
        return;
      }

      const { error } = await supabase.from('obligation_instances').insert(toInsert as any);
      if (error) {
        toast({ title: 'Erro ao gerar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: `${toInsert.length} obrigações geradas com sucesso!` });
        await loadData();
      }
    } finally {
      setGenerating(false);
    }
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

    // Auto-start chain: if completing (not uncompleting), check next activities
    if (!currentlyCompleted) {
      const currentAct = activities.find(a => a.id === activityId);
      if (currentAct) {
        const obl = obligations.find(o => o.id === currentAct.obligation_id);
        const oblActivities = activities.filter(a => a.obligation_id === currentAct.obligation_id).sort((a, b) => a.order - b.order);
        const currentIdx = oblActivities.findIndex(a => a.id === activityId);
        // Chain through consecutive auto_start activities
        for (let i = currentIdx + 1; i < oblActivities.length; i++) {
          const nextAct = oblActivities[i];
          if (!nextAct.auto_start) break;
          const nextComp = completions.find(c => c.instance_id === instanceId && c.activity_id === nextAct.id);
          if (nextComp?.completed) break; // already completed

          // Auto-send email activities
          if (nextAct.type === 'email' && nextAct.email_department_id && nextAct.email_subject && nextAct.email_body) {
            const result = await sendActivityEmail({
              activity: nextAct,
              instanceId,
              clientId,
              obligationName: obl?.name || '',
              referenceMonth: instances.find(inst => inst.id === instanceId)?.reference_month || '',
              dueDay: obl?.due_day,
              departmentId: obl?.department_id,
            });
            if (!result.success) {
              toast({ title: 'Erro no envio automático de e-mail', description: result.error, variant: 'destructive' });
              break;
            }
            toast({ title: `E-mail "${nextAct.title}" enviado automaticamente` });
          } else if (nextAct.type === 'email') {
            break; // email without full config, stop chain
          } else if (nextAct.type === 'whatsapp' && (nextAct.whatsapp_template_name || nextAct.whatsapp_message_body)) {
            const result = await sendActivityWhatsApp({
              activity: nextAct,
              instanceId,
              clientId,
              obligationName: obl?.name || '',
              referenceMonth: instances.find(inst => inst.id === instanceId)?.reference_month || '',
              dueDay: obl?.due_day,
              departmentId: obl?.department_id,
            });
            if (!result.success) {
              toast({ title: 'Erro no envio automático de WhatsApp', description: result.error, variant: 'destructive' });
              break;
            }
            toast({ title: `WhatsApp "${nextAct.title}" enviado automaticamente` });
          } else if (nextAct.type === 'whatsapp') {
            break;
            if (nextComp) {
              await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', nextComp.id);
            } else {
              await supabase.from('obligation_activity_completions').insert({ instance_id: instanceId, activity_id: nextAct.id, completed: true, completed_at: new Date().toISOString() });
            }
          }
        }
      }
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

    // Trigger auto-start chain after document upload
    const currentAct = activities.find(a => a.id === activityId);
    if (currentAct) {
      const obl = obligations.find(o => o.id === currentAct.obligation_id);
      const oblActivities = activities.filter(a => a.obligation_id === currentAct.obligation_id).sort((a, b) => a.order - b.order);
      const currentIdx = oblActivities.findIndex(a => a.id === activityId);
      for (let i = currentIdx + 1; i < oblActivities.length; i++) {
        const nextAct = oblActivities[i];
        if (!nextAct.auto_start) break;
        const nextComp = completions.find(c => c.instance_id === instanceId && c.activity_id === nextAct.id);
        if (nextComp?.completed) break;

        if (nextAct.type === 'email' && nextAct.email_department_id && nextAct.email_subject && nextAct.email_body) {
          const result = await sendActivityEmail({
            activity: nextAct,
            instanceId,
            clientId,
            obligationName: obl?.name || '',
            referenceMonth: instances.find(inst => inst.id === instanceId)?.reference_month || '',
            dueDay: obl?.due_day,
            departmentId: obl?.department_id,
          });
          if (!result.success) {
            toast({ title: 'Erro no envio automático de e-mail', description: result.error, variant: 'destructive' });
            break;
          }
          toast({ title: `E-mail "${nextAct.title}" enviado automaticamente` });
        } else if (nextAct.type === 'email') {
          break;
        } else if (nextAct.type === 'whatsapp' && (nextAct.whatsapp_template_name || nextAct.whatsapp_message_body)) {
          const result = await sendActivityWhatsApp({
            activity: nextAct,
            instanceId,
            clientId,
            obligationName: obl?.name || '',
            referenceMonth: instances.find(inst => inst.id === instanceId)?.reference_month || '',
            dueDay: obl?.due_day,
            departmentId: obl?.department_id,
          });
          if (!result.success) {
            toast({ title: 'Erro no envio automático de WhatsApp', description: result.error, variant: 'destructive' });
            break;
          }
          toast({ title: `WhatsApp "${nextAct.title}" enviado automaticamente` });
        } else if (nextAct.type === 'whatsapp') {
          break;
          if (nextComp) {
            await supabase.from('obligation_activity_completions').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', nextComp.id);
          } else {
            await supabase.from('obligation_activity_completions').insert({ instance_id: instanceId, activity_id: nextAct.id, completed: true, completed_at: new Date().toISOString() });
          }
        }
      }
    }

    loadData();
  }

  async function deleteFile(instanceId: string, activityId: string, fileUrl: string) {
    await supabase.storage.from('documents').remove([fileUrl]);
    const existing = completions.find(c => c.instance_id === instanceId && c.activity_id === activityId);
    if (existing) {
      await supabase.from('obligation_activity_completions').update({ completed: false, completed_at: null, file_url: null }).eq('id', existing.id);
    }
    toast({ title: 'Arquivo excluído' });
    loadData();
  }

  async function downloadFile(fileUrl: string) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 60);
    if (error || !data?.signedUrl) { toast({ title: 'Erro', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  }

  function isInstanceCompleted(instanceId: string, obligationId: string): boolean {
    const oblActivities = activities.filter(a => a.obligation_id === obligationId);
    if (oblActivities.length === 0) return false;
    return oblActivities.every(act => {
      const comp = completions.find(c => c.instance_id === instanceId && c.activity_id === act.id);
      return comp?.completed === true;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Obrigações do Cliente</h3>
        {isAdmin && (
          <Button size="sm" onClick={generateObligations} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
            Gerar Obrigações
          </Button>
        )}
      </div>

      {linkedObligations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma obrigação vinculada a este cliente. Vincule obrigações nas abas do departamento.
        </p>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Obrigação</TableHead>
                <TableHead className="min-w-[100px]">Departamento</TableHead>
                {months.map(m => (
                  <TableHead key={m} className="text-center min-w-[50px]">{monthNames[m]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedObligations.map(({ obligation, deptName }) => {
                const allMonthsCompleted = months.every(m => {
                  const inst = findInstance(obligation.id, m);
                  return inst ? isInstanceCompleted(inst.id, obligation.id) : true;
                }) && months.some(m => findInstance(obligation.id, m));

                return (
                  <TableRow key={obligation.id} className={allMonthsCompleted ? 'bg-green-50 dark:bg-green-950/30' : ''}>
                    <TableCell className="font-medium text-sm">{obligation.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{deptName}</Badge>
                    </TableCell>
                    {months.map(m => {
                      const inst = findInstance(obligation.id, m);
                      const completed = inst ? isInstanceCompleted(inst.id, obligation.id) : false;
                      return (
                        <TableCell key={m} className={`text-center ${completed ? 'bg-green-100 dark:bg-green-900/40' : ''}`}>
                          {inst ? (
                            <button
                              onClick={() => setDetailInstance(inst)}
                              className={`inline-flex items-center justify-center transition-colors ${completed ? 'text-green-700 font-bold' : 'text-green-600 hover:text-green-800'}`}
                              title="Ver detalhes"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          ) : null}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
                          <>
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(comp.file_url!)}>
                              <Download className="h-3 w-3 mr-1" />Baixar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteFile(detailInstance.id, act.id, comp.file_url!)}>
                              <Trash2 className="h-3 w-3 mr-1" />Excluir
                            </Button>
                          </>
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
                    ) : act.type === 'email' ? (
                      <div className="flex items-center gap-2 flex-1">
                        {activityTypeIcons[act.type]}
                        <span className={`text-sm flex-1 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{act.title}</span>
                        <Button
                          size="sm"
                          variant={isCompleted ? 'ghost' : 'default'}
                          onClick={async () => {
                            const obl = obligations.find(o => o.id === detailInstance!.obligation_id);
                            const refDate = new Date(detailInstance!.reference_month + 'T00:00:00');
                            const competencia = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            const [{ data: cli }, { data: deptContacts }] = await Promise.all([
                              supabase.from('clients').select('company_name, contact_email').eq('id', clientId).single(),
                              obl ? supabase.from('client_department_contacts').select('contact_email').eq('client_id', clientId).eq('department_id', obl.department_id) : Promise.resolve({ data: [] as any[] }),
                            ]);
                            const deptEmails = (deptContacts || [])
                              .map((d: any) => (d.contact_email || '').trim())
                              .filter((e: string) => !!e);
                            setEmailRecipient(deptEmails.length > 0 ? deptEmails.join(', ') : (cli?.contact_email || ''));
                            setEmailVariables({
                              '[Nome_da_Empresa]': cli?.company_name || '',
                              '[Competencia]': competencia,
                              '[Nome_da_Obrigação]': obl?.name || '',
                              '[Vencimento]': detailInstance!.due_date ? new Date(detailInstance!.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
                            });
                            setEmailPrefill({
                              departmentId: act.email_department_id || undefined,
                              subject: act.email_subject || undefined,
                              body: act.email_body || undefined,
                            });
                            // Collect attachments from instance completions
                            const { data: fileComps } = await supabase
                              .from('obligation_activity_completions')
                              .select('file_url')
                              .eq('instance_id', detailInstance!.id)
                              .not('file_url', 'is', null);
                            setEmailAttachments((fileComps || []).filter(fc => fc.file_url).map(fc => ({ fileUrl: fc.file_url!, fileName: fc.file_url!.split('/').pop() || 'anexo' })));
                            setEmailActivityId(act.id);
                            setEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          {isCompleted ? 'Reenviar' : 'Enviar'}
                        </Button>
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

      {/* Email Compose Dialog */}
      <EmailComposeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        recipientEmail={emailRecipient}
        variables={emailVariables}
        prefillDepartmentId={emailPrefill.departmentId}
        prefillSubject={emailPrefill.subject}
        prefillBody={emailPrefill.body}
        attachments={emailAttachments}
        onSent={() => {
          if (emailActivityId && detailInstance) {
            toggleCompletion(detailInstance.id, emailActivityId, false);
          }
          setEmailActivityId(null);
        }}
      />
    </div>
  );
}
