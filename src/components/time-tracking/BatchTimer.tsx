import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Layers, Pause, Play, Square, Loader2, Scale } from 'lucide-react';
import { formatDuration } from './TimeTracker';
import { splitEqual, workedSeconds, isValidManualSplit } from '@/lib/timeBatch';

export type BatchItem = {
  instanceId: string;
  clientId: string;
  clientLabel: string;
  obligationName: string;
  referenceMonth: string | null;
  eligible: boolean;
  reason?: string;
};

type Batch = {
  id: string; user_id: string; label: string; status: 'running' | 'paused' | 'finished';
  started_at: string; finished_at: string | null; worked_seconds: number; split_mode: string;
};
type Pause = { paused_at: string; resumed_at: string | null };
type BatchEntry = { id: string; instance_id: string; duration_seconds: number };

/* ---------------- Store do lote aberto do usuário ---------------- */
type State = { batch: Batch | null; pauses: Pause[]; entries: BatchEntry[] };
let state: State = { batch: null, pauses: [], entries: [] };
const subs = new Set<(s: State) => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUser: string | null = null;

async function refresh() {
  if (!currentUser) return;
  const { data: b } = await supabase.from('time_batches' as any).select('*')
    .eq('user_id', currentUser).in('status', ['running', 'paused']).maybeSingle();
  const batch = (b as any) as Batch | null;
  let pauses: Pause[] = [], entries: BatchEntry[] = [];
  if (batch) {
    const [p, e] = await Promise.all([
      supabase.from('time_batch_pauses' as any).select('paused_at, resumed_at').eq('batch_id', batch.id),
      supabase.from('time_entries' as any).select('id, instance_id, duration_seconds').eq('batch_id', batch.id),
    ]);
    pauses = (p.data as any) || []; entries = (e.data as any) || [];
  }
  state = { batch, pauses, entries };
  subs.forEach(fn => fn(state));
}

export function refreshActiveBatch() { return refresh(); }

export function useActiveBatch() {
  const { user } = useAuth();
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    if (!user) return;
    if (currentUser !== user.id) { currentUser = user.id; void refresh(); }
    subs.add(setS);
    setS(state);
    if (!channel) {
      channel = supabase.channel('time-batches-active')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_batches' }, () => void refresh())
        .subscribe();
    }
    return () => {
      subs.delete(setS);
      if (subs.size === 0 && channel) { supabase.removeChannel(channel); channel = null; }
    };
  }, [user?.id]);
  return s;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function monthLabel(m: string | null) {
  if (!m) return '—';
  const [y, mo] = m.slice(0, 7).split('-');
  return `${mo}/${y}`;
}

