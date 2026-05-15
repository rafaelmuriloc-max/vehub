ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_message text,
  ADD COLUMN IF NOT EXISTS notify_email_subject text,
  ADD COLUMN IF NOT EXISTS notify_sent_at timestamptz;