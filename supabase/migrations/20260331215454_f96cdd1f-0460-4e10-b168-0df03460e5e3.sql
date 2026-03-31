
-- Move all messages from duplicate conversations to the main one
UPDATE chat_messages SET conversation_id = 'e8f3bd76-1b01-4a02-a01f-6f0b9054e0fa'
WHERE conversation_id IN ('54823ef3-8a5f-44c9-b973-d425acc3fc59','01dfd8fa-1c72-45b2-a2c7-9506ac10503a','cdfa3e2b-bfbe-4e82-a80c-b8607c7c07ee');

-- Remove duplicate participants
DELETE FROM chat_participants
WHERE conversation_id IN ('54823ef3-8a5f-44c9-b973-d425acc3fc59','01dfd8fa-1c72-45b2-a2c7-9506ac10503a','cdfa3e2b-bfbe-4e82-a80c-b8607c7c07ee');

-- Delete duplicate conversations
DELETE FROM chat_conversations
WHERE id IN ('54823ef3-8a5f-44c9-b973-d425acc3fc59','01dfd8fa-1c72-45b2-a2c7-9506ac10503a','cdfa3e2b-bfbe-4e82-a80c-b8607c7c07ee');

-- Update the remaining conversation name (remove WhatsApp suffix if present)
UPDATE chat_conversations SET name = 'Rafael Murilo' WHERE id = 'e8f3bd76-1b01-4a02-a01f-6f0b9054e0fa';
