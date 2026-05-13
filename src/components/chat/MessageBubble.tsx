import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { CheckCheck, MapPin, Contact } from 'lucide-react';
import { AudioMessage } from './AudioMessage';

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isMine: boolean;
  isRead: boolean;
  senderName?: string;
  isGroup?: boolean;
  messageType?: string;
  mediaUrl?: string;
  avatarUrl?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : i === 1 ? 0 : 1)} ${sizes[i]}`;
}

function extColor(ext: string): string {
  switch (ext) {
    case 'pdf': return 'bg-red-500';
    case 'doc':
    case 'docx': return 'bg-blue-500';
    case 'xls':
    case 'xlsx':
    case 'csv': return 'bg-emerald-600';
    case 'ppt':
    case 'pptx': return 'bg-orange-500';
    case 'zip':
    case 'rar': return 'bg-amber-600';
    default: return 'bg-zinc-500';
  }
}

function DocumentMessage({ mediaUrl, fileName }: { mediaUrl: string; fileName: string }) {
  const [size, setSize] = useState<number | null>(null);
  const ext = (fileName.split('.').pop() || 'file').toLowerCase();
  const displayExt = ext.length > 4 ? 'file' : ext;

  useEffect(() => {
    let cancelled = false;
    fetch(mediaUrl, { method: 'HEAD' })
      .then((r) => {
        const len = r.headers.get('content-length');
        if (!cancelled && len) setSize(parseInt(len, 10));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mediaUrl]);

  const handleClick = async () => {
    try {
      const res = await fetch(mediaUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(mediaUrl, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 py-1 pr-2 w-full text-left min-w-[220px] sm:min-w-[260px]"
    >
      <div className={`h-11 w-11 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${extColor(ext)}`}>
        {displayExt.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight line-clamp-2 break-words">
          {fileName || 'Documento'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {size ? `${formatBytes(size)} · ${displayExt}` : displayExt}
        </p>
      </div>
    </button>
  );
}

export function MessageBubble({ content, timestamp, isMine, isRead, senderName, isGroup, messageType, mediaUrl, avatarUrl }: MessageBubbleProps) {
  const isWhatsApp = messageType?.startsWith('whatsapp');
  const isIncoming = messageType === 'whatsapp_incoming';
  const isOutgoing = messageType === 'whatsapp_outgoing' || messageType === 'whatsapp';
  const showOnRight = isOutgoing || (isMine && !isIncoming);

  const renderMedia = () => {
    if (messageType === 'whatsapp_location') {
      // Parse lat/lng from content like "lat,lng" or from mediaUrl
      let lat = 0, lng = 0;
      try {
        const parts = content.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          lat = parts[0];
          lng = parts[1];
        }
      } catch {}
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      return (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 mb-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
          <MapPin className="h-5 w-5 text-red-500 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-primary">Localização</p>
            <p className="text-[11px] text-muted-foreground">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
          </div>
        </a>
      );
    }

    if (messageType === 'whatsapp_contact') {
      // Parse contact from content like "Nome|Telefone"
      const parts = content.split('|');
      const cName = parts[0] || 'Contato';
      const cPhone = parts[1] || '';
      return (
        <div className="flex items-center gap-2 p-2 mb-1 rounded-md bg-black/5 dark:bg-white/10">
          <Contact className="h-5 w-5 text-primary shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{cName}</p>
            {cPhone && <p className="text-[11px] text-muted-foreground">{cPhone}</p>}
          </div>
        </div>
      );
    }

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
          <AudioMessage
            mediaUrl={mediaUrl}
            avatarUrl={avatarUrl}
            tint={showOnRight ? 'green' : 'white'}
          />
        );
      case 'whatsapp_document':
        return <DocumentMessage mediaUrl={mediaUrl} fileName={content || 'Documento'} />;
      default:
        return null;
    }
  };

  // Don't show text for location/contact types (content is structured data)
  const hideTextContent = messageType === 'whatsapp_location' || messageType === 'whatsapp_contact' || messageType === 'whatsapp_audio';

  return (
    <div className={`flex ${showOnRight ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`relative max-w-[80%] sm:max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm ${
          showOnRight
            ? 'bg-[#DCF8C6] dark:bg-emerald-800 text-foreground rounded-tr-none'
            : 'bg-white dark:bg-zinc-700 text-foreground rounded-tl-none'
        }`}
      >
        {senderName && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">{senderName}</p>
        )}
        {renderMedia()}
        {/* Show text content - skip for documents/location/contact */}
        {content && !hideTextContent && messageType !== 'whatsapp_document' && (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
        {/* For audio with no text, don't show empty paragraph */}
        {!content && !mediaUrl && !hideTextContent && (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
        <div className={`flex items-center gap-1 justify-end mt-0.5 ${isMine ? '-mr-1' : ''}`}>
          <span className="text-[10px] text-muted-foreground leading-none">
            {format(new Date(timestamp), 'HH:mm', { locale: ptBR })}
          </span>
          {isMine && (
            <CheckCheck className={`h-3.5 w-3.5 ${isRead ? 'text-blue-500' : 'text-muted-foreground'}`} />
          )}
        </div>
      </div>
    </div>
  );
}
