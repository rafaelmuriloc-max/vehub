export type TrialInfo = { end1: string | null; days1: number | null; end2: string | null; days2: number | null };
export type TrialStatus =
  | { kind: 'none' }
  | { kind: 'open'; phase: 1 | 2; end: string; days: number; tone: 'danger' | 'warning' | 'neutral' }
  | { kind: 'expired'; end: string; days: number }
  | { kind: 'closed' };

const DAY = 86400000;
const toDay = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00');
export const daysBetween = (from: Date, to: string) => Math.round((toDay(to).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / DAY);

export function maskCpf(cpf: string | null | undefined): string | null {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length < 3) return null;
  const t = d.slice(-3);
  return `***.***.*${t[0]}-${t.slice(1)}`;
}

/** Status of the experience contract. Expired = ended within the last 30 days; older ends count as closed. */
export function trialStatus(t: TrialInfo, today = new Date()): TrialStatus {
  if (!t.end1 && !t.end2) return { kind: 'none' };
  const d1 = t.end1 ? daysBetween(today, t.end1) : null;
  const d2 = t.end2 ? daysBetween(today, t.end2) : null;
  if (d1 != null && d1 >= 0) return { kind: 'open', phase: 1, end: t.end1!, days: d1, tone: tone(d1) };
  if (d2 != null && d2 >= 0) return { kind: 'open', phase: 2, end: t.end2!, days: d2, tone: tone(d2) };
  const lastEnd = t.end2 || t.end1!;
  const last = (d2 ?? d1)!;
  if (last >= -30) return { kind: 'expired', end: lastEnd, days: -last };
  return { kind: 'closed' };
}

function tone(days: number): 'danger' | 'warning' | 'neutral' {
  return days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'neutral';
}

export function vacationTone(deadline: string | null, enjoyed: boolean, today = new Date()): 'danger' | 'warning' | 'ok' | 'none' {
  if (enjoyed) return 'ok';
  if (!deadline) return 'none';
  const d = daysBetween(today, deadline);
  return d < 0 ? 'danger' : d <= 60 ? 'warning' : 'ok';
}
