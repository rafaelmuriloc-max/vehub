import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as forge from 'node-forge';
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
import { Plus, Search, Loader2, Upload, Download, Trash2, FileCheck } from 'lucide-react';
import { CnaeCombobox } from '@/components/CnaeCombobox';
import { CnaeMultiSelect } from '@/components/CnaeMultiSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

type PermitItem = { name: string; enabled: boolean; expiry: string };

const PERMIT_NAMES = [
  'Alvará de Funcionamento',
  'Alvará Sanitário',
  'Alvará dos Bombeiros',
  'Registro de Classe',
];

const defaultPermits: PermitItem[] = PERMIT_NAMES.map(name => ({ name, enabled: false, expiry: '' }));

function parsePermits(raw: string | null): PermitItem[] {
  if (!raw) return defaultPermits.map(p => ({ ...p }));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return PERMIT_NAMES.map(name => {
        const found = parsed.find((p: any) => p.name === name);
        return found ? { name, enabled: !!found.enabled, expiry: found.expiry || '' } : { name, enabled: false, expiry: '' };
      });
    }
  } catch {}
  return defaultPermits.map(p => ({ ...p }));
}

type Client = {
  id: string; company_name: string; sci_code: string | null; document: string | null; contact_name: string | null;
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
  digital_certificate_url: string | null; digital_certificate_password: string | null;
  partners_info: string | null;
  // Sucesso do Cliente
  company_description: string | null; business_segment: string | null; foundation_date: string | null;
  success_notes: string | null;
  // Geral extras
  opening_date: string | null; from_another_office: boolean;
  previous_office_name: string | null; exit_reason: string | null;
  destination_office_name: string | null; exit_reason_notes: string | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-muted text-muted-foreground', churned: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', churned: 'Churned' };

const emptyForm = {
  company_name: '', sci_code: '', document: '', contact_name: '', contact_email: '',
  contact_phone: '', address: '', status: 'active' as 'active' | 'inactive' | 'churned', monthly_value: '',
  start_date: '', end_date: '', notes: '',
  // Fiscal
  tax_regime: '', main_activity: '', secondary_activities: '', state_registration: '', municipal_registration: '',
  // Pessoal
  payroll_type: '', employee_count: '', payroll_notes: '',
  // Societário
  permits: '', digital_certificate_expiry: '', digital_certificate_type: '', digital_certificate_password: '', partners_info: '',
  // Sucesso do Cliente
  company_description: '', business_segment: '', foundation_date: '', success_notes: '',
  // Geral extras
  opening_date: '', from_another_office: false as boolean,
  previous_office_name: '', exit_reason: '',
  destination_office_name: '', exit_reason_notes: '',
};

