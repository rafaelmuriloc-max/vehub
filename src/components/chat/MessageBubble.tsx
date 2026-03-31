import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Phone, FileDown } from 'lucide-react';

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isMine: boolean;
  isRead: boolean;
  senderName?: string;
  isGroup?: boolean;
  messageType?: string;
  mediaUrl?: string;
}

export function MessageBubble({ content, timestamp, isMine, isRead, senderName, isGroup, messageType, mediaUrl }: MessageBubbleProps) {
  const isWhatsApp = messageType?.startsWith('whatsapp');
  const isIncoming = messageType === 'whatsapp_incoming' || messageType === 'whatsapp_image' || messageType === 'whatsapp_video' || messageType === 'whatsapp_audio' || messageType === 'whatsapp_document';

  const renderMedia = () => {
    if (!mediaUrl) return null;

    switch (messageType) {
      case 'whatsapp_image':
        return (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
            <img
              src={mediaUrl}
              alt="Imagem"
              className="max-w-full rounded-md max-h-64 object-cover cursor-pointer"
              loading="lazy"
            />
          </a>
        );
      case 'whatsapp_video':
        return (
          <video
            src={mediaUrl}
            controls
            className="max-w-full rounded-md max-h-64 mb-1"
            preload="metadata"
          />
        );
      case 'whatsapp_audio':
        return (
          <audio
            src={mediaUrl}
            controls
            className="w-full min-w-[200px] mb-1"
            preload="metadata"
          />
        );
      case 'whatsapp_document':
        return (
          <button
            onClick={async () => {
              try {
                const res = await fetch(mediaUrl);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = content || 'documento';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                window.open(mediaUrl, '_blank');
              }
            }}
            className="flex items-center gap-2 p-2 mb-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors cursor-pointer w-full text-left"
          >
            <FileDown className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm text-primary truncate">
              {content || 'Documento'}
            </span>
          </button>
        );
      default:
        return null;
    }
  };

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
        {renderMedia()}
        {/* Show text content - skip for documents if already shown in the link */}
        {content && messageType !== 'whatsapp_document' && (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
        {/* For audio with no text, don't show empty paragraph */}
        {!content && !mediaUrl && (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
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
