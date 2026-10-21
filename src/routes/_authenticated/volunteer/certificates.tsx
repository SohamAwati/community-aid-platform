import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Award, BadgeCheck, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/volunteer/certificates")({
  head: () => ({ meta: pageMeta("My certificates — Volunteer Connect", "View, verify and download the certificates you earned for completed volunteering.") }),
  component: MyCertificates,
});

function MyCertificates() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id,code,hours,issued_at,opportunity_id,opportunities(title,ngos(name))")
        .eq("volunteer_id", user!.id)
        .order("issued_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: uploads } = useQuery({
    enabled: !!user,
    queryKey: ["my-cert-uploads", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("opportunity_id,certificate_url").eq("volunteer_id", user!.id).not("certificate_url", "is", null);
      return new Map((data ?? []).map((r) => [r.opportunity_id, r.certificate_url as string]));
    },
  });
  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Award className="size-6 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">My certificates</h1>
          <p className="text-muted-foreground">Every completed activity earns a verifiable certificate.</p>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <p>No certificates yet. Complete a volunteering activity to earn your first one.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Find opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((c) => {
            const opp = c.opportunities as { title?: string; ngos?: { name?: string } | null } | null;
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1 text-xs text-primary">
                      <BadgeCheck className="size-4" /> {c.code}
                    </div>
                    <div className="font-display text-lg font-semibold">{opp?.title ?? "Volunteering activity"}</div>
                    <div className="text-sm text-muted-foreground">
                      {opp?.ngos?.name ?? "—"} · {c.hours ?? 0} hours · Issued {new Date(c.issued_at).toLocaleDateString()}
                    </div>
                  </div>
                  {uploads?.get(c.opportunity_id) ? (
                    <Button className="rounded-full" onClick={() => download(uploads.get(c.opportunity_id)!)}>
                      <Download className="size-4" /> Download NGO certificate
                    </Button>
                  ) : (
                    <Button asChild className="rounded-full">
                      <Link to="/certificates/$code" params={{ code: c.code }}>
                        <Download className="size-4" /> View / download
                      </Link>
                    </Button>
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
