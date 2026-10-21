import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: pageMeta("Leaderboard — Volunteer Connect", "Top volunteers this month.") }),
  component: Leaderboard,
});

function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data: stats } = await supabase
        .from("volunteer_stats")
        .select("user_id,total_hours,xp,level,streak_days,impact_score")
        .order("xp", { ascending: false }).order("total_hours", { ascending: false })
        .limit(25);
      const ids = (stats ?? []).map((s) => s.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,city,country").in("id", ids);
      const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      return (stats ?? []).map((s) => ({ ...s, profile: map.get(s.user_id) ?? null }));
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-4xl font-semibold tracking-tight"><Trophy className="size-8 text-amber-500" /> Leaderboard</h1>
        <p className="mt-2 text-muted-foreground">Top volunteers by experience points.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display">Top 25</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground">No ranked volunteers yet. Be the first!</p>
          ) : (
            <ol className="divide-y divide-border">
              {data.map((row, i) => (
                <li key={row.user_id} className="flex items-center gap-4 py-3">
                  <div className="w-8 text-center font-display text-xl font-semibold text-primary">{i + 1}</div>
                  <div className="flex-1">
                    <Link to="/volunteers/$id" params={{ id: row.user_id }} className="font-medium hover:text-primary">
                      {row.profile?.full_name ?? "Volunteer"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[row.profile?.city, row.profile?.country].filter(Boolean).join(", ")} · Level {Math.floor((row.xp ?? 0) / 100) + 1}
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
