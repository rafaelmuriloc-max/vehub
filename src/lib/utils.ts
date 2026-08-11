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
