import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, PlayCircle, FileArchive, SlidersHorizontal } from 'lucide-react';
import JSZip from 'jszip';
import SitfisOverviewPanel, { analyzeSitfisReport, resolveStatusKey } from './SitfisOverviewPanel';
import * as pdfjsLib from 'pdfjs-dist';
import { normalizeTaxRegime } from '@/lib/utils';
import SitfisCompanyCard from './SitfisCompanyCard';
import SitfisDetailPanel from './SitfisDetailPanel';
import { parseSitfisReport, type SitfisStructuredReport } from './sitfisParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

async function extractPdfInfoFromBase64(base64: string): Promise<{ text: string; pages: string[]; numPages: number }> {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const texts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      texts.push(pageText);
    }
    return { text: texts.join(' '), pages: texts, numPages: doc.numPages };
  } catch (err) {
    console.error('[SITFIS] Erro ao extrair texto do PDF:', err);
    return { text: '', pages: [], numPages: 0 };
  }
}

async function extractTextFromPdfBase64(base64: string): Promise<string> {
  return (await extractPdfInfoFromBase64(base64)).text;
}

type ClientWithSitfis = {
  id: string;
  sci_code?: string | null;
  company_name: string;
  document: string | null;
  tax_regime: string | null;
  sitfis_status: string | null;
  consulted_at: string | null;
  pdf_base64: string | null;
  error_message: string | null;
  pendency_types: string[];
};

