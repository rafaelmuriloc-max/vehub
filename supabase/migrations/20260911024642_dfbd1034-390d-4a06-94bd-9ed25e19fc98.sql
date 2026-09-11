CREATE OR REPLACE FUNCTION public.get_calendar_month_completions(p_start date, p_end date)
RETURNS TABLE(
  id uuid,
  instance_id uuid,
  activity_id uuid,
  completed boolean,
  file_url text,
  notes text,
  completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT DISTINCT
    c.id,
    c.instance_id,
    c.activity_id,
    c.completed,
    c.file_url,
    c.notes,
    c.completed_at
  FROM public.obligation_activity_completions c
  JOIN public.obligation_instances i ON i.id = c.instance_id
  WHERE (i.reference_month >= p_start AND i.reference_month < p_end)
     OR (i.due_date >= p_start AND i.due_date < p_end);
$function$;

REVOKE ALL ON FUNCTION public.get_calendar_month_completions(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_month_completions(date, date) TO authenticated, service_role;