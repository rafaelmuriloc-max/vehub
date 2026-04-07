-- Consolidate duplicate chat conversations by whatsapp_phone
DO $$
DECLARE
  rec RECORD;
  primary_id UUID;
BEGIN
  -- For each whatsapp_phone with duplicates
  FOR rec IN
    SELECT whatsapp_phone
    FROM chat_conversations
    WHERE whatsapp_phone IS NOT NULL
    GROUP BY whatsapp_phone
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the conversation with the most messages as primary
    SELECT cc.id INTO primary_id
    FROM chat_conversations cc
    LEFT JOIN (
      SELECT conversation_id, COUNT(*) AS msg_count
      FROM chat_messages
      GROUP BY conversation_id
    ) mc ON mc.conversation_id = cc.id
    WHERE cc.whatsapp_phone = rec.whatsapp_phone
    ORDER BY COALESCE(mc.msg_count, 0) DESC, cc.created_at ASC
    LIMIT 1;

    -- Move messages from duplicates to primary
    UPDATE chat_messages
    SET conversation_id = primary_id
    WHERE conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE whatsapp_phone = rec.whatsapp_phone AND id != primary_id
    );

    -- Move participants (skip if already exists)
    INSERT INTO chat_participants (conversation_id, user_id)
    SELECT DISTINCT primary_id, cp.user_id
    FROM chat_participants cp
    WHERE cp.conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE whatsapp_phone = rec.whatsapp_phone AND id != primary_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_participants
      WHERE conversation_id = primary_id AND user_id = cp.user_id
    );

    -- Delete participants from duplicates
    DELETE FROM chat_participants
    WHERE conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE whatsapp_phone = rec.whatsapp_phone AND id != primary_id
    );

    -- Delete duplicate conversations
    DELETE FROM chat_conversations
    WHERE whatsapp_phone = rec.whatsapp_phone AND id != primary_id;
  END LOOP;
END $$;