ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS nps_score integer,
  ADD COLUMN IF NOT EXISTS nps_category text,
  ADD COLUMN IF NOT EXISTS empathy_score integer,
  ADD COLUMN IF NOT EXISTS clarity_score integer,
  ADD COLUMN IF NOT EXISTS resolution_score integer,
  ADD COLUMN IF NOT EXISTS sentiment_start text,
  ADD COLUMN IF NOT EXISTS sentiment_end text,
  ADD COLUMN IF NOT EXISTS feedback_strengths text,
  ADD COLUMN IF NOT EXISTS feedback_improvements text,
  ADD COLUMN IF NOT EXISTS evaluation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS evaluated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_support_tickets_eval ON public.support_tickets (evaluation_status, closed_at);