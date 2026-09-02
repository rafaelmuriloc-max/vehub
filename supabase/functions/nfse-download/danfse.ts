// Gerador do DANFSe v2.0 (Documento Auxiliar da NFS-e) a partir do XML oficial
// do padrão nacional (http://www.sped.fazenda.gov.br/nfse).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

// ---------- XML helpers ----------

export function node(xml: string, name: string): string | null {
  const open = new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?(/)?>`, "i");
  const m = open.exec(xml);
  if (!m) return null;
  if (m[1]) return "";
  const startBody = m.index + m[0].length;
  const scanner = new RegExp(
    `<(/)?(?:\\w+:)?${name}(?:\\s[^>]*)?(/)?>`,
    "gi",
  );
  scanner.lastIndex = startBody;
  let depth = 1;
  let hit: RegExpExecArray | null;
  while ((hit = scanner.exec(xml)) !== null) {
    if (hit[2]) continue; // self closing
    depth += hit[1] ? -1 : 1;
    if (depth === 0) return xml.slice(startBody, hit.index);
  }
  return null;
}

export function nodeAt(xml: string | null, path: string[]): string | null {
  let current = xml;
  for (const name of path) {
    if (current === null) return null;
    current = node(current, name);
  }
  return current;
}

export function text(xml: string | null, path: string[]): string {
  const found = nodeAt(xml, path);
  if (found === null) return "";
  return decodeXml(found.replace(/<[^>]*>/g, "").trim());
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------- formatters ----------

const DASH = "-";

function orDash(value: string): string {
  return value && value.trim() ? value.trim() : DASH;
}

function money(value: string): string {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || !value) return DASH;
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: string): string {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || !value) return DASH;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

function docNumber(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return orDash(value);
}

function cep(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 8) return DASH;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2-$3");
}

function ibge(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 7) return orDash(value);
  return `${digits.slice(0, 2)}.${digits.slice(2)}`;
}

function phone(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return orDash(value);
}

function dateBr(value: string): string {
  if (!value) return DASH;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function dateTimeBr(value: string): string {
  if (!value) return DASH;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : value;
}

// ---------- IBGE municipality names ----------

const municipioCache = new Map<string, string>();

async function municipio(code: string): Promise<string> {
  const digits = (code || "").replace(/\D/g, "");
  if (digits.length !== 7) return "";
  if (municipioCache.has(digits)) return municipioCache.get(digits)!;
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${digits}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return "";
    const data = await res.json();
    const name = typeof data?.nome === "string" ? data.nome : "";
    const uf = data?.microrregiao?.mesorregiao?.UF?.sigla ??
      data?.regiaoImediata?.regiaoIntermediaria?.UF?.sigla ?? "";
    const label = name ? (uf ? `${name} / ${uf}` : name) : "";
    if (label) municipioCache.set(digits, label);
    return label;
  } catch {
    return "";
  }
}

// ---------- layout primitives ----------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LABEL_SIZE = 5.5;
const VALUE_SIZE = 7;
const LINE = rgb(0, 0, 0);
const GREY = rgb(0.93, 0.93, 0.93);

type Cell = { label?: string; value?: string; bold?: boolean; span?: number };

class Danfse {
  doc!: PDFDocument;
  page!: PDFPage;
  regular!: PDFFont;
  bold!: PDFFont;
  y = 0;

  async init() {
    this.doc = await PDFDocument.create();
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 20) this.newPage();
  }

  sanitize(value: string): string {
    return (value ?? "")
      .normalize("NFC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x20-\xFF]/g, "");
  }

  width(value: string, size: number, bold: boolean) {
    const font = bold ? this.bold : this.regular;
    return font.widthOfTextAtSize(this.sanitize(value), size);
  }

  clip(value: string, maxWidth: number, size: number, bold = false): string {
    let out = this.sanitize(value);
    if (this.width(out, size, bold) <= maxWidth) return out;
    while (out.length > 1 && this.width(`${out}...`, size, bold) > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}...`;
  }

  wrap(value: string, maxWidth: number, size: number, bold = false): string[] {
    const paragraphs = this.sanitize(value).split(/\r?\n|\|/);
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (this.width(candidate, size, bold) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  draw(
    value: string,
    x: number,
    y: number,
    size: number,
    bold = false,
  ) {
    this.page.drawText(this.sanitize(value), {
      x,
      y,
      size,
      font: bold ? this.bold : this.regular,
      color: LINE,
    });
  }

  hline(y: number, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
    this.page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.5,
      color: LINE,
    });
  }

  vline(x: number, y1: number, y2: number) {
    this.page.drawLine({
      start: { x, y: y1 },
      end: { x, y: y2 },
      thickness: 0.5,
      color: LINE,
    });
  }

  // Linha de células com rótulo pequeno em cima e valor abaixo
  row(cells: Cell[], options: { shaded?: boolean } = {}) {
    const height = 17;
    this.ensure(height);
    const top = this.y;
    const bottom = top - height;
    if (options.shaded) {
      this.page.drawRectangle({
        x: MARGIN,
        y: bottom,
        width: CONTENT_W,
        height,
        color: GREY,
      });
    }
    const totalSpan = cells.reduce((s, c) => s + (c.span ?? 1), 0);
    const unit = CONTENT_W / totalSpan;
    let x = MARGIN;
    for (const cell of cells) {
      const cellWidth = unit * (cell.span ?? 1);
      const inner = cellWidth - 6;
      if (cell.label) {
        this.draw(
          this.clip(cell.label, inner, LABEL_SIZE, true),
          x + 3,
          top - 6,
          LABEL_SIZE,
          true,
        );
      }
      if (cell.value !== undefined) {
        this.draw(
          this.clip(cell.value, inner, VALUE_SIZE, cell.bold),
          x + 3,
          top - 14,
          VALUE_SIZE,
          cell.bold,
        );
      }
      if (x > MARGIN) this.vline(x, top, bottom);
      x += cellWidth;
    }
    this.page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: CONTENT_W,
      height,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    this.y = bottom;
  }

  banner(label: string) {
    const height = 11;
    this.ensure(height);
    const top = this.y;
    const bottom = top - height;
    const w = this.width(label, LABEL_SIZE + 0.5, true);
    this.draw(
      label,
      MARGIN + (CONTENT_W - w) / 2,
      top - 8,
      LABEL_SIZE + 0.5,
      true,
    );
    this.page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: CONTENT_W,
      height,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    this.y = bottom;
  }

  textBlock(lines: string[], size = VALUE_SIZE, padding = 4) {
    const height = Math.max(14, lines.length * (size + 2) + padding * 2 - 4);
    this.ensure(height);
    const top = this.y;
    const bottom = top - height;
    let cursor = top - padding - size + 1;
    for (const line of lines) {
      this.draw(line, MARGIN + 3, cursor, size);
      cursor -= size + 2;
    }
    this.page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: CONTENT_W,
      height,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    this.y = bottom;
  }

  async qrcode(content: string, x: number, y: number, size: number) {
    try {
      const qr = QRCode.create(content, { errorCorrectionLevel: "M" });
      const count: number = qr.modules.size;
      const data: { get(i: number): number } | Uint8Array = qr.modules.data;
      const module = size / count;
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          const dark = (data as Uint8Array)[row * count + col];
          if (!dark) continue;
          this.page.drawRectangle({
            x: x + col * module,
            y: y + size - (row + 1) * module,
            width: module,
            height: module,
            color: LINE,
          });
        }
      }
    } catch (err) {
      console.error("[danfse] QR falhou:", (err as Error).message);
    }
  }
}

