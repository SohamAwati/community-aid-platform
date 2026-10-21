import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/page-meta";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ head: () => ({ meta: pageMeta("Reports — Volunteer Connect", "Submit a platform report and track the administrator’s response.") }), component: Reports });

function Reports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const reports = useQuery({ queryKey: ["my-reports", user?.id], queryFn: async () => {
    const { data, error } = await supabase.rpc("list_my_reports"); if (error) throw error; return data;
  } });
  const submit = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc("submit_report", { _subject: subject, _details: details }); if (error) throw error;
  }, onSuccess: () => { setSubject(""); setDetails(""); qc.invalidateQueries({ queryKey: ["my-reports"] }); toast.success("Report submitted"); }, onError: (error) => toast.error(error.message) });
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <h1 className="font-display text-3xl font-semibold">Reports</h1>
    <form className="my-8 space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="report-subject">Subject</Label><Input id="report-subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="report-details">Details</Label><Textarea id="report-details" required rows={5} maxLength={5000} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
      <Button type="submit" disabled={submit.isPending || !subject.trim() || !details.trim()}>{submit.isPending ? "Submitting…" : "Submit report"}</Button>
    </form>
    <h2 className="font-display text-xl font-semibold">Report history</h2>
    {reports.isError ? <p className="mt-4 text-destructive">Could not load reports.</p> : reports.isPending ? <p className="mt-4 text-muted-foreground">Loading…</p> : !reports.data?.length ? <p className="mt-4 text-muted-foreground">No reports yet.</p> : <div className="divide-y divide-border">{reports.data.map((r) => <article key={r.id} className="space-y-2 py-5"><div className="flex gap-3"><h3 className="font-semibold">{r.subject}</h3><Badge variant="outline">{r.status}</Badge></div><p className="whitespace-pre-wrap break-words text-sm">{r.details}</p>{r.resolution && <p className="text-sm text-muted-foreground">Administrator: {r.resolution}</p>}</article>)}</div>}
  </div>;
}