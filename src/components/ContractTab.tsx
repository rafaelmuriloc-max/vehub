import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';
import jsPDF from 'jspdf';

interface ContractTabProps {
  companyName: string;
  document: string;
  address: string;
  contactName: string;
  partnersInfo: string;
  monthlyValue: string;
}

const today = () => {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatCurrency = (value: string) => {
  const num = Number(value) || 0;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

function getDefaultClauses(props: ContractTabProps): string[] {
  const { companyName, document, address, contactName, partnersInfo, monthlyValue } = props;
  const representante = contactName || '[Representante]';
  const cpf = partnersInfo ? partnersInfo.split('\n')[0]?.replace(/\(.*\)/, '').trim() : '[CPF]';

  return [
    // Cláusula 1
    `CLÁUSULA 1 – DO OBJETO

1.1 O presente contrato tem por objeto a prestação de serviços de contabilidade em ambiente digital, utilizando plataformas de integração financeira, fiscal e contábil disponibilizadas pela CONTRATADA ou por terceiros homologados.

1.2 Os serviços incluem, conforme pacote contratado:

1.2.1 – Serviços Contábeis
a) Classificação, conciliação e escrituração contábil digital;
b) Elaboração de balancetes periódicos;
c) Elaboração das Demonstrações Contábeis anuais;
d) Disponibilização de relatórios gerenciais.

1.2.2 – Serviços Fiscais
a) Escrituração fiscal digital (ISS, ICMS, IPI, PIS, COFINS etc.);
b) Emissão de guias de tributos;
c) Entrega de obrigações acessórias (SPED, DCTF, DEFIS, EFDs etc.);
d) Suporte em fiscalizações dentro dos limites deste contrato.

1.2.3 – Serviços Trabalhistas e Previdenciários
a) Admissão, rescisão e férias;
b) Folha de pagamento;
c) Obrigações acessórias (eSocial, CAGED, RAIS, DIRF etc.).

1.2.4 – Serviços Financeiros Digitais (se contratados)
a) Conciliação bancária digital;
b) Conciliação de cartões;
c) Controle de contas a pagar e receber;
d) Dashboards financeiros.

1.2.5 – Consultorias Digitais
a) Consultoria tributária básica;
b) Consultoria contábil;
c) Suporte por canais digitais.`,

    // Cláusula 2
    `CLÁUSULA 2 – DAS OBRIGAÇÕES DA CONTRATANTE

2.1 Fornecer documentação necessária por meio digital, dentro dos prazos estabelecidos.
2.2 Informar fatos administrativos relevantes com antecedência.
2.3 Manter atualizados os dados cadastrais.
2.4 Utilizar corretamente os sistemas disponibilizados.
2.5 Efetuar o pagamento dos honorários.`,

    // Cláusula 3
    `CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATADA

3.1 Executar os serviços com diligência e conforme normas vigentes.
3.2 Disponibilizar acesso à plataforma digital utilizada.
3.3 Cumprir prazos legais, desde que a CONTRATANTE cumpra os prazos de envio.
3.4 Manter sigilo sobre informações da CONTRATANTE.
3.5 Responder por multas decorrentes exclusivamente de falhas próprias.`,

    // Cláusula 4
    `CLÁUSULA 4 – DO ENVIO DE DOCUMENTOS DIGITAIS

4.1 Toda troca de documentos ocorrerá via canais digitais: WhatsApp, e-mail e plataforma indicada pela CONTRATADA.

4.2 O e-mail será considerado o canal oficial para fins de comprovação, contagem de prazos e formalidade jurídica, inclusive para o envio de documentos, solicitações e notificações.`,

    // Cláusula 5
    `CLÁUSULA 5 – DOS HONORÁRIOS

5.1 Os honorários mensais serão de ${formatCurrency(monthlyValue)}.

5.2 Serviços extraordinários terão cobrança adicional.

5.3 Reajuste anual pelo IPCA.`,

    // Cláusula 6
    `CLÁUSULA 6 – DA VIGÊNCIA

6.1 O contrato terá vigência de 12 meses, renovado automaticamente.`,

    // Cláusula 7
    `CLÁUSULA 7 – DA RESCISÃO

7.1 A rescisão poderá ocorrer mediante aviso prévio de 30 dias.

7.2 A CONTRATADA prestará suporte por até 30 dias após a rescisão.

7.3 Débitos pendentes deverão ser quitados.`,

    // Cláusula 8
    `CLÁUSULA 8 – DA RESPONSABILIDADE TÉCNICA

Responsável técnico: Márcio Roberto Macelan – CRCSC nº 028170/O.`,

    // Cláusula 9
    `CLÁUSULA 9 – DO TRATAMENTO DE DADOS (LGPD)

9.1 As partes comprometem-se a tratar dados pessoais conforme a Lei nº 13.709/18.`,

    // Cláusula 10
    `CLÁUSULA 10 – DO FORO

Fica eleito o foro da comarca de Penha/SC.`,
  ];
}

export default function ContractTab(props: ContractTabProps) {
  const [clauses, setClauses] = useState<string[]>([]);

  useEffect(() => {
    setClauses(getDefaultClauses(props));
  }, [props.companyName, props.document, props.address, props.contactName, props.partnersInfo, props.monthlyValue]);

  const updateClause = (index: number, value: string) => {
    setClauses(prev => prev.map((c, i) => (i === index ? value : c)));
  };

  const headerText = () => {
    const { companyName, document, address, contactName, partnersInfo } = props;
    const cpf = partnersInfo ? partnersInfo.split('\n')[0]?.replace(/\(.*\)/, '').trim() : '[CPF]';
    return `Penha/SC, ${today()}.

CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS DIGITAIS

CONTRATANTE: ${companyName || '[Nome]'}
CNPJ: ${document || '[CNPJ]'}
Endereço: ${address || '[Endereço]'}
Representante legal: ${contactName || '[Representante]'}
CPF: ${cpf}

CONTRATADA: Velocità Gestão Contábil Ltda
CNPJ: 40.908.083/0001-36
Endereço: Rua Alfredo Bruneti, 673, Armação, Penha/SC
Representante legal: Márcio Roberto Macelan
CPF: 024.999.829-77

As partes acima identificadas celebram o presente Contrato de Prestação de Serviços Contábeis Digitais, mediante as cláusulas e condições seguintes.`;
  };

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 20;
    const marginRight = 20;
    const maxWidth = pageWidth - marginLeft - marginRight;
    const lineHeight = 6;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
    };

    const writeLine = (text: string, fontSize = 10, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        checkPage(lineHeight);
        doc.text(line, marginLeft, y);
        y += lineHeight;
      }
    };

    const writeBlock = (text: string, fontSize = 10) => {
      const paragraphs = text.split('\n');
      for (const p of paragraphs) {
        if (!p.trim()) { y += 3; continue; }
        const isBold = p.startsWith('CLÁUSULA') || p.startsWith('1.2.');
        writeLine(p, fontSize, isBold);
      }
      y += 4;
    };

    // Header
    writeBlock(headerText(), 10);
    y += 4;

    // Clauses
    for (const clause of clauses) {
      writeBlock(clause, 10);
    }

    // Signatures
    y += 10;
    checkPage(40);

    writeLine(`Penha/SC, ${today()}.`, 10, false);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Contratante
    doc.text('_________________________________', marginLeft, y);
    doc.text('_________________________________', pageWidth / 2 + 10, y);
    y += 6;
    doc.text('Contratante', marginLeft, y);
    doc.text('Contratada', pageWidth / 2 + 10, y);
    y += 5;
    doc.text(props.companyName || '[Nome]', marginLeft, y);
    doc.text('Velocità Gestão Contábil', pageWidth / 2 + 10, y);
    y += 5;
    doc.text(`CPF: ${props.partnersInfo ? props.partnersInfo.split('\n')[0]?.replace(/\(.*\)/, '').trim() : '[CPF]'}`, marginLeft, y);
    doc.text('CNPJ: 40.908.083/0001-36', pageWidth / 2 + 10, y);

    doc.save(`Contrato_${props.companyName || 'Cliente'}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Contrato de Prestação de Serviços</h3>
        <Button type="button" onClick={generatePDF}>
          <FileText className="mr-2 h-4 w-4" />
          Gerar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cabeçalho do Contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap text-foreground bg-muted p-4 rounded-md">
            {headerText()}
          </pre>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {clauses.map((clause, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cláusula {idx + 1}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clause}
                onChange={(e) => updateClause(idx, e.target.value)}
                rows={Math.max(4, clause.split('\n').length + 1)}
                className="text-sm"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
