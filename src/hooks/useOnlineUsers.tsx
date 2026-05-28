import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PresenceMap = Map<string, number>; // user_id -> last_activity_at (ms)

interface OnlineUsersCtx {
  presenceMap: PresenceMap;
  bumpActivity: () => void;
}

const Ctx = createContext<OnlineUsersCtx>({ presenceMap: new Map(), bumpActivity: () => {} });

export function OnlineUsersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<PresenceMap>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setPresenceMap(new Map());
      return;
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    const recompute = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string; last_activity_at?: number }>>;
      const next: PresenceMap = new Map();
      for (const key of Object.keys(state)) {
        const presences = state[key] || [];
        // most recent activity across all tabs/devices of this user
        let latest = 0;
        for (const p of presences) {
          const t = typeof p.last_activity_at === 'number' ? p.last_activity_at : 0;
          if (t > latest) latest = t;
        }
        next.set(key, latest || Date.now());
      }
      setPresenceMap(next);
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, last_activity_at: Date.now() });
        }
      });

    return () => {
      try { channel.untrack(); } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  const bumpActivity = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;
    ch.track({ user_id: user.id, last_activity_at: Date.now() }).catch(() => {});
  }, [user?.id]);

  return <Ctx.Provider value={{ presenceMap, bumpActivity }}>{children}</Ctx.Provider>;
}

export function useOnlineUsers() {
  return useContext(Ctx);
}