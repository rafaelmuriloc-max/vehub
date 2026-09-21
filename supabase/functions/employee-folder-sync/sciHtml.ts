// Leitura das fichas "REGISTRO DE COLABORADORES" exportadas em HTML pelo SCI Sistemas
// (FastReport). A interpretação é estrutural: os rótulos ficam em uma linha da tabela
// e os valores na linha seguinte, alinhados pela largura das colunas (colspan).
// Não há uso de IA.

export interface SciEmployee {
  full_name: string;
  cpf: string | null;
  position: string | null;
  admission_date: string | null;
  salary: number | null;
  termination_date: string | null;
  company_code: string | null;
  company_document: string | null;
  company_name: string | null;
  contract: string | null;
  payment_method: string | null;
  employee_code: string | null;
  is_partner: boolean;
}

export interface SciParseResult {
  employees: SciEmployee[];
  forms: number;
  incomplete: number;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordf: "ª", ordm: "º",
};

const DIACRITICS: Record<string, string> = {
  acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303",
  uml: "\u0308", ring: "\u030a", cedil: "\u0327",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(
      /&([a-zA-Z])(acute|grave|circ|tilde|uml|ring|cedil);/g,
      (_, letter, mark) => (letter + DIACRITICS[mark]).normalize("NFC"),
    )
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

function cleanCell(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
}

interface Cell { text: string; width: number }

function htmlToRows(html: string): Cell[][] {
  const body = stripNoise(html);
  const rows: Cell[][] = [];
  for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: Cell[] = [];
    for (const td of tr[1].matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      const span = td[1].match(/colspan\s*=\s*"?(\d+)"?/i);
      cells.push({ text: cleanCell(td[2]), width: span ? Number(span[1]) : 1 });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// Mantido para o caminho de leitura por IA (quando o HTML não é um relatório do SCI).
export function htmlToCells(html: string): string[] {
  const rows = htmlToRows(html);
  const cells: string[] = [];
  for (const row of rows) for (const c of row) if (c.text) cells.push(c.text);
  if (cells.length === 0) {
    for (const line of cleanCell(stripNoise(html)).split(/(?=[A-ZÁÉÍÓÚÃÕÇ]{3,})/)) {
      const t = line.trim();
      if (t) cells.push(t);
    }
  }
  return cells;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LABELS: Record<string, string[]> = {
  company_name: ["empregador", "razao social", "nome empresarial", "empresa"],
  company_document: ["cnpj", "cnpj cei", "cnpj cpf", "cgc"],
  company_code: ["codigo da empresa", "cod empresa", "codigo empresa"],
  full_name: [
    "nome do a trabalhador a", "nome do trabalhador", "nome da trabalhadora",
    "nome do a colaborador a", "nome do colaborador", "nome do funcionario",
    "nome do empregado", "colaborador", "funcionario", "nome",
  ],
  cpf: ["cpf", "c p f"],
  employee_code: ["codigo", "cod", "matricula", "registro"],
  contract: ["contrato", "tipo de contrato", "n contrato"],
  admission_date: ["data de admissao", "data admissao", "admissao", "dt admissao"],
  position: ["funcao", "cargo", "ocupacao"],
  salary: ["salario inicial", "salario base", "salario contratual", "salario"],
  payment_method: ["forma de pagamento", "forma pagamento"],
  termination_date: [
    "data rescisao", "data de rescisao", "rescisao", "demissao", "desligamento", "data de saida",
  ],
  category: ["categoria"],
};

const LABEL_INDEX = new Map<string, string>();
for (const [field, aliases] of Object.entries(LABELS)) {
  for (const alias of aliases) if (!LABEL_INDEX.has(alias)) LABEL_INDEX.set(alias, field);
}

function fieldOf(text: string): { field: string; inline: string | null } | null {
  const raw = text.trim();
  if (!raw) return null;
  const colon = raw.indexOf(":");
  const head = colon >= 0 ? raw.slice(0, colon) : raw;
  const inline = colon >= 0 ? raw.slice(colon + 1).trim() : "";
  const field = LABEL_INDEX.get(norm(head));
  return field ? { field, inline: inline || null } : null;
}

// A linha de valores costuma repetir as larguras da linha de rótulos, às vezes
// omitindo a primeira célula vazia. O casamento é feito por colspan, em ordem.
function alignRows(labels: Cell[], values: Cell[]): [string, string][] {
  const out: [string, string][] = [];
  let j = 0;
  for (const label of labels) {
    if (!label.text) continue;
    let k = j;
    while (k < values.length && values[k].width !== label.width) k++;
    if (k >= values.length) continue;
    out.push([label.text, values[k].text]);
    j = k + 1;
  }
  return out;
}

function parseDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseMoney(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/-?[\d.,]+/);
  if (!m) return null;
  const cleaned = m[0].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? n : null;
}

function digits(v: string | null | undefined, len: number): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length === len ? d : null;
}

const PARTNER_RE = /(socio|diretor|titular|proprietario|administrador)/i;

function isPartner(category: string | undefined, position: string | undefined): boolean {
  const cat = (category ?? "").trim();
  if (/^11\b/.test(cat) || /^(2[12]|13|15|16|17|18|19|21|22|23|24|25|26)\s*-\s*(socio|diretor|titular)/i.test(cat)) {
    return true;
  }
  return PARTNER_RE.test(norm(position ?? "").normalize("NFD"));
}

function parseForm(rows: Cell[][]): SciEmployee | null {
  const values: Record<string, string> = {};
  const setField = (field: string, value: string) => {
    if (!value) return;
    if (values[field] === undefined) values[field] = value;
  };

  for (let i = 0; i < rows.length; i++) {
    // Rótulo com valor na mesma célula ("CNPJ: 00.000.000/0001-00")
    for (const cell of rows[i]) {
      const hit = fieldOf(cell.text);
      if (hit?.inline) setField(hit.field, hit.inline);
    }
    const next = rows[i + 1];
    if (!next) continue;
    for (const [label, value] of alignRows(rows[i], next)) {
      const hit = fieldOf(label);
      if (hit && !hit.inline) setField(hit.field, value);
    }
  }

  const flat = rows.flat().map((c) => c.text).join(" ");
  if (!values.company_document) {
    const m = flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (m) values.company_document = m[0];
  }
  if (!values.cpf || !digits(values.cpf, 11)) {
    const m = flat.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (m) values.cpf = m[0];
  }

  const name = (values.full_name ?? "").trim();
  const cpf = digits(values.cpf, 11);
  if (!name && !cpf) return null;

  const position = (values.position ?? "").trim() || null;
  const partner = isPartner(values.category, position ?? undefined);
  const labelledPosition = position
    ? (partner && !PARTNER_RE.test(norm(position)) ? `${position} (sócio)` : position)
    : (partner ? "Sócio" : null);

  return {
    full_name: name,
    cpf,
    position: labelledPosition,
    admission_date: parseDate(values.admission_date),
    salary: parseMoney(values.salary),
    termination_date: parseDate(values.termination_date),
    company_code: values.company_code ?? null,
    company_document: digits(values.company_document, 14),
    company_name: values.company_name ?? null,
    contract: values.contract ?? null,
    payment_method: values.payment_method ?? null,
    employee_code: values.employee_code ?? null,
    is_partner: partner,
  };
}

export function looksLikeSciHtml(text: string): boolean {
  return /registro\s+de\s+colaborador/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

// Cada ficha começa na linha com o título REGISTRO DE COLABORADORES e termina
// na linha do próximo título.
export function parseSciHtml(html: string): SciParseResult {
  const rows = htmlToRows(html);
  const starts: number[] = [];
  rows.forEach((r, i) => {
    if (r.some((c) => norm(c.text).includes("registro de colaborador"))) starts.push(i);
  });
  if (starts.length === 0) return { employees: [], forms: 0, incomplete: 0 };

  const employees: SciEmployee[] = [];
  let incomplete = 0;
  for (let k = 0; k < starts.length; k++) {
    const slice = rows.slice(starts[k], starts[k + 1] ?? rows.length);
    const parsed = parseForm(slice);
    if (parsed) employees.push(parsed);
    else incomplete++;
  }
  return { employees, forms: starts.length, incomplete };
}
