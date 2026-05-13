import { useState } from 'react';
import { Search, MessageSquarePlus, ArrowLeft, User, RefreshCw } from 'lucide-react';
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

export function ConversationList({ conversations, activeId, onSelect, onCreated, loading, activeTab, onTabChange, totalUnread, onNavigateBack, onRefreshAvatars, refreshingAvatars }: ConversationListProps) {
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
          <Button variant="ghost" size="icon" onClick={() => setNewDialogOpen(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-2 pt-2">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ChatTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="mine" className="flex-1 text-xs relative">
              Chat
              {totalUnread != null && totalUnread > 0 && (
                <span className="ml-1 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-4 px-1">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex-1 text-xs">
              <span className="md:hidden">Andamento</span>
              <span className="hidden md:inline">Em andamento</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">Geral</TabsTrigger>
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
      <div className="flex-1 overflow-y-auto">
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
              className={`w-full flex items-center gap-3 px-2 py-2.5 md:px-3 md:py-3 hover:bg-[#F0F2F5] dark:hover:bg-zinc-800 transition-colors border-b border-border/30 ${
                activeId === conv.id ? 'bg-[#F0F2F5] dark:bg-zinc-800' : ''
              }`}
            >
              <Avatar className="h-11 w-11 md:h-12 md:w-12 shrink-0">
                {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={conv.name} />}
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {conv.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{conv.name}</span>
                  {conv.lastMessageAt && (
                    <span className={`text-[11px] shrink-0 ${conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                {conv.companyNames && conv.companyNames.length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {conv.companyNames.join(' • ')}
                  </p>
                )}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{conv.lastMessage || 'Sem mensagens'}</span>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 shrink-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1.5">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                {conv.status === 'open' && (
                  <div className="mt-1">
                    {conv.assignedToName ? (
                      <Badge variant="secondary" className="inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-secondary/80 text-[10px] py-0 px-1.5 h-4 gap-1 font-normal bg-amber-600 text-slate-50 border-0 rounded-sm">
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
