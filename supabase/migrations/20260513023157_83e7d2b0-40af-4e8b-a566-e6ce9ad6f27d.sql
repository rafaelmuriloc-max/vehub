
-- Helper function: department-based access
CREATE OR REPLACE FUNCTION public.user_can_access_department(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR _department_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id
        AND (p.department_id IS NULL OR p.department_id = _department_id)
    );
$$;

-- obligations
DROP POLICY IF EXISTS "Authenticated can view obligations" ON public.obligations;
CREATE POLICY "View obligations by department"
ON public.obligations FOR SELECT
TO authenticated
USING (public.user_can_access_department(auth.uid(), department_id));

-- obligation_instances (filter via parent obligation's department)
DROP POLICY IF EXISTS "Authenticated can view instances" ON public.obligation_instances;
CREATE POLICY "View instances by department"
ON public.obligation_instances FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.obligations o
    WHERE o.id = obligation_instances.obligation_id
      AND public.user_can_access_department(auth.uid(), o.department_id)
  )
);

-- obligation_activities
DROP POLICY IF EXISTS "Authenticated can view activities" ON public.obligation_activities;
CREATE POLICY "View activities by department"
ON public.obligation_activities FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.obligations o
    WHERE o.id = obligation_activities.obligation_id
      AND public.user_can_access_department(auth.uid(), o.department_id)
  )
);

-- obligation_activity_completions
DROP POLICY IF EXISTS "Authenticated can view completions" ON public.obligation_activity_completions;
CREATE POLICY "View completions by department"
ON public.obligation_activity_completions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.obligation_activities oa
    JOIN public.obligations o ON o.id = oa.obligation_id
    WHERE oa.id = obligation_activity_completions.activity_id
      AND public.user_can_access_department(auth.uid(), o.department_id)
  )
);

-- client_department_obligations
DROP POLICY IF EXISTS "Authenticated can view" ON public.client_department_obligations;
CREATE POLICY "View client_department_obligations by department"
ON public.client_department_obligations FOR SELECT
TO authenticated
USING (public.user_can_access_department(auth.uid(), department_id));
