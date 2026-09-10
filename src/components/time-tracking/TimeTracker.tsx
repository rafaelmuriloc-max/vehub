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
 * Self-contained play/stop timer for a task OR an obligation instance.
 * Loads its own entries and syncs via realtime.
 */
export function TimeTracker({ taskId, instanceId, compact = true }: { taskId?: string; instanceId?: string; compact?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const targetKey = taskId ? `task:${taskId}` : `instance:${instanceId}`;
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    let q = supabase.from('time_entries' as any).select('*');
    q = taskId ? q.eq('task_id', taskId) : q.eq('instance_id', instanceId!);
    const { data } = await q;
    setEntries(((data as any[]) || []) as TimeEntry[]);
  }, [taskId, instanceId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`time-entries-${targetKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, (payload) => {
        const row: any = payload.new || payload.old;
        if ((taskId && row?.task_id === taskId) || (instanceId && row?.instance_id === instanceId)) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, targetKey, taskId, instanceId]);

  const running = entries.find(e => !e.ended_at) || null;
  const myRunning = running && running.user_id === user?.id ? running : null;

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
    busyRef.current = true;
    setBusy(true);
    try {
      if (myRunning) {
        await stopEntry(myRunning);
      } else {
        // Garante um único cronômetro ativo por usuário: pausa qualquer outro.
        const { data: others } = await supabase
          .from('time_entries' as any)
          .select('*')
          .eq('user_id', user.id)
          .is('ended_at', null);
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

  const total = totalSeconds(entries, nowMs);

  if (compact) {
    return (
      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
