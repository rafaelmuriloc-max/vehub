import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';

type Profile = { user_id: string; full_name: string | null; avatar_url: string | null };

type Status = 'online' | 'idle' | 'offline';

const ONLINE_MS = 2 * 60 * 1000;       // <2 min since last activity → online
const IDLE_MS = 30 * 60 * 1000;        // 2–30 min → idle, >30 min → offline

function classify(lastSeen: number | undefined, now: number): Status {
  if (!lastSeen) return 'offline';
  const delta = now - lastSeen;
  if (delta < ONLINE_MS) return 'online';
  if (delta < IDLE_MS) return 'idle';
  return 'offline';
}

const dotClass: Record<Status, string> = {
  online: 'bg-green-500',
  idle: 'bg-gray-400',
  offline: 'bg-red-500',
};

const dotLabel: Record<Status, string> = {
  online: 'Online',
  idle: 'Inativo',
  offline: 'Offline',
};

export function LoggedUsersPanel() {
  const { presenceMap } = useOnlineUsers();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [, setTick] = useState(0);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .order('full_name', { ascending: true })
      .then(({ data }) => setProfiles((data as Profile[]) || []));
  }, []);

  // merge presence into lastSeen so a brief disconnect doesn't drop a user to "offline"
  useEffect(() => {
    const map = lastSeenRef.current;
    presenceMap.forEach((t, userId) => {
      const prev = map.get(userId) ?? 0;
      if (t > prev) map.set(userId, t);
    });
  }, [presenceMap]);

  // re-render every 30s so status transitions over time
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const enriched = profiles.map((p) => {
    const lastSeen = lastSeenRef.current.get(p.user_id) ?? presenceMap.get(p.user_id);
    return {
      ...p,
      status: classify(lastSeen, now),
      lastActivity: lastSeen,
    };
  });

  const order: Record<Status, number> = { online: 0, idle: 1, offline: 2 };
  enriched.sort((a, b) => {
    const d = order[a.status] - order[b.status];
    if (d !== 0) return d;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  const onlineCount = enriched.filter((u) => u.status === 'online').length;

  return (
    <div className="border-b bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Users className="h-3.5 w-3.5" />
          Usuários Logados
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {onlineCount}
        </span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto px-2 pb-2 chat-scroll">
          {enriched.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Nenhum usuário encontrado.</p>
          )}
          {enriched.map((u) => {
            const initials = (u.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            const minsAgo = u.lastActivity ? Math.max(0, Math.round((now - u.lastActivity) / 60000)) : null;
            const title =
              u.status === 'online'
                ? 'Online'
                : u.status === 'idle'
                ? `Logado, inativo há ${minsAgo} min`
                : 'Offline';
            return (
              <div key={u.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50" title={title}>
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${dotClass[u.status]}`}
                    aria-label={dotLabel[u.status]}
                  />
                </div>
                <span className="text-xs text-foreground truncate flex-1">{u.full_name || 'Sem nome'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}