import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Phone } from 'lucide-react';

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isMine: boolean;
  isRead: boolean;
  senderName?: string;
  isGroup?: boolean;
  messageType?: string;
}

export function MessageBubble({ content, timestamp, isMine, isRead, senderName, isGroup, messageType }: MessageBubbleProps) {
  const isWhatsApp = messageType === 'whatsapp' || messageType === 'whatsapp_incoming';
  const isIncoming = messageType === 'whatsapp_incoming';

  return (
    <div className={`flex ${isMine && !isIncoming ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`relative max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm ${
          isMine && !isIncoming
            ? 'bg-[#DCF8C6] dark:bg-emerald-800 text-foreground rounded-tr-none'
            : 'bg-white dark:bg-zinc-700 text-foreground rounded-tl-none'
        }`}
      >
        {isMine && !isIncoming && senderName && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">{senderName}</p>
        )}
        {isGroup && !isMine && !isIncoming && senderName && (
          <p className="text-xs font-semibold text-primary mb-0.5">{senderName}</p>
        )}
        {isWhatsApp && !isIncoming && (
          <div className="flex items-center gap-1 mb-0.5">
            <Phone className="h-3 w-3 text-green-600 fill-green-600" />
            <span className="text-[10px] font-medium text-green-600">WhatsApp</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <div className={`flex items-center gap-1 justify-end mt-0.5 ${isMine ? '-mr-1' : ''}`}>
          <span className="text-[10px] text-muted-foreground leading-none">
            {format(new Date(timestamp), 'HH:mm', { locale: ptBR })}
          </span>
          {isMine && (
            isRead
              ? <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
              : <Check className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
