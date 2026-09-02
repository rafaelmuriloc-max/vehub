CREATE OR REPLACE FUNCTION public.trg_ticket_normalize_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND NEW.closed_at < NEW.opened_at THEN
    NEW.closed_at := NEW.opened_at;
  END IF;

  IF NEW.closed_at IS NOT NULL THEN
    NEW.handle_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.closed_at - NEW.opened_at))::int);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_ticket_normalize_dates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ticket_normalize_dates ON public.support_tickets;
CREATE TRIGGER ticket_normalize_dates
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_normalize_dates();