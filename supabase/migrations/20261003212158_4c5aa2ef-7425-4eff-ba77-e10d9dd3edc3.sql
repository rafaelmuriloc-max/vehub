CREATE OR REPLACE FUNCTION public.portal_norm_email(_e text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(lower(trim(coalesce(_e, ''))), '')
$$;

CREATE OR REPLACE FUNCTION public.portal_contact_client_ids(_email text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients
   WHERE public.portal_norm_email(contact_email) = public.portal_norm_email(_email)
  UNION
  SELECT client_id FROM public.client_department_contacts
   WHERE public.portal_norm_email(contact_email) = public.portal_norm_email(_email)
$$;

CREATE OR REPLACE FUNCTION public.portal_can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND public.portal_norm_email(u.email) NOT LIKE '%@velocitacontabilidade.com.br'
      AND _client_id IN (SELECT public.portal_contact_client_ids(u.email))
  )
$$;

CREATE OR REPLACE FUNCTION public.portal_my_clients()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c FROM auth.users u, LATERAL public.portal_contact_client_ids(u.email) c
  WHERE u.id = auth.uid()
    AND public.is_portal_client(auth.uid())
    AND public.portal_norm_email(u.email) NOT LIKE '%@velocitacontabilidade.com.br'
$$;

CREATE OR REPLACE FUNCTION public.admin_portal_contacts()
RETURNS TABLE(email text, names text[], phones text[], client_ids uuid[], user_id uuid, must_change_password boolean, is_staff boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH c AS (
    SELECT public.portal_norm_email(contact_email) em, contact_name nm, contact_phone ph, id cid FROM public.clients
    UNION ALL
    SELECT public.portal_norm_email(contact_email), contact_name, contact_phone, client_id FROM public.client_department_contacts
  ), g AS (
    SELECT em,
      array_remove(array_agg(DISTINCT NULLIF(trim(nm), '')), NULL) names,
      array_remove(array_agg(DISTINCT NULLIF(trim(ph), '')), NULL) phones,
      array_agg(DISTINCT cid) cids
    FROM c WHERE em IS NOT NULL AND em LIKE '%@%' AND em NOT LIKE '%@velocitacontabilidade.com.br'
    GROUP BY em
  )
  SELECT g.em, g.names, g.phones, g.cids, u.id,
    coalesce(p.must_change_password, false),
    (u.id IS NOT NULL AND NOT public.is_portal_client(u.id))
  FROM g
  LEFT JOIN auth.users u ON public.portal_norm_email(u.email) = g.em
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY g.em;
END $$;

REVOKE EXECUTE ON FUNCTION public.portal_contact_client_ids(text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.portal_my_clients() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_portal_contacts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.portal_my_clients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_portal_contacts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_contact_client_ids(text) TO service_role;

DROP POLICY IF EXISTS "Clients read targeted announcements" ON public.portal_announcements;
CREATE POLICY "Clients read targeted announcements" ON public.portal_announcements FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at >= current_date) AND (
      audience = 'all'
      OR (audience = 'client' AND public.portal_can_access_client(auth.uid(), client_id))
      OR (audience = 'regime' AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.tax_regime = portal_announcements.tax_regime AND public.portal_can_access_client(auth.uid(), c.id)))
    )
  );