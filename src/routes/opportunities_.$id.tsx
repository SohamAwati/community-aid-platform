import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunity-card";
import { CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";
import { BASE_FIELDS, parseQuestions } from "@/lib/questions";
import { MapPin, Calendar, Users, Clock, ShieldCheck, ArrowLeft, Bookmark, Share2, Wallet, Award, ClipboardList, UserCheck, Zap, Navigation, Phone, Mail, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { isValidEmail, isValidPhone } from "@/lib/utils";

export const Route = createFileRoute("/opportunities_/$id")({
  head: () => ({ meta: pageMeta("Volunteer opportunity — Volunteer Connect", "See the details, perks and application form for this volunteering opportunity.") }),
  component: OpportunityDetail,
});

function OpportunityDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: o, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, ngos(id,name,logo_url,description,city,country,status)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: myApp } = useQuery({
    enabled: !!user && !!o,
    queryKey: ["my-app", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id,status,rejection_reason")
        .eq("opportunity_id", id)
        .eq("volunteer_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!o) return;
    if (user) void supabase.from("opportunity_views").insert({ opportunity_id: o.id, user_id: user.id });
  }, [o?.id, user?.id]);

  const { data: similar } = useQuery({
    enabled: !!o,
    queryKey: ["similar-opps", o?.id, o?.category],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("id,title,category,city,location_mode,starts_at,slots,cover_url,ngos(name)")
        .eq("status", "published")
        .eq("category", o!.category)
        .neq("id", o!.id)
        .limit(3);
      return (data ?? []).map((r) => ({ ...r, ngo: r.ngos })) as OpportunityCardData[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first");
      const { error } = await supabase.from("saved_opportunities").insert({ user_id: user.id, opportunity_id: id });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved to your bookmarks"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [quickApplyOpen, setQuickApplyOpen] = useState(false);
  const [applicantCity, setApplicantCity] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantExp, setApplicantExp] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [submittingQuick, setSubmittingQuick] = useState(false);

  const openQuickApply = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signin" } as never });
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,phone,city,state,country,experience,occupation_status,organization")
      .eq("id", user.id)
      .maybeSingle();

    setApplicantName(profile?.full_name || user.email?.split("@")[0] || "Volunteer");
    setApplicantCity(profile?.city || "Pune");
    setApplicantPhone(profile?.phone || "");
    setApplicantExp(profile?.experience || "Passionate volunteer ready to contribute time and skills.");
    setQuickApplyOpen(true);
  };

  const submitQuickApply = async () => {
    if (!user) return;
    if (!isValidPhone(applicantPhone)) {
      toast.error("Please enter a valid 10-digit phone number (e.g. +91 9876543210)");
      return;
    }
    if (!applicantCity.trim()) {
      toast.error("Please provide your city of residence");
      return;
    }
    if (!applicantExp.trim()) {
      toast.error("Please share your volunteering experience or key skills");
      return;
    }

    setSubmittingQuick(true);
    try {
      // 1. Update user profile to ensure phone, city, experience are saved for future 1-click applications
      await supabase.from("profiles").update({
        phone: applicantPhone.trim(),
        city: applicantCity.trim(),
        experience: applicantExp.trim(),
      }).eq("id", user.id);

      // 2. Submit application with complete applicant details
      const { error } = await supabase.from("applications").insert({
        opportunity_id: id,
        volunteer_id: user.id,
        status: "pending",
        message: `Applied via 1-Click Quick Apply.\nCity: ${applicantCity.trim()}\nPhone: ${applicantPhone.trim()}\nEmail: ${user.email}\nExperience: ${applicantExp.trim()}`,
        answers: {
          full_name: applicantName,
          email: user.email ?? "",
          phone: applicantPhone.trim(),
          city: applicantCity.trim(),
          experience: applicantExp.trim(),
        },
      });
      if (error) throw error;

      // 3. Notify the NGO
      if (o?.ngo_id) {
        await supabase.from("notifications").insert({
          user_id: o.ngo_id,
          title: `New Applicant: ${applicantName}`,
          body: `${applicantName} from ${applicantCity.trim()} has applied for "${o.title}". Phone: ${applicantPhone.trim()}`,
          link: `/ngo/opportunities/${id}/applicants`,
        });
      }

      toast.success("Application submitted successfully! The organization will review your profile.");
      setQuickApplyOpen(false);
      qc.invalidateQueries({ queryKey: ["my-app", id, user?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quick apply failed");
    } finally {
      setSubmittingQuick(false);
    }
  };

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-16"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  if (!o) return null;

  const questions = parseQuestions(o.custom_questions);
  const closed = o.status !== "published";
  const locationString = [o.address, o.city, o.country].filter(Boolean).join(", ");

  const handleApply = () => {
    if (!user) { navigate({ to: "/auth", search: { mode: "signin" } as never }); return; }
    navigate({ to: "/apply/$id", params: { id } });
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-6"><Link to="/opportunities"><ArrowLeft className="size-4" /> Back</Link></Button>

      <div className="mb-8 aspect-[21/9] overflow-hidden rounded-3xl bg-secondary">
        {o.cover_url ? (
          <img src={o.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary to-sky/50">
            <span className="font-display text-5xl text-primary/40">{o.title.charAt(0)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="rounded-full">{CATEGORY_LABEL[o.category as CategoryKey]}</Badge>
            <Badge variant="outline" className="rounded-full capitalize">{o.location_mode}</Badge>
            <Badge variant={o.is_paid ? "default" : "secondary"} className="rounded-full">{o.is_paid ? "Paid" : "Unpaid"}</Badge>
            {o.provides_certificate && <Badge variant="outline" className="gap-1 rounded-full"><Award className="size-3" /> Certificate</Badge>}
            {o.ngos?.status === "verified" && (
              <Badge variant="outline" className="gap-1 rounded-full border-accent text-accent">
                <ShieldCheck className="size-3" /> Verified NGO
              </Badge>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{o.title}</h1>
          {o.ngos && (
            <Link to="/ngos/$id" params={{ id: o.ngos.id }} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              {o.ngos.name}
            </Link>
          )}
          <Section title="About this opportunity"><p className="whitespace-pre-wrap">{o.description}</p></Section>
          {o.responsibilities && <Section title="Responsibilities"><p className="whitespace-pre-wrap">{o.responsibilities}</p></Section>}
          {o.requirements && <Section title="Requirements"><p className="whitespace-pre-wrap">{o.requirements}</p></Section>}

          {o.skills_required && o.skills_required.length > 0 && (
            <Section title="Skills needed">
              <div className="flex flex-wrap gap-2">
                {o.skills_required.map((s) => <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>)}
              </div>
            </Section>
          )}

          <Section title="What you get">
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>{o.is_paid ? `Paid — ${o.stipend ?? "stipend provided"}` : "Unpaid volunteering role"}</li>
              <li>{o.provides_certificate ? "Certificate provided on completion" : "No certificate for this role"}</li>
              {(o.benefits ?? []).map((b) => <li key={b}>{b}</li>)}
            </ul>
          </Section>

          {/* INTERACTIVE EVENT LOCATION MAP */}
          {locationString && (
            <Section title="Location & Interactive Map">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <iframe
                  title="Interactive Map"
                  className="h-72 w-full border-0"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(locationString)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <MapPin className="size-4 text-primary" /> {locationString}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <Navigation className="size-3.5" /> Open in Google Maps
                  </a>
                </div>
              </div>
            </Section>
          )}

          <Section title="Application form">
            <p className="mb-2 text-muted-foreground">You'll be asked for:</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {BASE_FIELDS.map((b) => <li key={b.id}>{b.label}</li>)}
              {questions.map((q) => <li key={q.id}>{q.label}</li>)}
            </ul>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <dl className="space-y-4 text-sm">
              {o.city && <Row icon={MapPin} label="Location">{o.city}{o.country && `, ${o.country}`}</Row>}
              {o.starts_at && <Row icon={Calendar} label="Starts">{new Date(o.starts_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</Row>}
              {o.duration && <Row icon={Clock} label="Duration">{o.duration}</Row>}
              {o.hours_estimate > 0 && <Row icon={Clock} label="Est. hours">{o.hours_estimate}</Row>}
              <Row icon={Wallet} label="Compensation">{o.is_paid ? o.stipend ?? "Paid" : "Unpaid"}</Row>
              <Row icon={Award} label="Certificate">{o.provides_certificate ? "Yes" : "No"}</Row>
              <Row icon={Users} label="Spots">{o.slots}</Row>
              {o.min_age && <Row icon={UserCheck} label="Minimum age">{o.min_age}+</Row>}
              {o.application_deadline && <Row icon={ClipboardList} label="Apply by">{new Date(o.application_deadline).toLocaleDateString(undefined, { dateStyle: "medium" })}</Row>}
            </dl>
            <div className="mt-6 space-y-2">
              {myApp ? (
                <>
                  <Button asChild variant="secondary" className="w-full rounded-full capitalize">
                    <Link to="/volunteer/applications">Application {myApp.status}</Link>
                  </Button>
                  {myApp.status === "rejected" && myApp.rejection_reason && (
                    <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Reason: {myApp.rejection_reason}</p>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={openQuickApply}
                    disabled={closed}
                    className="w-full gap-2 rounded-full shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    <Zap className="size-4" />
                    1-Click Quick Apply
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={closed}
                    variant="outline"
                    className="w-full rounded-full text-xs font-semibold"
                  >
                    Custom Application Form
                  </Button>
                </>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => save.mutate()} disabled={!user}>
                  <Bookmark className="size-4" /> Save
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
                  <Share2 className="size-4" /> Share
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {similar && similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">Similar opportunities</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => <OpportunityCard key={s.id} o={s} />)}
          </div>
        </section>
      )}

      {/* 1-Click Quick Apply Confirmation Modal */}
      <Dialog open={quickApplyOpen} onOpenChange={setQuickApplyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Zap className="size-3.5" /> 1-Click Quick Apply
            </div>
            <DialogTitle className="font-display text-xl">
              Apply to {o.title}
            </DialogTitle>
            <DialogDescription>
              Review your complete applicant details below. These will be provided directly to {o.ngos?.name || "the NGO"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Full Name *</Label>
                <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Email Address (Verified)</Label>
                <Input value={user?.email || ""} disabled className="bg-muted/50 text-muted-foreground" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">City of Residence *</Label>
                <Input
                  required
                  placeholder="e.g. Pune, Maharashtra"
                  value={applicantCity}
                  onChange={(e) => setApplicantCity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Phone Number * (10 Digits)</Label>
                <Input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Relevant Experience & Skills *</Label>
              <Textarea
                rows={3}
                required
                placeholder="Share your volunteering background, key skills, or hobbies..."
                value={applicantExp}
                onChange={(e) => setApplicantExp(e.target.value)}
              />
            </div>

            <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Check className="size-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Your phone number and city of residence will be verified and saved to your profile for seamless future applications.</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQuickApplyOpen(false)} disabled={submittingQuick}>
              Cancel
            </Button>
            <Button
              onClick={submitQuickApply}
              disabled={submittingQuick}
              className="gap-2 rounded-full font-medium"
            >
              <Zap className="size-4" />
              {submittingQuick ? "Submitting..." : "Confirm & Submit (1-Click)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 text-sm">
      <h3 className="mb-3 font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <div><div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-0.5">{children}</div></div>
    </div>
  );
}
