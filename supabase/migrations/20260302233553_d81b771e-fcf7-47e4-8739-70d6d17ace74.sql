
-- Create private bucket for certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);

-- Add column for certificate file path
ALTER TABLE public.clients ADD COLUMN digital_certificate_url text;

-- Storage policies: authenticated can download
CREATE POLICY "Authenticated users can view certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificates');

-- Admins can upload
CREATE POLICY "Admins can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::app_role));
