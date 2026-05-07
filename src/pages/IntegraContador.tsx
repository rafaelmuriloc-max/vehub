import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, FileText, Building2, Landmark, Mail, CreditCard, Search, Scale, RefreshCw, Shield, Link2, FolderOpen, Bell, MailOpen, MailCheck, Eye } from 'lucide-react';

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
  fields: { key: string; label: string; required?: boolean; placeholder?: string; options?: { value: string; label: string }[] }[];
};

type ServiceCategory = {
  label: string;
  icon: React.ReactNode;
  services: ServiceDefinition[];
};

type SnClient = {
  id: string;
  company_name: string;
  document: string;
  simples_anexo: string | null;
  main_activity: string | null;
  secondary_activities: string | null;
  digital_certificate_url: string | null;
};

type Assessment = {
  id: string;
  client_id: string;
  competence: string;
  receita_bruta: number | null;
  receita_acumulada: number | null;
  invoice_count: number;
  status: 'pendente' | 'declarado' | 'das_gerado' | 'pago';
  declaracao_numero: string | null;
  valor_das: number | null;
  vencimento_das: string | null;
  codigo_barras_das: string | null;
  numero_das: string | null;
};

// Helper para campos comuns
const F_CNPJ = { key: 'cnpjBasico', label: 'CNPJ Básico (8 dígitos)', required: true, placeholder: '12345678' };
const F_PA = { key: 'pa', label: 'Período Apuração (AAAAMM)', required: true, placeholder: '202401' };
const F_ANO = { key: 'anoCalendario', label: 'Ano Calendário', required: true, placeholder: '2024' };
const F_PROTOCOLO = { key: 'protocolo', label: 'Protocolo', required: true, placeholder: '' };
const F_NUM_PEDIDO = { key: 'numeroPedido', label: 'Número do Pedido', required: true, placeholder: '' };
const F_NUM_DECLARACAO = { key: 'numeroDeclaracao', label: 'Nº Declaração', required: true, placeholder: '00000000201801001' };
const F_NUM_DAS = { key: 'numeroDas', label: 'Nº DAS', required: true, placeholder: '07202136999997159' };
const F_NUM_PROCESSO = { key: 'numeroProcesso', label: 'Nº Processo', required: true, placeholder: '' };
const F_NUM_PARCELAMENTO = { key: 'numeroParcelamento', label: 'Nº Parcelamento', required: true, placeholder: '' };
const F_ANOMES_PARCELA = { key: 'anoMesParcela', label: 'Ano/Mês Parcela (AAAAMM)', required: true, placeholder: '202401' };
const F_PARCELA_EMITIR = { key: 'parcelaParaEmitir', label: 'Parcela p/ Emitir (AAAAMM)', required: true, placeholder: '202401' };

// Gera os 5 serviços padrão de uma modalidade de parcelamento
function parcServices(modalidade: string, desc: string, idSuffix: number[]): ServiceDefinition[] {
  const idSistema = modalidade;
  return [
    { idSistema, idServico: `GERARDAS${idSuffix[0]}`, label: `Gerar DAS – ${desc}`, description: `Gera DAS do parcelamento ${desc}`, tipo: 'Emitir', fields: [F_CNPJ, F_PARCELA_EMITIR] },
    { idSistema, idServico: `PARCELASPARAGERAR${idSuffix[1]}`, label: `Parcelas p/ Gerar – ${desc}`, description: `Consulta parcelas disponíveis para gerar DAS – ${desc}`, tipo: 'Consultar', fields: [F_CNPJ] },
    { idSistema, idServico: `PEDIDOSPARC${idSuffix[2]}`, label: `Pedidos – ${desc}`, description: `Consulta pedidos de parcelamento – ${desc}`, tipo: 'Consultar', fields: [F_CNPJ] },
    { idSistema, idServico: `OBTERPARC${idSuffix[3]}`, label: `Obter Parcelamento – ${desc}`, description: `Obtém detalhes do parcelamento – ${desc}`, tipo: 'Consultar', fields: [F_CNPJ, F_NUM_PARCELAMENTO] },
    { idSistema, idServico: `DETPAGTOPARC${idSuffix[4]}`, label: `Det. Pagamento – ${desc}`, description: `Detalhes de pagamento do parcelamento – ${desc}`, tipo: 'Consultar', fields: [F_CNPJ, F_NUM_PARCELAMENTO, F_ANOMES_PARCELA] },
  ];
}

