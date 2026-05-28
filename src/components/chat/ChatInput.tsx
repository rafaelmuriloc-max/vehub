import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { Send, Plus, Image, Video, FileText, MapPin, Contact, Mic, X, Check, FolderOpen, Smile, Reply, HardDrive } from 'lucide-react';
import { DrivePickerDialog } from '@/components/drive/DrivePickerDialog';
import { downloadDriveFile } from '@/components/drive/DriveBrowser';
import EmojiPicker, { EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendMedia?: (file: File, type: 'image' | 'video' | 'document' | 'audio') => void;
  onSendLocation?: (lat: number, lng: number, name?: string) => void;
  onSendContact?: (name: string, phone: string) => void;
  onPickFromObligation?: () => void;
  disabled?: boolean;
  pendingFiles?: File[];
  onAddPendingFiles?: (files: File[]) => void;
  onRemovePendingFile?: (index: number) => void;
  onClearPendingFiles?: () => void;
  replyingTo?: {
    id: string;
    sender_name?: string;
    content?: string;
    message_type?: string;
    media_url?: string | null;
    isMine?: boolean;
  } | null;
  onCancelReply?: () => void;
  keyboardOpen?: boolean;
}

export function ChatInput({ onSend, onSendMedia, onSendLocation, onSendContact, onPickFromObligation, disabled, pendingFiles = [], onAddPendingFiles, onRemovePendingFile, onClearPendingFiles, replyingTo, onCancelReply, keyboardOpen = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const { bumpActivity } = useOnlineUsers();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const detectFileType = (file: File): 'image' | 'video' | 'document' | 'audio' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    if (pendingFiles.length > 0 && onSendMedia) {
      pendingFiles.forEach((f) => onSendMedia(f, detectFileType(f)));
      onClearPendingFiles?.();
    }
    if (trimmed) onSend(trimmed);
    bumpActivity();
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !onAddPendingFiles) return;
    const images: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        if (blob) {
          const ext = (it.type.split('/')[1] || 'png').split('+')[0];
          const file = new File([blob], `pasted_${Date.now()}_${i}.${ext}`, { type: it.type });
          images.push(file);
        }
      }
    }
    if (images.length > 0) {
      e.preventDefault();
      onAddPendingFiles(images);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onAddPendingFiles?.(files);
    e.target.value = '';
  };

  const handleLocationClick = () => {
    setPopoverOpen(false);
    if (!navigator.geolocation) {
      toast({ title: 'Geolocalização não suportada', description: 'Seu navegador não suporta geolocalização.', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSendLocation?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        toast({ title: 'Erro ao obter localização', description: 'Permita o acesso à localização.', variant: 'destructive' });
      }
    );
  };

  const handleContactSubmit = () => {
    if (!contactName.trim() || !contactPhone.trim()) return;
    onSendContact?.(contactName.trim(), contactPhone.trim());
    setContactName('');
    setContactPhone('');
    setContactDialogOpen(false);
  };

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);
        if (cancelledRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const ext = mime.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mime });
        onSendMedia?.(file, 'audio');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast({ title: 'Microfone bloqueado', description: 'Permita o acesso ao microfone.', variant: 'destructive' });
    }
  };

  const stopRecording = (cancel: boolean) => {
    cancelledRef.current = cancel;
    mediaRecorderRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const insertEmoji = (data: EmojiClickData) => {
    const emoji = data.emoji;
    const ta = inputRef.current;
    if (!ta) {
      setMessage((m) => m + emoji);
      return;
    }
    const start = ta.selectionStart ?? message.length;
    const end = ta.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 128) + 'px';
    });
  };

  const attachOptions = [
    { icon: Image, label: 'Imagem', onClick: () => { setPopoverOpen(false); imageInputRef.current?.click(); } },
    { icon: Video, label: 'Vídeo', onClick: () => { setPopoverOpen(false); videoInputRef.current?.click(); } },
    { icon: Mic, label: 'Áudio', onClick: () => { setPopoverOpen(false); audioInputRef.current?.click(); } },
    { icon: FileText, label: 'Arquivo', onClick: () => { setPopoverOpen(false); fileInputRef.current?.click(); } },
    { icon: HardDrive, label: 'Google Drive', onClick: () => { setPopoverOpen(false); setDrivePickerOpen(true); } },
    ...(onPickFromObligation ? [{ icon: FolderOpen, label: 'Anexar do sistema', onClick: () => { setPopoverOpen(false); onPickFromObligation(); } }] : []),
    { icon: MapPin, label: 'Localização', onClick: handleLocationClick },
    { icon: Contact, label: 'Contato', onClick: () => { setPopoverOpen(false); setContactDialogOpen(true); } },
  ];

  return (
    <>
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={audioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={fileInputRef} type="file" accept="*" multiple className="hidden" onChange={handleFileSelect} />

      <div className="flex flex-col bg-[#F0F0F0] dark:bg-zinc-800 border-t">
        {replyingTo && (
          <div className="flex items-stretch gap-2 px-3 pt-2">
            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-700 rounded-md pl-2 pr-2 py-1.5 border-l-4 border-emerald-500 shadow-sm overflow-hidden">
              <Reply className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                  {replyingTo.isMine ? 'Você' : (replyingTo.sender_name || 'Contato')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(() => {
                    const t = replyingTo.message_type || '';
                    if (t.includes('image')) return '📷 Foto' + (replyingTo.content ? `: ${replyingTo.content}` : '');
                    if (t.includes('video')) return '🎥 Vídeo';
                    if (t.includes('audio')) return '🎤 Áudio';
                    if (t.includes('document')) return `📄 ${replyingTo.content || 'Documento'}`;
                    if (t.includes('location')) return '📍 Localização';
                    if (t.includes('contact')) return '👤 Contato';
                    return replyingTo.content || '';
                  })()}
                </p>
              </div>
              {replyingTo.media_url && replyingTo.message_type?.includes('image') && (
                <img src={replyingTo.media_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
              )}
              <button
                type="button"
                onClick={onCancelReply}
                className="p-1 rounded hover:bg-black/10 shrink-0"
                aria-label="Cancelar resposta"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2">
            {pendingFiles.map((f, idx) => {
              const isImage = f.type.startsWith('image/');
              return (
                <div key={idx} className="relative flex items-center gap-2 bg-white dark:bg-zinc-700 rounded-md px-2 py-1.5 pr-7 text-xs max-w-[220px] shadow-sm">
                  {isImage ? (
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePendingFile?.(idx)}
                    className="absolute top-1 right-1 rounded-full p-0.5 hover:bg-black/10"
                    aria-label="Remover anexo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className={`flex items-end gap-2 p-1.5 md:p-2 ${keyboardOpen ? 'pb-2' : 'pb-[calc(env(safe-area-inset-bottom,0px)+16px)]'}`}>
        {recording ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => stopRecording(true)}
              className="rounded-full h-10 w-10 shrink-0 text-destructive"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-700 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="font-mono">{fmtTime(recordSeconds)}</span>
              <span className="text-muted-foreground">Gravando…</span>
            </div>
            <Button
              size="icon"
              onClick={() => stopRecording(false)}
              className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90 shrink-0"
            >
              <Check className="h-4 w-4" />
            </Button>
          </>
        ) : (
        <>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled}
              className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-2">
            <div className="flex flex-col gap-1">
              {attachOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={opt.onClick}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-orange-300 focus:bg-orange-300 active:bg-orange-300 focus:outline-none text-sm transition-colors text-left bg-inherit"
                >
                  <opt.icon className="h-4 w-4 text-primary" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled}
              className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
            <EmojiPicker
              onEmojiClick={insertEmoji}
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis
              searchPlaceHolder="Buscar emoji..."
              width={320}
              height={380}
            />
          </PopoverContent>
        </Popover>

        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Digite uma mensagem"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border-0 bg-white dark:bg-zinc-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary max-h-32 min-h-[40px]"
          style={{ height: 'auto', overflow: 'hidden' }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 128) + 'px';
          }}
        />
        {message.trim() || pendingFiles.length > 0 ? (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={disabled}
            className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={startRecording}
            disabled={disabled}
            className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90 shrink-0"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
        </>
        )}
        </div>
      </div>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartilhar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do contato" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+55 11 99999-9999" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleContactSubmit} disabled={!contactName.trim() || !contactPhone.trim()}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DrivePickerDialog
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        multiple
        onPick={async (picked) => {
          for (const df of picked) {
            try {
              const { blob, mimeType } = await downloadDriveFile(df.id);
              const file = new File([blob], df.name, { type: df.mimeType || mimeType });
              onAddPendingFiles?.([file]);
            } catch (e: any) {
              toast({ title: 'Erro ao baixar do Drive', description: `${df.name}: ${e.message}`, variant: 'destructive' });
            }
          }
        }}
      />
    </>
  );
}
