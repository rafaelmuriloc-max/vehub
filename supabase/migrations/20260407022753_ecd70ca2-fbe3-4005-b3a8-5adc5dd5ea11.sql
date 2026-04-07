
-- Consolidate duplicate conversations by canonical phone
-- For each duplicate group, keep the conversation with the most messages

DO $$
DECLARE
  rec RECORD;
  primary_id UUID;
  dup_id UUID;
  canonical TEXT;
BEGIN
  FOR rec IN
    WITH phone_groups AS (
      SELECT 
        CASE 
          WHEN length(whatsapp_phone) = 12 AND left(whatsapp_phone, 2) = '55' 
               AND substring(whatsapp_phone, 5, 1) IN ('6','7','8','9')
          THEN left(whatsapp_phone, 4) || '9' || substring(whatsapp_phone, 5)
          ELSE whatsapp_phone
        END AS canonical_phone,
        id,
        status,
        (SELECT count(*) FROM chat_messages WHERE conversation_id = cc.id) AS msg_count
      FROM chat_conversations cc
      WHERE whatsapp_phone IS NOT NULL
    )
    SELECT canonical_phone, 
           array_agg(id ORDER BY 
             CASE WHEN status = 'open' THEN 0 ELSE 1 END,
             msg_count DESC
           ) AS conv_ids
    FROM phone_groups
    GROUP BY canonical_phone
    HAVING count(*) > 1
  LOOP
    primary_id := rec.conv_ids[1];
    canonical := rec.canonical_phone;

    -- Process each duplicate (skip index 1 which is primary)
    FOR i IN 2..array_length(rec.conv_ids, 1) LOOP
      dup_id := rec.conv_ids[i];

      -- Move messages to primary
      UPDATE chat_messages SET conversation_id = primary_id WHERE conversation_id = dup_id;

      -- Move participants (skip if already exists)
      INSERT INTO chat_participants (conversation_id, user_id)
      SELECT primary_id, cp.user_id 
      FROM chat_participants cp
      WHERE cp.conversation_id = dup_id
        AND NOT EXISTS (
          SELECT 1 FROM chat_participants 
          WHERE conversation_id = primary_id AND user_id = cp.user_id
        );

      -- Delete duplicate participants
      DELETE FROM chat_participants WHERE conversation_id = dup_id;

      -- Delete the duplicate conversation
      DELETE FROM chat_conversations WHERE id = dup_id;
    END LOOP;

    -- Update primary conversation's phone to canonical format
    UPDATE chat_conversations 
    SET whatsapp_phone = canonical,
        updated_at = now()
    WHERE id = primary_id;
  END LOOP;
END $$;
