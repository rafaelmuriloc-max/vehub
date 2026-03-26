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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, Upload, Download, Trash2, FileCheck, Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { CnaeCombobox } from '@/components/CnaeCombobox';
import { CnaeMultiSelect } from '@/components/CnaeMultiSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import ContractTab from '@/components/ContractTab';
import ClientObligationsTab from '@/components/ClientObligationsTab';
import CertificateImportDialog from '@/components/CertificateImportDialog';

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

async function classifyByAI(mainCnae: string, secondaryCnaes: string): Promise<string> {
  if (!mainCnae && !secondaryCnaes) return '';
  try {
    const { data, error } = await supabase.functions.invoke('classify-segment', {
      body: { main_activity: mainCnae, secondary_activities: secondaryCnaes },
    });
    if (error) throw error;
    return data?.classification || '';
  } catch (e) {
    console.error('AI classification error:', e);
    return '';
  }
}

type Client = {
  id: string; company_name: string; sci_code: string | null; document: string | null; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; address: string | null;
  status: 'active' | 'inactive' | 'churned'; monthly_value: number; start_date: string | null;
  end_date: string | null; notes: string | null;
  tax_regime: string | null; main_activity: string | null; secondary_activities: string | null;
  state_registration: string | null; municipal_registration: string | null;
  payroll_type: string | null; employee_count: number | null; payroll_notes: string | null;
  permits: string | null; digital_certificate_expiry: string | null; digital_certificate_type: string | null;
  digital_certificate_url: string | null; digital_certificate_password: string | null;
  partners_info: string | null;
  company_description: string | null; business_segment: string | null; foundation_date: string | null;
  success_notes: string | null;
  opening_date: string | null; from_another_office: boolean;
  previous_office_name: string | null; exit_reason: string | null;
  destination_office_name: string | null; exit_reason_notes: string | null;
  business_classification: string | null;
  trade_name: string | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-muted text-muted-foreground', churned: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', churned: 'Churned' };

const emptyForm = {
  company_name: '', sci_code: '', document: '', contact_name: '', contact_email: '',
  contact_phone: '', address: '', status: 'active' as 'active' | 'inactive' | 'churned', monthly_value: '',
  start_date: '', end_date: '', notes: '',
  tax_regime: '', main_activity: '', secondary_activities: '', state_registration: '', municipal_registration: '',
  payroll_type: '', employee_count: '', payroll_notes: '',
  permits: '', digital_certificate_expiry: '', digital_certificate_type: '', digital_certificate_password: '', partners_info: '',
  company_description: '', business_segment: '', foundation_date: '', success_notes: '',
  opening_date: '', from_another_office: false as boolean,
  previous_office_name: '', exit_reason: '',
  destination_office_name: '', exit_reason_notes: '',
  business_classification: '',
  trade_name: '',
};

type Department = { id: string; name: string };
type DeptContact = { contact_name: string; contact_phone: string; contact_email: string };
type ObligationOption = { id: string; name: string; department_id: string };

