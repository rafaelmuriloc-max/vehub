CREATE OR REPLACE FUNCTION public.get_calendar_month_completions(p_start date, p_end date)
RETURNS TABLE(id uuid, instance_id uuid, activity_id uuid, completed boolean, file_url text, notes text, completed_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH allowed_dept AS (
    SELECT d.id
    FROM public.departments d
    WHERE public.user_can_access_department(auth.uid(), d.id)
  ),
  inst AS (
    SELECT i.id FROM public.obligation_instances i
    WHERE i.reference_month >= p_start AND i.reference_month < p_end
    UNION
    SELECT i.id FROM public.obligation_instances i
    WHERE i.due_date >= p_start AND i.due_date < p_end
  ),
  allowed_act AS (
    SELECT oa.id
    FROM public.obligation_activities oa
    JOIN public.obligations o ON o.id = oa.obligation_id
    WHERE o.department_id IN (SELECT id FROM allowed_dept)
  )
  SELECT c.id, c.instance_id, c.activity_id, c.completed, c.file_url, c.notes, c.completed_at
  FROM public.obligation_activity_completions c
  JOIN inst ON inst.id = c.instance_id
  WHERE c.activity_id IN (SELECT id FROM allowed_act);
$function$;

GRANT EXECUTE ON FUNCTION public.get_calendar_month_completions(date, date) TO authenticated, service_role;