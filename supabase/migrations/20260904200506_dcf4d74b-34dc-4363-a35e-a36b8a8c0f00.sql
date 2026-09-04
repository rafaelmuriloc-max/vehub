ALTER TABLE public.tasks ADD COLUMN completed_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.trg_tasks_set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := now();
  ELSIF NEW.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_completed_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_set_completed_at();

UPDATE public.tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;