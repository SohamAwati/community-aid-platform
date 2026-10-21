import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ngo/register")({
  head: () => ({ meta: pageMeta("NGO registration — Volunteer Connect", "Register your organization and submit its details for verification.") }),
  component: NgoRegister,
});

function NgoRegister() {
  const { user, isNgoAdmin } = useAuth();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<{ id: string; status: string } | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", mission: "", website: "", email: "", phone: "", city: "", country: "",
    address: "", state: "", postal_code: "", registration_number: "", contact_person: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("ngos").select("id,status").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setExisting(data);
    });
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isNgoAdmin) {
      await supabase.rpc("set_my_role", { _role: "ngo_admin" });
    }
    setBusy(true);
    const { error } = await supabase.from("ngos").insert({ owner_id: user.id, ...form });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("NGO submitted for verification — you'll hear from us shortly.");
    navigate({ to: "/dashboard" });
  };

  if (existing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Your NGO is {existing.status}</CardTitle>
            <CardDescription>
              {existing.status === "pending" && "A super admin will review your submission within 48 hours."}
              {existing.status === "verified" && "You can now post opportunities."}
              {existing.status === "rejected" && "Please contact support for details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate({ to: "/dashboard" })} className="rounded-full">Back to dashboard</Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/ngo/profile">Edit NGO Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">Register your NGO</h1>
      <p className="mb-8 text-muted-foreground">Submit your organization for verification. Our team reviews within 48 hours.</p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organization name" required><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Registration number" required><Input required value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Govt. / trust reg. no." /></Field>
            </div>
            <Field label="Short description" required><Textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Mission" required><Textarea required rows={2} value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact person" required><Input required value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
              <Field label="Website URL" required><Input type="url" required value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></Field>
              <Field label="Contact email" required><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone number" required><Input type="tel" required pattern="[+0-9 ()-]{7,20}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <Field label="Full address" required><Textarea required rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" required><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="State" required><Input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
              <Field label="Postal code" required><Input required value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></Field>
              <Field label="Country" required><Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            </div>
            <Button type="submit" disabled={busy} className="rounded-full">{busy ? "Submitting..." : "Submit for verification"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}{required && " *"}</Label>{children}</div>;
}
