
-- Grant super_admin to the initial owner
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE email = 'vaishnavi.nimse24@pccoepune.org'
ON CONFLICT (user_id, role) DO NOTHING;

-- RPC: list super admins (super admin only)
CREATE OR REPLACE FUNCTION public.list_super_admins()
RETURNS TABLE(user_id uuid, email text, granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can list super admins';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, ur.created_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role = 'super_admin'
    ORDER BY ur.created_at;
END;
$$;

-- RPC: grant super_admin by email (super admin only)
CREATE OR REPLACE FUNCTION public.grant_super_admin_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can grant super admin';
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email);
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _uid;
END;
$$;

-- RPC: revoke super_admin (super admin only; cannot revoke self)
CREATE OR REPLACE FUNCTION public.revoke_super_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can revoke super admin';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot revoke your own super admin role';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_super_admins() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_super_admin_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_super_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_super_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_super_admin(uuid) TO authenticated;
