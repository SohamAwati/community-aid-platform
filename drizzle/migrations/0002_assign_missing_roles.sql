INSERT INTO public.user_roles (user_id, role)
VALUES ('44dabf3d-5226-4c7b-906b-b44af6243eb6', 'ngo_admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'volunteer'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;