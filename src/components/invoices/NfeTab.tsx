import { useState, useEffect } from 'react';
import { DANFe } from 'node-sped-pdf';
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
import { Search, RefreshCw, FileCode, FileText, Loader2, ExternalLink } from 'lucide-react';

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
      .order('issue_date', { ascending: false })
      .limit(200);
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
    try {
      // Try to get full XML via edge function
      const { data, error } = await supabase.functions.invoke('nfe-download', {
        body: { nfe_invoice_id: inv.id, type: 'xml' },
      });

      if (error) throw new Error(error.message || 'Erro ao baixar XML');

      if (data?.type === 'signed_url' && data?.url) {
        // Download from signed URL
        const resp = await fetch(data.url);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${inv.access_key || inv.invoice_number || inv.id}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      toast({ title: 'XML não disponível', description: data?.error || '', variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Erro ao baixar XML', description: (e as Error).message, variant: 'destructive' });
    } finally {
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

  let filteredInvoices = invoices;
  if (filterClient !== 'all') filteredInvoices = filteredInvoices.filter(i => i.client_id === filterClient);
  if (filterDateFrom) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date >= filterDateFrom);
  if (filterDateTo) filteredInvoices = filteredInvoices.filter(i => i.issue_date && i.issue_date <= filterDateTo);

  const totalValue = filteredInvoices.reduce((s, i) => s + (i.total_value || 0), 0);

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
          <div className="flex items-center flex-wrap gap-4">
            <CardTitle className="text-lg">NF-e Recebidas</CardTitle>
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
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Até:</Label>
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[160px]" />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Data Emissão</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
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
                      <TableCell>
                        <div>
                          <p className="text-sm">{inv.emitter_name || getClientName(inv.client_id)}</p>
                          {inv.emitter_cnpj && <p className="text-xs text-muted-foreground">{inv.emitter_cnpj}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{inv.recipient_name || '—'}</p>
                          {inv.recipient_cnpj && <p className="text-xs text-muted-foreground">{inv.recipient_cnpj}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(inv.issue_date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total_value)}</TableCell>
                      <TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
