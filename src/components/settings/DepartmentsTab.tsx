import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface Department { id: string; name: string; description: string | null; triage_keywords?: string | null; smtp_email?: string | null; smtp_password?: string | null; }

export function DepartmentsTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Department[]>([]);
  const [triageEnabled, setTriageEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', triage_keywords: '', smtp_email: '', smtp_password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const fetch = async () => {
    const { data: depts } = await supabase.from('departments').select('id, name, description, triage_keywords').order('name');
    if (!depts) return;
    const { data: creds } = await supabase.from('department_credentials' as any).select('department_id, smtp_email, smtp_password');
    const credMap = new Map<string, { smtp_email: string | null; smtp_password: string | null }>();
    (creds as any[] | null)?.forEach(c => credMap.set(c.department_id, { smtp_email: c.smtp_email, smtp_password: c.smtp_password }));
    setItems((depts as any[]).map(d => ({ ...d, smtp_email: credMap.get(d.id)?.smtp_email ?? null, smtp_password: credMap.get(d.id)?.smtp_password ?? null })) as Department[]);
    const { data: cs } = await supabase.from('company_settings').select('triage_enabled').limit(1).maybeSingle();
    setTriageEnabled(!!(cs as any)?.triage_enabled);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', triage_keywords: '', smtp_email: '', smtp_password: '' }); setShowPassword(false); setOpen(true); };
  const openEdit = (d: Department) => { setEditing(d); setForm({ name: d.name, description: d.description || '', triage_keywords: d.triage_keywords || '', smtp_email: d.smtp_email || '', smtp_password: d.smtp_password || '' }); setShowPassword(false); setOpen(true); };

  const handleSave = async () => {
    const deptPayload: any = { name: form.name, description: form.description || null, triage_keywords: form.triage_keywords || null };
    let deptId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('departments').update(deptPayload).eq('id', editing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('departments').insert(deptPayload).select('id').single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      deptId = data.id;
    }
    if (deptId) {
      const credPayload = { department_id: deptId, smtp_email: form.smtp_email || null, smtp_password: form.smtp_password || null };
      const { error: credError } = await supabase.from('department_credentials' as any).upsert(credPayload, { onConflict: 'department_id' });
      if (credError) { toast({ title: 'Erro ao salvar SMTP', description: credError.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'Atualizado' : 'Criado' });
    setOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    fetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Departamentos</CardTitle>
        {admin && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </CardHeader>
      <CardContent>
        {triageEnabled && items.some(d => !d.triage_keywords) && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              A triagem automática está ativa, mas <strong>{items.filter(d => !d.triage_keywords).length}</strong> departamento(s) sem palavras-chave.
              Sem isso, a IA pode classificar errado e cair no fallback. Edite cada departamento e preencha o campo <em>Palavras-chave para triagem por IA</em>.
            </div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              {admin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.description}</TableCell>
                {admin && (
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum departamento cadastrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Palavras-chave para triagem por IA</Label>
              <Textarea
                value={form.triage_keywords}
                onChange={e => setForm({ ...form, triage_keywords: e.target.value })}
                rows={2}
                placeholder="Ex.: notas fiscais, NFe, NFSe, ICMS, impostos, escrituração fiscal"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A IA usa essas palavras para decidir quando rotear conversas para este departamento.
              </p>
            </div>
            <div><Label>E-mail SMTP</Label><Input type="email" placeholder="departamento@escritorio.com" value={form.smtp_email} onChange={e => setForm({ ...form, smtp_email: e.target.value })} /></div>
            <div>
              <Label>Senha de App (Gmail)</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder="Senha de app de 16 caracteres" value={form.smtp_password} onChange={e => setForm({ ...form, smtp_password: e.target.value })} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Use uma Senha de App do Google, não a senha da conta. Gere em myaccount.google.com → Segurança → Senhas de app.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={!form.name}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
