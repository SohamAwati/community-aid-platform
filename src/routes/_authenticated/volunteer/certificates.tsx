import { useState } from "react";
import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, BadgeCheck, Download, FileText, Eye } from "lucide-react";
import { downloadCertificate, CertificatePreviewDialog } from "@/lib/certificate-file";

export const Route = createFileRoute("/_authenticated/volunteer/certificates")({
  head: () => ({ meta: pageMeta("My certificates — Volunteer Connect", "View, verify and download the certificates you earned for completed volunteering.") }),
  component: MyCertificates,
});

type CombinedCertificate = {
  id: string;
  opportunityId: string;
  title: string;
  ngoName: string;
  issuedAt: string;
  digitalCert?: { code: string; hours: number };
  uploadedPath?: string;
};

function MyCertificates() {
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);

  const { data: certsList, isLoading } = useQuery<CombinedCertificate[]>({
    enabled: !!user,
    queryKey: ["my-combined-certificates", user?.id],
    queryFn: async () => {
      const [certsRes, appsRes] = await Promise.all([
        supabase
          .from("certificates")
          .select("id,code,hours,issued_at,opportunity_id,opportunities(id,title,ngos(name))")
          .eq("volunteer_id", user!.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("applications")
          .select("id,opportunity_id,certificate_url,created_at,completed_at,opportunities(id,title,ngos(name))")
          .eq("volunteer_id", user!.id)
          .not("certificate_url", "is", null),
      ]);

      const certs = certsRes.data ?? [];
      const apps = appsRes.data ?? [];

      const map = new Map<string, CombinedCertificate>();

      // 1. Add digital certificates
      for (const c of certs) {
        const opp = c.opportunities as { id?: string; title?: string; ngos?: { name?: string } | null } | null;
        map.set(c.opportunity_id, {
          id: c.id,
          opportunityId: c.opportunity_id,
          title: opp?.title || "Volunteering Initiative",
          ngoName: opp?.ngos?.name || "Verified NGO Partner",
          issuedAt: c.issued_at,
          digitalCert: { code: c.code, hours: Number(c.hours) || 0 },
        });
      }

      // 2. Add or merge uploaded certificates
      for (const a of apps) {
        const opp = a.opportunities as { id?: string; title?: string; ngos?: { name?: string } | null } | null;
        const existing = map.get(a.opportunity_id);
        if (existing) {
          existing.uploadedPath = a.certificate_url as string;
        } else {
          map.set(a.opportunity_id, {
            id: a.id,
            opportunityId: a.opportunity_id,
            title: opp?.title || "Volunteering Initiative",
            ngoName: opp?.ngos?.name || "Verified NGO Partner",
            issuedAt: a.completed_at || a.created_at,
            uploadedPath: a.certificate_url as string,
          });
        }
      }

      return Array.from(map.values());
    },
  });

  const handleDownload = async (path: string, oppTitle?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    downloadCertificate(data.signedUrl, oppTitle);
  };

  const handleView = async (path: string, oppTitle?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not load certificate"); return; }
    setPreviewTitle(oppTitle || "Participation Certificate");
    setPreviewUrl(data.signedUrl);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Award className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">My Certificates</h1>
          <p className="text-muted-foreground text-sm">Official verifiable credentials and documents awarded by non-profits for your contributions.</p>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Loading your certificates portfolio...</CardContent></Card>
      ) : !certsList || certsList.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Award className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <p>No certificates earned yet. Complete a volunteering activity to receive your verified participation certificate.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Explore volunteering opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {certsList.map((c) => {
            return (
              <Card key={c.id} className="overflow-hidden border border-border/80 shadow-sm transition hover:shadow-md">
                <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {c.digitalCert && (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-[11px] font-medium">
                          <BadgeCheck className="size-3.5 text-primary" /> Verified Code: {c.digitalCert.code}
                        </Badge>
                      )}
                      {c.uploadedPath && (
                        <Badge className="gap-1 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px]">
                          <FileText className="size-3" /> Uploaded Certificate Attached
                        </Badge>
                      )}
                    </div>

                    <div className="font-display text-lg font-semibold">{c.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {c.ngoName} · {c.digitalCert ? `${c.digitalCert.hours} certified hours · ` : ""}Issued {new Date(c.issuedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                    {/* NGO Uploaded Certificate Buttons */}
                    {c.uploadedPath && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full gap-1.5 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => handleView(c.uploadedPath!, c.title)}
                        >
                          <Eye className="size-3.5" /> View Certificate
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5 text-xs shadow-sm"
                          onClick={() => handleDownload(c.uploadedPath!, c.title)}
                        >
                          <Download className="size-3.5" /> Download
                        </Button>
                      </>
                    )}

                    {/* Verifiable Digital Certificate Button */}
                    {c.digitalCert && (
                      <Button asChild size="sm" variant={c.uploadedPath ? "outline" : "default"} className="rounded-full gap-1.5 text-xs border-primary/30">
                        <Link to="/certificates/$code" params={{ code: c.digitalCert.code }}>
                          <BadgeCheck className="size-3.5" /> View Digital Certificate
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Certificate In-App Preview Dialog */}
      <CertificatePreviewDialog
        open={!!previewUrl}
        onOpenChange={(open) => !open && setPreviewUrl(null)}
        url={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}
