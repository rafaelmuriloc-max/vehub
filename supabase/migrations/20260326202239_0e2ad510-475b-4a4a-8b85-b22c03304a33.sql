
-- Chat conversations
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Chat participants
CREATE TABLE public.chat_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone
);

-- RLS policies for chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_participants
  WHERE chat_participants.conversation_id = chat_conversations.id
  AND chat_participants.user_id = auth.uid()
));

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Participants can update conversations"
ON public.chat_conversations FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_participants
  WHERE chat_participants.conversation_id = chat_conversations.id
  AND chat_participants.user_id = auth.uid()
));

-- RLS policies for chat_participants
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of their conversations"
ON public.chat_participants FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_participants cp
  WHERE cp.conversation_id = chat_participants.conversation_id
  AND cp.user_id = auth.uid()
));

CREATE POLICY "Conversation creators can add participants"
ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_conversations
  WHERE chat_conversations.id = chat_participants.conversation_id
  AND (chat_conversations.created_by = auth.uid() OR chat_participants.user_id = auth.uid())
));

-- RLS policies for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_participants
  WHERE chat_participants.conversation_id = chat_messages.conversation_id
  AND chat_participants.user_id = auth.uid()
));

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Update trigger for conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
