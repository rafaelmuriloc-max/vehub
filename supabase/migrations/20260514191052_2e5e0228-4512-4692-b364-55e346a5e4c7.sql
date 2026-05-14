CREATE OR REPLACE FUNCTION public.trg_chat_msg_start_waiting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.message_type IN ('text','whatsapp_outgoing') THEN
    RETURN NEW;
  END IF;

  UPDATE public.chat_conversations
     SET waiting_since = NEW.created_at,
         updated_at = GREATEST(updated_at, NEW.created_at)
   WHERE id = NEW.conversation_id
     AND status = 'open'
     AND assigned_to IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_msg_start_waiting ON public.chat_messages;
CREATE TRIGGER chat_msg_start_waiting
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_chat_msg_start_waiting();

UPDATE public.chat_conversations c
SET waiting_since = latest.last_incoming_at
FROM (
  SELECT conversation_id, max(created_at) AS last_incoming_at
  FROM public.chat_messages
  WHERE message_type NOT IN ('text','whatsapp_outgoing')
    AND deleted_at IS NULL
  GROUP BY conversation_id
) latest
WHERE c.id = latest.conversation_id
  AND c.status = 'open'
  AND c.assigned_to IS NULL
  AND c.waiting_since IS DISTINCT FROM latest.last_incoming_at;