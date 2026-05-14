ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_open_time time,
  ADD COLUMN IF NOT EXISTS service_close_time time,
  ADD COLUMN IF NOT EXISTS service_lunch_start time,
  ADD COLUMN IF NOT EXISTS service_lunch_end time,
  ADD COLUMN IF NOT EXISTS service_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS agent_name text,
  ADD COLUMN IF NOT EXISTS agent_offhours_message text,
  ADD COLUMN IF NOT EXISTS agent_offhours_last_sent jsonb NOT NULL DEFAULT '{}'::jsonb;