import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle } from 'lucide-react';
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
  isGroup?: boolean;
  avatarUrl?: string;
  companyNames?: string[];
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function MessageArea({ conversationName, messages, currentUserId, onSend, isGroup, avatarUrl, companyNames }: MessageAreaProps) {
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
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#F0F2F5] dark:bg-zinc-800 border-b">
        <Avatar className="h-10 w-10">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={conversationName || ''} />}
          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
            {conversationName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{conversationName}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23ccc\' opacity=\'0.15\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'%23ECE5DD\' width=\'200\' height=\'200\'/%3E%3Crect fill=\'url(%23p)\' width=\'200\' height=\'200\'/%3E%3C/svg%3E")', backgroundColor: '#ECE5DD' }}
      >
        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="bg-white/80 dark:bg-zinc-700/80 text-xs text-muted-foreground px-3 py-1 rounded-lg shadow-sm">
                {group.label}
              </span>
            </div>
            {group.msgs.map(msg => (
              <MessageBubble
                key={msg.id}
                content={msg.content}
                timestamp={msg.created_at}
                isMine={msg.sender_id === currentUserId}
                isRead={!!msg.read_at}
                senderName={msg.sender_name}
                isGroup={isGroup}
                messageType={msg.message_type}
                mediaUrl={msg.media_url}
              />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} />
    </div>
  );
}
