import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpportunityCard } from "@/components/opportunity-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/volunteer/saved")({
  head: () => ({ meta: pageMeta("Saved opportunities — Volunteer Connect", "Revisit volunteering opportunities you have saved.") }),
  component: Saved,
});

function Saved() {
  const { user } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["saved", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("saved_opportunities")
        .select("opportunity_id,opportunities(id,title,city,country,location_mode,category,starts_at,slots,ngos(name,logo_url))")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.opportunities).filter(Boolean) as never[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Saved opportunities</h1>
      {!data || data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <p>Nothing saved yet.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Browse opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((o) => <OpportunityCard key={(o as { id: string }).id} o={o as never} />)}
        </div>
      )}
    </div>
  );
}
