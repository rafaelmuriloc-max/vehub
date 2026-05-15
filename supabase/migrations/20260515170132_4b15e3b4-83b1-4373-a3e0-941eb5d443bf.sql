CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task_attachments"
ON public.task_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert task_attachments"
ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Owner or admin can delete task_attachments"
ON public.task_attachments FOR DELETE TO authenticated
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);