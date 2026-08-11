CREATE OR REPLACE FUNCTION public.trg_cdo_insert_restore_future_obligations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.obligation_instances oi
     SET deleted_at = NULL
   WHERE oi.client_id = NEW.client_id
     AND oi.obligation_id = NEW.obligation_id
     AND oi.deleted_at IS NOT NULL
     AND oi.status <> 'done'
     AND (
       (oi.due_date IS NOT NULL AND oi.due_date >= CURRENT_DATE)
       OR (oi.due_date IS NULL AND oi.reference_month >= date_trunc('month', CURRENT_DATE)::date)
     )
     AND EXISTS (
       SELECT 1 FROM public.clients c
        WHERE c.id = oi.client_id
          AND c.end_date IS NULL
     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cdo_insert_restore_future ON public.client_department_obligations;
CREATE TRIGGER trg_cdo_insert_restore_future
AFTER INSERT ON public.client_department_obligations
FOR EACH ROW EXECUTE FUNCTION public.trg_cdo_insert_restore_future_obligations();