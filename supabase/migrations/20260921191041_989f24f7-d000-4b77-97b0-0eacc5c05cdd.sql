ALTER TABLE public.client_employees
  ADD COLUMN IF NOT EXISTS trial_end_1 date,
  ADD COLUMN IF NOT EXISTS trial_days_1 integer,
  ADD COLUMN IF NOT EXISTS trial_end_2 date,
  ADD COLUMN IF NOT EXISTS trial_days_2 integer;