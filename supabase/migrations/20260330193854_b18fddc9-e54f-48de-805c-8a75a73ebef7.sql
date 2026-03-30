CREATE TABLE public.client_society_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_label text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_society_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON public.client_society_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert" ON public.client_society_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete" ON public.client_society_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));