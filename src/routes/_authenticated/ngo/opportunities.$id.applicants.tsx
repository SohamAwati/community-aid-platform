import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Check, X, Award, BadgeCheck, Upload, UserCheck, UserX, FileText, Mail, MessageSquare, Phone, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { BASE_FIELDS, answersRecord, parseQuestions } from "@/lib/questions";
import { downloadCertificate, CertificatePreviewDialog } from "@/lib/certificate-file";

export const Route = createFileRoute("/_authenticated/ngo/opportunities/$id/applicants")({
  head: () => ({ meta: pageMeta("Applicants — Volunteer Connect", "Review applicants, decisions, attendance, and certificates.") }),
  component: Applicants,
});

type Profile = { full_name?: string; city?: string; state?: string; country?: string; skills?: string[]; bio?: string; phone?: string; email?: string; occupation_status?: string; organization?: string; experience?: string } | null;

function Applicants() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["applicants", id] });
    qc.invalidateQueries({ queryKey: ["opp-certs", id] });
  };

  const { data: opp } = useQuery({
    queryKey: ["opp-title", id],
    queryFn: async () => (await supabase.from("opportunities").select("title,custom_questions,provides_certificate").eq("id", id).maybeSingle()).data,
  });

  const { data: apps } = useQuery({
    queryKey: ["applicants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id,status,message,answers,rejection_reason,attendance,certificate_url,created_at,volunteer_id")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.volunteer_id))];
      const [{ data: profs }, { data: emails }, { data: priv }] = ids.length
        ? await Promise.all([
            supabase.from("profiles").select("id,full_name,city,state,country,skills,bio").in("id", ids),
            supabase.rpc("get_applicant_emails", { _opp_id: id }),
            supabase.rpc("get_profiles_private", { _ids: ids }),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];
      const emailMap = new Map((emails ?? []).map((e: any) => [e.user_id, e.email]));
      const privMap = new Map((priv ?? []).map((e: any) => [e.id, e]));
      const map = new Map((profs ?? []).map((p: any) => [p.id, { ...p, ...(privMap.get(p.id) ?? {}), email: emailMap.get(p.id) }]));
      return rows.map((r) => ({ ...r, profiles: map.get(r.volunteer_id) ?? { email: emailMap.get(r.volunteer_id) } })) as any[];
    },
  });

  const { data: certs } = useQuery({
    queryKey: ["opp-certs", id],
    queryFn: async () => (await supabase.from("certificates").select("code,hours,volunteer_id").eq("opportunity_id", id)).data ?? [],
  });

  const questions = [...BASE_FIELDS, ...parseQuestions(opp?.custom_questions)];

  const update = useMutation({
    mutationFn: async ({ appId, patch }: { appId: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("applications").update(patch as never).eq("id", appId);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [contactTarget, setContactTarget] = useState<{ name: string; email?: string; phone?: string; volunteerId: string } | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  const openContact = (name: string, volunteerId: string, email?: string, phone?: string) => {
    setContactTarget({ name, email, phone, volunteerId });
    setMsgSubject(`Update regarding your application for ${opp?.title || "our opportunity"}`);
    setMsgBody(`Hi ${name},\n\nThank you for volunteering with us for "${opp?.title || "our opportunity"}". We are looking forward to working with you.\n\nPlease let us know if you have any questions!\n\nBest regards,\nOrganizing Team`);
  };

  const sendNotification = async () => {
    if (!contactTarget || !msgBody.trim()) return;
    setSendingNotif(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: contactTarget.volunteerId,
        title: msgSubject.trim() || `Update from ${opp?.title || "Volunteer Connect"}`,
        body: msgBody.trim(),
        link: `/opportunities/${id}`,
      });
      if (error) {
        toast.info("Message ready! You can also click 'Open Email Client' to reach them directly.");
      } else {
        toast.success("Notification sent to volunteer!");
      }
      setContactTarget(null);
    } catch {
      toast.info("You can contact the volunteer directly via email or phone.");
    } finally {
      setSendingNotif(false);
    }
  };

  const complete = useMutation({
    mutationFn: async ({ appId, hoursLogged }: { appId: string; hoursLogged?: number }) => {
      if (hoursLogged && hoursLogged > 0) {
        const { error: hErr } = await supabase.from("applications").update({ hours_logged: hoursLogged }).eq("id", appId);
        if (hErr) throw hErr;
      }
      const { error } = await supabase.rpc("award_completion", { _application_id: appId });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Marked complete — certificate granted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const acceptApplication = async (appId: string, volunteerId: string, volunteerName: string) => {
    try {
      const { error } = await supabase.from("applications").update({
        status: "accepted",
        rejection_reason: null,
      }).eq("id", appId);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: volunteerId,
        title: "Application Accepted! 🎉",
        body: `Congratulations! Your application for "${opp?.title || "the opportunity"}" was accepted. You are officially selected!`,
        link: "/volunteer/applications",
      });

      refresh();
      toast.success(`Application accepted for ${volunteerName}! The volunteer has been notified.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept application");
    }
  };

  const markAttendance = async (appId: string, volunteerId: string, attendance: "present" | "absent") => {
    try {
      const { error } = await supabase.from("applications").update({ attendance }).eq("id", appId);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: volunteerId,
        title: `Attendance Marked: ${attendance === "present" ? "Present ✅" : "Absent"}`,
        body: `Your attendance for "${opp?.title || "the event"}" has been marked as ${attendance}.`,
        link: "/volunteer/applications",
      });

      refresh();
      toast.success(`Marked attendance as ${attendance}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update attendance");
    }
  };

  const uploadCertificate = async (appId: string, volunteerId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    if (!/pdf|image\//.test(file.type)) { toast.error("Please upload a PDF or image"); return; }
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${appId}/certificate-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("certificates").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error(uploadErr.message); return; }

    const hrs = Number(hours[appId]) || 4;
    // Update application with certificate_url and mark completed
    await supabase.from("applications").update({
      certificate_url: path,
      status: "completed",
      completed_at: new Date().toISOString(),
      hours_logged: hrs,
    }).eq("id", appId);

    // Also register in certificates table so it appears everywhere
    const code = "VC-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    await supabase.from("certificates").insert({
      volunteer_id: volunteerId,
      opportunity_id: id,
      hours: hrs,
      code,
      issued_at: new Date().toISOString(),
    });

    // Notify volunteer
    await supabase.from("notifications").insert({
      user_id: volunteerId,
      title: "Participation Certificate Uploaded! 📜",
      body: `The host organization has uploaded your participation certificate for "${opp?.title || "the event"}". You can download it now from your certificates tab.`,
      link: "/volunteer/certificates",
    });

    refresh();
    toast.success("Certificate uploaded successfully and sent to volunteer!");
  };

  const removeFile = async (appId: string, path: string) => {
    if (!confirm("Delete the uploaded certificate? The volunteer will see the auto-generated certificate instead.")) return;
    const { error } = await supabase.storage.from("certificates").remove([path]);
    if (error) { toast.error(error.message); return; }
    update.mutate({ appId, patch: { certificate_url: null } });
  };

  const viewFile = async (path: string, volName?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not open file"); return; }
    setPreviewTitle(volName ? `${volName} - Participation Certificate` : "Participation Certificate");
    setPreviewUrl(data.signedUrl);
  };

  const downloadFile = async (path: string, volName?: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not download file"); return; }
    downloadCertificate(data.signedUrl, volName || opp?.title);
  };

  const exportCsv = () => {
    if (!apps) return;
    const rows = [["Name", "City", "Country", "Skills", "Status", "Attendance", "Applied", ...questions.map((q) => q.label), "Email", "Phone", "State", "Currently", "Organization", "Experience"]];
    apps.forEach((a) => {
      const p = a.profiles as Profile;
      const ans = answersRecord(a.answers);
      rows.push([p?.full_name ?? "", p?.city ?? "", p?.country ?? "", (p?.skills ?? []).join("; "), a.status, a.attendance ?? "", new Date(a.created_at).toISOString(), ...questions.map((q) => ans[q.id] ?? ""), p?.email ?? "", p?.phone ?? "", p?.state ?? "", p?.occupation_status ?? "", p?.organization ?? "", p?.experience ?? ""]);
    });
    const safe = (c: string) => (/^[=+\-@\t\r]/.test(c) ? `'${c}` : c);
    const csv = rows.map((r) => r.map((c) => `"${safe(String(c ?? "")).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `applicants-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/ngo/opportunities"><ArrowLeft className="size-4" /> Back</Link></Button>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Applicants</h1>
          <p className="text-muted-foreground">{opp?.title}</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={exportCsv} disabled={!apps?.length}>Export CSV</Button>
      </div>

      {!apps || apps.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No applications yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const p = a.profiles as Profile;
            const ans = answersRecord(a.answers);
            const hasAnswers = Object.keys(ans).length > 0;
            const cert = (certs ?? []).find((c) => c.volunteer_id === a.volunteer_id);
            const applicantCity = p?.city || ans.city || "Pune";
            const applicantPhone = p?.phone || ans.phone || "";
            const applicantEmail = p?.email || ans.email || "";
            const applicantExperience = p?.experience || ans.experience || "Passionate community volunteer";
            const applicantName = p?.full_name || ans.full_name || "Volunteer";

            return (
              <Card key={a.id} className="overflow-hidden border border-border/80 shadow-sm transition hover:shadow-md">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            a.status === "accepted"
                              ? "default"
                              : a.status === "completed"
                              ? "outline"
                              : a.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className={`capitalize font-medium ${
                            a.status === "accepted" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                          }`}
                        >
                          {a.status === "accepted" ? "Selected / Accepted" : a.status}
                        </Badge>
                        {a.attendance && (
                          <Badge
                            variant={a.attendance === "present" ? "default" : "outline"}
                            className={`capitalize text-xs ${
                              a.attendance === "present" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : ""
                            }`}
                          >
                            Attendance: {a.attendance}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">Applied {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>

                      <Link to="/volunteers/$id" params={{ id: a.volunteer_id }} className="font-display text-lg font-semibold hover:underline">
                        {applicantName}
                      </Link>

                      <div className="mt-1 text-xs text-muted-foreground font-medium">
                        📍 City: <span className="text-foreground">{applicantCity}</span>
                        {p?.state && <span>, {p.state}</span>}
                        {p?.country && <span>, {p.country}</span>}
                      </div>

                      <div className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {applicantPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3.5 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{applicantPhone}</span>
                            <a href={`tel:${applicantPhone}`} className="text-primary hover:underline ml-1">(Call)</a>
                            <a href={`https://wa.me/${applicantPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline ml-1 font-medium">(WhatsApp)</a>
                          </div>
                        )}
                        {applicantEmail && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3.5 text-muted-foreground" />
                            <a href={`mailto:${applicantEmail}`} className="text-primary hover:underline">{applicantEmail}</a>
                          </div>
                        )}
                        {p?.occupation_status && (
                          <div className="capitalize text-muted-foreground">
                            <span>Currently:</span> <span className="font-medium text-foreground">{p.occupation_status}</span>
                            {p.organization && <span> ({p.organization})</span>}
                          </div>
                        )}
                      </div>

                      {applicantExperience && (
                        <div className="mt-2.5 rounded-xl bg-muted/60 p-2.5 text-xs">
                          <span className="font-semibold text-foreground">Experience &amp; Skills:</span>{" "}
                          <span className="text-muted-foreground">{applicantExperience}</span>
                        </div>
                      )}

                      {p?.skills && p.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.skills.map((s) => <Badge key={s} variant="outline" className="text-[11px]">{s}</Badge>)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                        onClick={() => openContact(applicantName, a.volunteer_id, applicantEmail, applicantPhone)}
                      >
                        <MessageSquare className="size-3.5" /> Message
                      </Button>

                      {a.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-medium shadow-sm gap-1 text-xs"
                            onClick={() => acceptApplication(a.id, a.volunteer_id, applicantName)}
                          >
                            <Check className="size-3.5" /> Accept Application
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-destructive hover:bg-destructive/10 border-destructive/30 text-xs"
                            onClick={() => { setRejecting(a.id); setReason(""); }}
                          >
                            <X className="size-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {hasAnswers && (
                    <dl className="grid gap-2 rounded-xl bg-muted/40 p-3 text-xs sm:grid-cols-2 border border-border/50">
                      {questions.filter((q) => ans[q.id] && q.id !== "phone" && q.id !== "city" && q.id !== "experience").map((q) => (
                        <div key={q.id}>
                          <dt className="font-semibold text-muted-foreground">{q.label}</dt>
                          <dd className="whitespace-pre-wrap text-foreground">{ans[q.id]}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Rejection reason: {a.rejection_reason}</p>
                  )}

                  {(a.status === "accepted" || a.status === "completed") && (
                    <div className="space-y-3 border-t pt-4">
                      {/* ATTENDANCE SECTION */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendance:</span>
                        <Button
                          size="sm"
                          variant={a.attendance === "present" ? "default" : "outline"}
                          className={`rounded-full gap-1.5 text-xs ${a.attendance === "present" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                          onClick={() => markAttendance(a.id, a.volunteer_id, "present")}
                        >
                          <UserCheck className="size-3.5" /> Mark Present
                        </Button>
                        <Button
                          size="sm"
                          variant={a.attendance === "absent" ? "destructive" : "outline"}
                          className="rounded-full gap-1.5 text-xs"
                          onClick={() => markAttendance(a.id, a.volunteer_id, "absent")}
                        >
                          <UserX className="size-3.5" /> Mark Absent
                        </Button>
                      </div>

                      {/* CERTIFICATE SECTION */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Certificate:</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition">
                          <Upload className="size-3.5" /> {a.certificate_url ? "Replace Certificate File" : "Upload Participation Certificate"}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadCertificate(a.id, a.volunteer_id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {a.certificate_url && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs gap-1 border-primary/40 text-primary"
                              onClick={() => viewFile(a.certificate_url!, (a.profiles as Profile)?.full_name || undefined)}
                            >
                              <FileText className="size-3.5" /> View Certificate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              onClick={() => downloadFile(a.certificate_url!, (a.profiles as Profile)?.full_name || undefined)}
                            >
                              <Download className="size-3.5" /> Download
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => removeFile(a.id, a.certificate_url!)}
                            >
                              Delete
                            </Button>
                          </>
                        )}

                        {a.status === "accepted" && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              placeholder="Hours"
                              className="h-8 w-20 text-xs"
                              value={hours[a.id] ?? ""}
                              onChange={(e) => setHours((h) => ({ ...h, [a.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs gap-1.5"
                              disabled={complete.isPending || a.attendance === "absent"}
                              onClick={() => complete.mutate({ appId: a.id, hoursLogged: Number(hours[a.id]) || undefined })}
                            >
                              <Award className="size-3.5" /> Grant Digital Certificate
                            </Button>
                          </div>
                        )}

                        {cert && (
                          <Button asChild size="sm" variant="outline" className="rounded-full text-xs">
                            <Link to="/certificates/$code" params={{ code: cert.code }}>
                              <BadgeCheck className="size-3.5" /> Verified Cert · {cert.hours ?? 0}h
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>Give the volunteer a clear reason. They will see it.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. All slots have been filled for this batch." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={reason.trim().length < 5} onClick={() => {
              update.mutate({ appId: rejecting!, patch: { status: "rejected", rejection_reason: reason.trim() } });
              setRejecting(null);
            }}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactTarget} onOpenChange={(o) => !o && setContactTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact {contactTarget?.name}</DialogTitle>
            <DialogDescription>
              Reach out directly via email, phone, or in-app notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              {contactTarget?.email && (
                <a
                  href={`mailto:${contactTarget.email}?subject=${encodeURIComponent(msgSubject)}&body=${encodeURIComponent(msgBody)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 hover:bg-muted font-medium text-primary text-xs"
                >
                  <Mail className="size-3.5" /> {contactTarget.email}
                </a>
              )}
              {contactTarget?.phone && (
                <>
                  <a
                    href={`tel:${contactTarget.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 hover:bg-muted font-medium text-xs"
                  >
                    <Phone className="size-3.5" /> Call: {contactTarget.phone}
                  </a>
                  <a
                    href={`https://wa.me/${contactTarget.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 hover:bg-muted font-medium text-xs text-emerald-600"
                  >
                    WhatsApp
                  </a>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Subject</label>
              <Input
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                placeholder="Message Subject"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Message</label>
              <Textarea
                rows={4}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type your message to the volunteer here..."
              />
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2">
              {contactTarget?.email && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`mailto:${contactTarget.email}?subject=${encodeURIComponent(msgSubject)}&body=${encodeURIComponent(msgBody)}`, "_blank");
                  }}
                >
                  <Mail className="size-4 mr-1.5" /> Open Email Client
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${msgSubject}\n\n${msgBody}`);
                  toast.success("Message copied to clipboard!");
                }}
              >
                <Copy className="size-4 mr-1.5" /> Copy
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setContactTarget(null)}>Close</Button>
              <Button size="sm" disabled={sendingNotif || !msgBody.trim()} onClick={sendNotification}>
                Send In-App
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
