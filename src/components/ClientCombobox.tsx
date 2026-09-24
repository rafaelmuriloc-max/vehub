import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatClientLabel } from '@/lib/utils';

interface ClientLike {
  id: string;
  company_name: string;
  sci_code?: string | null;
  document?: string | null;
}

interface Props {
  clients: ClientLike[];
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  showDocument?: boolean;
}

export function ClientCombobox({ clients, value, onChange, allowAll, allLabel = 'Todas as empresas', placeholder = 'Selecione a empresa...', showDocument }: Props) {
  const [open, setOpen] = useState(false);
  const label = (c: ClientLike) => formatClientLabel(c as any) + (showDocument && c.document ? ` — ${c.document}` : '');
  const selected = clients.find(c => c.id === value);
  const text = selected ? label(selected) : allowAll && value === 'all' ? allLabel : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn('truncate', !text && 'text-muted-foreground')}>{text || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite nome, código ou CNPJ..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem value={`__all__ ${allLabel}`} onSelect={() => { onChange('all'); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === 'all' ? 'opacity-100' : 'opacity-0')} />
                  {allLabel}
                </CommandItem>
              )}
              {clients.map(c => (
                <CommandItem
                  key={c.id}
                  value={`${label(c)} ${c.document || ''} ${(c.document || '').replace(/\D/g, '')} ${c.id}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{label(c)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
