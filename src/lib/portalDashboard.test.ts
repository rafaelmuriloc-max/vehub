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

import { tagFor as tagFor2 } from './portalDashboard';
import { describe as d2, it as i2, expect as e2 } from 'vitest';
d2('tagFor PIS/COFINS e IRPJ/CSLL', () => {
  i2('PIS e COFINS', () => { e2(tagFor2('PIS')).toBe('pis_cofins'); e2(tagFor2('COFINS')).toBe('pis_cofins'); });
  i2('IRPJ e CSLL', () => { e2(tagFor2('IRPJ')).toBe('irpj_csll'); e2(tagFor2('CSLL Trimestral')).toBe('irpj_csll'); });
  i2('IRRF continua DARF', () => { e2(tagFor2('IRRF')).toBe('darf'); });
});

import { isTaxDue } from './portalDashboard';
d2('isTaxDue', () => {
  i2('impostos entram', () => { for (const n of ['ISS','ICMS','PIS / COFINS','FGTS','Darf Previdenciário','IRPJ / CSLL','DAS - Simples Nacional']) e2(isTaxDue(n)).toBe(true); });
  i2('não impostos saem', () => { for (const n of ['Adto Salarial','DEFIS','MIT','REINF','Folha Pró Labore','Folha de Pagamento Mensal']) e2(isTaxDue(n)).toBe(false); });
});
