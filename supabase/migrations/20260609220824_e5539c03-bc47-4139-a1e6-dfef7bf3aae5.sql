
-- 1) Merge duplicates: for each whatsapp_phone with multiple non-group conversations,
-- pick the oldest as primary and move children to it; then delete extras.
DO $$
DECLARE
  rec RECORD;
  primary_id uuid;
  dup_id uuid;
  primary_row public.chat_conversations%ROWTYPE;
BEGIN
  FOR rec IN
    SELECT whatsapp_phone, array_agg(id ORDER BY created_at) AS ids
    FROM public.chat_conversations
    WHERE whatsapp_phone IS NOT NULL AND is_group = false
    GROUP BY whatsapp_phone
    HAVING count(*) > 1
  LOOP
    primary_id := rec.ids[1];
    SELECT * INTO primary_row FROM public.chat_conversations WHERE id = primary_id;

    FOREACH dup_id IN ARRAY rec.ids[2:array_length(rec.ids, 1)]
    LOOP
      -- messages
      UPDATE public.chat_messages SET conversation_id = primary_id WHERE conversation_id = dup_id;

      -- participants (avoid PK conflict)
      INSERT INTO public.chat_participants (conversation_id, user_id)
      SELECT primary_id, user_id FROM public.chat_participants
      WHERE conversation_id = dup_id
      ON CONFLICT DO NOTHING;
      DELETE FROM public.chat_participants WHERE conversation_id = dup_id;

      -- triage learnings
      UPDATE public.triage_learnings SET conversation_id = primary_id WHERE conversation_id = dup_id;

      -- inherit useful metadata if primary is missing it
      UPDATE public.chat_conversations p
        SET client_id   = COALESCE(p.client_id, d.client_id),
            avatar_url  = COALESCE(p.avatar_url, d.avatar_url),
            name_locked = COALESCE(p.name_locked, d.name_locked),
            updated_at  = GREATEST(p.updated_at, d.updated_at)
        FROM public.chat_conversations d
        WHERE p.id = primary_id AND d.id = dup_id;

      DELETE FROM public.chat_conversations WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- 2) Prevent future race-condition duplicates
CREATE UNIQUE INDEX IF NOT EXISTS chat_conv_unique_phone
  ON public.chat_conversations (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL AND is_group = false;
