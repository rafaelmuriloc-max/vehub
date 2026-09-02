REVOKE ALL ON FUNCTION public.resolve_client_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_by_phone(text) TO service_role;