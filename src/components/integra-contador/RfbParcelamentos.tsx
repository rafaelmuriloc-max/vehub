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
  origem: 'RFB' | 'PGFN';
};

// Mapeia o serviço de pedidos (PEDIDOSPARC*) para os serviços de
// "parcelas para impressão" e "emissão de DAS" da mesma modalidade.
const PARCELAS_SERVICES: Record<string, { idSistema: string; parcelasService: string; emitirService: string } | undefined> = {
  PEDIDOSPARC163: { idSistema: 'PARCSN',      parcelasService: 'PARCELASPARAGERAR162', emitirService: 'GERARDAS161' },
  PEDIDOSPARC173: { idSistema: 'PARCSN-ESP',  parcelasService: 'PARCELASPARAGERAR172', emitirService: 'GERARDAS171' },
  PEDIDOSPARC183: { idSistema: 'PERTSN',      parcelasService: 'PARCELASPARAGERAR182', emitirService: 'GERARDAS181' },
  PEDIDOSPARC193: { idSistema: 'RELPSN',      parcelasService: 'PARCELASPARAGERAR192', emitirService: 'GERARDAS191' },
  PEDIDOSPARC203: { idSistema: 'PARCMEI',     parcelasService: 'PARCELASPARAGERAR202', emitirService: 'GERARDAS201' },
  PEDIDOSPARC213: { idSistema: 'PARCMEI-ESP', parcelasService: 'PARCELASPARAGERAR212', emitirService: 'GERARDAS211' },
  PEDIDOSPARC223: { idSistema: 'PERTMEI',     parcelasService: 'PARCELASPARAGERAR222', emitirService: 'GERARDAS221' },
  PEDIDOSPARC233: { idSistema: 'RELPMEI',     parcelasService: 'PARCELASPARAGERAR232', emitirService: 'GERARDAS231' },
};

const ENCERRADO_REGEX = /encerrad|liquidad|rescind|cancelad/i;

