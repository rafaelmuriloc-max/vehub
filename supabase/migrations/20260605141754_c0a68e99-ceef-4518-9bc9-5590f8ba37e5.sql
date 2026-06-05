
ALTER TABLE public.obligation_activity_completions
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS activity_id uuid,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_instance_activity
  ON public.whatsapp_logs(instance_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_obligation_activity_completions_retry
  ON public.obligation_activity_completions(instance_id, activity_id)
  WHERE completed = false;
