ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS wa_remote_jid text;

CREATE INDEX IF NOT EXISTS idx_chat_messages_wa_id ON public.chat_messages(wa_message_id);