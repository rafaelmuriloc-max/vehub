import { useState, useRef } from 'react';
import * as forge from 'node-forge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Loader2, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

type ImportEntry = {
  file: File;
  fileName: string;
  cnpj: string | null;
  companyName: string | null;
  expiry: Date | null;
  status: 'pending' | 'new' | 'exists' | 'error' | 'importing' | 'done';
  error?: string;
  brasilApiData?: any;
};

function extractCnpjFromCert(cert: any): string | null {
  const cn = cert.subject.getField('CN');
  if (cn?.value) {
    // Format: "RAZAO SOCIAL:12345678000199" or just the CN with CNPJ
    const match = cn.value.match(/(\d{14})/);
    if (match) return match[1];
    // Try after colon
    const colonMatch = cn.value.match(/:(\d{14})/);
    if (colonMatch) return colonMatch[1];
  }
  // Fallback: serialNumber attribute (OID 2.5.4.5)
  const sn = cert.subject.getField({ shortName: 'serialNumber' }) || cert.subject.getField({ type: '2.5.4.5' });
  if (sn?.value) {
    const match = sn.value.match(/(\d{14})/);
    if (match) return match[1];
  }
  // Try extensions (otherName in SAN)
  try {
    const sanExt = cert.getExtension('subjectAltName');
    if (sanExt?.altNames) {
      for (const alt of sanExt.altNames) {
        const val = typeof alt.value === 'string' ? alt.value : JSON.stringify(alt.value || '');
        const match = val.match(/(\d{14})/);
        if (match) return match[1];
      }
    }
  } catch {}
  return null;
}

function formatCnpjDisplay(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

interface CertificateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  existingDocuments: string[];
}