/* ---------------- Início ---------------- */
export function BatchStartDialog({ open, onOpenChange, items, onStarted }: {
  open: boolean; onOpenChange: (o: boolean) => void; items: BatchItem[]; onStarted?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const eligible = items.filter(i => i.eligible);
  const skipped = items.filter(i => !i.eligible);
  const names = [...new Set(eligible.map(i => i.obligationName))];
  const months = [...new Set(eligible.map(i => monthLabel(i.referenceMonth)))];
  const companies = new Set(eligible.map(i => i.clientId)).size;
  const label = names.length === 1 ? names[0] : 'Obrigações diferentes';

  async function start() {
    if (busy || !eligible.length) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)('start_time_batch', {
      _instance_ids: eligible.map(i => i.instanceId),
      _label: `${label} · ${months.join(', ')}`,
    });
    setBusy(false);
    if (error) { toast({ title: 'Não foi possível iniciar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cronômetro em lote iniciado', description: `${eligible.length} obrigação(ões) de ${companies} empresa(s).` });
    await refresh();
    onStarted?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Iniciar cronômetro em lote</DialogTitle>
          <DialogDescription>Um único cronômetro para todas. Ao finalizar, o tempo é dividido igualmente entre as obrigações.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Obrigação:</span> <strong>{label}</strong></div>
          <div><span className="text-muted-foreground">Competência:</span> <strong>{months.join(', ') || '—'}</strong></div>
          <div><span className="text-muted-foreground">Empresas:</span> <strong>{companies}</strong></div>
          <div><span className="text-muted-foreground">Obrigações:</span> <strong>{eligible.length}</strong></div>
        </div>
        {names.length > 1 && (
          <p className="text-xs text-amber-600">Atenção: obrigações diferentes selecionadas. Continue só se forem feitas numa única operação.</p>
        )}
        <div className="max-h-56 overflow-auto rounded-md border divide-y text-sm">
          {eligible.map(i => (
            <div key={i.instanceId} className="px-3 py-1.5 flex justify-between gap-2">
              <span className="truncate">{i.clientLabel}</span>
              <span className="text-xs text-muted-foreground shrink-0">{i.obligationName}</span>
            </div>
          ))}
        </div>
        {skipped.length > 0 && (
          <div className="text-xs rounded-md bg-muted p-2 space-y-0.5">
            <div className="font-medium">{skipped.length} desconsiderada(s):</div>
            {skipped.map(i => <div key={i.instanceId}>• {i.clientLabel} — {i.reason}</div>)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={start} disabled={busy || !eligible.length}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Iniciar ({eligible.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Painel fixo ---------------- */
export function BatchPanel({ describe, onCompleteInstances }: {
  describe: (instanceId: string) => { clientId: string; clientLabel: string; completable: boolean } | null;
  onCompleteInstances: (ids: string[]) => Promise<void>;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { batch, pauses, entries } = useActiveBatch();
  const now = useNow(batch?.status === 'running');
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finished, setFinished] = useState<{ id: string; total: number; entries: BatchEntry[] } | null>(null);

  if (!batch && !finished) return null;

  const worked = batch ? workedSeconds(batch.started_at, pauses, now) : 0;
  const n = entries.length || 1;
  const companies = new Set(entries.map(e => describe(e.instance_id)?.clientId || e.instance_id)).size;

  async function call(fn: string) {
    if (!batch || busy) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)(fn, { _id: batch.id });
    setBusy(false);
    if (error) toast({ title: 'Erro no cronômetro em lote', description: error.message, variant: 'destructive' });
    await refresh();
  }

  return (
    <>
      {batch && (
        <div className="fixed top-3 right-4 z-40 w-[min(92vw,380px)] rounded-lg border bg-card shadow-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                <Layers className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">{batch.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entries.length} obrigação(ões) · {companies} empresa(s) · {profile?.full_name || 'Você'}
              </div>
            </div>
            <Badge variant={batch.status === 'running' ? 'destructive' : 'secondary'}>
              {batch.status === 'running' ? 'Em andamento' : 'Pausado'}
            </Badge>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatDuration(worked)}</div>
              <div className="text-xs text-muted-foreground">≈ {formatDuration(Math.floor(worked / n))} por obrigação</div>
            </div>
            <div className="flex gap-1.5">
              {batch.status === 'running' ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => call('pause_time_batch')}><Pause className="h-4 w-4 mr-1" />Pausar</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => call('resume_time_batch')}><Play className="h-4 w-4 mr-1" />Retomar</Button>
              )}
              <Button size="sm" disabled={busy} onClick={() => setFinishOpen(true)}><Square className="h-4 w-4 mr-1" />Finalizar</Button>
            </div>
          </div>
        </div>
      )}

      {batch && (
        <BatchFinishDialog
          open={finishOpen}
          onOpenChange={setFinishOpen}
          batchId={batch.id}
          entries={entries}
          describe={describe}
          onCompleteInstances={onCompleteInstances}
          onFinished={(total, ents) => setFinished({ id: batch.id, total, entries: ents })}
        />
      )}

      {finished && (
        <BatchSplitDialog
          open={!!finished}
          onOpenChange={o => { if (!o) setFinished(null); }}
          batchId={finished.id}
          total={finished.total}
          describe={describe}
        />
      )}
    </>
  );
}

/* ---------------- Finalização ---------------- */
function BatchFinishDialog({ open, onOpenChange, batchId, entries, describe, onCompleteInstances, onFinished }: {
  open: boolean; onOpenChange: (o: boolean) => void; batchId: string; entries: BatchEntry[];
  describe: (id: string) => { clientLabel: string; completable: boolean } | null;
  onCompleteInstances: (ids: string[]) => Promise<void>;
  onFinished: (total: number, entries: BatchEntry[]) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'time' | 'all' | 'pick'>('time');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const completable = entries.filter(e => describe(e.instance_id)?.completable);

  useEffect(() => { if (open) { setMode('time'); setPicked(new Set(completable.map(e => e.instance_id))); } }, [open]);

  async function finish() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)('finish_time_batch', { _id: batchId });
    if (error) { setBusy(false); toast({ title: 'Erro ao finalizar', description: error.message, variant: 'destructive' }); return; }
    const total = Number(data) || 0;
    const ids = mode === 'all' ? completable.map(e => e.instance_id) : mode === 'pick' ? [...picked] : [];
    if (ids.length) await onCompleteInstances(ids);
    toast({ title: 'Lote finalizado', description: `${formatDuration(total)} divididos entre ${entries.length} obrigação(ões).${ids.length ? ` ${ids.length} concluída(s).` : ''}` });
    setBusy(false);
    onOpenChange(false);
    await refresh();
    onFinished(total, entries);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar cronômetro em lote</DialogTitle>
          <DialogDescription>O tempo trabalhado será dividido igualmente entre as {entries.length} obrigações.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={v => setMode(v as any)} className="space-y-2">
          <div className="flex items-center gap-2"><RadioGroupItem value="time" id="bm-time" /><Label htmlFor="bm-time">Apenas registrar o tempo</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="all" id="bm-all" /><Label htmlFor="bm-all">Registrar e concluir todas ({completable.length})</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="pick" id="bm-pick" /><Label htmlFor="bm-pick">Registrar e escolher quais concluir</Label></div>
        </RadioGroup>
        {mode === 'pick' && (
          <div className="max-h-56 overflow-auto rounded-md border divide-y text-sm">
            {completable.map(e => (
              <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
                <Checkbox checked={picked.has(e.instance_id)} onCheckedChange={c => {
                  const s = new Set(picked); if (c) s.add(e.instance_id); else s.delete(e.instance_id); setPicked(s);
                }} />
                <span className="truncate">{describe(e.instance_id)?.clientLabel || e.instance_id}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={finish} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Finalizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Rateio manual (opcional) ---------------- */
export function BatchSplitDialog({ open, onOpenChange, batchId, total, describe }: {
  open: boolean; onOpenChange: (o: boolean) => void; batchId: string; total: number;
  describe: (id: string) => { clientLabel: string } | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<{ id: string; instance_id: string; minutes: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('time_entries' as any).select('id, instance_id, duration_seconds').eq('batch_id', batchId).order('id')
      .then(({ data }) => setRows(((data as any[]) || []).map(r => ({ id: r.id, instance_id: r.instance_id, minutes: (r.duration_seconds / 60).toFixed(2) }))));
  }, [open, batchId]);

  const secs = useMemo(() => rows.map(r => Math.round((parseFloat(r.minutes.replace(',', '.')) || 0) * 60)), [rows]);
  // ajusta arredondamento: diferença de até 1s por linha vai para a última
  const adjusted = useMemo(() => {
    const s = [...secs]; const diff = total - s.reduce((a, b) => a + b, 0);
    if (s.length && Math.abs(diff) <= s.length) s[s.length - 1] += diff;
    return s;
  }, [secs, total]);
  const sum = adjusted.reduce((a, b) => a + b, 0);
  const valid = isValidManualSplit(adjusted, total);

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const split: Record<string, number> = {};
    rows.forEach((r, i) => { split[r.id] = adjusted[i]; });
    const { error } = await (supabase.rpc as any)('resplit_time_batch', { _id: batchId, _split: split });
    setBusy(false);
    if (error) { toast({ title: 'Rateio não salvo', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Rateio atualizado' });
    onOpenChange(false);
  }

  function resetEqual() {
    const eq = splitEqual(total, rows.length);
    setRows(rows.map((r, i) => ({ ...r, minutes: (eq[i] / 60).toFixed(2) })));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Tempo registrado</DialogTitle>
          <DialogDescription>
            Total trabalhado: <strong>{formatDuration(total)}</strong>, dividido igualmente. Se o esforço foi diferente entre as empresas, ajuste o rateio (opcional).
          </DialogDescription>
        </DialogHeader>
        {editing ? (
          <>
            <div className="max-h-72 overflow-auto rounded-md border divide-y text-sm">
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="flex-1 truncate">{describe(r.instance_id)?.clientLabel || r.instance_id}</span>
                  <Input className="w-24 h-8 text-right" value={r.minutes} inputMode="decimal"
                    onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, minutes: e.target.value } : x))} />
                  <span className="text-xs text-muted-foreground w-8">min</span>
                </div>
              ))}
            </div>
            <div className={`text-sm ${valid ? 'text-muted-foreground' : 'text-destructive'}`}>
              Soma: {formatDuration(sum)} de {formatDuration(total)}{!valid && ' — a soma precisa ser igual ao total'}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={resetEqual}>Voltar ao rateio igual</Button>
              <Button onClick={save} disabled={!valid || busy}>Salvar rateio</Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(true)}>Ajustar rateio</Button>
            <Button onClick={() => onOpenChange(false)}>Concluir</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
