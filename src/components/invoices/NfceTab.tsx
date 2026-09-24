import { useEffect, useMemo, useState } from 'react';
import { ClientCombobox } from '@/components/ClientCombobox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChevronLeft, ChevronRight, Download, FileText, Loader2, RefreshCw, ShoppingCart, TrendingUp, Wallet, XCircle,
} from 'lucide-react';
import { formatClientLabel } from '@/lib/utils';

const PAGE_SIZE = 20;

type Client = {
  id: string;
  sci_code?: string | null;
  company_name: string;
  document: string | null;
  digital_certificate_url: string | null;
  digital_certificate_expiry: string | null;
};

type NfceInvoice = {
  id: string;
  client_id: string;
  access_key: string;
  invoice_number: string | null;
  series: string | null;
  issue_date: string | null;
  emitter_name: string | null;
  consumer_name: string | null;
  consumer_document: string | null;
  total_value: number;
  status: string | null;
  xml_url: string | null;
};

type NfceQueryResponse = {
  error?: string;
  events_saved?: number;
  invoices_saved?: number;
  next_query_at?: string | null;
  skipped?: boolean;
  not_accountant?: boolean;
  success?: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'cancelada') return <Badge variant="destructive">Cancelada</Badge>;
  if (status === 'substituida') return <Badge variant="outline">Substituída</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Autorizada</Badge>;
}

export default function NfceTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['nfce-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, sci_code, company_name, document, digital_certificate_url, digital_certificate_expiry')
        .eq('status', 'active')
        .order('company_name');
      return (data || []) as Client[];
    },
  });

  const { data: invoices = [], isFetching } = useQuery({
    queryKey: ['nfce-invoices', selectedClient, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('nfce_invoices')
        .select('id, client_id, access_key, invoice_number, series, issue_date, emitter_name, consumer_name, consumer_document, total_value, status, xml_url')
        .order('issue_date', { ascending: false })
        .limit(1000);
      if (selectedClient !== 'all') q = q.eq('client_id', selectedClient);
      if (dateFrom) q = q.gte('issue_date', `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte('issue_date', `${dateTo}T23:59:59`);
      const { data } = await q;
      return (data || []) as NfceInvoice[];
    },
  });

  useEffect(() => { setPage(0); }, [selectedClient, filterStatus, dateFrom, dateTo]);

  const filtered = useMemo(
    () => invoices.filter((i) => filterStatus === 'all' || (i.status || 'autorizada') === filterStatus),
    [invoices, filterStatus],
  );

  const stats = useMemo(() => {
    const validas = filtered.filter((i) => (i.status || 'autorizada') === 'autorizada');
    const total = validas.reduce((sum, i) => sum + Number(i.total_value || 0), 0);
    return {
      quantidade: filtered.length,
      faturamento: total,
      ticket: validas.length ? total / validas.length : 0,
      canceladas: filtered.filter((i) => i.status === 'cancelada').length,
    };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  async function handleDownloadXml(invoice: NfceInvoice) {
    setDownloading((m) => ({ ...m, [invoice.id]: true }));
    try {
      let xml: string | null = null;
      if (invoice.xml_url) {
        const { data } = await supabase.storage.from('documents').download(invoice.xml_url);
        if (data) xml = await data.text();
      }
      if (!xml) {
        const { data } = await supabase.from('nfce_invoices').select('raw_xml').eq('id', invoice.id).single();
        xml = (data?.raw_xml as string | null) || null;
      }
      if (!xml) {
        toast({ title: 'Arquivo da nota não disponível', variant: 'destructive' });
        return;
      }
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.access_key}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading((m) => ({ ...m, [invoice.id]: false }));
    }
  }

  async function handleSync() {
    const today = new Date().toISOString().slice(0, 10);
    const targets = selectedClient !== 'all'
      ? clients.filter((c) => c.id === selectedClient)
      : clients.filter((c) => c.document);

    if (targets.length === 0) {
      toast({ title: 'Nenhuma empresa com CNPJ', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    let notas = 0;
    let eventos = 0;
    let erros = 0;
    const bloqueadas: string[] = [];
    const semVinculo: string[] = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        const nome = formatClientLabel(targets[i]);
        setSyncProgress(targets.length > 1 ? `Consultando ${i + 1}/${targets.length} — ${nome}` : `Consultando ${nome}`);
        try {
          const { data, error } = await supabase.functions.invoke('nfce-query', { body: { client_id: targets[i].id } });
          const res = (data ?? null) as NfceQueryResponse | null;
          if (res?.not_accountant) {
            semVinculo.push(nome);
            continue;
          }
          if (error || res?.error) {
            erros++;
            continue;
          }
          notas += Number(res?.invoices_saved || 0);
          eventos += Number(res?.events_saved || 0);
          if (res?.next_query_at) {
            const hhmm = new Date(res.next_query_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            bloqueadas.push(`${nome}: próxima consulta liberada em ${hhmm}`);
          }
        } catch {
          erros++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['nfce-invoices'] });

      const partes = [`${notas} nota(s)`, `${eventos} evento(s)`];
      if (erros) partes.push(`${erros} empresa(s) com erro`);
      if (semVinculo.length) partes.push(`${semVinculo.length} empresa(s) sem o escritório como contabilista no SAT: ${semVinculo.slice(0, 5).join(', ')}${semVinculo.length > 5 ? '…' : ''}`);
      toast({
        title: 'Busca de NFC-e concluída',
        description: `${partes.join(', ')}.${bloqueadas.length ? ` ${bloqueadas.slice(0, 3).join(' · ')}` : ''}`,
      });
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }

  const cards = [
    { label: 'Cupons emitidos', value: String(stats.quantidade), icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/50' },
    { label: 'Faturamento', value: formatCurrency(stats.faturamento), icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/50' },
    { label: 'Ticket médio', value: formatCurrency(stats.ticket), icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/50' },
    { label: 'Canceladas', value: String(stats.canceladas), icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-500 text-white flex items-center justify-center">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">NFC-e — Notas ao consumidor</h2>
            <p className="text-sm text-muted-foreground">Busca automática dos cupons eletrônicos na SEF-SC.</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={handleSync} disabled={syncing} className="bg-orange-500 hover:bg-orange-600 text-white">
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {syncing ? (syncProgress || 'Sincronizando...') : 'Sincronizar'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${c.bg}`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold text-foreground truncate">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Empresa</Label>
            <ClientCombobox clients={clients} value={selectedClient} onChange={setSelectedClient} allowAll />
          </div>
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Situação</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="autorizada">Autorizadas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
                <SelectItem value="substituida">Substituídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cupons ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isFetching && filtered.length === 0 ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Nenhuma NFC-e encontrada no período.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead className="hidden md:table-cell">Série</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead className="hidden lg:table-cell">Emitente</TableHead>
                      <TableHead className="hidden lg:table-cell">Consumidor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">XML</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number || '—'}</TableCell>
                        <TableCell className="hidden md:table-cell">{inv.series || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(inv.issue_date)}</TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[220px] truncate">{inv.emitter_name || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px] truncate">{inv.consumer_name || inv.consumer_document || '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(inv.total_value || 0))}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadXml(inv)} disabled={!!downloading[inv.id]}>
                            {downloading[inv.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">Página {page + 1} de {pageCount}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
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
