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
import { formatClientLabel } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Send, FileDown } from 'lucide-react';

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

type GuiaFile = { file: File; parcela: string };

type Client = {
  id: string;
  sci_code?: string | null;
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
  const [page, setPage] = useState(1);
  const { user, profile } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [guias, setGuias] = useState<Record<string, GuiaFile>>({});
  const [picker, setPicker] = useState<{ row: ParcRow; lista: Array<{ parcela: string; valor: number | null }>; sel: string; thenSend: boolean } | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [sendState, setSendState] = useState<{ row: ParcRow; guia: GuiaFile; conversationId: string | null; phone: string | null; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, sci_code, company_name, document')
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

  async function consultarCliente(clientId: string, only?: string): Promise<void> {
    // Apaga registros anteriores deste cliente (ou só da modalidade) para evitar duplicação
    if (only) {
      await supabase.from('parcelamento_results' as any).delete().eq('client_id', clientId).in('modalidade', [only, '_none']);
    } else {
      await supabase.from('parcelamento_results' as any).delete().eq('client_id', clientId);
    }

    const toInsert: any[] = [];
    for (const mod of MODALIDADES.filter(m => !only || m.idServico === only)) {
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

    if (toInsert.length === 0 && !only) {
      // grava marcador de "sem parcelamentos" para indicar que já foi consultado
      toInsert.push({
        client_id: clientId,
        modalidade: '_none',
        modalidade_label: 'Sem parcelamentos',
        status: 'no_data',
        consulted_at: new Date().toISOString(),
      });
    }

    if (toInsert.length) await supabase.from('parcelamento_results' as any).insert(toInsert as any);
  }

  async function handleAtualizarParc(row: ParcRow) {
    setBusyKey(`upd:${row.id}`);
    try {
      await consultarCliente(row.client_id, row.modalidade);
      await loadData();
      toast({ title: 'Parcelamento atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err?.message, variant: 'destructive' });
    } finally { setBusyKey(null); }
  }

  async function fetchParcelas(row: ParcRow) {
    const map = PARCELAS_SERVICES[row.modalidade];
    if (!map) throw new Error('Modalidade sem emissão de guia');
    const { data, error } = await supabase.functions.invoke('integra-contador', {
      body: { client_id: row.client_id, idSistema: map.idSistema, idServico: map.parcelasService, tipo: 'Consultar', dados: '' },
    });
    if (error) throw error;
    if (!data?.success) {
      const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
      throw new Error(msgs || data?.error || 'Falha ao obter parcelas');
    }
    const lista = extractParcelasList(data?.data || data).filter(p => p.parcela <= currentYyyymm());
    lista.sort((a, b) => b.parcela.localeCompare(a.parcela));
    return lista;
  }

  function findPdf(obj: any, depth = 0): string | null {
    if (!obj || depth > 6) return null;
    if (typeof obj === 'string') {
      if (obj.startsWith('JVBERi0')) return obj;
      if (obj.trim().startsWith('{') || obj.trim().startsWith('[')) { try { return findPdf(JSON.parse(obj), depth + 1); } catch { return null; } }
      return null;
    }
    if (typeof obj === 'object') {
      for (const v of Object.values(obj)) { const r = findPdf(v, depth + 1); if (r) return r; }
    }
    return null;
  }

  async function emitGuia(row: ParcRow, parcela: string): Promise<GuiaFile> {
    const map = PARCELAS_SERVICES[row.modalidade];
    if (!map) throw new Error('Modalidade sem emissão de guia');
    const { data, error } = await supabase.functions.invoke('integra-contador', {
      body: { client_id: row.client_id, idSistema: map.idSistema, idServico: map.emitirService, tipo: 'Emitir', dados: JSON.stringify({ parcelaParaEmitir: parcela }) },
    });
    if (error) throw error;
    if (!data?.success) {
      const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
      throw new Error(msgs || data?.error || 'Falha ao gerar guia');
    }
    const b64 = findPdf(data?.data);
    if (!b64) throw new Error('PDF não retornado pela Receita');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const client = clients.find(c => c.id === row.client_id);
    const nome = (client?.company_name || 'EMPRESA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    const fileName = `Parcela_${(row.modalidade_label || 'Parcelamento').replace(/[^a-zA-Z0-9]+/g, '_')}_${parcela}_${nome}.pdf`;
    const g: GuiaFile = { file: new File([bytes], fileName, { type: 'application/pdf' }), parcela };
    setGuias(prev => ({ ...prev, [row.id]: g }));
    return g;
  }

  function downloadFile(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Gera a parcela: 1 disponível => direto; várias => escolha
  async function startGerar(row: ParcRow, thenSend: boolean) {
    setBusyKey(`${thenSend ? 'send' : 'gen'}:${row.id}`);
    try {
      const lista = await fetchParcelas(row);
      if (!lista.length) { toast({ title: 'Nenhuma parcela disponível para gerar' }); return; }
      if (lista.length === 1) {
        await finishGerar(row, lista[0].parcela, thenSend);
      } else {
        setPicker({ row, lista, sel: lista.find(p => p.parcela === currentYyyymm())?.parcela || lista[0].parcela, thenSend });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao buscar parcelas', description: err?.message, variant: 'destructive' });
    } finally { setBusyKey(null); }
  }

  async function finishGerar(row: ParcRow, parcela: string, thenSend: boolean) {
    const g = await emitGuia(row, parcela);
    if (thenSend) openSend(row, g);
    else { downloadFile(g.file); toast({ title: 'Guia gerada', description: `Parcela ${formatParcelaLabel(parcela)}` }); }
  }

  async function confirmPicker() {
    if (!picker) return;
    const { row, sel, thenSend } = picker;
    setPickerBusy(true);
    try { await finishGerar(row, sel, thenSend); setPicker(null); }
    catch (err: any) { toast({ title: 'Erro ao gerar guia', description: err?.message, variant: 'destructive' }); }
    finally { setPickerBusy(false); }
  }

  async function openSend(row: ParcRow, g: GuiaFile) {
    const client = clients.find(c => c.id === row.client_id);
    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('id, whatsapp_phone, is_group, updated_at')
      .eq('client_id', row.client_id)
      .not('whatsapp_phone', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);
    const conv = (convs || []).find((c: any) => !c.is_group) || null;
    setSendState({
      row, guia: g, conversationId: conv?.id || null, phone: conv?.whatsapp_phone || null,
      text: `Olá! Segue a guia da parcela ${formatParcelaLabel(g.parcela)} do parcelamento ${row.modalidade_label || ''}${row.numero_parcelamento ? ` nº ${row.numero_parcelamento}` : ''} da empresa ${client?.company_name || ''}. Qualquer dúvida, estamos à disposição.`,
    });
  }

  async function handleEnviar(row: ParcRow) {
    const g = guias[row.id];
    if (g) { await openSend(row, g); return; }
    await startGerar(row, true);
  }

  async function confirmSend() {
    if (!sendState?.conversationId || !user) return;
    setSending(true);
    try {
      const f = sendState.guia.file;
      const path = `${sendState.conversationId}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, f);
      if (upErr) throw upErr;
      const mediaUrl = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
      if (sendState.text.trim()) {
        const { data: d1, error: e1 } = await supabase.functions.invoke('whatsapp-send-text', {
          body: { conversationId: sendState.conversationId, text: sendState.text.trim(), senderName: profile?.full_name || undefined, senderId: user.id },
        });
        if (e1 || (d1 as any)?.error) throw new Error((d1 as any)?.error || e1?.message);
      }
      const { data: d2, error: e2 } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId: sendState.conversationId, type: 'document', mediaUrl, fileName: f.name, senderName: profile?.full_name || undefined, senderId: user.id },
      });
      if (e2 || (d2 as any)?.error) throw new Error((d2 as any)?.error || e2?.message);
      toast({ title: 'Guia enviada no WhatsApp' });
      setSendState(null);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: String(err?.message || err).slice(0, 200), variant: 'destructive' });
    } finally { setSending(false); }
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
    const sDigits = s.replace(/\D/g, '');
    return display.filter(it => {
      if (s) {
        const hay = `${formatClientLabel(it.client)} ${it.client.sci_code || ''} ${it.client.document || ''}`.toLowerCase();
        const docDigits = (it.client.document || '').replace(/\D/g, '');
        if (!hay.includes(s) && !(sDigits.length >= 3 && docDigits.includes(sDigits))) return false;
      }
      if (filterModalidade !== 'all') {
        if (!it.parc || it.parc.modalidade !== filterModalidade) return false;
      }
      if (filterOrigem !== 'all') {
        if (!it.parc || (it.parc.origem || 'RFB') !== filterOrigem) return false;
      }
      if (it.parc?.status === 'no_data') return false;
      if (filterSituacao !== 'sem' && filterSituacao !== 'erro' && it.parc?.status !== 'success') return false;
      if (filterSituacao !== 'all') {
        if (filterSituacao === 'sem' && it.parc) return false;
        if (filterSituacao === 'com' && (!it.parc || it.parc.status !== 'success')) return false;
        if (filterSituacao === 'ativo' && (!it.parc || it.parc.status !== 'success' || (it.parc.situacao && ENCERRADO_REGEX.test(it.parc.situacao)))) return false;
        if (filterSituacao === 'encerrado' && (!it.parc || !it.parc.situacao || !ENCERRADO_REGEX.test(it.parc.situacao))) return false;
        if (filterSituacao === 'erro' && (!it.parc || it.parc.status !== 'error')) return false;
        if (filterSituacao === 'no_data' && (!it.parc || it.parc.status !== 'no_data')) return false;
      }
      return true;
    });
  }, [display, search, filterModalidade, filterOrigem, filterSituacao]);

  const PAGE_SIZE = 15;
  const companies = useMemo(() => {
    const map = new Map<string, { client: Client; parcs: ParcRow[] }>();
    filtered.forEach(it => {
      const e = map.get(it.client.id) || { client: it.client, parcs: [] };
      if (it.parc) e.parcs.push(it.parc);
      map.set(it.client.id, e);
    });
    return Array.from(map.values());
  }, [filtered]);
  const totalPages = Math.max(1, Math.ceil(companies.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCompanies = companies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterModalidade, filterOrigem, filterSituacao]);

  const kpis = useMemo(() => {
    const ativos = rows.filter(r => r.status === 'success' && !(r.situacao && ENCERRADO_REGEX.test(r.situacao)));
    const empresas = new Set(ativos.map(r => r.client_id)).size;
    const total = ativos.reduce((s, r) => s + (r.valor_total || 0), 0);
    const consultados = new Set(rows.map(r => r.client_id));
    const erros = new Set(rows.filter(r => r.status === 'error').map(r => r.client_id)).size;
    return { empresas, ativos: ativos.length, total, naoConsultados: clients.filter(c => !consultados.has(c.id)).length, erros };
  }, [rows, clients]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Empresas com parcelamento', value: String(kpis.empresas), sub: `${kpis.ativos} parcelamento(s) ativo(s)`, f: 'ativo' },
          { label: 'Total parcelado (ativos)', value: kpis.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sub: 'Soma dos parcelamentos ativos', f: 'ativo' },
          { label: 'Não consultadas', value: String(kpis.naoConsultados), sub: 'Empresas ainda sem consulta', f: 'sem' },
          { label: 'Com erro na consulta', value: String(kpis.erros), sub: 'Recusas ou falhas da Receita', f: 'erro' },
        ].map(k => (
          <button key={k.label} type="button" onClick={() => setFilterSituacao(filterSituacao === k.f ? 'all' : k.f)}
            className={`text-left rounded-xl border bg-card p-4 transition-colors hover:bg-muted ${filterSituacao === k.f ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 truncate">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>
          </button>
        ))}
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
                placeholder="Buscar por empresa, código SCI ou CNPJ..."
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
                <SelectItem value="ativo">Parcelamento ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado/liquidado</SelectItem>
                <SelectItem value="com">Com parcelamento</SelectItem>
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
          <div className="flex items-center gap-3 px-4 py-2 border-b text-sm text-muted-foreground">
            <Checkbox checked={filteredClientIds.length > 0 && selected.size === filteredClientIds.length} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
            <span>Empresas</span>
          </div>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : pagedCompanies.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhuma empresa encontrada</div>
          ) : pagedCompanies.map(({ client, parcs }) => {
            const ok = parcs.filter(p => p.status === 'success');
            const ativos = ok.filter(p => !(p.situacao && ENCERRADO_REGEX.test(p.situacao)));
            const total = ativos.reduce((a, p) => a + (p.valor_total || 0), 0);
            const last = parcs.reduce<string | null>((m, p) => (!m || p.consulted_at > m ? p.consulted_at : m), null);
            const hasErr = parcs.some(p => p.status === 'error');
            const badge = !parcs.length
              ? <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Não consultada</Badge>
              : ok.length
                ? <Badge className="gap-1 bg-primary"><CheckCircle2 className="h-3 w-3" />Com parcelamento</Badge>
                : hasErr
                  ? <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>
                  : <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sem parcelamentos</Badge>;
            const groups = new Map<string, ParcRow[]>();
            parcs.filter(p => p.status !== 'no_data').forEach(p => {
              const k = p.modalidade_label || p.modalidade;
              groups.set(k, [...(groups.get(k) || []), p]);
            });
            const isOpen = expanded.has(client.id);
            return (
              <Collapsible key={client.id} open={isOpen} onOpenChange={o => setExpanded(prev => { const n = new Set(prev); if (o) n.add(client.id); else n.delete(client.id); return n; })} className="border-b last:border-b-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Checkbox checked={selected.has(client.id)} onCheckedChange={() => toggleSelect(client.id)} aria-label="Selecionar empresa" />
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{formatClientLabel(client)}</div>
                        <div className="text-xs text-muted-foreground font-mono">{formatCnpj(client.document)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {badge}
                        {ativos.length > 0 && <span>{ativos.length} ativo(s) • {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                        {last && <span className="hidden lg:inline">Consulta: {formatDateTime(last)}</span>}
                      </div>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform hidden md:block ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <Button size="sm" variant="outline" onClick={() => handleConsultarIndividual(client.id)} disabled={consultingId === client.id || batchRunning} title="Consultar todas as categorias">
                    {consultingId === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                    <span className="ml-1 hidden sm:inline">Consultar</span>
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4 bg-muted/30">
                    {groups.size === 0 ? (
                      <p className="text-sm text-muted-foreground pt-3">{parcs.length ? 'Nenhum parcelamento encontrado nesta empresa.' : 'Empresa ainda não consultada. Clique em Consultar.'}</p>
                    ) : Array.from(groups.entries()).map(([label, list]) => (
                      <div key={label} className="pt-3">
                        <div className="text-sm font-semibold text-foreground mb-2">{label} <Badge variant="secondary" className="ml-1">{list.length}</Badge></div>
                        <div className="grid gap-2">
                          {list.map(p => {
                            const encerrado = !!(p.situacao && ENCERRADO_REGEX.test(p.situacao));
                            const canEmit = p.status === 'success' && !encerrado && !!PARCELAS_SERVICES[p.modalidade];
                            const g = guias[p.id];
                            return (
                              <div key={p.id} className={`rounded-lg border bg-card p-3 ${encerrado ? 'opacity-60' : ''}`}>
                                {p.status === 'error' ? (
                                  <div className="text-sm text-destructive">{p.error_message || 'Erro na consulta'}</div>
                                ) : (
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                    <div><div className="text-xs text-muted-foreground">Nº</div><div className="font-mono">{p.numero_parcelamento || '-'}</div></div>
                                    <div><div className="text-xs text-muted-foreground">Situação</div><div>{p.situacao || '-'}</div></div>
                                    <div><div className="text-xs text-muted-foreground">Pedido</div><div>{formatDate(p.data_pedido)}</div></div>
                                    <div><div className="text-xs text-muted-foreground">Valor total</div><div>{p.valor_total != null ? p.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</div></div>
                                    <div><div className="text-xs text-muted-foreground">Parcelas</div><div>{p.parcelas_total != null ? `${p.parcelas_pagas ?? 0} / ${p.parcelas_total}` : '-'}</div></div>
                                  </div>
                                )}
                                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3">
                                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleAtualizarParc(p)} disabled={!!busyKey}>
                                    {busyKey === `upd:${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}Atualizar
                                  </Button>
                                  <Button size="sm" className="w-full sm:w-auto" onClick={() => startGerar(p, false)} disabled={!canEmit || !!busyKey}>
                                    {busyKey === `gen:${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileDown className="h-3 w-3 mr-1" />}Gerar parcela
                                  </Button>
                                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => handleEnviar(p)} disabled={!canEmit || !!busyKey}>
                                    {busyKey === `send:${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Enviar{g ? ` (${formatParcelaLabel(g.parcela)})` : ''}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setDetailRow(p)}>
                                    <Eye className="h-3 w-3 mr-1" />Detalhes
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 border-t text-sm text-muted-foreground">
            <span>{companies.length} empresa(s) • Página {safePage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!picker} onOpenChange={o => !o && !pickerBusy && setPicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Escolha a parcela</DialogTitle></DialogHeader>
          {picker && (
            <div className="space-y-3">
              <Select value={picker.sel} onValueChange={v => setPicker({ ...picker, sel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {picker.lista.map(p => (
                    <SelectItem key={p.parcela} value={p.parcela}>
                      {formatParcelaLabel(p.parcela)}{p.valor != null ? ` • ${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setPicker(null)} disabled={pickerBusy}>Cancelar</Button>
                <Button onClick={confirmPicker} disabled={pickerBusy}>
                  {pickerBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{picker.thenSend ? 'Gerar e continuar' : 'Gerar guia'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendState} onOpenChange={o => !o && !sending && setSendState(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enviar guia no WhatsApp</DialogTitle></DialogHeader>
          {sendState && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium truncate">{sendState.guia.file.name}</div>
                <div className="text-xs text-muted-foreground">Parcela {formatParcelaLabel(sendState.guia.parcela)} • {(sendState.guia.file.size / 1024).toFixed(0)} KB</div>
                <Button size="sm" variant="link" className="px-0" onClick={() => downloadFile(sendState.guia.file)}>Baixar guia</Button>
              </div>
              {sendState.conversationId ? (
                <div className="text-sm text-muted-foreground">Para: {sendState.phone}</div>
              ) : (
                <div className="text-sm text-destructive">Esta empresa não tem conversa de WhatsApp no Chat. Inicie uma conversa com o cliente para poder enviar.</div>
              )}
              <Textarea rows={5} value={sendState.text} onChange={e => setSendState({ ...sendState, text: e.target.value })} />
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setSendState(null)} disabled={sending}>Cancelar</Button>
                <Button onClick={confirmSend} disabled={sending || !sendState.conversationId}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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