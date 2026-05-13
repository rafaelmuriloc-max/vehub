-- Allow all authenticated users to view profiles (needed for ticket transfer member list)
CREATE POLICY "Authenticated can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow any existing participant to add new participants (for chat ticket transfer)
DROP POLICY IF EXISTS "Conversation creators can add participants" ON public.chat_participants;

CREATE POLICY "Participants and creators can add participants"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_participants.conversation_id
      AND (
        c.created_by = auth.uid()
        OR chat_participants.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.chat_participants p2
          WHERE p2.conversation_id = chat_participants.conversation_id
            AND p2.user_id = auth.uid()
        )
      )
  )
);