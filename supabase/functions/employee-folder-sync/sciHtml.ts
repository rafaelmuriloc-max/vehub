// Leitura das fichas "REGISTRO DE COLABORADORES" exportadas em HTML pelo SCI Sistemas.
// A interpretação é estrutural (tabelas/células + rótulos), sem uso de IA.

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

export function htmlToCells(html: string): string[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const cells: string[] = [];
  for (const m of body.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
    cells.push(cleanCell(m[1]));
  }
  if (cells.length === 0) {
    // Documento sem tabelas: usa as linhas visíveis como "células".
    for (const line of cleanCell(body).split(/(?=[A-ZÁÉÍÓÚÃÕÇ]{3,})/)) {
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
  company_name: ["razao social", "empregador", "nome empresarial", "empresa"],
  company_document: ["cnpj", "cnpj cei", "cnpj cpf", "cgc"],
  company_code: ["codigo da empresa", "cod empresa", "codigo empresa", "empresa codigo"],
  full_name: ["nome do colaborador", "nome do funcionario", "nome do empregado", "colaborador", "funcionario", "trabalhador", "nome"],
  cpf: ["cpf", "c p f"],
  employee_code: ["codigo", "cod", "matricula", "registro"],
  contract: ["contrato", "tipo de contrato", "n contrato"],
  admission_date: ["data de admissao", "data admissao", "admissao", "dt admissao"],
  position: ["funcao", "cargo", "ocupacao"],
  salary: ["salario inicial", "salario base", "salario contratual", "salario"],
  payment_method: ["forma de pagamento", "forma pagamento", "pagamento"],
  termination_date: ["data de rescisao", "data rescisao", "rescisao", "demissao", "desligamento", "data de saida"],
};

const ALL_LABELS = Object.values(LABELS).flat();

function isLabel(text: string): boolean {
  const n = norm(text);
  return ALL_LABELS.includes(n);
}

function matchField(text: string): { field: string; inline: string | null } | null {
  const raw = text.trim();
  const colon = raw.indexOf(":");
  const head = colon >= 0 ? raw.slice(0, colon) : raw;
  const inline = colon >= 0 ? raw.slice(colon + 1).trim() : null;
  const n = norm(head);
  if (!n) return null;
  for (const [field, labels] of Object.entries(LABELS)) {
    if (labels.includes(n)) return { field, inline: inline || null };
  }
  return null;
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseMoney(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/-?[\d.,]+/);
  if (!m) return null;
  const cleaned = m[0].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : null;
}

function digits(v: string | null, len: number): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length === len ? d : null;
}

function parseForm(cells: string[]): SciEmployee | null {
  const values: Record<string, string> = {};
  for (let i = 0; i < cells.length; i++) {
    const hit = matchField(cells[i]);
    if (!hit) continue;
    let value = hit.inline;
    if (!value) {
      for (let j = i + 1; j < Math.min(i + 4, cells.length); j++) {
        const next = cells[j];
        if (!next || isLabel(next) || matchField(next)) continue;
        value = next;
        break;
      }
    }
    if (!value) continue;
    if (values[hit.field] === undefined) values[hit.field] = value;
  }

  // CNPJ/CPF também são reconhecidos pelo formato, caso o rótulo falte.
  if (!values.company_document) {
    const m = cells.join(" ").match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (m) values.company_document = m[0];
  }
  if (!values.cpf) {
    const m = cells.join(" ").match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (m) values.cpf = m[0];
  }

  const name = (values.full_name ?? "").trim();
  const cpf = digits(values.cpf ?? null, 11);
  if (!name && !cpf) return null;

  return {
    full_name: name,
    cpf,
    position: values.position ?? null,
    admission_date: parseDate(values.admission_date ?? null),
    salary: parseMoney(values.salary ?? null),
    termination_date: parseDate(values.termination_date ?? null),
    company_code: values.company_code ?? null,
    company_document: digits(values.company_document ?? null, 14),
    company_name: values.company_name ?? null,
    contract: values.contract ?? null,
    payment_method: values.payment_method ?? null,
    employee_code: values.employee_code ?? null,
  };
}

export function looksLikeSciHtml(text: string): boolean {
  return /registro\s+de\s+colaborador/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

// Cada ficha começa no título REGISTRO DE COLABORADORES. Os dados de empregador
// e trabalhador ficam entre um título e o próximo.
export function parseSciHtml(html: string): SciParseResult {
  const cells = htmlToCells(html);
  const starts: number[] = [];
  cells.forEach((c, i) => {
    const n = norm(c);
    if (n.includes("registro de colaborador")) starts.push(i);
  });
  if (starts.length === 0) return { employees: [], forms: 0, incomplete: 0 };

  const employees: SciEmployee[] = [];
  let incomplete = 0;
  for (let k = 0; k < starts.length; k++) {
    const slice = cells.slice(starts[k], starts[k + 1] ?? cells.length);
    const parsed = parseForm(slice);
    if (parsed) employees.push(parsed);
    else incomplete++;
  }
  return { employees, forms: starts.length, incomplete };
}
