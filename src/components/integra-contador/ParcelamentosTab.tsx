import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Search, PlayCircle, Eye, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

type Modalidade = {
  idSistema: string;
  idServico: string;
  label: string;
};

const MODALIDADES: Modalidade[] = [
  { idSistema: 'PARCSN', idServico: 'PEDIDOSPARC163', label: 'Ordinário SN' },
  { idSistema: 'PARCSN-ESP', idServico: 'PEDIDOSPARC173', label: 'Especial SN' },
  { idSistema: 'PERTSN', idServico: 'PEDIDOSPARC183', label: 'PERT-SN' },
  { idSistema: 'RELPSN', idServico: 'PEDIDOSPARC193', label: 'RELP-SN' },
  { idSistema: 'PARCMEI', idServico: 'PEDIDOSPARC203', label: 'Ordinário MEI' },
  { idSistema: 'PARCMEI-ESP', idServico: 'PEDIDOSPARC213', label: 'Especial MEI' },
  { idSistema: 'PERTMEI', idServico: 'PEDIDOSPARC223', label: 'PERT-MEI' },
  { idSistema: 'RELPMEI', idServico: 'PEDIDOSPARC233', label: 'RELP-MEI' },
];

type Client = {
  id: string;
  company_name: string;
  document: string | null;
};

type ParcRow = {
  id: string;
  client_id: string;
  modalidade: string;
  modalidade_label: string | null;
  numero_parcelamento: string | null;
  situacao: string | null;
  data_pedido: string | null;
  valor_total: number | null;
  parcelas_pagas: number | null;
  parcelas_total: number | null;
  raw_response: any;
  status: string;
  error_message: string | null;
  consulted_at: string;
};

function formatCnpj(doc: string | null): string {
  if (!doc) return '-';
  const d = doc.replace(/\D/g, '');
  if (d.length !== 14) return doc;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}

function formatDateTime(d: string | null): string {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('pt-BR'); } catch { return d; }
}

function formatBrlDate(yyyymmdd: any): string | null {
  if (!yyyymmdd) return null;
  const s = String(yyyymmdd);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

// Extrai array de parcelamentos da resposta SERPRO de forma resiliente
function extractParcelamentos(rawData: any): any[] {
  if (!rawData) return [];
  let dados = rawData?.dados ?? rawData?.data?.dados ?? rawData?.pedidoDados?.dados ?? rawData;
  if (typeof dados === 'string') {
    try { dados = JSON.parse(dados); } catch { return []; }
  }
  if (!dados) return [];
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.parcelamentos)) return dados.parcelamentos;
  if (Array.isArray(dados?.listaParcelamentos)) return dados.listaParcelamentos;
  // procura primeiro array dentro do objeto
  for (const k of Object.keys(dados)) {
    if (Array.isArray((dados as any)[k])) return (dados as any)[k];
  }
  return [];
}

function normalizeParc(p: any) {
  const numero = p?.numero ?? p?.numeroParcelamento ?? p?.nrParcelamento ?? null;
  const situacao = p?.situacao ?? p?.situacaoParcelamento ?? p?.status ?? null;
  const dataPedidoRaw = p?.dataDoPedido ?? p?.dataPedido ?? p?.dataAdesao ?? null;
  const valor = Number(p?.valorTotal ?? p?.valorConsolidado ?? p?.valor ?? 0) || null;
  const pagas = p?.parcelasPagas ?? p?.qtdParcelasPagas ?? null;
  const total = p?.totalParcelas ?? p?.qtdParcelas ?? p?.parcelasTotal ?? null;
  return {
    numero: numero ? String(numero) : null,
    situacao: situacao ? String(situacao) : null,
    data_pedido: formatBrlDate(dataPedidoRaw),
    valor_total: valor,
    parcelas_pagas: pagas != null ? Number(pagas) : null,
    parcelas_total: total != null ? Number(total) : null,
  };
}

