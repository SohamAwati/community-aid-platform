import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Award,
  Clock,
  Flame,
  Sparkles,
  Trophy,
  Users,
  MapPin,
  Calendar,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Languages,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/volunteers/$id")({
  head: () => ({
    meta: pageMeta(
      "Volunteer Portfolio — Volunteer Connect",
      "Public volunteer portfolio: hours, badges, causes, and achievements."
    ),
  }),
  component: VolunteerProfile,
});

function VolunteerProfile() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["volunteer-portfolio", id],
    queryFn: async () => {
      const [profile, stats, badges, certs, apps] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,avatar_url,bio,skills,interests,languages,education,availability,city,state,country")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("volunteer_stats").select("*").eq("user_id", id).maybeSingle(),
        supabase
          .from("user_badges")
          .select("earned_at,badges(name,description,icon,tier)")
          .eq("user_id", id)
          .order("earned_at", { ascending: false }),
        supabase
          .from("certificates")
          .select("id,code,hours,issued_at,opportunities(title,ngos(name))")
          .eq("volunteer_id", id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("applications")
          .select("status,created_at,completed_at,opportunities(title,category,ngos(name))")
          .eq("volunteer_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (!profile.data) return null;
      return {
        profile: profile.data,
        stats: stats.data,
        badges: badges.data ?? [],
        certs: certs.data ?? [],
        apps: apps.data ?? [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Loading volunteer portfolio...
      </div>
    );
  }
  if (!data) throw notFound();

  const { profile, stats, badges, certs, apps } = data;
  const level = stats?.level ?? Math.max(1, Math.floor(((stats?.xp ?? 0) / 100) + 1));
  const xp = stats?.xp ?? 0;
  const xpProgress = Math.min(100, ((xp % 100) / 100) * 100);

  const causeCounts = new Map<string, number>();
  apps.forEach((a) => {
    const cat = (a as { opportunities?: { category?: string } | null }).opportunities?.category;
    if (cat) causeCounts.set(cat, (causeCounts.get(cat) ?? 0) + 1);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Volunteer Civic Identity Header */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-sky-500/10 to-indigo-500/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-5">
            <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/20 text-4xl font-display font-bold text-primary ring-4 ring-background shadow-md">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                (profile.full_name ?? "V").charAt(0).toUpperCase()
              )}
              <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
                L{level}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold tracking-tight">{profile.full_name ?? "Volunteer"}</h1>
                <Badge className="rounded-full bg-primary/15 text-primary border-primary/30">
                  <CheckCircle2 className="mr-1 size-3.5" /> Verified Volunteer
                </Badge>
                {profile.availability && (
                  <Badge variant="outline" className="rounded-full text-xs">
                    {profile.availability}
                  </Badge>
                )}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 text-primary" />
                {[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Active Member"}
              </p>
              {profile.bio && <p className="mt-2.5 max-w-2xl text-sm leading-relaxed">{profile.bio}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-card p-4 sm:min-w-[180px] shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Civic Level</span>
              <span className="text-primary font-bold">Lvl {level}</span>
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-foreground">{xp} <span className="text-sm font-normal text-muted-foreground">XP</span></div>
            <Progress value={xpProgress} className="mt-2 h-2" />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{xp % 100}/100 to Next Level</div>
          </div>
        </div>
      </div>

      {/* Gamified Impact Metrics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VolunteerStatCard icon={Clock} label="Hours Dedicated" value={stats?.total_hours ?? 0} color="text-sky-500" />
        <VolunteerStatCard icon={Trophy} label="Events Completed" value={stats?.completed_count ?? 0} color="text-amber-500" />
        <VolunteerStatCard icon={Flame} label="Active Streak" value={`${stats?.streak_days ?? 0} Days`} color="text-orange-500" />
        <VolunteerStatCard icon={Sparkles} label="Impact Score" value={stats?.impact_score ?? 0} color="text-purple-500" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left Column (2 Cols): Badges Showcase, Certificates, Experience Timeline */}
        <div className="space-y-8 lg:col-span-2">
          {/* Trophy Case: Badges */}
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Award className="size-5 text-amber-500" /> Trophy Case & Badges ({badges.length})
                </CardTitle>
                <CardDescription>Earned recognitions for volunteering dedication and milestones.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-xs text-muted-foreground">No badges unlocked yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {badges.map((b: any, idx: number) => {
                    const badge = b.badges;
                    const tier = badge?.tier || "bronze";
                    const tierGlow =
                      tier === "gold"
                        ? "border-amber-400 bg-amber-500/5 text-amber-600"
                        : tier === "silver"
                        ? "border-slate-300 bg-slate-500/5 text-slate-600"
                        : "border-orange-400/50 bg-orange-500/5 text-orange-700";

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center shadow-xs transition-transform hover:-translate-y-1 ${tierGlow}`}
                      >
                        <div className="flex size-11 items-center justify-center rounded-full bg-background shadow-xs">
                          <Award className="size-5" />
                        </div>
                        <div className="mt-2 font-semibold text-xs text-foreground line-clamp-1">{badge?.name}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5">{tier}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{badge?.description}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verified Certificates */}
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <ShieldCheck className="size-5 text-emerald-600" /> Verified Certificates of Appreciation ({certs.length})
                </CardTitle>
                <CardDescription>Tamper-evident credentials issued by verified non-profits.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {certs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Certificates appear here after non-profits confirm attendance.</p>
              ) : (
                <div className="space-y-3">
                  {certs.map((c: any) => {
                    const opp = c.opportunities;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-semibold text-foreground">{opp?.title || "Certificate"}</h4>
                            <Badge className="bg-emerald-600 text-white text-[10px] font-mono">{c.code}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {opp?.ngos?.name} · {c.hours ?? 0} hours certified · {new Date(c.issued_at).toLocaleDateString()}
                          </div>
                        </div>

                        {c.code && (
                          <Button asChild size="sm" variant="outline" className="rounded-full text-xs self-start sm:self-center border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                            <Link to="/certificates/$code" params={{ code: c.code }}>
                              Public Verification <ExternalLink className="ml-1 size-3" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volunteering Activity Log */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">Civic Journey & Completed Drives</CardTitle>
              <CardDescription>Chronological log of volunteer commitments and community drives.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-primary/20 pl-5">
                {apps
                  .filter((a: any) => a.completed_at || a.status === "completed")
                  .slice(0, 10)
                  .map((a: any, i: number) => {
                    const opp = a.opportunities;
                    return (
                      <li key={i} className="relative">
                        <span className="absolute -left-[27px] mt-1 flex size-3 rounded-full bg-primary ring-4 ring-background" />
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.completed_at ?? a.created_at).toLocaleDateString()}
                        </div>
                        <div className="font-semibold text-foreground">{opp?.title ?? "Volunteering Activity"}</div>
                        {opp?.ngos?.name && <div className="text-xs text-muted-foreground">with {opp.ngos.name}</div>}
                      </li>
                    );
                  })}
                {apps.filter((a: any) => a.completed_at || a.status === "completed").length === 0 && (
                  <li className="text-sm text-muted-foreground">No completed events yet.</li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Skills, Causes & Background Details */}
        <div className="space-y-8">
          {/* Causes Breakdown */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-4 text-primary" /> Causes Supported
              </CardTitle>
            </CardHeader>
            <CardContent>
              {causeCounts.size === 0 ? (
                <p className="text-xs text-muted-foreground">No causes yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...causeCounts.entries()].map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="rounded-full capitalize px-3 py-1">
                      {k.replace(/_/g, " ")} · {v} event{v !== 1 ? "s" : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volunteer Skills & Interests */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="size-4 text-primary" /> Skills & Expertise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s: string) => (
                      <span key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Interests</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((it: string) => (
                      <span key={it} className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                        {it.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Languages className="size-3" /> Languages
                  </div>
                  <p className="text-xs text-foreground">{profile.languages.join(", ")}</p>
                </div>
              )}

              {profile.education && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <GraduationCap className="size-3" /> Education
                  </div>
                  <p className="text-xs text-foreground">{profile.education}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VolunteerStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: any;
  color: string;
}) {
  return (
    <Card className="border-border transition-all hover:border-primary/40 hover:shadow-xs">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="rounded-xl bg-muted p-2">
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
        <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
