import { describe, it, expect } from 'vitest';
import { negociacaoSchema, findDuplicate, isPgfnManual, buildRow, parseMoney, parseIntOrNull, PGFN_MANUAL_MODALIDADE } from './pgfnNegociacao';

const CID = '11111111-1111-4111-8111-111111111111';
const base = { client_id: CID, numero: '00.1.23.456789-01', modalidade: 'Transação Excepcional', situacao: 'Em dia', valor_consolidado: 1000, parcelas_total: 60, parcelas_pagas: 10, valor_proxima_parcela: 20, vencimento_proxima: '2026-10-30', data_adesao: null, observacoes: null };

describe('validação de negociação PGFN', () => {
  it('aceita registro válido', () => { expect(negociacaoSchema.safeParse(base).success).toBe(true); });
  it('exige número', () => {
    const r = negociacaoSchema.safeParse({ ...base, numero: '  ' });
    expect(r.success).toBe(false);
  });
  it('rejeita valores negativos', () => {
    expect(negociacaoSchema.safeParse({ ...base, valor_consolidado: -1 }).success).toBe(false);
    expect(negociacaoSchema.safeParse({ ...base, valor_proxima_parcela: -0.01 }).success).toBe(false);
    expect(negociacaoSchema.safeParse({ ...base, parcelas_total: -3 }).success).toBe(false);
  });
  it('rejeita pagas > total', () => {
    const r = negociacaoSchema.safeParse({ ...base, parcelas_pagas: 61 });
    expect(r.success).toBe(false);
  });
  it('aceita campos não informados (null)', () => {
    expect(negociacaoSchema.safeParse({ ...base, valor_consolidado: null, parcelas_total: null, parcelas_pagas: null, valor_proxima_parcela: null, vencimento_proxima: null }).success).toBe(true);
  });
  it('parse de valores', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNaN();
    expect(parseIntOrNull('12')).toBe(12);
    expect(parseIntOrNull('1.5')).toBeNaN();
  });
});

describe('duplicidade e isolamento PGFN x RFB', () => {
  const rows = [
    { id: 'a', client_id: CID, origem: 'PGFN', numero_parcelamento: '00.1.23.456789-01' },
    { id: 'b', client_id: CID, origem: 'RFB', numero_parcelamento: '999' },
  ];
  it('detecta duplicata com formatação diferente', () => {
    expect(findDuplicate(rows, CID, '0012345678901')?.id).toBe('a');
  });
  it('ignora o próprio registro ao editar', () => {
    expect(findDuplicate(rows, CID, '00.1.23.456789-01', 'a')).toBeNull();
  });
  it('mesmo número em RFB não conta como duplicata PGFN', () => {
    expect(findDuplicate(rows, CID, '999')).toBeNull();
  });
  it('mesmo número em outra empresa não é duplicata', () => {
    expect(findDuplicate(rows, '22222222-2222-4222-8222-222222222222', '0012345678901')).toBeNull();
  });
  it('isPgfnManual só aceita origem PGFN + modalidade manual', () => {
    expect(isPgfnManual({ origem: 'PGFN', modalidade: PGFN_MANUAL_MODALIDADE })).toBe(true);
    expect(isPgfnManual({ origem: 'RFB', modalidade: PGFN_MANUAL_MODALIDADE })).toBe(false);
    expect(isPgfnManual({ origem: 'PGFN', modalidade: 'PEDIDOSPARC163' })).toBe(false);
  });
  it('buildRow grava origem manual documentada e preserva a guia', () => {
    const now = new Date('2026-10-03T04:00:00Z');
    const row = buildRow(negociacaoSchema.parse(base), { id: 'u', nome: 'X' }, { guia: { path: 'p' } }, now);
    expect(row.origem).toBe('PGFN');
    expect(row.modalidade).toBe(PGFN_MANUAL_MODALIDADE);
    expect(row.raw_response.fonte).toBe('manual');
    expect(row.raw_response.atualizado_manual_em).toBe(now.toISOString());
    expect(row.raw_response.guia).toEqual({ path: 'p' });
  });
});
