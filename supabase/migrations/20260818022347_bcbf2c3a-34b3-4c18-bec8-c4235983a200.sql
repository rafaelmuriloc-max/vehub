ALTER TABLE public.obligation_instances
  ADD COLUMN IF NOT EXISTS on_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS hold_at timestamptz,
  ADD COLUMN IF NOT EXISTS hold_by uuid;