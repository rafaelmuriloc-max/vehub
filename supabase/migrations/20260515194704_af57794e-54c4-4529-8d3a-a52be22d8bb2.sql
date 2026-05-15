DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
CREATE POLICY "Authenticated can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view own assignments" ON public.task_assignments;
CREATE POLICY "Authenticated can view assignments" ON public.task_assignments FOR SELECT TO authenticated USING (true);