import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PresenceMap = Map<string, number>; // user_id -> last_activity_at (ms)

interface OnlineUsersCtx {
  presenceMap: PresenceMap;
  bumpActivity: () => void;
}

const Ctx = createContext<OnlineUsersCtx>({ presenceMap: new Map(), bumpActivity: () => {} });

const HEARTBEAT_MS = 30_000; // re-track every 30s

export function OnlineUsersProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [presenceMap, setPresenceMap] = useState<PresenceMap>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastTrackRef = useRef<number>(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Keep Realtime auth in sync with the current JWT WITHOUT recreating the channel.
  useEffect(() => {
    if (session?.access_token) {
      try { supabase.realtime.setAuth(session.access_token); } catch {}
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!user?.id) {
      setPresenceMap(new Map());
      return;
    }

    // Authenticate Realtime with the user's JWT — without this, Presence
    // messages can be filtered as anonymous and other clients may not appear.
    if (sessionRef.current?.access_token) {
      try { supabase.realtime.setAuth(sessionRef.current.access_token); } catch {}
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
      console.log('[presence] sync — online users:', next.size, Array.from(next.keys()));
      setPresenceMap(next);
    };

    const trackNow = (force = false) => {
      const now = Date.now();
      if (!force && now - lastTrackRef.current < 5_000) return;
      lastTrackRef.current = now;
      channel.track({ user_id: user.id, last_activity_at: lastActivityRef.current }).catch(() => {});
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastActivityRef.current = Date.now();
        trackNow(true);
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'touchstart', 'focus', 'scroll'];
    activityEvents.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true } as AddEventListenerOptions));
    document.addEventListener('visibilitychange', onVisibility);

    const heartbeat = window.setInterval(() => {
      // Only re-track if there was activity since last track
      if (lastActivityRef.current > lastTrackRef.current - HEARTBEAT_MS) {
        trackNow();
      }
    }, HEARTBEAT_MS);

    let retryTimer: number | null = null;
    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        console.log('[presence] channel status:', status);
        if (status === 'SUBSCRIBED') {
          lastActivityRef.current = Date.now();
          trackNow(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Schedule a soft retry: drop and recreate via effect deps bump
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            try { supabase.removeChannel(channel); } catch {}
            if (sessionRef.current?.access_token) {
              try { supabase.realtime.setAuth(sessionRef.current.access_token); } catch {}
            }
          }, 5000);
        }
      });

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.clearInterval(heartbeat);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      try { channel.untrack(); } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  const bumpActivity = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;
    lastActivityRef.current = Date.now();
    lastTrackRef.current = Date.now();
    ch.track({ user_id: user.id, last_activity_at: lastActivityRef.current }).catch(() => {});
  }, [user?.id]);

  return <Ctx.Provider value={{ presenceMap, bumpActivity }}>{children}</Ctx.Provider>;
}

export function useOnlineUsers() {
  return useContext(Ctx);
}