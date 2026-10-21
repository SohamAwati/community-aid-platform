CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,full_name,avatar_url) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name',split_part(NEW.email,'@',1)),NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT(id) DO NOTHING; INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,CASE WHEN NEW.raw_user_meta_data->>'requested_role'='ngo_admin' THEN 'ngo_admin'::public.app_role ELSE 'volunteer'::public.app_role END) ON CONFLICT(user_id,role) DO NOTHING; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.validate_opportunity_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW.ngo_id IS DISTINCT FROM OLD.ngo_id THEN RAISE EXCEPTION 'Opportunity ownership cannot be changed'; END IF;
 IF NEW.status='published' THEN
  IF NOT EXISTS(SELECT 1 FROM public.ngos WHERE id=NEW.ngo_id AND status='verified') THEN RAISE EXCEPTION 'NGO must be verified before publishing'; END IF;
  IF btrim(NEW.title)='' OR btrim(NEW.description)='' THEN RAISE EXCEPTION 'Title and description are required'; END IF;
  IF NEW.slots<1 OR NEW.hours_estimate<0 OR COALESCE(NEW.min_age,0)<0 THEN RAISE EXCEPTION 'Slots, age or hours are invalid'; END IF;
  IF NEW.ends_at<NEW.starts_at THEN RAISE EXCEPTION 'End must follow start'; END IF;
  IF NEW.is_paid AND btrim(COALESCE(NEW.stipend,''))='' THEN RAISE EXCEPTION 'Paid opportunities require stipend details'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER acceptance_opportunity_guard BEFORE INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.validate_opportunity_write();
CREATE OR REPLACE FUNCTION public.guard_application_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.opportunities; occupied integer; BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id OR NEW.volunteer_id IS DISTINCT FROM OLD.volunteer_id THEN RAISE EXCEPTION 'Application ownership cannot be changed'; END IF;
  IF OLD.status='withdrawn' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Withdrawn applications cannot be reopened'; END IF;
 ELSE
  IF NEW.status<>'pending' OR NEW.completed_at IS NOT NULL OR NEW.hours_logged<>0 OR NEW.attendance IS NOT NULL OR NEW.certificate_url IS NOT NULL THEN RAISE EXCEPTION 'New applications must be pending'; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id=NEW.opportunity_id FOR UPDATE;
  IF NOT FOUND OR o.status<>'published' THEN RAISE EXCEPTION 'Opportunity is not accepting applications'; END IF;
  IF o.application_deadline IS NOT NULL AND o.application_deadline<=now() THEN RAISE EXCEPTION 'Application deadline has passed'; END IF;
  SELECT count(*) INTO occupied FROM public.applications WHERE opportunity_id=o.id AND status IN ('pending','accepted','completed');
  IF occupied>=o.slots THEN RAISE EXCEPTION 'No slots are available'; END IF;
 END IF;
 IF NEW.status='rejected' AND btrim(COALESCE(NEW.rejection_reason,''))='' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER acceptance_application_guard BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.guard_application_write();
CREATE OR REPLACE FUNCTION public.notify_application_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE opportunity_title text; BEGIN IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','rejected') THEN SELECT title INTO opportunity_title FROM public.opportunities WHERE id=NEW.opportunity_id; INSERT INTO public.notifications(user_id,title,body,link) VALUES(NEW.volunteer_id,'Application '||NEW.status,opportunity_title||CASE WHEN NEW.status='rejected' THEN ': '||NEW.rejection_reason ELSE ': your application was accepted.' END,'/volunteer/applications'); END IF; RETURN NEW; END $$;
CREATE TRIGGER acceptance_decision_notification AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.notify_application_decision();
CREATE TABLE public.reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL, subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 1 AND 200), details text NOT NULL CHECK(length(btrim(details)) BETWEEN 1 AND 5000), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')), resolution text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.reports TO authenticated; GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_read ON public.reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY reports_submit ON public.reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid() AND status='pending' AND resolution IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE OR REPLACE FUNCTION public.review_report(_id uuid,_status text,_resolution text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super admin access required'; END IF; IF _status NOT IN ('resolved','dismissed') OR btrim(COALESCE(_resolution,''))='' THEN RAISE EXCEPTION 'Decision and reason are required'; END IF; UPDATE public.reports SET status=_status,resolution=left(btrim(_resolution),5000),reviewed_by=auth.uid(),reviewed_at=now() WHERE id=_id AND status='pending'; IF NOT FOUND THEN RAISE EXCEPTION 'Pending report not found'; END IF; END $$;
REVOKE ALL ON FUNCTION public.review_report(uuid,text,text) FROM public,anon; GRANT EXECUTE ON FUNCTION public.review_report(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_report(_subject text,_details text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE result uuid; BEGIN INSERT INTO public.reports(reporter_id,subject,details) VALUES(auth.uid(),btrim(_subject),btrim(_details)) RETURNING id INTO result; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.submit_report(text,text) FROM public,anon; GRANT EXECUTE ON FUNCTION public.submit_report(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.list_my_reports() RETURNS SETOF public.reports LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT * FROM public.reports ORDER BY created_at DESC LIMIT 100 $$;
REVOKE ALL ON FUNCTION public.list_my_reports() FROM public,anon; GRANT EXECUTE ON FUNCTION public.list_my_reports() TO authenticated;
CREATE OR REPLACE FUNCTION public.application_availability(_opportunity_id uuid) RETURNS TABLE(remaining bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT greatest(0,o.slots-(SELECT count(*) FROM public.applications a WHERE a.opportunity_id=o.id AND a.status IN ('pending','accepted','completed'))) FROM public.opportunities o WHERE o.id=_opportunity_id AND (o.status='published' OR public.is_ngo_owner(auth.uid(),o.ngo_id)) $$;
REVOKE ALL ON FUNCTION public.application_availability(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.application_availability(uuid) TO anon,authenticated;