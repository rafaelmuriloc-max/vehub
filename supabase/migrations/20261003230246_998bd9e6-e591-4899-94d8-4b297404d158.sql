CREATE OR REPLACE FUNCTION public.portal_employees(_client_id uuid)
RETURNS TABLE(id uuid, employee_code text, full_name text, cpf_masked text, "position" text, admission_date date, salary numeric, termination_date date, status text, trial_end_1 date, trial_days_1 integer, trial_end_2 date, trial_days_2 integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.employee_code, e.full_name,
    CASE WHEN length(regexp_replace(coalesce(e.cpf,''),'\D','','g')) >= 3
      THEN '***.***.*' || substr(right(regexp_replace(e.cpf,'\D','','g'),3),1,1) || '-' || right(regexp_replace(e.cpf,'\D','','g'),2)
      ELSE NULL END,
    e.position, e.admission_date, e.salary, e.termination_date, e.status,
    e.trial_end_1, e.trial_days_1, e.trial_end_2, e.trial_days_2
  FROM client_employees e
  WHERE e.client_id = _client_id AND public.portal_can_access_client(auth.uid(), _client_id)
  ORDER BY e.full_name
$$;

CREATE OR REPLACE FUNCTION public.portal_payroll(_client_id uuid)
RETURNS TABLE(competence date, active_count integer, admitted_count integer, dismissed_count integer, qty_employees integer, gross numeric, net numeric, fgts_value numeric, inss_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.competence, p.active_count, p.admitted_count, p.dismissed_count, p.qty_employees, p.gross, p.net, p.fgts_value, p.inss_value
  FROM payroll_summaries p
  WHERE p.client_id = _client_id AND public.portal_can_access_client(auth.uid(), _client_id)
  ORDER BY p.competence
$$;

CREATE OR REPLACE FUNCTION public.portal_vacations(_client_id uuid)
RETURNS TABLE(id uuid, employee_id uuid, employee_name text, acquisition_start date, acquisition_end date, days_right numeric, enjoy_start date, enjoy_end date, deadline_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.employee_id, e.full_name, v.acquisition_start, v.acquisition_end, v.days_right, v.enjoy_start, v.enjoy_end, v.deadline_date
  FROM employee_vacation_periods v JOIN client_employees e ON e.id = v.employee_id
  WHERE v.client_id = _client_id AND public.portal_can_access_client(auth.uid(), _client_id)
  ORDER BY v.deadline_date NULLS LAST
$$;

REVOKE ALL ON FUNCTION public.portal_employees(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.portal_payroll(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.portal_vacations(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.portal_employees(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_payroll(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_vacations(uuid) TO authenticated;