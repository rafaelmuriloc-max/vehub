
ALTER TABLE public.email_logs ADD COLUMN opened_at timestamptz;

CREATE POLICY "Authenticated can update email_logs" ON public.email_logs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can update opened_at" ON public.email_logs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
