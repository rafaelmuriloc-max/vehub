ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS accountant_certificate_url text,
  ADD COLUMN IF NOT EXISTS accountant_certificate_password text,
  ADD COLUMN IF NOT EXISTS accountant_certificate_expiry date,
  ADD COLUMN IF NOT EXISTS accountant_cpf text;