-- Add whatsapp_phone column
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_chat_conversations_whatsapp_phone ON public.chat_conversations(whatsapp_phone);

-- Backfill: extract phone numbers from conversation names that look like "WhatsApp 554791004860" or similar
UPDATE public.chat_conversations
SET whatsapp_phone = REGEXP_REPLACE(name, '[^0-9]', '', 'g')
WHERE whatsapp_phone IS NULL
  AND name ~ '\d{10,}'
  AND REGEXP_REPLACE(name, '[^0-9]', '', 'g') != '';