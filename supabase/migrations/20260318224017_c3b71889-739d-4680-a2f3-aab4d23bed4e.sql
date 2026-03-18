ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS digital_certificate_url text,
  ADD COLUMN IF NOT EXISTS digital_certificate_password text,
  ADD COLUMN IF NOT EXISTS digital_certificate_expiry date;