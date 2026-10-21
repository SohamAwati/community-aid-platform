
-- 1) volunteer_stats
CREATE TABLE public.volunteer_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_hours integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  impact_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.volunteer_stats TO authenticated;
GRANT SELECT ON public.volunteer_stats TO anon;
GRANT ALL ON public.volunteer_stats TO service_role;
ALTER TABLE public.volunteer_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats readable by all" ON public.volunteer_stats FOR SELECT USING (true);
CREATE POLICY "own stats writable" ON public.volunteer_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own stats insertable" ON public.volunteer_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_vs_updated BEFORE UPDATE ON public.volunteer_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) badges
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  tier text NOT NULL DEFAULT 'bronze',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges public read" ON public.badges FOR SELECT USING (true);

-- 3) user_badges
CREATE TABLE public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
GRANT SELECT ON public.user_badges TO authenticated, anon;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges public read" ON public.user_badges FOR SELECT USING (true);

-- 4) teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams owner manage" ON public.teams FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) team_members
CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.team_members TO authenticated;
GRANT SELECT ON public.team_members TO anon;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members public read" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "team_members self join" ON public.team_members FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()));
CREATE POLICY "team_members self leave" ON public.team_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()));

-- 6) opportunity_views
CREATE TABLE public.opportunity_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opp_views_user ON public.opportunity_views(user_id, viewed_at DESC);
CREATE INDEX idx_opp_views_opp ON public.opportunity_views(opportunity_id, viewed_at DESC);
GRANT SELECT, INSERT ON public.opportunity_views TO authenticated, anon;
GRANT ALL ON public.opportunity_views TO service_role;
ALTER TABLE public.opportunity_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views insertable" ON public.opportunity_views FOR INSERT WITH CHECK (true);
CREATE POLICY "views readable own or aggregate" ON public.opportunity_views FOR SELECT USING (true);

-- 7) impact_metrics
CREATE TABLE public.impact_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.impact_metrics TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.impact_metrics TO authenticated;
GRANT ALL ON public.impact_metrics TO service_role;
ALTER TABLE public.impact_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics public read" ON public.impact_metrics FOR SELECT USING (true);
CREATE POLICY "metrics ngo manage" ON public.impact_metrics FOR ALL USING (
  EXISTS (SELECT 1 FROM public.opportunities o JOIN public.ngos n ON n.id = o.ngo_id WHERE o.id = opportunity_id AND n.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.opportunities o JOIN public.ngos n ON n.id = o.ngo_id WHERE o.id = opportunity_id AND n.owner_id = auth.uid())
);

-- 8) extend applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hours_logged integer NOT NULL DEFAULT 0;

-- 9) extend opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS hours_estimate integer NOT NULL DEFAULT 4;

-- 10) extend ngos with social links
ALTER TABLE public.ngos
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS causes text[] NOT NULL DEFAULT ARRAY[]::text[];

-- 11) seed badges
INSERT INTO public.badges (code, name, description, icon, tier) VALUES
  ('first_application', 'First Step', 'Applied for your first opportunity', 'sparkles', 'bronze'),
  ('first_completion', 'Kickstarter', 'Completed your first volunteering event', 'rocket', 'bronze'),
  ('hours_10', '10 Hours', 'Logged 10 volunteering hours', 'clock', 'bronze'),
  ('hours_50', '50 Hours', 'Logged 50 volunteering hours', 'clock', 'silver'),
  ('hours_100', '100 Hours', 'Logged 100 volunteering hours', 'clock', 'gold'),
  ('streak_3', 'On a Roll', '3-day activity streak', 'flame', 'bronze'),
  ('streak_7', 'Committed', '7-day activity streak', 'flame', 'silver'),
  ('multi_cause', 'Well-Rounded', 'Volunteered across 3+ causes', 'compass', 'silver'),
  ('team_player', 'Team Player', 'Joined a volunteer team', 'users', 'bronze'),
  ('mentor', 'Mentor', 'Completed 5+ education opportunities', 'graduation-cap', 'gold')
ON CONFLICT (code) DO NOTHING;

-- 12) award_completion function
CREATE OR REPLACE FUNCTION public.award_completion(_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app record;
  _opp record;
  _user uuid;
  _hours int;
  _stats record;
BEGIN
  SELECT a.*, o.hours_estimate, o.category, o.title, o.ngo_id
    INTO _app
    FROM public.applications a
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = _application_id;
  IF _app IS NULL THEN RETURN; END IF;

  _user := _app.volunteer_id;
  _hours := COALESCE(NULLIF(_app.hours_logged, 0), _app.hours_estimate, 4);

  -- Mark completed
  UPDATE public.applications
    SET status = 'completed', completed_at = COALESCE(completed_at, now()), hours_logged = _hours
    WHERE id = _application_id;

  -- Upsert stats
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
      ELSE 1
    END,
    last_activity_at = now(),
    impact_score = public.volunteer_stats.impact_score + _hours * 5,
    updated_at = now();

  -- Issue certificate
  INSERT INTO public.certificates (volunteer_id, opportunity_id, hours, code)
    VALUES (_user, _app.opportunity_id, _hours, 'VC-' || substring(gen_random_uuid()::text, 1, 8))
  ON CONFLICT DO NOTHING;

  -- Award badges
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
$$;
REVOKE ALL ON FUNCTION public.award_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_completion(uuid) TO authenticated, service_role;
