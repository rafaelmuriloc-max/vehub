import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Eye, Download, Search, PlayCircle, CheckCircle2, XCircle, Clock, AlertCircle, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import SitfisOverviewPanel, { analyzeSitfisReport, extractPendencyExcerpts, PENDENCY_LABELS } from './SitfisOverviewPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as pdfjsLib from 'pdfjs-dist';
import { formatClientLabel } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

async function extractTextFromPdfBase64(base64: string): Promise<string> {
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
    return texts.join(' ');
  } catch (err) {
    console.error('[SITFIS] Erro ao extrair texto do PDF:', err);
    return '';
  }
}

type ClientWithSitfis = {
  id: string;
  sci_code?: string | null;
  company_name: string;
  document: string | null;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultingId, setConsultingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [pendencyKey, setPendencyKey] = useState<string | null>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassProgress, setReclassProgress] = useState({ current: 0, total: 0 });
  const [excerpts, setExcerpts] = useState<Record<string, string[]>>({});
  const [excerptsLoading, setExcerptsLoading] = useState(false);
  const textCache = useRef<Map<string, string>>(new Map());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, sci_code, company_name, document, digital_certificate_url')
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
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reclassifica os relatórios já armazenados usando a análise por itens
  async function handleReclassificar() {
    const targets = clients.filter(c => !!c.pdf_base64);
    if (targets.length === 0) {
      toast({ title: 'Nada a reclassificar', description: 'Nenhum relatório armazenado.' });
      return;
    }
    setReclassifying(true);
    setReclassProgress({ current: 0, total: targets.length });
    const updates: { id: string; status: string; types: string[] }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const text = textCache.current.get(c.id) ?? await extractTextFromPdfBase64(c.pdf_base64 as string);
      textCache.current.set(c.id, text);
      if (!text.trim()) { setReclassProgress({ current: i + 1, total: targets.length }); continue; }
      const analysis = analyzeSitfisReport(text);
      if (analysis.status !== c.sitfis_status || (c.pendency_types || []).join(',') !== analysis.types.join(',')) {
        await supabase
          .from('sitfis_results' as any)
          .update({ status: analysis.status, pendency_types: analysis.types, error_message: null } as any)
          .eq('client_id', c.id);
        updates.push({ id: c.id, status: analysis.status, types: analysis.types });
      }
      setReclassProgress({ current: i + 1, total: targets.length });
    }
    setClients(prev =>
      prev.map(p => {
        const u = updates.find(x => x.id === p.id);
        return u ? { ...p, sitfis_status: u.status, pendency_types: u.types, error_message: null } : p;
      })
    );
    setReclassifying(false);
    toast({
      title: 'Reclassificação concluída',
      description: `${updates.length} de ${targets.length} relatório(s) atualizados.`,
    });
  }

  async function consultarSitfis(clientId: string): Promise<boolean> {
    // Erro que indica protocolo caduco: SERPRO pede nova solicitação em /Apoiar
    const isProtocolExpired = (msg: string) =>
      /er05|inicie uma nova solicita/i.test(msg || '');
    const isProcuracaoError = (msg: string) =>
      /procurador|procura[çc][ãa]o/i.test(msg || '');

    const maxCiclos = 2;
    let ultimoErro: Error | null = null;

    for (let ciclo = 0; ciclo < maxCiclos; ciclo++) {
      try {
        const ok = await executarCicloSitfis(clientId);
        return ok;
      } catch (err: any) {
        const msg = err?.message || 'Erro desconhecido';
        ultimoErro = err;
        // Protocolo caducou: limpar cache e refazer a etapa /Apoiar
        if (isProtocolExpired(msg) && ciclo < maxCiclos - 1) {
          console.warn('[SITFIS] Protocolo expirado (ER05) — reiniciando fluxo em /Apoiar');
          await supabase.functions.invoke('integra-contador', {
            body: { client_id: clientId, sitfis_invalidate_cache: true },
          }).catch(() => {});
          continue;
        }
        break;
      }
    }

    const msg = ultimoErro?.message || 'Erro desconhecido';
    const status = isProcuracaoError(msg) ? 'sem_procuracao' : 'error';
    const errorMessage = status === 'sem_procuracao'
      ? 'Procuração eletrônica ausente ou vencida no e-CAC'
      : isProtocolExpired(msg)
        ? 'Protocolo expirado no SERPRO. Reconsulte este cliente.'
        : msg;

    console.error(`[SITFIS] Erro para ${clientId}:`, ultimoErro);
    await supabase.from('sitfis_results' as any).upsert({
      client_id: clientId,
      status,
      consulted_at: new Date().toISOString(),
      pdf_base64: null,
      raw_response: null,
      error_message: errorMessage,
      pendency_types: [],
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
      const pdfText = await extractTextFromPdfBase64(pdfBase64);
      console.log('[SITFIS] Texto extraído do PDF (primeiros 500 chars):', pdfText.substring(0, 500));

      // Classificação baseada nos itens listados no relatório (não em palavras soltas)
      const analysis = analyzeSitfisReport(pdfText);
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
      await loadData();
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

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.sci_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.document || '').includes(search);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'pending' && !c.sitfis_status) ||
      c.sitfis_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const downloadScope = selected.size > 0 ? filtered.filter(c => selected.has(c.id)) : filtered;
  const availablePdfCount = downloadScope.filter(c => !!c.pdf_base64).length;

  const pendencyClients = pendencyKey
    ? filtered.filter(c => c.sitfis_status === 'irregular' && (c.pendency_types || []).includes(pendencyKey))
    : [];

  useEffect(() => {
    if (!pendencyKey) return;
    let cancelled = false;
    const targets = clients.filter(
      c => c.sitfis_status === 'irregular' && (c.pendency_types || []).includes(pendencyKey) && !!c.pdf_base64
    );
    const pending = targets.filter(c => !textCache.current.has(c.id));
    setExcerptsLoading(pending.length > 0);
    (async () => {
      for (const c of pending) {
        if (cancelled) return;
        const text = await extractTextFromPdfBase64(c.pdf_base64 as string);
        textCache.current.set(c.id, text);
      }
      if (cancelled) return;
      const next: Record<string, string[]> = {};
      targets.forEach(c => {
        next[c.id] = extractPendencyExcerpts(textCache.current.get(c.id) || '', pendencyKey);
      });
      setExcerpts(next);
      setExcerptsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendencyKey]);

  function statusBadge(status: string | null) {
    if (!status || status === 'pending') {
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
    if (status === 'regular') {
      return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> Regular</Badge>;
    }
    if (status === 'irregular') {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Irregular</Badge>;
    }
    if (status === 'error') {
      return <Badge variant="secondary" className="gap-1 text-orange-600"><AlertCircle className="h-3 w-3" /> Erro</Badge>;
    }
    if (status === 'sem_procuracao') {
      return <Badge variant="secondary" className="gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> Sem procuração</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
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
      <SitfisOverviewPanel
        items={filtered.map(c => ({ sitfis_status: c.sitfis_status, pendency_types: c.pendency_types || [] }))}
        loading={loading && clients.length === 0}
        activeStatus={filterStatus}
        onSelectStatus={setFilterStatus}
        onSelectPendency={setPendencyKey}
      />

      <Dialog open={!!pendencyKey} onOpenChange={open => !open && setPendencyKey(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendencyKey ? (PENDENCY_LABELS[pendencyKey] || pendencyKey) : ''}
            </DialogTitle>
            <DialogDescription>
              {pendencyClients.length} cliente(s) com esta pendência
            </DialogDescription>
          </DialogHeader>
          {excerptsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo relatórios...
            </div>
          )}
          <div className="space-y-3">
            {pendencyClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              pendencyClients.map(c => {
                const list = excerpts[c.id] || [];
                return (
                  <div key={c.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{formatClientLabel(c)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.document || '—'}
                          {c.consulted_at
                            ? ` • ${new Date(c.consulted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => c.pdf_base64 && openPdf(c.pdf_base64)}
                          disabled={!c.pdf_base64}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => c.pdf_base64 && downloadPdf(c.pdf_base64, c.company_name)}
                          disabled={!c.pdf_base64}
                        >
                          <Download className="h-3.5 w-3.5" /> Baixar
                        </Button>
                      </div>
                    </div>
                    {(c.pendency_types || []).filter(t => t !== pendencyKey).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(c.pendency_types || [])
                          .filter(t => t !== pendencyKey)
                          .map(t => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {PENDENCY_LABELS[t] || t}
                            </Badge>
                          ))}
                      </div>
                    )}
                    {!c.pdf_base64 ? (
                      <p className="text-xs text-muted-foreground">
                        Descrição não disponível — refaça a consulta.
                      </p>
                    ) : list.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {excerptsLoading ? 'Carregando trechos...' : 'Trecho não localizado no relatório.'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {list.map((ex, i) => (
                          <p key={i} className="text-xs text-foreground bg-muted/50 rounded p-2 leading-relaxed">
                            {ex}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Situação Fiscal dos Clientes</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
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
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filtrar situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="irregular">Irregular</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="sem_procuracao">Sem procuração</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ/CPF</TableHead>
                  <TableHead className="w-32">Situação</TableHead>
                  <TableHead className="hidden lg:table-cell w-44">Última Consulta</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => toggleSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{formatClientLabel(c)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {c.document || '—'}
                      </TableCell>
                      <TableCell>
                        {consultingId === c.id ? (
                          <Badge variant="outline" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Consultando
                          </Badge>
                        ) : (
                          statusBadge(c.sitfis_status)
                        )}
                        {c.error_message && (c.sitfis_status === 'error' || c.sitfis_status === 'sem_procuracao') && (
                          <p className="text-xs text-destructive mt-1 line-clamp-1" title={c.error_message}>
                            {c.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {c.consulted_at
                          ? new Date(c.consulted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Consultar"
                            onClick={() => handleConsultarIndividual(c.id)}
                            disabled={!!consultingId || batchRunning}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar PDF"
                            onClick={() => c.pdf_base64 && openPdf(c.pdf_base64)}
                            disabled={!c.pdf_base64}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Baixar PDF"
                            onClick={() => c.pdf_base64 && downloadPdf(c.pdf_base64, c.company_name)}
                            disabled={!c.pdf_base64}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filtered.length} cliente(s)</span>
            <span className="text-emerald-600">
              {clients.filter(c => c.sitfis_status === 'regular').length} regular
            </span>
            <span className="text-destructive">
              {clients.filter(c => c.sitfis_status === 'irregular').length} irregular
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
