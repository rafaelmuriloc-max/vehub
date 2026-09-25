import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Play, Square, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type TimeEntry = {
  id: string;
  task_id: string | null;
  instance_id: string | null;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

function entrySeconds(e: TimeEntry, nowMs: number): number {
  if (e.ended_at) return e.duration_seconds || 0;
  return Math.max(0, Math.floor((nowMs - new Date(e.started_at).getTime()) / 1000));
}

export function totalSeconds(entries: TimeEntry[], nowMs: number): number {
  return entries.reduce((acc, e) => acc + entrySeconds(e, nowMs), 0);
}

/**
 * Store compartilhado: um único canal realtime e uma consulta em lote para
 * todos os cronômetros montados na tela (antes era 1 por card).
 */
type Listener = (entries: TimeEntry[]) => void;
const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, TimeEntry[]>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let loadTimer: ReturnType<typeof setTimeout> | null = null;

function emit(key: string) {
  listeners.get(key)?.forEach(fn => fn(cache.get(key) || []));
}

async function loadAll() {
  const keys = [...listeners.keys()];
  const taskIds = keys.filter(k => k.startsWith('task:')).map(k => k.slice(5));
  const instanceIds = keys.filter(k => k.startsWith('instance:')).map(k => k.slice(9));
  const grouped = new Map<string, TimeEntry[]>();
  const push = (key: string, row: TimeEntry) => {
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  };
  const queries: Promise<any>[] = [];
  if (taskIds.length) queries.push(Promise.resolve(supabase.from('time_entries' as any).select('*').in('task_id', taskIds)));
  if (instanceIds.length) queries.push(Promise.resolve(supabase.from('time_entries' as any).select('*').in('instance_id', instanceIds)));
  const results = await Promise.all(queries);
  for (const res of results) {
    for (const row of ((res?.data as any[]) || []) as TimeEntry[]) {
      if (row.task_id) push(`task:${row.task_id}`, row);
      else if (row.instance_id) push(`instance:${row.instance_id}`, row);
    }
  }
  keys.forEach(key => {
    cache.set(key, grouped.get(key) || []);
    emit(key);
  });
}

function scheduleLoad() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => { loadTimer = null; void loadAll(); }, 150);
}

function subscribe(key: string, listener: Listener): () => void {
  const set = listeners.get(key) || new Set<Listener>();
  set.add(listener);
  listeners.set(key, set);
  if (cache.has(key)) listener(cache.get(key)!);
  if (!channel) {
    channel = supabase
      .channel('time-entries-shared')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => scheduleLoad())
      .subscribe();
  }
  scheduleLoad();
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

/**
 * Play/stop timer for a task OR an obligation instance.
 */
export function TimeTracker({ taskId, instanceId, compact = true }: { taskId?: string; instanceId?: string; compact?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const targetKey = taskId ? `task:${taskId}` : `instance:${instanceId}`;
  const busyRef = useRef(false);

  const load = useCallback(async () => { await loadAll(); }, []);

  useEffect(() => subscribe(targetKey, setEntries), [targetKey]);


  // Entradas de lote em aberto não contam "ao vivo" no card (o tempo é rateado ao finalizar).
  const openBatch = entries.find(e => !e.ended_at && (e as any).batch_id) || null;
  const running = entries.find(e => !e.ended_at && !(e as any).batch_id) || null;
  const myRunning = running && running.user_id === user?.id ? running : null;
  const [askPause, setAskPause] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running?.id]);

  async function stopEntry(entry: TimeEntry) {
    const ended = new Date();
    const secs = Math.max(1, Math.floor((ended.getTime() - new Date(entry.started_at).getTime()) / 1000));
    await supabase.from('time_entries' as any).update({ ended_at: ended.toISOString(), duration_seconds: secs } as any).eq('id', entry.id);
  }

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || busyRef.current) return;
    if (!myRunning) {
      const { data: b } = await supabase.from('time_batches' as any).select('id').eq('user_id', user.id).eq('status', 'running').maybeSingle();
      if (b) { setAskPause((b as any).id); return; }
    }
    await doToggle();
  }

  async function doToggle() {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (myRunning) {
        await stopEntry(myRunning);
      } else {
        // Garante um único cronômetro ativo por usuário: pausa qualquer outro individual.
        const { data: others } = await supabase
          .from('time_entries' as any)
          .select('*')
          .eq('user_id', user.id)
          .is('ended_at', null)
          .is('batch_id', null);
        for (const o of (others as any[]) || []) await stopEntry(o as TimeEntry);
        const payload: any = { user_id: user.id, task_id: taskId || null, instance_id: instanceId || null };
        const { error } = await supabase.from('time_entries' as any).insert(payload);
        if (error) throw error;
      }
      await load();
    } catch (err: any) {
      toast({ title: 'Erro no cronômetro', description: err.message, variant: 'destructive' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function pauseBatchThenStart() {
    const id = askPause;
    setAskPause(null);
    if (!id) return;
    const { error } = await (supabase.rpc as any)('pause_time_batch', { _id: id });
    if (error) { toast({ title: 'Não foi possível pausar o lote', description: error.message, variant: 'destructive' }); return; }
    await doToggle();
  }

  const total = totalSeconds(entries.filter(e => e.ended_at || !(e as any).batch_id), nowMs);

  const pauseDialog = (
    <AlertDialog open={!!askPause} onOpenChange={o => { if (!o) setAskPause(null); }}>
      <AlertDialogContent onClick={e => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cronômetro em lote ativo</AlertDialogTitle>
          <AlertDialogDescription>Você possui um cronômetro em lote ativo. Deseja pausá-lo antes de iniciar esta atividade?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={pauseBatchThenStart}>Pausar lote e iniciar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const batchBadge = openBatch ? (
    <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-medium"
      title="Esta obrigação está num cronômetro em lote. O tempo é dividido entre as obrigações ao finalizar.">
      <Layers className="h-3 w-3" />Em lote
    </span>
  ) : null;

  if (compact) {
    return (
      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {pauseDialog}
        {batchBadge}
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${myRunning ? 'text-red-500' : 'text-primary'}`}
          disabled={busy || (!!running && !myRunning)}
          title={running ? (myRunning ? 'Parar cronômetro' : 'Em execução por outro usuário') : 'Iniciar cronômetro'}
          onClick={toggle}
        >
          {myRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <span className={`text-xs tabular-nums ${running ? 'text-red-500 font-medium' : 'text-muted-foreground'}`} title="Tempo total registrado">
          <Timer className="h-3 w-3 inline mr-0.5 -mt-0.5" />{formatDuration(total)}
        </span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <Button
        variant={myRunning ? 'destructive' : 'default'}
        size="sm"
        disabled={busy || (!!running && !myRunning)}
        onClick={toggle}
      >
        {myRunning ? <Square className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
        {myRunning ? 'Parar' : 'Iniciar'}
      </Button>
      <div className="text-sm">
        <span className={`tabular-nums font-medium ${running ? 'text-red-500' : ''}`}>{formatDuration(total)}</span>
        <span className="text-muted-foreground ml-2 text-xs">
          {running ? (myRunning ? 'cronometrando agora' : 'em execução por outro usuário') : 'tempo total registrado'}
        </span>
      </div>
    </div>
  );
}
