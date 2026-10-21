import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bookmark,
  FileText,
  Award,
  Plus,
  Users,
  BarChart3,
  ShieldAlert,
  Clock,
  Flame,
  Sparkles,
  Trophy,
  Building2,
  CheckCircle2,
  Star,
  MapPin,
  Calendar,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  HeartHandshake,
  UserCheck,
} from "lucide-react";
import { RecommendationsSection } from "@/components/recommendations-section";
import { ImpactCharts } from "@/components/impact-charts";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: pageMeta(
      "My Dashboard — Volunteer Connect",
      "Executive portal for NGOs or personal impact portfolio for volunteers."
    ),
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isNgoAdmin, isSuperAdmin, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading your personalized portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isNgoAdmin ? <NgoDashboardView user={user} isSuperAdmin={isSuperAdmin} /> : <VolunteerDashboardView user={user} isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}

/* =========================================================================
   1. NGO EXECUTIVE MANAGEMENT DASHBOARD
   ========================================================================= */

function NgoDashboardView({ user, isSuperAdmin }: { user: any; isSuperAdmin: boolean }) {
  const qc = useQueryClient();
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ngo-dashboard-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // 1. Get user's NGO
      const myNgo = await supabase.from("ngos").select("*").eq("owner_id", user.id).maybeSingle();
      if (!myNgo.data) return { hasNgo: false, ngo: null };

      const ngo = myNgo.data;

      // 2. Fetch opportunities, applications, and reviews for this NGO
      const [oppsRes, appsRes, reviewsRes] = await Promise.all([
        supabase.from("opportunities").select("*").eq("ngo_id", ngo.id).order("created_at", { ascending: false }),
        supabase
          .from("applications")
          .select("*, opportunities(title, category), profiles(full_name, avatar_url, city, skills)")
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("*, profiles(full_name, avatar_url)").eq("ngo_id", ngo.id).order("created_at", { ascending: false }).limit(6),
      ]);

      const opps = oppsRes.data ?? [];
      const oppIds = new Set(opps.map((o: any) => o.id));

      // Filter applications for this NGO's opportunities
      const ngoApps = (appsRes.data ?? []).filter((a: any) => oppIds.has(a.opportunity_id));
      const pendingApps = ngoApps.filter((a: any) => a.status === "pending");
      const acceptedApps = ngoApps.filter((a: any) => ["accepted", "completed"].includes(a.status));
      const completedApps = ngoApps.filter((a: any) => a.status === "completed");

      const uniqueVolunteers = new Set(acceptedApps.map((a: any) => a.volunteer_id)).size;
      const totalHours = completedApps.reduce((sum: number, a: any) => sum + (Number(a.hours_logged) || 4), 0);

      const reviews = reviewsRes.data ?? [];
      const avgRating =
        reviews.length > 0 ? (reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;

      return {
        hasNgo: true,
        ngo,
        opps,
        pendingApps,
        acceptedApps,
        reviews,
        metrics: {
          totalOpps: opps.length,
          publishedOpps: opps.filter((o: any) => o.status === "published").length,
          totalVolunteers: uniqueVolunteers,
          totalHours,
          pendingReviewCount: pendingApps.length,
          avgRating,
          reviewCount: reviews.length,
        },
      };
    },
  });

  // Action mutation to accept an application
  const updateAppMutation = useMutation({
    mutationFn: async ({ appId, status, reason }: { appId: string; status: string; reason?: string }) => {
      const payload: Record<string, unknown> = { status };
      if (reason) payload.rejection_reason = reason;
      const { error } = await supabase.from("applications").update(payload).eq("id", appId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "accepted" ? "Volunteer application accepted!" : "Application rejected");
      setRejectingAppId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["ngo-dashboard-full", user?.id] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update application"),
  });

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading NGO Portal...</div>;
  }

  // State when user hasn't registered an NGO yet
  if (!data?.hasNgo || !data.ngo) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background p-8 sm:p-12">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Building2 className="size-7" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Welcome to the NGO Partner Portal</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Complete your non-profit registration to unlock verified organization status, publish volunteer opportunities, manage applicant rosters, and issue verifiable digital certificates.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <ShieldCheck className="size-6 text-emerald-600" />
              <h3 className="mt-3 font-semibold">1. Organization Verification</h3>
              <p className="mt-1 text-xs text-muted-foreground">Submit 80G/12A details and mission statements for Super Admin approval.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <Users className="size-6 text-emerald-600" />
              <h3 className="mt-3 font-semibold">2. Recruit Volunteers</h3>
              <p className="mt-1 text-xs text-muted-foreground">Post drives with custom skill requirements, locations, and capacity slots.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <Award className="size-6 text-emerald-600" />
              <h3 className="mt-3 font-semibold">3. Issue Digital Certificates</h3>
              <p className="mt-1 text-xs text-muted-foreground">Reward volunteer contributions with tamper-evident cryptographic credentials.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg" className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <Link to="/ngo/register">
                <Plus className="mr-2 size-5" /> Register Your NGO Profile
              </Link>
            </Button>
            {isSuperAdmin && (
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to="/admin">
                  <ShieldAlert className="mr-2 size-5" /> Admin Control Panel
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { ngo, opps, pendingApps, reviews, metrics } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* NGO Portal Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-teal-900/10 to-background p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-card shadow-md">
              {ngo.logo_url ? (
                <img src={ngo.logo_url} alt={ngo.name} className="size-full object-cover" />
              ) : (
                <Building2 className="size-10 text-emerald-600" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{ngo.name}</h1>
                <Badge className="gap-1 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="size-3.5" />
                  {ngo.status === "verified" ? "Verified Partner" : "Pending Verification"}
                </Badge>
                <Badge variant="outline" className="rounded-full text-xs">
                  NGO Portal
                </Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground line-clamp-2">
                {ngo.mission || ngo.description || "Organizing meaningful community volunteer drives."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-emerald-600" /> {[ngo.city, ngo.country].filter(Boolean).join(", ")}
                </span>
                {metrics.avgRating && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="size-3.5 fill-amber-400 text-amber-500" /> {metrics.avgRating} ({metrics.reviewCount} reviews)
                  </span>
                )}
                {ngo.causes && ngo.causes.length > 0 && (
                  <div className="flex gap-1">
                    {ngo.causes.slice(0, 2).map((c: string) => (
                      <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize">
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-sm">
              <Link to="/ngo/opportunities/new">
                <Plus className="mr-1.5 size-4" /> Post Opportunity
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/ngos/$id" params={{ id: ngo.id }}>
                <ExternalLink className="mr-1.5 size-4" /> View Public Page
              </Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/ngo/profile">Settings</Link>
            </Button>
            {isSuperAdmin && (
              <Button asChild variant="outline" className="rounded-full border-amber-500/40 text-amber-600">
                <Link to="/admin">
                  <ShieldAlert className="mr-1.5 size-4" /> Admin Panel
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Executive Non-Profit KPI Metrics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NgoStatCard
          icon={BarChart3}
          label="Active Campaigns"
          value={metrics.publishedOpps}
          helper={`${metrics.totalOpps} total listed`}
          accent="text-emerald-600"
        />
        <NgoStatCard
          icon={Users}
          label="Volunteers Mobilized"
          value={metrics.totalVolunteers}
          helper="Engaged community helpers"
          accent="text-sky-600"
        />
        <NgoStatCard
          icon={Clock}
          label="Hours Contributed"
          value={metrics.totalHours}
          helper="Certified volunteer impact"
          accent="text-indigo-600"
        />
        <NgoStatCard
          icon={UserCheck}
          label="Pending Applications"
          value={metrics.pendingReviewCount}
          helper={metrics.pendingReviewCount > 0 ? "Requires your review" : "All caught up"}
          accent={metrics.pendingReviewCount > 0 ? "text-amber-500 font-bold" : "text-emerald-600"}
        />
      </div>

      {/* Main NGO Workspace Grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left Column (2 Cols): Applicant Review Action Center & Active Campaigns */}
        <div className="space-y-8 lg:col-span-2">
          {/* Action Center: Pending Volunteer Applications */}
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <UserCheck className="size-5 text-emerald-600" /> Incoming Volunteer Applications
                </CardTitle>
                <CardDescription>
                  Review volunteers eager to join your drives. Accept candidates to dispatch notifications.
                </CardDescription>
              </div>
              <Badge variant={pendingApps.length > 0 ? "default" : "secondary"} className="rounded-full">
                {pendingApps.length} pending
              </Badge>
            </CardHeader>
            <CardContent>
              {pendingApps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-500/70" />
                  <p className="mt-2 text-sm font-medium">All applications have been reviewed!</p>
                  <p className="text-xs text-muted-foreground">New volunteer submissions will appear here automatically.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingApps.map((app: any) => (
                    <div key={app.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-500/10 text-emerald-700 font-semibold ring-1 ring-emerald-500/20">
                          {app.profiles?.avatar_url ? (
                            <img src={app.profiles.avatar_url} alt="" className="size-full object-cover" />
                          ) : (
                            (app.profiles?.full_name || "V").charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{app.profiles?.full_name || "Volunteer"}</div>
                          <div className="text-xs text-muted-foreground">
                            Applied for <span className="font-medium text-foreground">{app.opportunities?.title || "Opportunity"}</span> · {new Date(app.created_at).toLocaleDateString()}
                          </div>
                          {app.message && <p className="mt-1 text-xs text-foreground/80 italic line-clamp-1">"{app.message}"</p>}
                          {app.profiles?.city && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3" /> {app.profiles.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          onClick={() => updateAppMutation.mutate({ appId: app.id, status: "accepted" })}
                          disabled={updateAppMutation.isPending}
                          className="gap-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-3 text-xs"
                        >
                          <Check className="size-3.5" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const reason = prompt("Enter a reason for rejection (optional):") ?? "";
                            updateAppMutation.mutate({ appId: app.id, status: "rejected", reason });
                          }}
                          disabled={updateAppMutation.isPending}
                          className="gap-1 rounded-full hover:bg-destructive/10 hover:text-destructive h-8 px-3 text-xs"
                        >
                          <X className="size-3.5" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Campaigns Management */}
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="font-display text-lg">Active Opportunities & Drives</CardTitle>
                <CardDescription>Manage your listed volunteering programs and track slot capacities.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/ngo/opportunities">View All ({opps.length})</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {opps.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No opportunities created yet. Click "Post Opportunity" to start mobilizing volunteers.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {opps.slice(0, 4).map((opp: any) => (
                    <div key={opp.id} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:border-emerald-500/40">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {opp.category?.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            className={
                              opp.status === "published"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {opp.status}
                          </Badge>
                        </div>
                        <h4 className="mt-2 font-display text-base font-semibold line-clamp-1">{opp.title}</h4>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {opp.city || "Remote"} · <Clock className="size-3" /> {opp.hours_estimate}h
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Capacity</span>
                            <span className="font-medium text-foreground">{opp.slots} spots</span>
                          </div>
                          <Progress value={Math.min(100, (15 / opp.slots) * 100)} className="mt-1.5 h-1.5" />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                        <Link
                          to="/ngo/opportunities/$id/applicants"
                          params={{ id: opp.id }}
                          className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          Manage Applicants <ArrowRight className="size-3" />
                        </Link>
                        <Link
                          to="/opportunities/$id"
                          params={{ id: opp.id }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Preview
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Organization Details & Volunteer Testimonials */}
        <div className="space-y-8">
          {/* Organization Verification Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="size-5 text-emerald-600" /> Compliance & Accreditation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-emerald-600 capitalize">{ngo.status}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                <span className="text-muted-foreground">Contact Email</span>
                <span className="font-medium truncate max-w-[150px]">{ngo.email || user.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                <span className="text-muted-foreground">Official Phone</span>
                <span className="font-medium">{ngo.phone || "Not specified"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                <span className="text-muted-foreground">Super Admin Notes</span>
                <span className="font-medium text-muted-foreground">{ngo.verification_notes || "All credentials valid"}</span>
              </div>
              <Button asChild variant="outline" className="w-full rounded-full text-xs">
                <Link to="/ngo/profile">Update Organization Info</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Volunteer Feedback & Reviews */}
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Star className="size-4 fill-amber-400 text-amber-500" /> Volunteer Reviews ({reviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">No volunteer reviews yet. Volunteers can review your NGO after completing drives.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{r.profiles?.full_name || "Verified Volunteer"}</span>
                        <div className="flex text-amber-500">
                          {Array.from({ length: r.rating || 5 }).map((_, i) => (
                            <Star key={i} className="size-3 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="mt-1 text-muted-foreground line-clamp-2">"{r.comment || "Great experience volunteering!"}"</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NgoStatCard({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: any;
  label: string;
  value: any;
  helper: string;
  accent: string;
}) {
  return (
    <Card className="border-border/80 transition-all hover:border-emerald-500/40 hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="rounded-xl bg-muted p-2">
            <Icon className={`size-4 ${accent}`} />
          </div>
        </div>
        <div className="mt-3 font-display text-3xl font-bold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
   2. VOLUNTEER PERSONAL IMPACT & GAMIFIED DASHBOARD
   ========================================================================= */

function VolunteerDashboardView({ user, isSuperAdmin }: { user: any; isSuperAdmin: boolean }) {
  const { data: vData, isLoading } = useQuery({
    queryKey: ["volunteer-dashboard-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [vstats, apps, saves, certs, badges, profile] = await Promise.all([
        supabase.from("volunteer_stats").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("applications")
          .select("*, opportunities(*, ngos(name, logo_url))")
          .eq("volunteer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("saved_opportunities").select("*, opportunities(*)").eq("user_id", user.id),
        supabase
          .from("certificates")
          .select("*, opportunities(title, ngos(name))")
          .eq("volunteer_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase.from("user_badges").select("earned_at, badges(*)").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);

      return {
        stats: vstats.data,
        applications: apps.data ?? [],
        saved: saves.data ?? [],
        certificates: certs.data ?? [],
        badges: (badges.data ?? []).map((b: any) => ({ ...b.badges, earned_at: b.earned_at })),
        profile: profile.data,
      };
    },
  });

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading your volunteer impact hub...</div>;
  }

  const stats = vData?.stats || {
    total_hours: 0,
    completed_count: 0,
    xp: 0,
    level: 1,
    streak_days: 1,
    impact_score: 0,
  };
  const profile = vData?.profile;
  const applications = vData?.applications ?? [];
  const confirmedApps = applications.filter((a: any) => ["accepted", "completed"].includes(a.status));
  const certificates = vData?.certificates ?? [];
  const badges = vData?.badges ?? [];

  const level = stats.level || Math.max(1, Math.floor((stats.xp || 0) / 100) + 1);
  const xp = stats.xp || 0;
  const xpProgress = Math.min(100, ((xp % 100) / 100) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Gamified Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-sky-500/10 to-indigo-500/5 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/20 text-3xl font-display font-bold text-primary ring-2 ring-primary/30">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                (profile?.full_name || user.email || "V").charAt(0).toUpperCase()
              )}
              <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                L{level}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome, {profile?.full_name || user.email?.split("@")[0]}!
                </h1>
                <Badge className="rounded-full bg-primary/15 text-primary border-primary/30">
                  Changemaker · Level {level}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

              {/* XP Progression Bar */}
              <div className="mt-3 max-w-md">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Progress to Level {level + 1}</span>
                  <span className="text-primary font-semibold">{xp % 100} / 100 XP</span>
                </div>
                <Progress value={xpProgress} className="mt-1.5 h-2" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full shadow-sm">
              <Link to="/opportunities">
                <Sparkles className="mr-1.5 size-4" /> Find Opportunities
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/profile">Edit Profile</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/leaderboard">
                <Trophy className="mr-1.5 size-4 text-amber-500" /> Leaderboard
              </Link>
            </Button>
            {isSuperAdmin && (
              <Button asChild variant="outline" className="rounded-full border-amber-500/40 text-amber-600">
                <Link to="/admin">
                  <ShieldAlert className="mr-1.5 size-4" /> Super Admin
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Gamified Stat Counters */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VolunteerStatCard
          icon={Clock}
          label="Hours Volunteered"
          value={stats.total_hours || 0}
          helper="Certified civic contribution"
          color="text-sky-500"
        />
        <VolunteerStatCard
          icon={Trophy}
          label="Events Completed"
          value={stats.completed_count || 0}
          helper="Successfully attended drives"
          color="text-amber-500"
        />
        <VolunteerStatCard
          icon={Flame}
          label="Active Day Streak"
          value={`${stats.streak_days || 1} Days`}
          helper="Keep volunteering to level up"
          color="text-orange-500"
        />
        <VolunteerStatCard
          icon={Sparkles}
          label="Civic Impact Score"
          value={stats.impact_score || 0}
          helper="Points earned through action"
          color="text-purple-500"
        />
      </div>

      {/* Confirmed Schedule / Commitments */}
      {confirmedApps.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
            <Calendar className="size-5 text-primary" /> Your Confirmed Volunteering Commitments
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confirmedApps.map((app: any) => {
              const opp = app.opportunities;
              return (
                <Card key={app.id} className="border-primary/20 bg-card shadow-sm hover:border-primary/40 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 capitalize">
                        {app.status === "completed" ? "Completed" : "Confirmed Volunteer"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{opp?.location_mode}</span>
                    </div>
                    <CardTitle className="mt-2 text-base font-semibold line-clamp-1">{opp?.title || "Volunteering Event"}</CardTitle>
                    <CardDescription>{opp?.ngos?.name || "Verified Organization"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-3.5 text-primary" />
                      <span>{opp?.starts_at ? new Date(opp.starts_at).toLocaleString() : "Upcoming schedule"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="size-3.5 text-primary" />
                      <span>{opp?.address || opp?.city || "Location details provided"}</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center">
                      <Link to="/opportunities/$id" params={{ id: opp?.id }} className="font-semibold text-primary hover:underline">
                        Event Details →
                      </Link>
                      {app.status === "completed" && (
                        <Link to="/volunteer/certificates" className="text-emerald-600 font-medium">
                          View Certificate
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Trophy Case & Achievements */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Award className="size-5 text-amber-500" /> Trophy Case & Badges Showcase
          </h2>
          <span className="text-xs text-muted-foreground">{badges.length} badges unlocked</span>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
          {badges.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Complete your first volunteering event to unlock the "Kickstarter" and "First Step" achievement badges!
            </div>
          ) : (
            badges.map((b: any, idx: number) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center shadow-xs transition-transform hover:-translate-y-1 hover:border-amber-400"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 text-amber-500 shadow-inner">
                  <Award className="size-6" />
                </div>
                <div className="mt-2 font-semibold text-xs text-foreground line-clamp-1">{b.name || "Badge"}</div>
                <div className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mt-0.5">{b.tier || "Bronze"}</div>
                <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{b.description}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Verified Certificates Showcase */}
      {certificates.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" /> Digital Certificates & Credentials
            </h2>
            <Link to="/volunteer/certificates" className="text-xs font-semibold text-primary hover:underline">
              View All Certificates ({certificates.length})
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.slice(0, 3).map((c: any) => (
              <div key={c.id} className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-card p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-600 text-white text-[10px]">Verified Certificate</Badge>
                  <span className="font-mono text-xs font-bold text-emerald-600">{c.code}</span>
                </div>
                <div className="mt-3 font-display text-base font-semibold line-clamp-1">{c.opportunities?.title || "Community Service"}</div>
                <div className="text-xs text-muted-foreground">{c.opportunities?.ngos?.name}</div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">{c.hours} Volunteering Hours</span>
                  <Link to="/certificates/$code" params={{ code: c.code }} className="font-medium text-emerald-600 hover:underline">
                    Public Verification →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Impact Analytics & Charts */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-bold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Visual Impact Analytics
        </h2>
        <ImpactCharts />
      </section>

      {/* Personalized Recommendations Section */}
      <section className="mt-10">
        <RecommendationsSection />
      </section>
    </div>
  );
}

function VolunteerStatCard({
  icon: Icon,
  label,
  value,
  helper,
  color,
}: {
  icon: any;
  label: string;
  value: any;
  helper: string;
  color: string;
}) {
  return (
    <Card className="border-border transition-all hover:border-primary/40 hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="rounded-xl bg-muted p-2">
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
        <div className="mt-3 font-display text-3xl font-bold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  );
}