export default function ParcelamentosTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<ParcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('all');
  const [filterSituacao, setFilterSituacao] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultingId, setConsultingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [detailRow, setDetailRow] = useState<ParcRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, company_name, document')
        .eq('status', 'active')
        .order('company_name');
      setClients((clientsData || []) as Client[]);

      const { data: parcData } = await supabase
        .from('parcelamento_results' as any)
        .select('*')
        .order('consulted_at', { ascending: false });
      setRows(((parcData || []) as any) as ParcRow[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function consultarCliente(clientId: string): Promise<void> {
    // Apaga registros anteriores deste cliente para evitar duplicação
    await supabase.from('parcelamento_results' as any).delete().eq('client_id', clientId);

    const toInsert: any[] = [];
    for (const mod of MODALIDADES) {
      try {
        const { data, error } = await supabase.functions.invoke('integra-contador', {
          body: {
            client_id: clientId,
            idSistema: mod.idSistema,
            idServico: mod.idServico,
            tipo: 'Consultar',
            dados: '',
          },
        });
        if (error) throw error;

        if (!data?.success) {
          const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
          // 404/sem dados => não cria linha
          if (data?.status === 404 || /no.*encontrad|sem.*dado|n[ãa]o.*possui/i.test(msgs || data?.error || '')) {
            continue;
          }
          toInsert.push({
            client_id: clientId,
            modalidade: mod.idSistema,
            modalidade_label: mod.label,
            status: 'error',
            error_message: msgs || data?.error || 'Erro desconhecido',
            raw_response: data,
            consulted_at: new Date().toISOString(),
          });
          continue;
        }

        const lista = extractParcelamentos(data?.data || data);
        if (!lista.length) continue;

        for (const p of lista) {
          const n = normalizeParc(p);
          toInsert.push({
            client_id: clientId,
            modalidade: mod.idSistema,
            modalidade_label: mod.label,
            numero_parcelamento: n.numero,
            situacao: n.situacao,
            data_pedido: n.data_pedido,
            valor_total: n.valor_total,
            parcelas_pagas: n.parcelas_pagas,
            parcelas_total: n.parcelas_total,
            raw_response: p,
            status: 'success',
            consulted_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        toInsert.push({
          client_id: clientId,
          modalidade: mod.idSistema,
          modalidade_label: mod.label,
          status: 'error',
          error_message: err?.message || String(err),
          consulted_at: new Date().toISOString(),
        });
      }
    }

    if (toInsert.length === 0) {
      // grava marcador de "sem parcelamentos" para indicar que já foi consultado
      toInsert.push({
        client_id: clientId,
        modalidade: '_none',
        modalidade_label: 'Sem parcelamentos',
        status: 'no_data',
        consulted_at: new Date().toISOString(),
      });
    }

    await supabase.from('parcelamento_results' as any).insert(toInsert as any);
  }

  async function handleConsultarIndividual(clientId: string) {
    setConsultingId(clientId);
    try {
      await consultarCliente(clientId);
      await loadData();
      toast({ title: 'Consulta concluída' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setConsultingId(null);
    }
  }

  async function handleConsultarSelecionados() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast({ title: 'Nenhum cliente selecionado', variant: 'destructive' });
      return;
    }
    setBatchRunning(true);
    setBatchProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try { await consultarCliente(ids[i]); } catch (err) { console.error(err); }
      setBatchProgress({ current: i + 1, total: ids.length });
    }
    setBatchRunning(false);
    setSelected(new Set());
    await loadData();
    toast({ title: 'Consulta em massa concluída' });
  }

  // Constrói "linhas" para exibição: uma linha por parcelamento; clientes sem registro aparecem como "não consultado"
  const display = useMemo(() => {
    type Item = {
      key: string;
      client: Client;
      parc: ParcRow | null;
    };
    const rowsByClient = new Map<string, ParcRow[]>();
    rows.forEach(r => {
      const arr = rowsByClient.get(r.client_id) || [];
      arr.push(r);
      rowsByClient.set(r.client_id, arr);
    });
    const items: Item[] = [];
    clients.forEach(c => {
      const list = rowsByClient.get(c.id) || [];
      if (list.length === 0) {
        items.push({ key: c.id, client: c, parc: null });
      } else {
        list.forEach(p => items.push({ key: p.id, client: c, parc: p }));
      }
    });
    return items;
  }, [clients, rows]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return display.filter(it => {
      if (s) {
        const hay = `${it.client.company_name} ${it.client.document || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (filterModalidade !== 'all') {
        if (!it.parc || it.parc.modalidade !== filterModalidade) return false;
      }
      if (filterSituacao !== 'all') {
        if (filterSituacao === 'sem' && it.parc) return false;
        if (filterSituacao === 'com' && (!it.parc || it.parc.status !== 'success')) return false;
        if (filterSituacao === 'erro' && (!it.parc || it.parc.status !== 'error')) return false;
        if (filterSituacao === 'no_data' && (!it.parc || it.parc.status !== 'no_data')) return false;
      }
      return true;
    });
  }, [display, search, filterModalidade, filterSituacao]);

  // Para seleção: lista única de clientes filtrados
  const filteredClientIds = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(it => set.add(it.client.id));
    return Array.from(set);
  }, [filtered]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === filteredClientIds.length) setSelected(new Set());
    else setSelected(new Set(filteredClientIds));
  }

  function statusBadge(parc: ParcRow | null) {
    if (!parc) return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Não consultado</Badge>;
    if (parc.status === 'error') return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
    if (parc.status === 'no_data') return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sem parcelamentos</Badge>;
    return <Badge className="gap-1 bg-primary"><CheckCircle2 className="h-3 w-3" />{parc.situacao || 'Em parcelamento'}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Parcelamentos</h1>
        <p className="text-muted-foreground mt-1">
          Parcelamentos SN/MEI das empresas consultados via Integra Contador
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa ou CNPJ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterModalidade} onValueChange={setFilterModalidade}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="Modalidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as modalidades</SelectItem>
                {MODALIDADES.map(m => (
                  <SelectItem key={m.idSistema} value={m.idSistema}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSituacao} onValueChange={setFilterSituacao}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas situações</SelectItem>
                <SelectItem value="com">Com parcelamento</SelectItem>
                <SelectItem value="no_data">Sem parcelamentos</SelectItem>
                <SelectItem value="sem">Não consultado</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleConsultarSelecionados}
              disabled={batchRunning || selected.size === 0}
              size="sm"
            >
              {batchRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Consultar selecionados ({selected.size})
            </Button>
            <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {batchRunning && (
              <div className="text-sm text-muted-foreground self-center">
                Progresso: {batchProgress.current} / {batchProgress.total}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredClientIds.length > 0 && selected.size === filteredClientIds.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Nº Parc.</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Data Pedido</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Última Consulta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(it => (
                  <TableRow key={it.key}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(it.client.id)}
                        onCheckedChange={() => toggleSelect(it.client.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{it.client.company_name}</TableCell>
                    <TableCell className="font-mono text-xs">{formatCnpj(it.client.document)}</TableCell>
                    <TableCell>{it.parc?.modalidade_label || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{it.parc?.numero_parcelamento || '-'}</TableCell>
                    <TableCell>{statusBadge(it.parc)}</TableCell>
                    <TableCell>{formatDate(it.parc?.data_pedido || null)}</TableCell>
                    <TableCell>
                      {it.parc?.valor_total != null
                        ? it.parc.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {it.parc?.parcelas_total != null
                        ? `${it.parc.parcelas_pagas ?? 0} / ${it.parc.parcelas_total}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(it.parc?.consulted_at || null)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {it.parc && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailRow(it.parc)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConsultarIndividual(it.client.id)}
                          disabled={consultingId === it.client.id || batchRunning}
                        >
                          {consultingId === it.client.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <PlayCircle className="h-3 w-3" />}
                          <span className="ml-1 hidden sm:inline">Consultar</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detailRow} onOpenChange={o => !o && setDetailRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do parcelamento</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Modalidade:</span> {detailRow.modalidade_label}</div>
                <div><span className="text-muted-foreground">Nº:</span> {detailRow.numero_parcelamento || '-'}</div>
                <div><span className="text-muted-foreground">Situação:</span> {detailRow.situacao || '-'}</div>
                <div><span className="text-muted-foreground">Data Pedido:</span> {formatDate(detailRow.data_pedido)}</div>
                <div><span className="text-muted-foreground">Valor Total:</span> {detailRow.valor_total != null ? detailRow.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</div>
                <div><span className="text-muted-foreground">Parcelas:</span> {detailRow.parcelas_total != null ? `${detailRow.parcelas_pagas ?? 0} / ${detailRow.parcelas_total}` : '-'}</div>
              </div>
              {detailRow.error_message && (
                <div className="text-sm text-destructive">{detailRow.error_message}</div>
              )}
              <ScrollArea className="max-h-[400px] rounded border">
                <pre className="text-xs p-3 whitespace-pre-wrap break-all">
                  {JSON.stringify(detailRow.raw_response, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}