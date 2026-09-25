import { describe, it, expect } from 'vitest';
import { splitEqual, splitCents, workedSeconds, isValidManualSplit } from './timeBatch';

describe('cronômetro em lote', () => {
  it('20 obrigações em 2h dão 6 min cada', () => {
    const parts = splitEqual(7200, 20);
    expect(parts.every(p => p === 360)).toBe(true);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(7200);
  });
  it('sobra de segundos preserva a soma', () => {
    const parts = splitEqual(7201, 3);
    expect(parts).toEqual([2401, 2400, 2400]);
  });
  it('R$ 60 em 20 partes dá R$ 3,00', () => {
    const c = splitCents(6000, Array(20).fill(360));
    expect(c.every(x => x === 300)).toBe(true);
  });
  it('centavos somam exato', () => {
    const c = splitCents(1000, [1, 1, 1]);
    expect(c.reduce((a, b) => a + b, 0)).toBe(1000);
  });
  it('pausa de 30 min não conta', () => {
    const start = '2026-09-25T08:00:00Z';
    const end = new Date('2026-09-25T10:30:00Z').getTime();
    expect(workedSeconds(start, [{ paused_at: '2026-09-25T09:00:00Z', resumed_at: '2026-09-25T09:30:00Z' }], end)).toBe(7200);
  });
  it('rateio manual com soma errada é recusado', () => {
    expect(isValidManualSplit([1200, 600, 5400], 7200)).toBe(true);
    expect(isValidManualSplit([1200, 600, 5000], 7200)).toBe(false);
  });
});
