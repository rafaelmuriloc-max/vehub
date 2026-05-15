import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
 import { CheckCheck, MapPin, Contact, ArrowDownToLine, Ban, Pencil, Trash2, Check, X, Reply, Sparkles, Loader2, RefreshCw, Forward } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AudioMessage } from './AudioMessage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const LONG_PRESS_MS = 2000;

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
  editedAt?: string | null;
  deletedAt?: string | null;
  isForwarded?: boolean;
  isAdmin?: boolean;
  onEdit?: (newContent: string) => void;
  onDeleteForMe?: () => void;
  onDeleteForAll?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  replySnapshot?: {
    sender_id?: string | null;
    sender_name?: string | null;
    content?: string | null;
    message_type?: string | null;
    media_url?: string | null;
  } | null;
  replyToId?: string | null;
  onJumpToReply?: (id: string) => void;
  bubbleRef?: (el: HTMLDivElement | null) => void;
  highlight?: boolean;
  transcription?: string | null;
  transcriptionStatus?: string | null;
  messageId?: string;
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      // Fallback: tenta abrir o link direto
      window.open(mediaUrl, '_blank', 'noopener,noreferrer');
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

export function MessageBubble({ content, timestamp, isMine, isRead, senderName, isGroup, messageType, mediaUrl, avatarUrl, editedAt, deletedAt, isForwarded, isAdmin, onEdit, onDeleteForMe, onDeleteForAll, onReply, onForward, replySnapshot, replyToId, onJumpToReply, bubbleRef, highlight, transcription, transcriptionStatus, messageId }: MessageBubbleProps) {
  const isWhatsApp = messageType?.startsWith('whatsapp');
   const isIncoming = messageType === 'whatsapp_incoming' || (messageType?.startsWith('whatsapp_incoming_') ?? false);
   const isWhatsAppOutgoing = !isIncoming && (messageType === 'whatsapp' || messageType?.startsWith('whatsapp_'));
   const showOnRight = isWhatsAppOutgoing || (!isIncoming && isMine);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [retrying, setRetrying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const bubbleNodeRef = useRef<HTMLDivElement | null>(null);
  const [sheetPos, setSheetPos] = useState<{ top: number; placement: 'below' | 'above' } | null>(null);

  const setBubbleNode = (el: HTMLDivElement | null) => {
    bubbleNodeRef.current = el;
    if (typeof bubbleRef === 'function') bubbleRef(el);
  };

  // Lock body scroll & compute sheet position when mobile menu opens
  useEffect(() => {
    if (!isMobile || !menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const rect = bubbleNodeRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimated = 280;
      const placement: 'below' | 'above' = spaceBelow >= estimated || spaceBelow >= rect.top ? 'below' : 'above';
      setSheetPos({
        top: placement === 'below' ? rect.bottom + 8 : rect.top - 8,
        placement,
      });
    }
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile, menuOpen]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  const hasMenu = !!(onEdit || onDeleteForMe || onDeleteForAll || onReply || onForward);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = () => {
    if (!isMobile || !hasMenu) return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearLongPress();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (longPressFired.current) e.preventDefault();
  };

  const closeMobileMenu = () => setMenuOpen(false);
  const runAndClose = (fn?: () => void) => {
    if (fn) fn();
    setMenuOpen(false);
  };

  const retryTranscription = async () => {
    if (!messageId || retrying) return;
    setRetrying(true);
    try {
      await supabase.functions.invoke('whatsapp-transcribe-audio', { body: { message_id: messageId } });
    } finally {
      setRetrying(false);
    }
  };

  const isDeleted = !!deletedAt;
  const canEdit = isMine && !isDeleted && (messageType === 'text' || messageType === 'whatsapp_outgoing' || messageType === 'whatsapp')
    && (Date.now() - new Date(timestamp).getTime() < 15 * 60 * 1000);
  const canDeleteForAll = (isMine || !!isAdmin) && !isDeleted;

  // Normalize media kind to support both incoming (whatsapp_incoming_audio) and outgoing (whatsapp_audio)
  const mediaKind = messageType?.replace(/^whatsapp_(incoming_)?/, '');

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

    switch (mediaKind) {
      case 'image':
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
      case 'video':
        return (
          <video
            src={mediaUrl}
            controls
            className="max-w-full rounded-md max-h-64 mb-1"
            preload="metadata"
          />
        );
      case 'audio':
        return (
          <AudioMessage
            mediaUrl={mediaUrl}
            avatarUrl={avatarUrl}
            tint={showOnRight ? 'green' : 'white'}
          />
        );
      case 'document':
        return <DocumentMessage mediaUrl={mediaUrl} fileName={content || 'Documento'} />;
      default:
        return null;
    }
  };

  // Don't show text for location/contact types (content is structured data)
  const hideTextContent = messageType === 'whatsapp_location' || messageType === 'whatsapp_contact' || mediaKind === 'audio';

  if (isDeleted) {
    return (
       <div ref={bubbleRef} className={`flex ${showOnRight ? 'justify-end pr-[42px]' : 'justify-start pl-[42px]'} mb-1`}>
         <div className={`relative max-w-[80%] sm:max-w-[65%] px-[12px] py-1.5 rounded-lg shadow-sm italic text-muted-foreground bg-zinc-200 dark:bg-zinc-800 ${showOnRight ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
          <div className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            <span className="text-sm">Mensagem apagada</span>
          </div>
           <div className="flex items-center gap-1 justify-end mt-[4px]">
            <span className="text-[10px] leading-none">
              {format(new Date(timestamp), 'HH:mm', { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
     <div ref={bubbleRef} className={`${showOnRight ? 'flex items-center justify-end pr-[42px]' : 'flex justify-start pl-[42px]'} mb-1 transition-colors ${highlight ? 'bg-yellow-200/40 rounded-lg' : ''}`}>
       <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={handleContextMenu}
        style={isMobile ? { WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } : undefined}
        className={`group relative ${mediaKind === 'audio' ? 'w-[85%] sm:w-auto sm:max-w-[65%]' : 'max-w-[80%] sm:max-w-[65%]'} px-[12px] py-1.5 rounded-lg shadow-sm ${
          showOnRight
            ? 'bg-[#DCF8C6] dark:bg-emerald-800 text-foreground rounded-tr-none rounded-2xl'
            : 'bg-white dark:bg-zinc-800 text-foreground rounded-tl-none text-left my-[10px] rounded-2xl'
        }`}
      >
        {hasMenu && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
               <button className="absolute top-1 right-1 opacity-0 sm:group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10 z-10 hidden sm:block">
                <ArrowDownToLine className="lucide lucide-arrow-down-to-line h-3.5 w-3.5 text-muted-foreground mx-0 my-0 mr-0 px-0" />
               </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              {onReply && (
                <DropdownMenuItem onClick={onReply}>
                  <Reply className="h-4 w-4 mr-2" /> Responder
                </DropdownMenuItem>
              )}
              {onForward && !isDeleted && (
                <DropdownMenuItem onClick={onForward}>
                  <Forward className="h-4 w-4 mr-2" /> Encaminhar
                </DropdownMenuItem>
              )}
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={() => { setDraft(content); setEditing(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              {onDeleteForMe && (
                <DropdownMenuItem onClick={onDeleteForMe}>
                  <Trash2 className="h-4 w-4 mr-2" /> Apagar só para mim
                </DropdownMenuItem>
              )}
              {canDeleteForAll && onDeleteForAll && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDeleteForAll} className="text-destructive focus:text-destructive">
                    <Ban className="h-4 w-4 mr-2" /> Apagar para todos
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
         {senderName && (
           <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-[4px]">{senderName}</p>
        )}
        {isForwarded && (
          <div className="flex items-center gap-1 mb-[2px] text-muted-foreground italic text-xs">
            <Forward className="h-3 w-3 -scale-x-100" />
            <span>Encaminhada</span>
          </div>
        )}
        {replySnapshot && (
          <button
            type="button"
            onClick={() => replyToId && onJumpToReply?.(replyToId)}
            className={`flex items-stretch gap-2 mb-1 w-full text-left rounded-md overflow-hidden border-l-4 ${
              showOnRight ? 'border-emerald-600 bg-emerald-100/70 dark:bg-emerald-900/40' : 'border-emerald-500 bg-black/5 dark:bg-white/10'
            } hover:opacity-90 transition`}
          >
            <div className="flex-1 min-w-0 px-2 py-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                {replySnapshot.sender_name || 'Contato'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {(() => {
                  const t = replySnapshot.message_type || '';
                  if (t.includes('image')) return '📷 Foto' + (replySnapshot.content ? `: ${replySnapshot.content}` : '');
                  if (t.includes('video')) return '🎥 Vídeo';
                  if (t.includes('audio')) return '🎤 Áudio';
                  if (t.includes('document')) return `📄 ${replySnapshot.content || 'Documento'}`;
                  if (t.includes('location')) return '📍 Localização';
                  if (t.includes('contact')) return '👤 Contato';
                  return replySnapshot.content || '';
                })()}
              </p>
            </div>
            {replySnapshot.media_url && replySnapshot.message_type?.includes('image') && (
              <img src={replySnapshot.media_url} alt="" className="h-12 w-12 object-cover shrink-0" />
            )}
          </button>
        )}
        {renderMedia()}
        {mediaKind === 'audio' && (transcriptionStatus || transcription) && (
          <div className={`mt-1 mb-1 text-xs rounded-md px-2 py-1.5 ${showOnRight ? 'bg-emerald-100/70 dark:bg-emerald-900/40' : 'bg-black/5 dark:bg-white/10'}`}>
            {transcriptionStatus === 'processing' && (
              <div className="flex items-center gap-1.5 text-muted-foreground italic">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Transcrevendo áudio…</span>
              </div>
            )}
            {transcriptionStatus === 'done' && transcription && (
              <div className="flex items-start gap-1.5">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="whitespace-pre-wrap break-words leading-snug">{transcription}</p>
              </div>
            )}
            {transcriptionStatus === 'failed' && (
              <button
                type="button"
                onClick={retryTranscription}
                disabled={retrying}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                <span>Falha ao transcrever — tentar novamente</span>
              </button>
            )}
          </div>
        )}
        {/* Show text content - skip for documents/location/contact */}
         {editing ? (
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="text-sm bg-background"
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7 px-2" onClick={() => { onEdit?.(draft); setEditing(false); }}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          ) : content && !hideTextContent && mediaKind !== 'document' ? (
            <p className="text-sm whitespace-pre-wrap break-words text-left px-[10px] mx-0">
              {content}
            {editedAt && <span className="text-[10px] text-muted-foreground ml-1 italic">(editada)</span>}
          </p>
        ) : null}
        {/* For audio with no text, don't show empty paragraph */}
         {!content && !mediaUrl && !hideTextContent && !editing && (
           <p className="text-sm whitespace-pre-wrap break-words px-[12px]">{content}</p>
        )}
         <div className={`flex items-center gap-1 justify-end mt-[4px]`}>
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
