
-- 1) Table
CREATE TABLE IF NOT EXISTS public.profile_departments (
  user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_departments_user ON public.profile_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_departments_dept ON public.profile_departments(department_id);

ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profile_departments"
  ON public.profile_departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert profile_departments"
  ON public.profile_departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update profile_departments"
  ON public.profile_departments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profile_departments"
  ON public.profile_departments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Backfill from profiles.department_id
INSERT INTO public.profile_departments (user_id, department_id)
SELECT user_id, department_id
FROM public.profiles
WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Update access function to consider list (empty list = all)
CREATE OR REPLACE FUNCTION public.user_can_access_department(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR _department_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.profile_departments WHERE user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profile_departments
      WHERE user_id = _user_id AND department_id = _department_id
    );
$function$;
