CREATE TABLE public.employee_vacation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.client_employees(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  acquisition_start date,
  acquisition_end date,
  days_right numeric,
  enjoy_start date,
  enjoy_end date,
  deadline_date date,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX employee_vacation_periods_unique ON public.employee_vacation_periods (employee_id, acquisition_start);
CREATE INDEX employee_vacation_periods_client_idx ON public.employee_vacation_periods (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_vacation_periods TO authenticated;
GRANT ALL ON public.employee_vacation_periods TO service_role;

ALTER TABLE public.employee_vacation_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vacation periods" ON public.employee_vacation_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vacation periods" ON public.employee_vacation_periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vacation periods" ON public.employee_vacation_periods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete vacation periods" ON public.employee_vacation_periods FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_employee_vacation_periods_updated_at
BEFORE UPDATE ON public.employee_vacation_periods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();