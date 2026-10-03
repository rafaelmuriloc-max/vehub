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

import { eligibleEmail, portalStatus } from './portal';
describe('Área do Cliente - contatos', () => {
  it('e-mail é comparado sem maiúsculas/espaços', () => expect(eligibleEmail('  Joao@Gmail.com ')).toBe('joao@gmail.com'));
  it('e-mail do escritório nunca vira acesso', () => expect(eligibleEmail('fiscal@velocitacontabilidade.com.br')).toBeNull());
  it('contato sem e-mail não é elegível', () => expect(eligibleEmail('')).toBeNull());
  it('situação do acesso', () => {
    expect(portalStatus({ user_id: null, must_change_password: false, is_staff: false })).toBe('none');
    expect(portalStatus({ user_id: 'x', must_change_password: true, is_staff: false })).toBe('temp');
    expect(portalStatus({ user_id: 'x', must_change_password: false, is_staff: true })).toBe('staff');
  });
});
