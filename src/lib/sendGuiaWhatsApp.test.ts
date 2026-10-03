import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { buildSendOptions, fillTemplate } from './sendGuiaWhatsApp';

describe('envio de guia', () => {
  it('troca {empresa} e {competencia}', () =>
    expect(fillTemplate('Guia {empresa} {competencia}', { empresa: 'ACME', competencia: '09/2026' })).toBe('Guia ACME 09/2026'));
  it('prioriza conversa do Chat, ignora grupos e duplicados', () => {
    const o = buildSendOptions(
      [{ id: 'g', whatsapp_phone: '5548999990000', is_group: true }, { id: 'c1', name: 'Ana', whatsapp_phone: '5548988887777' }],
      { contact_name: 'Bia', contact_phone: '(48) 98888-7777', phone: '48 3333-4444' },
      [{ contact_name: 'Dep', contact_phone: '48977776666' }],
    );
    expect(o.map(x => x.label)).toEqual(['Ana (Chat)', 'Dep', 'Telefone da empresa']);
  });
});
