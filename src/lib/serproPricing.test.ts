import { describe, it, expect } from 'vitest';
import { custoAcumulado, cicloFaturamento, faixaAtual } from './serproPricing';

describe('serproPricing', () => {
  it('cobra progressivamente por faixa', () => {
    expect(custoAcumulado('Consultar', 300)).toBe(72);
    expect(custoAcumulado('Consultar', 301)).toBe(72.21);
    expect(custoAcumulado('Emitir', 0)).toBe(0);
  });
  it('faixa atual', () => {
    expect(faixaAtual('Declarar', 100).faixa).toBe(2);
    expect(faixaAtual('Declarar', 99).faltam).toBe(1);
  });
  it('ciclo 21 a 20', () => {
    const c = cicloFaturamento(new Date(2026, 9, 2));
    expect(c.inicio.getDate()).toBe(21); expect(c.inicio.getMonth()).toBe(8);
    expect(c.fim.getMonth()).toBe(9);
    const d = cicloFaturamento(new Date(2026, 9, 21));
    expect(d.fim.getMonth()).toBe(10);
  });
});
