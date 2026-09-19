export type SitfisSource = { page?: number; section: string };
export type SitfisOmission = { declaration: string; reason: string; competencies: string[]; source: SitfisSource };
export type SitfisDebt = { tax: string | null; competency: string | null; principal: number | null; updated: number | null; dueDate: string | null; agency: string | null; status: string | null; source: SitfisSource };
export type SitfisInstallment = { modality: string | null; number: string | null; status: string | null; balance: number | null; agency: string | null; source: SitfisSource };
export type SitfisSuspension = { identification: string | null; agency: string | null; status: string | null; reference: string | null; source: SitfisSource };
export type SitfisPgfn = { status: 'regular' | 'irregular' | 'unknown'; description: string | null; source: SitfisSource };
export type SitfisStructuredReport = {
  omissions: SitfisOmission[];
  debts: SitfisDebt[];
  installments: SitfisInstallment[];
  suspensions: SitfisSuspension[];
  pgfn: SitfisPgfn[];
  occurrenceTypes: string[];
  agencies: string[];
  competencies: string[];
  totalOccurrences: number;
};

const MONTHS: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};
const EMPTY = /^(?:-|—|n\/a|não informado)$/i;
const FOOTER = /(?:MINISTÉRIO DA ECONOMIA|SECRETARIA ESPECIAL DA RECEITA|Autor pedido:|Contratante:|INFORMAÇÕES DE APOIO|Final do Relatório|Relatório Página:|Página:\s*\d+\s*\/\s*\d+)/gi;
const MARKER = /(?=(?:Pend[êe]ncia|Parcelamento|Processo|Inscri[çc][ãa]o|D[ée]bito)\s*[-–:])/gi;

function clean(value: string): string {
  return value.replace(FOOTER, ' ').replace(/_{3,}/g, ' ').replace(/\s+/g, ' ').trim();
}
function nullable(value?: string | null): string | null {
  const v = clean(value || '');
  return !v || EMPTY.test(v) ? null : v;
}
function money(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
function capture(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return nullable(match[1]);
  }
  return null;
}
function source(page: number, section: string): SitfisSource { return { page, section }; }

