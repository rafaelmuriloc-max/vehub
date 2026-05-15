DROP POLICY IF EXISTS "Participants can update conversations" ON public.chat_conversations;

CREATE POLICY "Authenticated can update conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);