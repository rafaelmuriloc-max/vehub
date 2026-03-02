
-- Fiscal fields
ALTER TABLE public.clients ADD COLUMN tax_regime text;
ALTER TABLE public.clients ADD COLUMN main_activity text;
ALTER TABLE public.clients ADD COLUMN secondary_activities text;
ALTER TABLE public.clients ADD COLUMN state_registration text;
ALTER TABLE public.clients ADD COLUMN municipal_registration text;

-- Pessoal fields
ALTER TABLE public.clients ADD COLUMN payroll_type text;
ALTER TABLE public.clients ADD COLUMN employee_count integer DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN payroll_notes text;

-- Societário fields
ALTER TABLE public.clients ADD COLUMN permits text;
ALTER TABLE public.clients ADD COLUMN digital_certificate_expiry date;
ALTER TABLE public.clients ADD COLUMN digital_certificate_type text;
ALTER TABLE public.clients ADD COLUMN partners_info text;

-- Sucesso do Cliente fields
ALTER TABLE public.clients ADD COLUMN company_description text;
ALTER TABLE public.clients ADD COLUMN business_segment text;
ALTER TABLE public.clients ADD COLUMN foundation_date date;
ALTER TABLE public.clients ADD COLUMN success_notes text;
