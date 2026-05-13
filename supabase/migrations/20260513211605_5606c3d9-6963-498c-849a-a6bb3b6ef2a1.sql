
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz,
  ADD COLUMN IF NOT EXISTS total_wait_seconds integer NOT NULL DEFAULT 0;

UPDATE public.chat_conversations
SET waiting_since = updated_at
WHERE status = 'open' AND assigned_to IS NULL AND waiting_since IS NULL;

CREATE OR REPLACE FUNCTION public.trg_chat_conv_wait_on_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
    IF OLD.waiting_since IS NOT NULL THEN
      NEW.total_wait_seconds := COALESCE(OLD.total_wait_seconds,0)
        + GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.waiting_since))::int);
    END IF;
    NEW.waiting_since := NULL;
  END IF;

  IF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
    NEW.waiting_since := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_conv_wait_on_assign ON public.chat_conversations;
CREATE TRIGGER chat_conv_wait_on_assign
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.trg_chat_conv_wait_on_assign();

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
     SET waiting_since = NEW.created_at
   WHERE id = NEW.conversation_id
     AND status = 'open'
     AND assigned_to IS NULL
     AND waiting_since IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_msg_start_waiting ON public.chat_messages;
CREATE TRIGGER chat_msg_start_waiting
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_chat_msg_start_waiting();

DROP FUNCTION IF EXISTS public.get_chat_inbox(uuid, text);

CREATE OR REPLACE FUNCTION public.get_chat_inbox(p_user uuid, p_tab text)
 RETURNS TABLE(id uuid, name text, status text, assigned_to uuid, whatsapp_phone text, client_id uuid, avatar_url text, is_group boolean, created_at timestamp with time zone, updated_at timestamp with time zone, last_message text, last_message_at timestamp with time zone, last_message_type text, unread_count integer, assigned_to_name text, waiting_since timestamp with time zone, total_wait_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.name, c.status, c.assigned_to, c.whatsapp_phone, c.client_id,
    c.avatar_url, c.is_group, c.created_at, c.updated_at,
    CASE WHEN lm.deleted_at IS NOT NULL THEN '🚫 Mensagem apagada' ELSE lm.content END AS last_message,
    lm.created_at AS last_message_at,
    lm.message_type AS last_message_type,
    COALESCE(uc.cnt, 0)::int AS unread_count,
    p.full_name AS assigned_to_name,
    c.waiting_since,
    c.total_wait_seconds
  FROM public.chat_conversations c
  LEFT JOIN LATERAL (
    SELECT content, created_at, message_type, deleted_at
    FROM public.chat_messages
    WHERE conversation_id = c.id AND NOT (p_user = ANY(deleted_for))
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM public.chat_messages
    WHERE conversation_id = c.id
      AND message_type NOT IN ('text','whatsapp_outgoing')
      AND read_at IS NULL AND deleted_at IS NULL
      AND NOT (p_user = ANY(deleted_for))
  ) uc ON true
  LEFT JOIN public.profiles p ON p.user_id = c.assigned_to
  WHERE CASE p_tab
    WHEN 'mine'        THEN c.assigned_to = p_user AND c.status = 'open'
    WHEN 'in_progress' THEN c.status = 'open' AND c.assigned_to IS NULL
    ELSE TRUE
  END
  ORDER BY COALESCE(lm.created_at, c.updated_at) DESC;
$function$;
