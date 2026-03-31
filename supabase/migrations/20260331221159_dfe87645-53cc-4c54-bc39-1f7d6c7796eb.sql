
ALTER TABLE public.chat_messages ADD COLUMN media_url text;

-- Create public bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Chat media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Authenticated users and service role can upload
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media');
