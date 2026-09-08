DROP POLICY IF EXISTS "Admins can view sitfis_results" ON public.sitfis_results;
DROP POLICY IF EXISTS "Admins can manage sitfis_results" ON public.sitfis_results;
CREATE POLICY "Authenticated can view sitfis_results" ON public.sitfis_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sitfis_results" ON public.sitfis_results FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update sitfis_results" ON public.sitfis_results FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete sitfis_results" ON public.sitfis_results FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sitfis_results TO authenticated;
GRANT ALL ON public.sitfis_results TO service_role;

DROP POLICY IF EXISTS "Admins can view parcelamento_results" ON public.parcelamento_results;
DROP POLICY IF EXISTS "Admins can manage parcelamento_results" ON public.parcelamento_results;
CREATE POLICY "Authenticated can view parcelamento_results" ON public.parcelamento_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert parcelamento_results" ON public.parcelamento_results FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update parcelamento_results" ON public.parcelamento_results FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete parcelamento_results" ON public.parcelamento_results FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcelamento_results TO authenticated;
GRANT ALL ON public.parcelamento_results TO service_role;