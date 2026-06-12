import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, RefreshCw, Wallet } from 'lucide-react';

type BA = { id: string; name: string; bank_name: string | null; agency: string | null; account_number: string | null; account_type: string; initial_balance: number; current_balance: number; color: string | null; active: boolean; is_asaas: boolean };

export function BankAccountsTab() {
  const [accounts, setAccounts] = useState<BA[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BA | null>(null);
  const [form, setForm] = useState<any>({});
  const [syncing, setSyncing] = useState(false);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('bank_accounts').select('*').order('name');
    setAccounts(data || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', bank_name: '', agency: '', account_number: '', account_type: 'checking', initial_balance: 0, color: '#0F172A', active: true, is_asaas: false });
    setOpen(true);
  }
  function openEdit(a: BA) { setEditing(a); setForm({ ...a }); setOpen(true); }

  async function save() {
    const payload = { ...form, initial_balance: Number(form.initial_balance) || 0, current_balance: editing ? form.current_balance : (Number(form.initial_balance) || 0) };
    const { error } = editing
      ? await supabase.from('bank_accounts').update(payload).eq('id', editing.id)
      : await supabase.from('bank_accounts').insert(payload);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setOpen(false); load(); toast({ title: 'Conta salva' }); }
  }

  async function syncAsaas() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('asaas-balance-sync');
    setSyncing(false);
    if (error || !data?.ok) toast({ title: 'Erro', description: error?.message || data?.error || 'Falha', variant: 'destructive' });
    else { toast({ title: `Saldo Asaas: R$ ${Number(data.balance).toFixed(2)}` }); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Contas Bancárias</h3>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map(a => (
          <Card key={a.id} style={{ borderLeftColor: a.color || '#0F172A', borderLeftWidth: 4 }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4" />{a.name}</span>
                {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{a.bank_name} {a.agency && `· Ag ${a.agency}`} {a.account_number && `· CC ${a.account_number}`}</p>
              <p className="text-2xl font-bold mt-2">R$ {Number(a.current_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              {a.is_asaas && (
                <Button variant="outline" size="sm" className="mt-2" onClick={syncAsaas} disabled={syncing}>
                  <RefreshCw className={`h-3 w-3 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sincronizar Asaas
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Nenhuma conta cadastrada</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Conta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Banco</Label><Input value={form.bank_name || ''} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v, is_asaas: v === 'asaas' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="cash">Caixa</SelectItem>
                    <SelectItem value="asaas">Asaas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agência</Label><Input value={form.agency || ''} onChange={e => setForm({ ...form, agency: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.account_number || ''} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Saldo inicial</Label><Input type="number" step="0.01" value={form.initial_balance ?? 0} onChange={e => setForm({ ...form, initial_balance: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" value={form.color || '#0F172A'} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active ?? true} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
            <Button onClick={save} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}