// Leitura do relatório "Espelho e resumo da folha mensal" (SCI / FastReport).
// Para cada empresa guarda apenas o bloco "RESUMO GERAL". Sem IA.
import { htmlToCells, norm } from "./sciHtml.ts";

export interface PayrollSummary {
  company_document: string | null;
  company_code: string | null;
  company_name: string | null;
  competence: string; // yyyy-MM-01
  qty_total: number; qty_employees: number; qty_employers: number;
  qty_autonomous: number; qty_interns: number;
  gross: number; discounts: number; net: number;
  inss_base: number; inss_value: number;
  fgts_base: number; fgts_value: number;
  irrf_base: number;
  active_count: number; admitted_count: number; dismissed_count: number;
  employees: PayrollEmployee[];
}

export interface PayrollEmployee { code: string; name: string; admission_date: string | null; base_salary: number }

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7,
  agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export function looksLikePayrollHtml(text: string): boolean {
  const n = norm(htmlToCells(text.slice(0, 200_000)).join(" "));
  return n.includes("resumo da folha") || (n.includes("espelho") && n.includes("resumo geral"));
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const m = s.replace(/\s/g, "").match(/-?[\d.]+(,\d+)?/);
  if (!m) return 0;
  const v = Number(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const isNum = (s: string) => /^-?[\d.]+(,\d+)?$/.test(s.trim());

export function parsePayrollHtml(html: string): { competence: string | null; summaries: PayrollSummary[] } {
  const cells = htmlToCells(html).map((c) => c.replace(/\u00a0/g, " ").trim()).filter(Boolean);
  let competence: string | null = null;
  for (const c of cells.slice(0, 50)) {
    const m = norm(c).match(/referente ao mes de ([a-z]+)\s*\/?\s*(\d{4})/);
    if (m && MONTHS[m[1]]) { competence = `${m[2]}-${String(MONTHS[m[1]]).padStart(2, "0")}-01`; break; }
  }
  if (!competence) return { competence: null, summaries: [] };

  const out: PayrollSummary[] = [];
  let doc: string | null = null, code: string | null = null, name: string | null = null;
  let emps: PayrollEmployee[] = [];

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const emp = c.match(/^Empresa:\s*(\d+)\s*-\s*(.+)$/i);
    if (emp) { code = emp[1]; name = emp[2].trim(); doc = null; emps = []; continue; }
    const adm = c.match(/Admiss\S*o em\s*(\d{2})\/(\d{2})\/(\d{4}).*?Sal\S*rio base\s*([\d.,]+)/i);
    if (adm && /^\d+$/.test(cells[i - 4] ?? "") && cells[i - 3]) {
      const ec = cells[i - 4], en = cells[i - 3];
      if (!emps.some((e) => e.code === ec)) emps.push({ code: ec, name: en, admission_date: `${adm[3]}-${adm[2]}-${adm[1]}`, base_salary: num(adm[4]) });
      continue;
    }
    const cn = c.match(/CNPJ:\s*([\d./-]{14,18})/i);
    if (cn) { doc = cn[1]; continue; }
    if (c !== "RESUMO GERAL") continue;

    // Rótulo seguido de 5 números (total, colaboradores, empregadores, autônomos, estagiários)
    const rows: Record<string, number[]> = {};
    const flags: Record<string, number> = {};
    let gps = 0;
    let j = i + 1;
    for (; j < cells.length && j < i + 400; j++) {
      const x = cells[j];
      if (/^Empresa:/i.test(x) || x === "RESUMO GERAL") break;
      const f = x.match(/^(Ativos|Admitidos|Demitidos):\s*(\d+)/i);
      if (f) { flags[norm(f[1])] = Number(f[2]); continue; }
      const g = x.match(/^([\d.,]+)\s*\(Bruto\)/);
      if (g && cells[j - 1]?.startsWith("GPS - >")) { gps = num(g[1]); break; }
      if (!isNum(x) && isNum(cells[j + 1] ?? "") && !rows[norm(x)]) {
        const vals: number[] = [];
        let k = j + 1;
        while (vals.length < 5 && isNum(cells[k] ?? "")) vals.push(num(cells[k++]));
        if (vals.length === 5) { rows[norm(x)] = vals; j = k - 1; }
      }
    }
    i = j - 1;
    const r = (k: string) => rows[k] ?? [0, 0, 0, 0, 0];
    const q = r("quantidade");
    out.push({
      company_document: doc, company_code: code, company_name: name, competence,
      qty_total: q[0], qty_employees: q[1], qty_employers: q[2], qty_autonomous: q[3], qty_interns: q[4],
      gross: r("proventos")[0], discounts: r("descontos")[0], net: r("liquido")[0],
      inss_base: r("base inss")[0], inss_value: gps,
      fgts_base: (rows["base gfd mensal 8"] ?? rows["base fgts"] ?? [0])[0],
      fgts_value: (rows["valor gfd mensal 8"] ?? rows["valor fgts"] ?? [0])[0],
      irrf_base: r("base irrf")[0],
      active_count: flags["ativos"] ?? 0, admitted_count: flags["admitidos"] ?? 0, dismissed_count: flags["demitidos"] ?? 0,
      employees: emps,
    });
    emps = [];
  }
  return { competence, summaries: out };
}
