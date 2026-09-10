CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_one_target CHECK ((task_id IS NOT NULL AND instance_id IS NULL) OR (task_id IS NULL AND instance_id IS NOT NULL))
);

CREATE INDEX idx_time_entries_task ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_instance ON public.time_entries(instance_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_started ON public.time_entries(started_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time entries" ON public.time_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own time entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own time entries" ON public.time_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric;

ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;