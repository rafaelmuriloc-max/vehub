CREATE INDEX IF NOT EXISTS idx_obligation_activity_completions_instance
  ON public.obligation_activity_completions (instance_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_incoming
  ON public.chat_messages (conversation_id)
  WHERE read_at IS NULL
    AND deleted_at IS NULL
    AND message_type LIKE 'whatsapp_incoming%';

CREATE INDEX IF NOT EXISTS idx_chat_conversations_status_assigned_updated
  ON public.chat_conversations (status, assigned_to, updated_at DESC);

CREATE OR REPLACE FUNCTION public.get_chat_inbox(p_user uuid, p_tab text)
RETURNS TABLE(
  id uuid,
  name text,
  status text,
  assigned_to uuid,
  whatsapp_phone text,
  client_id uuid,
  avatar_url text,
  is_group boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_message text,
  last_message_at timestamptz,
  last_message_type text,
  unread_count integer,
  assigned_to_name text,
  assigned_to_color text,
  waiting_since timestamptz,
  total_wait_seconds integer,
  awaiting_first_reply boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH filtered_conversations AS MATERIALIZED (
    SELECT c.*
    FROM public.chat_conversations c
    WHERE CASE p_tab
      WHEN 'mine' THEN c.assigned_to = p_user AND c.status = 'open'
      WHEN 'in_progress' THEN c.status = 'open' AND c.assigned_to IS NULL
      ELSE TRUE
    END
  ),
  latest_messages AS MATERIALIZED (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      m.message_type,
      m.deleted_at
    FROM public.chat_messages m
    JOIN filtered_conversations c ON c.id = m.conversation_id
    WHERE NOT (p_user = ANY(m.deleted_for))
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS MATERIALIZED (
    SELECT m.conversation_id, count(*)::integer AS cnt
    FROM public.chat_messages m
    JOIN filtered_conversations c ON c.id = m.conversation_id
    WHERE m.message_type LIKE 'whatsapp_incoming%'
      AND m.read_at IS NULL
      AND m.deleted_at IS NULL
      AND NOT (p_user = ANY(m.deleted_for))
    GROUP BY m.conversation_id
  )
  SELECT
    c.id,
    c.name,
    c.status,
    c.assigned_to,
    c.whatsapp_phone,
    c.client_id,
    c.avatar_url,
    c.is_group,
    c.created_at,
    c.updated_at,
    CASE WHEN lm.deleted_at IS NOT NULL THEN '🚫 Mensagem apagada' ELSE lm.content END,
    lm.created_at,
    lm.message_type,
    COALESCE(uc.cnt, 0),
    p.full_name,
    p.tag_color,
    c.waiting_since,
    c.total_wait_seconds,
    c.awaiting_first_reply
  FROM filtered_conversations c
  LEFT JOIN latest_messages lm ON lm.conversation_id = c.id
  LEFT JOIN unread_counts uc ON uc.conversation_id = c.id
  LEFT JOIN public.profiles p ON p.user_id = c.assigned_to
  ORDER BY COALESCE(lm.created_at, c.updated_at) DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_chat_inbox(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_inbox(uuid, text) TO authenticated, service_role;