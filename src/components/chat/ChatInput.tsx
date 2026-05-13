import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Plus, Image, Video, FileText, MapPin, Contact, Mic, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendMedia?: (file: File, type: 'image' | 'video' | 'document' | 'audio') => void;
  onSendLocation?: (lat: number, lng: number, name?: string) => void;
  onSendContact?: (name: string, phone: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onSendMedia, onSendLocation, onSendContact, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
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

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;
    onSendMedia?.(file, type);
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

  const attachOptions = [
    { icon: Image, label: 'Imagem', onClick: () => { setPopoverOpen(false); imageInputRef.current?.click(); } },
    { icon: Video, label: 'Vídeo', onClick: () => { setPopoverOpen(false); videoInputRef.current?.click(); } },
    { icon: Mic, label: 'Áudio', onClick: () => { setPopoverOpen(false); audioInputRef.current?.click(); } },
    { icon: FileText, label: 'Arquivo', onClick: () => { setPopoverOpen(false); fileInputRef.current?.click(); } },
    { icon: MapPin, label: 'Localização', onClick: handleLocationClick },
    { icon: Contact, label: 'Contato', onClick: () => { setPopoverOpen(false); setContactDialogOpen(true); } },
  ];

  return (
    <>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />
      <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />

      <div className="flex items-end gap-2 p-1.5 md:p-2 bg-[#F0F0F0] dark:bg-zinc-800 border-t pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
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
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors text-left"
                >
                  <opt.icon className="h-4 w-4 text-primary" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
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
        {message.trim() ? (
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
    </>
  );
}
