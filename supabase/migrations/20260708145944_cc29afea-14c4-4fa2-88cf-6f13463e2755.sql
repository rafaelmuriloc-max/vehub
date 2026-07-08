CREATE OR REPLACE FUNCTION public.trg_client_end_date_soft_delete_obligations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.end_date IS DISTINCT FROM OLD.end_date) THEN
    UPDATE public.obligation_instances
       SET deleted_at = now()
     WHERE client_id = NEW.id
       AND deleted_at IS NULL
       AND (
         (due_date IS NOT NULL AND due_date >= NEW.end_date)
         OR (due_date IS NULL AND reference_month >= date_trunc('month', NEW.end_date)::date)
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_end_date_soft_delete_obligations ON public.clients;
CREATE TRIGGER clients_end_date_soft_delete_obligations
AFTER INSERT OR UPDATE OF end_date ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.trg_client_end_date_soft_delete_obligations();

-- Backfill: aplicar aos clientes que já possuem end_date
UPDATE public.obligation_instances oi
   SET deleted_at = now()
  FROM public.clients c
 WHERE oi.client_id = c.id
   AND c.end_date IS NOT NULL
   AND oi.deleted_at IS NULL
   AND (
     (oi.due_date IS NOT NULL AND oi.due_date >= c.end_date)
     OR (oi.due_date IS NULL AND oi.reference_month >= date_trunc('month', c.end_date)::date)
   );