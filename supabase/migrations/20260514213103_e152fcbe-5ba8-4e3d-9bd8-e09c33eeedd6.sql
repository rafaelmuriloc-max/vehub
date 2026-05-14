ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS wa_evolution_id text;
CREATE INDEX IF NOT EXISTS idx_chat_messages_evo_id ON public.chat_messages (conversation_id, wa_evolution_id);
UPDATE public.chat_messages
   SET wa_evolution_id = wa_message_id
 WHERE wa_evolution_id IS NULL
   AND wa_message_id IS NOT NULL
   AND wa_message_id NOT LIKE 'wamid.%';