
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS triage_system_prompt text;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS triage_prompt text;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS triaged_department_id uuid;

CREATE TABLE IF NOT EXISTS public.triage_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_messages text NOT NULL,
  chosen_department_id uuid,
  corrected_department_id uuid,
  summary text,
  outcome text NOT NULL DEFAULT 'auto_confirmed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmed_at timestamp with time zone
);

ALTER TABLE public.triage_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view triage_learnings"
ON public.triage_learnings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete triage_learnings"
ON public.triage_learnings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_triage_learnings_created ON public.triage_learnings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_learnings_outcome ON public.triage_learnings (outcome);
