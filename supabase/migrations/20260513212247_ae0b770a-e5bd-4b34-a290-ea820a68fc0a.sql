UPDATE public.chat_conversations
SET waiting_since = COALESCE(waiting_since, updated_at)
WHERE status='open' AND assigned_to IS NULL AND waiting_since IS NULL;