export default function SituacaoFiscalTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientWithSitfis[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegime, setFilterRegime] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50 | 100 | 'all'>(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultingId, setConsultingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterOccurrence, setFilterOccurrence] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [filterCompetency, setFilterCompetency] = useState('all');
  const [parsedReports, setParsedReports] = useState<Record<string, SitfisStructuredReport>>({});
  const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [certMode, setCertMode] = useState<Set<string>>(new Set());
  const textCache = useRef<Map<string, string>>(new Map());
  const pagesCache = useRef<Map<string, number>>(new Map());
  const pageTextCache = useRef<Map<string, string[]>>(new Map());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, sci_code, company_name, document, digital_certificate_url, tax_regime')
        .not('digital_certificate_url', 'is', null)
        .eq('status', 'active')
        .order('company_name');

      if (!clientsData) { setLoading(false); return; }

      const { data: sitfisData } = await supabase
        .from('sitfis_results' as any)
        .select('client_id, status, consulted_at, pdf_base64, error_message, pendency_types');

      const sitfisMap = new Map<string, any>();
      (sitfisData || []).forEach((r: any) => sitfisMap.set(r.client_id, r));

      const merged: ClientWithSitfis[] = clientsData.map(c => {
        const s = sitfisMap.get(c.id);
        return {
          id: c.id,
          sci_code: c.sci_code,
          company_name: c.company_name,
          document: c.document,
          tax_regime: c.tax_regime || null,
          sitfis_status: s?.status || null,
          consulted_at: s?.consulted_at || null,
          pdf_base64: s?.pdf_base64 || null,
          error_message: s?.error_message || null,
          pendency_types: s?.pendency_types || [],
        };
      });
      setClients(merged);
    } catch (err) {
      console.error(err);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Espelhos para o worker em segundo plano
  const clientsRef = useRef<ClientWithSitfis[]>([]);
  const busyRef = useRef(false);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => {
    busyRef.current = !!consultingId || batchRunning || zipping;
  }, [consultingId, batchRunning, zipping]);


  // Reprocessa automaticamente, em segundo plano, os clientes com status "error"
  // e, uma vez por sessão, os "sem_procuracao" (agora o backend tenta o certificado próprio)
  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const semProcuracaoTentados = new Set<string>();

    (async () => {
      await sleep(15000);
      let rodada = 0;
      while (!cancelled) {
        const comErro = clientsRef.current.filter(c => c.sitfis_status === 'error').map(c => c.id);
        const semProcuracao = clientsRef.current
          .filter(c => c.sitfis_status === 'sem_procuracao' && !semProcuracaoTentados.has(c.id))
          .map(c => c.id);
        semProcuracao.forEach(id => semProcuracaoTentados.add(id));
        const alvos = [...comErro, ...semProcuracao];
        if (alvos.length === 0) {
          await sleep(60000);
          continue;
        }
        rodada++;
        console.log(`[SITFIS] Reprocessamento automático — rodada ${rodada}, ${comErro.length} com erro + ${semProcuracao.length} sem procuração`);
        for (const id of alvos) {
          if (cancelled) return;
          while (!cancelled && busyRef.current) await sleep(5000);
          if (cancelled) return;
          try {
            await consultarSitfis(id);
          } catch (err) {
            console.error('[SITFIS] Falha no reprocessamento automático:', err);
          }
          if (cancelled) return;
          await loadData(true);
          await sleep(3000);
        }
        await sleep(Math.min(30000 * 2 ** (rodada - 1), 300000));
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function consultarSitfis(clientId: string): Promise<boolean> {

    // Erro que indica protocolo caduco: SERPRO pede nova solicitação em /Apoiar
    const isProtocolExpired = (msg: string) =>
      /er05|inicie uma nova solicita/i.test(msg || '');
    const isProcuracaoError = (msg: string) =>
      /procurador|procura[çc][ãa]o/i.test(msg || '');
    // Falhas passageiras: rede, timeout, gateway, protocolo caduco, relatório não pronto
    const isTransientError = (msg: string) =>
      /failed to send|failed to fetch|network|timeout|tempo limite|gateway|runtime error|502|503|504|erro 500|n[ãa]o ficou pronto|consulta incompleta|protocolo n[ãa]o encontrado/i.test(msg || '')
      || isProtocolExpired(msg);

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const esperas = [2000, 5000, 10000, 20000, 30000];
    const maxCiclos = 5;
    let ultimoErro: Error | null = null;

    for (let ciclo = 0; ciclo < maxCiclos; ciclo++) {
      try {
        const ok = await executarCicloSitfis(clientId);
        return ok;
      } catch (err: any) {
        const msg = err?.message || 'Erro desconhecido';
        ultimoErro = err;

        if (isProcuracaoError(msg)) break;
        if (!isTransientError(msg) || ciclo === maxCiclos - 1) break;

        if (isProtocolExpired(msg)) {
          console.warn('[SITFIS] Protocolo expirado (ER05) — reiniciando fluxo em /Apoiar');
          await supabase.functions.invoke('integra-contador', {
            body: { client_id: clientId, sitfis_invalidate_cache: true },
          }).catch(() => {});
        }
        await sleep(esperas[Math.min(ciclo, esperas.length - 1)]);
      }
    }

    const msg = ultimoErro?.message || 'Erro desconhecido';
    const status = isProcuracaoError(msg) ? 'sem_procuracao' : 'error';
    const errorMessage = status === 'sem_procuracao'
      ? 'Procuração eletrônica ausente ou vencida no e-CAC'
      : isProtocolExpired(msg)
        ? 'Protocolo expirado no SERPRO. Nova tentativa automática em andamento.'
        : msg;

    console.error(`[SITFIS] Erro para ${clientId}:`, ultimoErro);

    // Preserva relatório válido já existente — não apaga PDF/pendências por falha transitória
    const { data: existente } = await supabase
      .from('sitfis_results' as any)
      .select('pdf_base64, pendency_types')
      .eq('client_id', clientId)
      .maybeSingle();
    const temPdf = !!(existente as any)?.pdf_base64;

    await supabase.from('sitfis_results' as any).upsert({
      client_id: clientId,
      status,
      consulted_at: new Date().toISOString(),
      pdf_base64: temPdf ? (existente as any).pdf_base64 : null,
      raw_response: null,
      error_message: errorMessage,
      pendency_types: temPdf ? ((existente as any).pendency_types || []) : [],
    } as any, { onConflict: 'client_id' } as any);
    return false;
  }


  async function executarCicloSitfis(clientId: string): Promise<boolean> {
    try {
      // Step 1: request protocol with retries
      let protocoloRelatorio: string | null = null;
      let sitfisCtx: any = null;
      const maxTentativas = 3;

      for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
        const step1 = await supabase.functions.invoke('integra-contador', {
          body: {
            client_id: clientId,
            idSistema: 'SITFIS',
            idServico: 'SOLICITARPROTOCOLO91',
            tipo: 'Apoiar',
            versaoSistema: '2.0',
            dados: '',
          },
        });
        if (step1.error) throw step1.error;
        if (!step1.data?.success && step1.data?.status !== 304) {
          const msgs = step1.data?.data?.mensagens;
          const errMsg = msgs?.map((m: any) => m.texto).join('; ') || step1.data?.error || 'Erro ao solicitar protocolo';
          throw new Error(errMsg);
        }

        sitfisCtx = step1.data?.data?.sitfis_context;
        protocoloRelatorio = sitfisCtx?.protocoloRelatorio || null;
        if (protocoloRelatorio) break;

        const tempoEspera = sitfisCtx?.tempoEspera;
        if (tempoEspera && tentativa < maxTentativas - 1) {
          await new Promise(resolve => setTimeout(resolve, Number(tempoEspera)));
          continue;
        }
        break;
      }

      if (!protocoloRelatorio) {
        throw new Error('Protocolo não encontrado após tentativas.');
      }

      // Step 2: emit report (com polling — SERPRO pode responder 202 "em processamento")
      let responseData: any = null;
      let pdfBase64: string | null = null;
      let fiscalStatus = 'irregular';
      const maxEmissoes = 5;

      // Walk response to find PDF
      const walkForPdf = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'pdf' && typeof v === 'string' && (v as string).length > 100) return v as string;
          if (typeof v === 'string' && (v as string).startsWith('JVBERi0') && (v as string).length > 100) return v as string;
          if (typeof v === 'object') {
            const found = walkForPdf(v);
            if (found) return found;
          }
        }
        return null;
      };

      let parsedDados: any = null;

      for (let tentativa = 0; tentativa < maxEmissoes; tentativa++) {
        const step2 = await supabase.functions.invoke('integra-contador', {
          body: {
            client_id: clientId,
            idSistema: 'SITFIS',
            idServico: 'RELATORIOSITFIS92',
            tipo: 'Emitir',
            versaoSistema: '2.0',
            dados: JSON.stringify({ protocoloRelatorio }),
            sitfis_context: sitfisCtx,
          },
        });
        if (step2.error) throw step2.error;

        if (step2.data?.auth_mode === 'certificado_proprio') {
          setCertMode(prev => (prev.has(clientId) ? prev : new Set(prev).add(clientId)));
        }

        responseData = step2.data?.data;

        // Mensagens de erro do SERPRO (ex.: ER05 protocolo expirado)
        const serproMsgs: string = Array.isArray(responseData?.mensagens)
          ? responseData.mensagens.map((m: any) => `${m.codigo || ''} ${m.texto || ''}`).join('; ')
          : '';
        if (serproMsgs && /er05|inicie uma nova solicita/i.test(serproMsgs)) {
          throw new Error(serproMsgs.trim());
        }
        if (Number(responseData?.status) >= 500) {
          throw new Error(serproMsgs.trim() || 'Erro 500 no SERPRO ao emitir relatório');
        }

        // Erro de runtime do gateway (ex.: endpoint SUSPENDED)
        if (responseData?.code || responseData?.message === 'Runtime Error') {
          throw new Error(responseData?.description || responseData?.message || 'Erro no gateway SERPRO');
        }

        parsedDados = null;
        if (typeof responseData?.dados === 'string') {
          try { parsedDados = JSON.parse(responseData.dados); } catch {}
        } else if (typeof responseData?.dados === 'object') {
          parsedDados = responseData.dados;
        }

        pdfBase64 = walkForPdf(parsedDados) || walkForPdf(responseData);
        if (pdfBase64) break;

        // Relatório ainda em processamento: aguardar tempoEspera e repetir
        const tempoEspera = Number(parsedDados?.tempoEspera ?? responseData?.tempoEspera ?? 0);
        if (tentativa < maxEmissoes - 1) {
          await new Promise(resolve => setTimeout(resolve, tempoEspera > 0 ? tempoEspera : 4000));
          continue;
        }
      }

      if (!pdfBase64) {
        throw new Error('Relatório não ficou pronto a tempo. Reconsulte este cliente.');
      }

      // Extract text from PDF for keyword analysis
      const { text: pdfText, numPages } = await extractPdfInfoFromBase64(pdfBase64);
      console.log('[SITFIS] Texto extraído do PDF (primeiros 500 chars):', pdfText.substring(0, 500), 'páginas:', numPages);

      // Classificação baseada nos itens listados no relatório (não em palavras soltas)
      const analysis = analyzeSitfisReport(pdfText, { numPages });
      fiscalStatus = analysis.status;
      console.log('[SITFIS] Itens de pendência encontrados:', analysis.items.length, analysis.types);

      // Upsert result
      await supabase.from('sitfis_results' as any).upsert({
        client_id: clientId,
        status: fiscalStatus,
        consulted_at: new Date().toISOString(),
        pdf_base64: pdfBase64,
        raw_response: responseData,
        error_message: null,
        pendency_types: analysis.types,
      } as any, { onConflict: 'client_id' } as any);

      return true;
    } catch (err: any) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async function handleConsultarIndividual(clientId: string) {
    setConsultingId(clientId);
    const ok = await consultarSitfis(clientId);
    await loadData();
    setConsultingId(null);
    toast({
      title: ok ? 'Consulta concluída' : 'Erro na consulta',
      description: ok ? 'Situação fiscal atualizada.' : 'Verifique os logs.',
      variant: ok ? 'default' : 'destructive',
    });
  }

  async function handleConsultarLote() {
    const ids = selected.size > 0 ? Array.from(selected) : clients.map(c => c.id);
    if (ids.length === 0) return;

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: ids.length });
    let successCount = 0;

    for (let i = 0; i < ids.length; i++) {
      setBatchProgress({ current: i + 1, total: ids.length });
      const ok = await consultarSitfis(ids[i]);
      if (ok) successCount++;
      await loadData(true);
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    setBatchRunning(false);
    toast({
      title: 'Consulta em lote concluída',
      description: `${successCount}/${ids.length} consultas realizadas com sucesso.`,
    });
  }

  function openPdf(pdf: string) {
    const dataUrl = `data:application/pdf;base64,${pdf}`;
    window.open(dataUrl, '_blank');
  }

  function downloadPdf(pdf: string, name: string) {
    const dataUrl = `data:application/pdf;base64,${pdf}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `Situacao_Fiscal_${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    link.click();
  }

  function sanitizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async function handleDownloadLote() {
    const scope = selected.size > 0
      ? filtered.filter(c => selected.has(c.id))
      : filtered;
    const withPdf = scope.filter(c => !!c.pdf_base64);
    const missing = scope.length - withPdf.length;

    if (withPdf.length === 0) {
      toast({
        title: 'Nenhum relatório disponível',
        description: 'Consulte a situação fiscal antes de baixar os PDFs.',
        variant: 'destructive',
      });
      return;
    }

    setZipping(true);
    setZipProgress({ current: 0, total: withPdf.length });
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (let i = 0; i < withPdf.length; i++) {
        const c = withPdf[i];
        const base = sanitizeName(
          `${c.sci_code ? `${c.sci_code} - ` : ''}${c.company_name}`
        ) || 'Situacao_Fiscal';
        let fileName = `${base}.pdf`;
        let n = 2;
        while (usedNames.has(fileName)) {
          fileName = `${base}_${n++}.pdf`;
        }
        usedNames.add(fileName);
        zip.file(fileName, c.pdf_base64 as string, { base64: true });
        setZipProgress({ current: i + 1, total: withPdf.length });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Situacao_Fiscal_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download concluído',
        description: `${withPdf.length} PDF(s) baixados${missing > 0 ? `, ${missing} sem relatório` : ''}.`,
      });
    } catch (err: any) {
      console.error('[SITFIS] Erro ao gerar ZIP:', err);
      toast({
        title: 'Erro ao gerar arquivo',
        description: err?.message || 'Não foi possível compactar os PDFs.',
        variant: 'destructive',
      });
    }
    setZipping(false);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  const regimeOptions = Array.from(new Set(clients.map(c => normalizeTaxRegime(c.tax_regime)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const companyOptions = [...clients].sort((a, b) => a.company_name.localeCompare(b.company_name, 'pt-BR'));
  const parsedValues = Object.values(parsedReports);
  const agencyOptions = Array.from(new Set(parsedValues.flatMap(report => report.agencies))).sort();
  const competencyOptions = Array.from(new Set(parsedValues.flatMap(report => report.competencies))).sort().reverse();

  const baseFiltered = clients.filter(c => {
    const term = search.toLowerCase();
    const matchSearch = !search || c.company_name.toLowerCase().includes(term) || (c.sci_code || '').toLowerCase().includes(term) || (c.document || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''));
    const normalizedRegime = normalizeTaxRegime(c.tax_regime);
    const matchRegime = filterRegime === 'all' || (filterRegime === 'none' ? !normalizedRegime : normalizedRegime === filterRegime);
    const report = parsedReports[c.id];
    const types = report?.occurrenceTypes.length ? report.occurrenceTypes : c.pendency_types;
    return matchSearch && matchRegime && (filterCompany === 'all' || c.id === filterCompany)
      && (filterOccurrence === 'all' || types.includes(filterOccurrence))
      && (filterAgency === 'all' || report?.agencies.includes(filterAgency))
      && (filterCompetency === 'all' || report?.competencies.includes(filterCompetency));
  });

  const tabCounts = {
    all: baseFiltered.length,
    irregular: baseFiltered.filter(c => resolveStatusKey(c.sitfis_status) === 'irregular').length,
    regular: baseFiltered.filter(c => resolveStatusKey(c.sitfis_status) === 'regular').length,
    pending: baseFiltered.filter(c => resolveStatusKey(c.sitfis_status) === 'pending').length,
  };
  const filtered = baseFiltered.filter(c => filterStatus === 'all' || resolveStatusKey(c.sitfis_status) === filterStatus);
  const statusTabs = [
    { key: 'all', label: 'Todos', count: tabCounts.all }, { key: 'irregular', label: 'Com pendência', count: tabCounts.irregular },
    { key: 'regular', label: 'Regulares', count: tabCounts.regular }, { key: 'pending', label: 'Sem consulta', count: tabCounts.pending },
  ];
  const activeTab = statusTabs.some(t => t.key === filterStatus) ? filterStatus : 'all';
  useEffect(() => { setPage(1); }, [search, filterStatus, filterRegime, filterCompany, filterOccurrence, filterAgency, filterCompetency]);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedClients = pageSize === 'all' ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const downloadScope = selected.size > 0 ? filtered.filter(c => selected.has(c.id)) : filtered;
  const availablePdfCount = downloadScope.filter(c => !!c.pdf_base64).length;
  const detailClient = clients.find(c => c.id === detailClientId) || null;

  async function ensureParsed(client: ClientWithSitfis) {
    if (parsedReports[client.id] || !client.pdf_base64 || parsingIds.has(client.id)) return;
    setParsingIds(prev => new Set(prev).add(client.id));
    const info = await extractPdfInfoFromBase64(client.pdf_base64);
    textCache.current.set(client.id, info.text);
    pagesCache.current.set(client.id, info.numPages);
    pageTextCache.current.set(client.id, info.pages);
    setParsedReports(prev => ({ ...prev, [client.id]: parseSitfisReport(info.pages) }));
    setParsingIds(prev => { const next = new Set(prev); next.delete(client.id); return next; });
  }
  async function showDetails(client: ClientWithSitfis) {
    setDetailClientId(client.id);
    await ensureParsed(client);
  }

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fiscal</h1>
          <p className="text-muted-foreground mt-1">
            Situação fiscal dos clientes junto à Receita Federal
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadLote}
            disabled={zipping || batchRunning || !!consultingId || availablePdfCount === 0}
            className="gap-2"
          >
            {zipping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {zipProgress.current}/{zipProgress.total}
              </>
            ) : (
              <>
                <FileArchive className="h-4 w-4" />
                Baixar PDFs ({availablePdfCount})
              </>
            )}
          </Button>
          <Button
            onClick={handleConsultarLote}
            disabled={batchRunning || !!consultingId || zipping}
            className="gap-2"
          >
            {batchRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {batchProgress.current}/{batchProgress.total}
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Consultar em Lote {selected.size > 0 ? `(${selected.size})` : `(${clients.length})`}
              </>
            )}
          </Button>
        </div>
      </div>

      <SitfisOverviewPanel
        items={filtered.map(c => ({ sitfis_status: c.sitfis_status, pendency_types: c.pendency_types || [] }))}
        loading={loading && clients.length === 0}
        activeStatus={filterStatus}
        onSelectStatus={setFilterStatus}
        onSelectPendency={setPendencyKey}
      />

      <Card className="rounded-md">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><SlidersHorizontal className="h-5 w-5" />Gestão de pendências fiscais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por empresa, código ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={filterCompany} onValueChange={setFilterCompany}><SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as empresas</SelectItem>{companyOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.sci_code ? `${c.sci_code} - ` : ''}{c.company_name}</SelectItem>)}</SelectContent></Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger><SelectValue placeholder="Situação fiscal" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="irregular">Com pendência</SelectItem><SelectItem value="error">Erro</SelectItem><SelectItem value="sem_procuracao">Sem procuração</SelectItem><SelectItem value="pending">Sem consulta</SelectItem></SelectContent></Select>
            <Select value={filterOccurrence} onValueChange={setFilterOccurrence}><SelectTrigger><SelectValue placeholder="Tipo de ocorrência" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="omissao">Declarações omitidas</SelectItem><SelectItem value="debitos">Débitos tributários</SelectItem><SelectItem value="parcelamento">Parcelamentos</SelectItem><SelectItem value="suspensa">Exigibilidade suspensa</SelectItem><SelectItem value="divida_ativa">Situação na PGFN</SelectItem></SelectContent></Select>
            <Select value={filterAgency} onValueChange={setFilterAgency}><SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os órgãos</SelectItem><SelectItem value="Receita Federal">Receita Federal</SelectItem><SelectItem value="PGFN">PGFN</SelectItem>{agencyOptions.filter(a => !['Receita Federal','PGFN'].includes(a)).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
            <Select value={filterCompetency} onValueChange={setFilterCompetency}><SelectTrigger><SelectValue placeholder="Competência" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as competências</SelectItem>{competencyOptions.map(c => <SelectItem key={c} value={c}>{c.slice(5)}/{c.slice(0,4)}</SelectItem>)}</SelectContent></Select>
            <Select value={filterRegime} onValueChange={setFilterRegime}><SelectTrigger><SelectValue placeholder="Regime tributário" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os regimes</SelectItem>{regimeOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}<SelectItem value="none">Não informado</SelectItem></SelectContent></Select>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-b">{statusTabs.map(tab => <Button key={tab.key} variant="ghost" size="sm" onClick={() => setFilterStatus(tab.key)} className={activeTab === tab.key ? 'rounded-none border-b-2 border-primary text-primary' : 'rounded-none text-muted-foreground'}>{tab.label} ({tab.count})</Button>)}</div>
          <div className="flex items-center gap-2"><Checkbox checked={filtered.length > 0 && filtered.every(c => selected.has(c.id))} onCheckedChange={toggleSelectAll} /><span className="text-sm text-muted-foreground">Selecionar todos os clientes filtrados</span></div>
          <div className="space-y-3">{paginatedClients.length === 0 ? <div className="rounded-sm border border-dashed py-12 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div> : paginatedClients.map(c => <SitfisCompanyCard key={c.id} client={c} selected={selected.has(c.id)} parsed={parsedReports[c.id]} parsing={parsingIds.has(c.id)} consulting={consultingId === c.id} onSelect={() => toggleSelect(c.id)} onRequestParse={() => void ensureParsed(c)} onDetails={() => void showDetails(c)} onDownload={() => c.pdf_base64 && downloadPdf(c.pdf_base64, c.company_name)} onConsult={() => void handleConsultarIndividual(c.id)} />)}</div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{filtered.length} cliente(s)</span>
              <span className="text-emerald-600">
                {clients.filter(c => c.sitfis_status === 'regular').length} regular
              </span>
              <span className="text-destructive">
                {clients.filter(c => c.sitfis_status === 'irregular').length} irregular
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={String(pageSize)}
                onValueChange={v => {
                  const next = v === 'all' ? 'all' : (Number(v) as 10 | 20 | 50 | 100);
                  setPageSize(next);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Itens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / pág.</SelectItem>
                  <SelectItem value="20">20 / pág.</SelectItem>
                  <SelectItem value="50">50 / pág.</SelectItem>
                  <SelectItem value="100">100 / pág.</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1 || pageSize === 'all'}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2 min-w-[5.5rem] text-center">
                  Página {safePage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages || pageSize === 'all'}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <SitfisDetailPanel client={detailClient} parsed={detailClient ? parsedReports[detailClient.id] : undefined} onClose={() => setDetailClientId(null)} onOpenPdf={() => detailClient?.pdf_base64 && openPdf(detailClient.pdf_base64)} onDownload={() => detailClient?.pdf_base64 && downloadPdf(detailClient.pdf_base64, detailClient.company_name)} />
    </div>
  );
}
