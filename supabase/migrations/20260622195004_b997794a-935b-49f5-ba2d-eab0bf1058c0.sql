ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS triage_direct_route_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS triage_direct_route_department_id uuid,
  ADD COLUMN IF NOT EXISTS triage_direct_route_user_id uuid;