import { useState, useEffect, useCallback } from 'react';
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
import SitfisOverviewPanel, { classifyPendencies } from './SitfisOverviewPanel';
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

  // Backfill: classifica pendências de relatórios já consultados antes desta funcionalidade
  useEffect(() => {
    const targets = clients.filter(
      c => c.sitfis_status === 'irregular' && !!c.pdf_base64 && (!c.pendency_types || c.pendency_types.length === 0)
    );
    if (targets.length === 0) return;
    let cancelled = false;

    (async () => {
      const updates: { id: string; types: string[] }[] = [];
      for (const c of targets) {
        if (cancelled) return;
        const text = await extractTextFromPdfBase64(c.pdf_base64 as string);
        const types = classifyPendencies(text);
        if (types.length === 0) continue;
        await supabase
          .from('sitfis_results' as any)
          .update({ pendency_types: types } as any)
          .eq('client_id', c.id);
        updates.push({ id: c.id, types });
      }
      if (cancelled || updates.length === 0) return;
      setClients(prev =>
        prev.map(p => {
          const u = updates.find(x => x.id === p.id);
          return u ? { ...p, pendency_types: u.types } : p;
        })
      );
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

  async function consultarSitfis(clientId: string): Promise<boolean> {
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

      // Strip PDF/base64 blobs before keyword search to avoid false positives
      const stripBinaryFields = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(stripBinaryFields);
        const clean: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'pdf' || k === 'pdf_base64') continue;
          if (typeof v === 'string' && v.length > 500) continue;
          if (typeof v === 'object') {
            clean[k] = stripBinaryFields(v);
          } else {
            clean[k] = v;
          }
        }
        return clean;
      };
      // Check for regular status - only if NO negative indicators found
      // Search in parsed dados, responseData metadata, AND extracted PDF text
      const strippedDados = stripBinaryFields(parsedDados);
      const strippedResponse = stripBinaryFields(responseData);
      const responseStr = (
        JSON.stringify(strippedDados || '') +
        JSON.stringify(strippedResponse || '') +
        ' ' + pdfText
      ).toLowerCase();
      const negativeIndicators = [
        'irregular',
        'pendência', 'pendencia',
        'débito', 'debito',
        'inadimplente', 'inadimplência', 'inadimplencia',
        'dívida', 'divida',
        'multa',
        'infração', 'infracao',
        'não regular', 'nao regular',
        'situação irregular', 'situacao irregular',
        'exigibilidade suspensa',
        'cobrança', 'cobranca',
        'auto de infração', 'auto de infracao',
        'omissão', 'omissao',
        'parcelamento',
      ];

      const hasNegative = negativeIndicators.some(term => responseStr.includes(term));
      if (!hasNegative) {
        fiscalStatus = 'regular';
      }

      // Upsert result
      await supabase.from('sitfis_results' as any).upsert({
        client_id: clientId,
        status: fiscalStatus,
        consulted_at: new Date().toISOString(),
        pdf_base64: pdfBase64,
        raw_response: responseData,
        error_message: null,
        pendency_types: fiscalStatus === 'irregular' ? classifyPendencies(pdfText + ' ' + responseStr) : [],
      } as any, { onConflict: 'client_id' } as any);

      return true;
    } catch (err: any) {
      console.error(`[SITFIS] Erro para ${clientId}:`, err);
      await supabase.from('sitfis_results' as any).upsert({
        client_id: clientId,
        status: 'error',
        consulted_at: new Date().toISOString(),
        pdf_base64: null,
        raw_response: null,
        error_message: err.message || 'Erro desconhecido',
        pendency_types: [],
      } as any, { onConflict: 'client_id' } as any);
      return false;
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
      />
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
                        {c.error_message && c.sitfis_status === 'error' && (
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