const SERVICE_CATALOG: Record<string, ServiceCategory> = {
  sn: {
    label: 'Simples Nacional',
    icon: <Scale className="h-4 w-4" />,
    services: [
      // PGDASD
      { idSistema: 'PGDASD', idServico: 'TRANSDECLARACAO11', label: 'Entregar Declaração Mensal', description: 'Transmite declaração mensal do PGDAS-D', tipo: 'Declarar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'PGDASD', idServico: 'GERARDAS12', label: 'Gerar DAS', description: 'Gera guia DAS do Simples Nacional', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      { idSistema: 'PGDASD', idServico: 'CONSDECLARACAO13', label: 'Consultar Declaração PGDAS-D', description: 'Consulta declarações transmitidas do PGDAS-D', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'PGDASD', idServico: 'CONSULTIMADECREC14', label: 'Última Declaração/Recibo', description: 'Consulta última declaração e recibo do PGDAS-D', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'PGDASD', idServico: 'CONSDECREC15', label: 'Declaração/Recibo por Nº', description: 'Consulta declaração e recibo por número da declaração', tipo: 'Consultar', fields: [F_CNPJ, F_NUM_DECLARACAO] },
      { idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', label: 'Extrato do DAS', description: 'Consulta extrato do DAS pelo número do DAS', tipo: 'Consultar', fields: [F_CNPJ, F_NUM_DAS] },
      { idSistema: 'PGDASD', idServico: 'GERARDASCOBRANCA17', label: 'DAS Cobrança RFB', description: 'Gera DAS de cobrança da Receita Federal', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      { idSistema: 'PGDASD', idServico: 'GERARDASPROCESSO18', label: 'DAS Processo Cobrança', description: 'Gera DAS referente a processo de Cobrança RFB', tipo: 'Emitir', fields: [F_CNPJ, F_NUM_PROCESSO] },
      { idSistema: 'PGDASD', idServico: 'GERARDASAVULSO19', label: 'DAS Avulso', description: 'Gera DAS avulso do Simples Nacional', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      // Regime de Apuração
      { idSistema: 'REGIMEAPURACAO', idServico: 'EFETUAROPCAOREGIME101', label: 'Efetuar Opção Regime', description: 'Efetua opção de regime de apuração', tipo: 'Declarar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'REGIMEAPURACAO', idServico: 'CONSULTARANOSCALENDARIOS102', label: 'Consultar Anos Calendário', description: 'Consulta opções de regime de apuração por ano', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'REGIMEAPURACAO', idServico: 'CONSULTAROPCAOREGIME103', label: 'Consultar Opção Regime', description: 'Consulta opção de regime de apuração vigente', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'REGIMEAPURACAO', idServico: 'CONSULTARRESOLUCAO104', label: 'Consultar Resolução Caixa', description: 'Consulta resolução de regime caixa', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      // DEFIS
      { idSistema: 'DEFIS', idServico: 'TRANSDECLARACAO141', label: 'Transmitir DEFIS', description: 'Transmite declaração DEFIS', tipo: 'Declarar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'DEFIS', idServico: 'CONSDECLARACAO142', label: 'Consultar DEFIS', description: 'Consulta declarações DEFIS transmitidas', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'DEFIS', idServico: 'CONSULTIMADECREC143', label: 'Última Declaração DEFIS', description: 'Consulta última declaração e recibo DEFIS', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'DEFIS', idServico: 'CONSDECREC144', label: 'Declaração/Recibo DEFIS', description: 'Consulta declaração e recibo DEFIS por ano', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
    ],
  },
  mei: {
    label: 'MEI',
    icon: <Building2 className="h-4 w-4" />,
    services: [
      { idSistema: 'PGMEI', idServico: 'GERARDASPDF21', label: 'DAS MEI (PDF)', description: 'Gera DAS do MEI em formato PDF', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      { idSistema: 'PGMEI', idServico: 'GERARDASCODBARRA22', label: 'DAS MEI (Cód. Barras)', description: 'Gera DAS do MEI com código de barras', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      { idSistema: 'PGMEI', idServico: 'ATUBENEFICIO23', label: 'Atualizar Benefício', description: 'Atualiza benefício do MEI', tipo: 'Emitir', fields: [F_CNPJ] },
      { idSistema: 'PGMEI', idServico: 'DIVIDAATIVA24', label: 'Dívida Ativa MEI', description: 'Consulta dívida ativa do MEI', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'CCMEI', idServico: 'EMITIRCCMEI121', label: 'Certificado Condição MEI', description: 'Emite certificado de condição de MEI', tipo: 'Emitir', fields: [F_CNPJ] },
      { idSistema: 'CCMEI', idServico: 'DADOSCCMEI122', label: 'Dados CCMEI', description: 'Consulta dados do certificado de condição MEI', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'CCMEI', idServico: 'CCMEISITCADASTRAL123', label: 'Situação Cadastral MEI por CPF', description: 'Consulta situação cadastral do CNPJ MEI por CPF', tipo: 'Consultar', fields: [{ key: 'cpf', label: 'CPF (11 dígitos)', required: true, placeholder: '12345678901' }] },
    ],
  },
  dctfweb: {
    label: 'DCTFWeb / MIT',
    icon: <FileText className="h-4 w-4" />,
    services: [
      // DCTFWeb
      { idSistema: 'DCTFWEB', idServico: 'GERARGUIA31', label: 'Gerar Guia DCTFWeb', description: 'Gera guia de pagamento da DCTFWeb', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      { idSistema: 'DCTFWEB', idServico: 'CONSRECIBO32', label: 'Recibo DCTFWeb', description: 'Consulta recibo de entrega da DCTFWeb', tipo: 'Consultar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'DCTFWEB', idServico: 'CONSDECCOMPLETA33', label: 'Declaração Completa', description: 'Consulta declaração completa da DCTFWeb', tipo: 'Consultar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'DCTFWEB', idServico: 'CONSXMLDECLARACAO38', label: 'XML Declaração', description: 'Consulta XML da declaração DCTFWeb', tipo: 'Consultar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'DCTFWEB', idServico: 'TRANSDECLARACAO310', label: 'Transmitir Declaração', description: 'Transmite declaração DCTFWeb', tipo: 'Declarar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'DCTFWEB', idServico: 'GERARGUIAANDAMENTO313', label: 'Guia Declaração em Andamento', description: 'Gera guia de declaração em andamento', tipo: 'Emitir', fields: [F_CNPJ, F_PA] },
      // MIT (Multirreceitas)
      { idSistema: 'MIT', idServico: 'ENCAPURACAO314', label: 'Encerrar Apuração MIT', description: 'Encerra apuração MIT (Multirreceitas)', tipo: 'Declarar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'MIT', idServico: 'SITUACAOENC315', label: 'Situação Encerramento MIT', description: 'Consulta situação do encerramento MIT', tipo: 'Apoiar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'MIT', idServico: 'CONSAPURACAO316', label: 'Consultar Apuração MIT', description: 'Consulta dados de apuração MIT', tipo: 'Consultar', fields: [F_CNPJ, F_PA] },
      { idSistema: 'MIT', idServico: 'LISTAAPURACOES317', label: 'Listar Apurações MIT', description: 'Lista apurações MIT disponíveis', tipo: 'Consultar', fields: [F_CNPJ] },
    ],
  },
  sicalc: {
    label: 'Sicalc (DARF)',
    icon: <CreditCard className="h-4 w-4" />,
    services: [
      { idSistema: 'SICALC', idServico: 'CONSOLIDARGERARDARF51', label: 'Emitir DARF (PDF)', description: 'Consolida e emite DARF em formato PDF', tipo: 'Emitir', fields: [F_CNPJ, { key: 'codigoReceita', label: 'Código da Receita', required: true, placeholder: '0561' }, F_PA] },
      { idSistema: 'SICALC', idServico: 'CONSULTAAPOIORECEITAS52', label: 'Consultar Receitas', description: 'Consulta receitas disponíveis no Sicalc', tipo: 'Apoiar', fields: [] },
      { idSistema: 'SICALC', idServico: 'GERARDARFCODBARRA53', label: 'DARF (Cód. Barras)', description: 'Emite DARF com código de barras', tipo: 'Emitir', fields: [F_CNPJ, { key: 'codigoReceita', label: 'Código da Receita', required: true, placeholder: '0561' }, F_PA] },
    ],
  },
  caixapostal: {
    label: 'Caixa Postal RFB',
    icon: <Mail className="h-4 w-4" />,
    services: [
      { idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61', label: 'Mensagens do Contribuinte', description: 'Lista mensagens da Caixa Postal por contribuinte', tipo: 'Consultar', fields: [{ key: 'statusLeitura', label: 'Status Leitura', required: true, placeholder: '0', options: [{ value: '0', label: 'Não lidas' }, { value: '1', label: 'Lidas' }, { value: '2', label: 'Todas' }] }, { key: 'indicadorPagina', label: 'Indicador Página', required: true, placeholder: '0' }, { key: 'ponteiroPagina', label: 'Ponteiro Página', required: true, placeholder: '00000000000000' }] },
      { idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62', label: 'Detalhes da Mensagem', description: 'Consulta detalhes de uma mensagem específica', tipo: 'Consultar', fields: [{ key: 'isn', label: 'ISN (Nº Sequencial)', required: true, placeholder: '0000082838' }] },
      { idSistema: 'CAIXAPOSTAL', idServico: 'INNOVAMSG63', label: 'Novas Mensagens', description: 'Verifica indicador de novas mensagens não lidas', tipo: 'Monitorar', fields: [] },
      { idSistema: 'DTE', idServico: 'CONSULTASITUACAODTE111', label: 'Situação Adesão DTE', description: 'Consulta situação de adesão à Caixa Postal eletrônica', tipo: 'Consultar', fields: [F_CNPJ] },
    ],
  },
  situacaofiscal: {
    label: 'Situação Fiscal',
    icon: <Search className="h-4 w-4" />,
    services: [
      { idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91', label: 'Solicitar Protocolo', description: 'Solicita protocolo do relatório de situação fiscal', tipo: 'Apoiar', fields: [F_CNPJ] },
      { idSistema: 'SITFIS', idServico: 'RELATORIOSITFIS92', label: 'Relatório Situação Fiscal', description: 'Emite relatório completo da situação fiscal', tipo: 'Emitir', fields: [F_CNPJ, F_PROTOCOLO] },
    ],
  },
  pagamentos: {
    label: 'Pagamentos',
    icon: <Landmark className="h-4 w-4" />,
    services: [
      { idSistema: 'PAGTOWEB', idServico: 'PAGAMENTOS71', label: 'Consultar Pagamentos', description: 'Consulta pagamentos realizados (DARF, DAS)', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
      { idSistema: 'PAGTOWEB', idServico: 'COMPARRECADACAO72', label: 'Comprovante Arrecadação', description: 'Emite comprovante de arrecadação de pagamento', tipo: 'Emitir', fields: [F_CNPJ, { key: 'numeroPagamento', label: 'Número do Pagamento', required: true, placeholder: '' }] },
      { idSistema: 'PAGTOWEB', idServico: 'CONTACONSDOCARRPG73', label: 'Contar Doc. Arrecadação', description: 'Conta documentos de arrecadação pagos', tipo: 'Consultar', fields: [F_CNPJ, F_ANO] },
    ],
  },
  procuracoes: {
    label: 'Procurações',
    icon: <Shield className="h-4 w-4" />,
    services: [
      { idSistema: 'PROCURACOES', idServico: 'OBTERPROCURACAO41', label: 'Obter Procuração', description: 'Consulta procurações do contribuinte', tipo: 'Consultar', fields: [F_CNPJ] },
    ],
  },
  gerenciador: {
    label: 'Gerenciador',
    icon: <RefreshCw className="h-4 w-4" />,
    services: [
      { idSistema: 'AUTENTICAPROCURADOR', idServico: 'ENVIOXMLASSINADO81', label: 'Token Procurador (XML)', description: 'Envio de XML assinado para obter TOKEN de procurador', tipo: 'Apoiar', fields: [F_CNPJ] },
    ],
  },
  eventos: {
    label: 'Eventos de Atualização',
    icon: <Bell className="h-4 w-4" />,
    services: [
      { idSistema: 'EVENTOSATUALIZACAO', idServico: 'SOLICEVENTOSPF131', label: 'Solicitar Eventos PF', description: 'Solicita eventos de atualização de Pessoa Física', tipo: 'Monitorar', fields: [{ key: 'cpf', label: 'CPF (11 dígitos)', required: true, placeholder: '12345678901' }] },
      { idSistema: 'EVENTOSATUALIZACAO', idServico: 'SOLICEVENTOSPJ132', label: 'Solicitar Eventos PJ', description: 'Solicita eventos de atualização de Pessoa Jurídica', tipo: 'Monitorar', fields: [F_CNPJ] },
      { idSistema: 'EVENTOSATUALIZACAO', idServico: 'OBTEREVENTOSPF133', label: 'Obter Eventos PF', description: 'Obtém eventos de atualização de Pessoa Física', tipo: 'Monitorar', fields: [{ key: 'cpf', label: 'CPF (11 dígitos)', required: true, placeholder: '12345678901' }, F_PROTOCOLO] },
      { idSistema: 'EVENTOSATUALIZACAO', idServico: 'OBTEREVENTOSPJ134', label: 'Obter Eventos PJ', description: 'Obtém eventos de atualização de Pessoa Jurídica', tipo: 'Monitorar', fields: [F_CNPJ, F_PROTOCOLO] },
    ],
  },
  parcelamentos: {
    label: 'Parcelamentos SN/MEI',
    icon: <FolderOpen className="h-4 w-4" />,
    services: [
      ...parcServices('PARCSN', 'Ordinário SN', [161, 162, 163, 164, 165]),
      ...parcServices('PARCSN-ESP', 'Especial SN', [171, 172, 173, 174, 175]),
      ...parcServices('PERTSN', 'PERT-SN', [181, 182, 183, 184, 185]),
      ...parcServices('RELPSN', 'RELP-SN', [191, 192, 193, 194, 195]),
      ...parcServices('PARCMEI', 'Ordinário MEI', [201, 202, 203, 204, 205]),
      ...parcServices('PARCMEI-ESP', 'Especial MEI', [211, 212, 213, 214, 215]),
      ...parcServices('PERTMEI', 'PERT-MEI', [221, 222, 223, 224, 225]),
      ...parcServices('RELPMEI', 'RELP-MEI', [231, 232, 233, 234, 235]),
    ],
  },
  redesim: {
    label: 'Redesim',
    icon: <Link2 className="h-4 w-4" />,
    services: [
      { idSistema: 'PNRCONTADOR', idServico: 'CONSVINCULOS261', label: 'Consultar Vínculos', description: 'Consulta vínculos do contador na Redesim', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'PNRCONTADOR', idServico: 'SOLICRENUNCIA262', label: 'Solicitar Renúncia', description: 'Solicita renúncia de vínculo na Redesim', tipo: 'Declarar', fields: [F_CNPJ] },
      { idSistema: 'PNRCONTADOR', idServico: 'CONSRENUNCIA263', label: 'Consultar Renúncia', description: 'Consulta renúncia de vínculo na Redesim', tipo: 'Consultar', fields: [F_CNPJ] },
      { idSistema: 'PNRCONTADOR', idServico: 'COMPRENUNCIA264', label: 'Comprovante Renúncia', description: 'Emite comprovante de renúncia Redesim', tipo: 'Emitir', fields: [F_CNPJ] },
      { idSistema: 'PNRCONTADOR', idServico: 'SITSOLICRENUNCIA265', label: 'Situação Solicitação', description: 'Consulta situação da solicitação de renúncia', tipo: 'Consultar', fields: [F_CNPJ] },
    ],
  },
  eprocesso: {
    label: 'e-Processo',
    icon: <FolderOpen className="h-4 w-4" />,
    services: [
      { idSistema: 'EPROCESSO', idServico: 'CONSPROCPORINTER271', label: 'Processos por Interessado', description: 'Consulta processos por interessado no e-Processo', tipo: 'Consultar', fields: [F_CNPJ] },
    ],
  },
};

function previousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function tryParseJson(v: unknown): Record<string, unknown> | null {
  try { return typeof v === 'string' ? JSON.parse(v) : (v as Record<string, unknown>); }
  catch { return null; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente:   { label: 'Pendente',   cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    declarado:  { label: 'Declarado',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    das_gerado: { label: 'DAS Gerado', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
    pago:       { label: 'Pago',       cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  };
  const v = map[status] ?? map.pendente;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>
      {v.label}
    </span>
  );
}

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
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [messageDetail, setMessageDetail] = useState<any>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);

  // Simples Nacional tab state
  const [competence, setCompetence] = useState<string>(previousMonth);
  const [snClients, setSnClients] = useState<SnClient[]>([]);
  const [assessments, setAssessments] = useState<Record<string, Assessment>>({});
  const [revenueByClient, setRevenueByClient] = useState<Record<string, { total: number; count: number }>>({});
  const [snLoading, setSnLoading] = useState(false);
  const [apurandoIds, setApurandoIds] = useState<Set<string>>(new Set());

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

  async function loadSimplesNacional() {
    setSnLoading(true);
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, company_name, document, simples_anexo, main_activity, secondary_activities, digital_certificate_url')
        .eq('status', 'active')
        .eq('tax_regime', 'simples_nacional')
        .not('document', 'is', null)
        .order('company_name');
      setSnClients((clients as SnClient[]) ?? []);
      if (!clients?.length) return;

      const [year, month] = competence.split('-');
      const from = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      const clientIds = clients.map((c) => c.id);

      const [{ data: invoices }, { data: existing }] = await Promise.all([
        supabase
          .from('invoices')
          .select('client_id, gross_value')
          .in('client_id', clientIds)
          .gte('issue_date', from)
          .lte('issue_date', to),
        supabase
          .from('tax_assessments')
          .select('*')
          .in('client_id', clientIds)
          .eq('competence', competence),
      ]);

      const revMap: Record<string, { total: number; count: number }> = {};
      invoices?.forEach((inv) => {
        if (!revMap[inv.client_id]) revMap[inv.client_id] = { total: 0, count: 0 };
        revMap[inv.client_id].total += inv.gross_value ?? 0;
        revMap[inv.client_id].count += 1;
      });
      setRevenueByClient(revMap);

      const assessMap: Record<string, Assessment> = {};
      existing?.forEach((a) => { assessMap[a.client_id] = a as unknown as Assessment; });
      setAssessments(assessMap);
    } finally {
      setSnLoading(false);
    }
  }

  async function handleApurar(client: SnClient) {
    if (!client.document) return;
    setApurandoIds((prev) => new Set(prev).add(client.id));
    try {
      const cnpjBasico = client.document.replace(/\D/g, '').substring(0, 8);
      const pa = competence.replace('-', '');
      const rev = revenueByClient[client.id];

      // Passo 1: buscar última declaração para obter RBT12
      const { data: ultDec } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: client.id,
          idSistema: 'PGDASD',
          idServico: 'CONSULTIMADECREC14',
          tipo: 'Consultar',
          dados: JSON.stringify({ cnpjBasico }),
        },
      });
      const decParsed = tryParseJson(ultDec?.data?.dados ?? ultDec?.data);
      const rbt12 = Number(
        decParsed?.rbt12 ??
        decParsed?.receitaBrutaTotal12Meses ??
        decParsed?.receitaBrutaAcumulada ??
        0
      );

      // Passo 2: transmitir declaração PGDAS-D
      const receitaMes = rev?.total ?? 0;
      const mainCnae = client.main_activity?.replace(/\D/g, '') ?? '';
      const dados = {
        cnpjBasico,
        pa,
        receitaBrutaAcumulada: rbt12,
        receitas: [{ cnae: mainCnae, receita: receitaMes }],
      };

      const { data: declRes, error: declErr } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: client.id,
          idSistema: 'PGDASD',
          idServico: 'TRANSDECLARACAO11',
          tipo: 'Declarar',
          dados: JSON.stringify(dados),
        },
      });
      if (declErr) throw declErr;
      if (!declRes?.success) {
        const msg = declRes?.serpro_response?.mensagens?.[0]?.texto ?? declRes?.error ?? 'Erro SERPRO';
        toast({ title: 'Erro na declaração PGDAS-D', description: `${client.company_name}: ${msg}`, variant: 'destructive' });
        return;
      }

      const declParsed = tryParseJson(declRes.data?.dados ?? declRes.data);
      const declaracaoNumero = (declParsed?.numeroDeclaracao ?? declParsed?.recibo ?? null) as string | null;

      await supabase.from('tax_assessments').upsert({
        client_id: client.id,
        competence,
        tax_regime: 'simples_nacional',
        receita_bruta: receitaMes,
        receita_acumulada: rbt12 || null,
        invoice_count: rev?.count ?? 0,
        status: 'declarado',
        declaracao_numero: declaracaoNumero,
        serpro_declaracao: declRes.data,
        declarado_em: new Date().toISOString(),
      }, { onConflict: 'client_id,competence' });
      setAssessments((prev) => ({
        ...prev,
        [client.id]: { ...(prev[client.id] ?? {}), client_id: client.id, competence, status: 'declarado', declaracao_numero: declaracaoNumero } as Assessment,
      }));

      // Passo 3: gerar DAS
      const { data: dasRes } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: client.id,
          idSistema: 'PGDASD',
          idServico: 'GERARDAS12',
          tipo: 'Emitir',
          dados: JSON.stringify({ cnpjBasico, pa }),
        },
      });

      if (dasRes?.success) {
        const dasParsed = tryParseJson(dasRes.data?.dados ?? dasRes.data);
        const valorDas = (dasParsed?.valorTotal ?? dasParsed?.valor ?? null) as number | null;
        const vencimentoDas = (dasParsed?.dataVencimento ?? dasParsed?.vencimento ?? null) as string | null;
        const codigoBarras = (dasParsed?.codigoBarras ?? dasParsed?.linhaDigitavel ?? null) as string | null;
        const numeroDas = (dasParsed?.numeroDas ?? dasParsed?.numero ?? null) as string | null;
        const update = {
          status: 'das_gerado' as const,
          valor_das: valorDas,
          vencimento_das: vencimentoDas,
          codigo_barras_das: codigoBarras,
          numero_das: numeroDas,
          serpro_das: dasRes.data,
          gerado_em: new Date().toISOString(),
        };
        await supabase.from('tax_assessments').update(update)
          .eq('client_id', client.id).eq('competence', competence);
        setAssessments((prev) => ({ ...prev, [client.id]: { ...prev[client.id], ...update } as Assessment }));
        toast({
          title: `${client.company_name} — DAS gerado`,
          description: `Venc. ${vencimentoDas ?? 'N/A'} · R$ ${Number(valorDas ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        });
      } else {
        toast({ title: `${client.company_name} — declarado`, description: 'DAS não gerado automaticamente. Clique em Reapurar para tentar novamente.' });
      }
    } catch (e: any) {
      toast({ title: 'Erro na apuração', description: `${client.company_name}: ${e.message}`, variant: 'destructive' });
    } finally {
      setApurandoIds((prev) => { const s = new Set(prev); s.delete(client.id); return s; });
    }
  }

  async function handleMarcarPago(clientId: string) {
    await supabase.from('tax_assessments')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('client_id', clientId).eq('competence', competence);
    setAssessments((prev) => ({ ...prev, [clientId]: { ...prev[clientId], status: 'pago' } as Assessment }));
    toast({ title: 'Marcado como pago' });
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
          dados: selectedService.fields.length > 0 ? JSON.stringify(formData) : '',
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

  // Parse Caixa Postal messages from result
  function parseCaixaPostalMessages(res: any): any[] | null {
    try {
      if (!res?.success) return null;
      // Edge function wraps SERPRO response in res.data
      const rawDados = res?.data?.dados || res?.data?.pedidoDados?.dados || res?.dados;
      if (!rawDados) return null;
      const dados = typeof rawDados === 'string' ? JSON.parse(rawDados) : rawDados;
      // The API returns messages as an array or object with messages
      if (Array.isArray(dados)) return dados;
      if (dados?.mensagens && Array.isArray(dados.mensagens)) return dados.mensagens;
      if (dados?.listaMensagens && Array.isArray(dados.listaMensagens)) return dados.listaMensagens;
      // Try to find any array property
      for (const key of Object.keys(dados)) {
        if (Array.isArray(dados[key]) && dados[key].length > 0) return dados[key];
      }
      return null;
    } catch {
      return null;
    }
  }

  function isCaixaPostalList(): boolean {
    return selectedService?.idServico === 'MSGCONTRIBUINTE61';
  }

  async function handleMessageClick(message: any) {
    setSelectedMessage(message);
    setMessageDialogOpen(true);
    setMessageDetail(null);

    const isn = message.isn || message.ISN || message.numeroSequencial;
    if (!isn || !selectedClientId) return;

    setMessageLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: selectedClientId,
          idSistema: 'CAIXAPOSTAL',
          idServico: 'MSGDETALHAMENTO62',
          tipo: 'Consultar',
          dados: JSON.stringify({ isn: String(isn) }),
        },
      });
      if (error) throw error;
      if (data?.success && data?.dados) {
        const parsed = typeof data.dados === 'string' ? JSON.parse(data.dados) : data.dados;
        setMessageDetail(parsed);
      } else {
        setMessageDetail({ error: data?.error || 'Erro ao carregar detalhes' });
      }
    } catch (err: any) {
      setMessageDetail({ error: err.message });
    } finally {
      setMessageLoading(false);
    }
  }

  function renderCaixaPostalInbox(messages: any[]) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Caixa Postal — {messages.length} mensagem(ns)</h3>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead>Remetente</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead className="w-28">Data Envio</TableHead>
                <TableHead className="w-28">Data Leitura</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((msg, idx) => {
                const isRead = msg.statusLeitura === '1' || msg.statusLeitura === 1 || msg.lida === true || msg.dataLeitura;
                const subject = msg.assunto || msg.titulo || msg.subject || 'Sem assunto';
                const sender = msg.remetente || msg.nomeRemetente || msg.sender || 'RFB';
                const sentDate = msg.dataEnvio || msg.dataCriacao || msg.dataEmissao || '';
                const readDate = msg.dataLeitura || '';
                const isn = msg.isn || msg.ISN || msg.numeroSequencial || '';

                return (
                  <TableRow
                    key={isn || idx}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleMessageClick(msg)}
                  >
                    <TableCell className="text-center">
                      {isRead ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground mx-auto" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className={!isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {sender}
                    </TableCell>
                    <TableCell className={!isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      <span className="line-clamp-1">{subject}</span>
                      {isn && <span className="text-xs text-muted-foreground ml-2">ISN: {isn}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sentDate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{readDate || '—'}</TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="raw-json">
            <AccordionTrigger className="text-xs text-muted-foreground">Ver JSON completo</AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(result, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integra Contador</h1>
        <p className="text-muted-foreground mt-1">
          Acesse serviços fiscais da Receita Federal via API SERPRO
        </p>
      </div>

      <Tabs defaultValue="simples-nacional">
        <TabsList>
          <TabsTrigger value="simples-nacional">Simples Nacional</TabsTrigger>
          <TabsTrigger value="servicos">Serviços Fiscais</TabsTrigger>
        </TabsList>

        {/* ============ Aba Simples Nacional ============ */}
        <TabsContent value="simples-nacional" className="space-y-4 mt-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-4 flex-wrap">
              <Label>Competência</Label>
              <Input
                type="month"
                value={competence}
                onChange={(e) => setCompetence(e.target.value)}
                className="w-44"
              />
              <Button onClick={loadSimplesNacional} disabled={snLoading}>
                {snLoading
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <RefreshCw className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
              {snClients.length > 0 && (
                <span className="text-sm text-muted-foreground">{snClients.length} clientes Simples Nacional</span>
              )}
            </CardContent>
          </Card>

          {snClients.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-24">Anexo</TableHead>
                      <TableHead className="w-36 text-right">Receita do mês</TableHead>
                      <TableHead className="w-14 text-center">NFs</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-32 text-right">Valor DAS</TableHead>
                      <TableHead className="w-28">Vencimento</TableHead>
                      <TableHead className="w-44 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snClients.map((client) => {
                      const assess = assessments[client.id];
                      const rev = revenueByClient[client.id];
                      const isProcessing = apurandoIds.has(client.id);
                      const status = assess?.status ?? 'pendente';
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{client.company_name}</div>
                            <div className="text-xs text-muted-foreground">{client.document}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Anexo {client.simples_anexo ?? '?'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {rev?.total != null
                              ? `R$ ${rev.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {rev?.count ?? 0}
                          </TableCell>
                          <TableCell>
                            {isProcessing ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />Apurando...
                              </span>
                            ) : (
                              <StatusBadge status={status} />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {assess?.valor_das != null
                              ? `R$ ${Number(assess.valor_das).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {assess?.vencimento_das ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {status !== 'pago' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isProcessing}
                                  onClick={() => handleApurar(client)}
                                >
                                  {isProcessing
                                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    : <Scale className="h-3 w-3 mr-1" />}
                                  {status === 'pendente' ? 'Apurar' : 'Reapurar'}
                                </Button>
                              )}
                              {status === 'das_gerado' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMarcarPago(client.id)}
                                >
                                  Pago
                                </Button>
                              )}
                              {status === 'pago' && (
                                <span className="text-xs text-green-600 font-medium pr-2">✓ Pago</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ Aba Serviços Fiscais (conteúdo original) ============ */}
        <TabsContent value="servicos" className="mt-4">
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
              <Tabs value={selectedCategory} onValueChange={handleCategoryChange}>
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
                  {Object.entries(SERVICE_CATALOG).map(([key, cat]) => (
                    <TabsTrigger key={key} value={key} className="text-xs gap-1.5">
                      {cat.icon} {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(SERVICE_CATALOG).map(([key]) => (
                  <TabsContent key={key} value={key} className="mt-4">
                    <div>
                      <Label>Serviço</Label>
                      <Select value={selectedServiceId} onValueChange={handleServiceChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o serviço..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_CATALOG[key].services.map((svc) => (
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
                  </TabsContent>
                ))}
              </Tabs>
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
                    {field.options ? (
                      <Select value={formData[field.key] || ''} onValueChange={(val) => setFormData((prev) => ({ ...prev, [field.key]: val }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    )}
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
                  {isCaixaPostalList() && parseCaixaPostalMessages(result as any) ? (
                    renderCaixaPostalInbox(parseCaixaPostalMessages(result as any)!)
                  ) : (
                    <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  )}
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
        </TabsContent>
      </Tabs>

      {/* Message Detail Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-primary" />
              Detalhes da Mensagem
            </DialogTitle>
            <DialogDescription>
              {selectedMessage && (selectedMessage.assunto || selectedMessage.titulo || selectedMessage.subject || 'Mensagem da Caixa Postal')}
            </DialogDescription>
          </DialogHeader>

          {messageLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Carregando detalhes...</span>
            </div>
          ) : messageDetail?.error ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
                {messageDetail.error}
              </div>
              {selectedMessage && (
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground text-sm">Dados da lista:</h4>
                  <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedMessage, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : messageDetail ? (
            <div className="space-y-4">
              {/* Message metadata */}
              <div className="grid grid-cols-2 gap-3 bg-muted/50 p-4 rounded-lg">
                {messageDetail.remetente && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Remetente</span>
                    <span className="text-sm font-medium text-foreground">{messageDetail.remetente}</span>
                  </div>
                )}
                {messageDetail.assunto && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Assunto</span>
                    <span className="text-sm font-medium text-foreground">{messageDetail.assunto}</span>
                  </div>
                )}
                {(messageDetail.dataEnvio || messageDetail.dataCriacao) && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Data de Envio</span>
                    <span className="text-sm text-foreground">{messageDetail.dataEnvio || messageDetail.dataCriacao}</span>
                  </div>
                )}
                {messageDetail.dataLeitura && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Data de Leitura</span>
                    <span className="text-sm text-foreground">{messageDetail.dataLeitura}</span>
                  </div>
                )}
                {/* Render any other simple key-value pairs */}
                {Object.entries(messageDetail)
                  .filter(([key]) => !['remetente', 'assunto', 'dataEnvio', 'dataCriacao', 'dataLeitura', 'corpo', 'textoMensagem', 'conteudo', 'mensagem', 'texto'].includes(key))
                  .filter(([, val]) => typeof val === 'string' || typeof val === 'number')
                  .map(([key, val]) => (
                    <div key={key}>
                      <span className="text-xs text-muted-foreground block">{key}</span>
                      <span className="text-sm text-foreground">{String(val)}</span>
                    </div>
                  ))
                }
              </div>

              {/* Message body */}
              {(() => {
                const body = messageDetail.corpo || messageDetail.textoMensagem || messageDetail.conteudo || messageDetail.mensagem || messageDetail.texto;
                if (!body) return null;
                return (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-xs text-muted-foreground mb-2">Conteúdo da Mensagem</h4>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {body}
                    </div>
                  </div>
                );
              })()}

              {/* Raw JSON fallback */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="raw">
                  <AccordionTrigger className="text-xs text-muted-foreground">Ver JSON completo</AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(messageDetail, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : selectedMessage ? (
            <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap break-words">
              {JSON.stringify(selectedMessage, null, 2)}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
