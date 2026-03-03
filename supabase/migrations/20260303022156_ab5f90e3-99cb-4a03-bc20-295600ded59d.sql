
-- Create document_types table
CREATE TABLE public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view document_types" ON public.document_types FOR SELECT USING (true);
CREATE POLICY "Admins can insert document_types" ON public.document_types FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update document_types" ON public.document_types FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete document_types" ON public.document_types FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add document_type_id to obligation_activities
ALTER TABLE public.obligation_activities ADD COLUMN document_type_id uuid REFERENCES public.document_types(id) ON DELETE SET NULL;

-- Create documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES public.document_types(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Admins can insert documents" ON public.documents FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update documents" ON public.documents FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete documents" ON public.documents FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Authenticated can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Admins can delete documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));
