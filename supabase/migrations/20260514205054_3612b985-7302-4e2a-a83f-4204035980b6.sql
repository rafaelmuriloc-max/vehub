CREATE OR REPLACE FUNCTION public.get_chat_inbox(p_user uuid, p_tab text)
 RETURNS TABLE(id uuid, name text, status text, assigned_to uuid, whatsapp_phone text, client_id uuid, avatar_url text, is_group boolean, created_at timestamp with time zone, updated_at timestamp with time zone, last_message text, last_message_at timestamp with time zone, last_message_type text, unread_count integer, assigned_to_name text, assigned_to_color text, waiting_since timestamp with time zone, total_wait_seconds integer)
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
    p.tag_color AS assigned_to_color,
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
      AND message_type LIKE 'whatsapp_incoming%'
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