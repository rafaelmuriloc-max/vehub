import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { sendActivityEmail } from '@/lib/sendActivityEmail';
import { sendActivityWhatsApp } from '@/lib/sendActivityWhatsApp';
import { ptBR } from 'date-fns/locale';
import * as pdfjs from 'pdfjs-dist';
import DocumentReviewDialog, { type AiExtraction, type ReviewData } from '@/components/DocumentReviewDialog';
import ImportSetupDialog, { type ImportContext } from '@/components/documents/ImportSetupDialog';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type FieldRegion = { page: number; x: number; y: number; width: number; height: number };
type ExtractionConfig = {
  cnpj_region?: FieldRegion | null;
  company_name_region?: FieldRegion | null;
  reference_month_region?: FieldRegion | null;
  obligation_type_region?: FieldRegion | null;
};
type DocumentType = { id: string; name: string; description: string | null; extraction_config: ExtractionConfig | null };
type Client = { id: string; company_name: string; document: string | null };
type Doc = { id: string; document_type_id: string; client_id: string; reference_month: string; file_url: string; file_name: string; created_at: string; linked_obligation_id: string | null };
type Obligation = { id: string; name: string };

function cleanCnpj(raw: string | null | undefined): string {
  return (raw || '').replace(/\D/g, '');
}

async function extractPdfText(file: File): Promise<string> {
  const { fullText } = await loadPdfPages(file);
  return fullText;
}

// Cached PDF data to avoid re-parsing per template
interface CachedPdfPage {
  page: any;
  viewport: any;
  content: any;
}

async function loadPdfPages(file: File, maxPages = 5): Promise<{ pages: CachedPdfPage[]; fullText: string }> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: CachedPdfPage[] = [];
  const textParts: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({ page, viewport, content });
    textParts.push(content.items.map((it: any) => it.str).join(' '));
  }
  return { pages, fullText: textParts.join('\n') };
}

function extractTextFromCachedRegion(cached: CachedPdfPage, region: FieldRegion): string {
  const { viewport, content } = cached;
  const absX = (region.x / 100) * viewport.width;
  const absY = (region.y / 100) * viewport.height;
  const absW = (region.width / 100) * viewport.width;
  const absH = (region.height / 100) * viewport.height;

  const texts: { x: number; str: string }[] = [];
  for (const item of content.items as any[]) {
    if (!item.str) continue;
    const tx = item.transform[4];
    const ty = viewport.height - item.transform[5];
    const itemH = item.height || 0;
    const itemW = item.width || 0;
    if (tx + itemW >= absX && tx <= absX + absW && ty + itemH >= absY && ty <= absY + absH) {
      texts.push({ x: tx, str: item.str });
    }
  }
  texts.sort((a, b) => a.x - b.x);
  return texts.map(t => t.str).join(' ').trim();
}

// Legacy wrapper kept for compatibility
async function extractTextFromRegion(file: File, region: FieldRegion): Promise<string> {
  const { pages } = await loadPdfPages(file, region.page);
  if (region.page > pages.length) return '';
  return extractTextFromCachedRegion(pages[region.page - 1], region);
}

function extractCnpjFromText(text: string): string {
  const formatted = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (formatted) return formatted[0].replace(/\D/g, '');
  const raw = text.replace(/\D/g, '');
  if (raw.length >= 14) return raw.substring(0, 14);
  const rootFormatted = text.match(/\d{2}\.?\d{3}\.?\d{3}/);
  if (rootFormatted) {
    const digits = rootFormatted[0].replace(/\D/g, '');
    if (digits.length === 8) return digits;
  }
  if (raw.length >= 8) return raw.substring(0, 8);
  return '';
}

