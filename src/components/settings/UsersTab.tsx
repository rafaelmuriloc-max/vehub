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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, UserPlus, ChevronDown, KeyRound, RefreshCw, Copy } from 'lucide-react';

interface UserRow {
  id: string; user_id: string; full_name: string | null; job_title: string | null;
  department_id: string | null; department_ids: string[]; role: string; tag_color: string | null;
  hourly_rate: number | null; must_change_password: boolean;
}
interface Dept { id: string; name: string; }

const TAG_COLOR_PRESETS = [
  '#D97706', '#DC2626', '#DB2777', '#7C3AED',
  '#2563EB', '#0891B2', '#059669', '#65A30D',
  '#475569', '#0F172A',
];

const PWD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PWD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PWD_DIGITS = '23456789';
const PWD_SYMBOLS = '!@#$%&*';

/** Gera a senha temporária exibida para o admin (a mesma política da rotina de envio). */
function genTempPassword(): string {
  const all = PWD_UPPER + PWD_LOWER + PWD_DIGITS + PWD_SYMBOLS;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [pick(PWD_UPPER), pick(PWD_LOWER), pick(PWD_DIGITS), pick(PWD_SYMBOLS)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function ColorPickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#D97706'}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-14 rounded border bg-background cursor-pointer"
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#D97706"
          className="flex-1 font-mono text-sm"
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>Limpar</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TAG_COLOR_PRESETS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="h-6 w-6 rounded-full border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function DepartmentMultiSelect({
  value, onChange, departments, placeholder = 'Selecione',
}: { value: string[]; onChange: (v: string[]) => void; departments: Dept[]; placeholder?: string }) {
  const allSelected = value.length === 0;
  const label = allSelected
    ? 'Todos os departamentos'
    : value.length === 1
      ? departments.find(d => d.id === value[0])?.name || placeholder
      : `${departments.find(d => d.id === value[0])?.name || ''} +${value.length - 1}`;
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
          <Checkbox checked={allSelected} onCheckedChange={() => onChange([])} />
          <span className="text-sm font-medium">Todos os departamentos</span>
        </label>
        <div className="h-px bg-border my-1" />
        <div className="max-h-64 overflow-auto">
          {departments.map(d => (
            <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
              <Checkbox checked={value.includes(d.id)} onCheckedChange={() => toggle(d.id)} />
              <span className="text-sm">{d.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function UsersTab() {
  const { isAdmin: admin, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', job_title: '', role: 'employee', department_ids: [] as string[], tag_color: '', hourly_rate: '' });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', whatsapp: '', full_name: '', job_title: '', role: 'employee', department_ids: [] as string[], tag_color: '' });
  const [creating, setCreating] = useState(false);

  // Send access (reenvio de credenciais por WhatsApp)
  const [accessTarget, setAccessTarget] = useState<UserRow | null>(null);
  const [accessPhone, setAccessPhone] = useState('');
  const [sendingAccess, setSendingAccess] = useState(false);
  const [accessResult, setAccessResult] = useState<{ temp_password: string; whatsapp_sent: boolean; whatsapp_error: string | null } | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    const { data: depts } = await supabase.from('departments').select('id, name').order('name');
    const { data: links } = await supabase.from('profile_departments' as any).select('user_id, department_id');
    if (depts) setDepartments(depts as unknown as Dept[]);
    if (profiles && roles) {
      const roleMap = new Map((roles as any[]).map(r => [r.user_id, r.role]));
      const linkMap = new Map<string, string[]>();
      ((links as any[]) || []).forEach(l => {
        const arr = linkMap.get(l.user_id) || [];
        arr.push(l.department_id);
        linkMap.set(l.user_id, arr);
      });
      setUsers((profiles as any[]).map(p => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name, job_title: p.job_title,
        department_id: p.department_id, role: roleMap.get(p.user_id) || 'employee',
        department_ids: linkMap.get(p.user_id) || [],
        tag_color: p.tag_color ?? null,
        hourly_rate: p.hourly_rate ?? null,
        must_change_password: !!p.must_change_password,
      })));
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- EDIT ---
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name || '', job_title: u.job_title || '', role: u.role, department_ids: u.department_ids, tag_color: u.tag_color || '', hourly_rate: u.hourly_rate != null ? String(u.hourly_rate).replace('.', ',') : '' });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'update',
          user_id: editing.user_id,
          full_name: editForm.full_name || null,
          job_title: editForm.job_title || null,
          department_ids: editForm.department_ids,
          role: editForm.role,
          tag_color: editForm.tag_color || null,
          hourly_rate: editForm.hourly_rate.trim() ? Number(editForm.hourly_rate.replace(',', '.')) : null,
        },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao salvar');
      }
      toast({ title: 'Usuário atualizado' });
      setEditOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  // --- CREATE ---
  const openCreate = () => {
    setCreateForm({ email: '', password: genTempPassword(), whatsapp: '', full_name: '', job_title: '', role: 'employee', department_ids: [], tag_color: '' });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) {
      toast({ title: 'Erro', description: 'E-mail e senha são obrigatórios', variant: 'destructive' });
      return;
    }
    if (createForm.password.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    const digitsOnly = createForm.whatsapp.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      toast({ title: 'Erro', description: 'Informe o WhatsApp do usuário com DDD para enviar o acesso', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'create',
          email: createForm.email,
          password: createForm.password,
          full_name: createForm.full_name || undefined,
          job_title: createForm.job_title || undefined,
          department_ids: createForm.department_ids,
          role: createForm.role,
          tag_color: createForm.tag_color || undefined,
          whatsapp: digitsOnly,
        },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao criar usuário');
      }
      if (res.data?.whatsapp_sent) {
        toast({ title: 'Usuário criado', description: 'Acesso enviado por WhatsApp.' });
      } else {
        toast({ title: 'Usuário criado', description: res.data?.whatsapp_error || 'Acesso enviado por WhatsApp não confirmado — use "Enviar acesso" na lista.' , variant: 'destructive' });
      }
      setCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // --- SEND ACCESS (reenvio por WhatsApp) ---
  const handleSendAccess = async () => {
    if (!accessTarget) return;
    const digitsOnly = accessPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      toast({ title: 'Erro', description: 'Informe um número de WhatsApp válido com DDD', variant: 'destructive' });
      return;
    }
    setSendingAccess(true);
    try {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'send-access', user_id: accessTarget.user_id, whatsapp: digitsOnly },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao enviar acesso');
      }
      setAccessResult({
        temp_password: res.data.temp_password,
        whatsapp_sent: res.data.whatsapp_sent,
        whatsapp_error: res.data.whatsapp_error ?? null,
      });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSendingAccess(false);
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
  const deptListLabel = (ids: string[]) => {
    if (!ids || ids.length === 0) return 'Todos';
    if (ids.length === 1) return deptName(ids[0]);
    const first = deptName(ids[0]);
    return `${first} +${ids.length - 1}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários</CardTitle>
        {admin && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />Novo Usuário
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
              <TableHead>Cor</TableHead>
              {admin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                <TableCell>{u.job_title || '—'}</TableCell>
                <TableCell title={u.department_ids.map(deptName).join(', ') || 'Todos os departamentos'}>
                  {deptListLabel(u.department_ids)}
                </TableCell>
                <TableCell><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role === 'admin' ? 'Admin' : 'Funcionário'}</Badge></TableCell>
                <TableCell>
                  {u.tag_color ? (
                    <span className="inline-block h-5 w-5 rounded-full border border-border" style={{ backgroundColor: u.tag_color }} title={u.tag_color} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
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
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
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
              <DepartmentMultiSelect
                value={editForm.department_ids}
                onChange={v => setEditForm({ ...editForm, department_ids: v })}
                departments={departments}
              />
              <p className="text-xs text-muted-foreground mt-1">Sem seleção = acesso a todos os departamentos.</p>
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
            <div>
              <Label>Cor da tag (chat)</Label>
              <ColorPickerField value={editForm.tag_color} onChange={v => setEditForm({ ...editForm, tag_color: v })} />
            </div>
            <div>
              <Label>Valor/hora (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="Ex.: 45,00"
                value={editForm.hourly_rate}
                onChange={e => setEditForm({ ...editForm, hourly_rate: e.target.value.replace(/[^\d,.]/g, '') })}
              />
              <p className="text-xs text-muted-foreground mt-1">Usado no relatório de custo por cliente. Em branco = sem custo calculado.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail (login) *</Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="usuario@empresa.local" />
              <p className="text-xs text-muted-foreground mt-1">Pode ser fictício — será usado apenas para login (formato de e-mail válido).</p>
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div><Label>Nome</Label><Input value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={createForm.job_title} onChange={e => setCreateForm({ ...createForm, job_title: e.target.value })} /></div>
            <div>
              <Label>Departamento</Label>
              <DepartmentMultiSelect
                value={createForm.department_ids}
                onChange={v => setCreateForm({ ...createForm, department_ids: v })}
                departments={departments}
              />
              <p className="text-xs text-muted-foreground mt-1">Sem seleção = acesso a todos os departamentos.</p>
            </div>
            <div>
              <Label>Permissão</Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor da tag (chat)</Label>
              <ColorPickerField value={createForm.tag_color} onChange={v => setCreateForm({ ...createForm, tag_color: v })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={creating}>{creating ? 'Criando...' : 'Criar Usuário'}</Button></DialogFooter>
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
