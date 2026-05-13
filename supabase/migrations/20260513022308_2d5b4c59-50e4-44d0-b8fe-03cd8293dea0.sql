
-- chat_conversations: SELECT aberto para todos autenticados
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can view all open conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;

CREATE POLICY "Authenticated can view all conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (true);

-- chat_messages: SELECT/INSERT abertos
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;

CREATE POLICY "Authenticated can view all messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- chat_participants: SELECT aberto
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;

CREATE POLICY "Authenticated can view all participants"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (true);
