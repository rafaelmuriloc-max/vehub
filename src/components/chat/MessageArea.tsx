import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MessageCircle, CheckCircle2, UserRoundPlus, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
  sender_name?: string;
  message_type?: string;
  media_url?: string;
}

interface MessageAreaProps {
  conversationName: string | null;
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (message: string) => void;
  onSendMedia?: (file: File, type: 'image' | 'video' | 'document' | 'audio') => void;
  onSendLocation?: (lat: number, lng: number, name?: string) => void;
  onSendContact?: (name: string, phone: string) => void;
  onPickFromObligation?: () => void;
  isGroup?: boolean;
  avatarUrl?: string;
  currentUserName?: string;
  companyNames?: string[];
  isClosed?: boolean;
  onCloseTicket?: () => void;
  onReopenTicket?: () => void;
  onTransferTicket?: () => void;
  whatsappPhone?: string;
  onBack?: () => void;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function MessageArea({ conversationName, messages, currentUserId, onSend, onSendMedia, onSendLocation, onSendContact, onPickFromObligation, isGroup, avatarUrl, currentUserName, companyNames, isClosed, onCloseTicket, onReopenTicket, onTransferTicket, whatsappPhone, onBack }: MessageAreaProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!conversationName) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] dark:bg-zinc-900 text-muted-foreground">
        <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Velocitä Chat</p>
        <p className="text-sm mt-1">Selecione uma conversa para começar</p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { label: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(msg => {
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && isSameDay(new Date(last.msgs[0].created_at), new Date(msg.created_at))) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ label: formatDateLabel(msg.created_at), msgs: [msg] });
    }
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 bg-[#F0F2F5] dark:bg-zinc-800 border-b shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
          <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="focus:outline-none rounded-full">
              <Avatar className="h-9 w-9 md:h-10 md:w-10 cursor-pointer">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={conversationName || ''} />}
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {conversationName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-auto p-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{whatsappPhone || 'Sem telefone'}</span>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{conversationName}</p>
            {isClosed && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Fechado</Badge>
            )}
          </div>
          {companyNames && companyNames.length > 0 && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[400px]">
              {companyNames.join(' | ')}
            </p>
          )}
        </div>
        {!isClosed && onTransferTicket && (
          <Button variant="outline" size="icon" onClick={onTransferTicket} className="shrink-0 h-8 w-8 md:h-auto md:w-auto md:px-3 md:gap-1.5">
            <UserRoundPlus className="h-4 w-4" />
            <span className="hidden md:inline text-sm">Transferir</span>
          </Button>
        )}
        {!isClosed && onCloseTicket && (
          <Button variant="outline" size="icon" onClick={onCloseTicket} className="shrink-0 h-8 w-8 md:h-auto md:w-auto md:px-3 md:gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden md:inline text-sm">Fechar Chamado</span>
          </Button>
        )}
        {isClosed && onReopenTicket && (
          <Button variant="outline" size="icon" onClick={onReopenTicket} className="shrink-0 h-8 w-8 md:h-auto md:w-auto md:px-3 md:gap-1.5">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden md:inline text-sm">Reabrir Chamado</span>
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 md:px-4"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23ccc\' opacity=\'0.15\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'%23ECE5DD\' width=\'200\' height=\'200\'/%3E%3Crect fill=\'url(%23p)\' width=\'200\' height=\'200\'/%3E%3C/svg%3E")', backgroundColor: '#ECE5DD' }}
      >
        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="bg-white/80 dark:bg-zinc-700/80 text-xs text-muted-foreground px-3 py-1 rounded-lg shadow-sm">
                {group.label}
              </span>
            </div>
            {group.msgs.map(msg => {
              const isIncoming = msg.message_type === 'whatsapp_incoming' || (msg.message_type?.startsWith('whatsapp_incoming_') ?? false);
              const isOutgoing = msg.message_type === 'whatsapp_outgoing' || msg.message_type === 'whatsapp';
              const showOnRight = !isIncoming && (isOutgoing || msg.sender_id === currentUserId);
              return (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  timestamp={msg.created_at}
                  isMine={msg.sender_id === currentUserId}
                  isRead={!!msg.read_at}
                  senderName={showOnRight ? msg.sender_name : undefined}
                  isGroup={isGroup}
                  messageType={msg.message_type}
                  mediaUrl={msg.media_url}
                  avatarUrl={avatarUrl}
                />
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {isClosed ? (
        <div className="px-4 py-3 bg-muted flex items-center justify-center gap-3 border-t">
          <span className="text-sm text-muted-foreground">Este chamado foi encerrado.</span>
          {onReopenTicket && (
            <Button variant="outline" size="sm" onClick={onReopenTicket} className="gap-1.5">
              <MessageCircle className="h-4 w-4" />
              Reabrir Chamado
            </Button>
          )}
        </div>
      ) : (
        <ChatInput
          onSend={onSend}
          onSendMedia={onSendMedia}
          onSendLocation={onSendLocation}
          onSendContact={onSendContact}
          onPickFromObligation={onPickFromObligation}
        />
      )}
    </div>
  );
}
