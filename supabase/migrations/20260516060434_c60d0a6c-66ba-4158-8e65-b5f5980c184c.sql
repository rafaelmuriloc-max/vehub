DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;

CREATE POLICY "Authenticated can insert own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins or owner can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR uploaded_by = auth.uid());