UPDATE public.chat_conversations
SET status = 'closed', closed_at = now()
WHERE status = 'open' AND assigned_to IS NULL;