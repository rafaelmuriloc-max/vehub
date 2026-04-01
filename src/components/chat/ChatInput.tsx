import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Plus, Image, Video, FileText, MapPin, Contact } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendMedia?: (file: File, type: 'image' | 'video' | 'document') => void;
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
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

  const attachOptions = [
    { icon: Image, label: 'Imagem', onClick: () => { setPopoverOpen(false); imageInputRef.current?.click(); } },
    { icon: Video, label: 'Vídeo', onClick: () => { setPopoverOpen(false); videoInputRef.current?.click(); } },
    { icon: FileText, label: 'Arquivo', onClick: () => { setPopoverOpen(false); fileInputRef.current?.click(); } },
    { icon: MapPin, label: 'Localização', onClick: handleLocationClick },
    { icon: Contact, label: 'Contato', onClick: () => { setPopoverOpen(false); setContactDialogOpen(true); } },
  ];

  return (
    <>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
      <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />

      <div className="flex items-end gap-2 p-3 bg-[#F0F0F0] dark:bg-zinc-800 border-t">
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
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
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
