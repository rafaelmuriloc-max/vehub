
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS chat_alert_whatsapp_group_id text;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS last_wait_alert_at timestamp with time zone;
