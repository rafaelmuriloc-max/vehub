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
import { Download, FileText, Search, RefreshCw, FileCode, Plus, Loader2, PackageOpen } from 'lucide-react';

type Client = { id: string; company_name: string; document: string | null };
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
};

export default function Invoices() {
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
  const [datePeriod, setDatePeriod] = useState<'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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

  useEffect(() => {
    loadClients();
    loadInvoices();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, document')
      .eq('status', 'active')
      .order('company_name');
    if (data) setClients(data);
  }

  async function loadInvoices() {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false })
      .limit(200);
    if (data) setInvoices(data as Invoice[]);
    setLoading(false);
  }

  async function handleSync() {
    if (!referenceMonth) {
      toast({ title: 'Selecione o mês de referência', variant: 'destructive' });
      return;
    }

    const clientIds = selectedClient && selectedClient !== 'all'
      ? [selectedClient]
      : clients.filter(c => c.document).map(c => c.id);

    if (clientIds.length === 0) {
      toast({ title: 'Nenhum cliente com CNPJ cadastrado', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < clientIds.length; i++) {
        if (clientIds.length > 1) {
          const clientName = clients.find(c => c.id === clientIds[i])?.company_name || '';
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
      // If URL already exists, just create a signed URL
      if (existingUrl) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(existingUrl, 300);
        if (data?.signedUrl) {
          await triggerDownload(data.signedUrl, filename);
          return;
        }
      }

      // Call the edge function to generate/fetch
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
        // Update local state so next click is instant
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

  let filteredInvoices = invoices;
  if (filterClient !== 'all') filteredInvoices = filteredInvoices.filter(i => i.client_id === filterClient);
  if (filterDateFrom) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date >= filterDateFrom);
  if (filterDateTo) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date <= filterDateTo);

  const totalGross = filteredInvoices.reduce((s, i) => s + (i.gross_value || 0), 0);
  const totalTax = filteredInvoices.reduce((s, i) => s + (i.tax_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notas Fiscais de Serviço</h1>
          <p className="text-muted-foreground">Consulta e download de NFS-e do Portal Nacional</p>
        </div>
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
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de Notas</p>
            <p className="text-2xl font-bold text-foreground">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Valor Bruto Total</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de Impostos</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center flex-wrap gap-4">
            <CardTitle className="text-lg">Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <Select value={datePeriod} onValueChange={(v) => handleDatePeriodChange(v as typeof datePeriod)}>
                <SelectTrigger className="w-[180px]">
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
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[220px]">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => {
                  const xmlLoading = downloadingMap[`${inv.id}-xml`];
                  const pdfLoading = downloadingMap[`${inv.id}-pdf`];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number || '—'}</TableCell>
                      <TableCell>{getClientName(inv.client_id)}</TableCell>
                      <TableCell>{formatDate(inv.issue_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.service_description || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.gross_value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.tax_value)}</TableCell>
                      <TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
