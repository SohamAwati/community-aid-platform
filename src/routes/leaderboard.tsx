import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ShieldAlert, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSuspendedUserIds } from "@/lib/suspension";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: pageMeta("Leaderboard — Volunteer Connect", "Top volunteers by experience points and certified hours.") }),
  component: Leaderboard,
});

function Leaderboard() {
  const { user, isVolunteer, isNgoAdmin, isSuperAdmin, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    enabled: !authLoading && (isVolunteer || isSuperAdmin || !isNgoAdmin),
    queryFn: async () => {
      const suspendedIds = getSuspendedUserIds();

      const { data: stats } = await supabase
        .from("volunteer_stats")
        .select("user_id,total_hours,xp,level,streak_days,impact_score")
        .order("xp", { ascending: false })
        .order("total_hours", { ascending: false })
        .limit(50);

      // Filter out any suspended user ID immediately
      const activeStats = (stats ?? []).filter((s) => !suspendedIds.has(s.user_id));
      const ids = activeStats.map((s) => s.user_id);
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,city,country,is_suspended,status")
        .in("id", ids);

      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Filter out any suspended profiles
      return activeStats
        .map((s) => ({ ...s, profile: map.get(s.user_id) ?? null }))
        .filter((row: any) => {
          if (!row.profile) return true;
          if (row.profile.is_suspended || row.profile.status === "suspended") return false;
          return true;
        })
        .slice(0, 25);
    },
  });

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Restriction 1: Must be logged in as volunteer (or super admin)
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="border-border p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Trophy className="size-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Volunteer Impact Leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The Leaderboard is an exclusive feature for registered volunteers to track their XP, level progression, and community ranking. Please sign in as a volunteer to view the leaderboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild className="rounded-full shadow-sm">
              <Link to="/auth" search={{ mode: "signin" } as never}>Sign in as Volunteer</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/auth" search={{ mode: "signup" } as never}>Create Volunteer Account</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Restriction 2: NGOs should not access volunteer leaderboard
  if (isNgoAdmin && !isVolunteer && !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="border-border p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <Building2 className="size-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Volunteer Leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This leaderboard is an exclusive gamified portal for volunteers to showcase hours, badges, and community contribution points. Organization metrics and volunteer mobilization stats are available directly on your NGO Dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-sm">
              <Link to="/dashboard">Go to NGO Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/ngo/opportunities">Manage Opportunities</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-4xl font-semibold tracking-tight">
          <Trophy className="size-8 text-amber-500" /> Leaderboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Top active volunteers ranked by verified experience points and civic hours.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Top 25 Community Changemakers</CardTitle>
          <CardDescription>Only verified, active volunteers are featured.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-6 text-center">Loading rankings...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">No ranked volunteers yet. Complete drives to earn XP!</p>
          ) : (
            <ol className="divide-y divide-border">
              {data.map((row: any, i: number) => (
                <li key={row.user_id} className="flex items-center gap-4 py-3.5">
                  <div className={`w-8 text-center font-display text-xl font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-primary"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <Link to="/volunteers/$id" params={{ id: row.user_id }} className="font-medium hover:text-primary transition-colors">
                      {row.profile?.full_name ?? "Active Volunteer"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[row.profile?.city, row.profile?.country].filter(Boolean).join(", ") || "Active Contributor"} · Level {Math.floor((row.xp ?? 0) / 100) + 1}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold">{row.xp} XP</div>
                    <div className="text-xs text-muted-foreground">{row.total_hours}h · {row.streak_days}d streak</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
