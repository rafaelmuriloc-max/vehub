import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricCard } from './MetricCard';
import { MessageCircle, Clock, UserX, List } from 'lucide-react';


function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, '0')}`;
}

export function TicketsPanel() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['dashboard-tickets'],
    refetchInterval: 15000,
    queryFn: async () => {
      const [open, byAgent, awaiting, unassigned] = await Promise.all([
        supabase.from('chat_conversations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase
          .from('chat_conversations')
          .select('assigned_to')
          .eq('status', 'open')
          .not('assigned_to', 'is', null),
        supabase
          .from('chat_conversations')
          .select('id, name, whatsapp_phone, waiting_since, assigned_to')
          .eq('status', 'open')
          .eq('awaiting_first_reply', true)
          .order('waiting_since', { ascending: true })
          .limit(8),
        supabase
          .from('chat_conversations')
          .select('id, name, whatsapp_phone, waiting_since')
          .eq('status', 'open')
          .is('assigned_to', null)
          .order('waiting_since', { ascending: true })
          .limit(8),
      ]);

      const userIds = Array.from(new Set([
        ...((byAgent.data ?? []).map((r: any) => r.assigned_to).filter(Boolean)),
        ...((awaiting.data ?? []).map((r: any) => r.assigned_to).filter(Boolean)),
      ]));

      const profileMap: Record<string, { name: string; color: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, tag_color')
          .in('user_id', userIds);
        (profs ?? []).forEach((p: any) => {
          profileMap[p.user_id] = { name: p.full_name ?? 'Atendente', color: p.tag_color ?? null };
        });
      }

      const agents: Record<string, { name: string; color: string | null; count: number }> = {};
      (byAgent.data ?? []).forEach((r: any) => {
        const id = r.assigned_to;
        if (!id) return;
        const prof = profileMap[id];
        agents[id] = agents[id] || {
          name: prof?.name ?? 'Atendente',
          color: prof?.color ?? null,
          count: 0,
        };
        agents[id].count += 1;
      });

      const awaitingEnriched = (awaiting.data ?? []).map((c: any) => ({
        ...c,
        profile: c.assigned_to ? profileMap[c.assigned_to] : null,
      }));

      return {
        open: open.count ?? 0,
        agents: Object.values(agents).sort((a, b) => b.count - a.count),
        awaiting: awaitingEnriched,
        unassigned: unassigned.data ?? [],
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel('dashboard-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-tickets'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-tickets'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const now = Date.now();

  return (
    <Card className="bg-card/40 border-border/40 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Chamados</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/tickets')}>
          <List className="h-4 w-4 mr-2" /> Ver chamados
        </Button>
      </div>


      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Abertos" value={data?.open ?? '—'} />
        <MetricCard
          label="Aguard. 1ª resposta"
          value={data?.awaiting?.length ?? '—'}
          accent={(data?.awaiting?.length ?? 0) > 0 ? 'warning' : 'default'}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Sem atribuição"
          value={data?.unassigned?.length ?? '—'}
          accent={(data?.unassigned?.length ?? 0) > 0 ? 'danger' : 'default'}
          icon={<UserX className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Por atendente</div>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {data?.agents && data.agents.length > 0 ? data.agents.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color ?? 'hsl(var(--primary))' }} />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="tabular-nums font-semibold">{a.count}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nenhum chamado atribuído.</p>}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Aguardando 1ª resposta</div>
          <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
            {data?.awaiting && data.awaiting.length > 0 ? data.awaiting.map((c: any) => {
              const wait = c.waiting_since ? Math.floor((now - new Date(c.waiting_since).getTime()) / 1000) : 0;
              return (
                <div key={c.id} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md bg-amber-500/5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="flex-1 truncate">{c.name || c.whatsapp_phone || 'Conversa'}</span>
                  {c.profile?.name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (c.profile?.color ?? 'hsl(var(--primary))') + '33', color: c.profile?.color ?? undefined }}>
                      {c.profile.name}
                    </span>
                  )}
                  <span className="tabular-nums text-xs text-amber-300">{formatWait(wait)}</span>
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">Tudo respondido.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}