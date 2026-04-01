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

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type DocumentType = { id: string; name: string; description: string | null };
type Client = { id: string; company_name: string; document: string | null };
type Doc = { id: string; document_type_id: string; client_id: string; reference_month: string; file_url: string; file_name: string; created_at: string; linked_obligation_id: string | null };
type Obligation = { id: string; name: string };

function cleanCnpj(raw: string | null | undefined): string {
  return (raw || '').replace(/\D/g, '');
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => it.str).join(' '));
  }
  return pages.join('\n');
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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dtRes, clRes, docRes, oblRes] = await Promise.all([
      supabase.from('document_types').select('id, name, description').order('name'),
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
    if (clean.length !== 14) return '';
    const found = clients.find(c => cleanCnpj(c.document) === clean);
    return found?.id || '';
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

    const fileList = Array.from(files);
    setAnalyzing(true);
    setUploadProgress({ current: 0, total: fileList.length });

    const pendingReview: ReviewData[] = [];
    let importedCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress({ current: i + 1, total: fileList.length });

      try {
        let text = '';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          text = await extractPdfText(file);
        }

        if (!text.trim()) {
          pendingReview.push({
            file,
            extraction: { cnpj: '', company_name: '', reference_month: '', document_type_name: '' },
            matchedClientId: '',
            matchedDocTypeId: '',
            referenceMonth: '',
          });
          continue;
        }

        const { data: aiResult, error: aiError } = await supabase.functions.invoke('classify-document', {
          body: {
            text,
            document_types: documentTypes.map(dt => ({ name: dt.name, description: dt.description })),
          },
        });

        if (aiError) throw new Error(aiError.message || 'Erro na classificação');

        const extraction: AiExtraction = {
          cnpj: aiResult?.cnpj || '',
          company_name: aiResult?.company_name || '',
          reference_month: aiResult?.reference_month || '',
          document_type_name: aiResult?.document_type_name || '',
        };

        const matchedClientId = matchClient(extraction.cnpj);
        const matchedDocTypeId = matchDocType(extraction.document_type_name);
        const referenceMonth = extraction.reference_month || '';

        if (matchedClientId && matchedDocTypeId && referenceMonth) {
          await importDocument(file, matchedClientId, matchedDocTypeId, referenceMonth + '-01');
          importedCount++;
        } else {
          pendingReview.push({ file, extraction, matchedClientId, matchedDocTypeId, referenceMonth });
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
  }, [clients, documentTypes]);

  async function handleReviewConfirm({ file, clientId, docTypeId, referenceMonth }: { file: File; clientId: string; docTypeId: string; referenceMonth: string }) {
    setConfirming(true);
    try {
      await importDocument(file, clientId, docTypeId, referenceMonth + '-01');
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

  async function importDocument(file: File, clientId: string, docTypeId: string, refMonth: string) {
    const path = `${clientId}/${refMonth}/${docTypeId}/${file.name}`;
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

    // Auto-associate obligations
    const { data: matchingActivities } = await supabase
      .from('obligation_activities')
      .select('id, obligation_id')
      .eq('type', 'document')
      .eq('document_type_id', docTypeId);

    let associatedCount = 0;
    let linkedObligationId: string | null = null;

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
          <p className="text-muted-foreground">Importação inteligente com classificação automática por IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={relinkDocuments} disabled={relinking}>
            {relinking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revinculando...</> : 'Revincular Documentos'}
          </Button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".pdf,.xml,.jpg,.jpeg,.png" multiple onChange={handleUpload} disabled={analyzing} />
            <Button asChild disabled={analyzing}>
              <span>
                {analyzing && uploadProgress
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando {uploadProgress.current}/{uploadProgress.total}...</>
                  : <><Upload className="h-4 w-4 mr-2" />Enviar Arquivos</>}
              </span>
            </Button>
          </label>
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
      />
    </div>
  );
}
