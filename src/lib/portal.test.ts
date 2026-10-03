import { describe, it, expect } from 'vitest';
import { modulesFor, regimeKey } from './portal';

describe('Área do Cliente - módulos por regime', () => {
  it('MEI (qualquer grafia) tem limite, DAS e CCMEI', () => {
    expect(regimeKey('mei')).toBe('mei');
    expect(modulesFor('MEI')).toEqual(expect.arrayContaining(['limite', 'das_mei', 'ccmei']));
  });
  it('Simples Nacional tem DAS do Simples e não tem CCMEI', () => {
    const m = modulesFor('Simples Nacional');
    expect(m).toContain('das_simples');
    expect(m).not.toContain('ccmei');
  });
  it('Lucro Presumido só tem módulos comuns, sem emissão', () => {
    expect(modulesFor('Lucro Presumido')).toEqual(['faturamento', 'emitidas', 'recebidas', 'avisos']);
  });
});
