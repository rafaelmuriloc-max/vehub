import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Partner {
  id: string; name: string; document: string | null; email: string | null;
  phone: string | null; title: string | null; ownership_percentage: number; active: boolean;
}

const emptyForm = { name: '', document: '', email: '', phone: '', title: '', ownership_percentage: '0' };

export function PartnersTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchData = async () => {
    const { data } = await supabase.from('partners').select('*').order('name');
    if (data) setItems(data as unknown as Partner[]);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name, document: p.document || '', email: p.email || '',
      phone: p.phone || '', title: p.title || '', ownership_percentage: String(p.ownership_percentage),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, document: form.document || null, email: form.email || null,
      phone: form.phone || null, title: form.title || null,
      ownership_percentage: parseFloat(form.ownership_percentage) || 0,
    };
    const { error } = editing
      ? await supabase.from('partners').update(payload).eq('id', editing.id)
      : await supabase.from('partners').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Atualizado' : 'Criado' });
    setOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('partners').delete().eq('id', id);
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sócios</CardTitle>
        {admin && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>% Participação</TableHead>
              <TableHead>Status</TableHead>
              {admin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.document}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{p.title}</TableCell>
                <TableCell>{p.ownership_percentage}%</TableCell>
                <TableCell><Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                {admin && (
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum sócio cadastrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Sócio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>CPF</Label><Input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>% Participação</Label><Input type="number" value={form.ownership_percentage} onChange={e => setForm({ ...form, ownership_percentage: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={!form.name}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
