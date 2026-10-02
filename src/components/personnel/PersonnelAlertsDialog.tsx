import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertKind = 'experiencia' | 'ferias';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; kind: AlertKind }

interface Item { name: string; line: string }
interface Group {
  clientId: string; company: string; sci: string | null; document: string | null;
  phone: string | null; contact: string | null; items: Item[];
  lastSent: string | null; message: string;
}

const TRIAL_WINDOW = 15;
const VAC_WINDOW = 60;

function todaySP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function diff(date: string) {
  const t = new Date(`${todaySP()}T12:00:00`).getTime();
  return Math.round((new Date(`${date}T12:00:00`).getTime() - t) / 86400000);
}
function br(d: string) { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function leftTxt(n: number) { return n < 0 ? `vencido há ${-n} dia(s)` : n === 0 ? 'vence hoje' : `em ${n} dia(s)`; }

function buildMessage(kind: AlertKind, company: string, contact: string | null, items: Item[]) {
  const hello = `Olá${contact ? `, ${contact}` : ''}!`;
  const list = items.map(i => `👤 *${i.name}*\n${i.line}`).join('\n\n');
  if (kind === 'experiencia') {
    return `🔔 *Aviso de Contratos de Experiência*\n\n${hello} Segue a previsão de vencimento dos contratos de experiência da empresa *${company}*:\n\n${list}\n\n⚠️ Por favor, nos informe com antecedência se haverá prorrogação, efetivação ou desligamento.`;
  }
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return `🌴 *Posição de Férias — ${mes}*\n\n${hello} Seguem os colaboradores da empresa *${company}* com prazo limite de férias próximo ou vencido:\n\n${list}\n\nℹ️ Lembramos que o aviso de férias deve ser entregue ao colaborador com no mínimo 30 dias de antecedência do início do gozo.`;
}

export function PersonnelAlertsDialog({ open, onOpenChange, kind }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<{ company: string; ok: boolean; error?: string }[] | null>(null);
  const cancelRef = useRef(false);

  const title = kind === 'experiencia' ? 'Avisos de contratos de experiência' : 'Avisos de vencimento de férias';

  useEffect(() => {
    if (!open) return;
    setResults(null); setActive(null);
    (async () => {
      setLoading(true);
      try {
        const [cliRes, empRes, deptRes] = await Promise.all([
          supabase.from('clients').select('id, company_name, sci_code, document, contact_phone, contact_name, status').eq('status', 'active'),
          supabase.from('client_employees').select('id, client_id, full_name, status, trial_end_1, trial_days_1, trial_end_2, trial_days_2').eq('status', 'active'),
          supabase.from('departments').select('id, name').ilike('name', '%pessoal%'),
        ]);
        const clients = new Map((cliRes.data ?? []).map((c: any) => [c.id, c]));
        const emps = (empRes.data ?? []).filter((e: any) => clients.has(e.client_id));
        const byClient = new Map<string, Item[]>();
        const push = (cid: string, it: Item) => { const a = byClient.get(cid) ?? []; a.push(it); byClient.set(cid, a); };

        if (kind === 'experiencia') {
          for (const e of emps as any[]) {
            for (const [d, days, n] of [[e.trial_end_1, e.trial_days_1, 1], [e.trial_end_2, e.trial_days_2, 2]] as const) {
              if (!d) continue;
              const left = diff(d);
              if (left < 0 || left > TRIAL_WINDOW) continue;
              push(e.client_id, { name: e.full_name, line: `• ${n}º término${days ? ` (${days} dias)` : ''}\n• Vencimento: *${br(d)}* (${leftTxt(left)})` });
            }
          }
        } else {
          const { data: vac } = await supabase.from('employee_vacation_periods').select('employee_id, client_id, days_right, deadline_date, enjoy_end, acquisition_end');
          const empMap = new Map((emps as any[]).map(e => [e.id, e]));
          for (const p of (vac ?? []) as any[]) {
            const e = empMap.get(p.employee_id); if (!e) continue;
            const due = p.deadline_date ?? p.enjoy_end; if (!due) continue;
            if ((p.days_right ?? 0) <= 0) continue;
            if (p.acquisition_end && diff(p.acquisition_end) > 0) continue;
            const left = diff(due);
            if (left > VAC_WINDOW) continue;
            push(e.client_id, { name: e.full_name, line: `• Limite: *${br(due)}* (${leftTxt(left)})\n• Saldo: ${Number(p.days_right).toLocaleString('pt-BR')} dias${left < 0 ? '\n• ⚠️ Férias vencidas (risco de pagamento em dobro)' : ''}` });
          }
        }

        const ids = [...byClient.keys()];
        const deptIds = (deptRes.data ?? []).map((d: any) => d.id);
        const [contRes, logRes] = await Promise.all([
          ids.length && deptIds.length
            ? supabase.from('client_department_contacts').select('client_id, contact_phone, contact_name').in('client_id', ids).in('department_id', deptIds)
            : Promise.resolve({ data: [] as any[] }),
          ids.length
            ? supabase.from('personnel_alert_logs' as any).select('client_id, created_at').eq('kind', kind).eq('status', 'sent').in('client_id', ids).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const contacts = new Map<string, any>();
        for (const c of (contRes.data ?? []) as any[]) if (c.contact_phone && !contacts.has(c.client_id)) contacts.set(c.client_id, c);
        const lastLog = new Map<string, string>();
        for (const l of (logRes.data ?? []) as any[]) if (!lastLog.has(l.client_id)) lastLog.set(l.client_id, l.created_at);

        const list: Group[] = ids.map(cid => {
          const c: any = clients.get(cid);
          const dc = contacts.get(cid);
          const phone = dc?.contact_phone || c.contact_phone || null;
          const contact = dc?.contact_name || c.contact_name || null;
          const items = byClient.get(cid)!;
          return { clientId: cid, company: c.company_name, sci: c.sci_code, document: c.document, phone, contact, items, lastSent: lastLog.get(cid) ?? null, message: buildMessage(kind, c.company_name, contact, items) };
        }).sort((a, b) => a.company.localeCompare(b.company, 'pt-BR'));
        setGroups(list);
        setSelected(new Set(list.filter(g => g.phone && !recent(g.lastSent)).map(g => g.clientId)));
        setActive(list[0]?.clientId ?? null);
      } finally { setLoading(false); }
    })();
  }, [open, kind]);

  function recent(d: string | null) {
    if (!d) return false;
    const days = (Date.now() - new Date(d).getTime()) / 86400000;
    return kind === 'experiencia' ? days < 7 : new Date(d).getMonth() === new Date().getMonth() && days < 31;
  }

  const sendable = groups.filter(g => g.phone);
  const toSend = groups.filter(g => g.phone && selected.has(g.clientId));
  const totalEmp = groups.reduce((s, g) => s + g.items.length, 0);
  const current = useMemo(() => groups.find(g => g.clientId === active) ?? null, [groups, active]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = sendable.length > 0 && sendable.every(g => selected.has(g.clientId));

  async function run() {
    cancelRef.current = false;
    setSending(true); setProgress({ done: 0, total: toSend.length });
    const { data: u } = await supabase.auth.getUser();
    const out: { company: string; ok: boolean; error?: string }[] = [];
    for (let i = 0; i < toSend.length; i++) {
      if (cancelRef.current) break;
      const g = toSend[i];
      let ok = false; let error: string | undefined;
      try {
        const { data, error: err } = await supabase.functions.invoke('whatsapp-send', {
          body: { to: g.phone, type: 'text', text: g.message, clientId: g.clientId },
        });
        if (err || data?.error) error = data?.error || err?.message || 'Falha no envio'; else ok = true;
      } catch (e: any) { error = e?.message || 'Falha no envio'; }
      await supabase.from('personnel_alert_logs' as any).insert({
        client_id: g.clientId, kind, recipient_phone: g.phone, recipient_name: g.contact,
        message: g.message, status: ok ? 'sent' : 'error', error: error ?? null,
        employees_count: g.items.length, sent_by: u?.user?.id,
      });
      out.push({ company: g.company, ok, error });
      setProgress({ done: i + 1, total: toSend.length });
      if (ok) setGroups(gs => gs.map(x => x.clientId === g.clientId ? { ...x, lastSent: new Date().toISOString() } : x));
      if (i < toSend.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setSending(false); setResults(out);
    const okN = out.filter(r => r.ok).length;
    toast({ title: 'Envio concluído', description: `${okN} de ${out.length} aviso(s) enviado(s).` });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-5xl w-full h-[100dvh] sm:h-[85vh] p-0 flex flex-col gap-0 sm:rounded-lg">
        <DialogHeader className="p-4 sm:p-6 border-b">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {loading ? 'Carregando...' : `${groups.length} empresa(s) • ${totalEmp} ${kind === 'experiencia' ? 'prazo(s) nos próximos 15 dias' : 'período(s) vencidos ou a vencer em 60 dias'} • ${groups.length - sendable.length} sem WhatsApp`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : results ? (
          <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm border rounded-md p-2">
                {r.ok ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                <div><p className="font-medium">{r.company}</p>{r.error && <p className="text-xs text-destructive">{r.error}</p>}</div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">Nenhum vencimento no período. Nada a enviar.</div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-auto border-b md:border-b-0 md:border-r max-h-[40dvh] md:max-h-none">
              <label className="flex items-center gap-2 px-4 py-2 border-b text-sm sticky top-0 bg-background z-10">
                <Checkbox checked={allOn} onCheckedChange={v => setSelected(v ? new Set(sendable.map(g => g.clientId)) : new Set())} />
                Marcar/desmarcar todas ({toSend.length} selecionada(s))
              </label>
              {groups.map(g => (
                <div key={g.clientId} onClick={() => setActive(g.clientId)}
                  className={cn('flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-muted/40', active === g.clientId && 'bg-muted/60')}>
                  <div onClick={e => e.stopPropagation()} className="pt-0.5">
                    <Checkbox disabled={!g.phone} checked={selected.has(g.clientId)} onCheckedChange={() => toggle(g.clientId)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{g.company}</p>
                    <p className="text-xs text-muted-foreground truncate">SCI {g.sci ?? '—'} · {g.document ?? 'Sem CNPJ'}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="secondary">{g.items.length} colaborador(es)</Badge>
                      {g.phone ? <Badge variant="outline">{g.phone}</Badge> : <Badge variant="destructive">Sem WhatsApp</Badge>}
                      {recent(g.lastSent) && <Badge className="bg-warning/10 text-warning border-warning/20"><AlertTriangle className="h-3 w-3 mr-1" />Já enviado em {new Date(g.lastSent!).toLocaleDateString('pt-BR')}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="min-h-0 flex flex-col p-4 gap-2">
              {current ? (
                <>
                  <p className="text-sm font-medium">Prévia para {current.contact || current.company}</p>
                  <Textarea className="flex-1 min-h-[200px] text-sm font-mono" value={current.message}
                    onChange={e => setGroups(gs => gs.map(x => x.clientId === current.clientId ? { ...x, message: e.target.value } : x))} />
                  <p className="text-xs text-muted-foreground">Você pode editar o texto antes de enviar.</p>
                </>
              ) : <p className="text-sm text-muted-foreground">Selecione uma empresa para ver a mensagem.</p>}
            </div>
          </div>
        )}

        <DialogFooter className="p-4 border-t flex-col sm:flex-row gap-2">
          {sending && (
            <div className="flex-1 flex items-center gap-2 text-sm">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="flex-1" />
              <span className="whitespace-nowrap">Enviando {progress.done} de {progress.total}</span>
            </div>
          )}
          {sending ? (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Cancelar</Button>
          ) : results ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button disabled={toSend.length === 0 || loading} onClick={run}><Send className="h-4 w-4 mr-2" />Disparar {toSend.length} aviso(s)</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
