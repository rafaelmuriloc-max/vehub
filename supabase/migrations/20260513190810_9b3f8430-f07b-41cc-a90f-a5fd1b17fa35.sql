UPDATE public.chat_conversations
   SET status = 'closed',
       updated_at = now()
 WHERE status = 'open'
   AND assigned_to IS NULL;