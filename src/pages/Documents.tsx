import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
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
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

    // Process first file (multi-file can be added later)
    const file = files[0];
    setAnalyzing(true);

    try {
      // 1. Extract text from PDF
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file);
      }

      if (!text.trim()) {
        // Non-PDF or empty: go straight to review with empty extraction
        setReviewData({
          file,
          extraction: { cnpj: '', company_name: '', reference_month: '', document_type_name: '' },
          matchedClientId: '',
          matchedDocTypeId: '',
          referenceMonth: '',
        });
        setReviewOpen(true);
        setAnalyzing(false);
        return;
      }

      // 2. Call AI to classify
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

      // 3. Match against local data
      const matchedClientId = matchClient(extraction.cnpj);
      const matchedDocTypeId = matchDocType(extraction.document_type_name);
      const referenceMonth = extraction.reference_month || '';

      // 4. If all matched → auto-import
      if (matchedClientId && matchedDocTypeId && referenceMonth) {
        await importDocument(file, matchedClientId, matchedDocTypeId, referenceMonth + '-01');
        setAnalyzing(false);
        return;
      }

      // 5. Otherwise → open review dialog
      setReviewData({ file, extraction, matchedClientId, matchedDocTypeId, referenceMonth });
      setReviewOpen(true);
    } catch (err: any) {
      toast({ title: 'Erro na análise', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
      e.target.value = '';
    }
  }, [clients, documentTypes]);

  async function handleReviewConfirm({ file, clientId, docTypeId, referenceMonth }: { file: File; clientId: string; docTypeId: string; referenceMonth: string }) {
    setConfirming(true);
    try {
      await importDocument(file, clientId, docTypeId, referenceMonth + '-01');
      setReviewOpen(false);
      setReviewData(null);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  }

  async function importDocument(file: File, clientId: string, docTypeId: string, refMonth: string) {
    const path = `${clientId}/${refMonth}/${docTypeId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from('documents').insert({
      document_type_id: docTypeId,
      client_id: clientId,
      reference_month: refMonth,
      file_url: path,
      file_name: file.name,
      uploaded_by: user?.id || null,
    } as any);
    if (insertError) throw insertError;

    // Auto-associate obligations
    const { data: matchingActivities } = await supabase
      .from('obligation_activities')
      .select('id, obligation_id')
      .eq('type', 'document')
      .eq('document_type_id', docTypeId);

    let associatedCount = 0;
    if (matchingActivities && matchingActivities.length > 0) {
      const obligationIds = [...new Set(matchingActivities.map(a => a.obligation_id))];
      const { data: matchingInstances } = await supabase
        .from('obligation_instances')
        .select('id, obligation_id')
        .eq('client_id', clientId)
        .eq('reference_month', refMonth)
        .in('obligation_id', obligationIds);

      if (matchingInstances) {
        for (const inst of matchingInstances) {
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
          }
        }
      }
    }

    toast({
      title: 'Documento importado com sucesso',
      description: associatedCount > 0
        ? `${associatedCount} atividade(s) de obrigação vinculada(s) automaticamente.`
        : 'Nenhuma obrigação vinculada encontrada para esta competência.',
    });

    loadAll();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Importação inteligente com classificação automática por IA</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" accept=".pdf,.xml,.jpg,.jpeg,.png" onChange={handleUpload} disabled={analyzing} />
          <Button asChild disabled={analyzing}>
            <span>
              {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando...</> : <><Upload className="h-4 w-4 mr-2" />Enviar Arquivo</>}
            </span>
          </Button>
        </label>
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
                  <TableCell>{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => downloadDoc(doc.file_url)}><Download className="h-4 w-4" /></Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => deleteDoc(doc)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum documento importado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocumentReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        data={reviewData}
        documentTypes={documentTypes}
        clients={clients}
        onConfirm={handleReviewConfirm}
        confirming={confirming}
      />
    </div>
  );
}
