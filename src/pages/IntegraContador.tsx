import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, FileText, Building2, Landmark, Mail, CreditCard, Search, Scale } from 'lucide-react';

type Client = {
  id: string;
  company_name: string;
  document: string | null;
  digital_certificate_url: string | null;
};

type ServiceDefinition = {
  idSistema: string;
  idServico: string;
  label: string;
  description: string;
  tipo: string;
  fields: { key: string; label: string; required?: boolean; placeholder?: string }[];
};

type ServiceCategory = {
  label: string;
  icon: React.ReactNode;
  services: ServiceDefinition[];
};

const SERVICE_CATALOG: Record<string, ServiceCategory> = {
  sn: {
    label: 'Simples Nacional',
    icon: <Scale className="h-4 w-4" />,
    services: [
      {
        idSistema: 'PGDASD', idServico: 'CONSDECLARACAO13', label: 'Consultar Declaração PGDAS-D',
        description: 'Consulta declarações transmitidas do PGDAS-D',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'CONSULTIMADECREC14', label: 'Última Declaração/Recibo',
        description: 'Consulta última declaração e recibo do PGDAS-D',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'CONSDECREC15', label: 'Declaração/Recibo por PA',
        description: 'Consulta declaração e recibo por período de apuração',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', label: 'Extrato do DAS',
        description: 'Consulta extrato do DAS do Simples Nacional',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'GERARDAS12', label: 'Gerar DAS',
        description: 'Gera guia DAS do Simples Nacional',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'GERARDASCOBRANCA17', label: 'DAS Cobrança RFB',
        description: 'Gera DAS de cobrança da Receita Federal',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'GERARDASAVULSO19', label: 'DAS Avulso',
        description: 'Gera DAS avulso do Simples Nacional',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGDASD', idServico: 'TRANSDECLARACAO11', label: 'Entregar Declaração Mensal',
        description: 'Transmite declaração mensal do PGDAS-D',
        tipo: 'Declarar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'REGIMEAPURACAO', idServico: 'CONSULTARANOSCALENDARIOS102', label: 'Regime Apuração',
        description: 'Consulta opções de regime de apuração por ano',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'DEFIS', idServico: 'CONSDECLARACAO142', label: 'Consultar DEFIS',
        description: 'Consulta declarações DEFIS transmitidas',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'anoCalendario', label: 'Ano Calendário', required: true, placeholder: '2024' },
        ],
      },
      {
        idSistema: 'DEFIS', idServico: 'CONSULTIMADECREC143', label: 'Última Declaração DEFIS',
        description: 'Consulta última declaração e recibo DEFIS',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
    ],
  },
  mei: {
    label: 'MEI',
    icon: <Building2 className="h-4 w-4" />,
    services: [
      {
        idSistema: 'PGMEI', idServico: 'GERARDASPDF21', label: 'DAS MEI (PDF)',
        description: 'Gera DAS do MEI em formato PDF',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGMEI', idServico: 'GERARDASCODBARRA22', label: 'DAS MEI (Código de Barras)',
        description: 'Gera DAS do MEI com código de barras',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'PGMEI', idServico: 'DIVIDAATIVA24', label: 'Dívida Ativa MEI',
        description: 'Consulta dívida ativa do MEI',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'CCMEI', idServico: 'EMITIRCCMEI121', label: 'Certificado Condição MEI',
        description: 'Emite certificado de condição de MEI',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'CCMEI', idServico: 'DADOSCCMEI122', label: 'Dados CCMEI',
        description: 'Consulta dados do certificado de condição MEI',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
    ],
  },
  dctfweb: {
    label: 'DCTFWeb',
    icon: <FileText className="h-4 w-4" />,
    services: [
      {
        idSistema: 'DCTFWEB', idServico: 'GERARGUIA31', label: 'Gerar Guia DCTFWeb',
        description: 'Gera guia de pagamento da DCTFWeb',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'DCTFWEB', idServico: 'CONSRECIBO32', label: 'Recibo DCTFWeb',
        description: 'Consulta recibo de entrega da DCTFWeb',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'DCTFWEB', idServico: 'CONSDECCOMPLETA33', label: 'Declaração Completa',
        description: 'Consulta declaração completa da DCTFWeb',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'DCTFWEB', idServico: 'CONSXMLDECLARACAO38', label: 'XML Declaração',
        description: 'Consulta XML da declaração DCTFWeb',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
    ],
  },
  sicalc: {
    label: 'Sicalc (DARF)',
    icon: <CreditCard className="h-4 w-4" />,
    services: [
      {
        idSistema: 'SICALC', idServico: 'CONSOLIDARGERARDARF51', label: 'Emitir DARF (PDF)',
        description: 'Consolida e emite DARF em formato PDF',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'codigoReceita', label: 'Código da Receita', required: true, placeholder: '0561' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
      {
        idSistema: 'SICALC', idServico: 'CONSULTAAPOIORECEITAS52', label: 'Consultar Receitas',
        description: 'Consulta receitas disponíveis no Sicalc',
        tipo: 'Apoiar',
        fields: [],
      },
      {
        idSistema: 'SICALC', idServico: 'GERARDARFCODBARRA53', label: 'DARF (Código de Barras)',
        description: 'Emite DARF com código de barras',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'codigoReceita', label: 'Código da Receita', required: true, placeholder: '0561' },
          { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' },
        ],
      },
    ],
  },
  caixapostal: {
    label: 'Caixa Postal RFB',
    icon: <Mail className="h-4 w-4" />,
    services: [
      {
        idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61', label: 'Mensagens do Contribuinte',
        description: 'Lista mensagens da Caixa Postal por contribuinte',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62', label: 'Detalhes da Mensagem',
        description: 'Consulta detalhes de uma mensagem específica',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'idMensagem', label: 'ID da Mensagem', required: true, placeholder: '' },
        ],
      },
      {
        idSistema: 'CAIXAPOSTAL', idServico: 'INNOVAMSG63', label: 'Novas Mensagens',
        description: 'Verifica indicador de novas mensagens não lidas',
        tipo: 'Monitorar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'DTE', idServico: 'CONSULTASITUACAODTE111', label: 'Situação Adesão DTE',
        description: 'Consulta situação de adesão à Caixa Postal eletrônica',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
    ],
  },
  situacaofiscal: {
    label: 'Situação Fiscal',
    icon: <Search className="h-4 w-4" />,
    services: [
      {
        idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91', label: 'Solicitar Protocolo',
        description: 'Solicita protocolo do relatório de situação fiscal',
        tipo: 'Apoiar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
      {
        idSistema: 'SITFIS', idServico: 'RELATORIOSITFIS92', label: 'Relatório Situação Fiscal',
        description: 'Emite relatório completo da situação fiscal',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'protocolo', label: 'Protocolo', required: true, placeholder: '' },
        ],
      },
    ],
  },
  pagamentos: {
    label: 'Pagamentos',
    icon: <Landmark className="h-4 w-4" />,
    services: [
      {
        idSistema: 'PAGTOWEB', idServico: 'PAGAMENTOS71', label: 'Consultar Pagamentos',
        description: 'Consulta pagamentos realizados (DARF, DAS)',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'anoCalendario', label: 'Ano Calendário', required: true, placeholder: '2024' },
        ],
      },
      {
        idSistema: 'PAGTOWEB', idServico: 'COMPARRECADACAO72', label: 'Comprovante Arrecadação',
        description: 'Emite comprovante de arrecadação de pagamento',
        tipo: 'Emitir',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
          { key: 'numeroPagamento', label: 'Número do Pagamento', required: true, placeholder: '' },
        ],
      },
    ],
  },
  procuracoes: {
    label: 'Procurações',
    icon: <FileText className="h-4 w-4" />,
    services: [
      {
        idSistema: 'PROCURACOES', idServico: 'OBTERPROCURACAO41', label: 'Obter Procuração',
        description: 'Consulta procurações do contribuinte',
        tipo: 'Consultar',
        fields: [
          { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' },
        ],
      },
    ],
  },
};

