CREATE OR REPLACE FUNCTION public.set_my_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('volunteer'::app_role, 'ngo_admin'::app_role) THEN
    RAISE EXCEPTION 'Role not self-assignable';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_role(app_role) TO authenticated;