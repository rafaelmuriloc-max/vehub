ALTER TABLE public.nfe_sync_runs
  ADD COLUMN IF NOT EXISTS nfe_manifestadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfe_xml_completos integer NOT NULL DEFAULT 0;