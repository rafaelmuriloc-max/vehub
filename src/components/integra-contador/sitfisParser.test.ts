import { describe, expect, it } from 'vitest';
import { extractCompetencies, parseSitfisReport } from './sitfisParser';

describe('sitfisParser', () => {
  it('agrupa competências DCTFWeb por ano sem perder meses', () => {
    expect(extractCompetencies('(Período de Apuração) 2025 - NOV DEZ 2026 - JAN FEV JUL')).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-07',
    ]);
  });

  it('mantém omissão e parcelamento como ocorrências independentes', () => {
    const parsed = parseSitfisReport(['Pendência - Omissão de DCTFWeb* (Período de Apuração) 2026 - JUL *Ausência de entrega de DCTFWeb original Parcelamento - Ordinário Situação: ativo']);
    expect(parsed.omissions).toHaveLength(1);
    expect(parsed.installments).toHaveLength(1);
    expect(parsed.occurrenceTypes).toEqual(expect.arrayContaining(['omissao', 'parcelamento']));
  });

  it('não deixa PGFN regular neutralizar omissão da Receita', () => {
    const parsed = parseSitfisReport(['Pendência - Omissão de DCTFWeb (Período de Apuração) 2026 - JUL Diagnóstico Fiscal na Procuradoria-Geral da Fazenda Nacional Não foram detectadas pendências/exigibilidades suspensas']);
    expect(parsed.omissions).toHaveLength(1);
    expect(parsed.pgfn[0]?.status).toBe('regular');
    expect(parsed.totalOccurrences).toBe(1);
  });

  it('não inventa campos ausentes em débito', () => {
    const parsed = parseSitfisReport(['Débito - IRPJ Competência: 07/2026']);
    expect(parsed.debts[0]).toMatchObject({ principal: null, updated: null, dueDate: null });
  });
});
