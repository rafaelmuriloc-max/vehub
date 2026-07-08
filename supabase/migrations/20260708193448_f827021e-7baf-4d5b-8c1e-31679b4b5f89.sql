
CREATE OR REPLACE FUNCTION public.trg_cdo_delete_soft_delete_future_obligations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.obligation_instances
     SET deleted_at = now()
   WHERE client_id = OLD.client_id
     AND obligation_id = OLD.obligation_id
     AND deleted_at IS NULL
     AND (
       (due_date IS NOT NULL AND due_date >= CURRENT_DATE)
       OR (due_date IS NULL AND reference_month >= date_trunc('month', CURRENT_DATE)::date)
     );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cdo_delete_soft_delete_future ON public.client_department_obligations;
CREATE TRIGGER trg_cdo_delete_soft_delete_future
AFTER DELETE ON public.client_department_obligations
FOR EACH ROW
EXECUTE FUNCTION public.trg_cdo_delete_soft_delete_future_obligations();
