import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, User, Camera } from "lucide-react";
import { isValidPhone } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: pageMeta("My profile — Volunteer Connect", "Manage your volunteer contact details, skills, and experience.") }),
  component: ProfilePage,
});

const empty = {
  first_name: "", last_name: "", bio: "", city: "", state: "", country: "",
  occupation_status: "", organization: "",
  skills: "", interests: "", languages: "", education: "", experience: "", availability: "", phone: "",
};

function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: profile } = useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const [{ data }, { data: priv }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,avatar_url,first_name,last_name,bio,city,state,country,skills,interests,languages,education,availability").eq("id", user!.id).maybeSingle(),
        supabase.rpc("get_profiles_private", { _ids: [user!.id] }),
      ]);
      return data ? { ...data, ...(priv?.[0] ?? {}) } as typeof data & { phone?: string | null; occupation_status?: string | null; organization?: string | null; experience?: string | null } : null;
    },
  });

  useEffect(() => {
    if (profile) {
      const [fn, ...rest] = (profile.full_name ?? "").split(" ");
      setAvatarUrl(profile.avatar_url ?? "");
      setForm({
        first_name: profile.first_name ?? fn ?? "",
        last_name: profile.last_name ?? rest.join(" "),
        bio: profile.bio ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        country: profile.country ?? "",
        occupation_status: profile.occupation_status ?? "",
        organization: profile.organization ?? "",
        skills: (profile.skills ?? []).join(", "),
        interests: (profile.interests ?? []).join(", "),
        languages: (profile.languages ?? []).join(", "),
        education: profile.education ?? "",
        experience: profile.experience ?? "",
        availability: profile.availability ?? "",
        phone: profile.phone ?? "",
      });
    }
  }, [profile]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Profile picture must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        toast.success("Photo preview updated! Click 'Save changes' below to save.");
      }
    };
    reader.readAsDataURL(file);
  };

  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isValidPhone(form.phone)) {
      toast.error("Please enter a valid 10-digit phone number (e.g. +91 9876543210)");
      return;
    }
    if (!form.city.trim()) {
      toast.error("Please enter your city of residence");
      return;
    }
    if (!form.experience.trim()) {
      toast.error("Please enter your previous volunteering, work, or skills experience");
      return;
    }
    if (!form.occupation_status) { toast.error("Please select Working or Student"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: form.first_name,
      last_name: form.last_name,
      full_name: `${form.first_name} ${form.last_name}`.trim(),
      avatar_url: avatarUrl || null,
      bio: form.bio,
      city: form.city,
      state: form.state,
      country: form.country,
      occupation_status: form.occupation_status,
      organization: form.organization,
      skills: list(form.skills),
      interests: list(form.interests),
      languages: list(form.languages),
      education: form.education,
      experience: form.experience,
      availability: form.availability,
      phone: form.phone,
    });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  const isStudent = form.occupation_status === "student";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">Your profile</h1>
      <Card>
        <CardHeader><CardTitle className="font-display">Personal details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-6">
            {/* AVATAR UPLOAD */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-2xl font-semibold text-primary ring-2 ring-primary/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                ) : (
                  (form.first_name?.charAt(0) || user?.email?.charAt(0) || "V").toUpperCase()
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera className="size-3.5" /> Upload Photo
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs text-muted-foreground"
                      onClick={() => setAvatarUrl("")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Upload a profile picture for your volunteer portfolio.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name *"><Input required value={form.first_name} onChange={set("first_name")} /></Field>
              <Field label="Last name *"><Input required value={form.last_name} onChange={set("last_name")} /></Field>
              <Field label="Email"><Input value={user?.email ?? ""} disabled /></Field>
              <Field label="Phone number *"><Input type="tel" required pattern="[+0-9 ()-]{7,20}" value={form.phone} onChange={set("phone")} /></Field>
              <Field label="City *"><Input required value={form.city} onChange={set("city")} /></Field>
              <Field label="State *"><Input required value={form.state} onChange={set("state")} /></Field>
              <Field label="Country *"><Input required value={form.country} onChange={set("country")} /></Field>
            </div>
            <Field label="Currently *">
              <div className="flex gap-2">
                {[["working", "Working"], ["student", "Student"]].map(([v, l]) => (
                  <Button key={v} type="button" variant={form.occupation_status === v ? "default" : "outline"} className="rounded-full" onClick={() => setForm((f) => ({ ...f, occupation_status: v }))}>{l}</Button>
                ))}
              </div>
            </Field>
            {form.occupation_status && (
              <Field label={isStudent ? "College / school *" : "Company & role *"}>
                <Input required value={form.organization} onChange={set("organization")} placeholder={isStudent ? "e.g. PCCOE Pune, 3rd year B.Tech" : "e.g. Infosys, Software Engineer"} />
              </Field>
            )}
            <Field label="Bio"><Textarea rows={3} value={form.bio} onChange={set("bio")} /></Field>
            <Field label="Experience *"><Textarea required rows={3} value={form.experience} onChange={set("experience")} placeholder="Previous volunteering, work or internships" /></Field>
            <Field label="Education"><Textarea rows={2} value={form.education} onChange={set("education")} /></Field>
            <Field label="Skills (comma-separated)"><Input value={form.skills} onChange={set("skills")} placeholder="Teaching, First aid, Web dev" /></Field>
            <Field label="Interests (comma-separated)"><Input value={form.interests} onChange={set("interests")} placeholder="Education, Environment" /></Field>
            <Field label="Languages (comma-separated)"><Input value={form.languages} onChange={set("languages")} placeholder="English, Hindi" /></Field>
            <Field label="Availability"><Input value={form.availability} onChange={set("availability")} placeholder="Weekends, evenings" /></Field>
            <Button type="submit" disabled={saving} className="rounded-full">{saving ? "Saving..." : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
}
