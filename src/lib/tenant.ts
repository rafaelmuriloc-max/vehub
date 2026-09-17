/**
 * Camada multi-tenant do frontend.
 *
 * IMPORTANTE: tudo aqui é inerte enquanto `VITE_MULTI_TENANT` não for "true".
 * Isso permite subir o código para produção ANTES de aplicar o schema, sem
 * qualquer mudança de comportamento para o escritório atual.
 */

export const MULTI_TENANT_ENABLED =
  import.meta.env.VITE_MULTI_TENANT === 'true';

/** Google só fica disponível depois do isolamento aplicado E do provider configurado. */
export const GOOGLE_AUTH_ENABLED =
  MULTI_TENANT_ENABLED && import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

export const ORG_STORAGE_KEY = 'vehub.active_org_id';

export interface OrganizationSummary {
  org_id: string;
  name: string;
  slug: string;
  role: 'admin' | 'employee';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value);
}

/**
 * Caminho de storage de um arquivo NOVO: sempre prefixado pela organização.
 * Arquivos legados (sem prefixo) continuam válidos — ver `isLegacyStoragePath`.
 */
export function orgStoragePath(orgId: string, path: string): string {
  if (!isUuid(orgId)) throw new Error('orgId inválido');
  const clean = path.replace(/^\/+/, '');
  return `${orgId}/${clean}`;
}

/** Um caminho é legado quando o primeiro segmento não é um UUID de organização. */
export function isLegacyStoragePath(path: string): boolean {
  const first = path.replace(/^\/+/, '').split('/')[0] ?? '';
  return !isUuid(first);
}

/**
 * Organização dona de um caminho de storage.
 * Espelha `public.storage_object_org` no banco: legado pertence à org existente.
 */
export function storagePathOrg(path: string, legacyOrgId: string): string {
  const first = path.replace(/^\/+/, '').split('/')[0] ?? '';
  return isUuid(first) ? first : legacyOrgId;
}

/** Token de convite: 32 bytes em hex, exatamente como `create_org_invite` emite. */
export function isValidInviteToken(token: string | null | undefined): boolean {
  return !!token && /^[0-9a-f]{64}$/.test(token);
}

/** URL de callback do OAuth — precisa estar cadastrada no Google e no Supabase. */
export function oauthRedirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}
