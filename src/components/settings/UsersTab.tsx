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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, UserPlus } from 'lucide-react';

interface UserRow {
  id: string; user_id: string; full_name: string | null; job_title: string | null;
  department_id: string | null; role: string;
}
interface Dept { id: string; name: string; }

export function UsersTab() {
  const { isAdmin: admin, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', job_title: '', role: 'employee', department_id: '' });

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', job_title: '', role: 'employee', department_id: 'none' });
  const [inviting, setInviting] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // --- EDIT ---
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name || '', job_title: u.job_title || '', role: u.role, department_id: u.department_id || 'none' });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { error: pErr } = await supabase.from('profiles').update({
      full_name: editForm.full_name || null,
      job_title: editForm.job_title || null,
      department_id: editForm.department_id === 'none' ? null : editForm.department_id || null,
    }).eq('id', editing.id);

    const { error: rErr } = await supabase.from('user_roles').update({
      role: editForm.role as any,
    }).eq('user_id', editing.user_id);

    if (pErr || rErr) {
      toast({ title: 'Erro', description: (pErr || rErr)?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Usuário atualizado' });
    setEditOpen(false);
    fetchData();
  };

  // --- INVITE ---
  const handleInvite = async () => {
    if (!inviteForm.email) {
      toast({ title: 'Erro', description: 'Email é obrigatório', variant: 'destructive' });
      return;
    }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'invite',
          email: inviteForm.email,
          full_name: inviteForm.full_name || undefined,
          job_title: inviteForm.job_title || undefined,
          department_id: inviteForm.department_id === 'none' ? undefined : inviteForm.department_id,
          role: inviteForm.role,
        },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao convidar');
      }
      toast({ title: 'Convite enviado', description: `Email de convite enviado para ${inviteForm.email}` });
      setInviteOpen(false);
      setInviteForm({ email: '', full_name: '', job_title: '', role: 'employee', department_id: 'none' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  // --- DELETE ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', user_id: deleteTarget.user_id },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao excluir');
      }
      toast({ title: 'Usuário excluído' });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const deptName = (id: string | null) => departments.find(d => d.id === id)?.name || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários</CardTitle>
        {admin && (
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />Convidar Usuário
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Permissão</TableHead>
              {admin && <TableHead className="w-24">Ações</TableHead>}
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
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      variant="ghost" size="icon"
                      disabled={u.user_id === user?.id}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={editForm.job_title} onChange={e => setEditForm({ ...editForm, job_title: e.target.value })} /></div>
            <div>
              <Label>Departamento</Label>
              <Select value={editForm.department_id} onValueChange={v => setEditForm({ ...editForm, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permissão</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
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

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email *</Label><Input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="usuario@email.com" /></div>
            <div><Label>Nome</Label><Input value={inviteForm.full_name} onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={inviteForm.job_title} onChange={e => setInviteForm({ ...inviteForm, job_title: e.target.value })} /></div>
            <div>
              <Label>Departamento</Label>
              <Select value={inviteForm.department_id} onValueChange={v => setInviteForm({ ...inviteForm, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permissão</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleInvite} disabled={inviting}>{inviting ? 'Enviando...' : 'Enviar Convite'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.full_name || 'este usuário'}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
