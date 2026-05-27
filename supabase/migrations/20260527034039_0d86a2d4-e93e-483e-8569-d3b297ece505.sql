ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS services_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS services_suspended_at timestamptz NULL;