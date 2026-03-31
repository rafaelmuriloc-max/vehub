
INSERT INTO chat_participants (conversation_id, user_id)
SELECT cc.id, ur.user_id
FROM chat_conversations cc
CROSS JOIN user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id = cc.id AND cp.user_id = ur.user_id
  );
