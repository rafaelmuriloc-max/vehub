
-- ============================================================
-- Merge duplicate WhatsApp conversations created by the missing
-- "9" celular digit bug in scheduled-messages-runner.
-- For each client that has BOTH a 13-digit canonical conv and a
-- 12-digit duplicate that maps to the same canonical number,
-- move messages/participants to the canonical conv and drop dup.
-- ============================================================
DO $$
DECLARE
  pair RECORD;
  canonical_id uuid;
  dup_id uuid;
BEGIN
  FOR pair IN
    WITH convs AS (
      SELECT id, client_id, whatsapp_phone, updated_at,
             CASE
               WHEN length(whatsapp_phone) = 13
                    AND left(whatsapp_phone,2) = '55'
                    AND substr(whatsapp_phone,5,1) = '9'
                 THEN whatsapp_phone
               WHEN length(whatsapp_phone) = 12
                    AND left(whatsapp_phone,2) = '55'
                    AND substr(whatsapp_phone,5,1) IN ('6','7','8','9')
                 THEN substr(whatsapp_phone,1,4) || '9' || substr(whatsapp_phone,5)
               ELSE NULL
             END AS canonical_phone
      FROM public.chat_conversations
      WHERE is_group = false
        AND client_id IS NOT NULL
        AND whatsapp_phone IS NOT NULL
    )
    SELECT client_id, canonical_phone,
           array_agg(id ORDER BY length(whatsapp_phone) DESC, updated_at DESC) AS ids,
           array_agg(whatsapp_phone ORDER BY length(whatsapp_phone) DESC, updated_at DESC) AS phones
    FROM convs
    WHERE canonical_phone IS NOT NULL
    GROUP BY client_id, canonical_phone
    HAVING COUNT(*) > 1
       AND COUNT(DISTINCT whatsapp_phone) > 1
  LOOP
    -- Keep the 13-digit (canonical-length) conv as the survivor.
    canonical_id := pair.ids[1];

    -- Iterate over every other conv in the group and merge into canonical.
    FOR i IN 2..array_length(pair.ids, 1) LOOP
      dup_id := pair.ids[i];

      -- Move messages.
      UPDATE public.chat_messages
         SET conversation_id = canonical_id
       WHERE conversation_id = dup_id;

      -- Merge participants without violating uniqueness.
      INSERT INTO public.chat_participants (conversation_id, user_id)
      SELECT canonical_id, user_id
        FROM public.chat_participants
       WHERE conversation_id = dup_id
         AND user_id NOT IN (
           SELECT user_id FROM public.chat_participants WHERE conversation_id = canonical_id
         );

      DELETE FROM public.chat_participants WHERE conversation_id = dup_id;
      DELETE FROM public.chat_conversations WHERE id = dup_id;
    END LOOP;

    -- Ensure canonical conv has the canonical phone format and refresh timestamp.
    UPDATE public.chat_conversations
       SET whatsapp_phone = pair.canonical_phone,
           updated_at = now()
     WHERE id = canonical_id;
  END LOOP;
END $$;

-- Corrige cadastro do telefone do PORTO PENHA FOOD PARK LTDA
UPDATE public.clients
   SET contact_phone = '(47) 99283-9913'
 WHERE id = 'a4b6b030-204c-4ca8-9f80-c66a5653f142'
   AND contact_phone = '(47) 92839913';
