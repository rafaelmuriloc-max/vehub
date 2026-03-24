CREATE TABLE public.client_department_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  obligation_id uuid NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, department_id, obligation_id)
);

ALTER TABLE public.client_department_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON public.client_department_obligations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert" ON public.client_department_obligations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete" ON public.client_department_obligations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));