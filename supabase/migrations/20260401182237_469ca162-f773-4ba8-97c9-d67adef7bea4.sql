
-- Add help desk columns to chat_conversations
ALTER TABLE public.chat_conversations 
  ADD COLUMN status text NOT NULL DEFAULT 'open',
  ADD COLUMN assigned_to uuid,
  ADD COLUMN closed_at timestamptz;

-- Set assigned_to for existing conversations
UPDATE public.chat_conversations SET assigned_to = created_by WHERE assigned_to IS NULL;

-- Allow authenticated users to see all open conversations (for "Todos" tab)
CREATE POLICY "Authenticated users can view all open conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (status = 'open');
