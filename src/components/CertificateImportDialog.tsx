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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FolderOpen, Loader2, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw, FilePlus2, FileCheck2, FileX2, ShieldAlert, CalendarClock } from 'lucide-react';

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
            foundCert.subject.getField('CN')?.value,
            foundCert.subject.getField({ shortName: 'serialNumber' })?.value,
            foundCert.subject.getField({ type: '2.5.4.5' })?.value,
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
      case 'new': return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1"><FilePlus2 className="h-3 w-3" />Novo</Badge>;
      case 'exists': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1"><FileCheck2 className="h-3 w-3" />Atualizar</Badge>;
      case 'error': return <Badge variant="destructive" className="gap-1"><FileX2 className="h-3 w-3" />Erro</Badge>;
      case 'importing': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      default: return null;
    }
  };

  const expiryBadge = (expiry: Date | null) => {
    if (!expiry) return <span className="text-muted-foreground">-</span>;
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = expiry.toLocaleDateString('pt-BR');
    if (diffDays < 0) return <span className="text-destructive font-medium">{formatted}</span>;
    if (diffDays <= 30) return <span className="text-amber-600 dark:text-amber-400 font-medium">{formatted}</span>;
    if (diffDays <= 90) return <span className="text-yellow-600 dark:text-yellow-400">{formatted}</span>;
    return <span className="text-emerald-600 dark:text-emerald-400">{formatted}</span>;
  };

  const newCount = entries.filter(e => e.status === 'new').length;
  const existsCount = entries.filter(e => e.status === 'exists').length;
  const errorCount = entries.filter(e => e.status === 'error').length;
  const ignoredCount = entries.filter(e => e.status === 'error' && (e.error?.includes('pessoa física') || e.error?.includes('vencido'))).length;
  const realErrorCount = errorCount - ignoredCount;

  const StatusCard = ({ icon: Icon, label, count, color }: { icon: any; label: string; count: number; color: string }) => (
    <div className={`flex items-center gap-2 rounded-lg border p-3 ${color}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-xs opacity-80 truncate">{label}</p>
      </div>
    </div>
  );

  const MobileCard = ({ entry }: { entry: ImportEntry }) => (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs truncate max-w-[60%] block">{entry.fileName}</span>
            </TooltipTrigger>
            <TooltipContent>{entry.fileName}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {statusIcon(entry.status)}
      </div>
      {entry.cnpj && (
        <p className="text-sm"><span className="text-muted-foreground">CNPJ:</span> {formatCnpjDisplay(entry.cnpj)}</p>
      )}
      {entry.companyName && (
        <p className="text-sm truncate"><span className="text-muted-foreground">Razão Social:</span> {entry.companyName}</p>
      )}
      {entry.expiry && (
        <p className="text-sm flex items-center gap-1">
          <CalendarClock className="h-3 w-3 text-muted-foreground" />
          {expiryBadge(entry.expiry)}
        </p>
      )}
      {entry.error && <p className="text-xs text-destructive">{entry.error}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Importar Certificados A1</DialogTitle>
        </DialogHeader>

        {step === 'password' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe a senha padrão dos certificados e selecione a pasta contendo os arquivos <code className="bg-muted px-1 py-0.5 rounded text-xs">.pfx</code> / <code className="bg-muted px-1 py-0.5 rounded text-xs">.p12</code>.
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
            {/* Status summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatusCard icon={FilePlus2} label="Novos" count={newCount} color="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" />
              <StatusCard icon={FileCheck2} label="Existentes" count={existsCount} color="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" />
              <StatusCard icon={ShieldAlert} label="Ignorados" count={ignoredCount} color="bg-muted text-muted-foreground border-border" />
              <StatusCard icon={FileX2} label="Erros" count={realErrorCount} color="bg-destructive/10 text-destructive border-destructive/30" />
            </div>

            {/* Desktop table */}
            <div className="hidden md:block border rounded-lg max-h-[50vh] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Arquivo</TableHead>
                    <TableHead className="min-w-[160px]">CNPJ</TableHead>
                    <TableHead className="min-w-[200px]">Razão Social</TableHead>
                    <TableHead className="min-w-[110px]">Vencimento</TableHead>
                    <TableHead className="min-w-[140px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i} className={entry.status === 'error' ? 'opacity-60' : ''}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs truncate max-w-[180px] block">{entry.fileName}</span>
                            </TooltipTrigger>
                            <TooltipContent>{entry.fileName}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '-'}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{entry.companyName || '-'}</TableCell>
                      <TableCell>{expiryBadge(entry.expiry)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {statusIcon(entry.status)}
                          {entry.error && <span className="text-xs text-destructive">{entry.error}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2 max-h-[50vh] overflow-y-auto">
              {entries.map((entry, i) => (
                <MobileCard key={i} entry={entry} />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => { reset(); }} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={newCount + existsCount === 0}
                className="w-full sm:w-auto"
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
              {importing ? `Importando... ${progress}%` : 'Importação concluída!'}
            </p>

            {/* Desktop table */}
            <div className="hidden md:block border rounded-lg max-h-[50vh] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Arquivo</TableHead>
                    <TableHead className="min-w-[160px]">CNPJ</TableHead>
                    <TableHead className="min-w-[200px]">Razão Social</TableHead>
                    <TableHead className="min-w-[140px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.filter(e => e.status !== 'pending').map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs truncate max-w-[180px] block">{entry.fileName}</span>
                            </TooltipTrigger>
                            <TooltipContent>{entry.fileName}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '-'}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{entry.companyName || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {statusIcon(entry.status)}
                          {entry.error && <span className="text-xs text-destructive">{entry.error}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2 max-h-[50vh] overflow-y-auto">
              {entries.filter(e => e.status !== 'pending').map((entry, i) => (
                <MobileCard key={i} entry={entry} />
              ))}
            </div>

            {!importing && (
              <div className="flex justify-end">
                <Button onClick={() => { onOpenChange(false); reset(); }} className="w-full sm:w-auto">Fechar</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}