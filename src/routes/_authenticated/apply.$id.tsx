import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BASE_FIELDS, parseQuestions, type CustomQuestion } from "@/lib/questions";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { applicationBlockReason } from "@/lib/workflow-rules";
import { isValidPhone } from "@/lib/utils";
import { isUserSuspended } from "@/lib/suspension";

export const Route = createFileRoute("/_authenticated/apply/$id")({
  head: () => ({ meta: pageMeta("Apply — Volunteer Connect", "Submit your details for a volunteering opportunity.") }),
  component: ApplyPage,
});

function ApplyPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("city,phone,experience,availability")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAnswers((prev) => ({
            city: data.city || prev.city || "",
            phone: data.phone || prev.phone || "",
            experience: data.experience || prev.experience || "",
            availability: data.availability || prev.availability || "",
            ...prev,
          }));
        }
      });
  }, [user]);

  const { data: o } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => (await supabase.from("opportunities").select("*, ngos(id,name,logo_url,description,city,country,status)").eq("id", id).maybeSingle()).data,
  });

  const { data: existing } = useQuery({
    enabled: !!user,
    queryKey: ["my-app", id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      return (await supabase.from("applications").select("id,status,rejection_reason").eq("opportunity_id", id).eq("volunteer_id", user.id).maybeSingle()).data;
    },
  });

  const availability = useQuery({ queryKey: ["application-availability", id], queryFn: async () => {
    const { data, error } = await supabase.rpc("application_availability", { _opportunity_id: id });
    if (error) throw error;
    return data?.[0]?.remaining;
  } });
  const blocked = o ? applicationBlockReason(o.status, o.application_deadline, availability.data) : null;

  const extra = parseQuestions(o?.custom_questions);
  const all: CustomQuestion[] = [...BASE_FIELDS, ...extra];

  const userSuspended = isUserSuspended(user?.id);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");
      if (userSuspended) throw new Error("Your account has been suspended by the platform administrator. You are not permitted to apply for opportunities.");
      if (blocked) throw new Error(blocked);
      const clean: Record<string, string> = {};
      for (const q of all) {
        const v = (answers[q.id] ?? "").trim().slice(0, 2000);
        if (q.required && !v) throw new Error(`Please answer: ${q.label}`);
        if (v) clean[q.id] = v;
      }
      if (clean.phone && !isValidPhone(clean.phone)) {
        throw new Error("Please enter a valid 10-digit phone number (e.g. +91 9876543210)");
      }
      const message = all.filter((q) => clean[q.id]).map((q) => `${q.label}: ${clean[q.id]}`).join("\n");
      const { error } = await supabase.from("applications").insert({
        opportunity_id: id, volunteer_id: user.id, message: message || null, answers: clean,
      });
      if (error) throw error;
      const profileUpdates: Record<string, string> = {};
      if (clean.phone) profileUpdates.phone = clean.phone;
      if (clean.city) profileUpdates.city = clean.city;
      if (clean.experience) profileUpdates.experience = clean.experience;
      if (Object.keys(profileUpdates).length) await supabase.from("profiles").update(profileUpdates).eq("id", user.id);

      // Notify the NGO
      if (o?.ngo_id) {
        await supabase.from("notifications").insert({
          user_id: o.ngo_id,
          title: `New Applicant for "${o.title}"`,
          body: `A volunteer from ${clean.city || "your area"} has submitted their application.`,
          link: `/ngo/opportunities/${id}/applicants`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Application submitted! The organisation will review it.");
      qc.invalidateQueries({ queryKey: ["my-app", id] });
      navigate({ to: "/volunteer/applications" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!o) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/opportunities/$id" params={{ id }}><ArrowLeft className="size-4" /> Back to opportunity</Link></Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Apply: {o.title}</CardTitle>
          <CardDescription>{o.ngos?.name}</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant={o.is_paid ? "default" : "secondary"}>{o.is_paid ? `Paid · ${o.stipend ?? ""}` : "Unpaid"}</Badge>
            <Badge variant="outline">{o.provides_certificate ? "Certificate provided" : "No certificate"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {userSuspended ? (
            <div className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-destructive">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <Ban className="size-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Account Suspended</h3>
                <p className="mt-1 text-sm text-destructive/90 max-w-md mx-auto">
                  Your account has been suspended by the platform administrator. You are not permitted to apply for volunteering opportunities. Please contact support.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-full border-destructive/30">
                <Link to="/opportunities">Return to Opportunities</Link>
              </Button>
            </div>
          ) : existing ? (
            <div className="space-y-3 text-center">
              <p>You've already applied — status: <span className="font-semibold capitalize">{existing.status}</span></p>
              <Button asChild className="rounded-full"><Link to="/volunteer/applications">View my applications</Link></Button>
            </div>
           ) : blocked ? (
            <p className="text-center text-muted-foreground">{blocked}</p>
          ) : (
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
              {all.map((q, i) => (
                <div key={q.id} className="space-y-1.5">
                  {i === BASE_FIELDS.length && extra.length > 0 && (
                    <div className="mb-3 border-t pt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Questions from {o.ngos?.name ?? "the NGO"}</div>
                  )}
                  <Label htmlFor={q.id}>{q.label}{q.required && " *"}</Label>
                  <QuestionInput q={q} value={answers[q.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                </div>
              ))}
              <Button type="submit" disabled={submit.isPending || availability.isPending || availability.isError} className="w-full rounded-full">{submit.isPending ? "Submitting..." : "Submit application"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: CustomQuestion; value: string; onChange: (v: string) => void }) {
  if (q.type === "textarea") return <Textarea id={q.id} rows={3} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "number") return <Input id={q.id} type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "yesno")
    return (
      <RadioGroup value={value} onValueChange={onChange} className="flex gap-6">
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="Yes" /> Yes</label>
        <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="No" /> No</label>
      </RadioGroup>
    );
  return <Input id={q.id} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} />;
}
