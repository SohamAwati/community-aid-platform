GRANT SELECT ON public.certificates TO anon;
CREATE POLICY "Anyone can verify a certificate by code"
ON public.certificates FOR SELECT TO anon
USING (true);