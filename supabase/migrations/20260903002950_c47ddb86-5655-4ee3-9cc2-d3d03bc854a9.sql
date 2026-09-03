ALTER TABLE public.nfe_invoices
  ADD COLUMN IF NOT EXISTS manifest_status text,
  ADD COLUMN IF NOT EXISTS manifested_at timestamptz,
  ADD COLUMN IF NOT EXISTS manifest_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manifest_error text;