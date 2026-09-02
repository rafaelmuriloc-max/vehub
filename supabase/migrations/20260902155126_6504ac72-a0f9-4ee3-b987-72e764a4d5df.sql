CREATE OR REPLACE FUNCTION public.resolve_client_by_phone(_phone text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text;
  local10 text;
  local11 text;
  v_id uuid;
  v_count int;
BEGIN
  IF _phone IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_phone, '\D', '', 'g');
  IF length(d) < 10 THEN RETURN NULL; END IF;
  IF length(d) > 11 AND left(d, 2) = '55' THEN d := substr(d, 3); END IF;
  IF length(d) = 11 THEN
    local11 := d;
    local10 := left(d, 2) || substr(d, 4);
  ELSIF length(d) = 10 THEN
    local10 := d;
    local11 := left(d, 2) || '9' || substr(d, 3);
  ELSE
    RETURN NULL;
  END IF;

  WITH matches AS (
    SELECT c.id AS cid
      FROM public.clients c
     WHERE regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') <> ''
       AND (regexp_replace(c.contact_phone, '\D', '', 'g') LIKE '%' || local10
            OR regexp_replace(c.contact_phone, '\D', '', 'g') LIKE '%' || local11)
    UNION
    SELECT cdc.client_id
      FROM public.client_department_contacts cdc
     WHERE regexp_replace(coalesce(cdc.contact_phone, ''), '\D', '', 'g') <> ''
       AND (regexp_replace(cdc.contact_phone, '\D', '', 'g') LIKE '%' || local10
            OR regexp_replace(cdc.contact_phone, '\D', '', 'g') LIKE '%' || local11)
  )
  SELECT count(*), (array_agg(cid))[1] INTO v_count, v_id FROM matches;

  IF v_count = 1 THEN RETURN v_id; END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_client_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_by_phone(text) TO service_role;