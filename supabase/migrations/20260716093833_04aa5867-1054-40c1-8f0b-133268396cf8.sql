
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('volunteer', 'ngo_admin', 'super_admin');
CREATE TYPE public.ngo_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.opportunity_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE public.location_mode AS ENUM ('onsite', 'remote', 'hybrid');
CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE public.opportunity_category AS ENUM (
  'education','environment','animal_welfare','healthcare','community_development',
  'disaster_relief','children','elderly_care','technology','human_rights'
);

-- =====================================================================
-- UPDATED_AT HELPER
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  interests TEXT[] DEFAULT ARRAY[]::TEXT[],
  languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  education TEXT,
  experience TEXT,
  availability TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- USER ROLES
-- =====================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
-- Users may self-assign volunteer or ngo_admin (NOT super_admin) at signup
CREATE POLICY "Users can self-assign non-admin role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role IN ('volunteer','ngo_admin'));

-- =====================================================================
-- NGOs
-- =====================================================================
CREATE TABLE public.ngos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  mission TEXT,
  logo_url TEXT,
  cover_url TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT,
  status public.ngo_status NOT NULL DEFAULT 'pending',
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ngos TO authenticated;
GRANT SELECT ON public.ngos TO anon;
GRANT ALL ON public.ngos TO service_role;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verified NGOs are viewable by everyone" ON public.ngos FOR SELECT USING (status = 'verified');
CREATE POLICY "Owners can view their own NGO" ON public.ngos FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Super admins can view all NGOs" ON public.ngos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "NGO admins can create their NGO" ON public.ngos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'ngo_admin'));
CREATE POLICY "Owners can update their NGO" ON public.ngos FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Super admins can update any NGO" ON public.ngos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_ngos_updated_at BEFORE UPDATE ON public.ngos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- OPPORTUNITIES
-- =====================================================================
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.opportunity_category NOT NULL,
  skills_required TEXT[] DEFAULT ARRAY[]::TEXT[],
  location_mode public.location_mode NOT NULL DEFAULT 'onsite',
  city TEXT,
  country TEXT,
  address TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  duration TEXT,
  slots INTEGER NOT NULL DEFAULT 1 CHECK (slots >= 1),
  min_age INTEGER,
  benefits TEXT[] DEFAULT ARRAY[]::TEXT[],
  application_deadline TIMESTAMPTZ,
  cover_url TEXT,
  contact_email TEXT,
  status public.opportunity_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_opportunities_category ON public.opportunities(category);
CREATE INDEX idx_opportunities_ngo ON public.opportunities(ngo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT SELECT ON public.opportunities TO anon;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Helper: is user owner of the NGO for this opportunity?
CREATE OR REPLACE FUNCTION public.is_ngo_owner(_user_id UUID, _ngo_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id AND owner_id = _user_id);
$$;

CREATE POLICY "Published opportunities viewable by everyone" ON public.opportunities FOR SELECT USING (status = 'published');
CREATE POLICY "NGO owners can view all their opportunities" ON public.opportunities FOR SELECT TO authenticated USING (public.is_ngo_owner(auth.uid(), ngo_id));
CREATE POLICY "Super admins view all opportunities" ON public.opportunities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "NGO owners create opportunities" ON public.opportunities FOR INSERT TO authenticated WITH CHECK (public.is_ngo_owner(auth.uid(), ngo_id));
CREATE POLICY "NGO owners update opportunities" ON public.opportunities FOR UPDATE TO authenticated USING (public.is_ngo_owner(auth.uid(), ngo_id)) WITH CHECK (public.is_ngo_owner(auth.uid(), ngo_id));
CREATE POLICY "NGO owners delete opportunities" ON public.opportunities FOR DELETE TO authenticated USING (public.is_ngo_owner(auth.uid(), ngo_id));
CREATE TRIGGER trg_opps_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- APPLICATIONS
-- =====================================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, volunteer_id)
);
CREATE INDEX idx_apps_volunteer ON public.applications(volunteer_id);
CREATE INDEX idx_apps_opp ON public.applications(opportunity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_opp_ngo_owner(_user_id UUID, _opp_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunities o JOIN public.ngos n ON n.id = o.ngo_id
    WHERE o.id = _opp_id AND n.owner_id = _user_id
  );
$$;

CREATE POLICY "Volunteers view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = volunteer_id);
CREATE POLICY "NGO owners view apps for their opportunities" ON public.applications FOR SELECT TO authenticated USING (public.is_opp_ngo_owner(auth.uid(), opportunity_id));
CREATE POLICY "Volunteers create own applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = volunteer_id);
CREATE POLICY "Volunteers update own applications" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = volunteer_id) WITH CHECK (auth.uid() = volunteer_id);
CREATE POLICY "NGO owners update apps for their opportunities" ON public.applications FOR UPDATE TO authenticated USING (public.is_opp_ngo_owner(auth.uid(), opportunity_id)) WITH CHECK (public.is_opp_ngo_owner(auth.uid(), opportunity_id));
CREATE TRIGGER trg_apps_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- SAVED OPPORTUNITIES
-- =====================================================================
CREATE TABLE public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_opportunities TO authenticated;
GRANT ALL ON public.saved_opportunities TO service_role;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saves" ON public.saved_opportunities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Inserts go through service_role from server functions.

-- =====================================================================
-- REVIEWS
-- =====================================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ngo_id, reviewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users manage own review" ON public.reviews FOR ALL TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

-- =====================================================================
-- CERTIFICATES
-- =====================================================================
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours INTEGER,
  code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  UNIQUE (volunteer_id, opportunity_id)
);
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Volunteers view own certificates" ON public.certificates FOR SELECT TO authenticated USING (auth.uid() = volunteer_id);
CREATE POLICY "NGO owners issue certificates" ON public.certificates FOR INSERT TO authenticated WITH CHECK (public.is_opp_ngo_owner(auth.uid(), opportunity_id));
CREATE POLICY "NGO owners view certificates they issued" ON public.certificates FOR SELECT TO authenticated USING (public.is_opp_ngo_owner(auth.uid(), opportunity_id));

-- =====================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
