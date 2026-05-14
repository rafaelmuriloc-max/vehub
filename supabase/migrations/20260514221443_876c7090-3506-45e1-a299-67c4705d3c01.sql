
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS triage_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS triage_department_id uuid,
  ADD COLUMN IF NOT EXISTS triage_summary text,
  ADD COLUMN IF NOT EXISTS triage_turns int NOT NULL DEFAULT 0;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS triage_keywords text;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS triage_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS triage_fallback_department_id uuid;

-- Existing conversations should not be re-triaged retroactively
UPDATE public.chat_conversations SET triage_status = 'skipped' WHERE triage_status = 'pending';
