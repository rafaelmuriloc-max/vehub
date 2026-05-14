import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RegisterContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  initialName?: string | null;
  initialPhone?: string | null;
  onSaved?: () => void;
}

interface ClientOpt { id: string; company_name: string }
interface DeptOpt { id: string; name: string }

const normalize = (p?: string | null) => (p || '').replace(/\D/g, '');

export function RegisterContactDialog({ open, onOpenChange, conversationId, initialName, initialPhone, onSaved }: RegisterContactDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [departments, setDepartments] = useState<DeptOpt[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setPhone(initialPhone || '');
    setEmail('');
    setClientId(null);
    setDepartmentIds([]);
    (async () => {
      const [cRes, dRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      setClients((cRes.data as ClientOpt[]) || []);
      setDepartments((dRes.data as DeptOpt[]) || []);
    })();
  }, [open, initialName, initialPhone]);

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
  const selectedDeptsLabel = useMemo(() => {
    if (departmentIds.length === 0) return '';
    return departments.filter(d => departmentIds.includes(d.id)).map(d => d.name).join(', ');
  }, [departments, departmentIds]);

  const save = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    if (!phone.trim()) { toast.error('Informe o telefone'); return; }
    if (!clientId) { toast.error('Selecione uma empresa'); return; }
    setSaving(true);
    try {
      if (departmentIds.length > 0) {
        const phoneNorm = normalize(phone);
        for (const depId of departmentIds) {
          const { data: existing } = await supabase
            .from('client_department_contacts')
            .select('id, contact_phone')
            .eq('client_id', clientId)
            .eq('department_id', depId);
          const dup = (existing || []).some((r: any) => normalize(r.contact_phone) === phoneNorm);
          if (dup) continue;
          const { error } = await supabase.from('client_department_contacts').insert({
            client_id: clientId,
            department_id: depId,
            contact_name: name.trim(),
            contact_phone: phone.trim(),
            contact_email: email.trim() || null,
          } as any);
          if (error) throw error;
        }
      } else {
        // Sem departamento: atualiza dados do cliente se ainda estiverem vazios
        const { data: client } = await supabase
          .from('clients')
          .select('contact_name, contact_phone, contact_email')
          .eq('id', clientId)
          .maybeSingle();
        const updates: Record<string, string> = {};
        if (!client?.contact_name) updates.contact_name = name.trim();
        if (!client?.contact_phone) updates.contact_phone = phone.trim();
        if (!client?.contact_email && email.trim()) updates.contact_email = email.trim();
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('clients').update(updates).eq('id', clientId);
          if (error) throw error;
        } else {
          toast.message('Cliente já possui contato cadastrado. Selecione um departamento para adicionar outro contato.');
        }
      }

      // Vincula a conversa ao cliente e fixa o nome
      if (conversationId) {
        await supabase
          .from('chat_conversations')
          .update({ client_id: clientId, name: name.trim(), name_locked: true } as any)
          .eq('id', conversationId);
      }

      toast.success('Contato cadastrado');
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar contato</DialogTitle>
          <DialogDescription>Vincule este contato a uma empresa e, opcionalmente, a um ou mais departamentos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do contato" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="55DDDNNNNNNNNN" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opcional" />
          </div>

          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className={cn('truncate', !selectedClient && 'text-muted-foreground')}>
                    {selectedClient?.company_name || 'Selecione a empresa...'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar empresa..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                    <CommandGroup>
                      {clients.map(c => (
                        <CommandItem
                          key={c.id}
                          value={c.company_name}
                          onSelect={() => { setClientId(c.id); setClientOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                          {c.company_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Departamentos (opcional)</Label>
            <Popover open={deptOpen} onOpenChange={setDeptOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className={cn('truncate text-left', departmentIds.length === 0 && 'text-muted-foreground')}>
                    {selectedDeptsLabel || 'Selecione os departamentos...'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar departamento..." />
                  <CommandList>
                    <CommandEmpty>Nenhum departamento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {departments.map(d => {
                        const checked = departmentIds.includes(d.id);
                        return (
                          <CommandItem
                            key={d.id}
                            value={d.name}
                            onSelect={() => {
                              setDepartmentIds(prev =>
                                prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]
                              );
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                            {d.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}