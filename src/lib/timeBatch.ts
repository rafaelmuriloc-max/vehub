/** Rateio igual ao segundo: a sobra vai para as primeiras partes. Soma = total. */
export function splitEqual(total: number, n: number): number[] {
  if (n <= 0) return [];
  const t = Math.max(0, Math.floor(total));
  const base = Math.floor(t / n);
  const rest = t % n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Divide um valor em centavos proporcionalmente aos pesos; soma exata. */
export function splitCents(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map(w => (totalCents * w) / sum);
  const floor = raw.map(Math.floor);
  let rest = totalCents - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; floor[i]++; rest--; }
  return floor;
}

/** Tempo trabalhado descontando pausas (segundos). */
export function workedSeconds(
  startedAt: string,
  pauses: { paused_at: string; resumed_at: string | null }[],
  nowMs: number,
): number {
  const total = (nowMs - new Date(startedAt).getTime()) / 1000;
  const paused = pauses.reduce((acc, p) => {
    const end = p.resumed_at ? new Date(p.resumed_at).getTime() : nowMs;
    return acc + Math.max(0, (end - new Date(p.paused_at).getTime()) / 1000);
  }, 0);
  return Math.max(0, Math.floor(total - paused));
}

export function isValidManualSplit(values: number[], total: number): boolean {
  return values.every(v => Number.isInteger(v) && v >= 0) && values.reduce((a, b) => a + b, 0) === total;
}
