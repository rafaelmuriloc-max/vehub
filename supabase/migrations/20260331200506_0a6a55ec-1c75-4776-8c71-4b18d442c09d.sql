
ALTER TABLE public.chat_conversations ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.chat_messages ADD COLUMN channel text NOT NULL DEFAULT 'internal';

-- Allow service role (edge functions) to insert messages into conversations they manage
-- The existing RLS requires sender_id = auth.uid() AND user is participant.
-- For edge functions using service_role key, RLS is bypassed, so no new policy needed.
