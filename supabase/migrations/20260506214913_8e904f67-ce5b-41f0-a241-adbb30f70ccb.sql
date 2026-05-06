-- Function: recompute obligation_instance.status from completions
CREATE OR REPLACE FUNCTION public.recalc_obligation_instance_status(_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _obligation_id uuid;
  _total int;
  _done int;
  _new_status obligation_status;
BEGIN
  SELECT obligation_id INTO _obligation_id FROM obligation_instances WHERE id = _instance_id;
  IF _obligation_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO _total FROM obligation_activities WHERE obligation_id = _obligation_id;
  SELECT count(*) INTO _done
    FROM obligation_activity_completions oac
    JOIN obligation_activities oa ON oa.id = oac.activity_id
    WHERE oac.instance_id = _instance_id
      AND oac.completed = true
      AND oa.obligation_id = _obligation_id;

  IF _total = 0 OR _done = 0 THEN
    _new_status := 'pending';
  ELSIF _done >= _total THEN
    _new_status := 'done';
  ELSE
    _new_status := 'in_progress';
  END IF;

  UPDATE obligation_instances
     SET status = _new_status
   WHERE id = _instance_id
     AND status IS DISTINCT FROM _new_status;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_recalc_instance_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_obligation_instance_status(OLD.instance_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_obligation_instance_status(NEW.instance_id);
    IF TG_OP = 'UPDATE' AND OLD.instance_id IS DISTINCT FROM NEW.instance_id THEN
      PERFORM public.recalc_obligation_instance_status(OLD.instance_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_oac_recalc_status ON public.obligation_activity_completions;
CREATE TRIGGER trg_oac_recalc_status
AFTER INSERT OR UPDATE OR DELETE ON public.obligation_activity_completions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_instance_status();

-- Backfill: recalc status of every existing instance
WITH stats AS (
  SELECT oi.id AS instance_id,
    (SELECT count(*) FROM obligation_activities oa WHERE oa.obligation_id = oi.obligation_id) AS total,
    (SELECT count(*) FROM obligation_activity_completions oac
       JOIN obligation_activities oa ON oa.id = oac.activity_id
      WHERE oac.instance_id = oi.id AND oac.completed = true AND oa.obligation_id = oi.obligation_id) AS done
  FROM obligation_instances oi
), computed AS (
  SELECT instance_id,
    CASE
      WHEN total = 0 OR done = 0 THEN 'pending'::obligation_status
      WHEN done >= total THEN 'done'::obligation_status
      ELSE 'in_progress'::obligation_status
    END AS new_status
  FROM stats
)
UPDATE obligation_instances oi
   SET status = c.new_status
  FROM computed c
 WHERE c.instance_id = oi.id
   AND oi.status IS DISTINCT FROM c.new_status;