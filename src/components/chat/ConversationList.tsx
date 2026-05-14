import { useEffect, useState } from 'react';
import { Search, MessageSquarePlus, ArrowLeft, User, RefreshCw, ExternalLink, Timer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewConversationDialog } from './NewConversationDialog';
import type { ChatTab } from '@/pages/Chat';

export interface ConversationItem {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  avatarUrl?: string;
  companyNames?: string[];
  whatsappPhone?: string;
  clientId?: string | null;
  status?: string;
  assignedToName?: string | null;
  assignedToColor?: string | null;
  waitingSince?: string | null;
  totalWaitSeconds?: number;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
  loading?: boolean;
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  totalUnread?: number;
  waitingCount?: number;
  onNavigateBack?: () => void;
  onRefreshAvatars?: () => void;
  refreshingAvatars?: boolean;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM/yy', { locale: ptBR });
}

function formatWaitDuration(seconds: number) {
  if (seconds < 0) seconds = 0;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function waitColorClass(seconds: number) {
  if (seconds < 5 * 60) return 'bg-emerald-600 text-white';
  if (seconds < 15 * 60) return 'bg-amber-500 text-white';
  return 'bg-destructive text-destructive-foreground';
}

function WaitingBadge({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 ${waitColorClass(seconds)}`}>
      <Timer className="h-2.5 w-2.5" />
      {formatWaitDuration(seconds)}
    </span>
  );
}

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-border/30">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export function ConversationList({ conversations, activeId, onSelect, onCreated, loading, activeTab, onTabChange, totalUnread, waitingCount, onNavigateBack, onRefreshAvatars, refreshingAvatars }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = conversations.filter(c => {
    if (!q) return true;
    if (c.name.toLowerCase().includes(q)) return true;
    return (c.companyNames ?? []).some(n => n.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Header */}
       <div className="flex items-center justify-between p-2 md:p-3 bg-muted border-b bg-white">
        <div className="flex items-center gap-1">
          {onNavigateBack && (
            <Button variant="ghost" size="icon" onClick={onNavigateBack} className="h-8 w-8 md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="text-sm md:text-base font-semibold text-foreground">Conversas</h2>
        </div>
        <div className="flex items-center gap-1">
          {onRefreshAvatars && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefreshAvatars}
              disabled={refreshingAvatars}
              title="Atualizar fotos"
              className="hidden sm:inline-flex"
            >
              <RefreshCw className={`h-5 w-5 ${refreshingAvatars ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {window.location.pathname !== '/chat/popup' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('/chat/popup', 'chat_popup', 'popup=yes,width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')}
              title="Abrir em nova janela"
              className="hidden sm:inline-flex"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setNewDialogOpen(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
      </div>

       {/* Tabs */}
       <div className="px-2 pt-2 pb-1 bg-white">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ChatTab)}>
          <TabsList className="w-full bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-1 justify-stretch">
            <TabsTrigger
              value="mine"
              className="flex-1 text-xs relative rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground py-2.5 transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[5px] data-[state=active]:after:w-2 data-[state=active]:after:h-2 data-[state=active]:after:rotate-45 data-[state=active]:after:bg-primary"
            >
              Chat
              {totalUnread != null && totalUnread > 0 && (
                <span className="ml-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="in_progress"
              className="flex-1 text-xs relative rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground py-2.5 transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[5px] data-[state=active]:after:w-2 data-[state=active]:after:h-2 data-[state=active]:after:rotate-45 data-[state=active]:after:bg-primary"
            >
              Espera
              {waitingCount != null && waitingCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                  {waitingCount > 99 ? '99+' : waitingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="flex-1 text-xs relative rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground py-2.5 transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[5px] data-[state=active]:after:w-2 data-[state=active]:after:h-2 data-[state=active]:after:rotate-45 data-[state=active]:after:bg-primary"
            >
              Geral
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar conversa"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#F0F2F5] dark:bg-zinc-800 border-0 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-0 mx-[6px]">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
        ) : (
          filtered.map((conv, idx) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
               className="w-full gap-3 pl-2 md:pl-3 pr-0 py-2.5 md:py-3 hover:bg-[#F0F2F5] dark:hover:bg-zinc-800 transition-colors bg-white flex items-center justify-start rounded-md"
            >
              <Avatar className="h-11 w-11 md:h-12 md:w-12 shrink-0">
                {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={conv.name} />}
                <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-left">
                  {conv.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`flex-1 min-w-0 text-left pr-2 md:pr-3 ${idx < filtered.length - 1 ? 'border-b border-border/60 pb-2.5 md:pb-3' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{conv.name}</span>
                    {conv.companyNames && conv.companyNames.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 border-0 border-none rounded-none text-cyan-950 font-medium py-[2px] bg-inherit shadow-none text-left mx-0 my-0 px-[4px]">
                        {conv.companyNames.join(' • ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {conv.lastMessageAt && (
                      <span className={`text-[11px] ${conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center py-0 px-[6px] mx-0 my-0 bg-lime-600">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                {conv.status === 'open' && (
                  <div className="mt-1">
                    {conv.assignedToName ? (
                      <Badge
                        variant="secondary"
                        className="inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:opacity-90 text-[10px] py-0 px-1.5 h-4 gap-1 font-normal text-slate-50 border-0 rounded-none"
                        style={{ backgroundColor: conv.assignedToColor || '#D97706' }}
                      >
                        <User className="h-2.5 w-2.5" />
                        {conv.assignedToName.split(' ')[0]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                        Não atribuído
                      </Badge>
                    )}
                  </div>
                )}
                {activeTab === 'in_progress' && (conv.waitingSince || conv.lastMessageAt) && (
                  <div className="mt-1">
                    <WaitingBadge since={conv.waitingSince || conv.lastMessageAt} />
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={onCreated}
      />
    </div>
  );
}
