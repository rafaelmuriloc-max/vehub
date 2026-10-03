import { describe, it, expect } from 'vitest';
import { pctChange, dueBadge, daysUntil, tagFor, brlShort } from './portalDashboard';

describe('portal dashboard', () => {
  it('variação % contra período anterior', () => {
    expect(pctChange(128, 100)).toBeCloseTo(28);
    expect(pctChange(50, 100)).toBeCloseTo(-50);
    expect(pctChange(10, 0)).toBeNull();
  });
  it('selo vermelho até 3 dias, laranja depois', () => {
    expect(dueBadge(3)).toEqual({ label: 'Em 3 dias', tone: 'danger' });
    expect(dueBadge(5)).toEqual({ label: 'Em 5 dias', tone: 'warning' });
    expect(dueBadge(0).tone).toBe('danger');
    expect(dueBadge(-2).label).toBe('Vencido há 2 dias');
  });
  it('dias até o vencimento', () => {
    expect(daysUntil('2024-11-05', new Date(2024, 10, 2))).toBe(3);
  });
  it('etiqueta por nome da obrigação', () => {
    expect(tagFor('DAS Simples Nacional')).toBe('das');
    expect(tagFor('FGTS Digital')).toBe('fgts');
    expect(tagFor('DCTFWeb')).toBe('inss');
  });
  it('valor curto', () => { expect(brlShort(124500)).toBe('R$ 125 mil'); });
});
