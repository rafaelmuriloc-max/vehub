// Leitura do relatório "Previsão de Contrato de Experiência" exportado pelo SCI
// Sistemas (FastReport). Formato real: blocos por empresa, com cabeçalho
// "Empresa: 16 - RAZAO SOCIAL" + "CNPJ:00.000.000/0001-00" e uma grade:
//   Código | Colaborador | Data Adm. | Data Venc. | Prazo | Data Venc. | Prazo
// A interpretação é estrutural, sem IA.

import { type Cell, htmlToCells, htmlToRows, norm, parseDate } from "./sciHtml.ts";

export interface TrialEmployee {
  full_name: string;
  cpf: string | null;
  employee_code: string | null;
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
  // O texto vem com entidades (experi&ecirc;ncia): decodifica antes de comparar.
  const n = norm(htmlToCells(text.slice(0, 400_000)).join(" "));
  return n.includes("contrato de experiencia") ||
    (n.includes("previsao") && n.includes("experiencia")) ||
    n.includes("previsao contrato experiencia");
}

type Field =
  | "employee_code"
  | "full_name"
  | "cpf"
  | "admission_date"
  | "trial_end"
  | "trial_days";

const ALIASES: [Field, string[]][] = [
  ["employee_code", ["codigo", "cod", "matricula", "registro"]],
  ["full_name", [
    "colaborador", "nome do colaborador", "nome do a colaborador a", "trabalhador",
    "nome do trabalhador", "nome do a trabalhador a", "funcionario", "nome", "empregado",
  ]],
  ["cpf", ["cpf", "c p f"]],
  ["admission_date", ["data adm", "data adm.", "data de admissao", "data admissao", "admissao"]],
  ["trial_end", [
    "data venc", "data venc.", "vencimento", "data de vencimento", "data vencimento",
    "prazo 1", "1 prazo", "prazo 2", "2 prazo", "termino",
  ]],
  ["trial_days", ["prazo", "dias", "qtde dias", "qtd dias"]],
];

function fieldOf(label: string): Field | null {
  const n = norm(label);
  if (!n) return null;
  for (const [field, aliases] of ALIASES) {
    if (aliases.some((a) => norm(a) === n)) return field;
  }
  for (const [field, aliases] of ALIASES) {
    if (aliases.some((a) => norm(a).length >= 4 && n.includes(norm(a)))) return field;
  }
  return null;
}

interface Column { start: number; field: string }

// As colunas "Data Venc." / "Prazo" aparecem duas vezes: a primeira dupla é o
// 1º prazo, a segunda é o 2º.
function headerColumns(row: Cell[]): Column[] | null {
  const cols: Column[] = [];
  let start = 0;
  let ends = 0;
  let days = 0;
  let hasName = false;
  for (const c of row) {
    const f = fieldOf(c.text);
    if (f === "trial_end") {
      ends++;
      cols.push({ start, field: ends === 1 ? "trial_end_1" : "trial_end_2" });
    } else if (f === "trial_days") {
      days++;
      cols.push({ start, field: days === 1 ? "trial_days_1" : "trial_days_2" });
    } else if (f) {
      if (f === "full_name") hasName = true;
      cols.push({ start, field: f });
    }
    start += c.width;
  }
  return hasName && ends > 0 ? cols : null;
}

function valuesByColumn(cols: Column[], row: Cell[]): Record<string, string> {
  const out: Record<string, string> = {};
  let start = 0;
  for (const c of row) {
    const hit = cols.find((s) => s.start === start);
    if (hit && c.text && !out[hit.field]) out[hit.field] = c.text;
    start += c.width;
  }
  return out;
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

export function parseTrialHtml(html: string): TrialParseResult {
  const rows = htmlToRows(html);
  const employees: TrialEmployee[] = [];
  let seen = 0;
  let incomplete = 0;

  const ctx: { document: string | null; name: string | null; code: string | null } = {
    document: null,
    name: null,
    code: null,
  };
  let cols: Column[] | null = null;

  for (const row of rows) {
    const flat = row.map((c) => c.text).join(" ");

    // Cabeçalho da empresa: "Empresa: 16 - RAZAO SOCIAL" e "... CNPJ:00.000.000/0001-00"
    const emp = flat.match(/empresa\s*:\s*(\d{1,6})?\s*-?\s*(.*)$/i);
    const cnpj = flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (/empresa\s*:/i.test(flat)) {
      ctx.code = emp?.[1]?.trim() || null;
      // Remove o sufixo "Cidade/UF - CNPJ:..." que vem na mesma linha.
      ctx.name = (emp?.[2] ?? "")
        .replace(/\s*[-–]?\s*[^\s]*\s*\/\s*[A-Z]{2}\b.*$/, "")
        .replace(/\s*-?\s*cnpj\s*:?.*$/i, "")
        .trim() || null;
      ctx.document = cnpj ? cnpj[0] : null;
      cols = null;
      continue;
    }
    if (cnpj && !ctx.document) ctx.document = cnpj[0];

    const header = headerColumns(row);
    if (header) {
      cols = header;
      continue;
    }

    if (!cols) continue;
    if (/total de colaboradores/i.test(flat)) {
      cols = null;
      continue;
    }

    const v = valuesByColumn(cols, row);
    const name = (v.full_name ?? "").trim();
    if (!name) continue;
    seen++;

    const end1 = parseDate(v.trial_end_1);
    const end2 = parseDate(v.trial_end_2);
    if (!end1 && !end2) {
      incomplete++;
      continue;
    }

    employees.push({
      full_name: name,
      cpf: digits(v.cpf, 11),
      employee_code: (v.employee_code ?? "").trim() || null,
      admission_date: parseDate(v.admission_date),
      trial_end_1: end1,
      trial_days_1: parseDays(v.trial_days_1),
      trial_end_2: end2,
      trial_days_2: parseDays(v.trial_days_2),
      company_document: digits(ctx.document, 14),
      company_name: ctx.name,
      company_code: ctx.code,
    });
  }

  return { employees, rows: seen, incomplete };
}
