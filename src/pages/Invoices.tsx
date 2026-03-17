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
import { Download, FileText, Search, RefreshCw, FileCode, Plus } from 'lucide-react';

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
  const [filterClient, setFilterClient] = useState('all');

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
    if (!selectedClient) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' });
      return;
    }
    if (!referenceMonth) {
      toast({ title: 'Selecione o mês de referência', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('nfse-query', {
        body: { client_id: selectedClient, reference_month: referenceMonth },
      });

      if (error) {
        toast({ title: 'Erro na consulta', description: error.message, variant: 'destructive' });
      } else if (data?.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Consulta realizada', description: data.message });
        await loadInvoices();
      }
    } catch (e) {
      toast({ title: 'Erro inesperado', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  async function downloadXml(xmlUrl: string) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(xmlUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast({ title: 'Erro ao gerar link de download', variant: 'destructive' });
    }
  }

  async function downloadPdf(pdfUrl: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
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

  const filteredInvoices = filterClient === 'all'
    ? invoices
    : invoices.filter(i => i.client_id === filterClient);

  const totalGross = filteredInvoices.reduce((s, i) => s + (i.gross_value || 0), 0);
  const totalTax = filteredInvoices.reduce((s, i) => s + (i.tax_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notas Fiscais de Serviço</h1>
          <p className="text-muted-foreground">Consulta e download de NFS-e do Portal Nacional</p>
        </div>
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
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
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
                {syncing ? 'Consultando...' : 'Buscar Notas'}
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-lg">Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Filtrar cliente:</Label>
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
                {filteredInvoices.map(inv => (
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
                        {inv.xml_url && (
                          <Button size="sm" variant="ghost" onClick={() => downloadXml(inv.xml_url!)}>
                            <FileCode className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.pdf_url && (
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf(inv.pdf_url!)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
