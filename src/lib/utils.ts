import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize a filename for use as a Supabase Storage key.
 * Removes accents (NFD), replaces invalid chars with underscores, collapses repeats.
 */
export function sanitizeStorageName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : "";
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const safeBase = clean(base) || "file";
  const safeExt = clean(ext);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/**
 * Rótulo padrão de empresa: "211 - EMPRESA X".
 * Quando não houver código SCI cadastrado, retorna apenas o nome.
 */
export function formatClientLabel(
  client?: { sci_code?: string | null; company_name?: string | null } | null,
  fallback = '',
): string {
  const name = (client?.company_name || '').trim();
  const sci = (client?.sci_code || '').trim();
  if (!name) return fallback;
  return sci ? `${sci} - ${name}` : name;
}

/**
 * Valores oficiais do regime tributário armazenados em clients.tax_regime.
 */
export const TAX_REGIME = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
} as const;

export type TaxRegime = (typeof TAX_REGIME)[keyof typeof TAX_REGIME];

/**
 * Converte variações antigas (snake_case, minúsculas) para o valor oficial.
 * Útil em imports, edge functions e filtros que podem receber dados legados.
 */
export function normalizeTaxRegime(value: string | null | undefined): TaxRegime | string | null {
  const v = (value || '').trim().toLowerCase().replace(/_/g, ' ');
  if (!v) return null;
  if (v.includes('simples')) return TAX_REGIME.SIMPLES_NACIONAL;
  if (v.includes('presumido')) return TAX_REGIME.LUCRO_PRESUMIDO;
  if (v.includes('real')) return TAX_REGIME.LUCRO_REAL;
  if (v === 'mei') return TAX_REGIME.MEI;
  return value;
}

/**
 * Verifica se um regime tributário é Simples Nacional, aceitando variações.
 */
export function isSimplesNacional(value: string | null | undefined): boolean {
  const v = (value || '').toLowerCase();
  return v.includes('simples');
}
