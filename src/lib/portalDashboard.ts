/** Regras de exibição do painel do Portal do Cliente. */
export type TagKey = 'das' | 'fgts' | 'inss' | 'iss' | 'folha' | 'darf' | 'outro';

export const TAGS: { key: Exclude<TagKey, 'outro'>; label: string }[] = [
  { key: 'das', label: 'DAS' }, { key: 'fgts', label: 'FGTS' }, { key: 'inss', label: 'INSS' },
  { key: 'iss', label: 'ISS' }, { key: 'folha', label: 'Folha' }, { key: 'darf', label: 'DARF' },
];

export function tagFor(name: string | null | undefined): TagKey {
  const n = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/\bDAS\b|PGDAS|SIMPLES|PGMEI/.test(n)) return 'das';
  if (/FGTS/.test(n)) return 'fgts';
  if (/INSS|DCTFWEB|ESOCIAL|PREVID/.test(n)) return 'inss';
  if (/\bISS\b|ISSQN|NFS/.test(n)) return 'iss';
  if (/FOLHA|SALARIO|PRO.?LABORE/.test(n)) return 'folha';
  if (/DARF|IRPJ|CSLL|PIS|COFINS|IRRF/.test(n)) return 'darf';
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
