// Leitura do relatório "Previsão contrato de experiência" exportado pelo SCI Sistemas.
// O relatório pode vir em dois formatos: grade (uma linha por funcionário, com
// cabeçalho de colunas) ou ficha (rótulo numa linha, valor na linha seguinte).
// A interpretação é estrutural, sem IA.

import { alignRows, type Cell, htmlToRows, norm, parseDate } from "./sciHtml.ts";

export interface TrialEmployee {
  full_name: string;
  cpf: string | null;
  admission_date: string | null;
  trial_end_1: string | null;
  trial_days_1: number | null;
  trial_end_2: string | null;
  trial_days_2: number | null;
  company_document: string | null;
  company_name: string | null;
  company_code: string | null;
}

export interface TrialParseResult {
  employees: TrialEmployee[];
  rows: number;
  incomplete: number;
}

export function looksLikeTrialHtml(text: string): boolean {
  const n = norm(text.slice(0, 200_000));
  return n.includes("contrato de experiencia") || n.includes("previsao de experiencia") ||
    (n.includes("previsao") && n.includes("experiencia"));
}

const FIELD_ALIASES: [string, string[]][] = [
  ["company_document", ["cnpj", "cnpj cei", "cgc"]],
  ["company_code", ["codigo da empresa", "cod empresa", "codigo empresa", "empresa codigo"]],
  ["company_name", ["empregador", "razao social", "nome empresarial", "empresa"]],
  ["full_name", [
    "nome do a trabalhador a", "nome do trabalhador", "nome da trabalhadora",
    "nome do a colaborador a", "nome do colaborador", "nome do funcionario",
    "nome do empregado", "colaborador", "funcionario", "trabalhador", "nome",
  ]],
  ["cpf", ["cpf"]],
  ["admission_date", ["data de admissao", "data admissao", "admissao", "dt admissao"]],
  ["trial_end_1", [
    "1 prazo", "1o prazo", "primeiro prazo", "prazo 1", "vencimento 1", "1 vencimento",
    "termino 1", "1 termino", "vencimento do 1 prazo", "termino do 1 prazo",
    "fim 1 periodo", "1 periodo",
  ]],
  ["trial_end_2", [
    "2 prazo", "2o prazo", "segundo prazo", "prazo 2", "vencimento 2", "2 vencimento",
    "termino 2", "2 termino", "vencimento do 2 prazo", "termino do 2 prazo",
    "prorrogacao", "fim 2 periodo", "2 periodo",
  ]],
  ["days", ["dias", "qtde dias", "qtd dias", "n dias", "dias experiencia"]],
];

function fieldOf(label: string): string | null {
  const n = norm(label);
  if (!n) return null;
  for (const [field, aliases] of FIELD_ALIASES) {
    if (aliases.includes(n)) return field;
  }
  for (const [field, aliases] of FIELD_ALIASES) {
    if (aliases.some((a) => a.length >= 4 && n.includes(a))) return field;
  }
  return null;
}

function digits(v: string | null | undefined, len: number): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length === len ? d : null;
}

function parseDays(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/\d{1,3}/);
  if (!m) return null;
  const n = Number(m[0]);
  return isFinite(n) && n > 0 && n <= 365 ? n : null;
}

interface Slot { start: number; field: string; label: string }

function slots(row: Cell[]): Slot[] {
  const out: Slot[] = [];
  let start = 0;
  for (const c of row) {
    const field = fieldOf(c.text);
    if (field) out.push({ start, field, label: c.text });
    start += c.width;
  }
  return out;
}

// A coluna "Dias" pertence ao prazo imediatamente à esquerda.
function resolveDays(cols: Slot[]): Slot[] {
  let lastTrial: string | null = null;
  return cols.map((c) => {
    if (c.field === "trial_end_1" || c.field === "trial_end_2") {
      lastTrial = c.field === "trial_end_1" ? "trial_days_1" : "trial_days_2";
      return c;
    }
    if (c.field === "days") {
      const field = lastTrial ?? "trial_days_1";
      lastTrial = field === "trial_days_1" ? "trial_days_2" : null;
      return { ...c, field };
    }
    return c;
  });
}

