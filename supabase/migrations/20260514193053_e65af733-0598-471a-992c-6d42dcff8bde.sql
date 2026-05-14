ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS last_inactivity_alert_at timestamptz;