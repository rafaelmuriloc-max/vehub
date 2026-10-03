import { describe, it, expect } from 'vitest';
import { limiteAnual, faixaDe, projecao, somarPorMes } from './meiLimit';

describe('MEI limite', () => {
  it('aberta antes do ano = R$ 81.000', () => expect(limiteAnual(2026, '2020-05-10')).toBe(81000));
  it('aberta em março do ano = 10 x 6.750', () => expect(limiteAnual(2026, '2026-03-15')).toBe(67500));
  it('faixa alerta a partir de 80%', () => { expect(faixaDe(64799, 81000)).toBe('normal'); expect(faixaDe(64800, 81000)).toBe('alerta'); });
  it('excesso até 20% (R$ 97.200)', () => { expect(faixaDe(97200, 81000)).toBe('excesso'); expect(faixaDe(97201, 81000)).toBe('grave'); });
  it('projeção pela média dos meses decorridos', () =>
    expect(projecao([1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0], 2026, new Date(2026, 2, 10))).toBe(12000));
  it('soma notas por mês do ano', () =>
    expect(somarPorMes([{ issue_date: '2026-02-03T10:00', total_value: 10 }, { issue_date: '2025-02-01', total_value: 99 }], 2026)[1]).toBe(10));
});
