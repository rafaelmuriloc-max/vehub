import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex items-end gap-2 p-3 bg-[#F0F0F0] dark:bg-zinc-800 border-t">
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
  );
}
