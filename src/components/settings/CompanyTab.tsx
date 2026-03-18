import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import forge from 'node-forge';

interface CompanyData {
  id?: string;
  company_name: string;
  cnpj: string;
  serpro_cnpj: string;
  address: string;
  phone: string;
  email: string;
  digital_certificate_url?: string | null;
  digital_certificate_password?: string | null;
  digital_certificate_expiry?: string | null;
}

export function CompanyTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<CompanyData>({
    company_name: '', cnpj: '', serpro_cnpj: '', address: '', phone: '', email: '',
  });

  useEffect(() => {
    supabase.from('company_settings').select('*').limit(1).single().then(({ data: row }) => {
      if (row) setData(row as unknown as CompanyData);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = data.id
      ? await supabase.from('company_settings').update(data).eq('id', data.id)
      : await supabase.from('company_settings').insert(data);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dados salvos com sucesso' });
      const { data: row } = await supabase.from('company_settings').select('*').limit(1).single();
      if (row) setData(row as unknown as CompanyData);
    }
  };

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data.id) return;
    if (!data.digital_certificate_password) {
      toast({ title: 'Informe a senha do certificado antes de fazer o upload', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const b64 = forge.util.encode64(String.fromCharCode(...bytes));
      const p12Der = forge.util.decode64(b64);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, data.digital_certificate_password);

      let expiry: Date | null = null;
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certs = certBags[forge.pki.oids.certBag] || [];
      for (const bag of certs) {
        if (bag.cert) {
          const notAfter = bag.cert.validity.notAfter;
          if (!expiry || notAfter < expiry) expiry = notAfter;
        }
      }

      const storagePath = `company/${data.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const updates = {
        digital_certificate_url: storagePath,
        digital_certificate_expiry: expiry ? expiry.toISOString().split('T')[0] : null,
      };

      const { error: updateError } = await supabase
        .from('company_settings')
        .update(updates)
        .eq('id', data.id);

      if (updateError) throw updateError;

      setData(prev => ({ ...prev, ...updates }));
      toast({ title: 'Certificado enviado com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao processar certificado', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCertificateDownload = async () => {
    if (!data.digital_certificate_url) return;
    const { data: blob, error } = await supabase.storage
      .from('certificates')
      .download(data.digital_certificate_url);
    if (error || !blob) {
      toast({ title: 'Erro ao baixar certificado', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.digital_certificate_url.split('/').pop() || 'certificado.pfx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCertificateRemove = async () => {
    if (!data.digital_certificate_url || !data.id) return;
    await supabase.storage.from('certificates').remove([data.digital_certificate_url]);
    const updates = {
      digital_certificate_url: null,
      digital_certificate_expiry: null,
      digital_certificate_password: null,
    };
    await supabase.from('company_settings').update(updates).eq('id', data.id);
    setData(prev => ({ ...prev, ...updates }));
    toast({ title: 'Certificado removido' });
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  const fields: { key: keyof CompanyData; label: string }[] = [
    { key: 'company_name', label: 'Razão Social' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'serpro_cnpj', label: 'CNPJ Contratante SERPRO' },
    { key: 'address', label: 'Endereço' },
    { key: 'phone', label: 'Telefone' },
    { key: 'email', label: 'Email' },
  ];

  const certExpiry = data.digital_certificate_expiry ? new Date(data.digital_certificate_expiry + 'T00:00:00') : null;
  const now = new Date();
  const daysUntilExpiry = certExpiry ? Math.ceil((certExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const certFileName = data.digital_certificate_url?.split('/').pop();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Input
                value={(data[f.key] as string) || ''}
                onChange={e => setData({ ...data, [f.key]: e.target.value })}
                disabled={!admin}
              />
            </div>
          ))}
          {admin && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Certificado Digital A1</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.digital_certificate_url && certFileName ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {daysUntilExpiry !== null && daysUntilExpiry > 30 ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium text-sm">{certFileName}</span>
                {certExpiry && (
                  <Badge variant={daysUntilExpiry !== null && daysUntilExpiry > 30 ? 'secondary' : 'destructive'}>
                    {daysUntilExpiry !== null && daysUntilExpiry > 0
                      ? `Vence em ${daysUntilExpiry} dias`
                      : 'Vencido'}
                  </Badge>
                )}
              </div>
              {admin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCertificateDownload}>
                    <Download className="h-4 w-4 mr-1" /> Baixar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleCertificateRemove}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado.</p>
          )}

          {admin && (
            <>
              <div className="space-y-1">
                <Label>Senha do Certificado</Label>
                <Input
                  type="password"
                  value={data.digital_certificate_password || ''}
                  onChange={e => setData({ ...data, digital_certificate_password: e.target.value })}
                  placeholder="Senha do arquivo .pfx/.p12"
                />
              </div>
              {data.digital_certificate_password && (
                <Button variant="outline" size="sm" disabled={saving} onClick={async () => {
                  if (!data.id) return;
                  setSaving(true);
                  await supabase.from('company_settings').update({ digital_certificate_password: data.digital_certificate_password }).eq('id', data.id);
                  setSaving(false);
                  toast({ title: 'Senha salva' });
                }}>
                  Salvar Senha
                </Button>
              )}
              <div className="space-y-1">
                <Label>Upload do Certificado (.pfx / .p12)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleCertificateUpload}
                  disabled={uploading || !data.digital_certificate_password}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                />
                {!data.digital_certificate_password && (
                  <p className="text-xs text-muted-foreground">Informe a senha antes de fazer upload.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
