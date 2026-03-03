
CREATE TABLE public.client_department_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  contact_name text,
  contact_phone text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, department_id)
);

-- RLS
ALTER TABLE public.client_department_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
ON public.client_department_contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert contacts"
ON public.client_department_contacts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contacts"
ON public.client_department_contacts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contacts"
ON public.client_department_contacts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_client_department_contacts_updated_at
BEFORE UPDATE ON public.client_department_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
