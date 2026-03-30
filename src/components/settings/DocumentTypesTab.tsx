import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Upload, FileText, X } from 'lucide-react';

interface ExtractionConfig {
  cnpj_location?: string;
  company_name_location?: string;
  reference_month_location?: string;
  obligation_type_location?: string;
}

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  sample_file_url: string | null;
  sample_file_name: string | null;
  extraction_config: ExtractionConfig | null;
}

export function DocumentTypesTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<DocumentType[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [extractionConfig, setExtractionConfig] = useState<ExtractionConfig>({});
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [existingSampleName, setExistingSampleName] = useState<string | null>(null);
  const [existingSampleUrl, setExistingSampleUrl] = useState<string | null>(null);
  const [removeSample, setRemoveSample] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data } = await supabase.from('document_types').select('*').order('name');
    if (data) {
      setItems(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        sample_file_url: d.sample_file_url,
        sample_file_name: d.sample_file_name,
        extraction_config: d.extraction_config as ExtractionConfig | null,
      })));
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', description: '' });
    setExtractionConfig({});
    setSampleFile(null);
    setExistingSampleName(null);
    setExistingSampleUrl(null);
    setRemoveSample(false);
    setOpen(true);
  }

  function openEdit(d: DocumentType) {
    setEditing(d);
    setForm({ name: d.name, description: d.description || '' });
    setExtractionConfig(d.extraction_config || {});
    setSampleFile(null);
    setExistingSampleName(d.sample_file_name);
    setExistingSampleUrl(d.sample_file_url);
    setRemoveSample(false);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const config = extractionConfig;
      let sampleUrl = removeSample ? null : (existingSampleUrl || null);
      let sampleName = removeSample ? null : (existingSampleName || null);

      // If editing, use existing id; if creating, insert first to get id
      let docTypeId = editing?.id;

      if (!editing) {
        const { data: inserted, error: insertErr } = await supabase
          .from('document_types')
          .insert([{ name: form.name, description: form.description || null, extraction_config: config as any }])
          .select('id')
          .single();
        if (insertErr || !inserted) {
          toast({ title: 'Erro', description: insertErr?.message || 'Erro ao criar', variant: 'destructive' });
          return;
        }
        docTypeId = inserted.id;
      }

      // Upload sample file if provided
      if (sampleFile && docTypeId) {
        const ext = sampleFile.name.split('.').pop() || 'pdf';
        const sanitizedName = sampleFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `document-types/${docTypeId}/${sanitizedName}`;

        // Remove old file if replacing
        if (existingSampleUrl) {
          await supabase.storage.from('documents').remove([existingSampleUrl]);
        }

        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, sampleFile, { upsert: true });

        if (upErr) {
          toast({ title: 'Erro no upload', description: upErr.message, variant: 'destructive' });
          return;
        }
        sampleUrl = storagePath;
        sampleName = sampleFile.name;
      }

      // Remove old file if user clicked remove
      if (removeSample && existingSampleUrl) {
        await supabase.storage.from('documents').remove([existingSampleUrl]);
      }

      const payload: any = {
        name: form.name,
        description: form.description || null,
        sample_file_url: sampleUrl,
        sample_file_name: sampleName,
        extraction_config: config,
      };

      if (editing) {
        const { error } = await supabase.from('document_types').update(payload).eq('id', editing.id);
        if (error) {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          return;
        }
      } else {
        // Already inserted above, just update with file info
        const { error } = await supabase.from('document_types').update({
          sample_file_url: sampleUrl,
          sample_file_name: sampleName,
        }).eq('id', docTypeId!);
        if (error) {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          return;
        }
      }

      toast({ title: editing ? 'Atualizado' : 'Criado' });
      setOpen(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id);
    if (item?.sample_file_url) {
      await supabase.storage.from('documents').remove([item.sample_file_url]);
    }
    const { error } = await supabase.from('document_types').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Excluído' });
    fetchData();
  }

  const showingSample = !removeSample && (sampleFile || existingSampleName);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tipos de Documento</CardTitle>
        {isAdmin && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-center">Modelo</TableHead>
              {isAdmin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{d.description || '—'}</TableCell>
                <TableCell className="text-center">
                  {d.sample_file_url ? (
                    <FileText className="h-4 w-4 text-primary mx-auto" />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Nenhum tipo cadastrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Tipo' : 'Novo Tipo de Documento'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            {/* Sample file upload */}
            <div className="space-y-2">
              <Label>Arquivo-Modelo (referência para IA)</Label>
              {showingSample ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {sampleFile ? sampleFile.name : existingSampleName}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setSampleFile(null);
                      setRemoveSample(true);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-dashed rounded-md hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Selecionar arquivo-modelo...</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSampleFile(f);
                          setRemoveSample(false);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Envie um documento de exemplo para que a IA saiba onde localizar CNPJ, nome da empresa, competência, etc.
              </p>
            </div>

            {/* Extraction config fields */}
            <div className="space-y-3 border rounded-md p-3">
              <p className="text-sm font-medium">Configuração de extração</p>
              <p className="text-xs text-muted-foreground">
                Descreva onde cada informação se encontra no documento-modelo.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Localização do CNPJ</Label>
                <Input
                  placeholder='Ex: "canto superior esquerdo", "linha 3"'
                  value={extractionConfig.cnpj_location || ''}
                  onChange={e => setExtractionConfig({ ...extractionConfig, cnpj_location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Localização do Nome da Empresa</Label>
                <Input
                  placeholder='Ex: "abaixo do CNPJ", "cabeçalho"'
                  value={extractionConfig.company_name_location || ''}
                  onChange={e => setExtractionConfig({ ...extractionConfig, company_name_location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Localização da Competência</Label>
                <Input
                  placeholder='Ex: "campo Período de Referência"'
                  value={extractionConfig.reference_month_location || ''}
                  onChange={e => setExtractionConfig({ ...extractionConfig, reference_month_location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Localização do Tipo de Obrigação</Label>
                <Input
                  placeholder='Ex: "título do documento"'
                  value={extractionConfig.obligation_type_location || ''}
                  onChange={e => setExtractionConfig({ ...extractionConfig, obligation_type_location: e.target.value })}
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={!form.name || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
