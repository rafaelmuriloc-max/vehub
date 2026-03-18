import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Send, Loader2, Search } from 'lucide-react';

type Client = {
  id: string;
  company_name: string;
  document: string | null;
  municipal_registration: string | null;
  address: string | null;
  tax_regime: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

type ServiceTaker = {
  id: string;
  document: string;
  company_name: string;
  municipal_registration: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  municipality_code: string | null;
  uf: string | null;
  zip_code: string | null;
};

interface DpsFormData {
  ambiente: 'producao' | 'homologacao';
  competencia: string;
  tomadorCnpjCpf: string;
  tomadorRazaoSocial: string;
  tomadorInscricaoMunicipal: string;
  tomadorEmail: string;
  tomadorTelefone: string;
  tomadorLogradouro: string;
  tomadorNumero: string;
  tomadorBairro: string;
  tomadorCodigoMunicipio: string;
  tomadorUf: string;
  tomadorCep: string;
  codigoTribNac: string;
  codigoTribMun: string;
  descricaoServico: string;
  codigoMunicipioIncidencia: string;
  valorServico: string;
  aliquotaIss: string;
  valorDeducoes: string;
  issRetido: boolean;
}

function extractCep(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(/(\d{5})-?(\d{3})/);
  return match ? match[1] + match[2] : null;
}

function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

export default function InvoiceEmit() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [savedTakers, setSavedTakers] = useState<ServiceTaker[]>([]);
  const [selectedTaker, setSelectedTaker] = useState('');

  const [form, setForm] = useState<DpsFormData>({
    ambiente: 'homologacao',
    competencia: new Date().toISOString().slice(0, 7) + '-01',
    tomadorCnpjCpf: '',
    tomadorRazaoSocial: '',
    tomadorInscricaoMunicipal: '',
    tomadorEmail: '',
    tomadorTelefone: '',
    tomadorLogradouro: '',
    tomadorNumero: '',
    tomadorBairro: '',
    tomadorCodigoMunicipio: '',
    tomadorUf: '',
    tomadorCep: '',
    codigoTribNac: '',
    codigoTribMun: '',
    descricaoServico: '',
    codigoMunicipioIncidencia: '',
    valorServico: '',
    aliquotaIss: '',
    valorDeducoes: '',
    issRetido: false,
  });

  useEffect(() => {
    loadClients();
    loadSavedTakers();
  }, []);

  // Auto-fill IBGE code when client changes
  useEffect(() => {
    if (!selectedClient) return;
    const client = clients.find(c => c.id === selectedClient);
    if (!client) return;
    const cep = extractCep(client.address);
    if (cep) {
      fetchIbgeFromCep(cep).then(ibge => {
        if (ibge) {
          setForm(prev => ({ ...prev, codigoMunicipioIncidencia: ibge }));
        }
      });
    }
  }, [selectedClient, clients]);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, document, municipal_registration, address, tax_regime, contact_phone, contact_email')
      .eq('status', 'active')
      .order('company_name');
    if (data) setClients(data);
  }

  async function loadSavedTakers() {
    const { data } = await supabase
      .from('service_takers')
      .select('*')
      .order('company_name');
    if (data) setSavedTakers(data as ServiceTaker[]);
  }

  async function fetchIbgeFromCep(cep: string): Promise<string | null> {
    try {
      // ViaCEP always returns ibge code
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (data.ibge) return data.ibge;
      }
      // Fallback to BrasilAPI
      const res2 = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (res2.ok) {
        const data2 = await res2.json();
        return data2.ibge || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  function updateField(field: keyof DpsFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function fillTakerFromSaved(takerId: string) {
    setSelectedTaker(takerId);
    if (!takerId) return;
    const taker = savedTakers.find(t => t.id === takerId);
    if (!taker) return;
    setForm(prev => ({
      ...prev,
      tomadorCnpjCpf: taker.document,
      tomadorRazaoSocial: taker.company_name,
      tomadorInscricaoMunicipal: taker.municipal_registration || '',
      tomadorEmail: taker.email || '',
      tomadorTelefone: taker.phone || '',
      tomadorLogradouro: taker.street || '',
      tomadorNumero: taker.number || '',
      tomadorBairro: taker.neighborhood || '',
      tomadorCodigoMunicipio: taker.municipality_code || '',
      tomadorUf: taker.uf || '',
      tomadorCep: taker.zip_code || '',
    }));
  }

  async function handleSearchCnpj() {
    const digits = cleanDocument(form.tomadorCnpjCpf);
    if (digits.length < 11) {
      toast({ title: 'Informe um CNPJ/CPF válido', variant: 'destructive' });
      return;
    }

    setSearchingCnpj(true);
    try {
      // 1. Check saved takers first
      const saved = savedTakers.find(t => cleanDocument(t.document) === digits);
      if (saved) {
        fillTakerFromSaved(saved.id);
        toast({ title: 'Tomador encontrado nos registros salvos' });
        setSearchingCnpj(false);
        return;
      }

      // 2. Query BrasilAPI for CNPJ (only works for 14-digit CNPJ)
      if (digits.length === 14) {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (res.ok) {
          const data = await res.json();
          const cep = (data.cep || '').replace(/\D/g, '');
          let ibge = '';
          if (cep.length === 8) {
            const ibgeResult = await fetchIbgeFromCep(cep);
            ibge = ibgeResult || '';
          }
          setForm(prev => ({
            ...prev,
            tomadorRazaoSocial: data.razao_social || '',
            tomadorEmail: data.email || '',
            tomadorTelefone: data.ddd_telefone_1 || '',
            tomadorLogradouro: data.logradouro || '',
            tomadorNumero: data.numero || '',
            tomadorBairro: data.bairro || '',
            tomadorUf: data.uf || '',
            tomadorCep: cep,
            tomadorCodigoMunicipio: ibge,
          }));
          toast({ title: 'Dados do CNPJ preenchidos automaticamente' });
        } else {
          toast({ title: 'CNPJ não encontrado na base pública', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Busca automática disponível apenas para CNPJ (14 dígitos)', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erro ao buscar CNPJ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSearchingCnpj(false);
    }
  }

  async function upsertServiceTaker() {
    const digits = cleanDocument(form.tomadorCnpjCpf);
    if (!digits || !form.tomadorRazaoSocial) return;
    try {
      await supabase
        .from('service_takers')
        .upsert({
          document: digits,
          company_name: form.tomadorRazaoSocial,
          municipal_registration: form.tomadorInscricaoMunicipal || null,
          email: form.tomadorEmail || null,
          phone: form.tomadorTelefone || null,
          street: form.tomadorLogradouro || null,
          number: form.tomadorNumero || null,
          neighborhood: form.tomadorBairro || null,
          municipality_code: form.tomadorCodigoMunicipio || null,
          uf: form.tomadorUf || null,
          zip_code: form.tomadorCep || null,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'document' });
      loadSavedTakers();
    } catch {
      // silent — non-critical
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedClient) {
      toast({ title: 'Selecione um cliente (prestador)', variant: 'destructive' });
      return;
    }
    if (!form.tomadorCnpjCpf || !form.tomadorRazaoSocial) {
      toast({ title: 'Preencha os dados do tomador', variant: 'destructive' });
      return;
    }
    if (!form.codigoTribNac || !form.descricaoServico || !form.valorServico) {
      toast({ title: 'Preencha código tributário nacional, descrição e valor do serviço', variant: 'destructive' });
      return;
    }
    if (!form.codigoMunicipioIncidencia || !/^\d{7}$/.test(form.codigoMunicipioIncidencia)) {
      toast({ title: 'Código do município de incidência (IBGE) deve ter exatamente 7 dígitos', variant: 'destructive' });
      return;
    }

    // Validate prestador has IM
    const clientData = clients.find(c => c.id === selectedClient);
    if (clientData && !clientData.municipal_registration) {
      toast({ title: 'Cliente sem Inscrição Municipal', description: 'Preencha a IM no cadastro do cliente antes de emitir.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const dps_data = {
        ambiente: form.ambiente,
        competencia: form.competencia,
        tomadorCnpjCpf: form.tomadorCnpjCpf,
        tomadorRazaoSocial: form.tomadorRazaoSocial,
        tomadorInscricaoMunicipal: form.tomadorInscricaoMunicipal || undefined,
        tomadorEmail: form.tomadorEmail || undefined,
        tomadorTelefone: form.tomadorTelefone || undefined,
        tomadorEndereco: form.tomadorLogradouro ? {
          logradouro: form.tomadorLogradouro,
          numero: form.tomadorNumero,
          bairro: form.tomadorBairro,
          codigoMunicipio: form.tomadorCodigoMunicipio,
          uf: form.tomadorUf,
          cep: form.tomadorCep,
        } : undefined,
        codigoTribNac: form.codigoTribNac,
        codigoTribMun: form.codigoTribMun || undefined,
        descricaoServico: form.descricaoServico,
        codigoMunicipioIncidencia: form.codigoMunicipioIncidencia,
        codigoMunicipioPrestacao: form.codigoMunicipioIncidencia,
        valorServico: parseFloat(form.valorServico) || 0,
        aliquotaIss: form.aliquotaIss ? parseFloat(form.aliquotaIss) : undefined,
        valorDeducoes: form.valorDeducoes ? parseFloat(form.valorDeducoes) : undefined,
        issRetido: form.issRetido,
      };

      const { data, error } = await supabase.functions.invoke('nfse-emit', {
        body: { client_id: selectedClient, dps_data },
      });

      if (error) {
        toast({ title: 'Erro na emissão', description: error.message, variant: 'destructive' });
        setResult({ error: error.message });
      } else if (data?.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
        setResult(data);
      } else {
        toast({ title: 'DPS enviada com sucesso!', description: data.message });
        setResult(data);
        // Save taker for future use
        await upsertServiceTaker();
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClientData = clients.find(c => c.id === selectedClient);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Emitir NFS-e</h1>
          <p className="text-muted-foreground">Emissão de Nota Fiscal de Serviço Eletrônica via Sistema Nacional</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ambiente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ambiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Label>Homologação (teste)</Label>
              <Switch
                checked={form.ambiente === 'producao'}
                onCheckedChange={(checked) => updateField('ambiente', checked ? 'producao' : 'homologacao')}
              />
              <Label>Produção</Label>
            </div>
            {form.ambiente === 'producao' && (
              <p className="text-sm text-destructive mt-2 font-medium">
                ⚠️ Ambiente de produção: a nota fiscal será emitida com validade jurídica.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prestador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prestador de Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente (Prestador)</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente prestador" />
                </SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.document).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClientData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-muted/30 p-3 rounded-md">
                  <div><span className="text-muted-foreground">CNPJ:</span> {selectedClientData.document}</div>
                  <div><span className="text-muted-foreground">IM:</span> {selectedClientData.municipal_registration || '—'}</div>
                  <div><span className="text-muted-foreground">Regime:</span> {selectedClientData.tax_regime || '—'}</div>
                </div>
                {!selectedClientData.municipal_registration && (
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Este cliente não possui Inscrição Municipal cadastrada. A emissão será bloqueada.
                  </p>
                )}
              </>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Competência</Label>
                <Input
                  type="date"
                  value={form.competencia}
                  onChange={e => updateField('competencia', e.target.value)}
                />
              </div>
              <div>
                <Label>Código Município Incidência (IBGE) *</Label>
                <Input
                  required
                  value={form.codigoMunicipioIncidencia}
                  onChange={e => updateField('codigoMunicipioIncidencia', e.target.value)}
                  placeholder="Ex: 3550308 (São Paulo) - 7 dígitos"
                />
                {selectedClientData && form.codigoMunicipioIncidencia && (
                  <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente pelo CEP do prestador</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tomador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tomador do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Saved takers combobox */}
            {savedTakers.length > 0 && (
              <div>
                <Label>Tomadores Salvos</Label>
                <Select value={selectedTaker} onValueChange={fillTakerFromSaved}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tomador salvo ou preencha manualmente" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedTakers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.company_name} — {t.document}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>CNPJ/CPF *</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.tomadorCnpjCpf}
                    onChange={e => updateField('tomadorCnpjCpf', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSearchCnpj}
                    disabled={searchingCnpj || !form.tomadorCnpjCpf}
                    title="Buscar dados pelo CNPJ"
                  >
                    {searchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Razão Social *</Label>
                <Input
                  value={form.tomadorRazaoSocial}
                  onChange={e => updateField('tomadorRazaoSocial', e.target.value)}
                  placeholder="Nome ou razão social do tomador"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Inscrição Municipal</Label>
                <Input
                  value={form.tomadorInscricaoMunicipal}
                  onChange={e => updateField('tomadorInscricaoMunicipal', e.target.value)}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.tomadorEmail}
                  onChange={e => updateField('tomadorEmail', e.target.value)}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.tomadorTelefone}
                  onChange={e => updateField('tomadorTelefone', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>Logradouro</Label>
                <Input
                  value={form.tomadorLogradouro}
                  onChange={e => updateField('tomadorLogradouro', e.target.value)}
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input
                  value={form.tomadorNumero}
                  onChange={e => updateField('tomadorNumero', e.target.value)}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={form.tomadorBairro}
                  onChange={e => updateField('tomadorBairro', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Código Município (IBGE)</Label>
                <Input
                  value={form.tomadorCodigoMunicipio}
                  onChange={e => updateField('tomadorCodigoMunicipio', e.target.value)}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={form.tomadorUf}
                  onChange={e => updateField('tomadorUf', e.target.value)}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
              <div>
                <Label>CEP</Label>
                <Input
                  value={form.tomadorCep}
                  onChange={e => updateField('tomadorCep', e.target.value)}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Código Tributário Nacional (cTribNac) *</Label>
                <Input
                  value={form.codigoTribNac}
                  onChange={e => updateField('codigoTribNac', e.target.value)}
                  placeholder="Ex: 090201"
                />
                <p className="text-xs text-muted-foreground mt-1">Código de 6 dígitos do padrão nacional NFS-e</p>
              </div>
              <div>
                <Label>Código Tributário Municipal (cTribMun)</Label>
                <Input
                  value={form.codigoTribMun}
                  onChange={e => updateField('codigoTribMun', e.target.value)}
                  placeholder="Ex: 001"
                />
              </div>
              <div>
                <Label>Valor do Serviço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorServico}
                  onChange={e => updateField('valorServico', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Descrição do Serviço *</Label>
              <Textarea
                value={form.descricaoServico}
                onChange={e => updateField('descricaoServico', e.target.value)}
                placeholder="Descreva o serviço prestado"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.aliquotaIss}
                  onChange={e => updateField('aliquotaIss', e.target.value)}
                  placeholder="Ex: 5.00"
                />
              </div>
              <div>
                <Label>Deduções (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorDeducoes}
                  onChange={e => updateField('valorDeducoes', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={form.issRetido}
                  onCheckedChange={(checked) => updateField('issRetido', checked)}
                />
                <Label>ISS Retido pelo Tomador</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !isAdmin}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {submitting ? 'Enviando...' : 'Emitir NFS-e'}
          </Button>
        </div>
      </form>

      {/* Result */}
      {result && (
        <Card className={result.error ? 'border-destructive' : 'border-primary'}>
          <CardHeader>
            <CardTitle className="text-lg">
              {result.error ? '❌ Erro na Emissão' : '✅ Resultado da Emissão'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/50 p-4 rounded-md text-sm overflow-auto max-h-[400px] whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
