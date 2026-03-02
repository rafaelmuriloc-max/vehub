
-- Fix permissive INSERT policies to set created_by
DROP POLICY "Authenticated can create tasks" ON public.tasks;
CREATE POLICY "Authenticated can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY "Authenticated can create assignments" ON public.task_assignments;
CREATE POLICY "Authenticated can create assignments" ON public.task_assignments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
