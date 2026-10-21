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
import { ArrowLeft, Check, X, Award, BadgeCheck, Upload, UserCheck, UserX, FileText, Mail, MessageSquare, Phone, Copy } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { BASE_FIELDS, answersRecord, parseQuestions } from "@/lib/questions";

export const Route = createFileRoute("/_authenticated/ngo/opportunities/$id/applicants")({
  head: () => ({ meta: pageMeta("Applicants — Volunteer Connect", "Review applicants, decisions, attendance, and certificates.") }),
  component: Applicants,
});

type Profile = { full_name?: string; city?: string; state?: string; country?: string; skills?: string[]; bio?: string; phone?: string; email?: string; occupation_status?: string; organization?: string; experience?: string } | null;

function Applicants() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
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

  const upload = async (appId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    if (!/pdf|image\//.test(file.type)) { toast.error("Upload a PDF or image"); return; }
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${appId}/certificate-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("certificates").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    update.mutate({ appId, patch: { certificate_url: path } });
  };

  const removeFile = async (appId: string, path: string) => {
    if (!confirm("Delete the uploaded certificate? The volunteer will see the auto-generated certificate instead.")) return;
    const { error } = await supabase.storage.from("certificates").remove([path]);
    if (error) { toast.error(error.message); return; }
    update.mutate({ appId, patch: { certificate_url: null } });
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
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
            return (
              <Card key={a.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={a.status === "accepted" || a.status === "completed" ? "default" : a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
                        {a.attendance && <Badge variant="outline" className="capitalize">{a.attendance}</Badge>}
                        <span className="text-xs text-muted-foreground">Applied {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      <Link to="/volunteers/$id" params={{ id: a.volunteer_id }} className="font-display text-lg font-semibold hover:underline">{p?.full_name ?? "Unnamed volunteer"}</Link>
                      <div className="text-sm text-muted-foreground">{[p?.city, p?.state, p?.country].filter(Boolean).join(", ")}</div>
                      <div className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                        {p?.email && <div><span className="text-muted-foreground">Email:</span> {p.email}</div>}
                        {p?.phone && <div><span className="text-muted-foreground">Phone:</span> {p.phone}</div>}
                        {p?.occupation_status && <div className="capitalize"><span className="normal-case text-muted-foreground">Currently:</span> {p.occupation_status}{p.organization && <span className="normal-case"> — {p.organization}</span>}</div>}
                        {p?.experience && <div className="sm:col-span-2"><span className="text-muted-foreground">Experience:</span> {p.experience}</div>}
                      </div>
                      {p?.skills && p.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">{p.skills.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => openContact(p?.full_name ?? "Volunteer", a.volunteer_id, p?.email, p?.phone)}
                      >
                        <MessageSquare className="size-4" /> Message
                      </Button>
                      {a.status === "pending" && (
                        <>
                          <Button size="sm" className="rounded-full" onClick={() => update.mutate({ appId: a.id, patch: { status: "accepted", rejection_reason: null } })}><Check className="size-4" /> Accept</Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setRejecting(a.id); setReason(""); }}><X className="size-4" /> Reject</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {hasAnswers ? (
                    <dl className="grid gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-2">
                      {questions.filter((q) => ans[q.id]).map((q) => (
                        <div key={q.id}><dt className="text-xs font-semibold text-muted-foreground">{q.label}</dt><dd className="whitespace-pre-wrap">{ans[q.id]}</dd></div>
                      ))}
                    </dl>
                  ) : a.message ? (
                    <p className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm">{a.message}</p>
                  ) : null}

                  {a.status === "rejected" && a.rejection_reason && (
                    <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Reason: {a.rejection_reason}</p>
                  )}

                  {(a.status === "accepted" || a.status === "completed") && (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                      <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendance</span>
                      <Button size="sm" variant={a.attendance === "present" ? "default" : "outline"} className="rounded-full" onClick={() => update.mutate({ appId: a.id, patch: { attendance: "present" } })}><UserCheck className="size-4" /> Present</Button>
                      <Button size="sm" variant={a.attendance === "absent" ? "destructive" : "outline"} className="rounded-full" onClick={() => update.mutate({ appId: a.id, patch: { attendance: "absent" } })}><UserX className="size-4" /> Absent</Button>
                    </div>
                  )}

                  {(a.status === "accepted" || a.status === "completed") && (
                    <div className="flex flex-wrap items-center gap-2">
                      {a.status === "accepted" && (
                        <>
                          <Input type="number" min={1} placeholder="Hours" className="h-9 w-24" value={hours[a.id] ?? ""} onChange={(e) => setHours((h) => ({ ...h, [a.id]: e.target.value }))} />
                          <Button size="sm" className="rounded-full" disabled={complete.isPending || a.attendance === "absent"} onClick={() => complete.mutate({ appId: a.id, hoursLogged: Number(hours[a.id]) || undefined })}>
                            <Award className="size-4" /> Complete &amp; grant certificate
                          </Button>
                        </>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
                        <Upload className="size-4" /> {a.certificate_url ? "Replace certificate file" : "Upload certificate file"}
                        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(a.id, f); e.target.value = ""; }} />
                      </label>
                      {a.certificate_url && (
                        <>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => viewFile(a.certificate_url!)}><FileText className="size-4" /> View uploaded</Button>
                          <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => removeFile(a.id, a.certificate_url!)}>Delete uploaded</Button>
                        </>
                      )}
                      {cert && (
                        <Button asChild size="sm" variant="outline" className="rounded-full">
                          <Link to="/certificates/$code" params={{ code: cert.code }}><BadgeCheck className="size-4" /> Certificate · {cert.hours ?? 0}h</Link>
                        </Button>
                      )}
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
    </div>
  );
}
