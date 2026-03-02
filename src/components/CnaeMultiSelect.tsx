import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCnaeData } from '@/hooks/useCnaeData';

interface CnaeMultiSelectProps {
  value: string; // comma-separated labels
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CnaeMultiSelect({ value, onChange, placeholder = 'Adicionar CNAEs...' }: CnaeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data, loading } = useCnaeData();

  const selected = value ? value.split(', ').filter(Boolean) : [];

  function toggle(label: string) {
    const newSelected = selected.includes(label)
      ? selected.filter(s => s !== label)
      : [...selected, label];
    onChange(newSelected.join(', '));
  }

  function remove(label: string) {
    onChange(selected.filter(s => s !== label).join(', '));
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(label => (
            <Badge key={label} variant="secondary" className="text-xs gap-1">
              <span className="truncate max-w-[250px]">{label}</span>
              <button type="button" onClick={() => remove(label)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">{placeholder}</span>
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
                        onSelect={() => toggle(item.label)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', selected.includes(item.label) ? 'opacity-100' : 'opacity-0')} />
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
    </div>
  );
}
