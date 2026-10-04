/** Regras de exibição do painel do Portal do Cliente. */
export type TagKey = 'das' | 'fgts' | 'inss' | 'iss' | 'folha' | 'darf' | 'icms' | 'pis_cofins' | 'irpj_csll' | 'outro';

export const TAGS: { key: Exclude<TagKey, 'outro' | 'folha'>; label: string }[] = [
  { key: 'das', label: 'DAS' }, { key: 'fgts', label: 'FGTS' }, { key: 'inss', label: 'INSS' },
  { key: 'iss', label: 'ISS' }, { key: 'pis_cofins', label: 'PIS/COFINS' }, { key: 'irpj_csll', label: 'IRPJ/CSLL' }, { key: 'darf', label: 'DARF' }, { key: 'icms', label: 'ICMS' },
];

export function tagFor(name: string | null | undefined): TagKey {
  const n = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/\bDAS\b|PGDAS|SIMPLES|PGMEI/.test(n)) return 'das';
  if (/FGTS/.test(n)) return 'fgts';
  if (/INSS|DCTFWEB|ESOCIAL|PREVID/.test(n)) return 'inss';
  if (/\bISS\b|ISSQN|NFS/.test(n)) return 'iss';
  if (/FOLHA|SALARIO|PRO.?LABORE/.test(n)) return 'folha';
  if (/\bPIS\b|COFINS/.test(n)) return 'pis_cofins';
  if (/IRPJ|CSLL/.test(n)) return 'irpj_csll';
  if (/DARF|IRRF/.test(n)) return 'darf';
  if (/ICMS/.test(n)) return 'icms';
  return 'outro';
}

/** Variação percentual; null quando não há base de comparação. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Dias inteiros entre hoje e o vencimento (datas YYYY-MM-DD). */
export function daysUntil(due: string, today: Date = new Date()): number {
  const [y, m, d] = due.slice(0, 10).split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** Selo "Em X dias": vermelho até 3 dias (ou vencido), laranja depois. */
export function dueBadge(days: number): { label: string; tone: 'danger' | 'warning' } {
  if (days < 0) return { label: `Vencido há ${-days} dia${days === -1 ? '' : 's'}`, tone: 'danger' };
  if (days === 0) return { label: 'Vence hoje', tone: 'danger' };
  return { label: `Em ${days} dia${days === 1 ? '' : 's'}`, tone: days <= 3 ? 'danger' : 'warning' };
}

/** "R$ 124 mil" para etiquetas do gráfico. */
export function brlShort(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${Math.round(v)}`;
}

/** Só vencimentos de impostos entram no calendário do portal. */
export function isTaxDue(name: string | null | undefined): boolean {
  const n = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/FOLHA|SALARI|PRO.?LABORE|DEFIS|\bMIT\b|REINF|DCTF|ESOCIAL|DECLARA/.test(n)) return false;
  const t = tagFor(name);
  return t !== 'folha' && t !== 'outro';
}
