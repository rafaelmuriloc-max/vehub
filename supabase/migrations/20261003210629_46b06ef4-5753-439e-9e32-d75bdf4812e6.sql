REVOKE EXECUTE ON FUNCTION public.is_portal_client(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.portal_can_access_client(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_portal_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_can_access_client(uuid, uuid) TO authenticated, service_role;