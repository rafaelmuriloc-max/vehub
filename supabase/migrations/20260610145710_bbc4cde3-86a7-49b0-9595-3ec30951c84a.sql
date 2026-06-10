CREATE UNIQUE INDEX IF NOT EXISTS obligation_activity_completions_unique_marker
  ON public.obligation_activity_completions (instance_id, activity_id)
  WHERE file_url IS NULL;