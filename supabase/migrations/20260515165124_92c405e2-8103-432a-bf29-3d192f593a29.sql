CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_id uuid NOT NULL,
  description text,
  default_due_days integer NOT NULL DEFAULT 7,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task_templates" ON public.task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert task_templates" ON public.task_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update task_templates" ON public.task_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete task_templates" ON public.task_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS template_id uuid;