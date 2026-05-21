ALTER TABLE public.parcelamento_results
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'RFB';

ALTER TABLE public.parcelamento_results
  DROP CONSTRAINT IF EXISTS parcelamento_results_origem_check;

ALTER TABLE public.parcelamento_results
  ADD CONSTRAINT parcelamento_results_origem_check CHECK (origem IN ('RFB','PGFN'));

CREATE INDEX IF NOT EXISTS idx_parcelamento_results_client_origem
  ON public.parcelamento_results(client_id, origem);