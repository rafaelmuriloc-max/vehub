UPDATE public.chat_conversations
SET whatsapp_phone = '55' || regexp_replace(whatsapp_phone, '\D', '', 'g')
WHERE whatsapp_phone IS NOT NULL
  AND length(regexp_replace(whatsapp_phone, '\D', '', 'g')) IN (10, 11)
  AND regexp_replace(whatsapp_phone, '\D', '', 'g') NOT LIKE '55%';