// Leitura do relatório "Acompanhamento de vencimento de férias" exportado pelo
// SCI Sistemas (FastReport). Blocos por empresa, com cabeçalho
// "Empresa: 195 - RAZAO SOCIAL" + "CNPJ:00.000.000/0001-00" e a grade:
//   Cod. | Nome do colaborador | Dias de direito | Referente Período Aquisitivo |
//   Deverá gozar as férias entre o período | Prazo final p/ iniciar as férias sem gerar dobro
// A interpretação é estrutural, sem IA.

import { type Cell, htmlToCells, htmlToRows, norm, parseDate } from "./sciHtml.ts";

export interface VacationPeriod {
  employee_code: string | null;
  full_name: string;
  days_right: number | null;
  acquisition_start: string | null;
  acquisition_end: string | null;
  enjoy_start: string | null;
  enjoy_end: string | null;
  deadline_date: string | null;
  company_document: string | null;
  company_name: string | null;
  company_code: string | null;
}

export interface VacationParseResult {
  periods: VacationPeriod[];
  rows: number;
  incomplete: number;
}

export function looksLikeVacationHtml(text: string): boolean {
  const n = norm(htmlToCells(text.slice(0, 400_000)).join(" "));
  return n.includes("vencimento de ferias") ||
    (n.includes("acompanhamento") && n.includes("ferias"));
}

type Field =
  | "employee_code"
  | "full_name"
  | "days_right"
  | "acquisition"
  | "enjoy"
  | "deadline";

const ALIASES: [Field, string[]][] = [
  ["days_right", ["dias de direito", "dias direito"]],
  ["acquisition", ["referente periodo aquisitivo", "periodo aquisitivo", "aquisitivo"]],
  ["enjoy", ["devera gozar as ferias entre o periodo", "devera gozar", "gozar as ferias"]],
  ["deadline", ["prazo final p iniciar as ferias sem gerar dobro", "prazo final"]],
  ["employee_code", ["cod", "cod.", "codigo", "matricula", "registro"]],
  ["full_name", ["nome do colaborador", "colaborador", "nome do trabalhador", "nome"]],
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

interface Column { start: number; field: Field }

function headerColumns(row: Cell[]): Column[] | null {
  const cols: Column[] = [];
  let start = 0;
  let hasName = false;
  let hasAcq = false;
  for (const c of row) {
    const f = fieldOf(c.text);
    if (f) {
      if (f === "full_name") hasName = true;
      if (f === "acquisition") hasAcq = true;
      cols.push({ start, field: f });
    }
    start += c.width;
  }
  return hasName && hasAcq ? cols : null;
}

function valuesByColumn(cols: Column[], row: Cell[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  let start = 0;
  for (const c of row) {
    const hit = cols.find((s) => s.start === start);
    if (hit && c.text && !out[hit.field]) out[hit.field] = c.text;
    start += c.width;
  }
  return out;
}

function parseRange(v: string | null | undefined): [string | null, string | null] {
  if (!v) return [null, null];
  const dates = v.match(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/g) ?? [];
  return [parseDate(dates[0]), parseDate(dates[1])];
}

function parseDays(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/\s/g, "").match(/^-?\d{1,3}(?:[.,]\d{1,2})?$/);
  if (!m) return null;
  const n = Number(m[0].replace(".", "").replace(",", "."));
  return isFinite(n) ? n : null;
}

function digits(v: string | null | undefined, len: number): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length === len ? d : null;
}

export function parseVacationHtml(html: string): VacationParseResult {
  const rows = htmlToRows(html);
  const periods: VacationPeriod[] = [];
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

    const emp = flat.match(/empresa\s*:\s*(\d{1,6})?\s*-?\s*(.*)$/i);
    const cnpj = flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (/empresa\s*:/i.test(flat)) {
      ctx.code = emp?.[1]?.trim() || null;
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

    const v = valuesByColumn(cols, row);
    const name = (v.full_name ?? "").trim();
    if (!name) continue;
    seen++;

    const [acqStart, acqEnd] = parseRange(v.acquisition);
    const [enjoyStart, enjoyEnd] = parseRange(v.enjoy);
    if (!acqStart) {
      incomplete++;
      continue;
    }

    periods.push({
      employee_code: (v.employee_code ?? "").trim() || null,
      full_name: name,
      days_right: parseDays(v.days_right),
      acquisition_start: acqStart,
      acquisition_end: acqEnd,
      enjoy_start: enjoyStart,
      enjoy_end: enjoyEnd,
      deadline_date: parseDate((v.deadline ?? "").match(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/)?.[0]),
      company_document: digits(ctx.document, 14),
      company_name: ctx.name,
      company_code: ctx.code,
    });
  }

  return { periods, rows: seen, incomplete };
}
