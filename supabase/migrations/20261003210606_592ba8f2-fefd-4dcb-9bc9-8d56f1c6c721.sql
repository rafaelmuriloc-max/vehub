ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

CREATE OR REPLACE FUNCTION public.is_portal_client(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'client')
$$;

CREATE TABLE public.client_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_links TO authenticated;
GRANT ALL ON public.client_portal_links TO service_role;
ALTER TABLE public.client_portal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portal links" ON public.client_portal_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own portal links" ON public.client_portal_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.portal_can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_portal_links WHERE user_id = _user_id AND client_id = _client_id)
$$;

CREATE TABLE public.portal_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  tax_regime text,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  expires_at date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_announcements TO authenticated;
GRANT ALL ON public.portal_announcements TO service_role;
ALTER TABLE public.portal_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage announcements" ON public.portal_announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients read targeted announcements" ON public.portal_announcements FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at >= current_date) AND (
      audience = 'all'
      OR (audience = 'client' AND public.portal_can_access_client(auth.uid(), client_id))
      OR (audience = 'regime' AND EXISTS (
        SELECT 1 FROM public.client_portal_links l JOIN public.clients c ON c.id = l.client_id
        WHERE l.user_id = auth.uid() AND c.tax_regime = portal_announcements.tax_regime))
    )
  );
CREATE TRIGGER update_portal_announcements_updated_at BEFORE UPDATE ON public.portal_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restrictive guard: portal clients only see what is explicitly allowed.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Portal client guard" ON public.%I', t);
    IF t IN ('clients') THEN
      EXECUTE format('CREATE POLICY "Portal client guard" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_portal_client(auth.uid()) OR public.portal_can_access_client(auth.uid(), id)) WITH CHECK (NOT public.is_portal_client(auth.uid()))', t);
    ELSIF t IN ('nfe_invoices','nfce_invoices','mei_competencias','simples_nacional_competencias') THEN
      EXECUTE format('CREATE POLICY "Portal client guard" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_portal_client(auth.uid()) OR public.portal_can_access_client(auth.uid(), client_id)) WITH CHECK (NOT public.is_portal_client(auth.uid()))', t);
    ELSIF t IN ('profiles','user_roles','client_portal_links') THEN
      EXECUTE format('CREATE POLICY "Portal client guard" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_portal_client(auth.uid()) OR user_id = auth.uid()) WITH CHECK (NOT public.is_portal_client(auth.uid()) OR user_id = auth.uid())', t);
    ELSIF t = 'portal_announcements' THEN
      NULL;
    ELSE
      EXECUTE format('CREATE POLICY "Portal client guard" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_portal_client(auth.uid())) WITH CHECK (NOT public.is_portal_client(auth.uid()))', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "Portal client storage guard" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_portal_client(auth.uid())) WITH CHECK (NOT public.is_portal_client(auth.uid()));