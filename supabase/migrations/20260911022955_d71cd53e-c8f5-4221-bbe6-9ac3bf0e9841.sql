CREATE OR REPLACE FUNCTION public.dashboard_client_counts(p_start date, p_end date)
RETURNS TABLE(active bigint, inactive bigint, novos bigint, churn bigint, suspended bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE status = 'active' AND without_monthly_fee = false),
    count(*) FILTER (WHERE status = 'inactive' AND without_monthly_fee = false),
    count(*) FILTER (WHERE without_monthly_fee = false AND start_date >= p_start AND start_date < p_end),
    count(*) FILTER (WHERE without_monthly_fee = false AND end_date >= p_start AND end_date < p_end),
    count(*) FILTER (WHERE status = 'active' AND services_suspended = true)
  FROM public.clients;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_task_counts(p_start date, p_end date, p_today date, p_today_start timestamptz, p_today_end timestamptz)
RETURNS TABLE(pending bigint, pending_no_date bigint, in_progress bigint, done bigint, overdue bigint, done_today bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE due_date >= p_start AND due_date < p_end AND status = 'todo'),
    count(*) FILTER (WHERE due_date IS NULL AND status = 'todo'),
    count(*) FILTER (WHERE due_date >= p_start AND due_date < p_end AND status IN ('in_progress','in_review')),
    count(*) FILTER (WHERE due_date >= p_start AND due_date < p_end AND status = 'done'),
    count(*) FILTER (WHERE due_date >= p_start AND due_date < p_today AND status <> 'done'),
    count(*) FILTER (WHERE status = 'done' AND updated_at >= p_today_start AND updated_at < p_today_end)
  FROM public.tasks;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_client_counts(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_task_counts(date, date, date, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_client_counts(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_task_counts(date, date, date, timestamptz, timestamptz) TO authenticated;