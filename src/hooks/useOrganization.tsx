import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  MULTI_TENANT_ENABLED,
  ORG_STORAGE_KEY,
  OrganizationSummary,
} from '@/lib/tenant';

interface OrganizationContextType {
  /** null enquanto o multi-tenant estiver desligado (comportamento atual). */
  orgId: string | null;
  organizations: OrganizationSummary[];
  /** admin DA ORGANIZAÇÃO ativa (não existe admin global). */
  isOrgAdmin: boolean;
  loading: boolean;
  /** true quando o usuário está logado mas não pertence a nenhum escritório. */
  hasNoAccess: boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(MULTI_TENANT_ENABLED);

  const load = useCallback(async () => {
    if (!MULTI_TENANT_ENABLED || !user) {
      setOrganizations([]);
      setOrgId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // `my_organizations` só existe depois de aplicar 006; se faltar, degrada
    // para o comportamento atual em vez de quebrar a tela.
    const { data, error } = await supabase.rpc('my_organizations' as never);
    if (error) {
      console.warn('[tenant] my_organizations indisponível:', error.message);
      setOrganizations([]);
      setOrgId(null);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as OrganizationSummary[];
    setOrganizations(list);
    const stored = localStorage.getItem(ORG_STORAGE_KEY);
    const active = list.find((o) => o.org_id === stored) ?? list[0] ?? null;
    setOrgId(active?.org_id ?? null);
    if (active) localStorage.setItem(ORG_STORAGE_KEY, active.org_id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchOrg = useCallback((next: string) => {
    localStorage.setItem(ORG_STORAGE_KEY, next);
    setOrgId(next);
  }, []);

  const isOrgAdmin =
    organizations.find((o) => o.org_id === orgId)?.role === 'admin';

  const hasNoAccess =
    MULTI_TENANT_ENABLED && !!user && !loading && organizations.length === 0;

  return (
    <OrganizationContext.Provider
      value={{ orgId, organizations, isOrgAdmin, loading, hasNoAccess, switchOrg, refresh: load }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
