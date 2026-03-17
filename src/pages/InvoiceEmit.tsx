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
import { ArrowLeft, Send, Loader2 } from 'lucide-react';

type Client = {
  id: string;
  company_name: string;
  document: string | null;
  municipal_registration: string | null;
  address: string | null;
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
  codigoServico: string;
  descricaoServico: string;
  codigoMunicipioIncidencia: string;
  valorServico: string;
  aliquotaIss: string;
  valorDeducoes: string;
  issRetido: boolean;
}

export default function InvoiceEmit() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

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
    codigoServico: '',
    descricaoServico: '',
    codigoMunicipioIncidencia: '',
    valorServico: '',
    aliquotaIss: '',
    valorDeducoes: '',
    issRetido: false,
  });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, document, municipal_registration, address')
      .eq('status', 'active')
      .order('company_name');
    if (data) setClients(data);
  }

  function updateField(field: keyof DpsFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
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
    if (!form.codigoServico || !form.descricaoServico || !form.valorServico) {
      toast({ title: 'Preencha os dados do serviço', variant: 'destructive' });
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
        codigoServico: form.codigoServico,
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-muted/30 p-3 rounded-md">
                <div><span className="text-muted-foreground">CNPJ:</span> {selectedClientData.document}</div>
                <div><span className="text-muted-foreground">IM:</span> {selectedClientData.municipal_registration || '—'}</div>
                <div><span className="text-muted-foreground">Endereço:</span> {selectedClientData.address || '—'}</div>
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>CNPJ/CPF *</Label>
                <Input
                  value={form.tomadorCnpjCpf}
                  onChange={e => updateField('tomadorCnpjCpf', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Código do Serviço (LC 116) *</Label>
                <Input
                  value={form.codigoServico}
                  onChange={e => updateField('codigoServico', e.target.value)}
                  placeholder="Ex: 01.01"
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