export default function IntegraContador() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, document, digital_certificate_url')
      .eq('status', 'active')
      .not('document', 'is', null)
      .not('digital_certificate_url', 'is', null)
      .order('company_name');
    setClients(data || []);
  }

  const selectedCategory_ = selectedCategory ? SERVICE_CATALOG[selectedCategory] : null;
  const selectedService = selectedCategory_?.services.find(
    (s) => `${s.idSistema}-${s.idServico}` === selectedServiceId
  );

  function handleCategoryChange(cat: string) {
    setSelectedCategory(cat);
    setSelectedServiceId('');
    setFormData({});
    setResult(null);
  }

  function handleServiceChange(svcKey: string) {
    setSelectedServiceId(svcKey);
    setFormData({});
    setResult(null);
  }

  async function handleSubmit() {
    if (!selectedService || !selectedClientId) return;

    // Validate required fields
    for (const field of selectedService.fields) {
      if (field.required && !formData[field.key]) {
        toast({ title: 'Campo obrigatório', description: field.label, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: selectedClientId,
          idSistema: selectedService.idSistema,
          idServico: selectedService.idServico,
          tipo: selectedService.tipo,
          dados: JSON.stringify(formData),
        },
      });

      if (error) throw error;
      setResult(data);

      if (data?.success) {
        toast({ title: 'Consulta realizada', description: `${selectedService.label} retornou com sucesso.` });
      } else {
        toast({ title: 'Erro na consulta', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integra Contador</h1>
        <p className="text-muted-foreground mt-1">
          Acesse serviços fiscais da Receita Federal via API SERPRO
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Configuration */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cliente</CardTitle>
              <CardDescription>Selecione o contribuinte (requer certificado digital)</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name} — {c.document}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nenhum cliente com certificado digital configurado.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Serviço</CardTitle>
              <CardDescription>Escolha a categoria e o serviço desejado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Categoria</Label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_CATALOG).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">{cat.icon} {cat.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory_ && (
                <div>
                  <Label>Serviço</Label>
                  <Select value={selectedServiceId} onValueChange={handleServiceChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory_.services.map((svc) => (
                        <SelectItem key={`${svc.idSistema}-${svc.idServico}`} value={`${svc.idSistema}-${svc.idServico}`}>
                          {svc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedService && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedService.description}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedService && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parâmetros</CardTitle>
                <CardDescription>
                  {selectedService.idSistema} / {selectedService.idServico}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedService.fields.map((field) => (
                  <div key={field.key}>
                    <Label>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}

                <Button
                  onClick={handleSubmit}
                  disabled={loading || !selectedClientId || !isAdmin}
                  className="w-full mt-2"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Consultando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Enviar Consulta</>
                  )}
                </Button>

                {!isAdmin && (
                  <p className="text-sm text-destructive">Apenas administradores podem executar consultas.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Resultado
                {result && (
                  <Badge variant={(result as any)?.success ? 'default' : 'destructive'}>
                    {(result as any)?.success ? 'Sucesso' : 'Erro'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {result ? 'Resposta da API SERPRO' : 'Selecione um serviço e envie a consulta'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <ScrollArea className="h-[500px]">
                  <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <p>Nenhum resultado ainda</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service catalog reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Catálogo de Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {Object.entries(SERVICE_CATALOG).map(([key, cat]) => (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">{cat.icon} {cat.label}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1">
                        {cat.services.map((svc) => (
                          <li key={svc.idServico} className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{svc.label}</span> — {svc.description}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
