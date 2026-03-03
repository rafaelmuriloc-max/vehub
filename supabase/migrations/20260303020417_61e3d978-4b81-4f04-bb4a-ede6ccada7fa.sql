
-- Enums
CREATE TYPE public.activity_type AS ENUM ('document', 'checklist', 'whatsapp', 'email');
CREATE TYPE public.obligation_status AS ENUM ('pending', 'in_progress', 'done');

-- Obligations table
CREATE TABLE public.obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  recurrence text NOT NULL DEFAULT 'mensal',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view obligations" ON public.obligations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert obligations" ON public.obligations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update obligations" ON public.obligations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete obligations" ON public.obligations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_obligations_updated_at BEFORE UPDATE ON public.obligations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Obligation activities table
CREATE TABLE public.obligation_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obligation_id uuid NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  title text NOT NULL,
  type activity_type NOT NULL DEFAULT 'checklist',
  description text,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.obligation_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view activities" ON public.obligation_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert activities" ON public.obligation_activities FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update activities" ON public.obligation_activities FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete activities" ON public.obligation_activities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Obligation instances table
CREATE TABLE public.obligation_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obligation_id uuid NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  status obligation_status NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.obligation_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view instances" ON public.obligation_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert instances" ON public.obligation_instances FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update instances" ON public.obligation_instances FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR assigned_to = auth.uid());
CREATE POLICY "Admins can delete instances" ON public.obligation_instances FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Obligation activity completions table
CREATE TABLE public.obligation_activity_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.obligation_activities(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_by uuid,
  completed_at timestamp with time zone,
  file_url text,
  notes text
);

ALTER TABLE public.obligation_activity_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view completions" ON public.obligation_activity_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert completions" ON public.obligation_activity_completions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update completions" ON public.obligation_activity_completions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete completions" ON public.obligation_activity_completions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
