import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
}

export function DocumentTypesTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<DocumentType[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase.from('document_types').select('*').order('name');
    setItems((data as DocumentType[]) || []);
  }

  function openNew() { setEditing(null); setForm({ name: '', description: '' }); setOpen(true); }
  function openEdit(d: DocumentType) { setEditing(d); setForm({ name: d.name, description: d.description || '' }); setOpen(true); }

  async function handleSave() {
    const payload = { name: form.name, description: form.description || null };
    const { error } = editing
      ? await supabase.from('document_types').update(payload).eq('id', editing.id)
      : await supabase.from('document_types').insert(payload);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Atualizado' : 'Criado' });
    setOpen(false);
    fetch();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('document_types').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Excluído' });
    fetch();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tipos de Documento</CardTitle>
        {isAdmin && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              {isAdmin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{d.description || '—'}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum tipo cadastrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Tipo' : 'Novo Tipo de Documento'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave} disabled={!form.name}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
