import { describe, it, expect } from 'vitest';
import {
  isUuid,
  orgStoragePath,
  isLegacyStoragePath,
  storagePathOrg,
  isValidInviteToken,
} from './tenant';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_LEGACY = '99999999-9999-9999-9999-999999999999';

describe('tenant: identificação de organização', () => {
  it('valida UUID', () => {
    expect(isUuid(ORG_A)).toBe(true);
    expect(isUuid('documentos')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('tenant: caminhos de storage', () => {
  it('prefixa arquivos novos com a organização', () => {
    expect(orgStoragePath(ORG_A, 'documentos/nf.pdf')).toBe(`${ORG_A}/documentos/nf.pdf`);
    expect(orgStoragePath(ORG_A, '/documentos/nf.pdf')).toBe(`${ORG_A}/documentos/nf.pdf`);
  });

  it('rejeita organização inválida', () => {
    expect(() => orgStoragePath('x', 'a.pdf')).toThrow();
  });

  it('reconhece caminhos legados', () => {
    expect(isLegacyStoragePath('documentos/2026/nf.pdf')).toBe(true);
    expect(isLegacyStoragePath(`${ORG_A}/documentos/nf.pdf`)).toBe(false);
  });

  it('mapeia legado para a organização existente e novo para a própria', () => {
    expect(storagePathOrg('nfe/cliente/chave.xml', ORG_LEGACY)).toBe(ORG_LEGACY);
    expect(storagePathOrg(`${ORG_A}/nfe/chave.xml`, ORG_LEGACY)).toBe(ORG_A);
  });

  it('não deixa outra organização assumir caminho legado', () => {
    // um arquivo legado nunca resolve para ORG_A
    expect(storagePathOrg('chat-media/audio.ogg', ORG_LEGACY)).not.toBe(ORG_A);
  });
});

describe('tenant: convites', () => {
  it('aceita apenas token hex de 64 caracteres', () => {
    expect(isValidInviteToken('a'.repeat(64))).toBe(true);
    expect(isValidInviteToken('a'.repeat(63))).toBe(false);
    expect(isValidInviteToken('Z'.repeat(64))).toBe(false);
    expect(isValidInviteToken('')).toBe(false);
    expect(isValidInviteToken(null)).toBe(false);
  });
});
