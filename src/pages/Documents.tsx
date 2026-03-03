import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DocumentType = { id: string; name: string };
type Client = { id: string; company_name: string };
type Doc = { id: string; document_type_id: string; client_id: string; reference_month: string; file_url: string; file_name: string; created_at: string };

export default function Documents() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);

  const [selectedType, setSelectedType] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(format(new Date(), 'yyyy-MM-01'));
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [dtRes, clRes, docRes] = await Promise.all([
      supabase.from('document_types').select('id, name').order('name'),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
    ]);
    if (dtRes.data) setDocumentTypes(dtRes.data as DocumentType[]);
    if (clRes.data) setClients(clRes.data);
    if (docRes.data) setDocuments(docRes.data as Doc[]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedType || !selectedClient || !referenceMonth) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const path = `${selectedClient}/${referenceMonth}/${selectedType}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Save document record
      const { error: insertError } = await supabase.from('documents').insert({
        document_type_id: selectedType,
        client_id: selectedClient,
        reference_month: referenceMonth,
        file_url: path,
        file_name: file.name,
        uploaded_by: user?.id || null,
      } as any);
      if (insertError) throw insertError;

      // Auto-associate: find activities of type 'document' with this document_type_id
      // and mark completions for instances of this client/reference_month
      const { data: matchingActivities } = await supabase
        .from('obligation_activities')
        .select('id, obligation_id')
        .eq('type', 'document')
        .eq('document_type_id', selectedType);

      if (matchingActivities && matchingActivities.length > 0) {
        const obligationIds = [...new Set(matchingActivities.map(a => a.obligation_id))];
        const { data: matchingInstances } = await supabase
          .from('obligation_instances')
          .select('id, obligation_id')
          .eq('client_id', selectedClient)
          .eq('reference_month', referenceMonth)
          .in('obligation_id', obligationIds);

        if (matchingInstances && matchingInstances.length > 0) {
          for (const inst of matchingInstances) {
            const relatedActivities = matchingActivities.filter(a => a.obligation_id === inst.obligation_id);
            for (const act of relatedActivities) {
              // Check if completion exists
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
            }
          }
          toast({ title: 'Documento importado', description: 'Obrigações associadas foram atualizadas automaticamente.' });
        } else {
          toast({ title: 'Documento importado', description: 'Nenhuma competência encontrada para auto-associação.' });
        }
      } else {
        toast({ title: 'Documento importado' });
      }

      loadAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
        <p className="text-muted-foreground">Importação de documentos com associação automática às obrigações</p>
      </div>

      {/* Upload section */}
      <Card>
        <CardHeader><CardTitle className="text-base">Importar Documento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{documentTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competência *</Label>
              <Input type="date" value={referenceMonth} onChange={e => setReferenceMonth(e.target.value)} />
            </div>
            <div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading || !selectedType || !selectedClient} />
                <Button asChild disabled={uploading || !selectedType || !selectedClient}>
                  <span><Upload className="h-4 w-4 mr-2" />{uploading ? 'Enviando...' : 'Enviar Arquivo'}</span>
                </Button>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
