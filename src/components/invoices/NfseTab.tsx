import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileText, Search, RefreshCw, FileCode, Plus, Loader2, PackageOpen, ChevronLeft, ChevronRight, Building2, Wallet, Landmark, ShieldCheck, User, Coins, PieChart, Briefcase, Heart, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatClientLabel } from '@/lib/utils';

const PAGE_SIZE = 20;

type Client = { id: string; sci_code?: string | null; company_name: string; document: string | null; digital_certificate_url: string | null; digital_certificate_expiry: string | null };
type Invoice = {
  id: string;
  client_id: string;
  access_key: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  service_description: string | null;
  gross_value: number;
  tax_value: number;
  net_value: number;
  status: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  issuer_cnpj: string | null;
  taker_cnpj: string | null;
  created_at: string;
  raw_data: { xml?: string } | null;
};

type Retentions = {
  iss: number;
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  cp: number;
  total: number;
};

function extractXmlValue(xml: string, tag: string): number {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
  return match ? parseFloat(match[1]) || 0 : 0;
}

function parseRetentions(inv: Invoice): Retentions {
  const xml = inv.raw_data?.xml || '';
  if (!xml) return { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, cp: 0, total: 0 };

  const irrf = extractXmlValue(xml, 'vRetIRRF');
  const pis = extractXmlValue(xml, 'vRetPIS');
  const cofins = extractXmlValue(xml, 'vRetCOFINS');
  const csll = extractXmlValue(xml, 'vRetCSLL');
  const inss = extractXmlValue(xml, 'vRetINSS');
  const cp = extractXmlValue(xml, 'vRetCP');
  const vTotalRet = extractXmlValue(xml, 'vTotalRet');
  const tpRetISSQN = extractXmlValue(xml, 'tpRetISSQN');

  const federalTotal = irrf + pis + cofins + csll + inss + cp;
  const iss = tpRetISSQN === 2 ? Math.max(vTotalRet - federalTotal, 0) : 0;
  const total = iss + federalTotal;

  return { iss, irrf, pis, cofins, csll, inss, cp, total };
}

