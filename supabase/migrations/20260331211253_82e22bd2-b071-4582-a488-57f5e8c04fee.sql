UPDATE chat_conversations cc
SET client_id = c.id,
    name = COALESCE(c.contact_name, c.company_name) || ' (WhatsApp)'
FROM clients c
WHERE cc.client_id IS NULL
  AND cc.name ~ '^WhatsApp \d+'
  AND c.contact_phone IS NOT NULL
  AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.contact_phone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') 
      LIKE '%' || RIGHT(REGEXP_REPLACE(SUBSTRING(cc.name FROM '\d+'), '\D', '', 'g'), 9) || '%';