import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const today = () =>
  new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

const formatCurrency = (value: string) => {
  const num = Number(value) || 0;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

function getDefaultClauses(props: ContractTabProps): string[] {
  const { monthlyValue } = props;
  return [
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

    `CLÁUSULA 2 – DAS OBRIGAÇÕES DA CONTRATANTE

2.1 Fornecer documentação necessária por meio digital, dentro dos prazos estabelecidos.
2.2 Informar fatos administrativos relevantes com antecedência.
2.3 Manter atualizados os dados cadastrais.
2.4 Utilizar corretamente os sistemas disponibilizados.
2.5 Efetuar o pagamento dos honorários.`,

    `CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATADA

3.1 Executar os serviços com diligência e conforme normas vigentes.
3.2 Disponibilizar acesso à plataforma digital utilizada.
3.3 Cumprir prazos legais, desde que a CONTRATANTE cumpra os prazos de envio.
3.4 Manter sigilo sobre informações da CONTRATANTE.
3.5 Responder por multas decorrentes exclusivamente de falhas próprias.`,

    `CLÁUSULA 4 – DO ENVIO DE DOCUMENTOS DIGITAIS

4.1 Toda troca de documentos ocorrerá via canais digitais: WhatsApp, e-mail e plataforma indicada pela CONTRATADA.

4.2 O e-mail será considerado o canal oficial para fins de comprovação, contagem de prazos e formalidade jurídica, inclusive para o envio de documentos, solicitações e notificações.`,

    `CLÁUSULA 5 – DOS HONORÁRIOS

5.1 Os honorários mensais serão de ${formatCurrency(monthlyValue)}.

5.2 Serviços extraordinários terão cobrança adicional.

5.3 Reajuste anual pelo IPCA.`,

    `CLÁUSULA 6 – DA VIGÊNCIA

6.1 O contrato terá vigência de 12 meses, renovado automaticamente.`,

    `CLÁUSULA 7 – DA RESCISÃO

7.1 A rescisão poderá ocorrer mediante aviso prévio de 30 dias.

7.2 A CONTRATADA prestará suporte por até 30 dias após a rescisão.

7.3 Débitos pendentes deverão ser quitados.`,

    `CLÁUSULA 8 – DA RESPONSABILIDADE TÉCNICA

Responsável técnico: Márcio Roberto Macelan – CRCSC nº 028170/O.`,

    `CLÁUSULA 9 – DO TRATAMENTO DE DADOS (LGPD)

9.1 As partes comprometem-se a tratar dados pessoais conforme a Lei nº 13.709/18.`,

    `CLÁUSULA 10 – DO FORO

Fica eleito o foro da comarca de Penha/SC.`,
  ];
}

// PDF drawing helpers
const ORANGE = [255, 140, 0] as const;
const BLACK = [30, 30, 30] as const;

function drawHeader(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  // Black bar left ~60%
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.rect(0, 0, pw * 0.6, 10, 'F');
  // Orange bar right ~40%, slightly lower
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(pw * 0.6, 2, pw * 0.4, 8, 'F');
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const footerY = ph - 18;
  const footerH = 12;
  const margin = 10;
  const barW = pw - margin * 2;

  // Black rounded bar
  doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.roundedRect(margin, footerY, barW, footerH, 3, 3, 'F');

  // Orange accent right
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.roundedRect(pw - margin - 30, footerY, 30, footerH, 0, 3, 'F');
  doc.rect(pw - margin - 30, footerY, 15, footerH, 'F'); // square off left side

  // White text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const textY = footerY + footerH / 2 + 1.5;
  doc.text('atendimento@velocitacontabilidade.com.br', margin + 8, textY);
  doc.text('@velocitacontabilidade', pw / 2 - 15, textY);
  doc.text('(47) 3842 0299', pw - margin - 55, textY);

  // Reset text color
  doc.setTextColor(0, 0, 0);
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
    const { companyName, document: doc, address, contactName, partnersInfo } = props;
    const cpf = partnersInfo ? partnersInfo.split('\n')[0]?.replace(/\(.*\)/, '').trim() : '[CPF]';
    return `Penha/SC, ${today()}.

CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS DIGITAIS

CONTRATANTE: ${companyName || '[Nome]'}
CNPJ: ${doc || '[CNPJ]'}
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
    const pw = doc.internal.pageSize.getWidth();
    const marginLeft = 20;
    const marginRight = 20;
    const maxWidth = pw - marginLeft - marginRight;
    const lineHeight = 5.5;
    const headerMargin = 18;
    const footerLimit = 265;
    let y = headerMargin;

    // Draw header/footer on first page
    drawHeader(doc);
    drawFooter(doc);

    const newPage = () => {
      doc.addPage();
      drawHeader(doc);
      drawFooter(doc);
      y = headerMargin;
    };

    const checkPage = (needed: number) => {
      if (y + needed > footerLimit) {
        newPage();
      }
    };

    const writeLine = (text: string, fontSize = 10, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        checkPage(lineHeight + 1);
        doc.text(line, marginLeft, y);
        y += lineHeight;
      }
    };

    const writeBlock = (text: string, fontSize = 10) => {
      const paragraphs = text.split('\n');
      for (const p of paragraphs) {
        if (!p.trim()) { y += 2; continue; }
        const isClauseTitle = /^CLÁUSULA\s+\d+/.test(p);
        const isSubTitle = /^1\.2\.\d/.test(p);
        if (isClauseTitle) {
          writeLine(p, 13, true);
        } else if (isSubTitle) {
          writeLine(p, 11, true);
        } else {
          writeLine(p, fontSize, false);
        }
      }
      y += 3;
    };

    const drawSeparator = () => {
      checkPage(8);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, y, pw - marginRight, y);
      y += 5;
    };

    // Title
    y += 4;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const title = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS DIGITAIS';
    const titleLines = doc.splitTextToSize(title, maxWidth);
    for (const tl of titleLines) {
      doc.text(tl, pw / 2, y, { align: 'center' });
      y += 7;
    }
    y += 4;

    // Header block (parties)
    const { companyName, document: clientDoc, address, contactName, partnersInfo } = props;
    const cpf = partnersInfo ? partnersInfo.split('\n')[0]?.replace(/\(.*\)/, '').trim() : '[CPF]';

    writeLine(`Penha/SC, ${today()}.`, 10, false);
    y += 4;

    writeLine('CONTRATANTE:', 10, true);
    writeLine(`Razão Social: ${companyName || '[Nome]'}`, 10);
    writeLine(`CNPJ: ${clientDoc || '[CNPJ]'}`, 10);
    writeLine(`Endereço: ${address || '[Endereço]'}`, 10);
    writeLine(`Representante legal: ${contactName || '[Representante]'}`, 10);
    writeLine(`CPF: ${cpf}`, 10);
    y += 4;

    writeLine('CONTRATADA:', 10, true);
    writeLine('Razão Social: Velocità Gestão Contábil Ltda', 10);
    writeLine('CNPJ: 40.908.083/0001-36', 10);
    writeLine('Endereço: Rua Alfredo Bruneti, 673, Armação, Penha/SC', 10);
    writeLine('Representante legal: Márcio Roberto Macelan', 10);
    writeLine('CPF: 024.999.829-77', 10);
    y += 4;

    writeLine('As partes acima identificadas celebram o presente Contrato de Prestação de Serviços Contábeis Digitais, mediante as cláusulas e condições seguintes.', 10, false);
    y += 6;

    // Clauses
    for (const clause of clauses) {
      drawSeparator();
      writeBlock(clause, 10);
    }

    // Signatures - vertical layout
    y += 10;
    checkPage(60);
    drawSeparator();

    writeLine(`Penha/SC, ${today()}.`, 10, false);
    y += 20;

    // Contratante
    doc.text('_________________________________________', marginLeft, y);
    y += 6;
    writeLine('CONTRATANTE', 10, true);
    writeLine(companyName || '[Nome]', 10, false);
    writeLine(`CPF: ${cpf}`, 10, false);
    y += 15;

    // Contratada
    doc.text('_________________________________________', marginLeft, y);
    y += 6;
    writeLine('CONTRATADA', 10, true);
    writeLine('Velocità Gestão Contábil Ltda', 10, false);
    writeLine('CNPJ: 40.908.083/0001-36', 10, false);

    doc.save(`Contrato_${companyName || 'Cliente'}.pdf`);
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
