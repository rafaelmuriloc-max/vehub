UPDATE chat_conversations
SET name = REPLACE(name, ' (WhatsApp)', '')
WHERE name LIKE '% (WhatsApp)';