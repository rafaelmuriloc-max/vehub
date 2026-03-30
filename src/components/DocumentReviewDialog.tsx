import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface AiExtraction {
  cnpj: string;
  company_name: string;
  reference_month: string;
  document_type_name: string;
}

export interface ReviewData {
  file: File;
  extraction: AiExtraction;
  matchedClientId: string;
  matchedDocTypeId: string;
  referenceMonth: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReviewData | null;
  documentTypes: { id: string; name: string }[];
  clients: { id: string; company_name: string }[];
  onConfirm: (data: { file: File; clientId: string; docTypeId: string; referenceMonth: string }) => void;
  confirming: boolean;
  queueTotal?: number;
  onSkip?: () => void;
}

export default function DocumentReviewDialog({ open, onOpenChange, data, documentTypes, clients, onConfirm, confirming, queueTotal, onSkip }: Props) {
  if (!data) return null;

  const { file, extraction, matchedClientId, matchedDocTypeId, referenceMonth } = data;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onConfirm({
      file,
      clientId: fd.get('clientId') as string,
      docTypeId: fd.get('docTypeId') as string,
      referenceMonth: fd.get('referenceMonth') as string,
    });
  };

  const FieldStatus = ({ found }: { found: boolean }) =>
    found ? (
      <Badge variant="outline" className="text-green-600 border-green-300 gap-1 text-xs">
        <CheckCircle className="h-3 w-3" /> IA
      </Badge>
    ) : (
      <Badge variant="outline" className="text-orange-600 border-orange-300 gap-1 text-xs">
        <AlertCircle className="h-3 w-3" /> Revisar
      </Badge>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar Importação</DialogTitle>
          <DialogDescription>
            Arquivo: <strong>{file.name}</strong>
            {extraction.company_name && <> — Empresa detectada: <strong>{extraction.company_name}</strong></>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Tipo de Documento</Label>
              <FieldStatus found={!!matchedDocTypeId} />
            </div>
            <Select name="docTypeId" defaultValue={matchedDocTypeId} required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {documentTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {extraction.document_type_name && !matchedDocTypeId && (
              <p className="text-xs text-muted-foreground">IA detectou: "{extraction.document_type_name}" (não encontrado no cadastro)</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Cliente</Label>
              <FieldStatus found={!!matchedClientId} />
            </div>
            <Select name="clientId" defaultValue={matchedClientId} required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {extraction.cnpj && !matchedClientId && (
              <p className="text-xs text-muted-foreground">IA detectou CNPJ: {extraction.cnpj} (não encontrado no cadastro)</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Competência</Label>
              <FieldStatus found={!!referenceMonth} />
            </div>
            <Input type="month" name="referenceMonth" defaultValue={referenceMonth} required />
            {extraction.reference_month && !referenceMonth && (
              <p className="text-xs text-muted-foreground">IA detectou: {extraction.reference_month}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
              Cancelar
            </Button>
            <Button type="submit" disabled={confirming}>
              {confirming ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</> : 'Confirmar e Importar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
