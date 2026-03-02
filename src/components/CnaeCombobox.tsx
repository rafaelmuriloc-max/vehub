import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCnaeData } from '@/hooks/useCnaeData';

interface CnaeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CnaeCombobox({ value, onChange, placeholder = 'Selecione o CNAE...' }: CnaeComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data, loading } = useCnaeData();

  const selectedLabel = value
    ? data.find(item => item.label === value)?.label || value
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-auto min-h-10 text-left"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por código ou descrição..." />
          <CommandList className="max-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Carregando CNAEs...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum CNAE encontrado.</CommandEmpty>
                <CommandGroup>
                  {data.map(item => (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      onSelect={() => {
                        onChange(item.label === value ? '' : item.label);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === item.label ? 'opacity-100' : 'opacity-0')} />
                      <span className="text-sm">{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
