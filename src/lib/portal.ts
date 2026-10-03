/** Regras da Área do Cliente: quais módulos cada regime enxerga. */
export type RegimeKey = 'mei' | 'simples' | 'presumido' | 'real' | 'outro';
export type PortalModule = 'faturamento' | 'emitidas' | 'recebidas' | 'avisos' | 'limite' | 'das_mei' | 'ccmei' | 'das_simples';

export function regimeKey(raw: string | null | undefined): RegimeKey {
  const r = (raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (r === 'mei' || r.includes('microempreendedor')) return 'mei';
  if (r.includes('simples')) return 'simples';
  if (r.includes('presumido')) return 'presumido';
  if (r.includes('real')) return 'real';
  return 'outro';
}

const BASE: PortalModule[] = ['faturamento', 'emitidas', 'recebidas', 'avisos'];

export function modulesFor(raw: string | null | undefined): PortalModule[] {
  switch (regimeKey(raw)) {
    case 'mei': return [...BASE, 'limite', 'das_mei', 'ccmei'];
    case 'simples': return [...BASE, 'das_simples'];
    default: return BASE;
  }
}

/** Serviços do Integra Contador que o portal pode chamar (espelha a lista do servidor). */
export const PORTAL_SERVICES = ['GERARDASPDF21', 'EMITIRCCMEI121', 'DADOSCCMEI122'] as const;

export const OFFICE_DOMAIN = '@velocitacontabilidade.com.br';

export function normEmail(e: string | null | undefined): string | null {
  const v = (e || '').trim().toLowerCase();
  return v.includes('@') ? v : null;
}

/** Contato pode virar acesso de cliente? (tem e-mail e não é do escritório) */
export function eligibleEmail(e: string | null | undefined): string | null {
  const v = normEmail(e);
  return v && !v.endsWith(OFFICE_DOMAIN) ? v : null;
}

export type PortalStatus = 'none' | 'temp' | 'active' | 'staff';
export function portalStatus(c: { user_id: string | null; must_change_password: boolean; is_staff: boolean }): PortalStatus {
  if (!c.user_id) return 'none';
  if (c.is_staff) return 'staff';
  return c.must_change_password ? 'temp' : 'active';
}
