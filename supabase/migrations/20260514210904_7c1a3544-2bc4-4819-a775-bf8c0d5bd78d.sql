ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid,
  ADD COLUMN IF NOT EXISTS reply_to_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id ON public.chat_messages(reply_to_id);