function extractRefMonthFromText(text: string): string {
  const iso = text.match(/(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const brDate = text.match(/(\d{2})[\/\.](\d{4})/);
  if (brDate) return `${brDate[2]}-${brDate[1]}`;
  const months: Record<string, string> = {
    janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04',
    maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
    outubro: '10', novembro: '11', dezembro: '12',
  };
  const monthName = text.match(new RegExp(`(${Object.keys(months).join('|')})[\\s\\/]*(?:de\\s*)?(\\d{4})`, 'i'));
  if (monthName) return `${monthName[2]}-${months[monthName[1].toLowerCase()]}`;
  return '';
}

function isValidRefMonth(m: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(m)) return false;
  const [y, mo] = m.split('-').map(Number);
  return y >= 2000 && y <= 2099 && mo >= 1 && mo <= 12;
}

async function tryExtractByRegions(
  file: File,
  documentTypes: DocumentType[],
  matchClientFn: (cnpj: string) => string,
): Promise<{ docTypeId: string; clientId: string; referenceMonth: string } | null> {
  const typesWithConfig = documentTypes.filter(dt => {
    const cfg = dt.extraction_config;
    return cfg && (cfg.cnpj_region || cfg.reference_month_region || cfg.obligation_type_region);
  });

  // Load PDF once and reuse for all templates
  const { pages: cachedPages, fullText } = await loadPdfPages(file);

  // --- Phase 1: Score each template using configured regions ---
  if (typesWithConfig.length > 0) {
    const scored: { dt: DocumentType; score: number; clientId: string; refMonth: string }[] = [];

    for (const dt of typesWithConfig) {
      const cfg = dt.extraction_config!;
      let score = 0;
      let cnpj = '';
      let refMonth = '';
      let clientId = '';

      // Check obligation_type_region — does extracted text match this template's name?
      if (cfg.obligation_type_region && cfg.obligation_type_region.page <= cachedPages.length) {
        const typeText = extractTextFromCachedRegion(cachedPages[cfg.obligation_type_region.page - 1], cfg.obligation_type_region);
        if (typeText && dt.name.toLowerCase().split(/\s+/).some(word => word.length > 2 && typeText.toLowerCase().includes(word))) {
          score += 2;
        }
      }

      // Extract CNPJ from region
      if (cfg.cnpj_region && cfg.cnpj_region.page <= cachedPages.length) {
        const cnpjText = extractTextFromCachedRegion(cachedPages[cfg.cnpj_region.page - 1], cfg.cnpj_region);
        cnpj = extractCnpjFromText(cnpjText);
        clientId = matchClientFn(cnpj);
        if (clientId) score += 1;
      }

      // Extract reference month from region
      if (cfg.reference_month_region && cfg.reference_month_region.page <= cachedPages.length) {
        const refText = extractTextFromCachedRegion(cachedPages[cfg.reference_month_region.page - 1], cfg.reference_month_region);
        refMonth = extractRefMonthFromText(refText);
        if (isValidRefMonth(refMonth)) score += 1;
      }

      if (score >= 2) {
        scored.push({ dt, score, clientId, refMonth });
      }
    }

    if (scored.length > 0) {
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      return { docTypeId: best.dt.id, clientId: best.clientId, referenceMonth: best.refMonth };
    }
  }

  // --- Phase 2: Fallback — search full text for document type names ---
  const fullTextLower = fullText.toLowerCase();
  for (const dt of documentTypes) {
    const nameWords = dt.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matched = nameWords.every(word => fullTextLower.includes(word));
    if (matched && nameWords.length > 0) {
      const cnpj = extractCnpjFromText(fullText);
      const clientId = matchClientFn(cnpj);
      const refMonth = extractRefMonthFromText(fullText);
      if (clientId) {
        return { docTypeId: dt.id, clientId, referenceMonth: refMonth };
      }
    }
  }

  return null;
}

export default function Documents() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewData[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [importContext, setImportContext] = useState<ImportContext | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dtRes, clRes, docRes, oblRes] = await Promise.all([
      supabase.from('document_types').select('id, name, description, extraction_config').order('name'),
      supabase.from('clients').select('id, company_name, document').eq('status', 'active').order('company_name'),
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('obligations').select('id, name'),
    ]);
    if (dtRes.data) setDocumentTypes(dtRes.data as DocumentType[]);
    if (clRes.data) setClients(clRes.data);
    if (docRes.data) setDocuments(docRes.data as Doc[]);
    if (oblRes.data) setObligations(oblRes.data);
  }

  function matchClient(cnpj: string): string {
    if (!cnpj) return '';
    const clean = cleanCnpj(cnpj);
    if (clean.length < 8) return '';

    // Busca exata (14 dígitos)
    if (clean.length === 14) {
      const exact = clients.find(c => cleanCnpj(c.document) === clean);
      if (exact) return exact.id;
    }

    // Fallback: CNPJ raiz (8 primeiros dígitos)
    const root = clean.substring(0, 8);
    const byRoot = clients.find(c => cleanCnpj(c.document).substring(0, 8) === root);
    return byRoot?.id || '';
  }

  function matchDocType(name: string): string {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    const found = documentTypes.find(dt => dt.name.toLowerCase().trim() === lower);
    return found?.id || '';
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const ctx = importContext;
    if (!ctx) { e.target.value = ''; return; }

    const fileList = Array.from(files);
    setAnalyzing(true);
    setUploadProgress({ current: 0, total: fileList.length });

    const pendingReview: ReviewData[] = [];
    let importedCount = 0;

    const refMonthIso = ctx.referenceMonth + '-01';
    const allowedTypes = documentTypes.filter(dt => ctx.allowedDocTypeIds.includes(dt.id));
    const allowedById = new Map(allowedTypes.map(dt => [dt.id, dt] as const));

    function pickTypeFromText(text: string): string {
      if (!text) return '';
      const lower = text.toLowerCase();
      for (const dt of allowedTypes) {
        const words = dt.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0 && words.every(w => lower.includes(w))) return dt.id;
      }
      return '';
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress({ current: i + 1, total: fileList.length });

      try {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        let pdfText = '';
        if (isPdf) {
          try { pdfText = await extractPdfText(file); } catch { pdfText = ''; }
        }

        // --- Identify company (CNPJ) ---
        let clientId = '';
        let detectedCnpj = '';

        // 1) Region-based CNPJ
        if (isPdf) {
          for (const dt of allowedTypes) {
            const region = dt.extraction_config?.cnpj_region;
            if (!region) continue;
            try {
              const txt = await extractTextFromRegion(file, region);
              const cnpj = extractCnpjFromText(txt);
              if (cnpj) {
                detectedCnpj = cnpj;
                clientId = matchClient(cnpj);
                if (clientId) break;
              }
            } catch { /* ignore */ }
          }
        }

        // 2) Regex on full text
        if (!clientId && pdfText) {
          const cnpj = extractCnpjFromText(pdfText);
          if (cnpj) {
            detectedCnpj = detectedCnpj || cnpj;
            clientId = matchClient(cnpj);
          }
        }

        // 3) AI lean fallback (cnpj_only)
        if (!clientId && pdfText.trim()) {
          try {
            const { data: aiResult } = await supabase.functions.invoke('classify-document', {
              body: { mode: 'cnpj_only', text: pdfText },
            });
            if (aiResult?.cnpj) {
              detectedCnpj = aiResult.cnpj;
              clientId = matchClient(aiResult.cnpj);
            }
          } catch (e) { console.warn('cnpj_only fallback failed', e); }
        }

        // --- Pick document type ---
        let docTypeId = '';
        if (allowedTypes.length === 1) {
          docTypeId = allowedTypes[0].id;
        } else if (allowedTypes.length > 1) {
          docTypeId = pickTypeFromText(pdfText);
          if (!docTypeId && pdfText.trim()) {
            try {
              const { data: aiResult } = await supabase.functions.invoke('classify-document', {
                body: {
                  mode: 'pick_doctype',
                  text: pdfText,
                  document_types: allowedTypes.map(dt => ({ name: dt.name, description: dt.description })),
                },
              });
              if (aiResult?.document_type_name) {
                const match = allowedTypes.find(dt => dt.name.toLowerCase().trim() === String(aiResult.document_type_name).toLowerCase().trim());
                if (match) docTypeId = match.id;
              }
            } catch (e) { console.warn('pick_doctype fallback failed', e); }
          }
        }

        if (clientId && docTypeId) {
          await importDocument(file, clientId, docTypeId, refMonthIso, ctx.obligationId);
          importedCount++;
        } else {
          pendingReview.push({
            file,
            extraction: { cnpj: detectedCnpj, company_name: '', reference_month: ctx.referenceMonth, document_type_name: docTypeId ? (allowedById.get(docTypeId)?.name || '') : '' },
            matchedClientId: clientId,
            matchedDocTypeId: docTypeId,
            referenceMonth: ctx.referenceMonth,
          });
        }
      } catch (err: any) {
        toast({ title: `Erro ao analisar ${file.name}`, description: err.message, variant: 'destructive' });
      }
    }

    setAnalyzing(false);
    setUploadProgress(null);
    e.target.value = '';

    if (pendingReview.length > 0) {
      setReviewQueue(pendingReview);
      setReviewOpen(true);
      if (importedCount > 0) {
        toast({ title: `${importedCount} documento(s) importado(s) automaticamente`, description: `${pendingReview.length} pendente(s) de revisão.` });
      }
    } else if (importedCount > 0) {
      toast({ title: `${importedCount} documento(s) importado(s) com sucesso!` });
    }
  }, [clients, documentTypes, importContext]);

  async function handleReviewConfirm({ file, clientId, docTypeId, referenceMonth }: { file: File; clientId: string; docTypeId: string; referenceMonth: string }) {
    if (!isValidRefMonth(referenceMonth)) {
      toast({ title: 'Mês de referência inválido', description: 'Use o formato AAAA-MM com ano/mês válidos.', variant: 'destructive' });
      return;
    }
    setConfirming(true);
    try {
      await importDocument(file, clientId, docTypeId, referenceMonth + '-01', importContext?.obligationId);
      // Move to next in queue
      const remaining = reviewQueue.slice(1);
      if (remaining.length > 0) {
        setReviewQueue(remaining);
      } else {
        setReviewQueue([]);
        setReviewOpen(false);
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  }

  function handleSkipReview() {
    const remaining = reviewQueue.slice(1);
    if (remaining.length > 0) {
      setReviewQueue(remaining);
    } else {
      setReviewQueue([]);
      setReviewOpen(false);
    }
  }

  function sanitizeFileName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async function isInstanceFullyCompleted(instanceId: string, obligationId: string): Promise<boolean> {
    const { data: acts } = await supabase
      .from('obligation_activities')
      .select('id')
      .eq('obligation_id', obligationId);
    if (!acts || acts.length === 0) return false;
    const { data: completions } = await supabase
      .from('obligation_activity_completions')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('completed', true);
    return (completions?.length || 0) >= acts.length;
  }

  async function importDocument(file: File, clientId: string, docTypeId: string, refMonth: string, presetObligationId?: string) {
    const path = `${clientId}/${refMonth}/${docTypeId}/${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: insertedDoc, error: insertError } = await supabase.from('documents').insert({
      document_type_id: docTypeId,
      client_id: clientId,
      reference_month: refMonth,
      file_url: path,
      file_name: file.name,
      uploaded_by: user?.id || null,
    } as any).select('id').single();
    if (insertError) throw insertError;

    // Auto-associate obligations. When the user pre-selected an obligation, restrict to it.
    let matchingActivitiesQuery = supabase
      .from('obligation_activities')
      .select('id, obligation_id')
      .eq('type', 'document')
      .eq('document_type_id', docTypeId);
    if (presetObligationId) matchingActivitiesQuery = matchingActivitiesQuery.eq('obligation_id', presetObligationId);
    const { data: matchingActivities } = await matchingActivitiesQuery;

    let associatedCount = 0;
    let linkedObligationId: string | null = presetObligationId || null;

    if (matchingActivities && matchingActivities.length > 0) {
      const obligationIds = [...new Set(matchingActivities.map(a => a.obligation_id))];

      // Fetch competence_rule for each obligation
      const { data: oblRules } = await supabase
        .from('obligations')
        .select('id, competence_rule')
        .in('id', obligationIds);

      const ruleMap = new Map<string, string>();
      (oblRules || []).forEach(o => ruleMap.set(o.id, o.competence_rule));

      // Group obligations by the instance reference_month they need
      const currentMonthObIds: string[] = [];
      const nextMonthObIds: string[] = [];
      for (const obId of obligationIds) {
        if (ruleMap.get(obId) === 'previous') {
          nextMonthObIds.push(obId);
        } else {
          currentMonthObIds.push(obId);
        }
      }

      const nextMonth = format(addMonths(new Date(refMonth + 'T00:00:00'), 1), 'yyyy-MM-dd');
      const allInstances: { id: string; obligation_id: string }[] = [];

      // Fetch instances for current-month obligations
      if (currentMonthObIds.length > 0) {
        const { data } = await supabase
          .from('obligation_instances')
          .select('id, obligation_id')
          .eq('client_id', clientId)
          .eq('reference_month', refMonth)
          .in('obligation_id', currentMonthObIds);
        if (data) allInstances.push(...data);
      }

      // Fetch instances for previous-competence obligations (next month)
      if (nextMonthObIds.length > 0) {
        const { data } = await supabase
          .from('obligation_instances')
          .select('id, obligation_id')
          .eq('client_id', clientId)
          .eq('reference_month', nextMonth)
          .in('obligation_id', nextMonthObIds);
        if (data) allInstances.push(...data);
      }

      for (const inst of allInstances) {
        if (await isInstanceFullyCompleted(inst.id, inst.obligation_id)) continue;
        if (!linkedObligationId) linkedObligationId = inst.obligation_id;
        const relatedActivities = matchingActivities.filter(a => a.obligation_id === inst.obligation_id);
        for (const act of relatedActivities) {
          const { data: existing } = await supabase
            .from('obligation_activity_completions')
            .select('id')
            .eq('instance_id', inst.id)
            .eq('activity_id', act.id)
            .maybeSingle();

          if (existing) {
            await supabase.from('obligation_activity_completions').update({
              completed: true, completed_at: new Date().toISOString(), file_url: path,
            }).eq('id', existing.id);
          } else {
            await supabase.from('obligation_activity_completions').insert({
              instance_id: inst.id, activity_id: act.id, completed: true, completed_at: new Date().toISOString(), file_url: path,
            });
          }
          associatedCount++;

          // Auto-start chain for subsequent activities
          const { data: allObActivities } = await supabase
            .from('obligation_activities')
            .select('id, obligation_id, type, order, auto_start, email_department_id, email_subject, email_body, whatsapp_template_name, whatsapp_message_body, whatsapp_button_url, whatsapp_has_document_header')
            .eq('obligation_id', inst.obligation_id)
            .order('order');

          if (allObActivities) {
            const actIdx = allObActivities.findIndex(a => a.id === act.id);
            if (actIdx >= 0) {
              // Fetch obligation details for sending
              const { data: oblDetail } = await supabase
                .from('obligations')
                .select('name, due_day, department_id')
                .eq('id', inst.obligation_id)
                .single();

              const { data: instDetail } = await supabase
                .from('obligation_instances')
                .select('reference_month')
                .eq('id', inst.id)
                .single();

              for (let ai = actIdx + 1; ai < allObActivities.length; ai++) {
                const nextAct = allObActivities[ai];
                if (!nextAct.auto_start) break;

                if (nextAct.type === 'email' && oblDetail && instDetail) {
                  const result = await sendActivityEmail({
                    activity: nextAct,
                    instanceId: inst.id,
                    clientId,
                    obligationName: oblDetail.name,
                    referenceMonth: instDetail.reference_month,
                    dueDay: oblDetail.due_day,
                    departmentId: oblDetail.department_id,
                  });
                  if (!result.success) break;
                } else if (nextAct.type === 'whatsapp' && oblDetail && instDetail) {
                  const result = await sendActivityWhatsApp({
                    activity: nextAct,
                    instanceId: inst.id,
                    clientId,
                    obligationName: oblDetail.name,
                    referenceMonth: instDetail.reference_month,
                    dueDay: oblDetail.due_day,
                    departmentId: oblDetail.department_id,
                  });
                  if (!result.success) break;
                } else {
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Save linked obligation on document record
    if (linkedObligationId && insertedDoc?.id) {
      await supabase.from('documents').update({ linked_obligation_id: linkedObligationId } as any).eq('id', insertedDoc.id);
    }

    toast({
      title: 'Documento importado com sucesso',
      description: associatedCount > 0
        ? `${associatedCount} atividade(s) de obrigação vinculada(s) automaticamente.`
        : 'Nenhuma obrigação vinculada encontrada para esta competência.',
    });

    loadAll();
  }

  async function relinkDocuments() {
    setRelinking(true);
    try {
      const unlinked = documents.filter(d => !d.linked_obligation_id);
      if (unlinked.length === 0) {
        toast({ title: 'Todos os documentos já estão vinculados.' });
        return;
      }

      // Batch fetch all document-type activities
      const { data: allActivities } = await supabase
        .from('obligation_activities')
        .select('id, obligation_id, document_type_id')
        .eq('type', 'document');

      if (!allActivities || allActivities.length === 0) {
        toast({ title: 'Nenhuma atividade de documento cadastrada nas obrigações.' });
        return;
      }

      let linkedCount = 0;

      for (const doc of unlinked) {
        const matchingActs = allActivities.filter(a => a.document_type_id === doc.document_type_id);
        if (matchingActs.length === 0) continue;

        const obligationIds = [...new Set(matchingActs.map(a => a.obligation_id))];

        // Fetch competence_rule for matched obligations
        const { data: oblRules } = await supabase
          .from('obligations')
          .select('id, competence_rule')
          .in('id', obligationIds);

        const ruleMap = new Map<string, string>();
        (oblRules || []).forEach(o => ruleMap.set(o.id, o.competence_rule));

        const currentMonthObIds = obligationIds.filter(id => ruleMap.get(id) !== 'previous');
        const nextMonthObIds = obligationIds.filter(id => ruleMap.get(id) === 'previous');
        const nextMonth = format(addMonths(new Date(doc.reference_month + 'T00:00:00'), 1), 'yyyy-MM-dd');

        const allInstances: { id: string; obligation_id: string }[] = [];

        if (currentMonthObIds.length > 0) {
          const { data } = await supabase
            .from('obligation_instances')
            .select('id, obligation_id')
            .eq('client_id', doc.client_id)
            .eq('reference_month', doc.reference_month)
            .in('obligation_id', currentMonthObIds);
          if (data) allInstances.push(...data);
        }

        if (nextMonthObIds.length > 0) {
          const { data } = await supabase
            .from('obligation_instances')
            .select('id, obligation_id')
            .eq('client_id', doc.client_id)
            .eq('reference_month', nextMonth)
            .in('obligation_id', nextMonthObIds);
          if (data) allInstances.push(...data);
        }

        if (allInstances.length === 0) continue;

        let linkedObligationId: string | null = null;
        for (const inst of allInstances) {
          if (await isInstanceFullyCompleted(inst.id, inst.obligation_id)) continue;
          if (!linkedObligationId) linkedObligationId = inst.obligation_id;
          const relatedActs = matchingActs.filter(a => a.obligation_id === inst.obligation_id);
          for (const act of relatedActs) {
            const { data: existing } = await supabase
              .from('obligation_activity_completions')
              .select('id')
              .eq('instance_id', inst.id)
              .eq('activity_id', act.id)
              .maybeSingle();

            if (existing) {
              await supabase.from('obligation_activity_completions').update({
                completed: true, completed_at: new Date().toISOString(), file_url: doc.file_url,
              }).eq('id', existing.id);
            } else {
              await supabase.from('obligation_activity_completions').insert({
                instance_id: inst.id, activity_id: act.id, completed: true, completed_at: new Date().toISOString(), file_url: doc.file_url,
              });
            }
          }
        }

        if (linkedObligationId) {
          await supabase.from('documents').update({ linked_obligation_id: linkedObligationId } as any).eq('id', doc.id);
          linkedCount++;
        }
      }

      toast({
        title: 'Revinculação concluída',
        description: linkedCount > 0
          ? `${linkedCount} documento(s) vinculado(s) a obrigações.`
          : 'Nenhum documento encontrou obrigação correspondente.',
      });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Erro na revinculação', description: err.message, variant: 'destructive' });
    } finally {
      setRelinking(false);
    }
  }

  async function downloadDoc(fileUrl: string) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank');
  }

  async function deleteDoc(doc: Doc) {
    await supabase.storage.from('documents').remove([doc.file_url]);
    await supabase.from('documents').delete().eq('id', doc.id);
    toast({ title: 'Documento removido' });
    loadAll();
  }

  function getTypeName(id: string) { return documentTypes.find(d => d.id === id)?.name || '—'; }
  function getClientName(id: string) { return clients.find(c => c.id === id)?.company_name || '—'; }
  function getObligationName(id: string | null) { if (!id) return '—'; return obligations.find(o => o.id === id)?.name || '—'; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Pré-selecione obrigação e tipo — a IA só identifica a empresa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={relinkDocuments} disabled={relinking}>
            {relinking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revinculando...</> : 'Revincular Documentos'}
          </Button>
          <input
            id="documents-file-input"
            type="file"
            className="hidden"
            accept=".pdf,.xml,.jpg,.jpeg,.png"
            multiple
            onChange={handleUpload}
            disabled={analyzing}
          />
          <Button onClick={() => setSetupOpen(true)} disabled={analyzing}>
            {analyzing && uploadProgress
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando {uploadProgress.current}/{uploadProgress.total}...</>
              : <><Upload className="h-4 w-4 mr-2" />Importar Documentos</>}
          </Button>
        </div>
      </div>

      {/* Documents list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Documentos Importados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Obrigação</TableHead>
                <TableHead>Data Upload</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.file_name}</span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{getTypeName(doc.document_type_id)}</Badge></TableCell>
                  <TableCell>{getClientName(doc.client_id)}</TableCell>
                  <TableCell>{format(new Date(doc.reference_month + 'T00:00:00'), 'MM/yyyy')}</TableCell>
                  <TableCell>{getObligationName(doc.linked_obligation_id)}</TableCell>
                  <TableCell>{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => downloadDoc(doc.file_url)}><Download className="h-4 w-4" /></Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => deleteDoc(doc)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum documento importado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocumentReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => { if (!open) { setReviewQueue([]); } setReviewOpen(open); }}
        data={reviewQueue[0] || null}
        documentTypes={documentTypes}
        clients={clients}
        onConfirm={handleReviewConfirm}
        confirming={confirming}
        queueTotal={reviewQueue.length}
        onSkip={handleSkipReview}
        lockedReferenceMonth={importContext?.referenceMonth}
        allowedDocTypeIds={importContext?.allowedDocTypeIds}
        obligationName={obligations.find(o => o.id === importContext?.obligationId)?.name}
      />

      <ImportSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onConfirm={(ctx) => {
          setImportContext(ctx);
          setSetupOpen(false);
          // Open native file picker after context is set
          setTimeout(() => {
            const input = document.getElementById('documents-file-input') as HTMLInputElement | null;
            input?.click();
          }, 50);
        }}
      />
    </div>
  );
}
