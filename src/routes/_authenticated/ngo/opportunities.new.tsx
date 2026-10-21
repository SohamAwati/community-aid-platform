import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CATEGORIES } from "@/lib/categories";
import { BASE_FIELDS, QUESTION_TYPE_LABEL, type CustomQuestion, type QuestionType } from "@/lib/questions";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateOpportunity } from "@/lib/workflow-rules";

export const Route = createFileRoute("/_authenticated/ngo/opportunities/new")({
  head: () => ({ meta: pageMeta("New opportunity — Volunteer Connect", "Create an opportunity and customize the application questions.") }),
  component: NewOpp,
});

function NewOpp() {
  return <OpportunityForm />;
}

export function OpportunityForm({ editId }: { editId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "", description: "", responsibilities: "", requirements: "",
    category: "education", location_mode: "onsite",
    city: "", country: "", starts_at: "", ends_at: "", duration: "",
    slots: 1, min_age: 18, application_deadline: "", contact_email: "",
    skills: "", benefits: "", hours_estimate: 4,
    is_paid: false, stipend: "", provides_certificate: true,
  });
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);

  const { data: ngo } = useQuery({
    enabled: !!user,
    queryKey: ["my-ngo-form", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("ngos").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existing } = useQuery({
    enabled: !!editId,
    queryKey: ["opp-edit", editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await supabase.from("opportunities").select("*").eq("id", editId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!existing) return;
    const d = (v: string | null) => (v ? v.slice(0, 16) : "");
    setF({
      title: existing.title, description: existing.description,
      responsibilities: existing.responsibilities ?? "", requirements: existing.requirements ?? "",
      category: existing.category, location_mode: existing.location_mode,
      city: existing.city ?? "", country: existing.country ?? "",
      starts_at: d(existing.starts_at), ends_at: d(existing.ends_at), duration: existing.duration ?? "",
      slots: existing.slots, min_age: existing.min_age ?? 18,
      application_deadline: existing.application_deadline ? existing.application_deadline.slice(0, 10) : "", contact_email: existing.contact_email ?? "",
      skills: (existing.skills_required ?? []).join(", "), benefits: (existing.benefits ?? []).join(", "),
      hours_estimate: existing.hours_estimate, is_paid: existing.is_paid, stipend: existing.stipend ?? "",
      provides_certificate: existing.provides_certificate,
    });
    setQuestions(Array.isArray(existing.custom_questions) ? (existing.custom_questions as unknown as CustomQuestion[]) : []);
  }, [existing]);

  const addQuestion = () =>
    setQuestions((q) => [...q, { id: crypto.randomUUID(), label: "", type: "text", required: false }]);
  const updateQ = (id: string, patch: Partial<CustomQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const submit = async (status: "draft" | "published") => {
    if (!ngo) { toast.error("Register your NGO first"); return; }
    if (status === "published" && ngo.status !== "verified") { toast.error("NGO must be verified"); return; }
    const validation = validateOpportunity(f);
    if (validation) { toast.error(validation); return; }
    const cleanQs = questions.filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim().slice(0, 300) }));
    setBusy(true);
    const payload = {
      ngo_id: ngo.id,
      title: f.title.trim(), description: f.description.trim(),
      responsibilities: f.responsibilities.trim() || null,
      requirements: f.requirements.trim() || null,
      category: f.category as never, location_mode: f.location_mode as never,
      city: f.city || null, country: f.country || null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      duration: f.duration || null, slots: Number(f.slots) || 1,
      min_age: Number(f.min_age) || null,
      hours_estimate: Number(f.hours_estimate) || 0,
      application_deadline: f.application_deadline ? new Date(`${f.application_deadline}T23:59:59.999`).toISOString() : null,
      contact_email: f.contact_email || null,
      skills_required: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
      benefits: f.benefits.split(",").map((s) => s.trim()).filter(Boolean),
      is_paid: f.is_paid,
      stipend: f.is_paid ? f.stipend.trim() : null,
      provides_certificate: f.provides_certificate,
      custom_questions: cleanQs as never,
      status,
    };
    const { error } = editId
      ? await supabase.from("opportunities").update(payload).eq("id", editId)
      : await supabase.from("opportunities").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Opportunity updated" : status === "published" ? "Opportunity published!" : "Draft saved");
    navigate({ to: "/ngo/opportunities" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{editId ? "Edit opportunity" : "New opportunity"}</h1>

      <Card>
        <CardHeader><CardTitle>1. Basics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description" required><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Responsibilities (what volunteers will do)"><Textarea rows={3} value={f.responsibilities} onChange={(e) => setF({ ...f, responsibilities: e.target.value })} /></Field>
          <Field label="Requirements / eligibility"><Textarea rows={3} value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Location mode">
              <Select value={f.location_mode} onValueChange={(v) => setF({ ...f, location_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="onsite">On-site</SelectItem><SelectItem value="remote">Remote</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="Country"><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Schedule & slots</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts"><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></Field>
          <Field label="Duration"><Input value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="4 weeks, weekends" /></Field>
          <Field label="Estimated hours"><Input type="number" min={0} value={f.hours_estimate} onChange={(e) => setF({ ...f, hours_estimate: Number(e.target.value) })} /></Field>
          <Field label="Slots"><Input type="number" min={1} value={f.slots} onChange={(e) => setF({ ...f, slots: Number(e.target.value) })} /></Field>
          <Field label="Minimum age"><Input type="number" min={0} value={f.min_age} onChange={(e) => setF({ ...f, min_age: Number(e.target.value) })} /></Field>
          <Field label="Application deadline"><Input type="date" value={f.application_deadline} onChange={(e) => setF({ ...f, application_deadline: e.target.value })} /></Field>
          <Field label="Contact email"><Input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Compensation & perks</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Paid opportunity" hint="Volunteers receive a stipend or payment" checked={f.is_paid} onChange={(v) => setF({ ...f, is_paid: v })} />
          {f.is_paid && <Field label="Stipend / pay details" required><Input value={f.stipend} onChange={(e) => setF({ ...f, stipend: e.target.value })} placeholder="₹5,000 / month" /></Field>}
          <Toggle label="Certificate provided" hint="Volunteers get a certificate after completion" checked={f.provides_certificate} onChange={(v) => setF({ ...f, provides_certificate: v })} />
          <Field label="Skills required (comma-separated)"><Input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="Teaching, First aid" /></Field>
          <Field label="Other benefits (comma-separated)"><Input value={f.benefits} onChange={(e) => setF({ ...f, benefits: e.target.value })} placeholder="Meals, Travel, Accommodation" /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Application form</CardTitle>
          <CardDescription>Every form includes the standard fields below. Add any extra questions you need.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted p-4 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Standard fields (always included)</div>
            <ul className="list-inside list-disc space-y-1">
              {BASE_FIELDS.map((b) => <li key={b.id}>{b.label}{b.required && " *"}</li>)}
            </ul>
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Extra question {i + 1}</span>
                <Button size="icon" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} aria-label="Remove question"><Trash2 className="size-4" /></Button>
              </div>
              <Input placeholder="e.g. Do you have a two-wheeler?" value={q.label} maxLength={300} onChange={(e) => updateQ(q.id, { label: e.target.value })} />
              <div className="flex flex-wrap items-center gap-4">
                <Select value={q.type} onValueChange={(v) => updateQ(q.id, { type: v as QuestionType })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(QUESTION_TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm"><Switch checked={q.required} onCheckedChange={(v) => updateQ(q.id, { required: v })} /> Required</label>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-full" onClick={addQuestion}><Plus className="size-4" /> Add question</Button>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button disabled={busy} className="rounded-full" onClick={() => submit("published")}>{busy ? "Saving..." : "Publish now"}</Button>
        <Button variant="outline" onClick={() => submit("draft")} disabled={busy} className="rounded-full">Save as draft</Button>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div><div className="font-medium">{label}</div><div className="text-sm text-muted-foreground">{hint}</div></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}{required && " *"}</Label>{children}</div>;
}
