ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stipend text,
  ADD COLUMN IF NOT EXISTS provides_certificate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS responsibilities text,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS attendance text,
  ADD COLUMN IF NOT EXISTS certificate_url text;

CREATE OR REPLACE FUNCTION public.can_manage_application(_user_id uuid, _app_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.opportunities o ON o.id = a.opportunity_id
    JOIN public.ngos n ON n.id = o.ngo_id
    WHERE a.id = _app_id AND n.owner_id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_application(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_application(uuid, uuid) TO authenticated;

CREATE POLICY "Certificates files are public" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');
CREATE POLICY "NGO owners upload certificate files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.can_manage_application(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "NGO owners update certificate files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates' AND public.can_manage_application(auth.uid(), ((storage.foldername(name))[1])::uuid));