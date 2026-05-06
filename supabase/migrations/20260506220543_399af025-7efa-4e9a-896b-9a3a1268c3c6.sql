-- 1. Drop anonymous UPDATE policy on email_logs (the email-track edge function uses service role)
DROP POLICY IF EXISTS "Public can update opened_at" ON public.email_logs;

-- 2. Fix broken self-referential RLS policies on tasks
DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own/assigned tasks" ON public.tasks;

CREATE POLICY "Users can view assigned tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignments ta
    WHERE ta.task_id = public.tasks.id AND ta.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

CREATE POLICY "Users can update own/assigned tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignments ta
    WHERE ta.task_id = public.tasks.id AND ta.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

-- 3. Restrict sitfis_results SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can view sitfis_results" ON public.sitfis_results;
CREATE POLICY "Admins can view sitfis_results"
ON public.sitfis_results FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Move SMTP credentials out of departments into an admin-only table
CREATE TABLE IF NOT EXISTS public.department_credentials (
  department_id uuid PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
  smtp_email text,
  smtp_password text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage department credentials"
ON public.department_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.department_credentials(department_id, smtp_email, smtp_password)
SELECT id, smtp_email, smtp_password FROM public.departments
WHERE smtp_email IS NOT NULL OR smtp_password IS NOT NULL
ON CONFLICT (department_id) DO NOTHING;

ALTER TABLE public.departments DROP COLUMN IF EXISTS smtp_email;
ALTER TABLE public.departments DROP COLUMN IF EXISTS smtp_password;

-- 5. Restrict chat-media bucket INSERT to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- 6. Revoke public EXECUTE on internal SECURITY DEFINER functions (keep has_role callable for RLS evaluation)
REVOKE EXECUTE ON FUNCTION public.recalc_obligation_instance_status(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_instance_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;