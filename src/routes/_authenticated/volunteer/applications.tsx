import { useState } from "react";
import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Download, Check, Sparkles, Award, Eye } from "lucide-react";
import { toast } from "sonner";
import { downloadCertificate, CertificatePreviewDialog } from "@/lib/certificate-file";

export const Route = createFileRoute("/_authenticated/volunteer/applications")({
  head: () => ({ meta: pageMeta("My applications — Volunteer Connect", "Track your applications and NGO decisions.") }),
  component: VolApps,
});

function VolApps() {
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);

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
    queryFn: async () => (await supabase.from("certificates").select("code,opportunity_id,hours").eq("volunteer_id", user!.id)).data ?? [],
  });

  const handleDownload = async (path: string, title?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    downloadCertificate(data.signedUrl, title);
  };

  const handleView = async (path: string, title?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not load certificate"); return; }
    setPreviewTitle(title || "Participation Certificate");
    setPreviewUrl(data.signedUrl);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">My Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your volunteer application statuses, NGO decisions, attendance, and earned certificates.</p>
      </div>

      {!data || data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <p>You haven't applied to anything yet.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/opportunities">Find opportunities</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {data.map((a) => {
            const o = a.opportunities as { id: string; title: string; city?: string; ngos?: { name: string } } | null;
            const cert = (certs ?? []).find((c) => c.opportunity_id === a.opportunity_id);
            const isAccepted = a.status === "accepted";
            const isCompleted = a.status === "completed";

            return (
              <Card key={a.id} className={`overflow-hidden transition ${isAccepted ? "border-emerald-500/40 shadow-sm" : ""}`}>
                <CardContent className="space-y-3.5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {isAccepted ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-medium">
                            <Check className="size-3" /> Application Accepted 🎉
                          </Badge>
                        ) : isCompleted ? (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1 font-medium">
                            <Award className="size-3" /> Completed &amp; Certified
                          </Badge>
                        ) : (
                          <Badge variant={a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                            {a.status === "pending" ? "Under Review by NGO ⏳" : a.status}
                          </Badge>
                        )}

                        {a.attendance && (
                          <Badge
                            variant={a.attendance === "present" ? "default" : "outline"}
                            className={`text-xs ${a.attendance === "present" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : ""}`}
                          >
                            Attendance: {a.attendance === "present" ? "Present ✅" : "Absent"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">Applied {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="font-display text-lg font-semibold">{o?.title}</div>
                      <div className="text-sm text-muted-foreground">{o?.ngos?.name} · {o?.city ?? "—"}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {a.certificate_url && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-1.5 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => handleView(a.certificate_url!, o?.title)}
                          >
                            <Eye className="size-3.5" /> View Certificate
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-1.5 shadow-sm text-xs"
                            onClick={() => handleDownload(a.certificate_url!, o?.title)}
                          >
                            <Download className="size-3.5" /> Download
                          </Button>
                        </>
                      )}
                      {cert && (
                        <Button asChild size="sm" variant={a.certificate_url ? "outline" : "default"} className="rounded-full gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10">
                          <Link to="/certificates/$code" params={{ code: cert.code }}>
                            <BadgeCheck className="size-3.5" /> Digital Certificate · {cert.hours ?? 0}h
                          </Link>
                        </Button>
                      )}
                      {o && (
                        <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                          <Link to="/opportunities/$id" params={{ id: o.id }}>
                            View Event
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ACCEPTED BANNER */}
                  {isAccepted && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                      <Sparkles className="size-4 mt-0.5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold">Congratulations! Your application has been accepted.</span>
                        <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
                          {o?.ngos?.name} has selected you for this volunteering drive. Please be prepared and on time. Your attendance will be marked on the day of the event.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* REJECTION REASON */}
                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                      <span className="font-semibold">Feedback from NGO:</span> {a.rejection_reason}
                    </p>
                  )}
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