export default function NfseTab() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'prestados' | 'tomados'>('all');
  const [datePeriod, setDatePeriod] = useState<'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [page, setPage] = useState(0);

  function handleDatePeriodChange(period: typeof datePeriod) {
    setDatePeriod(period);
    if (period === 'custom') return;
    const now = new Date();
    if (period === 'all') {
      setFilterDateFrom('');
      setFilterDateTo('');
      return;
    }
    let from: Date, to: Date;
    switch (period) {
      case 'this_month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last_year':
        from = new Date(now.getFullYear() - 1, 0, 1);
        to = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }
    setFilterDateFrom(from!.toISOString().slice(0, 10));
    setFilterDateTo(to!.toISOString().slice(0, 10));
  }
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [retentionDetail, setRetentionDetail] = useState<{ type: 'prestado' | 'tomado'; taxKey: keyof Retentions } | null>(null);

  useEffect(() => {
    loadClients();
    loadInvoices();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, sci_code, company_name, document, digital_certificate_url, digital_certificate_expiry')
      .eq('status', 'active')
      .order('company_name');
    if (data) setClients(data);
  }

  async function loadInvoices() {
    setLoading(true);
    const CHUNK = 1000;
    const all: Invoice[] = [];
    for (let offset = 0; ; offset += CHUNK) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('issue_date', { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error || !data) break;
      all.push(...(data as Invoice[]));
      if (data.length < CHUNK) break;
    }
    setInvoices(all);
    setLoading(false);
  }


  async function handleSync() {
    if (!referenceMonth) {
      toast({ title: 'Selecione o mês de referência', variant: 'destructive' });
      return;
    }

    const clientIds = selectedClient && selectedClient !== 'all'
      ? [selectedClient]
      : (() => {
          const today = new Date().toISOString().slice(0, 10);
          return clients.filter(c => 
            c.document && 
            c.digital_certificate_url && 
            c.digital_certificate_expiry && 
            c.digital_certificate_expiry >= today
          ).map(c => c.id);
        })();

    if (clientIds.length === 0) {
      toast({ title: 'Nenhum cliente com CNPJ e certificado digital válido', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < clientIds.length; i++) {
        if (clientIds.length > 1) {
          const clientName = formatClientLabel(clients.find(c => c.id === clientIds[i]));
          setSyncProgress(`Consultando ${i + 1}/${clientIds.length} — ${clientName}`);
        }

        try {
          const { data, error } = await supabase.functions.invoke('nfse-query', {
            body: { client_id: clientIds[i], reference_month: referenceMonth },
          });

          if (error || data?.error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await loadInvoices();

      if (clientIds.length === 1) {
        if (errorCount > 0) {
          toast({ title: 'Erro na consulta', variant: 'destructive' });
        } else {
          toast({ title: 'Consulta realizada com sucesso' });
        }
      } else {
        toast({
          title: 'Consulta em lote finalizada',
          description: `${successCount} sucesso, ${errorCount} erro(s) de ${clientIds.length} clientes`,
          variant: errorCount > 0 ? 'destructive' : 'default',
        });
      }
    } catch (e) {
      toast({ title: 'Erro inesperado', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }

  function triggerDownloadBlob(blobUrl: string, filename: string) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }

  async function triggerDownload(url: string, filename: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownloadBlob(blobUrl, filename);
  }

  async function getSignedXmlUrl(inv: Invoice): Promise<string | null> {
    if (inv.xml_url) {
      const { data } = await supabase.storage.from('documents').createSignedUrl(inv.xml_url, 300);
      if (data?.signedUrl) return data.signedUrl;
    }
    const { data, error } = await supabase.functions.invoke('nfse-download', {
      body: { invoice_id: inv.id, type: 'xml' },
    });
    if (error || data?.error) return null;
    return data?.signed_url || null;
  }

  async function handleBatchExportXml() {
    const targets = filteredInvoices.filter(i => i.access_key);
    if (targets.length === 0) {
      toast({ title: 'Nenhuma nota com XML disponível nos filtros atuais', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let added = 0;

      for (const inv of targets) {
        try {
          const url = await getSignedXmlUrl(inv);
          if (url) {
            const resp = await fetch(url);
            const blob = await resp.blob();
            zip.file(`${inv.access_key || inv.invoice_number || inv.id}.xml`, blob);
            added++;
          }
        } catch {
          // skip individual failures
        }
      }

      if (added === 0) {
        toast({ title: 'Não foi possível obter nenhum XML', variant: 'destructive' });
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);
      triggerDownloadBlob(blobUrl, `nfse-xml-export.zip`);
      toast({ title: `${added} XML(s) exportados com sucesso` });
    } catch (e) {
      toast({ title: 'Erro na exportação', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload(invoiceId: string, type: 'xml' | 'pdf', existingUrl: string | null) {
    const key = `${invoiceId}-${type}`;
    setDownloadingMap(prev => ({ ...prev, [key]: true }));
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const filename = `${invoice?.access_key || invoice?.invoice_number || invoiceId}.${type}`;

    try {
      if (existingUrl) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(existingUrl, 300);
        if (data?.signedUrl) {
          await triggerDownload(data.signedUrl, filename);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('nfse-download', {
        body: { invoice_id: invoiceId, type },
      });

      if (error) {
        toast({ title: `Erro ao baixar ${type.toUpperCase()}`, description: error.message, variant: 'destructive' });
        return;
      }

      if (data?.error) {
        toast({ title: `Erro ao baixar ${type.toUpperCase()}`, description: data.error, variant: 'destructive' });
        return;
      }

      if (data?.signed_url) {
        await triggerDownload(data.signed_url, filename);
        setInvoices(prev => prev.map(inv => {
          if (inv.id !== invoiceId) return inv;
          return type === 'xml'
            ? { ...inv, xml_url: inv.xml_url || 'cached' }
            : { ...inv, pdf_url: inv.pdf_url || 'cached' };
        }));
      } else {
        toast({ title: `${type.toUpperCase()} não disponível`, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro inesperado', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDownloadingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  function cleanCnpj(doc: string | null) {
    return doc?.replace(/\D/g, '') || '';
  }

  function getClientCnpj(clientId: string) {
    return cleanCnpj(clients.find(c => c.id === clientId)?.document || null);
  }

  function getInvoiceType(inv: Invoice): 'prestado' | 'tomado' {
    const clientCnpj = getClientCnpj(inv.client_id);
    return cleanCnpj(inv.issuer_cnpj) === clientCnpj ? 'prestado' : 'tomado';
  }

  function getClientName(clientId: string) {
    return formatClientLabel(clients.find(c => c.id === clientId), '—');
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  let baseFiltered = invoices;
  if (filterClient !== 'all') baseFiltered = baseFiltered.filter(i => i.client_id === filterClient);
  if (filterDateFrom) baseFiltered = baseFiltered.filter(i => i.issue_date && i.issue_date >= filterDateFrom);
  if (filterDateTo) baseFiltered = baseFiltered.filter(i => i.issue_date && i.issue_date <= filterDateTo);

  let filteredInvoices = baseFiltered;
  if (filterType !== 'all') filteredInvoices = filteredInvoices.filter(i => getInvoiceType(i) === (filterType === 'prestados' ? 'prestado' : 'tomado'));

  const prestadosInvoices = baseFiltered.filter(i => getInvoiceType(i) === 'prestado');

  const prestadosTotalGross = prestadosInvoices.reduce((s, i) => s + (i.gross_value || 0), 0);
  const prestadosTotalTax = prestadosInvoices.reduce((s, i) => s + (i.tax_value || 0), 0);

  const tomadosTotalGross = baseFiltered.filter(i => getInvoiceType(i) === 'tomado').reduce((s, i) => s + (i.gross_value || 0), 0);
  const tomadosTotalTax = baseFiltered.filter(i => getInvoiceType(i) === 'tomado').reduce((s, i) => s + (i.tax_value || 0), 0);

  // Retention totals (uses baseFiltered to ignore type filter)
  const tomadosInvoices = baseFiltered.filter(i => getInvoiceType(i) === 'tomado');
  const calcRetentions = (invs: typeof invoices) => invs.reduce<Retentions>(
    (acc, inv) => {
      const r = parseRetentions(inv);
      return {
        iss: acc.iss + r.iss, irrf: acc.irrf + r.irrf, pis: acc.pis + r.pis,
        cofins: acc.cofins + r.cofins, csll: acc.csll + r.csll, inss: acc.inss + r.inss,
        cp: acc.cp + r.cp, total: acc.total + r.total,
      };
    },
    { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, cp: 0, total: 0 }
  );
  const prestadosRetentionTotals = calcRetentions(prestadosInvoices);
  const tomadosRetentionTotals = calcRetentions(tomadosInvoices);
  const showPrestadosRetentions = filterClient !== 'all' || prestadosRetentionTotals.total > 0;
  const showTomadosRetentions = filterClient !== 'all' || tomadosRetentionTotals.total > 0;

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const paginatedInvoices = filteredInvoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterClient, filterType, datePeriod, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {isAdmin && (
          <Button onClick={() => navigate('/invoices/emit')}>
            <Plus className="h-4 w-4 mr-2" />
            Emitir NFS-e
          </Button>
        )}
      </div>

      {/* Sync Card */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Consultar Notas no Portal Nacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.filter(c => c.document).map(c => (
                      <SelectItem key={c.id} value={c.id}>{formatClientLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <Label>Mês de Referência</Label>
                <Input
                  type="month"
                  value={referenceMonth}
                  onChange={e => setReferenceMonth(e.target.value)}
                />
              </div>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                {syncing ? (syncProgress || 'Consultando...') : 'Buscar Notas'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Serviços Prestados */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Serviços Prestados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Notas</p>
              <p className="text-2xl font-bold text-foreground">{prestadosInvoices.length}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valor Bruto Total</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(prestadosTotalGross)}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Impostos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(prestadosTotalTax)}</p>
            </CardContent>
          </Card>
        </div>
        {showPrestadosRetentions && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Impostos Retidos</p>
            <Card className="border-l-[3px] border-l-blue-500 border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRetentionDetail({ type: 'prestado', taxKey: 'total' })}>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">Total Retido</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(prestadosRetentionTotals.total)}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {(['iss','irrf','pis','cofins','csll','inss','cp'] as const).map(key => (
                <Card key={key} className="border-blue-100 dark:border-blue-900/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRetentionDetail({ type: 'prestado', taxKey: key })}>
                  <CardContent className="pt-5 pb-4 px-5">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{key.toUpperCase()}</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(prestadosRetentionTotals[key])}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Serviços Tomados */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Serviços Tomados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Notas</p>
              <p className="text-2xl font-bold text-foreground">{tomadosInvoices.length}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valor Bruto Total</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(tomadosTotalGross)}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Impostos</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(tomadosTotalTax)}</p>
            </CardContent>
          </Card>
        </div>
        {showTomadosRetentions && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Impostos Retidos</p>
            <Card className="border-l-[3px] border-l-orange-500 border-orange-200 bg-orange-50/80 dark:bg-orange-950/30 dark:border-orange-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRetentionDetail({ type: 'tomado', taxKey: 'total' })}>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wide">Total Retido</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(tomadosRetentionTotals.total)}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {(['iss','irrf','pis','cofins','csll','inss','cp'] as const).map(key => (
                <Card key={key} className="border-orange-100 dark:border-orange-900/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setRetentionDetail({ type: 'tomado', taxKey: key })}>
                  <CardContent className="pt-5 pb-4 px-5">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{key.toUpperCase()}</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(tomadosRetentionTotals[key])}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <CardTitle className="text-lg">Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2 flex-wrap md:ml-auto">
              <Select value={datePeriod} onValueChange={(v) => handleDatePeriodChange(v as typeof datePeriod)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="this_month">Esse Mês</SelectItem>
                  <SelectItem value="last_month">Mês Anterior</SelectItem>
                  <SelectItem value="this_year">Esse Ano</SelectItem>
                  <SelectItem value="last_year">Ano Anterior</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {datePeriod === 'custom' && (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">De:</Label>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Até:</Label>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                </>
              )}
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="prestados">Serviços Prestados</SelectItem>
                  <SelectItem value="tomados">Serviços Tomados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{formatClientLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full md:w-auto"
                disabled={exporting || filteredInvoices.filter(i => i.access_key).length === 0}
                onClick={handleBatchExportXml}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageOpen className="h-4 w-4 mr-2" />}
                {exporting ? 'Exportando...' : 'Exportar XMLs'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma nota fiscal encontrada. Use a consulta acima para buscar notas do Portal Nacional.
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="max-w-[150px]">Cliente</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Impostos</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map(inv => {
                    const xmlLoading = downloadingMap[`${inv.id}-xml`];
                    const pdfLoading = downloadingMap[`${inv.id}-pdf`];
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={getInvoiceType(inv) === 'prestado' ? 'default' : 'outline'} className={getInvoiceType(inv) === 'prestado' ? 'bg-blue-500 hover:bg-blue-600' : 'border-orange-400 text-orange-600'}>
                            {getInvoiceType(inv) === 'prestado' ? 'Prestado' : 'Tomado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{getClientName(inv.client_id)}</TableCell>
                        <TableCell>{formatDate(inv.issue_date)}</TableCell>
                        <TableCell className="max-w-[150px] truncate hidden lg:table-cell">{inv.service_description || '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.gross_value)}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">{formatCurrency(inv.tax_value)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={inv.status === 'cancelada' ? 'destructive' : 'secondary'}>
                            {inv.status || 'normal'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {inv.access_key && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={xmlLoading}
                                  onClick={() => handleDownload(inv.id, 'xml', inv.xml_url)}
                                  title="Baixar XML"
                                >
                                  {xmlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pdfLoading}
                                  onClick={() => handleDownload(inv.id, 'pdf', inv.pdf_url)}
                                  title="Baixar PDF"
                                >
                                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages} ({filteredInvoices.length} notas)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Retention Detail Dialog */}
      <Dialog open={!!retentionDetail} onOpenChange={(open) => !open && setRetentionDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {retentionDetail?.taxKey === 'total' ? 'Total Retido' : retentionDetail?.taxKey.toUpperCase()} — Serviços {retentionDetail?.type === 'prestado' ? 'Prestados' : 'Tomados'}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!retentionDetail) return null;
            const sourceInvoices = retentionDetail.type === 'prestado' ? prestadosInvoices : tomadosInvoices;
            const taxKey = retentionDetail.taxKey;
            const detailed = sourceInvoices
              .map(inv => {
                const r = parseRetentions(inv);
                const retValue = taxKey === 'total' ? r.total : r[taxKey];
                return { inv, retValue };
              })
              .filter(d => d.retValue > 0)
              .sort((a, b) => b.retValue - a.retValue);
            const totalValue = detailed.reduce((s, d) => s + d.retValue, 0);

            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span> — {detailed.length} nota(s)
                </p>
                {detailed.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma nota com retenção para este imposto.</p>
                ) : (
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data Emissão</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Valor Retido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailed.map(({ inv, retValue }) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number || '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{getClientName(inv.client_id)}</TableCell>
                          <TableCell>{formatDate(inv.issue_date)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.gross_value)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(retValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
