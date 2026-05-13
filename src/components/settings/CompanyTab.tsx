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
  accountant_certificate_url?: string | null;
  accountant_certificate_password?: string | null;
  accountant_certificate_expiry?: string | null;
  accountant_cpf?: string | null;
  chat_alert_whatsapp_group_id?: string | null;
}

export function CompanyTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAccountant, setUploadingAccountant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountantFileInputRef = useRef<HTMLInputElement>(null);
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

  const handleCertUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    passwordField: 'digital_certificate_password' | 'accountant_certificate_password',
    urlField: 'digital_certificate_url' | 'accountant_certificate_url',
    expiryField: 'digital_certificate_expiry' | 'accountant_certificate_expiry',
    storagePrefixSuffix: string,
    setUploadingFn: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !data.id) return;
    const password = data[passwordField];
    if (!password) {
      toast({ title: 'Informe a senha do certificado antes de fazer o upload', variant: 'destructive' });
      return;
    }

    setUploadingFn(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const b64 = forge.util.encode64(String.fromCharCode(...bytes));
      const p12Der = forge.util.decode64(b64);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      let expiry: Date | null = null;
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certs = certBags[forge.pki.oids.certBag] || [];
      for (const bag of certs) {
        if (bag.cert) {
          const notAfter = bag.cert.validity.notAfter;
          if (!expiry || notAfter < expiry) expiry = notAfter;
        }
      }

      const storagePath = `company/${data.id}/${storagePrefixSuffix}${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const updates: Record<string, string | null> = {
        [urlField]: storagePath,
        [expiryField]: expiry ? expiry.toISOString().split('T')[0] : null,
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
      setUploadingFn(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCertDownload = async (urlField: 'digital_certificate_url' | 'accountant_certificate_url') => {
    const url = data[urlField];
    if (!url) return;
    const { data: blob, error } = await supabase.storage.from('certificates').download(url);
    if (error || !blob) {
      toast({ title: 'Erro ao baixar certificado', variant: 'destructive' });
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = url.split('/').pop() || 'certificado.pfx';
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handleCertRemove = async (
    urlField: 'digital_certificate_url' | 'accountant_certificate_url',
    expiryField: 'digital_certificate_expiry' | 'accountant_certificate_expiry',
    passwordField: 'digital_certificate_password' | 'accountant_certificate_password',
  ) => {
    const url = data[urlField];
    if (!url || !data.id) return;
    await supabase.storage.from('certificates').remove([url]);
    const updates: Record<string, null> = {
      [urlField]: null,
      [expiryField]: null,
      [passwordField]: null,
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

  const renderCertSection = (
    title: string,
    urlField: 'digital_certificate_url' | 'accountant_certificate_url',
    expiryField: 'digital_certificate_expiry' | 'accountant_certificate_expiry',
    passwordField: 'digital_certificate_password' | 'accountant_certificate_password',
    storagePrefixSuffix: string,
    isUploading: boolean,
    setUploadingFn: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>,
    extraFields?: React.ReactNode,
  ) => {
    const certUrl = data[urlField];
    const certExpiry = data[expiryField] ? new Date(data[expiryField] + 'T00:00:00') : null;
    const now = new Date();
    const daysUntilExpiry = certExpiry ? Math.ceil((certExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const certFileName = certUrl?.split('/').pop();

    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {extraFields}
          {certUrl && certFileName ? (
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
                  <Button variant="outline" size="sm" onClick={() => handleCertDownload(urlField)}>
                    <Download className="h-4 w-4 mr-1" /> Baixar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleCertRemove(urlField, expiryField, passwordField)}>
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
                  value={(data[passwordField] as string) || ''}
                  onChange={e => setData({ ...data, [passwordField]: e.target.value })}
                  placeholder="Senha do arquivo .pfx/.p12"
                />
              </div>
              {data[passwordField] && (
                <Button variant="outline" size="sm" disabled={saving} onClick={async () => {
                  if (!data.id) return;
                  setSaving(true);
                  await supabase.from('company_settings').update({ [passwordField]: data[passwordField] }).eq('id', data.id);
                  setSaving(false);
                  toast({ title: 'Senha salva' });
                }}>
                  Salvar Senha
                </Button>
              )}
              <div className="space-y-1">
                <Label>Upload do Certificado (.pfx / .p12)</Label>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={e => handleCertUpload(e, passwordField, urlField, expiryField, storagePrefixSuffix, setUploadingFn, inputRef)}
                  disabled={isUploading || !data[passwordField]}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                />
                {!data[passwordField] && (
                  <p className="text-xs text-muted-foreground">Informe a senha antes de fazer upload.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

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

      {renderCertSection(
        'Certificado Digital A1 (Escritório)',
        'digital_certificate_url',
        'digital_certificate_expiry',
        'digital_certificate_password',
        '',
        uploading,
        setUploading,
        fileInputRef,
      )}

      {renderCertSection(
        'Certificado do Contador (e-CPF)',
        'accountant_certificate_url',
        'accountant_certificate_expiry',
        'accountant_certificate_password',
        'accountant-',
        uploadingAccountant,
        setUploadingAccountant,
        accountantFileInputRef,
        admin ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>CPF do Contador</Label>
              <Input
                value={data.accountant_cpf || ''}
                onChange={e => setData({ ...data, accountant_cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
              <p className="text-xs text-muted-foreground">
                CPF do contador responsável com procuração no eCAC. Será usado como autorPedidoDados no Integra Contador.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={saving} onClick={async () => {
              if (!data.id) return;
              const raw = (data.accountant_cpf || '').replace(/\D/g, '');
              if (raw.length !== 11) {
                toast({ title: 'CPF inválido', description: 'O CPF deve conter exatamente 11 dígitos.', variant: 'destructive' });
                return;
              }
              setSaving(true);
              await supabase.from('company_settings').update({ accountant_cpf: raw }).eq('id', data.id);
              setData(prev => ({ ...prev, accountant_cpf: raw }));
              setSaving(false);
              toast({ title: 'CPF do contador salvo' });
            }}>
              Salvar CPF
            </Button>
            {data.accountant_certificate_url && !data.accountant_cpf?.replace(/\D/g, '') && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠ Certificado do contador configurado sem CPF. O sistema não conseguirá usar o certificado do contador até que o CPF seja salvo.
                </p>
              </div>
            )}
          </div>
        ) : data.accountant_cpf ? (
          <div className="space-y-1">
            <Label>CPF do Contador</Label>
            <Input value={data.accountant_cpf} disabled />
          </div>
        ) : null,
      )}

      <ChatAlertCard
        admin={admin}
        companyId={data.id}
        currentGroupId={data.chat_alert_whatsapp_group_id || ''}
        onSaved={(gid) => setData(prev => ({ ...prev, chat_alert_whatsapp_group_id: gid }))}
      />
    </div>
  );
}

function ChatAlertCard({
  admin,
  companyId,
  currentGroupId,
  onSaved,
}: {
  admin: boolean;
  companyId?: string;
  currentGroupId: string;
  onSaved: (gid: string | null) => void;
}) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selected, setSelected] = useState(currentGroupId);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelected(currentGroupId); }, [currentGroupId]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    const { data, error } = await supabase.functions.invoke('evolution-list-groups');
    setLoadingGroups(false);
    if (error) {
      toast({ title: 'Erro ao carregar grupos', description: error.message, variant: 'destructive' });
      return;
    }
    setGroups(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadGroups(); }, []);

  const save = async (gid: string | null) => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({ chat_alert_whatsapp_group_id: gid })
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved(gid);
    toast({ title: gid ? 'Grupo de alertas configurado' : 'Alertas desativados' });
  };

  const currentName = groups.find(g => g.id === currentGroupId)?.name;

  return (
    <Card>
      <CardHeader><CardTitle>Alertas de Chat</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quando uma conversa ficar mais de 10 minutos sem atendimento, um aviso será enviado para o grupo selecionado no WhatsApp. Reforços a cada 10 minutos enquanto não houver atribuição.
        </p>
        {currentGroupId && (
          <div className="text-sm">
            <span className="text-muted-foreground">Grupo atual: </span>
            <span className="font-medium">{currentName || currentGroupId}</span>
          </div>
        )}
        {admin && (
          <>
            <div className="space-y-1">
              <Label>Selecionar grupo do WhatsApp</Label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={loadingGroups}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">— Nenhum (alertas desativados) —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={saving || loadingGroups} onClick={() => save(selected || null)}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" size="sm" disabled={loadingGroups} onClick={loadGroups}>
                {loadingGroups ? 'Carregando...' : 'Recarregar grupos'}
              </Button>
              {currentGroupId && (
                <Button variant="ghost" size="sm" disabled={saving} onClick={() => save(null)}>
                  Desativar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