// ---------- DANFSe ----------

export async function createDanfsePdf(
  xml: string,
  accessKey: string,
): Promise<Uint8Array> {
  const d = new Danfse();
  await d.init();

  const infNFSe = node(xml, "infNFSe") ?? xml;
  const dps = nodeAt(infNFSe, ["DPS", "infDPS"]) ?? "";
  const emit = node(infNFSe, "emit") ?? "";
  const enderEmit = node(emit, "enderNac") ?? node(emit, "ender") ?? "";
  const prest = node(dps, "prest") ?? "";
  const toma = node(dps, "toma") ?? "";
  const enderToma = nodeAt(toma, ["end"]) ?? "";
  const enderTomaNac = node(enderToma, "endNac") ?? "";
  const serv = node(dps, "serv") ?? "";
  const cServ = node(serv, "cServ") ?? "";
  const valoresNfse = node(infNFSe, "valores") ?? "";
  const valoresDps = node(dps, "valores") ?? "";
  const tribMun = nodeAt(valoresDps, ["trib", "tribMun"]) ?? "";
  const tribFed = nodeAt(valoresDps, ["trib", "tribFed"]) ?? "";
  const totTrib = nodeAt(valoresDps, ["trib", "totTrib", "vTotTrib"]) ?? "";
  const ibsCbs = node(infNFSe, "IBSCBS") ?? "";
  const ibsValores = node(ibsCbs, "valores") ?? "";
  const totCIBS = node(ibsCbs, "totCIBS") ?? "";
  const ibsCbsDps = node(dps, "IBSCBS") ?? "";

  const municipioEmi = text(infNFSe, ["xLocEmi"]) ||
    (await municipio(text(enderEmit, ["cMun"])));
  const ufEmit = text(enderEmit, ["UF"]);
  const municipioEmitFull = municipioEmi.includes("/")
    ? municipioEmi
    : `${orDash(municipioEmi)}${ufEmit ? ` / ${ufEmit}` : ""}`;

  const cMunToma = text(enderTomaNac, ["cMun"]) || text(enderToma, ["cMun"]);
  const municipioToma = (await municipio(cMunToma)) ||
    text(enderToma, ["xMun"]);

  const localPrestacao = text(infNFSe, ["xLocPrestacao"]) ||
    (await municipio(text(serv, ["locPrest", "cLocPrestacao"])));
  const localIncidencia = text(infNFSe, ["xLocIncid"]) ||
    text(ibsCbs, ["xLocalidadeIncid"]);

  // ===== Cabeçalho =====
  const headerTop = d.y;
  d.draw("NFS", MARGIN + 4, headerTop - 16, 17, true);
  d.draw("e", MARGIN + 32, headerTop - 16, 17, true);
  d.draw("Nota Fiscal de", MARGIN + 44, headerTop - 10, 5.5, true);
  d.draw("Serviço eletrônica", MARGIN + 44, headerTop - 17, 5.5, true);

  const centerText = (value: string, size: number, offset: number) => {
    const w = d.width(value, size, true);
    d.draw(value, MARGIN + (CONTENT_W - w) / 2, headerTop - offset, size, true);
  };
  centerText("DANFSe v2.0", 9, 12);
  centerText("Documento Auxiliar da NFS-e", 8, 23);

  const rightX = MARGIN + CONTENT_W * 0.72;
  d.draw(`Município: ${orDash(municipioEmitFull)}`, rightX, headerTop - 10, 6.5);
  d.draw(
    `Ambiente Gerador: ${orDash(text(infNFSe, ["ambGer"]))}`,
    rightX,
    headerTop - 18,
    5.5,
  );
  d.draw(
    `Tipo de Ambiente: ${orDash(text(dps, ["tpAmb"]))}`,
    rightX,
    headerTop - 25,
    5.5,
  );
  d.y = headerTop - 32;
  d.hline(d.y);

  // ===== Chave / identificação + QR =====
  const blockTop = d.y;
  const qrSize = 62;
  const qrX = PAGE_W - MARGIN - qrSize - 12;
  await d.qrcode(
    `https://www.nfse.gov.br/consultapublica/?tpc=1&chave=${accessKey}`,
    qrX,
    blockTop - qrSize - 6,
    qrSize,
  );
  const noteLines = [
    "A autenticidade desta NFS-e pode ser verificada",
    "pela leitura deste código QR ou pela consulta da",
    "chave de acesso no portal nacional da NFS-e",
  ];
  let noteY = blockTop - qrSize - 16;
  for (const line of noteLines) {
    d.draw(line, qrX - 22, noteY, 5.2);
    noteY -= 7;
  }

  const idColumns = CONTENT_W * 0.72;
  const idUnit = idColumns / 3;
  const idRow = (cells: Cell[]) => {
    const height = 17;
    const top = d.y;
    let x = MARGIN;
    for (const cell of cells) {
      const cellWidth = idUnit * (cell.span ?? 1);
      if (cell.label) {
        d.draw(
          d.clip(cell.label, cellWidth - 6, LABEL_SIZE, true),
          x + 3,
          top - 6,
          LABEL_SIZE,
          true,
        );
      }
      if (cell.value !== undefined) {
        d.draw(
          d.clip(cell.value, cellWidth - 6, VALUE_SIZE),
          x + 3,
          top - 14,
          VALUE_SIZE,
        );
      }
      x += cellWidth;
    }
    d.y = top - height;
  };

  idRow([{ label: "CHAVE DE ACESSO DA NFS-e", value: accessKey, span: 3 }]);
  idRow([
    { label: "NÚMERO DA NFS-e", value: orDash(text(infNFSe, ["nNFSe"])) },
    {
      label: "COMPETÊNCIA DA NFS-e",
      value: dateBr(text(dps, ["dCompet"])),
    },
    {
      label: "DATA E HORA DA EMISSÃO DA NFS-e",
      value: dateTimeBr(text(infNFSe, ["dhProc"])),
    },
  ]);
  idRow([
    { label: "NÚMERO DA DPS", value: orDash(text(dps, ["nDPS"])) },
    { label: "SÉRIE DA DPS", value: orDash(text(dps, ["serie"])) },
    {
      label: "DATA E HORA DA EMISSÃO DA DPS",
      value: dateTimeBr(text(dps, ["dhEmi"])),
    },
  ]);
  idRow([
    {
      label: "EMITENTE DA NFS-e",
      value: text(dps, ["tpEmit"]) === "1"
        ? "Prestador"
        : text(dps, ["tpEmit"]) === "2"
        ? "Tomador"
        : text(dps, ["tpEmit"]) === "3"
        ? "Intermediário"
        : DASH,
    },
    {
      label: "SITUAÇÃO DA NFS-e",
      value: text(infNFSe, ["cStat"]) === "100"
        ? "NFS-e Gerada"
        : orDash(text(infNFSe, ["cStat"])),
    },
    {
      label: "FINALIDADE",
      value: orDash(text(ibsCbsDps, ["finNFSe"])),
    },
  ]);
  d.y = Math.min(d.y, blockTop - qrSize - 40);
  d.hline(d.y);

  // ===== Prestador =====
  const opSimp = text(prest, ["regTrib", "opSimpNac"]);
  const opSimpLabel = opSimp === "1"
    ? "Não Optante"
    : opSimp === "2"
    ? "Optante - Microempreendedor Individual (MEI)"
    : opSimp === "3"
    ? "Optante - Microempresa ou Empresa de Pequeno Porte"
    : DASH;
  const regApur = text(prest, ["regTrib", "regApTribSN"]);
  const regApurLabel = regApur === "1"
    ? "Regime de apuração dos tributos federais e municipal pelo Simples Nacional"
    : regApur === "2"
    ? "Regime de apuração dos tributos federais pelo SN e o ISSQN por fora do SN"
    : regApur === "3"
    ? "Regime de apuração dos tributos federais e municipal por fora do SN"
    : opSimp === "3"
    ? "Regime de apuração dos tributos federais e municipal pelo Simples Nacional"
    : DASH;

  d.row([
    { label: "PRESTADOR / FORNECEDOR", value: "" },
    { label: "CNPJ / CPF / NIF", value: docNumber(text(emit, ["CNPJ"]) || text(emit, ["CPF"])) },
    { label: "Indicador Municipal (Inscrição)", value: orDash(text(emit, ["IM"])) },
    { label: "Telefone", value: phone(text(emit, ["fone"])) },
  ]);
  d.row([
    { label: "Nome / Nome Empresarial", value: orDash(text(emit, ["xNome"])), span: 2 },
    { label: "Município / Sigla UF", value: orDash(municipioEmitFull) },
    {
      label: "Código IBGE / CEP",
      value: `${ibge(text(enderEmit, ["cMun"]))} / ${cep(text(enderEmit, ["CEP"]))}`,
    },
  ]);
  d.row([
    {
      label: "Endereço",
      value: orDash(
        [
          text(enderEmit, ["xLgr"]),
          text(enderEmit, ["nro"]),
          text(enderEmit, ["xCpl"]),
          text(enderEmit, ["xBairro"]),
        ].filter(Boolean).join(", "),
      ),
      span: 2,
    },
    { label: "E-mail", value: orDash(text(emit, ["email"])), span: 2 },
  ]);
  d.row([
    { label: "Simples Nacional na Data de Competência", value: opSimpLabel },
    { label: "Regime de Apuração Tributária pelo SN", value: regApurLabel, span: 3 },
  ]);

  // ===== Tomador =====
  d.row([
    { label: "TOMADOR / ADQUIRENTE", value: "" },
    { label: "CNPJ / CPF / NIF", value: docNumber(text(toma, ["CNPJ"]) || text(toma, ["CPF"])) },
    { label: "Indicador Municipal (Inscrição)", value: orDash(text(toma, ["IM"])) },
    { label: "Telefone", value: phone(text(toma, ["fone"])) },
  ]);
  d.row([
    { label: "Nome / Nome Empresarial", value: orDash(text(toma, ["xNome"])), span: 2 },
    { label: "Município / Sigla UF", value: orDash(municipioToma) },
    {
      label: "Código IBGE / CEP",
      value: `${ibge(cMunToma)} / ${cep(text(enderTomaNac, ["CEP"]) || text(enderToma, ["CEP"]))}`,
    },
  ]);
  d.row([
    {
      label: "Endereço",
      value: orDash(
        [
          text(enderToma, ["xLgr"]),
          text(enderToma, ["nro"]),
          text(enderToma, ["xCpl"]),
          text(enderToma, ["xBairro"]),
        ].filter(Boolean).join(", "),
      ),
      span: 2,
    },
    { label: "E-mail", value: orDash(text(toma, ["email"])), span: 2 },
  ]);

  if (!node(dps, "dest")) {
    d.banner("DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e");
  }
  if (!node(dps, "interm")) {
    d.banner("INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e");
  }

  // ===== Serviço =====
  const cTribNac = text(cServ, ["cTribNac"]);
  const cTribNacFmt = cTribNac.length === 6
    ? `${cTribNac.slice(0, 2)}.${cTribNac.slice(2, 4)}.${cTribNac.slice(4)}`
    : orDash(cTribNac);
  const cNBS = text(cServ, ["cNBS"]);
  const cNBSFmt = cNBS.length === 9
    ? `${cNBS.slice(0, 1)}.${cNBS.slice(1, 5)}.${cNBS.slice(5, 7)}.${cNBS.slice(7)}`
    : orDash(cNBS);

  d.row([
    { label: "SERVIÇO PRESTADO", value: "" },
    {
      label: "Código de Tributação Nacional/Municipal",
      value: `${cTribNacFmt} / ${orDash(text(cServ, ["cTribMun"]))}`,
    },
    { label: "Código da NBS", value: cNBSFmt },
    {
      label: "Local da Prestação / Sigla UF / País",
      value: `${orDash(localPrestacao)} / ${DASH}`,
    },
  ]);
  d.textBlock(
    d.wrap(orDash(text(infNFSe, ["xTribNac"])), CONTENT_W - 8, VALUE_SIZE),
  );
  d.row([{ label: "Descrição do Serviço", value: "", span: 4 }]);
  d.textBlock(
    d.wrap(orDash(text(cServ, ["xDescServ"])), CONTENT_W - 8, VALUE_SIZE),
  );

  // ===== Tributação municipal =====
  const tribISSQN = text(tribMun, ["tribISSQN"]);
  const tpRet = text(tribMun, ["tpRetISSQN"]);
  d.row([
    { label: "TRIBUTAÇÃO MUNICIPAL (ISSQN)", value: "" },
    {
      label: "Tipo de Tributação do ISSQN",
      value: tribISSQN === "1"
        ? "Operação Tributável"
        : tribISSQN === "2"
        ? "Exportação de serviço"
        : tribISSQN === "3"
        ? "Não Incidência"
        : tribISSQN === "4"
        ? "Imunidade"
        : DASH,
    },
    {
      label: "Município / Sigla UF / País de Incidência do ISSQN",
      value: `${orDash(localIncidencia)} / ${DASH}`,
      span: 2,
    },
  ]);
  d.row([
    { label: "BC ISSQN", value: money(text(valoresNfse, ["vBC"])) },
    {
      label: "Alíquota Aplicada",
      value: percent(text(valoresNfse, ["pAliqAplic"]) || text(tribMun, ["pAliq"])),
    },
    {
      label: "Retenção do ISSQN",
      value: tpRet === "2" ? "Retido pelo Tomador" : tpRet === "3" ? "Retido pelo Intermediário" : "Não Retido",
    },
    { label: "ISSQN Apurado", value: money(text(valoresNfse, ["vISSQN"])) },
  ]);

  // ===== Tributação federal =====
  d.row([
    { label: "TRIBUTAÇÃO FEDERAL (EXCETO CBS)", value: "" },
    { label: "IRRF", value: money(text(tribFed, ["vRetIRRF"])) },
    {
      label: "Contribuição Previdenciária - Retida",
      value: money(text(tribFed, ["vRetCP"])),
    },
    {
      label: "Contribuições Sociais - Retidas",
      value: money(text(tribFed, ["vRetCSLL"])),
    },
  ]);
  d.row([
    { label: "PIS - Débito Apuração Própria", value: money(text(tribFed, ["vPIS"])) },
    { label: "COFINS - Débito Apuração Própria", value: money(text(tribFed, ["vCOFINS"])) },
    { label: "Descrição Contrib. Sociais - Retidas", value: DASH, span: 2 },
  ]);

  // ===== IBS / CBS =====
  d.row([
    { label: "TRIBUTAÇÃO IBS/CBS", value: "" },
    {
      label: "CST / cClassTrib",
      value: `${orDash(text(ibsCbsDps, ["CST"]))} / ${orDash(text(ibsCbsDps, ["cClassTrib"]))}`,
    },
    {
      label:
        "Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF",
      value: `${orDash(text(ibsCbsDps, ["cIndOp"]))} / ${ibge(text(ibsCbs, ["cLocalidadeIncid"]))} / ${orDash(text(ibsCbs, ["xLocalidadeIncid"]))} / ${DASH}`,
      span: 2,
    },
  ]);
  d.row([
    {
      label: "Exclusões e Reduções da Base de Cálculo",
      value: money(text(valoresNfse, ["vCalcDR"])),
    },
    {
      label: "Base de Cálculo Após Exclusões e Reduções",
      value: money(text(ibsValores, ["vBC"])),
    },
    { label: "Red. Alíquota IBS / Red. Alíquota CBS", value: `${DASH} / ${DASH}` },
    {
      label: "Alíquota - IBS UF / IBS Mun",
      value: `${percent(text(ibsValores, ["uf", "pIBSUF"]))} / ${percent(text(ibsValores, ["mun", "pIBSMun"]))}`,
    },
  ]);
  d.row([
    {
      label: "Alíq. Efetiva Municipal - IBS",
      value: percent(text(ibsValores, ["mun", "pAliqEfetMun"])),
    },
    {
      label: "Valor Apurado Municipal - IBS",
      value: money(text(totCIBS, ["gIBS", "gIBSMunTot", "vIBSMun"])),
    },
    {
      label: "Alíq. Efetiva Estadual - IBS",
      value: percent(text(ibsValores, ["uf", "pAliqEfetUF"])),
    },
    {
      label: "Valor Apurado Estadual - IBS",
      value: money(text(totCIBS, ["gIBS", "gIBSUFTot", "vIBSUF"])),
    },
  ]);
  d.row([
    {
      label: "Valor Total Apurado - IBS",
      value: money(text(totCIBS, ["gIBS", "vIBSTot"])),
    },
    { label: "Alíquota - CBS", value: percent(text(ibsValores, ["fed", "pCBS"])) },
    {
      label: "Alíquota Efetiva - CBS",
      value: percent(text(ibsValores, ["fed", "pAliqEfetCBS"])),
    },
    {
      label: "Valor Total Apurado - CBS",
      value: money(text(totCIBS, ["gCBS", "vCBS"])),
    },
  ]);

  // ===== Totais =====
  const vLiq = text(valoresNfse, ["vLiq"]);
  const vIBSTot = Number(text(totCIBS, ["gIBS", "vIBSTot"]) || 0);
  const vCBSTot = Number(text(totCIBS, ["gCBS", "vCBS"]) || 0);
  const totalIbsCbs = vIBSTot + vCBSTot;
  const liquidoComIbsCbs = Number(vLiq || 0) + totalIbsCbs;

  d.row(
    [
      { label: "VALOR TOTAL DA NFS-e", value: "" },
      {
        label: "VALOR DA OPERAÇÃO / SERVIÇO",
        value: money(text(valoresDps, ["vServPrest", "vServ"])),
      },
      {
        label: "Desconto Incondicionado",
        value: money(text(valoresDps, ["vDescCondIncond", "vDescIncond"])),
      },
      {
        label: "Desconto Condicionado",
        value: money(text(valoresDps, ["vDescCondIncond", "vDescCond"])),
      },
    ],
    { shaded: true },
  );
  d.row(
    [
      {
        label: "Total das Retenções (ISSQN / Federais)",
        value: money(text(valoresNfse, ["vTotalRet"])),
      },
      { label: "VALOR LÍQUIDO DA NFS-e", value: money(vLiq), bold: true },
      { label: "Total do IBS/CBS", value: money(String(totalIbsCbs)) },
      {
        label: "VALOR LÍQUIDO DA NFS-e + IBS/CBS",
        value: money(String(liquidoComIbsCbs)),
        bold: true,
      },
    ],
    { shaded: true },
  );

  // ===== Informações complementares =====
  d.row([{ label: "INFORMAÇÕES COMPLEMENTARES", value: "", span: 4 }]);
  const infoLines: string[] = [];
  const xInfComp = text(serv, ["infoCompl", "xInfComp"]);
  if (xInfComp) infoLines.push(...d.wrap(xInfComp, CONTENT_W - 8, VALUE_SIZE));
  const fed = text(totTrib, ["vTotTribFed"]);
  const est = text(totTrib, ["vTotTribEst"]);
  const mun = text(totTrib, ["vTotTribMun"]);
  if (fed || est || mun) {
    if (infoLines.length) infoLines.push("");
    infoLines.push(
      `Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: ${money(fed || "0")}; Estaduais: ${money(est || "0")}; Municipais: ${money(mun || "0")};`,
    );
  }
  if (!infoLines.length) infoLines.push(DASH);
  d.textBlock(infoLines, VALUE_SIZE, 6);

  // ===== Rodapé =====
  d.ensure(40);
  d.y -= 12;
  d.row([
    { label: "DATA CIENTIFICAÇÃO:", value: "" },
    { label: "IDENTIFICAÇÃO E ASSINATURA", value: "" },
    {
      label: "N° NFS-e / CHAVE NFS-e",
      value: `${orDash(text(infNFSe, ["nNFSe"]))} / ${accessKey}`,
      span: 2,
    },
  ]);

  return await d.doc.save();
}
