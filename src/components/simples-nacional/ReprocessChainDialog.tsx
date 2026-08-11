import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sendActivityWhatsApp, upsertActivityCompletionMarker } from '@/lib/sendActivityWhatsApp';
import { sendActivityEmail } from '@/lib/sendActivityEmail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, SkipForward } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type ReprocessResult = {
  instance_id: string;
  company: string;
  actions: { activity: string; outcome: 'sent' | 'skipped' | 'already_done' | 'failed'; message?: string }[];
};

interface Activity {
  id: string;
  obligation_id: string;
  type: string;
  order: number;
  title: string;
  auto_start: boolean;
  email_department_id: string | null;
  email_subject: string | null;
  email_body: string | null;
  whatsapp_template_name: string | null;
  whatsapp_message_body: string | null;
  whatsapp_button_url?: string | null;
  whatsapp_has_document_header?: boolean;
}

/** Reprocess DAS – Simples Nacional automatic chain for a given reference_month.
 *  Dedupe rule: if any whatsapp_logs row for the instance has `media_filename`, skip resending docs.
 */
export default function ReprocessChainDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  // Default: previous-month competence (DAS sent in current month)
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`; // current-1 (DAS due in current)
  const [refMonth, setRefMonth] = useState<string>(defaultMonth);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ReprocessResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function findObligationId(): Promise<string | null> {
    const { data } = await supabase.from('obligations').select('id').ilike('name', '%DAS%Simples%').limit(1).maybeSingle();
    return data?.id ?? null;
  }

  async function run() {
    setRunning(true);
    setResults([]);
    setProgress(null);
    try {
      const obligationId = await findObligationId();
      if (!obligationId) {
        toast({ title: 'Obrigação DAS - Simples Nacional não encontrada', variant: 'destructive' });
        return;
      }
      const refDate = `${refMonth}-01`;

      // Load activities
      const { data: activitiesData } = await supabase
        .from('obligation_activities')
        .select('id, obligation_id, type, order, title, auto_start, email_department_id, email_subject, email_body, whatsapp_template_name, whatsapp_message_body, whatsapp_button_url, whatsapp_has_document_header')
        .eq('obligation_id', obligationId)
        .order('order');
      const activities = (activitiesData || []) as Activity[];
      const docActivity = activities.find(a => a.type === 'document');

      // Load instances with attached file
      const { data: instancesData } = await supabase
        .from('obligation_instances')
        .select('id, client_id, reference_month, due_date')
        .eq('obligation_id', obligationId)
        .eq('reference_month', refDate);

      const instances = instancesData || [];

      // Load clients and completions in batch
      const clientIds = [...new Set(instances.map(i => i.client_id))];
      const instanceIds = instances.map(i => i.id);

      const [clientsRes, completionsRes] = await Promise.all([
        supabase.from('clients').select('id, sci_code, company_name').in('id', clientIds),
        supabase.from('obligation_activity_completions').select('id, instance_id, activity_id, completed, file_url').in('instance_id', instanceIds),
      ]);
      const clientsMap = new Map<string, string>();
      (clientsRes.data || []).forEach(c => clientsMap.set(c.id, c.company_name));
      const completionsByInst = new Map<string, any[]>();
      (completionsRes.data || []).forEach(c => {
        const arr = completionsByInst.get(c.instance_id) ?? [];
        arr.push(c);
        completionsByInst.set(c.instance_id, arr);
      });

      // Filter: only instances with document activity already completed AND chain incomplete
      const candidates = instances.filter(inst => {
        const comps = completionsByInst.get(inst.id) || [];
        const docDone = !!docActivity && comps.some(c => c.activity_id === docActivity.id && c.completed && c.file_url);
        if (!docDone) return false;
        const missing = activities.filter(a => a.auto_start && !comps.some(c => c.activity_id === a.id && c.completed));
        return missing.length > 0;
      });

      setProgress({ done: 0, total: candidates.length });
      const out: ReprocessResult[] = [];

      for (let idx = 0; idx < candidates.length; idx++) {
        const inst = candidates[idx];
        const company = clientsMap.get(inst.client_id) || inst.client_id;
        const comps = completionsByInst.get(inst.id) || [];
        const result: ReprocessResult = { instance_id: inst.id, company, actions: [] };

        // Load obligation due_day + department once per instance group (small overhead)
        const { data: oblDetail } = await supabase
          .from('obligations')
          .select('name, due_day, department_id')
          .eq('id', obligationId)
          .single();

        // Dedupe sources for this instance
        const { data: waLogs } = await supabase
          .from('whatsapp_logs')
          .select('media_filename, template_name, status')
          .eq('instance_id', inst.id)
          .eq('status', 'sent');
        const hasAnyMedia = (waLogs || []).some(l => !!l.media_filename);
        const hasAnyTemplate = (waLogs || []).some(l => !!l.template_name);

        const { data: emailLogs } = await supabase
          .from('email_logs')
          .select('id, status')
          .eq('client_id', inst.client_id)
          .eq('obligation_id', obligationId)
          .eq('reference_month', inst.reference_month)
          .eq('status', 'sent')
          .limit(1);
        const hasAnyEmail = (emailLogs || []).length > 0;

        // Determine the role of each whatsapp activity (template_only vs documents_only)
        const waActivitiesSorted = activities.filter(a => a.type === 'whatsapp').sort((a, b) => a.order - b.order);

        for (const act of activities) {
          if (!act.auto_start) continue;
          const existing = comps.find(c => c.activity_id === act.id && c.completed);
          if (existing) continue;

          if (act.type === 'whatsapp') {
            const waIdx = waActivitiesSorted.findIndex(a => a.id === act.id);
            const isFirstWa = waIdx === 0 && waActivitiesSorted.length > 1; // template-only role
            const isDocsWa = waIdx > 0 || (waActivitiesSorted.length === 1 && hasAnyTemplate);
            const dedupeApplies = (isDocsWa && hasAnyMedia) || (isFirstWa && hasAnyTemplate);
            if (dedupeApplies) {
              await upsertActivityCompletionMarker(inst.id, act.id, {
                completed: true,
                completed_at: new Date().toISOString(),
                failure_reason: null,
              });
              result.actions.push({ activity: act.title, outcome: 'skipped', message: 'Já enviado previamente — apenas marcado como concluído' });
              continue;
            }
            try {
              const r = await sendActivityWhatsApp({
                activity: act,
                instanceId: inst.id,
                clientId: inst.client_id,
                obligationName: oblDetail?.name || 'DAS - Simples Nacional',
                referenceMonth: inst.reference_month,
                dueDay: oblDetail?.due_day,
                departmentId: oblDetail?.department_id,
              });
              result.actions.push({ activity: act.title, outcome: r.success ? 'sent' : 'failed', message: r.error });
              if (!r.success) break;
            } catch (e: any) {
              result.actions.push({ activity: act.title, outcome: 'failed', message: e?.message });
              break;
            }
          } else if (act.type === 'email') {
            if (hasAnyEmail) {
              await upsertActivityCompletionMarker(inst.id, act.id, {
                completed: true,
                completed_at: new Date().toISOString(),
                failure_reason: null,
              });
              result.actions.push({ activity: act.title, outcome: 'skipped', message: 'E-mail já registrado — apenas marcado como concluído' });
              continue;
            }
            try {
              const r = await sendActivityEmail({
                activity: act,
                instanceId: inst.id,
                clientId: inst.client_id,
                obligationName: oblDetail?.name || 'DAS - Simples Nacional',
                referenceMonth: inst.reference_month,
                dueDay: oblDetail?.due_day,
                departmentId: oblDetail?.department_id,
              });
              result.actions.push({ activity: act.title, outcome: r.success ? 'sent' : 'failed', message: r.error });
              if (!r.success) break;
            } catch (e: any) {
              result.actions.push({ activity: act.title, outcome: 'failed', message: e?.message });
              break;
            }
          }
        }

        out.push(result);
        setProgress({ done: idx + 1, total: candidates.length });
        setResults([...out]);
      }

      const summary = out.reduce(
        (acc, r) => {
          r.actions.forEach(a => {
            if (a.outcome === 'sent') acc.sent++;
            else if (a.outcome === 'skipped') acc.skipped++;
            else if (a.outcome === 'failed') acc.failed++;
          });
          return acc;
        },
        { sent: 0, skipped: 0, failed: 0 },
      );
      toast({
        title: 'Reprocessamento concluído',
        description: `${out.length} instâncias · ${summary.sent} envio(s), ${summary.skipped} pulado(s), ${summary.failed} falha(s)`,
      });
    } catch (err: any) {
      toast({ title: 'Erro no reprocessamento', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reprocessar fluxo automático – DAS Simples Nacional</DialogTitle>
          <DialogDescription>
            Encontra instâncias com documento anexado cujo fluxo automático (WhatsApp/E-mail) não foi concluído e retoma a partir de onde parou.
            Para evitar envios duplicados, atividades de WhatsApp cujo destinatário já recebeu o documento (qualquer registro com mídia em <code>whatsapp_logs</code>) ou e-mails já registrados são apenas marcados como concluídos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ref-month">Competência (referência da instância)</Label>
            <Input
              id="ref-month"
              type="month"
              value={refMonth}
              onChange={e => setRefMonth(e.target.value)}
              disabled={running}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use o mês do vencimento. Ex.: vencimento 20/06/2026 → 2026-06.
            </p>
          </div>

          {progress && (
            <div className="text-sm text-muted-foreground">
              Processando {progress.done}/{progress.total} instância(s)…
            </div>
          )}

          {results.length > 0 && (
            <ScrollArea className="h-64 border rounded-md p-2">
              <div className="space-y-2">
                {results.map(r => (
                  <div key={r.instance_id} className="text-sm border-b last:border-0 pb-2">
                    <div className="font-medium">{r.company}</div>
                    <div className="space-y-0.5 mt-1">
                      {r.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {a.outcome === 'sent' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                          {a.outcome === 'skipped' && <SkipForward className="h-3 w-3 text-muted-foreground shrink-0" />}
                          {a.outcome === 'failed' && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                          <span className="text-muted-foreground">{a.activity}:</span>
                          <span className={a.outcome === 'failed' ? 'text-destructive' : ''}>
                            {a.outcome === 'sent' ? 'enviado' : a.outcome === 'skipped' ? 'pulado' : 'falha'}
                            {a.message ? ` — ${a.message}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Fechar
          </Button>
          <Button onClick={run} disabled={running || !refMonth}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}