const MODALIDADES: Modalidade[] = [
  // Receita Federal — Simples Nacional / MEI
  { idSistema: 'PARCSN', idServico: 'PEDIDOSPARC163', label: 'RFB - Ordinário SN', origem: 'RFB' },
  { idSistema: 'PARCSN-ESP', idServico: 'PEDIDOSPARC173', label: 'RFB - Especial SN', origem: 'RFB' },
  { idSistema: 'PERTSN', idServico: 'PEDIDOSPARC183', label: 'RFB - PERT-SN', origem: 'RFB' },
  { idSistema: 'RELPSN', idServico: 'PEDIDOSPARC193', label: 'RFB - RELP-SN', origem: 'RFB' },
  { idSistema: 'PARCMEI', idServico: 'PEDIDOSPARC203', label: 'RFB - Ordinário MEI', origem: 'RFB' },
  { idSistema: 'PARCMEI-ESP', idServico: 'PEDIDOSPARC213', label: 'RFB - Especial MEI', origem: 'RFB' },
  { idSistema: 'PERTMEI', idServico: 'PEDIDOSPARC223', label: 'RFB - PERT-MEI', origem: 'RFB' },
  { idSistema: 'RELPMEI', idServico: 'PEDIDOSPARC233', label: 'RFB - RELP-MEI', origem: 'RFB' },
  // PGFN — Dívida Ativa da União: NÃO há serviço público no Integra Contador SERPRO
  // (sistema PARCMEPN/OBTERPARC24x retorna "Identificação do sistema ou serviço inválida").
  // Para PGFN, consultar diretamente o portal REGULARIZE.
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
  origem?: string | null;
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

export default function RfbParcelamentos() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<ParcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('all');
  const [filterSituacao, setFilterSituacao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultingId, setConsultingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [detailRow, setDetailRow] = useState<ParcRow | null>(null);
  const [parcelas, setParcelas] = useState<Array<{ parcela: string; valor: number | null }>>([]);
  const [parcelasLoading, setParcelasLoading] = useState(false);
  const [parcelasError, setParcelasError] = useState<string | null>(null);
  const [emittingParcela, setEmittingParcela] = useState<string | null>(null);

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
            modalidade: mod.idServico,
            modalidade_label: mod.label,
            origem: mod.origem,
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
            modalidade: mod.idServico,
            modalidade_label: mod.label,
            origem: mod.origem,
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
          modalidade: mod.idServico,
          modalidade_label: mod.label,
          origem: mod.origem,
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
      if (filterOrigem !== 'all') {
        if (!it.parc || (it.parc.origem || 'RFB') !== filterOrigem) return false;
      }
      if (filterSituacao !== 'all') {
        if (filterSituacao === 'sem' && it.parc) return false;
        if (filterSituacao === 'com' && (!it.parc || it.parc.status !== 'success')) return false;
        if (filterSituacao === 'erro' && (!it.parc || it.parc.status !== 'error')) return false;
        if (filterSituacao === 'no_data' && (!it.parc || it.parc.status !== 'no_data')) return false;
      }
      return true;
    });
  }, [display, search, filterModalidade, filterOrigem, filterSituacao]);

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

  function currentYyyymm(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatParcelaLabel(yyyymm: string): string {
    if (/^\d{6}$/.test(yyyymm)) return `${yyyymm.slice(4, 6)}/${yyyymm.slice(0, 4)}`;
    return yyyymm;
  }

  function extractParcelasList(raw: any): Array<{ parcela: string; valor: number | null }> {
    let dados = raw?.dados ?? raw?.data?.dados ?? raw?.pedidoDados?.dados ?? raw;
    if (typeof dados === 'string') {
      try { dados = JSON.parse(dados); } catch { return []; }
    }
    let lista: any[] = [];
    if (Array.isArray(dados)) lista = dados;
    else if (Array.isArray(dados?.listaParcelas)) lista = dados.listaParcelas;
    else if (Array.isArray(dados?.parcelas)) lista = dados.parcelas;
    else {
      for (const k of Object.keys(dados || {})) {
        if (Array.isArray(dados[k])) { lista = dados[k]; break; }
      }
    }
    return lista
      .map((p: any) => ({
        parcela: String(p?.parcela ?? p?.numeroParcela ?? p?.competencia ?? '').replace(/\D/g, '').slice(0, 6),
        valor: Number(p?.valor ?? p?.valorParcela ?? p?.valorTotal ?? 0) || null,
      }))
      .filter((p) => /^\d{6}$/.test(p.parcela));
  }

  async function loadParcelas(row: ParcRow) {
    const map = PARCELAS_SERVICES[row.modalidade];
    if (!map) { setParcelas([]); setParcelasError(null); return; }
    if (row.situacao && ENCERRADO_REGEX.test(row.situacao)) {
      setParcelas([]); setParcelasError(null); return;
    }
    setParcelasLoading(true);
    setParcelasError(null);
    setParcelas([]);
    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: row.client_id,
          idSistema: map.idSistema,
          idServico: map.parcelasService,
          tipo: 'Consultar',
          dados: '',
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
        throw new Error(msgs || data?.error || 'Falha ao obter parcelas');
      }
      const lista = extractParcelasList(data?.data || data);
      const limite = currentYyyymm();
      const abertas = lista.filter((p) => p.parcela <= limite);
      abertas.sort((a, b) => a.parcela.localeCompare(b.parcela));
      setParcelas(abertas);
    } catch (err: any) {
      setParcelasError(err?.message || String(err));
    } finally {
      setParcelasLoading(false);
    }
  }

  useEffect(() => {
    if (detailRow && detailRow.status === 'success') {
      loadParcelas(detailRow);
    } else {
      setParcelas([]);
      setParcelasError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRow?.id]);

  async function handleGerarGuia(parcelaYyyymm: string) {
    if (!detailRow) return;
    const map = PARCELAS_SERVICES[detailRow.modalidade];
    if (!map) return;
    setEmittingParcela(parcelaYyyymm);
    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: detailRow.client_id,
          idSistema: map.idSistema,
          idServico: map.emitirService,
          tipo: 'Emitir',
          dados: JSON.stringify({ parcelaParaEmitir: parcelaYyyymm }),
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
        throw new Error(msgs || data?.error || 'Falha ao gerar guia');
      }
      let payload: any = data?.data?.dados ?? data?.data;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { /* keep */ } }
      const pdfB64: string | undefined = payload?.docArrecadacaoPdfB64 ?? payload?.pdf ?? payload?.documento;
      if (!pdfB64) throw new Error('PDF não retornado pelo SERPRO');
      const a = document.createElement('a');
      a.href = `data:application/pdf;base64,${pdfB64}`;
      a.download = `DAS-${parcelaYyyymm}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Guia gerada', description: `Parcela ${formatParcelaLabel(parcelaYyyymm)}` });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar guia', description: err?.message, variant: 'destructive' });
    } finally {
      setEmittingParcela(null);
    }
  }

  return (
    <div className="space-y-4">
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
                  <SelectItem key={m.idServico} value={m.idServico}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger className="md:w-36"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="RFB">Receita Federal</SelectItem>
                <SelectItem value="PGFN">PGFN</SelectItem>
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
                <TableHead>Origem</TableHead>
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
                  <TableCell colSpan={12} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>
                      {it.parc?.origem
                        ? <Badge variant={it.parc.origem === 'PGFN' ? 'secondary' : 'outline'}>{it.parc.origem}</Badge>
                        : '-'}
                    </TableCell>
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

              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Parcelas em aberto até hoje</div>
                {detailRow.origem === 'PGFN' ? (
                  <div className="text-sm text-muted-foreground">
                    Emissão de guia PGFN não suportada via Integra Contador.
                  </div>
                ) : !PARCELAS_SERVICES[detailRow.modalidade] ? (
                  <div className="text-sm text-muted-foreground">
                    Modalidade sem suporte a emissão de guia.
                  </div>
                ) : detailRow.situacao && ENCERRADO_REGEX.test(detailRow.situacao) ? (
                  <div className="text-sm text-muted-foreground">
                    Parcelamento encerrado — sem parcelas a emitir.
                  </div>
                ) : parcelasLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando parcelas...
                  </div>
                ) : parcelasError ? (
                  <div className="text-sm text-destructive">{parcelasError}</div>
                ) : parcelas.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma parcela em aberto até hoje.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelas.map((p) => (
                        <TableRow key={p.parcela}>
                          <TableCell className="font-mono">{formatParcelaLabel(p.parcela)}</TableCell>
                          <TableCell>
                            {p.valor != null
                              ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleGerarGuia(p.parcela)}
                              disabled={emittingParcela === p.parcela}
                            >
                              {emittingParcela === p.parcela
                                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                : null}
                              Gerar guia
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Resposta bruta</summary>
                <ScrollArea className="max-h-[300px] rounded border mt-2">
                  <pre className="text-xs p-3 whitespace-pre-wrap break-all">
                    {JSON.stringify(detailRow.raw_response, null, 2)}
                  </pre>
                </ScrollArea>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}