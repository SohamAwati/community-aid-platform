CREATE OR REPLACE FUNCTION public.get_applicant_emails(_opp_id uuid)
RETURNS TABLE(user_id uuid, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text FROM public.applications a JOIN auth.users u ON u.id = a.volunteer_id
  WHERE a.opportunity_id = _opp_id AND public.is_opp_ngo_owner(auth.uid(), _opp_id)
$$;
REVOKE EXECUTE ON FUNCTION public.get_applicant_emails(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_applicant_emails(uuid) TO authenticated;