export default function CertificateImportDialog({ open, onOpenChange, onImportComplete, existingDocuments }: CertificateImportDialogProps) {
  const [password, setPassword] = useState('');
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'password' | 'preview' | 'importing'>('password');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  function reset() {
    setPassword('');
    setEntries([]);
    setProcessing(false);
    setImporting(false);
    setProgress(0);
    setStep('password');
  }

  async function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const certFiles = Array.from(files).filter(f =>
      f.name.toLowerCase().endsWith('.pfx') || f.name.toLowerCase().endsWith('.p12')
    );

    if (certFiles.length === 0) {
      toast({ title: 'Nenhum certificado encontrado', description: 'A pasta não contém arquivos .pfx ou .p12.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    const results: ImportEntry[] = [];

    for (const file of certFiles) {
      const entry: ImportEntry = {
        file,
        fileName: file.name,
        cnpj: null,
        companyName: null,
        expiry: null,
        status: 'pending',
      };

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const asn1 = forge.asn1.fromDer(binary);
        let p12: any;
        try {
          p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
        } catch {
          entry.status = 'error';
          entry.error = 'Senha incorreta';
          results.push(entry);
          continue;
        }

        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certs = certBags[forge.pki.oids.certBag] || [];

        let foundCert: any = null;
        for (const bag of certs) {
          if (bag.cert) {
            foundCert = bag.cert;
            break;
          }
        }

        if (!foundCert) {
          entry.status = 'error';
          entry.error = 'Certificado não encontrado no arquivo';
          results.push(entry);
          continue;
        }

        entry.expiry = foundCert.validity.notAfter;

        // Filter expired certificates
        if (foundCert.validity.notAfter < new Date()) {
          entry.status = 'error';
          entry.error = `Certificado vencido (${foundCert.validity.notAfter.toLocaleDateString('pt-BR')})`;
          results.push(entry);
          continue;
        }

        const cnpj = extractCnpjFromCert(foundCert);

        if (!cnpj) {
          // Check if it's a CPF (pessoa física) certificate
          const allText = [
            cert.subject.getField('CN')?.value,
            cert.subject.getField({ shortName: 'serialNumber' })?.value,
            cert.subject.getField({ type: '2.5.4.5' })?.value,
          ].filter(Boolean).join(' ');
          const hasCpf = /\d{11}/.test(allText);

          entry.status = 'error';
          entry.error = hasCpf ? 'Certificado de pessoa física (CPF)' : 'CNPJ não encontrado no certificado';
          results.push(entry);
          continue;
        }

        entry.cnpj = cnpj;

        // Check if already exists
        const formatted = formatCnpjDisplay(cnpj);
        if (existingDocuments.some(d => d.replace(/\D/g, '') === cnpj)) {
          entry.status = 'exists';
          entry.companyName = '(já cadastrado)';
        } else {
          entry.status = 'new';
        }

        // Fetch BrasilAPI data
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
          if (res.ok) {
            const data = await res.json();
            entry.brasilApiData = data;
            entry.companyName = data.razao_social || null;
          }
        } catch {}

        results.push(entry);
      } catch (err: any) {
        entry.status = 'error';
        entry.error = err.message || 'Erro ao processar arquivo';
        results.push(entry);
      }
    }

    setEntries(results);
    setProcessing(false);
    setStep('preview');
    e.target.value = '';
  }

  async function handleImport() {
    const toImport = entries.filter(e => e.status === 'new' || e.status === 'exists');
    if (toImport.length === 0) return;

    setImporting(true);
    setStep('importing');
    let completed = 0;

    for (const entry of toImport) {
      setEntries(prev => prev.map(e => e === entry ? { ...e, status: 'importing' as const } : e));

      try {
        const cnpjFormatted = entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '';
        const data = entry.brasilApiData;

        if (entry.status === 'exists' || existingDocuments.some(d => d.replace(/\D/g, '') === entry.cnpj)) {
          // Update existing client: just upload certificate
          const { data: existingClients } = await supabase.from('clients').select('id').ilike('document', `%${entry.cnpj}%`).limit(1);
          const existingClient = existingClients?.[0];
          if (existingClient) {
            const filePath = `${existingClient.id}/${entry.file.name}`;
            await supabase.storage.from('certificates').upload(filePath, entry.file, { upsert: true });
            await supabase.from('clients').update({
              digital_certificate_url: filePath,
              digital_certificate_password: password,
              digital_certificate_expiry: entry.expiry ? entry.expiry.toISOString().split('T')[0] : null,
            } as any).eq('id', existingClient.id);
          }
        } else {
          // Create new client
          const address = data ? [data.logradouro, data.numero, data.complemento, data.bairro, `${data.municipio}/${data.uf}`, data.cep].filter(Boolean).join(', ') : null;
          const mainCnae = data?.cnae_fiscal ? `${String(data.cnae_fiscal).padStart(7, '0')} - ${data.cnae_fiscal_descricao}` : null;
          const secondaryCnaes = data?.cnaes_secundarios
            ?.filter((c: any) => c.codigo && c.codigo !== 0)
            .map((c: any) => `${String(c.codigo).padStart(7, '0')} - ${c.descricao}`)
            .join(', ') || null;
          const partners = data?.qsa?.map((s: any) => `${s.nome_socio} (${s.qualificacao_socio})`).join('\n') || null;

          const payload: any = {
            company_name: data?.razao_social || entry.fileName.replace(/\.(pfx|p12)$/i, ''),
            document: cnpjFormatted,
            address,
            contact_phone: data?.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : null,
            contact_email: data?.email || null,
            main_activity: mainCnae,
            secondary_activities: secondaryCnaes,
            partners_info: partners,
            foundation_date: data?.data_inicio_atividade || null,
            opening_date: data?.data_inicio_atividade || null,
            business_segment: data?.cnae_fiscal_descricao || null,
            digital_certificate_password: password,
            digital_certificate_expiry: entry.expiry ? entry.expiry.toISOString().split('T')[0] : null,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
            created_by: user?.id,
          };

          const { data: newClient, error } = await supabase.from('clients').insert(payload).select('id').single();
          if (error) throw error;

          if (newClient) {
            const filePath = `${newClient.id}/${entry.file.name}`;
            await supabase.storage.from('certificates').upload(filePath, entry.file, { upsert: true });
            await supabase.from('clients').update({ digital_certificate_url: filePath } as any).eq('id', newClient.id);
          }
        }

        setEntries(prev => prev.map(e => e === entry ? { ...e, status: 'done' as const } : e));
      } catch (err: any) {
        setEntries(prev => prev.map(e => e === entry ? { ...e, status: 'error' as const, error: err.message } : e));
      }

      completed++;
      setProgress(Math.round((completed / toImport.length) * 100));
    }

    setImporting(false);
    onImportComplete();
    toast({
      title: 'Importação concluída',
      description: `${entries.filter(e => e.status === 'done').length} clientes processados.`,
    });
  }

  const statusIcon = (status: ImportEntry['status']) => {
    switch (status) {
      case 'new': return <Badge className="bg-emerald-100 text-emerald-800">Novo</Badge>;
      case 'exists': return <Badge className="bg-amber-100 text-amber-800">Atualizar cert.</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'importing': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      default: return null;
    }
  };

  const newCount = entries.filter(e => e.status === 'new').length;
  const existsCount = entries.filter(e => e.status === 'exists').length;
  const errorCount = entries.filter(e => e.status === 'error').length;
  const ignoredCount = entries.filter(e => e.status === 'error' && (e.error?.includes('pessoa física') || e.error?.includes('vencido'))).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Certificados A1</DialogTitle>
        </DialogHeader>

        {step === 'password' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe a senha padrão dos certificados e selecione a pasta contendo os arquivos <code>.pfx</code> / <code>.p12</code>.
            </p>
            <div>
              <Label>Senha dos certificados</Label>
              <Input
                type="password"
                placeholder="Senha padrão"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              /* @ts-ignore */
              webkitdirectory="true"
              directory=""
              multiple
              className="hidden"
              onChange={handleFolderSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!password || processing}
              className="w-full"
            >
              {processing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>
              ) : (
                <><FolderOpen className="mr-2 h-4 w-4" />Selecionar Pasta</>
              )}
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-600 font-medium">{newCount} novos</span>
              <span className="text-amber-600 font-medium">{existsCount} existentes</span>
              {ignoredCount > 0 && <span className="text-muted-foreground font-medium">{ignoredCount} ignorados</span>}
              {errorCount - ignoredCount > 0 && <span className="text-destructive font-medium">{errorCount - ignoredCount} erros</span>}
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{entry.fileName}</TableCell>
                      <TableCell>{entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '-'}</TableCell>
                      <TableCell>{entry.companyName || '-'}</TableCell>
                      <TableCell>
                        {entry.expiry ? entry.expiry.toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {statusIcon(entry.status)}
                          {entry.error && <span className="text-xs text-destructive">{entry.error}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { reset(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={newCount + existsCount === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar {newCount + existsCount} cliente(s)
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              {importing ? 'Importando...' : 'Importação concluída!'}
            </p>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.filter(e => e.status !== 'pending').map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{entry.fileName}</TableCell>
                      <TableCell>{entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '-'}</TableCell>
                      <TableCell>{entry.companyName || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {statusIcon(entry.status)}
                          {entry.error && <span className="text-xs text-destructive">{entry.error}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!importing && (
              <div className="flex justify-end">
                <Button onClick={() => { onOpenChange(false); reset(); }}>Fechar</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
