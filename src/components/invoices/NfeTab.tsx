import { useState, useEffect } from 'react';
import { DANFe } from 'node-sped-pdf';
import JSZip from 'jszip';
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
import { Search, RefreshCw, FileCode, FileText, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const PAGE_SIZE = 20;

type Client = {
  id: string;
  company_name: string;
  document: string | null;
  digital_certificate_url: string | null;
  digital_certificate_expiry: string | null;
};

type NfeInvoice = {
  id: string;
  client_id: string;
  access_key: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  emitter_cnpj: string | null;
  emitter_name: string | null;
  recipient_cnpj: string | null;
  recipient_name: string | null;
  total_value: number;
  status: string | null;
  nsu: string | null;
  xml_url: string | null;
  raw_xml: string | null;
  created_at: string;
};

type NfeQueryResponse = {
  error?: string;
  infrastructure?: boolean;
  invoices_saved?: number;
  last_nsu?: string;
  loops?: number;
  message?: string;
  retryable?: boolean;
  success?: boolean;
};

export default function NfeTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<NfeInvoice[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [datePeriod, setDatePeriod] = useState<'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [bulkRunning, setBulkRunning] = useState<null | 'xml' | 'pdf'>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  function handleDatePeriodChange(period: typeof datePeriod) {
    setDatePeriod(period);
    if (period === 'custom') return;
    const now = new Date();
    if (period === 'all') { setFilterDateFrom(''); setFilterDateTo(''); return; }
    let from: Date, to: Date;
    switch (period) {
      case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0); break;
      case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); break;
      case 'this_year': from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31); break;
      case 'last_year': from = new Date(now.getFullYear() - 1, 0, 1); to = new Date(now.getFullYear() - 1, 11, 31); break;
    }
    setFilterDateFrom(from!.toISOString().slice(0, 10));
    setFilterDateTo(to!.toISOString().slice(0, 10));
  }

  useEffect(() => { loadClients(); loadInvoices(); }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, document, digital_certificate_url, digital_certificate_expiry')
      .eq('status', 'active')
      .order('company_name');
    if (data) setClients(data);
  }

  async function loadInvoices() {
    setLoading(true);
    const { data } = await supabase
      .from('nfe_invoices')
      .select('*')
      .order('issue_date', { ascending: false });
    if (data) setInvoices(data as NfeInvoice[]);
    setLoading(false);
  }

  async function handleSync() {
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
    let infrastructureMessage = '';

    try {
      for (let i = 0; i < clientIds.length; i++) {
        const clientName = clients.find(c => c.id === clientIds[i])?.company_name || '';
        setSyncProgress(clientIds.length > 1 ? `Consultando ${i + 1}/${clientIds.length} — ${clientName}` : `Consultando ${clientName}`);

        try {
          const { data, error } = await supabase.functions.invoke('nfe-query', {
            body: { client_id: clientIds[i] },
          });

          const response = (data ?? null) as NfeQueryResponse | null;
          if (error || response?.error) {
            errorCount++;
            if (response?.infrastructure) {
              infrastructureMessage = response.message || 'O Ambiente Nacional está indisponível no momento.';
              break;
            }
          } else {
            successCount++;
          }
        } catch (e) {
          errorCount++;
          infrastructureMessage = (e as Error).message;
          break;
        }
      }

      await loadInvoices();

      if (infrastructureMessage) {
        toast({
          title: 'Ambiente Nacional indisponível',
          description: infrastructureMessage,
          variant: 'destructive',
        });
        return;
      }

      if (clientIds.length === 1) {
        toast({ title: errorCount > 0 ? 'Erro na consulta' : 'Consulta realizada com sucesso', variant: errorCount > 0 ? 'destructive' : 'default' });
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

  async function handleDownloadXml(inv: NfeInvoice) {
    const key = `${inv.id}-xml`;
    setDownloadingMap(prev => ({ ...prev, [key]: true }));
    const fetchToast = toast({ title: 'Buscando XML no Ambiente Nacional...', description: 'Pode demorar alguns segundos.' });
    try {
      const tryDownload = async () => {
        const res = await supabase.functions.invoke('nfe-download', {
          body: { nfe_invoice_id: inv.id, type: 'xml' },
        });
        // FunctionsHttpError: status >=400. Extract JSON body from error.context.
        if (res.error && (res.error as any).context?.json) {
          try {
            const parsed = await (res.error as any).context.json();
            return { data: parsed, error: null as any };
          } catch { /* fall through */ }
        }
        return res;
      };
      const triggerDownload = async (signedUrl: string) => {
        const resp = await fetch(signedUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${inv.access_key || inv.invoice_number || inv.id}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      let { data, error } = await tryDownload();
      if (error) throw new Error(error.message || 'Erro ao baixar XML');

      if (data?.type === 'signed_url' && data?.url) {
        await triggerDownload(data.url);
        return;
      }

      // Auto-manifestação: AN só devolveu resumo → enviamos Ciência da Operação e tentamos novamente.
      if (data?.reason === 'manifestacao_required' || data?.cStat === '137') {
        fetchToast.update({
          id: fetchToast.id,
          title: 'Enviando Manifestação do Destinatário...',
          description: 'Ciência da Operação na SEFAZ.',
        });
        const manifRes = await supabase.functions.invoke('nfe-manifestacao', {
          body: { nfe_invoice_id: inv.id, tpEvento: '210210' },
        });
        let manifData: any = manifRes.data;
        let manifError: any = manifRes.error;
        if (manifError && (manifError as any).context?.json) {
          try { manifData = await (manifError as any).context.json(); manifError = null; } catch {}
        }
        if (manifError || !manifData?.success) {
          const msg = manifData?.error || manifError?.message || 'Falha na manifestação';
          toast({ title: 'Não foi possível manifestar', description: msg, variant: 'destructive' });
          return;
        }

        fetchToast.update({
          id: fetchToast.id,
          title: 'Manifestação registrada. Aguardando AN liberar o XML...',
        });
        await new Promise(r => setTimeout(r, 5000));
        ({ data, error } = await tryDownload());
        if (error) throw new Error(error.message || 'Erro ao baixar XML após manifestação');
        if (data?.type === 'signed_url' && data?.url) {
          await triggerDownload(data.url);
          toast({ title: 'XML baixado', description: 'Manifestação realizada e XML obtido com sucesso.' });
          return;
        }
        toast({
          title: 'XML ainda não disponível',
          description: 'Manifestação registrada, mas o AN ainda não liberou o XML. Tente novamente em alguns minutos.',
          variant: 'destructive',
        });
        return;
      }

      const desc = data?.reason === 'client_cert_missing'
        ? 'Cadastre o certificado A1 da empresa no cadastro do cliente (CRM → Empresa).'
        : (data?.error || 'XML não disponível.');
      toast({ title: 'XML não disponível', description: desc, variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Erro ao baixar XML', description: (e as Error).message, variant: 'destructive' });
    } finally {
      fetchToast.dismiss();
      setDownloadingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleDownloadPdf(inv: NfeInvoice) {
    if (!inv.access_key) {
      toast({ title: 'NF-e sem chave de acesso', variant: 'destructive' });
      return;
    }
    const key = `${inv.id}-pdf`;
    setDownloadingMap(prev => ({ ...prev, [key]: true }));
    try {
      // 1. Get the full XML via edge function
      const { data, error } = await supabase.functions.invoke('nfe-download', {
        body: { nfe_invoice_id: inv.id, type: 'xml' },
      });
      if (error) throw new Error(error.message || 'Erro ao obter XML');
      if (!data?.url) throw new Error('XML não disponível para esta NF-e');

      // 2. Fetch the XML content
      const resp = await fetch(data.url);
      const xmlContent = await resp.text();

      // 3. Generate DANFE PDF from XML
      const pdfBytes = await DANFe({ xml: xmlContent });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.access_key}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: 'Erro ao gerar DANFE', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDownloadingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  function getClientName(clientId: string) {
    return clients.find(c => c.id === clientId)?.company_name || '—';
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  async function fetchXmlContent(inv: NfeInvoice): Promise<string | null> {
    const res = await supabase.functions.invoke('nfe-download', {
      body: { nfe_invoice_id: inv.id, type: 'xml' },
    });
    let data: any = res.data;
    if (res.error && (res.error as any).context?.json) {
      try { data = await (res.error as any).context.json(); } catch { /* ignore */ }
    } else if (res.error) {
      return null;
    }
    if (data?.type === 'signed_url' && data?.url) {
      const r = await fetch(data.url);
      if (!r.ok) return null;
      return await r.text();
    }
    return null;
  }

  async function runBulkDownload(kind: 'xml' | 'pdf') {
    if (filteredInvoices.length === 0) return;
    setBulkRunning(kind);
    setBulkProgress({ done: 0, total: filteredInvoices.length });
    const zip = new JSZip();
    let success = 0;
    let failed = 0;
    const CONCURRENCY = 5;
    let idx = 0;

    async function worker() {
      while (idx < filteredInvoices.length) {
        const my = idx++;
        const inv = filteredInvoices[my];
        try {
          const xml = await fetchXmlContent(inv);
          if (!xml) { failed++; continue; }
          const baseName = inv.access_key || inv.invoice_number || inv.id;
          if (kind === 'xml') {
            zip.file(`${baseName}.xml`, xml);
          } else {
            const pdfBytes = await DANFe({ xml });
            zip.file(`${baseName}.pdf`, pdfBytes as Uint8Array);
          }
          success++;
        } catch {
          failed++;
        } finally {
          setBulkProgress(p => ({ ...p, done: p.done + 1 }));
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, filteredInvoices.length) }, worker));

      if (success === 0) {
        toast({ title: 'Nenhum arquivo disponível', description: 'Não foi possível baixar XMLs (verifique manifestação).', variant: 'destructive' });
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `nfe-${kind === 'xml' ? 'xmls' : 'pdfs'}-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download concluído',
        description: `${success} baixado(s)${failed ? `, ${failed} sem XML disponível` : ''}.`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    } catch (e) {
      toast({ title: 'Erro no download em lote', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBulkRunning(null);
      setBulkProgress({ done: 0, total: 0 });
    }
  }

  let filteredInvoices = invoices;
  if (filterClient !== 'all') filteredInvoices = filteredInvoices.filter(i => i.client_id === filterClient);
  if (filterDateFrom) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date >= filterDateFrom);
  if (filterDateTo) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date <= filterDateTo);

  const totalValue = filteredInvoices.reduce((s, i) => s + (i.total_value || 0), 0);
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const paginatedInvoices = filteredInvoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterClient, datePeriod, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-6">
      {/* Sync Card */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Consultar NF-e no Ambiente Nacional
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
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                {syncing ? (syncProgress || 'Consultando...') : 'Buscar NF-e'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de NF-e</p>
            <p className="text-2xl font-bold text-foreground">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <CardTitle className="text-lg">NF-e Recebidas</CardTitle>
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
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Até:</Label>
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[160px]" />
                  </div>
                </>
              )}
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulkDownload('xml')}
                disabled={bulkRunning !== null || filteredInvoices.length === 0}
              >
                {bulkRunning === 'xml'
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <FileCode className="h-4 w-4 mr-2" />}
                {bulkRunning === 'xml'
                  ? `Baixando ${bulkProgress.done}/${bulkProgress.total}...`
                  : `Baixar XMLs (${filteredInvoices.length})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulkDownload('pdf')}
                disabled={bulkRunning !== null || filteredInvoices.length === 0}
              >
                {bulkRunning === 'pdf'
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Download className="h-4 w-4 mr-2" />}
                {bulkRunning === 'pdf'
                  ? `Baixando ${bulkProgress.done}/${bulkProgress.total}...`
                  : `Baixar PDFs (${filteredInvoices.length})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma NF-e encontrada. Use a consulta acima para buscar NF-e no Ambiente Nacional.
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead className="max-w-[150px]">Emitente</TableHead>
                    <TableHead className="hidden lg:table-cell">Destinatário</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
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
                        <TableCell className="max-w-[150px] truncate">
                          <div>
                            <p className="truncate">{inv.emitter_name || getClientName(inv.client_id)}</p>
                            {inv.emitter_cnpj && <p className="text-xs text-muted-foreground hidden lg:block">{inv.emitter_cnpj}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div>
                            <p className="text-sm">{inv.recipient_name || '—'}</p>
                            {inv.recipient_cnpj && <p className="text-xs text-muted-foreground">{inv.recipient_cnpj}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(inv.issue_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.total_value)}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={inv.status === 'cancelada' ? 'destructive' : 'secondary'}>
                            {inv.status || 'autorizada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {inv.access_key && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={xmlLoading}
                                  onClick={() => handleDownloadXml(inv)}
                                  title="Baixar XML completo"
                                >
                                  {xmlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pdfLoading}
                                  onClick={() => handleDownloadPdf(inv)}
                                  title="Baixar DANFE em PDF"
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
    </div>
  );
}
