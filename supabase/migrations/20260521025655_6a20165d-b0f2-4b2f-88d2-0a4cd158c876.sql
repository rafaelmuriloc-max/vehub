ALTER TABLE public.obligation_instances
ADD COLUMN IF NOT EXISTS completion_kind text;