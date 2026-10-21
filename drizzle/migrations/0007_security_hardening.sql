-- Profiles: hide private columns
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, bio, skills, interests, languages, education, availability, city, state, country, first_name, last_name, created_at, updated_at) ON public.profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profiles_private(_ids uuid[])
RETURNS TABLE(id uuid, phone text, occupation_status text, organization text, experience text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.phone, p.occupation_status, p.organization, p.experience
  FROM public.profiles p
  WHERE p.id = ANY(_ids) AND (
    p.id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.applications a JOIN public.opportunities o ON o.id = a.opportunity_id
               JOIN public.ngos n ON n.id = o.ngo_id WHERE a.volunteer_id = p.id AND n.owner_id = auth.uid())
  )
$$;
REVOKE EXECUTE ON FUNCTION public.get_profiles_private(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_profiles_private(uuid[]) TO authenticated;

-- Teams: signed-in only
DROP POLICY "teams public read" ON public.teams;
CREATE POLICY "teams signed-in read" ON public.teams FOR SELECT TO authenticated USING (true);
DROP POLICY "team_members public read" ON public.team_members;
CREATE POLICY "team_members signed-in read" ON public.team_members FOR SELECT TO authenticated USING (true);

-- Certificates: lookup by code only
DROP POLICY "Anyone can verify a certificate by code" ON public.certificates;
CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE(code text, hours int, issued_at timestamptz, volunteer_name text, opportunity_title text, ngo_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.code, c.hours, c.issued_at, p.full_name, o.title, n.name
  FROM public.certificates c
  JOIN public.opportunities o ON o.id = c.opportunity_id
  JOIN public.ngos n ON n.id = o.ngo_id
  LEFT JOIN public.profiles p ON p.id = c.volunteer_id
  WHERE c.code = _code
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- Opportunity views: own only
DROP POLICY "views insertable" ON public.opportunity_views;
DROP POLICY "views readable own or aggregate" ON public.opportunity_views;
CREATE POLICY "views insert own" ON public.opportunity_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "views read own" ON public.opportunity_views FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Volunteer stats: only changed by the award function
DROP POLICY "own stats insertable" ON public.volunteer_stats;
DROP POLICY "own stats writable" ON public.volunteer_stats;

-- Volunteers cannot change NGO-controlled application fields
CREATE OR REPLACE FUNCTION public.protect_application_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_application(auth.uid(), OLD.id) THEN
    NEW.hours_logged := OLD.hours_logged;
    NEW.attendance := OLD.attendance;
    NEW.certificate_url := OLD.certificate_url;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.completed_at := OLD.completed_at;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'withdrawn' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_application_fields BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_application_fields();

-- Award only by managing NGO, once
CREATE OR REPLACE FUNCTION public.award_completion(_application_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _app record; _user uuid; _hours int; _stats record;
BEGIN
  IF NOT (public.can_manage_application(auth.uid(), _application_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT a.*, o.hours_estimate, o.category, o.title, o.ngo_id INTO _app
    FROM public.applications a JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = _application_id;
  IF _app IS NULL THEN RETURN; END IF;
  IF _app.status = 'completed' THEN RETURN; END IF;
  IF _app.status <> 'accepted' THEN RAISE EXCEPTION 'Only accepted applications can be completed'; END IF;

  _user := _app.volunteer_id;
  _hours := LEAST(GREATEST(COALESCE(NULLIF(_app.hours_logged, 0), _app.hours_estimate, 4), 0), 1000);

  UPDATE public.applications SET status = 'completed', completed_at = COALESCE(completed_at, now()), hours_logged = _hours
    WHERE id = _application_id;

  INSERT INTO public.volunteer_stats (user_id, total_hours, completed_count, xp, level, streak_days, last_activity_at, impact_score)
    VALUES (_user, _hours, 1, _hours * 10, 1, 1, now(), _hours * 5)
  ON CONFLICT (user_id) DO UPDATE SET
    total_hours = public.volunteer_stats.total_hours + _hours,
    completed_count = public.volunteer_stats.completed_count + 1,
    xp = public.volunteer_stats.xp + _hours * 10,
    level = GREATEST(1, ((public.volunteer_stats.xp + _hours * 10) / 100) + 1),
    streak_days = CASE
      WHEN public.volunteer_stats.last_activity_at::date = (now()::date - 1) THEN public.volunteer_stats.streak_days + 1
      WHEN public.volunteer_stats.last_activity_at::date = now()::date THEN public.volunteer_stats.streak_days
      ELSE 1 END,
    last_activity_at = now(),
    impact_score = public.volunteer_stats.impact_score + _hours * 5,
    updated_at = now();

  INSERT INTO public.certificates (volunteer_id, opportunity_id, hours, code)
    VALUES (_user, _app.opportunity_id, _hours, 'VC-' || substring(gen_random_uuid()::text, 1, 8))
  ON CONFLICT DO NOTHING;

  SELECT * INTO _stats FROM public.volunteer_stats WHERE user_id = _user;
  INSERT INTO public.user_badges (user_id, badge_id)
    SELECT _user, b.id FROM public.badges b
    WHERE (b.code = 'first_completion')
       OR (b.code = 'hours_10' AND _stats.total_hours >= 10)
       OR (b.code = 'hours_50' AND _stats.total_hours >= 50)
       OR (b.code = 'hours_100' AND _stats.total_hours >= 100)
       OR (b.code = 'streak_3' AND _stats.streak_days >= 3)
       OR (b.code = 'streak_7' AND _stats.streak_days >= 7)
       OR (b.code = 'multi_cause' AND (
            SELECT count(DISTINCT o2.category) FROM public.applications a2
            JOIN public.opportunities o2 ON o2.id = a2.opportunity_id
            WHERE a2.volunteer_id = _user AND a2.status = 'completed') >= 3)
  ON CONFLICT DO NOTHING;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.award_completion(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.award_completion(uuid) TO authenticated;