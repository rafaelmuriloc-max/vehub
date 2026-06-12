import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Play } from 'lucide-react';

export function RecurringEntriesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { load(); }, []);
  async function load() {
    const [r, c, cc, ba, cl] = await Promise.all([
      supabase.from('recurring_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('financial_categories').select('*'),
      supabase.from('cost_centers').select('*').eq('active', true),
      supabase.from('bank_accounts').select('*').eq('active', true),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ]);
    setItems(r.data || []); setCats(c.data || []); setCenters(cc.data || []); setAccounts(ba.data || []); setClients(cl.data || []);
  }
  function openNew() {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0];
    setForm({ description: '', amount: '', type: 'receivable', frequency: 'monthly', day_of_month: new Date().getDate(), start_date: today, next_run_date: today, active: true });
    setOpen(true);
  }
  function openEdit(r: any) { setEditing(r); setForm({ ...r }); setOpen(true); }
  async function save() {
    const payload = {
      description: form.description, amount: Number(form.amount), type: form.type,
      frequency: form.frequency, day_of_month: Number(form.day_of_month) || 1,
      start_date: form.start_date, end_date: form.end_date || null, next_run_date: form.next_run_date,
      category_id: form.category_id || null, cost_center_id: form.cost_center_id || null,
      client_id: form.client_id || null, bank_account_id: form.bank_account_id || null,
      active: form.active, created_by: user?.id,
    };
    const { error } = editing
      ? await supabase.from('recurring_entries').update(payload).eq('id', editing.id)
      : await supabase.from('recurring_entries').insert(payload);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setOpen(false); load(); toast({ title: 'Recorrência salva' }); }
  }
  async function remove(id: string) {
    if (!confirm('Excluir recorrência?')) return;
    await supabase.from('recurring_entries').delete().eq('id', id);
    load();
  }
  async function runNow() {
    const { data, error } = await supabase.functions.invoke('recurring-entries-runner');
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: `${data?.generated || 0} lançamentos gerados` }); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Lançamentos Recorrentes</h3>
        <div className="flex gap-2">
          {isAdmin && <Button variant="outline" onClick={runNow}><Play className="h-4 w-4 mr-2" />Executar agora</Button>}
          {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Recorrência</Button>}
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead>
            <TableHead>Periodicidade</TableHead><TableHead>Próxima</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {items.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.description}</TableCell>
                <TableCell>{r.type === 'receivable' ? 'Receber' : 'Pagar'}</TableCell>
                <TableCell>R$ {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{r.frequency === 'monthly' ? `Mensal (dia ${r.day_of_month})` : r.frequency === 'weekly' ? 'Semanal' : 'Anual'}</TableCell>
                <TableCell>{new Date(r.next_run_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell><Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell>{isAdmin && (<div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button><Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button></div>)}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma recorrência cadastrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Recorrência</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Descrição *</Label><Input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Tipo</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="receivable">A Receber</SelectItem><SelectItem value="payable">A Pagar</SelectItem></SelectContent></Select></div>
            <div><Label>Periodicidade</Label><Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></div>
            {form.frequency === 'monthly' && <div><Label>Dia do mês</Label><Input type="number" min={1} max={31} value={form.day_of_month || 1} onChange={e => setForm({ ...form, day_of_month: e.target.value })} /></div>}
            <div><Label>Início *</Label><Input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value, next_run_date: form.next_run_date || e.target.value })} /></div>
            <div><Label>Fim (opcional)</Label><Input type="date" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>Próxima execução *</Label><Input type="date" value={form.next_run_date || ''} onChange={e => setForm({ ...form, next_run_date: e.target.value })} /></div>
            <div><Label>Categoria</Label><Select value={form.category_id || 'none'} onValueChange={v => setForm({ ...form, category_id: v === 'none' ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{cats.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Centro de Custo</Label><Select value={form.cost_center_id || 'none'} onValueChange={v => setForm({ ...form, cost_center_id: v === 'none' ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Conta Bancária</Label><Select value={form.bank_account_id || 'none'} onValueChange={v => setForm({ ...form, bank_account_id: v === 'none' ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-2"><Label>Cliente (opcional)</Label><Select value={form.client_id || 'none'} onValueChange={v => setForm({ ...form, client_id: v === 'none' ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-2 flex items-center gap-2"><Switch checked={form.active ?? true} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            <div className="col-span-2"><Button onClick={save} className="w-full">Salvar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}