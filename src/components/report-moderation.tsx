import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function ReportModeration() {
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: async () => {
    const { data, error } = await supabase.rpc("list_my_reports");
    if (error) throw error;
    return data;
  } });
  const review = useMutation({ mutationFn: async ({ id, status }: { id: string; status: "resolved" | "dismissed" }) => {
    const { error } = await supabase.rpc("review_report", { _id: id, _status: status, _resolution: reasons[id] ?? "" });
    if (error) throw error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); toast.success("Report reviewed"); },
  onError: (error) => toast.error(error.message) });
  return <section className="mb-12">
    <h2 className="mb-4 font-display text-xl font-semibold">Reports</h2>
    {reports.isPending ? <p className="text-muted-foreground">Loading reports…</p> : reports.isError ? <p className="text-destructive">Reports could not be loaded.</p> : !reports.data?.length ? <p className="text-muted-foreground">No reports yet.</p> : <div className="divide-y divide-border">
      {reports.data.map((report) => <article key={report.id} className="space-y-3 py-5">
        <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{report.subject}</h3><Badge variant="outline">{report.status}</Badge></div>
        <p className="whitespace-pre-wrap break-words text-sm">{report.details}</p>
        <p className="text-xs text-muted-foreground">Reported {new Date(report.created_at).toLocaleString()}</p>
        {report.status === "pending" ? <>
          <Textarea aria-label={`Resolution for ${report.subject}`} placeholder="Decision reason" maxLength={5000} value={reasons[report.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [report.id]: e.target.value })} />
          <div className="flex gap-2"><Button disabled={review.isPending || !reasons[report.id]?.trim()} onClick={() => review.mutate({ id: report.id, status: "resolved" })}>Resolve</Button><Button variant="outline" disabled={review.isPending || !reasons[report.id]?.trim()} onClick={() => review.mutate({ id: report.id, status: "dismissed" })}>Dismiss</Button></div>
        </> : <p className="text-sm text-muted-foreground">{report.resolution}</p>}
      </article>)}
    </div>}
  </section>;
}