DROP POLICY IF EXISTS "Certificates files are public" ON storage.objects;
CREATE OR REPLACE FUNCTION public.can_view_application_file(_user_id uuid, _app_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.applications a WHERE a.id = _app_id AND a.volunteer_id = _user_id)
      OR public.can_manage_application(_user_id, _app_id)
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_application_file(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_application_file(uuid, uuid) TO authenticated;
CREATE POLICY "Volunteer or NGO read certificate files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificates' AND public.can_view_application_file(auth.uid(), ((storage.foldername(name))[1])::uuid));