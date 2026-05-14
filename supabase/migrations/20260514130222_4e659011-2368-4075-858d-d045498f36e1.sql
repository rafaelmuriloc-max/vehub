DO $$
DECLARE
  grp RECORD;
  keep_id uuid;
  dup_id uuid;
BEGIN
  FOR grp IN
    WITH norm AS (
      SELECT id, whatsapp_phone, created_at,
        (WITH d AS (SELECT regexp_replace(whatsapp_phone, '\D', '', 'g') AS x)
         SELECT CASE
           WHEN length(d.x) = 12 AND d.x LIKE '55%' AND substr(d.x,5,1) IN ('6','7','8','9')
             THEN substr(d.x,1,4) || '9' || substr(d.x,5)
           WHEN length(d.x) IN (10,11) AND d.x NOT LIKE '55%'
             THEN '55' || d.x
           ELSE d.x
         END FROM d) AS canonical
      FROM public.chat_conversations
      WHERE whatsapp_phone IS NOT NULL
    )
    SELECT canonical, array_agg(id ORDER BY created_at) AS ids
    FROM norm
    WHERE canonical IS NOT NULL
    GROUP BY canonical HAVING count(*) > 1
  LOOP
    keep_id := grp.ids[1];

    FOREACH dup_id IN ARRAY grp.ids[2:array_length(grp.ids,1)] LOOP
      -- Move mensagens
      UPDATE public.chat_messages
        SET conversation_id = keep_id
        WHERE conversation_id = dup_id;

      -- Move participantes (evitando colisão com unique)
      INSERT INTO public.chat_participants (conversation_id, user_id, joined_at)
        SELECT keep_id, p.user_id, p.joined_at
        FROM public.chat_participants p
        WHERE p.conversation_id = dup_id
          AND NOT EXISTS (
            SELECT 1 FROM public.chat_participants p2
            WHERE p2.conversation_id = keep_id AND p2.user_id = p.user_id
          );

      DELETE FROM public.chat_participants WHERE conversation_id = dup_id;
      DELETE FROM public.chat_conversations WHERE id = dup_id;
    END LOOP;

    -- Garante telefone canônico na conversa preservada
    UPDATE public.chat_conversations
      SET whatsapp_phone = grp.canonical,
          updated_at = now()
      WHERE id = keep_id
        AND whatsapp_phone IS DISTINCT FROM grp.canonical;
  END LOOP;
END $$;