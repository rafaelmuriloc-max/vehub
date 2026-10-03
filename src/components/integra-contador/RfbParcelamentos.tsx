import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { ChevronDown, Send, FileDown, Building2, Landmark, Briefcase, MoreVertical, CalendarDays, FileText, MessageCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Modalidade = {
  idSistema: string;
  idServico: string;
  label: string;
  origem: 'RFB' | 'PGFN';
};

// Mapeia o serviço de pedidos (PEDIDOSPARC*) para os serviços de
// "parcelas para impressão" e "emissão de DAS" da mesma modalidade.
const PARCELAS_SERVICES: Record<string, { idSistema: string; parcelasService: string; emitirService: string; obterService: string } | undefined> = {
  PEDIDOSPARC163: { idSistema: 'PARCSN',      parcelasService: 'PARCELASPARAGERAR162', emitirService: 'GERARDAS161', obterService: 'OBTERPARC164' },
  PEDIDOSPARC173: { idSistema: 'PARCSN-ESP',  parcelasService: 'PARCELASPARAGERAR172', emitirService: 'GERARDAS171', obterService: 'OBTERPARC174' },
  PEDIDOSPARC183: { idSistema: 'PERTSN',      parcelasService: 'PARCELASPARAGERAR182', emitirService: 'GERARDAS181', obterService: 'OBTERPARC184' },
  PEDIDOSPARC193: { idSistema: 'RELPSN',      parcelasService: 'PARCELASPARAGERAR192', emitirService: 'GERARDAS191', obterService: 'OBTERPARC194' },
  PEDIDOSPARC203: { idSistema: 'PARCMEI',     parcelasService: 'PARCELASPARAGERAR202', emitirService: 'GERARDAS201', obterService: 'OBTERPARC204' },
  PEDIDOSPARC213: { idSistema: 'PARCMEI-ESP', parcelasService: 'PARCELASPARAGERAR212', emitirService: 'GERARDAS211', obterService: 'OBTERPARC214' },
  PEDIDOSPARC223: { idSistema: 'PERTMEI',     parcelasService: 'PARCELASPARAGERAR222', emitirService: 'GERARDAS221', obterService: 'OBTERPARC224' },
  PEDIDOSPARC233: { idSistema: 'RELPMEI',     parcelasService: 'PARCELASPARAGERAR232', emitirService: 'GERARDAS231', obterService: 'OBTERPARC234' },
};

const ENCERRADO_REGEX = /encerrad|liquidad|rescind|cancelad|sem efeito|n[aã]o validado/i;

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
type SendOption = { label: string; phone: string; conversationId: string | null };

const canonicalizePhone = (p?: string | null): string => {
  let d = (p || '').replace(/\D/g, '');
  if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) d = '55' + d;
  if (d.length === 12 && d.startsWith('55') && ['6', '7', '8', '9'].includes(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
};
const phoneVariants = (p: string): string[] => {
  const raw = (p || '').replace(/\D/g, '');
  const c = canonicalizePhone(raw);
  const set = new Set([raw, c]);
  if (c.length === 13 && c.startsWith('55') && c[4] === '9') set.add(c.slice(0, 4) + c.slice(5));
  return [...set].filter(Boolean);
};

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

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Extrai valores do OBTERPARC de forma tolerante
function parseDetalhe(d: any): { valor: number | null; total: number | null; pagas: number | null; parcela: number | null } {
  if (!d || typeof d !== 'object') return { valor: null, total: null, pagas: null, parcela: null };
  const c = d.consolidacaoOriginal || d.consolidacao || d;
  const valor = num(c?.valorTotalConsolidadoDaEntrada ?? c?.valorTotalConsolidado ?? c?.valorConsolidado ?? d?.valorTotalConsolidado);
  let total = num(c?.quantidadeParcelas ?? d?.quantidadeParcelas ?? d?.qtdParcelas);
  const parcela = num(c?.parcelaBasica ?? d?.parcelaBasica ?? d?.valorParcela);
  const pagos = d?.demonstrativoDePagamentos ?? d?.demonstrativoPagamentos ?? d?.pagamentos;
  const pagas = Array.isArray(pagos) ? pagos.length : null;
  if (total == null && Array.isArray(d?.alteracoesDeDivida) && d.alteracoesDeDivida.length) {
    const last = d.alteracoesDeDivida[d.alteracoesDeDivida.length - 1];
    total = num(last?.quantidadeParcelas ?? last?.parcelasRemanescentes);
  }
  return { valor, total, pagas, parcela };
}

type Pagamento = { parcela: string | null; data: string | null; valor: number | null; das: string | null };

function fmtYmd(v: any): string | null {
  if (v == null || v === '') return null;
  const s = String(v).replace(/\D/g, '');
  if (s.length === 8) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  if (s.length === 6) return `${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return String(v);
}

function extractPagamentos(d: any): Pagamento[] {
  const pagos = d?.demonstrativoDePagamentos ?? d?.demonstrativoPagamentos ?? d?.pagamentos;
  if (!Array.isArray(pagos)) return [];
  const list = pagos.map((p: any) => ({
    parcela: fmtYmd(p?.mesDaParcela ?? p?.parcela ?? p?.mesParcela ?? p?.periodoApuracao),
    data: fmtYmd(p?.dataDeArrecadacao ?? p?.dataArrecadacao ?? p?.dataDoPagamento ?? p?.dataPagamento),
    valor: num(p?.valorPago ?? p?.valor ?? p?.valorTotal),
    das: p?.numeroDas ?? p?.numeroDAS ?? p?.numeroDocumento ?? null,
    _k: String(p?.mesDaParcela ?? p?.parcela ?? p?.dataDeArrecadacao ?? p?.dataArrecadacao ?? ''),
  }));
  list.sort((a, b) => b._k.localeCompare(a._k));
  return list.map(({ _k, ...r }) => r);
}

const brl = (v: number | null | undefined) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

function monthsSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const n = new Date();
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()) + 1;
}

// Parcelas vencidas e não pagas (estimativa: uma parcela por mês desde o pedido)
function parcAtraso(p: ParcRow): number | null {
  if (p.parcelas_pagas == null) return null;
  const due = monthsSince(p.data_pedido);
  if (due == null) return null;
  const capped = p.parcelas_total != null ? Math.min(due - 1, p.parcelas_total) : due - 1;
  return Math.max(0, capped - p.parcelas_pagas);
}

function proximoVenc(p: ParcRow): Date | null {
  if (p.parcelas_total != null && p.parcelas_pagas != null && p.parcelas_pagas >= p.parcelas_total) return null;
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0);
}

function valorParcela(p: ParcRow): number | null {
  const r = p.raw_response || {};
  const det = r?.detalhe ?? r;
  const base = num(det?.consolidacaoOriginal?.parcelaBasica ?? det?.parcelaBasica ?? det?.valorParcela ?? r?.valorParcela);
  if (base != null) return base;
  if (p.valor_total != null && p.parcelas_total) return p.valor_total / p.parcelas_total;
  return null;
}

const isEncerrado = (p: ParcRow) => !!(p.situacao && ENCERRADO_REGEX.test(p.situacao));
const isMei = (p: ParcRow) => /MEI/i.test(p.modalidade_label || '') || ['PEDIDOSPARC203', 'PEDIDOSPARC213', 'PEDIDOSPARC223', 'PEDIDOSPARC233'].includes(p.modalidade);
const modTag = (p: ParcRow) => {
  const l = (p.modalidade_label || '').replace(/^RFB\s*-\s*/i, '');
  if (/^Ordinário SN$/i.test(l)) return 'SIMPLES NACIONAL';
  if (/^Ordinário MEI$/i.test(l)) return 'PARCMEI';
  return l.toUpperCase();
};

export type ParcSummary = {
  monitoradas: number; ativos: number; atraso: number; rescindidos: number; vence7: number;
  lastBatch: string | null; batchRunning: boolean; atualizarTodas: () => void;
};

export default function RfbParcelamentos({ onSummary }: { onSummary?: (s: ParcSummary) => void } = {}) {
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
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [pagamentosLoading, setPagamentosLoading] = useState(false);
  const [pagamentosError, setPagamentosError] = useState<string | null>(null);
  const [emittingParcela, setEmittingParcela] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const cancelRef = useRef(false);
  const { user, profile } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [guias, setGuias] = useState<Record<string, GuiaFile>>({});
  const [picker, setPicker] = useState<{ row: ParcRow; lista: Array<{ parcela: string; valor: number | null }>; sel: string; thenSend: boolean } | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [sendState, setSendState] = useState<{ row: ParcRow; guia: GuiaFile; options: SendOption[]; selected: number; text: string } | null>(null);
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
          let detalhe: any = null;
          const svc = PARCELAS_SERVICES[mod.idServico];
          if (svc && n.numero && !(n.situacao && ENCERRADO_REGEX.test(n.situacao))) {
            try {
              const { data: dd } = await supabase.functions.invoke('integra-contador', {
                body: { client_id: clientId, idSistema: svc.idSistema, idServico: svc.obterService, tipo: 'Consultar', dados: JSON.stringify({ numeroParcelamento: Number(n.numero) }) },
              });
              if (dd?.success) {
                let d: any = dd?.data?.dados ?? dd?.data;
                if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
                detalhe = d;
                const det = parseDetalhe(d);
                if (det.valor != null) n.valor_total = det.valor;
                if (det.total != null) n.parcelas_total = det.total;
                if (det.pagas != null) n.parcelas_pagas = det.pagas;
              }
            } catch (e) { console.warn('OBTERPARC falhou', e); }
          }
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
            raw_response: detalhe ? { ...p, detalhe } : p,
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
    const [{ data: convs }, { data: cli }, { data: deps }] = await Promise.all([
      supabase.from('chat_conversations').select('id, name, whatsapp_phone, is_group, updated_at')
        .eq('client_id', row.client_id).not('whatsapp_phone', 'is', null).order('updated_at', { ascending: false }).limit(10),
      supabase.from('clients').select('contact_name, contact_phone, phone').eq('id', row.client_id).maybeSingle(),
      supabase.from('client_department_contacts').select('contact_name, contact_phone').eq('client_id', row.client_id),
    ]);
    const options: SendOption[] = [];
    const seen = new Set<string>();
    const add = (label: string, phone: string | null | undefined, conversationId: string | null) => {
      const c = canonicalizePhone(phone);
      if (c.length < 12 || seen.has(c)) return;
      phoneVariants(c).forEach(v => seen.add(v));
      options.push({ label, phone: c, conversationId });
    };
    (convs || []).filter((c: any) => !c.is_group).forEach((c: any) => add(`${c.name || 'Conversa'} (Chat)`, c.whatsapp_phone, c.id));
    add(`${(cli as any)?.contact_name || 'Contato principal'}`, (cli as any)?.contact_phone, null);
    (deps || []).forEach((d: any) => add(`${d.contact_name || 'Contato do departamento'}`, d.contact_phone, null));
    add('Telefone da empresa', (cli as any)?.phone, null);
    setSendState({
      row, guia: g, options, selected: 0,
      text: `Olá! Segue a guia da parcela ${formatParcelaLabel(g.parcela)} do parcelamento ${row.modalidade_label || ''}${row.numero_parcelamento ? ` nº ${row.numero_parcelamento}` : ''} da empresa ${client?.company_name || ''}. Qualquer dúvida, estamos à disposição.`,
    });
  }

  async function ensureConversation(opt: SendOption, clientId: string, name: string): Promise<string> {
    if (opt.conversationId) return opt.conversationId;
    const variants = phoneVariants(opt.phone);
    const { data: existing } = await supabase.from('chat_conversations').select('id, whatsapp_phone, is_group').in('whatsapp_phone', variants);
    const found = (existing || []).find((c: any) => !c.is_group);
    if (found) return found.id;
    const { data: conv, error } = await supabase.from('chat_conversations').insert({
      name, created_by: user!.id, is_group: false, assigned_to: user!.id, whatsapp_phone: opt.phone, client_id: clientId,
    } as any).select('id').single();
    if (error || !conv) throw error || new Error('Falha ao criar conversa');
    await supabase.from('chat_participants').insert([{ conversation_id: conv.id, user_id: user!.id }]);
    return conv.id;
  }

  async function handleEnviar(row: ParcRow) {
    const g = guias[row.id];
    if (g) { await openSend(row, g); return; }
    await startGerar(row, true);
  }

  async function confirmSend() {
    const opt = sendState?.options[sendState.selected];
    if (!sendState || !opt || !user) return;
    setSending(true);
    try {
      const clientName = clients.find(c => c.id === sendState.row.client_id)?.company_name || opt.label;
      const conversationId = await ensureConversation(opt, sendState.row.client_id, clientName);
      const f = sendState.guia.file;
      const path = `${conversationId}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, f);
      if (upErr) throw upErr;
      const mediaUrl = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
      if (sendState.text.trim()) {
        const { data: d1, error: e1 } = await supabase.functions.invoke('whatsapp-send-text', {
          body: { conversationId, text: sendState.text.trim(), senderName: profile?.full_name || undefined, senderId: user.id },
        });
        if (e1 || (d1 as any)?.error) throw new Error((d1 as any)?.error || e1?.message);
      }
      const { data: d2, error: e2 } = await supabase.functions.invoke('whatsapp-send-media', {
        body: { conversationId, type: 'document', mediaUrl, fileName: f.name, senderName: profile?.full_name || undefined, senderId: user.id },
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

  async function handleAtualizarTodas() {
    const ids = clients.map(c => c.id);
    if (!ids.length) { toast({ title: 'Nenhuma empresa cadastrada para consultar' }); return; }
    cancelRef.current = false;
    setBatchRunning(true);
    setBatchProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      if (cancelRef.current) break;
      try { await consultarCliente(ids[i]); }
      catch {
        await new Promise(r => setTimeout(r, 3000));
        try { await consultarCliente(ids[i]); } catch (e) { console.error(e); }
      }
      setBatchProgress({ current: i + 1, total: ids.length });
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setBatchRunning(false);
    await loadData();
    toast({ title: cancelRef.current ? 'Atualização cancelada' : 'Parcelamentos atualizados' });
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

  async function loadPagamentos(row: ParcRow) {
    const map = PARCELAS_SERVICES[row.modalidade];
    setPagamentos([]); setPagamentosError(null);
    if (!map || !row.numero_parcelamento) return;
    setPagamentosLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: { client_id: row.client_id, idSistema: map.idSistema, idServico: map.obterService, tipo: 'Consultar', dados: JSON.stringify({ numeroParcelamento: Number(String(row.numero_parcelamento).replace(/\D/g, '')) }) },
      });
      if (error) throw error;
      if (!data?.success) {
        const msgs = data?.data?.mensagens?.map((m: any) => m.texto).join('; ');
        throw new Error(msgs || data?.error || 'Falha ao obter pagamentos');
      }
      let d: any = data?.data?.dados ?? data?.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
      setPagamentos(extractPagamentos(d));
    } catch (err: any) {
      setPagamentosError(err?.message || String(err));
    } finally { setPagamentosLoading(false); }
  }

  useEffect(() => {
    if (detailRow && detailRow.status === 'success') {
      loadParcelas(detailRow);
      loadPagamentos(detailRow);
    } else {
      setParcelas([]);
      setParcelasError(null);
      setPagamentos([]);
      setPagamentosError(null);
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

  useEffect(() => {
    if (!onSummary) return;
    const ok = rows.filter(r => r.status === 'success');
    const ativos = ok.filter(r => !isEncerrado(r));
    const now = Date.now();
    onSummary({
      monitoradas: clients.length,
      ativos: ativos.length,
      atraso: ativos.reduce((s, r) => s + (parcAtraso(r) ?? 0), 0),
      rescindidos: ok.filter(r => /rescind/i.test(r.situacao || '')).length,
      vence7: ativos.filter(r => { const d = proximoVenc(r); return d && d.getTime() - now <= 7 * 86400000 && d.getTime() >= now - 86400000; }).length,
      lastBatch: rows.reduce<string | null>((m, r) => (!m || r.consulted_at > m ? r.consulted_at : m), null),
      batchRunning,
      atualizarTodas: handleAtualizarTodas,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, clients, batchRunning]);

  function exportCsv() {
    const lines = [['Código', 'Empresa', 'CNPJ', 'Modalidade', 'Número', 'Situação', 'Data pedido', 'Valor consolidado', 'Pagas', 'Total', 'Valor parcela', 'Consultado em'].join(';')];
    companies.forEach(({ client, parcs }) => parcs.filter(p => p.status === 'success').forEach(p => {
      lines.push([client.sci_code || '', client.company_name, formatCnpj(client.document), p.modalidade_label || '', p.numero_parcelamento || '', p.situacao || '', formatDate(p.data_pedido), p.valor_total ?? '', p.parcelas_pagas ?? '', p.parcelas_total ?? '', valorParcela(p)?.toFixed(2) ?? '', formatDateTime(p.consulted_at)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }));
    downloadFile(new File(['\ufeff' + lines.join('\n')], `parcelamentos_rfb_${new Date().toISOString().slice(0, 10)}.csv`, { type: 'text/csv' }));
  }

  function renderParc(p: ParcRow) {
    const encerrado = isEncerrado(p);
    const canEmit = p.status === 'success' && !encerrado && !!PARCELAS_SERVICES[p.modalidade];
    const g = guias[p.id];
    const venc = encerrado ? null : proximoVenc(p);
    const atraso = encerrado ? 0 : (parcAtraso(p) ?? 0);
    const sit = encerrado ? (/rescind/i.test(p.situacao || '') ? 'Rescindido' : 'Encerrado') : atraso > 0 ? 'Em atraso' : 'Ativo';
    const sitCls = encerrado ? 'bg-muted text-muted-foreground' : atraso > 0 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
    const Field = ({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) => (
      <div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-sm truncate ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>{children}</div></div>
    );
    return (
      <div key={p.id} className={`rounded-lg border bg-card p-4 ${encerrado ? 'opacity-60' : ''}`}>
        {p.status === 'error' ? (
          <div className="text-sm text-destructive">{p.error_message || 'Erro na consulta'}</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex items-start gap-4 lg:w-56 shrink-0">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sitCls}`}>{sit}</span>
              <div className="min-w-0 space-y-1">
                <span className="inline-block rounded-md bg-info/10 text-info px-2 py-0.5 text-[11px] font-semibold">{modTag(p)}</span>
                <div className="text-sm text-foreground">{(p.origem || 'RFB')} • {(p.modalidade_label || '').replace(/^RFB\s*-\s*/i, '')}</div>
                <div className="text-sm text-foreground">Nº {p.numero_parcelamento || '—'}</div>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Field label="Situação">{p.situacao || 'Em parcelamento'}</Field>
                <Field label="Data do pedido">{formatDate(p.data_pedido)}</Field>
                <Field label="Valor consolidado" strong>{brl(p.valor_total)}</Field>
                <Field label="Parcelas" strong>{p.parcelas_total != null ? `${p.parcelas_pagas ?? 0} / ${p.parcelas_total}` : '—'}</Field>
                <Field label="Valor da parcela" strong>{brl(valorParcela(p))}</Field>
                <Field label="Próximo vencimento" strong><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{venc ? venc.toLocaleDateString('pt-BR') : '—'}</span></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Button size="sm" variant="outline" className="text-info" onClick={() => handleAtualizarParc(p)} disabled={!!busyKey}>
                  {busyKey === `upd:${p.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar
                </Button>
                <Button size="sm" variant="outline" className="text-info" onClick={() => startGerar(p, false)} disabled={!canEmit || !!busyKey}>
                  {busyKey === `gen:${p.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}Gerar parcela
                </Button>
                <Button size="sm" variant="outline" className="text-success" onClick={() => handleEnviar(p)} disabled={!canEmit || !!busyKey}>
                  {busyKey === `send:${p.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1" />}Enviar via WhatsApp{g ? ` (${formatParcelaLabel(g.parcela)})` : ''}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDetailRow(p)}>
                  <Eye className="h-4 w-4 mr-1" />Detalhes
                </Button>
              </div>
            </div>
            <button type="button" onClick={() => setDetailRow(p)} className="hidden lg:flex self-center text-muted-foreground hover:text-foreground" aria-label="Detalhes"><ChevronDown className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3 flex flex-col lg:flex-row gap-2">
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="lg:w-52 h-10"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="ativo">Parcelamento ativo</SelectItem>
            <SelectItem value="encerrado">Encerrado/liquidado</SelectItem>
            <SelectItem value="com">Com parcelamento</SelectItem>
            <SelectItem value="sem">Não consultado</SelectItem>
            <SelectItem value="erro">Com erro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterModalidade} onValueChange={setFilterModalidade}>
          <SelectTrigger className="lg:w-52 h-10"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {MODALIDADES.map(m => (
              <SelectItem key={m.idServico} value={m.idServico}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ ou número do parcelamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button onClick={handleConsultarSelecionados} disabled={batchRunning || selected.size === 0} className="h-10 bg-info text-info-foreground hover:bg-info/90">
          {batchRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Consultar selecionados{selected.size ? ` (${selected.size})` : ''}
        </Button>
        <Button variant="outline" className="h-10" onClick={exportCsv}>
          <FileDown className="h-4 w-4 mr-2" />Exportar<ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </div>
      {batchRunning && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Progresso: {batchProgress.current} / {batchProgress.total}
          <Button size="sm" variant="ghost" onClick={() => { cancelRef.current = true; }}>Cancelar</Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
          <Checkbox checked={filteredClientIds.length > 0 && selected.size === filteredClientIds.length} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
          <span>Selecionar todas</span>
        </div>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : pagedCompanies.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground rounded-xl border bg-card">Nenhuma empresa encontrada</div>
        ) : pagedCompanies.map(({ client, parcs }) => {
          const ok = parcs.filter(p => p.status === 'success');
          const ativos = ok.filter(p => !isEncerrado(p));
          const total = ativos.reduce((a, p) => a + (p.valor_total || 0), 0);
          const last = parcs.reduce<string | null>((m, p) => (!m || p.consulted_at > m ? p.consulted_at : m), null);
          const hasErr = parcs.some(p => p.status === 'error');
          const atrasada = ativos.some(p => (parcAtraso(p) ?? 0) > 0);
          const badge = !parcs.length
            ? <span className="rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground">Não consultada</span>
            : ok.length
              ? <span className={`rounded-full px-3 py-1 text-xs font-medium ${atrasada ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>Com parcelamento</span>
              : hasErr
                ? <span className="rounded-full px-3 py-1 text-xs font-medium bg-destructive/15 text-destructive">Erro</span>
                : <span className="rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground">Sem parcelamentos</span>;
          const visible = parcs.filter(p => p.status !== 'no_data');
          const rfb = visible.filter(p => !isMei(p));
          const mei = visible.filter(p => isMei(p));
          const isOpen = expanded.has(client.id);
          return (
            <Collapsible key={client.id} open={isOpen} onOpenChange={o => setExpanded(prev => { const n = new Set(prev); if (o) n.add(client.id); else n.delete(client.id); return n; })} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox checked={selected.has(client.id)} onCheckedChange={() => toggleSelect(client.id)} aria-label="Selecionar empresa" />
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      <span className="h-10 w-10 shrink-0 rounded-full bg-success/15 text-success flex items-center justify-center"><Building2 className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground truncate">{client.sci_code ? `${String(client.sci_code).padStart(5, '0')} • ` : ''}{client.company_name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{formatCnpj(client.document)}</span>
                      </span>
                    </button>
                  </CollapsibleTrigger>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:gap-6 pl-7 md:pl-0">
                  {badge}
                  <div className="text-sm min-w-[150px]">
                    {ativos.length > 0 && <div className="font-semibold text-foreground">{ativos.length} {ativos.length === 1 ? 'ativo' : 'ativos'} • {brl(total)}</div>}
                    {last && <div className="text-xs text-muted-foreground">Consultado em {new Date(last).toLocaleDateString('pt-BR')}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleConsultarIndividual(client.id)} disabled={consultingId === client.id || batchRunning}>
                    {consultingId === client.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(client.id)) n.delete(client.id); else n.add(client.id); return n; })}>{isOpen ? 'Recolher' : 'Ver parcelamentos'}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleSelect(client.id)}>{selected.has(client.id) ? 'Desmarcar' : 'Selecionar'}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CollapsibleContent>
                {visible.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 pb-4">{parcs.length ? 'Nenhum parcelamento encontrado nesta empresa.' : 'Empresa ainda não consultada. Clique em Atualizar.'}</p>
                ) : (
                  <div className="px-3 pb-3 space-y-3">
                    {([['Receita Federal', rfb, 'info'], ['MEI', mei, 'success']] as const).filter(([, l]) => l.length).map(([label, list, tone]) => (
                      <div key={label} className="space-y-2">
                        <div className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold ${tone === 'info' ? 'bg-info/10 text-info' : 'bg-success/10 text-success'}`}>
                          {tone === 'info' ? <Landmark className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}{label}
                        </div>
                        {list.map(p => renderParc(p))}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-sm text-muted-foreground">
          <span>{companies.length} empresa(s) • Página {safePage} de {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Próxima</Button>
          </div>
        </div>
      </div>

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
              {sendState.options.length ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Enviar para</div>
                  <Select value={String(sendState.selected)} onValueChange={v => setSendState({ ...sendState, selected: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sendState.options.map((o, i) => (
                        <SelectItem key={o.phone} value={String(i)}>{o.label} • +{o.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-sm text-destructive">Esta empresa não tem nenhum telefone cadastrado. Cadastre um contato no cliente para poder enviar.</div>
              )}
              <Textarea rows={5} value={sendState.text} onChange={e => setSendState({ ...sendState, text: e.target.value })} />
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setSendState(null)} disabled={sending}>Cancelar</Button>
                <Button onClick={confirmSend} disabled={sending || !sendState.options.length}>
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

              {PARCELAS_SERVICES[detailRow.modalidade] && (
                <div className="border-t pt-3">
                  <div className="text-sm font-semibold mb-2">Parcelas pagas{pagamentos.length ? ` (${pagamentos.length})` : ''}</div>
                  {pagamentosLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamentos...
                    </div>
                  ) : pagamentosError ? (
                    <div className="text-sm text-destructive">{pagamentosError}</div>
                  ) : pagamentos.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum pagamento registrado.</div>
                  ) : (
                    <ScrollArea className="max-h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Data pagamento</TableHead>
                            <TableHead>Valor pago</TableHead>
                            <TableHead className="hidden sm:table-cell">Nº DAS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagamentos.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{p.parcela || '-'}</TableCell>
                              <TableCell>{p.data || '-'}</TableCell>
                              <TableCell>{p.valor != null ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</TableCell>
                              <TableCell className="hidden sm:table-cell font-mono text-xs">{p.das || '-'}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={2} className="font-semibold">Total pago</TableCell>
                            <TableCell className="font-semibold">{pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            <TableCell className="hidden sm:table-cell" />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </div>
              )}

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