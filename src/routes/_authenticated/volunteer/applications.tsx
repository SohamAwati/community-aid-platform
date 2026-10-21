import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/volunteer/applications")({
  head: () => ({ meta: pageMeta("My applications — Volunteer Connect", "Track your applications and NGO decisions.") }),
  component: VolApps,
});

function VolApps() {
  const { user } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["my-apps", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("applications")
        .select("id,status,created_at,rejection_reason,attendance,certificate_url,opportunity_id,opportunities(id,title,city,starts_at,ngos(name))")
        .eq("volunteer_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: certs } = useQuery({
    enabled: !!user,
    queryKey: ["my-certificates-map", user?.id],
    queryFn: async () => (await supabase.from("certificates").select("code,opportunity_id").eq("volunteer_id", user!.id)).data ?? [],
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">My applications</h1>
      {!data || data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <p>You haven't applied to anything yet.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Find opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => {
            const o = a.opportunities as { id: string; title: string; city?: string; ngos?: { name: string } } | null;
            const cert = (certs ?? []).find((c) => c.opportunity_id === a.opportunity_id);
            return (
              <Card key={a.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={a.status === "accepted" || a.status === "completed" ? "default" : a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
                        {a.attendance && <Badge variant="outline" className="capitalize">Attendance: {a.attendance}</Badge>}
                        <span className="text-xs text-muted-foreground">Applied {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="font-display text-lg font-semibold">{o?.title}</div>
                      <div className="text-sm text-muted-foreground">{o?.ngos?.name} · {o?.city ?? "—"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.certificate_url && <Button size="sm" className="rounded-full" onClick={() => download(a.certificate_url!)}><Download className="size-4" /> Download certificate</Button>}
                      {cert && !a.certificate_url && <Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/certificates/$code" params={{ code: cert.code }}><BadgeCheck className="size-4" /> Digital certificate</Link></Button>}
                      {o && <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/opportunities/$id" params={{ id: o.id }}>View</Link></Button>}
                    </div>
                  </div>
                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Reason from NGO: {a.rejection_reason}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
