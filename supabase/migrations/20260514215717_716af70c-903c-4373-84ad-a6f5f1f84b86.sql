ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS transcription_status text;