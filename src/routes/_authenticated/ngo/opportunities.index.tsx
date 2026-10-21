import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";
import { Plus, Users, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ngo/opportunities/")({
  head: () => ({ meta: pageMeta("Manage opportunities — Volunteer Connect", "Create, edit, and manage your NGO’s volunteering opportunities.") }),
  component: NgoOpps,
});

function NgoOpps() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: myNgo } = useQuery({
    enabled: !!user,
    queryKey: ["my-ngo", user?.id],
    queryFn: async () => (await supabase.from("ngos").select("*").eq("owner_id", user!.id).maybeSingle()).data,
  });

  const { data: opps } = useQuery({
    enabled: !!myNgo,
    queryKey: ["ngo-opps", myNgo?.id],
    queryFn: async () => (await supabase.from("opportunities").select("*").eq("ngo_id", myNgo!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" | "closed" }) => {
      const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ngo-opps"] }); toast.success("Updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ngo-opps"] });
      toast.success("Opportunity deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete opportunity"),
  });

  if (!myNgo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-semibold">Register your NGO first</h1>
        <p className="mt-3 text-muted-foreground">You need a verified NGO profile before posting opportunities.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/ngo/register">Register NGO</Link></Button>
      </div>
    );
  }

  if (myNgo.status !== "verified") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-semibold">Awaiting verification</h1>
        <p className="mt-3 text-muted-foreground">Your NGO is {myNgo.status}. Once verified, you can post opportunities.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground">Manage postings for {myNgo.name}</p>
        </div>
        <Button asChild className="rounded-full"><Link to="/ngo/opportunities/new"><Plus className="size-4" /> New</Link></Button>
      </div>

      {!opps || opps.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No opportunities yet. Create your first!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {opps.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={o.status === "published" ? "default" : "outline"} className="capitalize">{o.status}</Badge>
                    <Badge variant="secondary">{CATEGORY_LABEL[o.category as CategoryKey]}</Badge>
                  </div>
                  <div className="truncate font-display text-lg font-semibold">{o.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{o.city ?? "—"} · {o.slots} spots</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/ngo/opportunities/$id/applicants" params={{ id: o.id }}><Users className="size-4" /> Applicants</Link></Button>
                  {o.status === "draft" && <Button size="sm" onClick={() => toggle.mutate({ id: o.id, status: "published" })} className="rounded-full">Publish</Button>}
                  {o.status === "published" && <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: o.id, status: "closed" })} className="rounded-full">Close</Button>}
                  {o.status === "closed" && <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: o.id, status: "published" })} className="rounded-full">Reopen</Button>}
                  <Button asChild size="sm" variant="ghost" className="rounded-full"><Link to="/ngo/opportunities/$id/edit" params={{ id: o.id }}><Edit className="size-4" /> Edit</Link></Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${o.title}"? This cannot be undone.`)) {
                        deleteOpp.mutate(o.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
