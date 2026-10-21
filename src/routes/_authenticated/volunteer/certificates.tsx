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
  const download = async (path: string, oppTitle?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    const ext = data.signedUrl.startsWith("data:image/svg") ? "svg" : data.signedUrl.startsWith("data:image/png") ? "png" : "pdf";
    a.download = `certificate-${(oppTitle || "volunteer").toLowerCase().replace(/[^a-z0-9]/g, "-")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Certificate download started!");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Award className="size-6 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">My Certificates</h1>
          <p className="text-muted-foreground">Every completed activity earns an official verifiable certificate issued by the host NGO.</p>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Loading certificates...</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <p>No certificates earned yet. Complete a volunteering activity to receive your verified participation certificate.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Explore volunteering opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3.5">
          {data.map((c) => {
            const opp = c.opportunities as { title?: string; ngos?: { name?: string } | null } | null;
            const uploadedFile = uploads?.get(c.opportunity_id);

            return (
              <Card key={c.id} className="overflow-hidden border border-border/80 shadow-sm transition hover:shadow-md">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                      <BadgeCheck className="size-4 text-primary" /> Verified Code: {c.code}
                    </div>
                    <div className="font-display text-lg font-semibold">{opp?.title ?? "Volunteering activity"}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {opp?.ngos?.name ?? "Host Organization"} · <span className="font-medium text-foreground">{c.hours ?? 0} hours</span> verified · Issued {new Date(c.issued_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {uploadedFile && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5 text-xs shadow-sm"
                        onClick={() => download(uploadedFile, opp?.title)}
                      >
                        <Download className="size-3.5" /> Download NGO Certificate
                      </Button>
                    )}
                    <Button asChild size="sm" variant={uploadedFile ? "outline" : "default"} className="rounded-full gap-1.5 text-xs">
                      <Link to="/certificates/$code" params={{ code: c.code }}>
                        <BadgeCheck className="size-3.5" /> View Digital Certificate
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
