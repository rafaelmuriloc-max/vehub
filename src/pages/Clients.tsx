import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';
import { CnaeCombobox } from '@/components/CnaeCombobox';
import { CnaeMultiSelect } from '@/components/CnaeMultiSelect';

type Client = {
  id: string; company_name: string; document: string | null; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; address: string | null;
  status: 'active' | 'inactive' | 'churned'; monthly_value: number; start_date: string | null;
  end_date: string | null; notes: string | null;
  // Fiscal
  tax_regime: string | null; main_activity: string | null; secondary_activities: string | null;
  state_registration: string | null; municipal_registration: string | null;
  // Pessoal
  payroll_type: string | null; employee_count: number | null; payroll_notes: string | null;
  // Societário
  permits: string | null; digital_certificate_expiry: string | null; digital_certificate_type: string | null;
  partners_info: string | null;
  // Sucesso do Cliente
  company_description: string | null; business_segment: string | null; foundation_date: string | null;
  success_notes: string | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-muted text-muted-foreground', churned: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', churned: 'Churned' };

const emptyForm = {
  company_name: '', document: '', contact_name: '', contact_email: '',
  contact_phone: '', address: '', status: 'active' as 'active' | 'inactive' | 'churned', monthly_value: '',
  start_date: '', end_date: '', notes: '',
  // Fiscal
  tax_regime: '', main_activity: '', secondary_activities: '', state_registration: '', municipal_registration: '',
  // Pessoal
  payroll_type: '', employee_count: '', payroll_notes: '',
  // Societário
  permits: '', digital_certificate_expiry: '', digital_certificate_type: '', partners_info: '',
  // Sucesso do Cliente
  company_description: '', business_segment: '', foundation_date: '', success_notes: '',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    setClients((data as unknown as Client[]) || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, start_date: new Date().toISOString().split('T')[0] });
    setDialogOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      company_name: c.company_name, document: c.document || '', contact_name: c.contact_name || '',
      contact_email: c.contact_email || '', contact_phone: c.contact_phone || '', address: c.address || '',
      status: c.status, monthly_value: String(c.monthly_value || ''), start_date: c.start_date || '',
      end_date: c.end_date || '', notes: c.notes || '',
      tax_regime: c.tax_regime || '', main_activity: c.main_activity || '',
      secondary_activities: c.secondary_activities || '', state_registration: c.state_registration || '',
      municipal_registration: c.municipal_registration || '',
      payroll_type: c.payroll_type || '', employee_count: String(c.employee_count || ''),
      payroll_notes: c.payroll_notes || '',
      permits: c.permits || '', digital_certificate_expiry: c.digital_certificate_expiry || '',
      digital_certificate_type: c.digital_certificate_type || '', partners_info: c.partners_info || '',
      company_description: c.company_description || '', business_segment: c.business_segment || '',
      foundation_date: c.foundation_date || '', success_notes: c.success_notes || '',
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      company_name: form.company_name, document: form.document || null, contact_name: form.contact_name || null,
      contact_email: form.contact_email || null, contact_phone: form.contact_phone || null, address: form.address || null,
      status: form.status, monthly_value: Number(form.monthly_value) || 0,
      start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null,
      // Fiscal
      tax_regime: form.tax_regime || null, main_activity: form.main_activity || null,
      secondary_activities: form.secondary_activities || null, state_registration: form.state_registration || null,
      municipal_registration: form.municipal_registration || null,
      // Pessoal
      payroll_type: form.payroll_type || null, employee_count: Number(form.employee_count) || 0,
      payroll_notes: form.payroll_notes || null,
      // Societário
      permits: form.permits || null, digital_certificate_expiry: form.digital_certificate_expiry || null,
      digital_certificate_type: form.digital_certificate_type || null, partners_info: form.partners_info || null,
      // Sucesso do Cliente
      company_description: form.company_description || null, business_segment: form.business_segment || null,
      foundation_date: form.foundation_date || null, success_notes: form.success_notes || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('clients').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('clients').insert({ ...payload, created_by: user?.id }));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setDialogOpen(false); loadClients(); toast({ title: editing ? 'Cliente atualizado' : 'Cliente criado' }); }
  }

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field]: e.target.value }),
  });

  const filtered = clients.filter(c => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = clients.filter(c => c.status === 'active').length;
  const churnedCount = clients.filter(c => c.status === 'churned').length;
  const mrr = clients.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const churnRate = clients.length > 0 ? (churnedCount / clients.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        {isAdmin && (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">MRR</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Churn Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">{churnRate.toFixed(1)}%</p></CardContent></Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.document || '-'}</TableCell>
                  <TableCell>{c.contact_name || '-'}</TableCell>
                  <TableCell>R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge></TableCell>
                  <TableCell>
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                <TabsTrigger value="societario">Societário</TabsTrigger>
                <TabsTrigger value="sucesso">Sucesso</TabsTrigger>
              </TabsList>

              {/* ── Geral ── */}
              <TabsContent value="geral" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Razão Social *</Label><Input {...f('company_name')} required /></div>
                  <div className="space-y-2"><Label>CNPJ/CPF</Label><Input {...f('document')} /></div>
                  <div className="space-y-2"><Label>Contato</Label><Input {...f('contact_name')} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" {...f('contact_email')} /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input {...f('contact_phone')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Endereço</Label><Input {...f('address')} /></div>
                  <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" {...f('monthly_value')} /></div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Data Início</Label><Input type="date" {...f('start_date')} /></div>
                  <div className="space-y-2"><Label>Data Saída</Label><Input type="date" {...f('end_date')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea {...f('notes')} /></div>
                </div>
              </TabsContent>

              {/* ── Fiscal ── */}
              <TabsContent value="fiscal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select value={form.tax_regime} onValueChange={v => setForm({ ...form, tax_regime: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mei">MEI</SelectItem>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Atividade Principal (CNAE)</Label>
                    <CnaeCombobox value={form.main_activity} onChange={v => setForm({ ...form, main_activity: v })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Atividades Secundárias</Label>
                    <CnaeMultiSelect value={form.secondary_activities} onChange={v => setForm({ ...form, secondary_activities: v })} />
                  </div>
                  <div className="space-y-2"><Label>Inscrição Estadual</Label><Input {...f('state_registration')} /></div>
                  <div className="space-y-2"><Label>Inscrição Municipal</Label><Input {...f('municipal_registration')} /></div>
                </div>
              </TabsContent>

              {/* ── Pessoal ── */}
              <TabsContent value="pessoal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Tipo de Folha</Label>
                    <Select value={form.payroll_type} onValueChange={v => setForm({ ...form, payroll_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="pro_labore">Pró-labore apenas</SelectItem>
                        <SelectItem value="sem_folha">Sem folha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Quantidade de Funcionários</Label><Input type="number" {...f('employee_count')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Observações sobre Folha</Label><Textarea {...f('payroll_notes')} /></div>
                </div>
              </TabsContent>

              {/* ── Societário ── */}
              <TabsContent value="societario" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Alvarás</Label><Textarea {...f('permits')} /></div>
                  <div className="space-y-2">
                    <Label>Tipo Certificado Digital</Label>
                    <Select value={form.digital_certificate_type} onValueChange={v => setForm({ ...form, digital_certificate_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Vencimento Certificado</Label><Input type="date" {...f('digital_certificate_expiry')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Informações dos Sócios</Label><Textarea {...f('partners_info')} /></div>
                </div>
              </TabsContent>

              {/* ── Sucesso do Cliente ── */}
              <TabsContent value="sucesso" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Descrição da Empresa</Label><Textarea {...f('company_description')} /></div>
                  <div className="space-y-2"><Label>Segmento de Atuação</Label><Input {...f('business_segment')} /></div>
                  <div className="space-y-2"><Label>Data de Fundação</Label><Input type="date" {...f('foundation_date')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea {...f('success_notes')} /></div>
                </div>
              </TabsContent>
            </Tabs>

            <Button type="submit" className="w-full mt-4">{editing ? 'Salvar' : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