export function extractCompetencies(text: string): string[] {
  const normalized = text.toUpperCase().replace(/[.,;]/g, ' ');
  const found = new Set<string>();
  let currentYear: string | null = null;
  for (const token of normalized.match(/\b(?:20\d{2}|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/g) || []) {
    if (/^20\d{2}$/.test(token)) currentYear = token;
    else if (currentYear && MONTHS[token]) found.add(`${currentYear}-${MONTHS[token]}`);
  }
  const numeric = normalized.matchAll(/\b(0?[1-9]|1[0-2])[\/-](20\d{2})\b/g);
  for (const match of numeric) found.add(`${match[2]}-${match[1].padStart(2, '0')}`);
  return [...found].sort();
}

function splitBlocks(pages: string[]): { text: string; page: number; pgfn: boolean }[] {
  const blocks: { text: string; page: number; pgfn: boolean }[] = [];
  pages.forEach((pageText, index) => {
    const prepared = pageText.replace(MARKER, '\n');
    const pgfnAt = prepared.search(/(?:Diagnóstico Fiscal na Procuradoria|Procuradoria-Geral da Fazenda|\bPGFN\b)/i);
    prepared.split('\n').map(clean).filter(Boolean).forEach(text => {
      if (!/^(?:Pend[êe]ncia|Parcelamento|Processo|Inscri[çc][ãa]o|D[ée]bito)\s*[-–:]/i.test(text)) return;
      blocks.push({ text, page: index + 1, pgfn: pgfnAt >= 0 && prepared.indexOf(text) >= pgfnAt });
    });
  });
  return blocks;
}

export function parseSitfisReport(pages: string[]): SitfisStructuredReport {
  const omissions: SitfisOmission[] = [];
  const debts: SitfisDebt[] = [];
  const installments: SitfisInstallment[] = [];
  const suspensions: SitfisSuspension[] = [];
  const pgfn: SitfisPgfn[] = [];
  const blocks = splitBlocks(pages);

  for (const block of blocks) {
    const text = block.text;
    if (/omiss[ãa]o|aus[êe]ncia de entrega|declara[çc][ãa]o n[ãa]o entregue/i.test(text)) {
      omissions.push({
        declaration: /DCTFWeb/i.test(text) ? 'DCTFWeb' : capture(text, [/Omiss[ãa]o(?: de)?\s+([^(*:–-]+)/i]) || 'Declaração não identificada',
        reason: capture(text, [/\*([^*]+?)(?=(?:Parcelamento|Processo|Diagnóstico|$))/i, /Motivo\s*[:–-]\s*([^|]+)/i]) || 'Informação não disponível',
        competencies: extractCompetencies(text),
        source: source(block.page, block.pgfn ? 'PGFN' : 'Receita Federal'),
      });
    }
    if (/^D[ée]bito|pend[êe]ncia\s*[-–:]\s*(?:d[ée]bito|pagamento)|inadimpl|auto de infra[çc][ãa]o/i.test(text)) {
      debts.push({
        tax: capture(text, [/(?:Tributo|Receita)\s*[:–-]\s*([^|;]+)/i, /D[ée]bito\s*[-–:]\s*([^(*|;]+)/i]),
        competency: extractCompetencies(text)[0] || capture(text, [/(?:Compet[êe]ncia|Per[íi]odo de Apura[çc][ãa]o)\s*[:)]?\s*([0-9/\-]+)/i]),
        principal: money(capture(text, [/Valor Principal\s*[:–-]?\s*(R\$\s*[\d.,]+)/i]) || undefined),
        updated: money(capture(text, [/Valor Atualizado\s*[:–-]?\s*(R\$\s*[\d.,]+)/i, /Saldo\s*[:–-]?\s*(R\$\s*[\d.,]+)/i]) || undefined),
        dueDate: capture(text, [/Vencimento\s*[:–-]?\s*(\d{2}\/\d{2}\/\d{4})/i]),
        agency: block.pgfn ? 'PGFN' : capture(text, [/Órgão\s*[:–-]\s*([^|;]+)/i]) || 'Receita Federal',
        status: capture(text, [/Situa[çc][ãa]o\s*[:–-]\s*([^|;]+)/i]),
        source: source(block.page, block.pgfn ? 'PGFN' : 'Receita Federal'),
      });
    }
    if (/^Parcelamento\s*[-–:]/i.test(text) || /em parcelamento/i.test(text)) {
      installments.push({
        modality: capture(text, [/Parcelamento\s*[-–:]\s*([^|;]+)/i, /Modalidade\s*[:–-]\s*([^|;]+)/i]),
        number: capture(text, [/(?:N[º°o]|N[uú]mero)(?: do)? Parcelamento\s*[:–-]?\s*([\w./-]+)/i]),
        status: capture(text, [/Situa[çc][ãa]o\s*[:–-]\s*([^|;]+)/i]) || (/exigibilidade suspensa/i.test(text) ? 'Com exigibilidade suspensa' : null),
        balance: money(capture(text, [/(?:Saldo|Saldo devedor)\s*[:–-]?\s*(R\$\s*[\d.,]+)/i]) || undefined),
        agency: block.pgfn ? 'PGFN' : 'Receita Federal',
        source: source(block.page, block.pgfn ? 'PGFN' : 'Receita Federal'),
      });
    }
    if (/^Processo\s*[-–:]|exigibilidade suspensa|processo administrativo|sob julgamento/i.test(text)) {
      suspensions.push({
        identification: capture(text, [/(?:Processo|Identifica[çc][ãa]o)\s*[-–:]?\s*([\w./-]+)/i]),
        agency: block.pgfn ? 'PGFN' : 'Receita Federal',
        status: capture(text, [/Situa[çc][ãa]o\s*[:–-]\s*([^|;]+)/i]) || (/exigibilidade suspensa/i.test(text) ? 'Exigibilidade suspensa' : null),
        reference: capture(text, [/(?:Refer[êe]ncia|Motivo)\s*[:–-]\s*([^|;]+)/i]),
        source: source(block.page, block.pgfn ? 'PGFN' : 'Receita Federal'),
      });
    }
  }

  pages.forEach((page, index) => {
    const match = page.match(/(?:Diagnóstico Fiscal na Procuradoria|Procuradoria-Geral da Fazenda|\bPGFN\b)([\s\S]*)/i);
    if (!match) return;
    const section = clean(match[1]).slice(0, 700);
    const regular = /n[ãa]o foram detectadas pend[êe]ncias|nada consta|n[ãa]o h[áa] d[ée]bitos/i.test(section);
    const irregular = /inscri[çc][ãa]o em d[íi]vida ativa|pend[êe]ncia|d[ée]bito/i.test(section) && !regular;
    pgfn.push({ status: regular ? 'regular' : irregular ? 'irregular' : 'unknown', description: regular ? 'Nenhuma pendência identificada na seção PGFN.' : nullable(section), source: source(index + 1, 'PGFN') });
  });

  const occurrenceTypes = [
    omissions.length && 'omissao', debts.length && 'debitos', installments.length && 'parcelamento',
    suspensions.length && 'suspensa', pgfn.some(item => item.status === 'irregular') && 'divida_ativa',
  ].filter(Boolean) as string[];
  const agencies = [...new Set([
    ...debts.map(item => item.agency), ...installments.map(item => item.agency),
    ...suspensions.map(item => item.agency), ...pgfn.map(() => 'PGFN'),
  ].filter(Boolean) as string[])];
  const competencies = [...new Set([...omissions.flatMap(item => item.competencies), ...debts.map(item => item.competency).filter(Boolean) as string[]])].sort();
  const totalOccurrences = omissions.length + debts.length + installments.length + suspensions.length + pgfn.filter(item => item.status === 'irregular').length;
  return { omissions, debts, installments, suspensions, pgfn, occurrenceTypes, agencies, competencies, totalOccurrences };
}
