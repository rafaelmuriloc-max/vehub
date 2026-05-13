UPDATE public.chat_conversations c
SET status = 'open', closed_at = NULL
WHERE c.status = 'closed'
  AND c.assigned_to IS NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.conversation_id = c.id
      AND m.message_type LIKE 'whatsapp_incoming%'
      AND (c.closed_at IS NULL OR m.created_at > c.closed_at)
  );