
-- Drop the old restrictive UPDATE policy on chat_messages
DROP POLICY IF EXISTS "Users can update their own messages" ON public.chat_messages;

-- Create new UPDATE policy allowing participants to update messages in their conversations
CREATE POLICY "Participants can update messages in their conversations"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
);

-- Fix infinite recursion in chat_participants SELECT policy
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants FOR SELECT
TO authenticated
USING (user_id = auth.uid());
