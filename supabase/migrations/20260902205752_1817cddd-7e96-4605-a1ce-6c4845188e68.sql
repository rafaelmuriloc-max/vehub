CREATE TABLE public.nfe_sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_date date NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running',
  lease_expires_at timestamp with time zone NOT NULL DEFAULT now() + interval '30 minutes',
  clients_total integer NOT NULL DEFAULT 0,
  clients_processed integer NOT NULL DEFAULT 0,
  nfe_success integer NOT NULL DEFAULT 0,
  nfe_errors integer NOT NULL DEFAULT 0,
  nfse_success integer NOT NULL DEFAULT 0,
  nfse_errors integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nfe_sync_runs TO authenticated;
GRANT ALL ON public.nfe_sync_runs TO service_role;

ALTER TABLE public.nfe_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sync runs"
ON public.nfe_sync_runs FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_nfe_sync_runs_started_at ON public.nfe_sync_runs (started_at DESC);
CREATE INDEX idx_nfe_sync_runs_status ON public.nfe_sync_runs (status);

CREATE TRIGGER trg_nfe_sync_runs_updated
BEFORE UPDATE ON public.nfe_sync_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();