type Department = { id: string; name: string };
type DeptContact = { contact_name: string; contact_phone: string; contact_email: string };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [permits, setPermits] = useState<PermitItem[]>(defaultPermits.map(p => ({ ...p })));
  const [certificateUploading, setCertificateUploading] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptContacts, setDeptContacts] = useState<Record<string, DeptContact>>({});

  async function loadDepartments() {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    const deps = (data || []) as Department[];
    setDepartments(deps);
    return deps;
  }

  async function loadDeptContacts(clientId: string, deps: Department[]) {
    const { data } = await (supabase as any)
      .from('client_department_contacts')
      .select('department_id, contact_name, contact_phone, contact_email')
      .eq('client_id', clientId);
    const contacts: Record<string, DeptContact> = {};
    for (const dep of deps) {
      const existing = (data || []).find((d: any) => d.department_id === dep.id);
      contacts[dep.id] = existing
        ? { contact_name: existing.contact_name || '', contact_phone: existing.contact_phone || '', contact_email: existing.contact_email || '' }
        : { contact_name: '', contact_phone: '', contact_email: '' };
    }
    setDeptContacts(contacts);
  }

  function initEmptyDeptContacts(deps: Department[]) {
    const contacts: Record<string, DeptContact> = {};
    for (const dep of deps) {
      contacts[dep.id] = { contact_name: '', contact_phone: '', contact_email: '' };
    }
    setDeptContacts(contacts);
  }

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, document: formatCnpj(e.target.value) });
  }

  async function fetchCnpjData() {
    const digits = form.document.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Digite um CNPJ com 14 dígitos.', variant: 'destructive' });
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();

      const address = [data.logradouro, data.numero, data.complemento, data.bairro, `${data.municipio}/${data.uf}`, data.cep]
        .filter(Boolean).join(', ');

      const mainCnae = data.cnae_fiscal
        ? `${String(data.cnae_fiscal).padStart(7, '0')} - ${data.cnae_fiscal_descricao}`
        : '';

      const secondaryCnaes = (data.cnaes_secundarios || [])
        .filter((c: any) => c.codigo && c.codigo !== 0)
        .map((c: any) => `${String(c.codigo).padStart(7, '0')} - ${c.descricao}`)
        .join(', ');

      const partners = (data.qsa || [])
        .map((s: any) => `${s.nome_socio} (${s.qualificacao_socio})`)
        .join('\n');

      setForm(prev => ({
        ...prev,
        company_name: data.razao_social || prev.company_name,
        address: address || prev.address,
        contact_phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.contact_phone,
        contact_email: data.email || prev.contact_email,
        main_activity: mainCnae || prev.main_activity,
        secondary_activities: secondaryCnaes || prev.secondary_activities,
        tax_regime: data.porte ? data.porte.toLowerCase().replace(/ /g, '_') : prev.tax_regime,
        partners_info: partners || prev.partners_info,
        foundation_date: data.data_inicio_atividade || prev.foundation_date,
        opening_date: data.data_inicio_atividade || prev.opening_date,
        business_segment: data.cnae_fiscal_descricao || prev.business_segment,
      }));

      toast({ title: 'Dados carregados', description: `Dados de ${data.razao_social} preenchidos automaticamente.` });
    } catch (err: any) {
      toast({ title: 'Erro na busca', description: err.message || 'Não foi possível consultar o CNPJ.', variant: 'destructive' });
    } finally {
      setCnpjLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    setClients((data as unknown as Client[]) || []);
  }

  async function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, start_date: new Date().toISOString().split('T')[0] });
    setPermits(defaultPermits.map(p => ({ ...p })));
    setCertificateUrl(null);
    const deps = await loadDepartments();
    initEmptyDeptContacts(deps);
    setDialogOpen(true);
  }

  async function openEdit(c: Client) {
    setEditing(c);
    setForm({
      company_name: c.company_name, sci_code: c.sci_code || '', document: c.document || '', contact_name: c.contact_name || '',
      contact_email: c.contact_email || '', contact_phone: c.contact_phone || '', address: c.address || '',
      status: c.status, monthly_value: String(c.monthly_value || ''), start_date: c.start_date || '',
      end_date: c.end_date || '', notes: c.notes || '',
      tax_regime: c.tax_regime || '', main_activity: c.main_activity || '',
      secondary_activities: c.secondary_activities || '', state_registration: c.state_registration || '',
      municipal_registration: c.municipal_registration || '',
      payroll_type: c.payroll_type || '', employee_count: String(c.employee_count || ''),
      payroll_notes: c.payroll_notes || '',
      permits: '', digital_certificate_expiry: c.digital_certificate_expiry || '',
      digital_certificate_type: c.digital_certificate_type || '',
      digital_certificate_password: c.digital_certificate_password || '',
      partners_info: c.partners_info || '',
      company_description: c.company_description || '', business_segment: c.business_segment || '',
      foundation_date: c.foundation_date || '', success_notes: c.success_notes || '',
      opening_date: (c as any).opening_date || '', from_another_office: !!(c as any).from_another_office,
      previous_office_name: (c as any).previous_office_name || '', exit_reason: (c as any).exit_reason || '',
      destination_office_name: (c as any).destination_office_name || '', exit_reason_notes: (c as any).exit_reason_notes || '',
    });
    setPermits(parsePermits(c.permits));
    setCertificateUrl(c.digital_certificate_url || null);
    const deps = await loadDepartments();
    await loadDeptContacts(c.id, deps);
    setDialogOpen(true);
  }

  async function handleCertificateUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!editing) {
      toast({ title: 'Salve o cliente primeiro', description: 'É necessário salvar o cliente antes de fazer upload do certificado.', variant: 'destructive' });
      return;
    }
    const password = form.digital_certificate_password;
    if (!password) {
      toast({ title: 'Senha necessária', description: 'Informe a senha do certificado antes de fazer o upload.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setCertificateUploading(true);
    try {
      // Read file and extract expiry using node-forge
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const asn1 = forge.asn1.fromDer(binary);
      let p12: any;
      try {
        p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
      } catch {
        toast({ title: 'Senha incorreta', description: 'A senha informada não corresponde ao certificado. Verifique e tente novamente.', variant: 'destructive' });
        e.target.value = '';
        setCertificateUploading(false);
        return;
      }
      // Extract certificate expiry
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certs = certBags[forge.pki.oids.certBag] || [];
      let expiryDate: Date | null = null;
      for (const bag of certs) {
        if (bag.cert) {
          expiryDate = bag.cert.validity.notAfter;
          break;
        }
      }
      if (expiryDate) {
        const formatted = expiryDate.toISOString().split('T')[0];
        setForm(prev => ({ ...prev, digital_certificate_expiry: formatted }));
      }

      // Upload to storage
      const filePath = `${editing.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from('certificates').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('clients').update({ digital_certificate_url: filePath } as any).eq('id', editing.id);
      if (updateError) throw updateError;
      setCertificateUrl(filePath);
      toast({ title: 'Certificado enviado', description: `Arquivo ${file.name} salvo. Vencimento: ${expiryDate ? expiryDate.toLocaleDateString('pt-BR') : 'não encontrado'}.` });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setCertificateUploading(false);
      e.target.value = '';
    }
  }

  async function handleCertificateDownload() {
    if (!certificateUrl) return;
    const { data, error } = await supabase.storage.from('certificates').createSignedUrl(certificateUrl, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Erro ao baixar', description: error?.message || 'Não foi possível gerar o link.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function handleCertificateRemove() {
    if (!certificateUrl || !editing) return;
    const { error: removeError } = await supabase.storage.from('certificates').remove([certificateUrl]);
    if (removeError) {
      toast({ title: 'Erro ao remover', description: removeError.message, variant: 'destructive' });
      return;
    }
    const { error: updateError } = await supabase.from('clients').update({ digital_certificate_url: null } as any).eq('id', editing.id);
    if (updateError) {
      toast({ title: 'Erro ao atualizar', description: updateError.message, variant: 'destructive' });
      return;
    }
    setCertificateUrl(null);
    toast({ title: 'Certificado removido' });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      company_name: form.company_name, sci_code: form.sci_code || null, document: form.document || null, contact_name: form.contact_name || null,
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
      permits: JSON.stringify(permits), digital_certificate_expiry: form.digital_certificate_expiry || null,
      digital_certificate_type: form.digital_certificate_type || null,
      digital_certificate_password: form.digital_certificate_password || null,
      partners_info: form.partners_info || null,
      // Sucesso do Cliente
      company_description: form.company_description || null, business_segment: form.business_segment || null,
      foundation_date: form.foundation_date || null, success_notes: form.success_notes || null,
      // Geral extras
      opening_date: form.opening_date || null, from_another_office: form.from_another_office,
      previous_office_name: form.previous_office_name || null, exit_reason: form.exit_reason || null,
      destination_office_name: form.destination_office_name || null, exit_reason_notes: form.exit_reason_notes || null,
    };
    let error;
    let clientId = editing?.id;
    if (editing) {
      ({ error } = await supabase.from('clients').update(payload).eq('id', editing.id));
    } else {
      const result = await supabase.from('clients').insert({ ...payload, created_by: user?.id }).select('id').single();
      error = result.error;
      if (result.data) clientId = result.data.id;
    }
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }

    // Upsert department contacts
    if (clientId && Object.keys(deptContacts).length > 0) {
      const contactRows = Object.entries(deptContacts)
        .filter(([, c]) => c.contact_name || c.contact_phone || c.contact_email)
        .map(([depId, c]) => ({
          client_id: clientId,
          department_id: depId,
          contact_name: c.contact_name || null,
          contact_phone: c.contact_phone || null,
          contact_email: c.contact_email || null,
        }));
      if (contactRows.length > 0) {
        const { error: contactError } = await (supabase as any)
          .from('client_department_contacts')
          .upsert(contactRows, { onConflict: 'client_id,department_id' });
        if (contactError) {
          toast({ title: 'Erro ao salvar contatos', description: contactError.message, variant: 'destructive' });
        }
      }
    }

    setDialogOpen(false);
    loadClients();
    toast({ title: editing ? 'Cliente atualizado' : 'Cliente criado' });
  }

  const f = (field: keyof typeof form) => ({
    value: form[field] as string,
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
                <TableHead>Código SCI</TableHead>
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
                  <TableCell>{c.sci_code || '-'}</TableCell>
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
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                <TabsTrigger value="societario">Societário</TabsTrigger>
                <TabsTrigger value="sucesso">Sucesso</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
              </TabsList>

              {/* ── Geral ── */}
              <TabsContent value="geral" className="space-y-4">
                {/* Dados Básicos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Código SCI</Label><Input {...f('sci_code')} placeholder="Código no SCI Sistemas" /></div>
                  <div className="col-span-2 space-y-2"><Label>Razão Social *</Label><Input {...f('company_name')} required /></div>
                  <div className="space-y-2">
                    <Label>CNPJ/CPF</Label>
                    <div className="flex gap-2">
                      <Input value={form.document} onChange={handleDocumentChange} placeholder="00.000.000/0000-00" />
                      <Button type="button" variant="outline" size="icon" onClick={fetchCnpjData} disabled={cnpjLoading} title="Buscar dados pelo CNPJ">
                        {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
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
                </div>

                {/* Datas */}
                <Separator />
                <h4 className="text-sm font-semibold text-muted-foreground">Datas</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Data de Abertura</Label><Input type="date" {...f('opening_date')} /></div>
                  <div className="space-y-2"><Label>Data Início</Label><Input type="date" {...f('start_date')} /></div>
                  <div className="space-y-2"><Label>Data Saída</Label><Input type="date" {...f('end_date')} /></div>
                </div>

                {/* Conditional: exit reason when end_date is filled */}
                {form.end_date && (
                  <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4">
                    <div className="col-span-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Motivo da Saída</h4>
                    </div>
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Select value={form.exit_reason} onValueChange={v => setForm({ ...form, exit_reason: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office_change">Troca de escritório</SelectItem>
                          <SelectItem value="company_closure">Fechamento da empresa</SelectItem>
                          <SelectItem value="mei_change">Mudança para MEI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.exit_reason === 'office_change' && (
                      <>
                        <div className="space-y-2">
                          <Label>Escritório de Destino</Label>
                          <Input value={form.destination_office_name} onChange={e => setForm({ ...form, destination_office_name: e.target.value })} placeholder="Nome do escritório de destino" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Motivo da Troca</Label>
                          <Textarea value={form.exit_reason_notes} onChange={e => setForm({ ...form, exit_reason_notes: e.target.value })} placeholder="Descreva o motivo da troca de escritório" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Origem */}
                <Separator />
                <h4 className="text-sm font-semibold text-muted-foreground">Origem</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-3">
                    <Checkbox
                      checked={form.from_another_office}
                      onCheckedChange={(checked) => setForm({ ...form, from_another_office: !!checked, previous_office_name: checked ? form.previous_office_name : '' })}
                    />
                    <Label>Veio de outro escritório?</Label>
                  </div>
                  {form.from_another_office && (
                    <div className="col-span-2 space-y-2">
                      <Label>Nome do Escritório Anterior</Label>
                      <Input value={form.previous_office_name} onChange={e => setForm({ ...form, previous_office_name: e.target.value })} placeholder="Nome do escritório anterior" />
                    </div>
                  )}
                </div>

                {/* Observações */}
                <Separator />
                <div className="space-y-2"><Label>Observações</Label><Textarea {...f('notes')} /></div>
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
                  
                  <div className="col-span-2 space-y-2"><Label>Observações sobre Folha</Label><Textarea {...f('payroll_notes')} /></div>
                </div>
              </TabsContent>

              {/* ── Societário ── */}
              <TabsContent value="societario" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-3">
                    <Label>Alvarás</Label>
                    {permits.map((permit, idx) => (
                      <div key={permit.name} className="flex items-center gap-3">
                        <Checkbox
                          checked={permit.enabled}
                          onCheckedChange={(checked) => {
                            const updated = [...permits];
                            updated[idx] = { ...updated[idx], enabled: !!checked };
                            if (!checked) updated[idx].expiry = '';
                            setPermits(updated);
                          }}
                        />
                        <span className="text-sm min-w-[200px]">{permit.name}</span>
                        {permit.enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Vencimento:</span>
                            <Input
                              type="date"
                              className="w-40"
                              value={permit.expiry}
                              onChange={(e) => {
                                const updated = [...permits];
                                updated[idx] = { ...updated[idx], expiry: e.target.value };
                                setPermits(updated);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-2"><Label>Senha do Certificado</Label><Input type="password" value={form.digital_certificate_password} onChange={e => setForm({ ...form, digital_certificate_password: e.target.value })} placeholder="Informe a senha do certificado" /></div>
                  <div className="space-y-2"><Label>Vencimento Certificado</Label><Input type="date" value={form.digital_certificate_expiry} readOnly className="bg-muted/50" /></div>
                  <div className="col-span-2 space-y-2">
                    <Label>Arquivo do Certificado A1 (.pfx / .p12)</Label>
                    {certificateUrl ? (
                      <div className="flex items-center gap-2 p-3 rounded-md border border-input bg-muted/50">
                        <FileCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">{certificateUrl.split('/').pop()}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={handleCertificateDownload}><Download className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleCertificateRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pfx,.p12"
                          onChange={handleCertificateUpload}
                          disabled={!editing || certificateUploading}
                        />
                        {certificateUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    )}
                    {!editing && <p className="text-xs text-muted-foreground">Salve o cliente primeiro para fazer upload do certificado.</p>}
                  </div>
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

              {/* ── Contatos por Departamento ── */}
              <TabsContent value="contatos" className="space-y-4">
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado.</p>
                ) : (
                  departments.map(dep => (
                    <div key={dep.id} className="space-y-2 rounded-md border border-border p-4">
                      <h4 className="font-medium text-foreground">{dep.name}</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome</Label>
                          <Input
                            placeholder="Nome do contato"
                            value={deptContacts[dep.id]?.contact_name || ''}
                            onChange={e => setDeptContacts(prev => ({
                              ...prev,
                              [dep.id]: { ...prev[dep.id], contact_name: e.target.value }
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone</Label>
                          <Input
                            placeholder="Telefone"
                            value={deptContacts[dep.id]?.contact_phone || ''}
                            onChange={e => setDeptContacts(prev => ({
                              ...prev,
                              [dep.id]: { ...prev[dep.id], contact_phone: e.target.value }
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">E-mail</Label>
                          <Input
                            type="email"
                            placeholder="E-mail"
                            value={deptContacts[dep.id]?.contact_email || ''}
                            onChange={e => setDeptContacts(prev => ({
                              ...prev,
                              [dep.id]: { ...prev[dep.id], contact_email: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>

            <Button type="submit" className="w-full mt-4">{editing ? 'Salvar' : 'Criar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
