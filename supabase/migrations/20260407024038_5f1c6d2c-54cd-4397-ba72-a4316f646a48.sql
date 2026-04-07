UPDATE chat_conversations c
SET updated_at = COALESCE(
  (SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = c.id),
  c.created_at
);