function valuesByColumn(cols: Slot[], row: Cell[]): Record<string, string> {
  const out: Record<string, string> = {};
  let start = 0;
  for (const c of row) {
    const hit = cols.find((s) => Math.abs(s.start - start) <= 1);
    if (hit && c.text && !out[hit.field]) out[hit.field] = c.text;
    start += c.width;
  }
  return out;
}

function build(v: Record<string, string>, ctx: Record<string, string>): TrialEmployee | null {
  const name = (v.full_name ?? "").trim();
  const cpf = digits(v.cpf, 11);
  if (!name && !cpf) return null;
  const end1 = parseDate(v.trial_end_1);
  const end2 = parseDate(v.trial_end_2);
  if (!end1 && !end2) return null;
  return {
    full_name: name,
    cpf,
    admission_date: parseDate(v.admission_date),
    trial_end_1: end1,
    trial_days_1: parseDays(v.trial_days_1),
    trial_end_2: end2,
    trial_days_2: parseDays(v.trial_days_2),
    company_document: digits(v.company_document ?? ctx.company_document, 14),
    company_name: (v.company_name ?? ctx.company_name ?? "").trim() || null,
    company_code: (v.company_code ?? ctx.company_code ?? "").trim() || null,
  };
}

export function parseTrialHtml(html: string): TrialParseResult {
  const rows = htmlToRows(html);
  const employees: TrialEmployee[] = [];
  let seen = 0;
  let incomplete = 0;

  // Empresa corrente: o relatório é agrupado por empresa, com o CNPJ num cabeçalho.
  const ctx: Record<string, string> = {};
  let cols: Slot[] | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const flat = row.map((c) => c.text).join(" ");

    const cnpj = flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpj) {
      ctx.company_document = cnpj[0];
      const nameCell = row
        .map((c) => c.text)
        .filter((t) => t && !/\d{2}\.\d{3}\.\d{3}\//.test(t) && norm(t).length >= 6)
        .sort((a, b) => b.length - a.length)[0];
      if (nameCell && !fieldOf(nameCell)) ctx.company_name = nameCell;
      const code = flat.match(/c[oó]d(?:igo)?\.?\s*:?\s*(\d{1,6})/i);
      if (code) ctx.company_code = code[1];
    }

    const s = slots(row);
    const hasName = s.some((x) => x.field === "full_name");
    const hasTrial = s.some((x) => x.field === "trial_end_1" || x.field === "trial_end_2");

    // Cabeçalho de grade: nome + prazo na mesma linha de rótulos
    if (hasName && hasTrial) {
      cols = resolveDays(s);
      // Formato ficha: valores na linha seguinte, casados por colspan
      const next = rows[i + 1];
      if (next) {
        const pairs = alignRows(row, next);
        const v: Record<string, string> = {};
        const mapped = resolveDays(row.map((c, idx) => ({ start: idx, field: fieldOf(c.text) ?? "", label: c.text })).filter((x) => x.field));
        let p = 0;
        for (const [label, value] of pairs) {
          const field = mapped[p]?.label === label ? mapped[p].field : fieldOf(label);
          if (mapped[p]?.label === label) p++;
          if (field && value && !v[field]) v[field] = value;
        }
        const emp = build(v, ctx);
        if (emp) {
          employees.push(emp);
          seen++;
          i++;
          continue;
        }
      }
      continue;
    }

    // Linhas de dados da grade
    if (cols) {
      const v = valuesByColumn(cols, row);
      const hasAny = v.full_name || v.cpf;
      if (!hasAny) continue;
      seen++;
      const emp = build(v, ctx);
      if (emp) employees.push(emp);
      else incomplete++;
    }
  }

  return { employees, rows: seen, incomplete };
}
