import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil } from 'lucide-react';

interface UserRow {
  id: string; user_id: string; full_name: string | null; job_title: string | null;
  department_id: string | null; role: string;
}

interface Dept { id: string; name: string; }

export function UsersTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ job_title: '', role: 'employee', department_id: '' });

  const fetchData = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    const { data: depts } = await supabase.from('departments').select('id, name').order('name');

    if (depts) setDepartments(depts as unknown as Dept[]);

    if (profiles && roles) {
      const roleMap = new Map((roles as any[]).map(r => [r.user_id, r.role]));
      setUsers((profiles as any[]).map(p => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, job_title: p.job_title,
        department_id: p.department_id, role: roleMap.get(p.user_id) || 'employee',
      })));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ job_title: u.job_title || '', role: u.role, department_id: u.department_id || 'none' });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    // Update profile
    const { error: pErr } = await supabase.from('profiles').update({
      job_title: form.job_title || null,
      department_id: form.department_id === 'none' ? null : form.department_id || null,
    }).eq('id', editing.id);

    // Update role
    const { error: rErr } = await supabase.from('user_roles').update({
      role: form.role as any,
    }).eq('user_id', editing.user_id);

    if (pErr || rErr) {
      toast({ title: 'Erro', description: (pErr || rErr)?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Usuário atualizado' });
    setOpen(false);
    fetchData();
  };

  const deptName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';

  return (
    <Card>
      <CardHeader><CardTitle>Usuários</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Permissão</TableHead>
              {admin && <TableHead className="w-16">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                <TableCell>{u.job_title || '—'}</TableCell>
                <TableCell>{deptName(u.department_id)}</TableCell>
                <TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role === 'admin' ? 'Admin' : 'Funcionário'}</Badge></TableCell>
                {admin && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cargo</Label><Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></div>
            <div>
              <Label>Departamento</Label>
              <Select value={form.department_id} onValueChange={v => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permissão</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
