import { useEffect, useState } from 'react';
import { Search, MessageSquarePlus, ArrowLeft, User, RefreshCw, ExternalLink, Timer, Clock, Flame, MessageSquareMore } from 'lucide-react';
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

  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-2 md:p-3 bg-muted border-b">
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
      <div className="px-0 pt-0 pb-0">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ChatTab)}>
          <TabsList className="w-full bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-0 justify-stretch">
            <TabsTrigger
              value="all"
              className="flex-1 relative rounded-none border-b-2 border-transparent bg-transparent text-[#515252] py-2.5 transition-all hover:text-foreground data-[state=active]:border-[#146BFE] data-[state=active]:text-[#515252] font-['Source_Sans_Pro'] font-bold text-[14px] data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[4px] data-[state=active]:after:w-0 data-[state=active]:after:h-0 data-[state=active]:after:border-l-[4px] data-[state=active]:after:border-l-transparent data-[state=active]:after:border-r-[4px] data-[state=active]:after:border-r-transparent data-[state=active]:after:border-t-[4px] data-[state=active]:after:border-t-[#146BFE]"
            >
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-[18px] w-[18px] text-[#515252]" />
                <span>Pendente</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="in_progress"
              className="flex-1 relative rounded-none border-b-2 border-transparent bg-transparent text-[#515252] py-2.5 transition-all hover:text-foreground data-[state=active]:border-[#146BFE] data-[state=active]:text-[#515252] font-['Source_Sans_Pro'] font-bold text-[14px] data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[4px] data-[state=active]:after:w-0 data-[state=active]:after:h-0 data-[state=active]:after:border-l-[4px] data-[state=active]:after:border-l-transparent data-[state=active]:after:border-r-[4px] data-[state=active]:after:border-r-transparent data-[state=active]:after:border-t-[4px] data-[state=active]:after:border-t-[#146BFE]"
            >
              <div className="flex flex-col items-center gap-1">
                <Flame className="h-[18px] w-[18px] text-[#FE9B0E]" />
                <span>Espera</span>
                {waitingCount != null && waitingCount > 0 && (
                  <span className="absolute top-1 right-2 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                    {waitingCount > 99 ? '99+' : waitingCount}
                  </span>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="mine"
              className="flex-1 relative rounded-none border-b-2 border-transparent bg-transparent text-[#515252] py-2.5 transition-all hover:text-foreground data-[state=active]:border-[#146BFE] data-[state=active]:text-[#515252] font-['Source_Sans_Pro'] font-bold text-[14px] data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:-bottom-[4px] data-[state=active]:after:w-0 data-[state=active]:after:h-0 data-[state=active]:after:border-l-[4px] data-[state=active]:after:border-l-transparent data-[state=active]:after:border-r-[4px] data-[state=active]:after:border-r-transparent data-[state=active]:after:border-t-[4px] data-[state=active]:after:border-t-[#146BFE]"
            >
              <div className="flex flex-col items-center gap-1">
                <MessageSquareMore className="h-[18px] w-[18px] text-[#146BFE]" />
                <span>Atendimento</span>
                {totalUnread != null && totalUnread > 0 && (
                  <span className="absolute top-1 right-2 inline-flex items-center justify-center bg-[#25D366] text-white text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
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
      <div className="flex-1 overflow-y-auto px-0 mx-[6px] bg-[#F5F6F6] dark:bg-zinc-900/50">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
        ) : (
          filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full px-2 py-2.5 md:py-3 hover:bg-[#F0F2F5] dark:hover:bg-zinc-800 transition-colors border-b border-[#F0F2F5] border-solid shadow-lg md:px-[12px] mx-0 my-0 flex-row flex items-start justify-start gap-[12px] text-left ${
                activeId === conv.id ? 'bg-[#F0F2F5] dark:bg-zinc-800' : ''
              }`}
            >
              <Avatar className="h-[49px] w-[49px] shrink-0 rounded-full">
                {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={conv.name} />}
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {conv.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 flex flex-col items-start justify-center gap-1 self-stretch">
                <div className="flex justify-between items-center mb-0 w-full">
                  <span className="font-semibold truncate text-[#111B21] dark:text-[#E9EDEF] text-[17px] leading-[21px]">{conv.name}</span>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-[#667781] dark:text-[#8696A0] whitespace-nowrap text-[12px] leading-[14px] shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden w-full flex items-center">
                  <div className="flex-1 flex flex-col min-w-0 py-0">
                    {conv.companyNames && conv.companyNames.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {conv.companyNames.join(' • ')}
                      </p>
                    )}
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm text-[#667781] dark:text-[#8696A0] truncate pr-2 text-[14px] leading-[20px] flex-1">
                        {conv.lastMessage || 'Sem mensagens'}
                      </span>
                      <div className="flex flex-col items-end gap-1 shrink-0 h-full justify-between pb-1">
                        {conv.unreadCount > 0 && (
                          <span className="flex items-center justify-center min-w-[20px] h-5 bg-[#25D366] text-white text-[11px] font-bold rounded-full px-1.5 shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {conv.status === 'open' && (
                  <div className="mt-1">
                    {conv.assignedToName ? (
                      <Badge variant="secondary" className="inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-secondary/80 text-[10px] py-0 px-1.5 h-4 gap-1 font-normal bg-amber-600 text-slate-50 border-0 rounded-none">
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
