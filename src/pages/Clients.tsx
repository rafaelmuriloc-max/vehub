import React, { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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

import { Plus, Search, Loader2, Upload, Download, Trash2, FileCheck, Eye, Pencil, ChevronLeft, ChevronRight, RefreshCw, ShieldCheck, ShieldAlert, Building2, Briefcase, FileText, Save, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { CnaeCombobox } from '@/components/CnaeCombobox';
import { CnaeMultiSelect } from '@/components/CnaeMultiSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import ContractTab from '@/components/ContractTab';
import ClientObligationsTab from '@/components/ClientObligationsTab';
import CertificateImportDialog from '@/components/CertificateImportDialog';
import { formatClientLabel } from '@/lib/utils';

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

function normalizeClassification(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('comércio') || lower.includes('comercio')) return 'Comércio';
  if (lower.includes('serviço') || lower.includes('servico') || lower.includes('serviços') || lower.includes('servicos')) return 'Serviço';
  if (lower.includes('indústria') || lower.includes('industria')) return 'Indústria';
  if (lower.includes('misto')) return 'Misto';
  return raw.trim();
}

function classificationToSegment(classification: string): string {
  const normalized = normalizeClassification(classification);
  switch (normalized) {
    case 'Comércio': return 'Comércio';
    case 'Serviço': return 'Serviços';
    case 'Indústria': return 'Indústria';
    case 'Misto': return 'Misto';
    default: return normalized;
  }
}

async function classifyByAI(mainCnae: string, secondaryCnaes: string): Promise<string> {
  if (!mainCnae && !secondaryCnaes) return '';
  try {
    const { data, error } = await supabase.functions.invoke('classify-segment', {
      body: { main_activity: mainCnae, secondary_activities: secondaryCnaes },
    });
    if (error) throw error;
    const raw = data?.classification || '';
    return raw ? normalizeClassification(raw) : '';
  } catch (e) {
    console.error('AI classification error:', e);
    return '';
  }
}

async function classifyAnexoByAI(mainCnae: string): Promise<string> {
  if (!mainCnae) return '';
  try {
    const { data, error } = await supabase.functions.invoke('classify-segment', {
      body: { classify_anexo: true, main_activity: mainCnae },
    });
    if (error) throw error;
    return data?.anexo || '';
  } catch (e) {
    console.error('AI anexo classification error:', e);
    return '';
  }
}

const TAX_REGIME_LABELS: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
};

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
  simples_anexo: string | null;
  services_suspended?: boolean;
  services_suspended_at?: string | null;
  without_monthly_fee?: boolean;
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
  simples_anexo: '',
  services_suspended: false as boolean,
  without_monthly_fee: false as boolean,
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
  const [classifyingAnexo, setClassifyingAnexo] = useState(false);
  const [permits, setPermits] = useState<PermitItem[]>(defaultPermits.map(p => ({ ...p })));
  const [certificateUploading, setCertificateUploading] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptContacts, setDeptContacts] = useState<Record<string, DeptContact[]>>({});
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [allObligations, setAllObligations] = useState<ObligationOption[]>([]);
  const [selectedObligations, setSelectedObligations] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [societyDocs, setSocietyDocs] = useState<{ id: string; document_label: string; file_name: string; file_url: string }[]>([]);
  const [societyUploading, setSocietyUploading] = useState<Record<string, boolean>>({});
   const [certMonth, setCertMonth] = useState(() => new Date());
   const [certResponsible, setCertResponsible] = useState({ name: '', phone: '', groupId: '' });
   const [certResponsibleLoaded, setCertResponsibleLoaded] = useState(false);
   const [whatsappGroups, setWhatsappGroups] = useState<{ id: string; name: string }[]>([]);
   const [loadingGroups, setLoadingGroups] = useState(false);
   const [ieLookupLoading, setIeLookupLoading] = useState(false);

   useEffect(() => {
     (async () => {
       const { data } = await supabase.from('company_settings').select('cert_responsible_name, cert_responsible_phone, cert_whatsapp_group_id').limit(1).maybeSingle();
       if (data) {
         setCertResponsible({ name: (data as any).cert_responsible_name || '', phone: (data as any).cert_responsible_phone || '', groupId: (data as any).cert_whatsapp_group_id || '' });
       }
       setCertResponsibleLoaded(true);
     })();
   }, []);

   const fetchWhatsappGroups = async () => {
     setLoadingGroups(true);
     try {
       const { data, error } = await supabase.functions.invoke('evolution-list-groups');
       if (error) throw error;
       setWhatsappGroups(data || []);
     } catch (e) {
       console.error('Error fetching groups:', e);
       toast({ title: 'Erro ao buscar grupos', variant: 'destructive' });
     } finally {
       setLoadingGroups(false);
     }
   };

   const saveCertResponsible = async () => {
     const { data: existing } = await supabase.from('company_settings').select('id').limit(1).maybeSingle();
     if (existing) {
       await supabase.from('company_settings').update({ cert_responsible_name: certResponsible.name || null, cert_responsible_phone: certResponsible.phone || null, cert_whatsapp_group_id: certResponsible.groupId || null } as any).eq('id', existing.id);
     }
     toast({ title: 'Responsável salvo com sucesso' });
   };

  const certMonthData = useMemo(() => {
    const year = certMonth.getFullYear();
    const month = certMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const byExpiry = (a: Client, b: Client) =>
      new Date(a.digital_certificate_expiry! + 'T00:00:00').getTime() - new Date(b.digital_certificate_expiry! + 'T00:00:00').getTime();

    const withCert = clients.filter(c => !!c.digital_certificate_expiry && c.status === 'active' && !c.end_date);

    // Todos os vencidos, de qualquer mês
    const expiredList = withCert
      .filter(c => new Date(c.digital_certificate_expiry! + 'T00:00:00') < now)
      .sort(byExpiry);

    // Vencimentos do mês navegado que ainda não venceram
    const monthList = withCert
      .filter(c => {
        const exp = new Date(c.digital_certificate_expiry! + 'T00:00:00');
        return exp >= now && exp >= monthStart && exp <= monthEnd;
      })
      .sort(byExpiry);

    const soon = monthList.filter(c => new Date(c.digital_certificate_expiry! + 'T00:00:00') <= in15).length;

    return {
      clients: [...expiredList, ...monthList],
      expiredList,
      monthList,
      total: expiredList.length + monthList.length,
      expired: expiredList.length,
      soon,
    };
  }, [clients, certMonth]);


  const certMonthLabel = useMemo(() => {
    return certMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, l => l.toUpperCase());
  }, [certMonth]);

  async function loadSocietyDocs(clientId: string) {
    const { data } = await supabase.from('client_society_documents' as any).select('id, document_label, file_name, file_url').eq('client_id', clientId);
    setSocietyDocs((data as any[]) || []);
  }

  async function handleSocietyUpload(label: string, file: File) {
    if (!editing) return;
    setSocietyUploading(prev => ({ ...prev, [label]: true }));
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${editing.id}/societario/${label}/${safeName}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('client_society_documents' as any).insert({ client_id: editing.id, document_label: label, file_name: file.name, file_url: path, uploaded_by: user?.id } as any);
      if (dbErr) throw dbErr;
      await loadSocietyDocs(editing.id);
      toast({ title: 'Documento enviado com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar documento', description: err.message, variant: 'destructive' });
    } finally {
      setSocietyUploading(prev => ({ ...prev, [label]: false }));
    }
  }

  async function handleSocietyDownload(fileUrl: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function handleSocietyDelete(docId: string, fileUrl: string) {
    await supabase.storage.from('documents').remove([fileUrl]);
    await supabase.from('client_society_documents' as any).delete().eq('id', docId);
    if (editing) await loadSocietyDocs(editing.id);
    toast({ title: 'Documento removido' });
  }

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
    const contacts: Record<string, DeptContact[]> = {};
    for (const dep of deps) {
      const rows = (data || [])
        .filter((d: any) => d.department_id === dep.id)
        .map((d: any) => ({
          contact_name: d.contact_name || '',
          contact_phone: d.contact_phone || '',
          contact_email: d.contact_email || '',
        }));
      contacts[dep.id] = rows.length > 0 ? rows : [{ contact_name: '', contact_phone: '', contact_email: '' }];
    }
    setDeptContacts(contacts);
  }

  function initEmptyDeptContacts(deps: Department[]) {
    const contacts: Record<string, DeptContact[]> = {};
    for (const dep of deps) {
      contacts[dep.id] = [{ contact_name: '', contact_phone: '', contact_email: '' }];
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
      const { data, error: fnError } = await supabase.functions.invoke('cnpj-lookup', { body: { cnpj: digits } });
      if (fnError || !data || data.error) throw new Error(data?.error || 'CNPJ não encontrado');

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
        setForm(prev => ({ ...prev, business_classification: c, business_segment: c ? classificationToSegment(c) : prev.business_segment }));
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

  // Auto-classify segments and backfill business_segment
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const CLASSIFY_KEY = `batch_classify_done_${today}`;
    if (localStorage.getItem(CLASSIFY_KEY)) return;

    async function autoClassifyAndBackfill() {
      // Step 1: Backfill business_segment for clients that have classification but no segment
      const { data: needsSegment } = await supabase
        .from('clients')
        .select('id, business_classification, business_segment');

      const toBackfill = (needsSegment || []).filter(
        (c: any) => c.business_classification && c.business_classification.trim() &&
          (!c.business_segment || !c.business_segment.trim())
      );

      if (toBackfill.length > 0) {
        for (const c of toBackfill) {
          const normalized = normalizeClassification((c as any).business_classification);
          const segment = classificationToSegment(normalized);
          await supabase.from('clients').update({
            business_classification: normalized,
            business_segment: segment,
          }).eq('id', (c as any).id);
        }
        console.log(`[backfill-segment] Updated ${toBackfill.length} clients`);
      }

      // Step 2: Also normalize existing classifications with inconsistent casing
      const toNormalize = (needsSegment || []).filter(
        (c: any) => c.business_classification && c.business_classification.trim() &&
          c.business_classification !== normalizeClassification(c.business_classification)
      );
      for (const c of toNormalize) {
        const normalized = normalizeClassification((c as any).business_classification);
        await supabase.from('clients').update({
          business_classification: normalized,
          business_segment: classificationToSegment(normalized),
        }).eq('id', (c as any).id);
      }

      // Step 3: AI-classify clients missing business_classification entirely
      const { data: unclassified } = await supabase
        .from('clients')
        .select('id, main_activity, secondary_activities, business_classification');

      const toClassify = (unclassified || []).filter(
        (c: any) => (c.main_activity || c.secondary_activities) &&
          (!c.business_classification || !c.business_classification.trim())
      );

      if (toClassify.length === 0) {
        localStorage.setItem(CLASSIFY_KEY, 'true');
        if (toBackfill.length > 0 || toNormalize.length > 0) loadClients();
        return;
      }

      setClassifyingAll(true);
      setClassifyProgress({ current: 0, total: toClassify.length });
      let classified = 0;

      for (let i = 0; i < toClassify.length; i++) {
        const c = toClassify[i] as any;
        setClassifyProgress({ current: i + 1, total: toClassify.length });
        try {
          const result = await classifyByAI(c.main_activity || '', c.secondary_activities || '');
          if (result) {
            await supabase.from('clients').update({
              business_classification: result,
              business_segment: classificationToSegment(result),
            }).eq('id', c.id);
            classified++;
          }
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 500));
      }

      setClassifyingAll(false);
      setClassifyProgress({ current: 0, total: 0 });

      if (classified === toClassify.length) {
        localStorage.setItem(CLASSIFY_KEY, 'true');
      }

      if (classified > 0 || toBackfill.length > 0 || toNormalize.length > 0) {
        loadClients();
        toast({
          title: 'Classificação concluída',
          description: `${classified} classificado(s), ${toBackfill.length} segmento(s) preenchido(s).`,
        });
      }
    }

    autoClassifyAndBackfill();
  }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name');
    setClients((data as unknown as Client[]) || []);
  }

  async function batchUpdateAllCnpj() {
    setBatchUpdating(true);
    let updated = 0;
    let errors = 0;

    const { data: allClients } = await supabase.from('clients').select('*');
    const cnpjClients = ((allClients || []) as unknown as Client[]).filter(
      c => c.document && c.document.replace(/\D/g, '').length === 14
    );
    setBatchProgress({ current: 0, total: cnpjClients.length });

    for (let i = 0; i < cnpjClients.length; i++) {
      const client = cnpjClients[i];
      const cnpj = client.document!.replace(/\D/g, '');
      setBatchProgress({ current: i + 1, total: cnpjClients.length });

      try {
        const { data, error: fnError } = await supabase.functions.invoke('cnpj-lookup', { body: { cnpj } });
        if (fnError || !data || data.error) { errors++; continue; }

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

        let classification = client.business_classification || '';
        if (!classification && (cnaePrincipal || secondaryCnaes)) {
          try {
            classification = await classifyByAI(cnaePrincipal, secondaryCnaes);
          } catch { /* keep empty */ }
        }

        const updatePayload: any = {
          company_name: data.razao_social || client.company_name,
          address: address || client.address,
          contact_phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0,2)}) ${data.ddd_telefone_1.substring(2)}` : client.contact_phone,
          contact_email: data.email || client.contact_email,
          main_activity: cnaePrincipal || client.main_activity,
          secondary_activities: secondaryCnaes || client.secondary_activities,
          tax_regime: taxRegime,
          partners_info: partners || client.partners_info,
          foundation_date: data.data_inicio_atividade || client.foundation_date,
          opening_date: data.data_inicio_atividade || client.opening_date,
          business_segment: data.cnae_fiscal_descricao || client.business_segment,
          trade_name: data.nome_fantasia || client.trade_name,
        };

        if (classification) {
          updatePayload.business_classification = classification;
          updatePayload.business_segment = classificationToSegment(classification);
        }

        await supabase.from('clients').update(updatePayload).eq('id', client.id);
        updated++;
      } catch {
        errors++;
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    setBatchUpdating(false);
    setBatchProgress({ current: 0, total: 0 });
    loadClients();
    toast({
      title: 'Atualização concluída',
      description: `${updated} atualizado(s), ${errors} erro(s) de ${cnpjClients.length} clientes.`,
    });
  }



  async function openNew() {
    setEditing(null);
    setViewOnly(false);
    setForm({ ...emptyForm, start_date: new Date().toISOString().split('T')[0] });
    setPermits(defaultPermits.map(p => ({ ...p })));
    setCertificateUrl(null);
    setSocietyDocs([]);
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
    const [deps] = await Promise.all([loadDepartments(), loadObligations(), loadClientObligations(c.id), loadSocietyDocs(c.id)]);
    await loadDeptContacts(c.id, deps);
    setDialogOpen(true);
  }

  async function openView(c: Client) {
    setEditing(c);
    setViewOnly(true);
    populateForm(c);
    setPermits(parsePermits(c.permits));
    setCertificateUrl(c.digital_certificate_url || null);
    const [deps] = await Promise.all([loadDepartments(), loadObligations(), loadClientObligations(c.id), loadSocietyDocs(c.id)]);
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
      simples_anexo: (c as any).simples_anexo || '',
      services_suspended: !!(c as any).services_suspended,
      without_monthly_fee: !!(c as any).without_monthly_fee,
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

      toast({ title: 'Cliente excluído', description: `${formatClientLabel(deleteTarget)} foi removido.` });
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
      simples_anexo: form.tax_regime === 'simples_nacional' ? (form.simples_anexo || null) : null,
      services_suspended: !!form.services_suspended,
      services_suspended_at: form.services_suspended
        ? ((editing as any)?.services_suspended_at || new Date().toISOString())
        : null,
      without_monthly_fee: !!form.without_monthly_fee,
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

    if (clientId) {
      // Replace all department contacts for this client
      await (supabase as any).from('client_department_contacts').delete().eq('client_id', clientId);
      const contactRows = Object.entries(deptContacts).flatMap(([depId, list]) =>
        (list || [])
          .filter(c => c.contact_name || c.contact_phone || c.contact_email)
          .map(c => ({
            client_id: clientId,
            department_id: depId,
            contact_name: c.contact_name || null,
            contact_phone: c.contact_phone || null,
            contact_email: c.contact_email || null,
          }))
      );
      if (contactRows.length > 0) {
        const { error: contactError } = await (supabase as any)
          .from('client_department_contacts')
          .insert(contactRows);
        if (contactError) {
          toast({ title: 'Erro ao salvar contatos', description: contactError.message, variant: 'destructive' });
        }
      }
    }

    // Sync obligation selections (diff-based: só remove o que foi desmarcado)
    if (clientId) {
      const { data: existingLinks } = await (supabase as any)
        .from('client_department_obligations')
        .select('obligation_id')
        .eq('client_id', clientId);
      const currentIds = new Set<string>(((existingLinks || []) as any[]).map(r => r.obligation_id));
      const desiredIds = new Set<string>(Array.from(selectedObligations));

      const toRemove = Array.from(currentIds).filter(id => !desiredIds.has(id));
      const toAdd = Array.from(desiredIds).filter(id => !currentIds.has(id));

      if (toRemove.length > 0) {
        await (supabase as any)
          .from('client_department_obligations')
          .delete()
          .eq('client_id', clientId)
          .in('obligation_id', toRemove);
      }

      if (toAdd.length > 0) {
        const oblRows = toAdd.map(oblId => {
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
      }
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
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search) || c.sci_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'suspended' ? !!c.services_suspended : c.status === filterStatus);
    return matchSearch && matchStatus;
  });

  // Sorting
  const getSortValue = (c: Client, key: string): { v: number | string; empty: boolean } => {
    switch (key) {
      case 'sci_code': {
        const raw = (c.sci_code || '').trim();
        if (!raw) return { v: Infinity, empty: true };
        const n = Number(raw);
        return Number.isFinite(n) ? { v: n, empty: false } : { v: Infinity, empty: false };
      }
      case 'company_name': return { v: formatClientLabel(c).toLowerCase(), empty: !c.company_name };
      case 'document': return { v: (c.document || '').toLowerCase(), empty: !c.document };
      case 'tax_regime': return { v: (TAX_REGIME_LABELS[c.tax_regime as string] || c.tax_regime || '').toLowerCase(), empty: !c.tax_regime };
      case 'contact_name': return { v: (c.contact_name || '').toLowerCase(), empty: !c.contact_name };
      case 'monthly_value': return { v: Number(c.monthly_value || 0), empty: c.monthly_value == null };
      case 'status': return { v: (statusLabels[c.status] || '').toLowerCase(), empty: !c.status };
      case 'digital_certificate_expiry': {
        if (!c.digital_certificate_expiry) return { v: Infinity, empty: true };
        return { v: new Date(c.digital_certificate_expiry + 'T00:00:00').getTime(), empty: false };
      }
      default: return { v: '', empty: true };
    }
  };
  const sorted = (sortKey && sortDir) ? [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    if (av.empty && bv.empty) return 0;
    if (av.empty) return 1;
    if (bv.empty) return -1;
    let cmp = 0;
    if (typeof av.v === 'number' && typeof bv.v === 'number') cmp = av.v - bv.v;
    else cmp = String(av.v).localeCompare(String(bv.v), 'pt-BR');
    return sortDir === 'asc' ? cmp : -cmp;
  }) : filtered;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    if (sortDir === 'desc') { setSortKey(null); setSortDir(null); return; }
    setSortDir('asc');
  };
  const SortableHead = ({ column, label }: { column: string; label: string }) => {
    const active = sortKey === column;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${active ? 'text-foreground' : 'text-muted-foreground/60'}`} />
        </button>
      </TableHead>
    );
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const payingClients = clients.filter(c => !(c as any).without_monthly_fee);
  const activeCount = payingClients.filter(c => c.status === 'active').length;
  const suspendedCount = payingClients.filter(c => c.status === 'active' && (c as any).services_suspended).length;
  const churnedCount = payingClients.filter(c => c.status === 'churned').length;
  const mrr = payingClients.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_value || 0), 0);
  const arr = mrr * 12;
  const churnRate = payingClients.length > 0 ? (churnedCount / payingClients.length) * 100 : 0;

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
            <Button variant="outline" onClick={batchUpdateAllCnpj} disabled={batchUpdating || classifyingAll}>
              {batchUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {batchUpdating ? `Atualizando ${batchProgress.current}/${batchProgress.total}` : 'Atualizar Cadastros'}
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Importar Certificados
            </Button>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
          </div>
        )}
      </div>
      {batchUpdating && (
        <Progress value={(batchProgress.current / Math.max(batchProgress.total, 1)) * 100} className="h-2" />
      )}
      {classifyingAll && (
        <Progress value={(classifyProgress.current / Math.max(classifyProgress.total, 1)) * 100} className="h-2" />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{activeCount}</p><p className="text-xs text-muted-foreground mt-1">{suspendedCount} suspensos</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">MRR / ARR</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-1">ARR R$ {arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Churn Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">{churnRate.toFixed(1)}%</p></CardContent></Card>
      </div>

      {/* Charts */}
      {(() => {
        const CHART_COLORS = [
          'hsl(220, 50%, 25%)',
          'hsl(28, 82%, 53%)',
          'hsl(220, 40%, 45%)',
          'hsl(28, 70%, 70%)',
          'hsl(220, 30%, 60%)',
          'hsl(160, 50%, 45%)',
          'hsl(280, 40%, 55%)',
          'hsl(45, 70%, 55%)',
        ];
        const taxRegimeLabels: Record<string, string> = {
          simples_nacional: 'Simples Nacional',
          lucro_presumido: 'Lucro Presumido',
          lucro_real: 'Lucro Real',
          mei: 'MEI',
        };
        const taxData = Object.entries(
          payingClients.filter(c => c.status === 'active').reduce((acc, c) => {
            const key = c.tax_regime || 'Não informado';
            const label = taxRegimeLabels[key] || key;
            acc[label] = (acc[label] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

        const segmentData = Object.entries(
          payingClients.filter(c => c.status === 'active').reduce((acc, c) => {
            const key = c.business_classification || 'Não informado';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

        const taxTotal = taxData.reduce((s, d) => s + d.value, 0);
        const segTotal = segmentData.reduce((s, d) => s + d.value, 0);

        const CustomTooltip = ({ active, payload }: any) => {
          if (!active || !payload?.length) return null;
          const d = payload[0];
          const total = d.payload?.total || 1;
          return (
            <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg">
              <p className="text-sm font-medium text-popover-foreground">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.value} clientes · {((d.value / total) * 100).toFixed(1)}%</p>
            </div>
          );
        };

        const renderLegend = (data: { name: string; value: number }[], total: number) => (
          <div className="flex flex-col gap-2 justify-center">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-foreground truncate">{d.name}</span>
                <span className="ml-auto text-muted-foreground font-medium tabular-nums">{d.value}</span>
                <span className="text-muted-foreground text-xs w-10 text-right">({((d.value / total) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        );

        const renderDonut = (data: { name: string; value: number }[], total: number, label: string) => (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.map(d => ({ ...d, total }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                cornerRadius={4}
                isAnimationActive
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">{total}</text>
              <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">{label}</text>
            </PieChart>
          </ResponsiveContainer>
        );

        // Cross data: regime × segment
        const crossData: Record<string, Record<string, number>> = {};
        const allSegments = new Set<string>();
        const cellData: Record<string, Record<string, { count: number; mrr: number; paying: number }>> = {};
        clients.filter(c => c.status === 'active' && !(c as any).without_monthly_fee).forEach(c => {
          const regime = taxRegimeLabels[c.tax_regime || ''] || c.tax_regime || 'Não informado';
          const seg = c.business_classification || 'Não informado';
          allSegments.add(seg);
          if (!crossData[regime]) crossData[regime] = {};
          crossData[regime][seg] = (crossData[regime][seg] || 0) + 1;
          if (!cellData[regime]) cellData[regime] = {};
          if (!cellData[regime][seg]) cellData[regime][seg] = { count: 0, mrr: 0, paying: 0 };
          const cell = cellData[regime][seg];
          cell.count += 1;
          cell.mrr += Number(c.monthly_value || 0);
          cell.paying += 1;
        });
        const segmentList = Array.from(allSegments).sort();
        const rawStackedData = Object.entries(crossData).map(([regime, segs]) => ({
          regime,
          ...segs,
          total: Object.values(segs).reduce((s, v) => s + v, 0),
        })).sort((a, b) => b.total - a.total);

        // Normalize to percentages for proportional view
        const stackedData = rawStackedData.map(row => {
          const pctRow: Record<string, any> = { regime: row.regime, total: row.total };
          segmentList.forEach(seg => {
            const raw = (row as any)[seg] || 0;
            pctRow[seg] = row.total > 0 ? Math.round((raw / row.total) * 100) : 0;
            pctRow[`${seg}_abs`] = raw;
          });
          return pctRow;
        });

        const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const getCell = (regime: string, seg: string) => cellData[regime]?.[seg] || { count: 0, mrr: 0, paying: 0 };
        const rowTotals = (regime: string) => {
          let count = 0, mrr = 0, paying = 0;
          segmentList.forEach(seg => {
            const c = getCell(regime, seg);
            count += c.count; mrr += c.mrr; paying += c.paying;
          });
          return { count, mrr, paying, ticket: paying > 0 ? mrr / paying : 0 };
        };
        const segTotals = (seg: string) => {
          let count = 0, mrr = 0, paying = 0;
          rawStackedData.forEach((r: any) => {
            const c = getCell(r.regime, seg);
            count += c.count; mrr += c.mrr; paying += c.paying;
          });
          return { count, mrr, paying, ticket: paying > 0 ? mrr / paying : 0 };
        };
        const grandTotals = () => {
          let count = 0, mrr = 0, paying = 0;
          rawStackedData.forEach((r: any) => {
            segmentList.forEach(seg => {
              const c = getCell(r.regime, seg);
              count += c.count; mrr += c.mrr; paying += c.paying;
            });
          });
          return { count, mrr, paying, ticket: paying > 0 ? mrr / paying : 0 };
        };

        const StackedTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          const entry = stackedData.find((d: any) => d.regime === label);
          const total = entry?.total || 0;
          return (
            <div className="rounded-xl border bg-popover px-4 py-3 shadow-xl min-w-[200px]">
              <p className="text-sm font-semibold text-popover-foreground mb-2">{label}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{total} clientes</p>
              {payload.filter((p: any) => p.value > 0).map((p: any, i: number) => {
                const absVal = entry?.[`${p.dataKey}_abs`] || 0;
                return (
                  <div key={i} className="mb-1.5">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
                        <span className="text-muted-foreground">{p.dataKey}</span>
                      </div>
                      <span className="font-medium text-popover-foreground">{absVal} ({p.value}%)</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p.value}%`, backgroundColor: p.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Regime Tributário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="lg:w-[55%]">{renderDonut(taxData, taxTotal, 'clientes')}</div>
                    <div className="lg:w-[45%]">{renderLegend(taxData, taxTotal)}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Segmento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="lg:w-[55%]">{renderDonut(segmentData, segTotal, 'clientes')}</div>
                    <div className="lg:w-[45%]">{renderLegend(segmentData, segTotal)}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {stackedData.length > 0 && (
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Regime Tributário × Segmento
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground/60">Quantidade, ticket médio e MRR por segmento</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <Table className="min-w-[860px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className="text-left text-xs align-bottom">Regime</TableHead>
                          {segmentList.map((seg, i) => (
                            <TableHead key={seg} colSpan={3} className="text-center text-xs border-l">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                {seg}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead colSpan={3} className="text-center text-xs font-semibold border-l">Total</TableHead>
                        </TableRow>
                        <TableRow>
                          {segmentList.flatMap((seg) => [
                            <TableHead key={`${seg}-q`} className="text-right text-[10px] text-muted-foreground border-l">Qtd</TableHead>,
                            <TableHead key={`${seg}-t`} className="text-right text-[10px] text-muted-foreground">Ticket</TableHead>,
                            <TableHead key={`${seg}-m`} className="text-right text-[10px] text-muted-foreground">MRR</TableHead>,
                          ])}
                          <TableHead className="text-right text-[10px] text-muted-foreground border-l">Qtd</TableHead>
                          <TableHead className="text-right text-[10px] text-muted-foreground">Ticket</TableHead>
                          <TableHead className="text-right text-[10px] text-muted-foreground">MRR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawStackedData.map((row: any) => {
                          const rt = rowTotals(row.regime);
                          return (
                            <TableRow key={row.regime}>
                              <TableCell className="text-xs font-medium">{row.regime}</TableCell>
                              {segmentList.flatMap(seg => {
                                const c = getCell(row.regime, seg);
                                const ticket = c.paying > 0 ? c.mrr / c.paying : 0;
                                return [
                                  <TableCell key={`${seg}-q`} className="text-right text-xs tabular-nums border-l">{c.count}</TableCell>,
                                  <TableCell key={`${seg}-t`} className="text-right text-xs tabular-nums text-muted-foreground">{fmtBRL(ticket)}</TableCell>,
                                  <TableCell key={`${seg}-m`} className="text-right text-xs tabular-nums font-medium">{fmtBRL(c.mrr)}</TableCell>,
                                ];
                              })}
                              <TableCell className="text-right text-xs font-semibold tabular-nums border-l">{rt.count}</TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums text-muted-foreground">{fmtBRL(rt.ticket)}</TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums">{fmtBRL(rt.mrr)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {(() => {
                          const gt = grandTotals();
                          return (
                            <TableRow className="border-t-2">
                              <TableCell className="text-xs font-semibold">Total</TableCell>
                              {segmentList.flatMap(seg => {
                                const st = segTotals(seg);
                                return [
                                  <TableCell key={`${seg}-q`} className="text-right text-xs font-semibold tabular-nums border-l">{st.count}</TableCell>,
                                  <TableCell key={`${seg}-t`} className="text-right text-xs font-semibold tabular-nums text-muted-foreground">{fmtBRL(st.ticket)}</TableCell>,
                                  <TableCell key={`${seg}-m`} className="text-right text-xs font-bold tabular-nums">{fmtBRL(st.mrr)}</TableCell>,
                                ];
                              })}
                              <TableCell className="text-right text-xs font-bold tabular-nums border-l">{gt.count}</TableCell>
                              <TableCell className="text-right text-xs font-bold tabular-nums text-muted-foreground">{fmtBRL(gt.ticket)}</TableCell>
                              <TableCell className="text-right text-xs font-bold tabular-nums">{fmtBRL(gt.mrr)}</TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Seção Vencimento de Certificados */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Vencimento de Certificados</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCertMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">{certMonthLabel}</span>
              <Button variant="ghost" size="icon" onClick={() => setCertMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Badge variant="destructive" className="text-xs">Vencidos: {certMonthData.expired}</Badge>
            <Badge className="bg-amber-100 text-amber-800 text-xs border-amber-200">Próx. 15 dias: {certMonthData.soon}</Badge>
            <Badge variant="secondary" className="text-xs">Total: {certMonthData.total}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
              <Input placeholder="Nome do responsável" value={certResponsible.name} onChange={e => setCertResponsible(prev => ({ ...prev, name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="flex-1 max-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={certResponsible.phone} onChange={e => setCertResponsible(prev => ({ ...prev, phone: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Grupo WhatsApp</Label>
              <div className="flex gap-1">
                <Select value={certResponsible.groupId} onValueChange={v => setCertResponsible(prev => ({ ...prev, groupId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {whatsappGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={fetchWhatsappGroups} disabled={loadingGroups} title="Buscar grupos">
                  {loadingGroups ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={saveCertResponsible}>
              <Save className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
          </div>
          {certMonthData.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum certificado vencido ou vencendo neste mês</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  { key: 'expired', label: 'Vencidos', rows: certMonthData.expiredList },
                  { key: 'month', label: `Vence em ${certMonthLabel}`, rows: certMonthData.monthList },
                ] as const).map(group => group.rows.length === 0 ? null : (
                  <React.Fragment key={group.key}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="bg-muted/40 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label} ({group.rows.length})
                      </TableCell>
                    </TableRow>
                    {group.rows.map(c => {
                      const exp = new Date(c.digital_certificate_expiry! + 'T00:00:00');
                      const now = new Date();
                      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      let statusBadge: React.ReactNode;
                      if (diffDays < 0) statusBadge = <Badge variant="destructive" className="text-xs">Vencido</Badge>;
                      else if (diffDays <= 30) statusBadge = <Badge className="bg-amber-100 text-amber-800 text-xs border-amber-200">{diffDays}d restantes</Badge>;
                      else statusBadge = <Badge className="bg-emerald-100 text-emerald-800 text-xs border-emerald-200">{diffDays}d restantes</Badge>;

                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setEditing(c); setViewOnly(true); setForm({ ...emptyForm, ...Object.fromEntries(Object.entries(c).map(([k,v]) => [k, v ?? ''])) } as any); setDialogOpen(true); }}>
                          <TableCell className="font-medium text-sm">{formatClientLabel(c)}</TableCell>
                          <TableCell className="text-sm">{c.document || '-'}</TableCell>
                          <TableCell className="text-sm">{exp.toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}

        </CardContent>
      </Card>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, documento ou código SCI..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
            <SelectItem value="suspended">Suspensos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead column="sci_code" label="Código SCI" />
                <SortableHead column="company_name" label="Empresa" />
                <SortableHead column="document" label="Documento" />
                <SortableHead column="tax_regime" label="Regime" />
                <SortableHead column="contact_name" label="Contato" />
                <SortableHead column="monthly_value" label="Valor Mensal" />
                <SortableHead column="status" label="Status" />
                <SortableHead column="digital_certificate_expiry" label="Venc. Certificado" />
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.sci_code || '-'}</TableCell>
                  <TableCell className="font-medium">{formatClientLabel(c)}</TableCell>
                  <TableCell>{c.document || '-'}</TableCell>
                  <TableCell>
                    {c.tax_regime ? (
                      <Badge variant="outline" className="text-xs">{TAX_REGIME_LABELS[c.tax_regime] || c.tax_regime}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{c.contact_name || '-'}</TableCell>
                  <TableCell>R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge>
                      {c.services_suspended && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200">Suspenso</Badge>
                      )}
                      {(c as any).without_monthly_fee && (
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300">Sem mensalidade</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{(() => {
                    if (!c.digital_certificate_expiry) return <span className="text-muted-foreground text-xs">—</span>;
                    const exp = new Date(c.digital_certificate_expiry + 'T00:00:00');
                    const now = new Date();
                    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const formatted = exp.toLocaleDateString('pt-BR');
                    if (diffDays < 0) return <Badge className="bg-destructive/10 text-destructive border-destructive/30">{formatted}</Badge>;
                    if (diffDays <= 30) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{formatted}</Badge>;
                    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{formatted}</Badge>;
                  })()}</TableCell>
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
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>}
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
                  <p className="font-medium text-foreground">{formatClientLabel(c)}</p>
                  <p className="text-sm text-muted-foreground">{c.document || 'Sem documento'}</p>
                  <p className="text-sm text-muted-foreground">R$ {Number(c.monthly_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  {c.digital_certificate_expiry && (() => {
                    const exp = new Date(c.digital_certificate_expiry + 'T00:00:00');
                    const now = new Date();
                    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const formatted = exp.toLocaleDateString('pt-BR');
                    const cls = diffDays < 0 ? 'text-destructive' : diffDays <= 30 ? 'text-amber-600' : 'text-emerald-600';
                    return <p className={`text-xs flex items-center gap-1 ${cls}`}><ShieldCheck className="h-3 w-3" />Cert: {formatted}</p>;
                  })()}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    <Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge>
                    {c.services_suspended && (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200">Suspenso</Badge>
                    )}
                  </div>
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
              Tem certeza que deseja excluir <strong>{formatClientLabel(deleteTarget)}</strong>? Esta ação não pode ser desfeita. Todos os contatos por departamento e certificados associados serão removidos.
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
                  <div className="space-y-2">
                    <Label>Valor Mensal (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...f('monthly_value')}
                      disabled={viewOnly || !!form.without_monthly_fee}
                    />
                  </div>
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

                <div className="rounded-md border border-border p-3 flex items-start gap-3">
                  <Switch
                    id="services_suspended"
                    checked={!!form.services_suspended}
                    onCheckedChange={(v) => setForm({ ...form, services_suspended: !!v })}
                    disabled={viewOnly}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="services_suspended" className="cursor-pointer">
                      Suspender serviços (inadimplência)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, as obrigações deste cliente serão movidas automaticamente para a aba “Suspensos” do calendário a partir do dia inicial.
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border p-3 flex items-start gap-3">
                  <Switch
                    id="without_monthly_fee"
                    checked={!!form.without_monthly_fee}
                    onCheckedChange={(v) => setForm({ ...form, without_monthly_fee: !!v, monthly_value: v ? '' : form.monthly_value })}
                    disabled={viewOnly}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="without_monthly_fee" className="cursor-pointer">
                      Cliente sem mensalidade
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, este cliente não será contabilizado nas estatísticas (total de ativos, MRR, ticket médio, churn), mas continuará gerando obrigações e atividades normalmente.
                    </p>
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
                    <Select value={form.tax_regime} onValueChange={v => {
                      setForm({ ...form, tax_regime: v });
                      if (v === 'simples_nacional' && form.main_activity && !form.simples_anexo) {
                        setClassifyingAnexo(true);
                        classifyAnexoByAI(form.main_activity).then(a => {
                          setForm(prev => ({ ...prev, simples_anexo: a }));
                          setClassifyingAnexo(false);
                        });
                      }
                    }} disabled={viewOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mei">MEI</SelectItem>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.tax_regime === 'simples_nacional' && (
                    <div className="col-span-2 space-y-2">
                      <Label className="flex items-center gap-2">
                        Anexo do Simples Nacional
                        {classifyingAnexo && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </Label>
                      <Select value={form.simples_anexo} onValueChange={v => setForm({ ...form, simples_anexo: v })} disabled={viewOnly || classifyingAnexo}>
                        <SelectTrigger><SelectValue placeholder={classifyingAnexo ? "Classificando..." : "Selecione o Anexo..."} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="I">Anexo I (Comércio)</SelectItem>
                          <SelectItem value="II">Anexo II (Indústria)</SelectItem>
                          <SelectItem value="III">Anexo III (Serviços)</SelectItem>
                          <SelectItem value="IV">Anexo IV (Serviços)</SelectItem>
                          <SelectItem value="V">Anexo V (Serviços)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                      if (form.tax_regime === 'simples_nacional') {
                        setClassifyingAnexo(true);
                        classifyAnexoByAI(v).then(a => {
                          setForm(prev => ({ ...prev, simples_anexo: a }));
                          setClassifyingAnexo(false);
                        });
                      }
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
                  <div className="space-y-2">
                    <Label>Inscrição Estadual</Label>
                    <div className="flex gap-2">
                      <Input {...f('state_registration')} className="flex-1" />
                      {!viewOnly && form.document && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={ieLookupLoading}
                          title="Buscar IE no SAT/SC"
                          onClick={async () => {
                            setIeLookupLoading(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('sat-sc-lookup', {
                                body: { cnpj: form.document },
                              });
                              if (error) throw error;
                              if (data?.success) {
                                if (data.ie) setForm(prev => ({ ...prev, state_registration: data.ie }));
                                toast({
                                  title: data.ie ? `IE: ${data.ie}` : 'IE não encontrada',
                                  description: data.situacao ? `Situação Cadastral: ${data.situacao}` : undefined,
                                });
                              } else {
                                toast({ title: 'Erro', description: data?.error || 'Não encontrado', variant: 'destructive' });
                              }
                            } catch (err: any) {
                              toast({ title: 'Erro na consulta', description: err.message, variant: 'destructive' });
                            } finally {
                              setIeLookupLoading(false);
                            }
                          }}
                        >
                          {ieLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
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
                  {editing && (
                    <div className="col-span-2 space-y-3">
                      <Separator />
                      <Label className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4" />Documentos Societários</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(['contrato_social', 'cartao_cnpj'] as const).map(label => {
                          const doc = societyDocs.find(d => d.document_label === label);
                          const title = label === 'contrato_social' ? 'Contrato Social' : 'Cartão CNPJ';
                          return (
                            <div key={label} className="rounded-md border border-input p-3 space-y-2">
                              <span className="text-sm font-medium">{title}</span>
                              {doc ? (
                                <div className="flex items-center gap-2">
                                  <FileCheck className="h-4 w-4 text-primary shrink-0" />
                                  <span className="text-sm flex-1 truncate">{doc.file_name}</span>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSocietyDownload(doc.file_url)}><Download className="h-4 w-4" /></Button>
                                  {!viewOnly && isAdmin && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSocietyDelete(doc.id, doc.file_url)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                </div>
                              ) : viewOnly ? (
                                <p className="text-xs text-muted-foreground">Nenhum documento anexado</p>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={societyUploading[label]} onChange={e => { const file = e.target.files?.[0]; if (file) handleSocietyUpload(label, file); }} />
                                  {societyUploading[label] && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                  departments.map(dep => {
                    const list = deptContacts[dep.id] || [{ contact_name: '', contact_phone: '', contact_email: '' }];
                    const updateField = (idx: number, field: keyof DeptContact, value: string) => {
                      setDeptContacts(prev => {
                        const cur = prev[dep.id] ? [...prev[dep.id]] : [];
                        cur[idx] = { ...cur[idx], [field]: value };
                        return { ...prev, [dep.id]: cur };
                      });
                    };
                    const addContact = () => {
                      setDeptContacts(prev => ({
                        ...prev,
                        [dep.id]: [...(prev[dep.id] || []), { contact_name: '', contact_phone: '', contact_email: '' }],
                      }));
                    };
                    const removeContact = (idx: number) => {
                      setDeptContacts(prev => {
                        const cur = (prev[dep.id] || []).filter((_, i) => i !== idx);
                        return { ...prev, [dep.id]: cur.length > 0 ? cur : [{ contact_name: '', contact_phone: '', contact_email: '' }] };
                      });
                    };
                    return (
                      <div key={dep.id} className="space-y-3 rounded-md border border-border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-foreground">{dep.name}</h4>
                          {!viewOnly && (
                            <Button type="button" size="sm" variant="outline" onClick={addContact}>
                              + Adicionar contato
                            </Button>
                          )}
                        </div>
                        {list.map((c, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">Nome</Label>
                              <Input placeholder="Nome do contato" value={c.contact_name}
                                disabled={viewOnly}
                                onChange={e => updateField(idx, 'contact_name', e.target.value)} />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Telefone</Label>
                              <Input placeholder="Telefone" value={c.contact_phone}
                                disabled={viewOnly}
                                onChange={e => updateField(idx, 'contact_phone', e.target.value)} />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">E-mail</Label>
                              <Input type="email" placeholder="E-mail" value={c.contact_email}
                                disabled={viewOnly}
                                onChange={e => updateField(idx, 'contact_email', e.target.value)} />
                            </div>
                            <div className="col-span-1">
                              {!viewOnly && list.length > 0 && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeContact(idx)} title="Remover">
                                  ✕
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
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
                    companyName={formatClientLabel({ sci_code: form.sci_code, company_name: form.company_name })}
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
