import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MessageCircle, CheckCircle2, UserRoundPlus, Phone, ArrowLeft, MoreVertical, Trash2, Pencil, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Upload } from 'lucide-react';
import { ForwardMessageDialog, type ForwardMessageData } from './ForwardMessageDialog';

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
  sender_name?: string;
  message_type?: string;
  media_url?: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_id?: string | null;
  reply_to_snapshot?: {
    sender_id?: string | null;
    sender_name?: string | null;
    content?: string | null;
    message_type?: string | null;
    media_url?: string | null;
  } | null;
  transcription?: string | null;
  transcription_status?: string | null;
}

interface MessageAreaProps {
  conversationName: string | null;
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (message: string, replyToId?: string | null) => void;
  onSendMedia?: (file: File, type: 'image' | 'video' | 'document' | 'audio', replyToId?: string | null) => void;
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
  isAdmin?: boolean;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessageForMe?: (id: string) => void;
  onDeleteMessageForAll?: (id: string) => void;
  onDeleteConversation?: () => void;
  onRenameConversation?: (newName: string) => void;
  onRegisterContact?: () => void;
  conversationId?: string | null;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function MessageArea({ conversationName, messages, currentUserId, onSend, onSendMedia, onSendLocation, onSendContact, onPickFromObligation, isGroup, avatarUrl, currentUserName, companyNames, isClosed, onCloseTicket, onReopenTicket, onTransferTicket, whatsappPhone, onBack, isAdmin, onEditMessage, onDeleteMessageForMe, onDeleteMessageForAll, onDeleteConversation, onRenameConversation, onRegisterContact }: MessageAreaProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const dragCounterRef = useRef(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<ForwardMessageData | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const jumpToMessage = (id: string) => {
    const el = bubbleRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1500);
  };

  // Clear reply state when switching conversations
  useEffect(() => { setReplyingTo(null); }, [conversationName]);

  const dropEnabled = !!conversationName && !isClosed && !!onSendMedia;

  const handleDragEnter = (e: React.DragEvent) => {
    if (!dropEnabled) return;
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!dropEnabled) return;
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropEnabled) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!dropEnabled) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
  };

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
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary pointer-events-none">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg px-6 py-4 flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">Solte o arquivo para enviar</span>
          </div>
        </div>
      )}
      {/* Header */}
       <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 border-b shrink-0 bg-white">
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
            {onRenameConversation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                title="Renomear contato"
                onClick={() => { setRenameValue(conversationName || ''); setRenameOpen(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
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
        {whatsappPhone && onRegisterContact && (
          <Button variant="outline" size="icon" onClick={onRegisterContact} className="shrink-0 h-8 w-8 md:h-auto md:w-auto md:px-3 md:gap-1.5" title="Cadastrar contato">
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline text-sm">Cadastrar contato</span>
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
        {isAdmin && onDeleteConversation && (
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir conversa
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é permanente. Todas as mensagens, mídias e participantes serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
               const isWhatsAppOutgoing = !isIncoming && (msg.message_type === 'whatsapp' || msg.message_type?.startsWith('whatsapp_'));
               const showOnRight = isWhatsAppOutgoing || (!isIncoming && msg.sender_id === currentUserId);
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
                  editedAt={msg.edited_at}
                  deletedAt={msg.deleted_at}
                  isAdmin={isAdmin}
                  onEdit={onEditMessage ? (text) => onEditMessage(msg.id, text) : undefined}
                  onDeleteForMe={onDeleteMessageForMe ? () => onDeleteMessageForMe(msg.id) : undefined}
                  onDeleteForAll={onDeleteMessageForAll ? () => onDeleteMessageForAll(msg.id) : undefined}
                  onReply={() => setReplyingTo(msg)}
                  onForward={() => setForwardingMsg({ id: msg.id, content: msg.content, message_type: msg.message_type, media_url: msg.media_url || null })}
                  replySnapshot={msg.reply_to_snapshot || undefined}
                  replyToId={msg.reply_to_id || undefined}
                  onJumpToReply={jumpToMessage}
                  transcription={msg.transcription || undefined}
                  transcriptionStatus={msg.transcription_status || undefined}
                  messageId={msg.id}
                  bubbleRef={(el) => {
                    if (el) bubbleRefs.current.set(msg.id, el);
                    else bubbleRefs.current.delete(msg.id);
                  }}
                  highlight={highlightId === msg.id}
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
          onSend={(text) => { onSend(text, replyingTo?.id || null); setReplyingTo(null); }}
          onSendMedia={onSendMedia ? (file, type) => { onSendMedia(file, type, replyingTo?.id || null); setReplyingTo(null); } : undefined}
          onSendLocation={onSendLocation}
          onSendContact={onSendContact}
          onPickFromObligation={onPickFromObligation}
          pendingFiles={pendingFiles}
          onAddPendingFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
          onRemovePendingFile={(idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
          onClearPendingFiles={() => setPendingFiles([])}
          replyingTo={replyingTo ? {
            id: replyingTo.id,
            sender_name: replyingTo.sender_name,
            content: replyingTo.content,
            message_type: replyingTo.message_type,
            media_url: replyingTo.media_url,
            isMine: replyingTo.sender_id === currentUserId,
          } : null}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear contato</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Nome do contato"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                onRenameConversation?.(renameValue.trim());
                setRenameOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (renameValue.trim()) {
                  onRenameConversation?.(renameValue.trim());
                  setRenameOpen(false);
                }
              }}
              disabled={!renameValue.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
