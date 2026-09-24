CREATE TABLE public.payroll_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  competence date NOT NULL,
  qty_total integer NOT NULL DEFAULT 0,
  qty_employees integer NOT NULL DEFAULT 0,
  qty_employers integer NOT NULL DEFAULT 0,
  qty_autonomous integer NOT NULL DEFAULT 0,
  qty_interns integer NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0,
  discounts numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  inss_base numeric NOT NULL DEFAULT 0,
  inss_value numeric NOT NULL DEFAULT 0,
  fgts_base numeric NOT NULL DEFAULT 0,
  fgts_value numeric NOT NULL DEFAULT 0,
  irrf_base numeric NOT NULL DEFAULT 0,
  active_count integer NOT NULL DEFAULT 0,
  admitted_count integer NOT NULL DEFAULT 0,
  dismissed_count integer NOT NULL DEFAULT 0,
  source_file text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, competence)
);
GRANT SELECT ON public.payroll_summaries TO authenticated;
GRANT ALL ON public.payroll_summaries TO service_role;
ALTER TABLE public.payroll_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payroll summaries" ON public.payroll_summaries FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_payroll_summaries_updated_at BEFORE UPDATE ON public.payroll_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();