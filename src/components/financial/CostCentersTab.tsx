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
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Tag, Trash2 } from 'lucide-react';

type CC = { id: string; name: string; code: string | null; parent_id: string | null; active: boolean; color: string | null };

export function CostCentersTab() {
  const [items, setItems] = useState<CC[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CC | null>(null);
  const [form, setForm] = useState<any>({});
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('cost_centers').select('*').order('name');
    setItems(data || []);
  }
  function openNew() { setEditing(null); setForm({ name: '', code: '', parent_id: null, active: true, color: '#E8710A' }); setOpen(true); }
  function openEdit(c: CC) { setEditing(c); setForm({ ...c }); setOpen(true); }
  async function save() {
    const payload = { name: form.name, code: form.code || null, parent_id: form.parent_id || null, active: form.active, color: form.color };
    const { error } = editing
      ? await supabase.from('cost_centers').update(payload).eq('id', editing.id)
      : await supabase.from('cost_centers').insert(payload);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setOpen(false); load(); toast({ title: 'Centro de custo salvo' }); }
  }
  async function remove(id: string) {
    if (!confirm('Excluir centro de custo?')) return;
    await supabase.from('cost_centers').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Centros de Custo</h3>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>}
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {items.map(c => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" style={{ color: c.color || '#E8710A' }} />
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.code && <p className="text-xs text-muted-foreground">#{c.code}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Nenhum centro cadastrado</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Centro de Custo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" value={form.color || '#E8710A'} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            </div>
            <div>
              <Label>Centro pai (opcional)</Label>
              <Select value={form.parent_id || 'none'} onValueChange={v => setForm({ ...form, parent_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {items.filter(i => i.id !== editing?.id).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active ?? true} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            <Button onClick={save} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}