const PAGE_SIZE = 10;

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [classifyingSegment, setClassifyingSegment] = useState(false);
  const [permits, setPermits] = useState<PermitItem[]>(defaultPermits.map(p => ({ ...p })));
  const [certificateUploading, setCertificateUploading] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptContacts, setDeptContacts] = useState<Record<string, DeptContact>>({});
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [allObligations, setAllObligations] = useState<ObligationOption[]>([]);
  const [selectedObligations, setSelectedObligations] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function loadDepartments() {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    const deps = (data || []) as Department[];
    setDepartments(deps);
    return deps;
  }

  async function loadObligations() {
    const { data } = await supabase.from('obligations').select('id, name, department_id').order('name');
    const obls = (data || []) as ObligationOption[];
    setAllObligations(obls);
    return obls;
  }

  async function loadClientObligations(clientId: string) {
    const { data } = await (supabase as any)
      .from('client_department_obligations')
      .select('obligation_id')
      .eq('client_id', clientId);
    const ids = new Set<string>((data || []).map((r: any) => r.obligation_id));
    setSelectedObligations(ids);
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

      const address = [data.logradouro, data.numero, data.complemento, data.bairro, `${data.municipio || ''}/${data.uf || ''}`, data.cep]
        .filter(Boolean).join(', ');

      const cnaePrincipal = data.cnae_fiscal
        ? `${String(data.cnae_fiscal).padStart(7, '0')} - ${data.cnae_fiscal_descricao || ''}`
        : '';

      const secondaryCnaes = (data.cnaes_secundarios || [])
        .filter((c: any) => c.codigo && c.codigo !== 0)
        .map((c: any) => `${String(c.codigo).padStart(7, '0')} - ${c.descricao}`)
        .join(', ');

      const partners = (data.qsa || [])
        .map((s: any) => `${s.nome_socio} (${s.qualificacao_socio || ''})`)
        .join('\n');

      const isSimples = data.opcao_pelo_simples === true;
      const isMei = data.opcao_pelo_mei === true;
      const taxRegime = isMei ? 'mei' : isSimples ? 'simples_nacional' : 'lucro_presumido';

      setForm(prev => ({
        ...prev,
        company_name: data.razao_social || prev.company_name,
        address: address || prev.address,
        contact_phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0,2)}) ${data.ddd_telefone_1.substring(2)}` : prev.contact_phone,
        contact_email: data.email || prev.contact_email,
        main_activity: cnaePrincipal || prev.main_activity,
        secondary_activities: secondaryCnaes || prev.secondary_activities,
        tax_regime: taxRegime,
        partners_info: partners || prev.partners_info,
        foundation_date: data.data_inicio_atividade || prev.foundation_date,
        opening_date: data.data_inicio_atividade || prev.opening_date,
        business_segment: data.cnae_fiscal_descricao || prev.business_segment,
        trade_name: data.nome_fantasia || prev.trade_name,
        business_classification: '',
      }));
      setClassifyingSegment(true);
      classifyByAI(cnaePrincipal, secondaryCnaes).then(c => {
        setForm(prev => ({ ...prev, business_classification: c }));
        setClassifyingSegment(false);
      });

      toast({ title: 'Dados carregados', description: `Dados de ${data.razao_social || digits} preenchidos automaticamente.` });
    } catch (err: any) {
      toast({ title: 'Erro na busca', description: err.message || 'Não foi possível consultar o CNPJ.', variant: 'destructive' });
    } finally {
      setCnpjLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  // One-time batch update of tax_regime for existing clients
  useEffect(() => {
    const BATCH_KEY = 'tax_regime_batch_done';
    if (localStorage.getItem(BATCH_KEY)) return;
    
    async function batchUpdateTaxRegimes() {
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, document, tax_regime');
      
      if (!allClients) return;
      
      const cnpjClients = allClients.filter(
        (c) => c.document && c.document.replace(/\D/g, '').length === 14
      );

      let updated = 0;
      let errors = 0;

      for (const client of cnpjClients) {
        const cnpj = client.document!.replace(/\D/g, '');
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
          if (!res.ok) { errors++; continue; }
          const data = await res.json();
          
          const isSimples = data.opcao_pelo_simples === true;
          const isMei = data.opcao_pelo_mei === true;
          const newRegime = isMei ? 'mei' : isSimples ? 'simples_nacional' : 'lucro_presumido';

          if (client.tax_regime !== newRegime) {
            await supabase
              .from('clients')
              .update({ tax_regime: newRegime })
              .eq('id', client.id);
            updated++;
          }
        } catch {
          errors++;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      localStorage.setItem(BATCH_KEY, 'true');
      console.log(`[batch-tax-regime] Done: ${updated} updated, ${errors} errors, ${cnpjClients.length} total`);
      
      if (updated > 0) {
        loadClients();
        toast({
          title: 'Regimes tributários atualizados',
          description: `${updated} cliente(s) atualizado(s) automaticamente.`,
        });
      }
    }

    batchUpdateTaxRegimes();
  }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    setClients((data as unknown as Client[]) || []);
  }

  async function openNew() {
    setEditing(null);
    setViewOnly(false);
    setForm({ ...emptyForm, start_date: new Date().toISOString().split('T')[0] });
    setPermits(defaultPermits.map(p => ({ ...p })));
    setCertificateUrl(null);
    setSelectedObligations(new Set());
    const [deps] = await Promise.all([loadDepartments(), loadObligations()]);
    initEmptyDeptContacts(deps);
    setDialogOpen(true);
  }

  async function openEdit(c: Client) {
    setEditing(c);
    setViewOnly(false);
    populateForm(c);
    setPermits(parsePermits(c.permits));
    setCertificateUrl(c.digital_certificate_url || null);
    const [deps] = await Promise.all([loadDepartments(), loadObligations(), loadClientObligations(c.id)]);
    await loadDeptContacts(c.id, deps);
    setDialogOpen(true);
  }

  async function openView(c: Client) {
    setEditing(c);
    setViewOnly(true);
    populateForm(c);
    setPermits(parsePermits(c.permits));
    setCertificateUrl(c.digital_certificate_url || null);
    const [deps] = await Promise.all([loadDepartments(), loadObligations(), loadClientObligations(c.id)]);
    await loadDeptContacts(c.id, deps);
    setDialogOpen(true);
  }

  function populateForm(c: Client) {
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
      business_classification: (c as any).business_classification || '',
      trade_name: (c as any).trade_name || '',
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete department contacts
      await (supabase as any).from('client_department_contacts').delete().eq('client_id', deleteTarget.id);

      // Remove certificate from storage if exists
      if (deleteTarget.digital_certificate_url) {
        await supabase.storage.from('certificates').remove([deleteTarget.digital_certificate_url]);
      }

      // Delete client
      const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      toast({ title: 'Cliente excluído', description: `${deleteTarget.company_name} foi removido.` });
      loadClients();
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleCertificateUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const password = form.digital_certificate_password;
    if (!password) {
      toast({ title: 'Senha necessária', description: 'Informe a senha do certificado antes de fazer o upload.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setCertificateUploading(true);
    try {
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

      if (editing) {
        const filePath = `${editing.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('certificates').upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { error: updateError } = await supabase.from('clients').update({ digital_certificate_url: filePath } as any).eq('id', editing.id);
        if (updateError) throw updateError;
        setCertificateUrl(filePath);
        toast({ title: 'Certificado enviado', description: `Arquivo ${file.name} salvo. Vencimento: ${expiryDate ? expiryDate.toLocaleDateString('pt-BR') : 'não encontrado'}.` });
      } else {
        setPendingCertFile(file);
        toast({ title: 'Certificado carregado', description: `Vencimento: ${expiryDate ? expiryDate.toLocaleDateString('pt-BR') : 'não encontrado'}. Será salvo ao criar o cliente.` });
      }
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
      tax_regime: form.tax_regime || null, main_activity: form.main_activity || null,
      secondary_activities: form.secondary_activities || null, state_registration: form.state_registration || null,
      municipal_registration: form.municipal_registration || null,
      payroll_type: form.payroll_type || null, employee_count: Number(form.employee_count) || 0,
      payroll_notes: form.payroll_notes || null,
      permits: JSON.stringify(permits), digital_certificate_expiry: form.digital_certificate_expiry || null,
      digital_certificate_type: form.digital_certificate_type || null,
      digital_certificate_password: form.digital_certificate_password || null,
      partners_info: form.partners_info || null,
      company_description: form.company_description || null, business_segment: form.business_segment || null,
      foundation_date: form.foundation_date || null, success_notes: form.success_notes || null,
      opening_date: form.opening_date || null, from_another_office: form.from_another_office,
      previous_office_name: form.previous_office_name || null, exit_reason: form.exit_reason || null,
      destination_office_name: form.destination_office_name || null, exit_reason_notes: form.exit_reason_notes || null,
      business_classification: form.business_classification || null,
      trade_name: form.trade_name || null,
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

    // Sync obligation selections
    if (clientId && selectedObligations.size > 0) {
      await (supabase as any).from('client_department_obligations').delete().eq('client_id', clientId);
      const oblRows = Array.from(selectedObligations).map(oblId => {
        const obl = allObligations.find(o => o.id === oblId);
        return {
          client_id: clientId,
          department_id: obl?.department_id,
          obligation_id: oblId,
        };
      }).filter(r => r.department_id);
      if (oblRows.length > 0) {
        const { error: oblError } = await (supabase as any)
          .from('client_department_obligations')
          .insert(oblRows);
        if (oblError) {
          toast({ title: 'Erro ao salvar obrigações', description: oblError.message, variant: 'destructive' });
        }
      }
    } else if (clientId && selectedObligations.size === 0 && editing) {
      await (supabase as any).from('client_department_obligations').delete().eq('client_id', clientId);
    }

    if (clientId && pendingCertFile) {
      try {
        const filePath = `${clientId}/${pendingCertFile.name}`;
        const { error: uploadError } = await supabase.storage.from('certificates').upload(filePath, pendingCertFile, { upsert: true });
        if (!uploadError) {
          await supabase.from('clients').update({ digital_certificate_url: filePath } as any).eq('id', clientId);
        }
      } catch {}
      setPendingCertFile(null);
    }

    setDialogOpen(false);
    loadClients();
    toast({ title: editing ? 'Cliente atualizado' : 'Cliente criado' });
  }

  const f = (field: keyof typeof form) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field]: e.target.value }),
    disabled: viewOnly,
  });

  const filtered = clients.filter(c => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const activeCount = clients.filter(c => c.status === 'active').length;
  const churnedCount = clients.filter(c => c.status === 'churned').length;
  const mrr = clients.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const churnRate = clients.length > 0 ? (churnedCount / clients.length) * 100 : 0;

  const isAdmin_ = isAdmin;

  function renderDeptObligations(deptNameFragment: string) {
    const dept = departments.find(d => d.name.toLowerCase().includes(deptNameFragment.toLowerCase()));
    if (!dept) return null;
    const obls = allObligations.filter(o => o.department_id === dept.id);
    if (obls.length === 0) return null;
    return (
      <div className="space-y-2 border-t border-border pt-4 mt-2">
        <Label className="text-base font-semibold">Obrigações</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {obls.map(obl => (
            <div key={obl.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedObligations.has(obl.id)}
                disabled={viewOnly}
                onCheckedChange={(checked) => {
                  setSelectedObligations(prev => {
                    const next = new Set(prev);
                    if (checked) next.add(obl.id);
                    else next.delete(obl.id);
                    return next;
                  });
                }}
              />
              <span className="text-sm">{obl.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        {isAdmin_ && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Importar Certificados
            </Button>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
          </div>
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

      {/* Desktop Table */}
      <Card className="hidden md:block">
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
              {paginatedClients.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.sci_code || '-'}</TableCell>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.document || '-'}</TableCell>
                  <TableCell>{c.contact_name || '-'}</TableCell>
                  <TableCell>R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openView(c)} title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin_ && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {paginatedClients.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{c.company_name}</p>
                  <p className="text-sm text-muted-foreground">{c.document || 'Sem documento'}</p>
                  <p className="text-sm text-muted-foreground">R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(c)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isAdmin_ && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</p>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} · Página {safePage} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
              Próximo<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.company_name}</strong>? Esta ação não pode ser desfeita. Todos os contatos por departamento e certificados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewOnly ? 'Detalhes do Cliente' : editing ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={viewOnly ? (e) => e.preventDefault() : handleSave}>
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className={`grid w-full mb-4 ${editing ? 'grid-cols-8' : 'grid-cols-6'}`}>
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
                <TabsTrigger value="societario">Societário</TabsTrigger>
                <TabsTrigger value="sucesso">Sucesso</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
                {editing && <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>}
                {editing && <TabsTrigger value="contrato">Contrato</TabsTrigger>}
              </TabsList>

              {/* ── Geral ── */}
              <TabsContent value="geral" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Código SCI</Label><Input {...f('sci_code')} placeholder="Código no SCI Sistemas" /></div>
                  <div className="col-span-2 space-y-2"><Label>Razão Social *</Label><Input {...f('company_name')} required /></div>
                  <div className="col-span-2 space-y-2"><Label>Nome Fantasia</Label><Input {...f('trade_name')} placeholder="Nome fantasia da empresa" /></div>
                  <div className="space-y-2">
                    <Label>CNPJ/CPF</Label>
                    <div className="flex gap-2">
                      <Input value={form.document} onChange={handleDocumentChange} placeholder="00.000.000/0000-00" disabled={viewOnly} />
                      {!viewOnly && (
                        <Button type="button" variant="outline" size="icon" onClick={fetchCnpjData} disabled={cnpjLoading} title="Buscar dados pelo CNPJ">
                          {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Contato</Label><Input {...f('contact_name')} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" {...f('contact_email')} /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input {...f('contact_phone')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Endereço</Label><Input {...f('address')} /></div>
                  <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" {...f('monthly_value')} /></div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })} disabled={viewOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                <h4 className="text-sm font-semibold text-muted-foreground">Datas</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Data de Abertura</Label><Input type="date" {...f('opening_date')} /></div>
                  <div className="space-y-2"><Label>Data Início</Label><Input type="date" {...f('start_date')} /></div>
                  <div className="space-y-2"><Label>Data Saída</Label><Input type="date" {...f('end_date')} /></div>
                </div>

                {form.end_date && (
                  <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4">
                    <div className="col-span-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Motivo da Saída</h4>
                    </div>
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Select value={form.exit_reason} onValueChange={v => setForm({ ...form, exit_reason: v })} disabled={viewOnly}>
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
                          <Input value={form.destination_office_name} onChange={e => setForm({ ...form, destination_office_name: e.target.value })} placeholder="Nome do escritório de destino" disabled={viewOnly} />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Motivo da Troca</Label>
                          <Textarea value={form.exit_reason_notes} onChange={e => setForm({ ...form, exit_reason_notes: e.target.value })} placeholder="Descreva o motivo da troca de escritório" disabled={viewOnly} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <Separator />
                <h4 className="text-sm font-semibold text-muted-foreground">Origem</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-3">
                    <Checkbox
                      checked={form.from_another_office}
                      onCheckedChange={(checked) => setForm({ ...form, from_another_office: !!checked, previous_office_name: checked ? form.previous_office_name : '' })}
                      disabled={viewOnly}
                    />
                    <Label>Veio de outro escritório?</Label>
                  </div>
                  {form.from_another_office && (
                    <div className="col-span-2 space-y-2">
                      <Label>Nome do Escritório Anterior</Label>
                      <Input value={form.previous_office_name} onChange={e => setForm({ ...form, previous_office_name: e.target.value })} placeholder="Nome do escritório anterior" disabled={viewOnly} />
                    </div>
                  )}
                </div>

                <Separator />
                <div className="space-y-2"><Label>Observações</Label><Textarea {...f('notes')} /></div>
              </TabsContent>

              {/* ── Fiscal ── */}
              <TabsContent value="fiscal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select value={form.tax_regime} onValueChange={v => setForm({ ...form, tax_regime: v })} disabled={viewOnly}>
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
                    <Label className="flex items-center gap-2">
                      Segmento
                      {classifyingSegment && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </Label>
                    <Select value={form.business_classification} onValueChange={v => setForm({ ...form, business_classification: v })} disabled={viewOnly || classifyingSegment}>
                      <SelectTrigger><SelectValue placeholder={classifyingSegment ? "Classificando..." : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Comércio">Comércio</SelectItem>
                        <SelectItem value="Serviço">Serviço</SelectItem>
                        <SelectItem value="Indústria">Indústria</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Atividade Principal (CNAE)</Label>
                    <CnaeCombobox value={form.main_activity} onChange={v => {
                      setForm(prev => ({ ...prev, main_activity: v, business_classification: '' }));
                      setClassifyingSegment(true);
                      classifyByAI(v, form.secondary_activities).then(c => {
                        setForm(prev => ({ ...prev, business_classification: c }));
                        setClassifyingSegment(false);
                      });
                    }} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Atividades Secundárias</Label>
                    <CnaeMultiSelect value={form.secondary_activities} onChange={v => {
                      setForm(prev => ({ ...prev, secondary_activities: v, business_classification: '' }));
                      setClassifyingSegment(true);
                      classifyByAI(form.main_activity, v).then(c => {
                        setForm(prev => ({ ...prev, business_classification: c }));
                        setClassifyingSegment(false);
                      });
                    }} />
                  </div>
                  <div className="space-y-2"><Label>Inscrição Estadual</Label><Input {...f('state_registration')} /></div>
                  <div className="space-y-2"><Label>Inscrição Municipal</Label><Input {...f('municipal_registration')} /></div>
                </div>
                {renderDeptObligations('fiscal')}
              </TabsContent>

              {/* ── Pessoal ── */}
              <TabsContent value="pessoal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Tipo de Folha</Label>
                    <Select value={form.payroll_type} onValueChange={v => setForm({ ...form, payroll_type: v })} disabled={viewOnly}>
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
                {renderDeptObligations('pessoal')}
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
                          disabled={viewOnly}
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
                              disabled={viewOnly}
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
                    <Select value={form.digital_certificate_type} onValueChange={v => setForm({ ...form, digital_certificate_type: v })} disabled={viewOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="A3">A3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Senha do Certificado</Label><Input type="password" value={form.digital_certificate_password} onChange={e => setForm({ ...form, digital_certificate_password: e.target.value })} placeholder="Informe a senha do certificado" disabled={viewOnly} /></div>
                  <div className="space-y-2"><Label>Vencimento Certificado</Label><Input type="date" value={form.digital_certificate_expiry} readOnly className="bg-muted/50" /></div>
                  {!viewOnly && (
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
                            disabled={certificateUploading}
                          />
                          {certificateUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                      )}
                      {!editing && pendingCertFile && <p className="text-xs text-muted-foreground">Certificado será salvo ao criar o cliente.</p>}
                    </div>
                  )}
                  {viewOnly && certificateUrl && (
                    <div className="col-span-2 space-y-2">
                      <Label>Arquivo do Certificado</Label>
                      <div className="flex items-center gap-2 p-3 rounded-md border border-input bg-muted/50">
                        <FileCheck className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">{certificateUrl.split('/').pop()}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={handleCertificateDownload}><Download className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                  <div className="col-span-2 space-y-2"><Label>Informações dos Sócios</Label><Textarea {...f('partners_info')} /></div>
                </div>
                {renderDeptObligations('societár')}
              </TabsContent>

              {/* ── Sucesso do Cliente ── */}
              <TabsContent value="sucesso" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Descrição da Empresa</Label><Textarea {...f('company_description')} /></div>
                  <div className="space-y-2"><Label>Segmento de Atuação</Label><Input {...f('business_segment')} /></div>
                  <div className="space-y-2"><Label>Data de Fundação</Label><Input type="date" {...f('foundation_date')} /></div>
                  <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea {...f('success_notes')} /></div>
                </div>
                {renderDeptObligations('sucesso')}
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
                            disabled={viewOnly}
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
                            disabled={viewOnly}
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
                            disabled={viewOnly}
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

              {/* ── Obrigações ── */}
              {editing && (
                <TabsContent value="obrigacoes">
                  <ClientObligationsTab clientId={editing.id} />
                </TabsContent>
              )}

              {/* ── Contrato ── */}
              {editing && (
                <TabsContent value="contrato">
                  <ContractTab
                    companyName={form.company_name}
                    document={form.document}
                    address={form.address}
                    contactName={form.contact_name}
                    partnersInfo={form.partners_info}
                    monthlyValue={form.monthly_value}
                  />
                </TabsContent>
              )}
            </Tabs>

            {!viewOnly && (
              <Button type="submit" className="w-full mt-4">{editing ? 'Salvar' : 'Criar'}</Button>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <CertificateImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={loadClients}
        existingDocuments={clients.map(c => c.document || '').filter(Boolean)}
      />
    </div>
  );
}
