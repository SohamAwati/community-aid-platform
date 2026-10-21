import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, ArrowLeft, Upload, Globe, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ngo/profile")({
  head: () => ({
    meta: pageMeta(
      "NGO Profile Settings — Volunteer Connect",
      "Manage your organization details, mission, contact info, and branding."
    ),
  }),
  component: NgoProfileSettings,
});

function NgoProfileSettings() {
  const { user, isNgoAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    mission: "",
    website: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    address: "",
    state: "",
    postal_code: "",
    registration_number: "",
    contact_person: "",
    logo_url: "",
    cover_url: "",
  });

  const { data: ngo, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-ngo-profile-edit", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("ngos")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (ngo) {
      setForm({
        name: ngo.name ?? "",
        description: ngo.description ?? "",
        mission: ngo.mission ?? "",
        website: ngo.website ?? "",
        email: ngo.email ?? "",
        phone: ngo.phone ?? "",
        city: ngo.city ?? "",
        country: ngo.country ?? "",
        address: ngo.address ?? "",
        state: ngo.state ?? "",
        postal_code: ngo.postal_code ?? "",
        registration_number: ngo.registration_number ?? "",
        contact_person: ngo.contact_person ?? "",
        logo_url: ngo.logo_url ?? "",
        cover_url: ngo.cover_url ?? "",
      });
    }
  }, [ngo]);

  const updateProfile = useMutation({
    mutationFn: async (updated: typeof form) => {
      if (!ngo?.id) throw new Error("NGO not found");
      const { error } = await supabase
        .from("ngos")
        .update({
          name: updated.name.trim(),
          description: updated.description.trim() || null,
          mission: updated.mission.trim() || null,
          website: updated.website.trim() || null,
          email: updated.email.trim() || null,
          phone: updated.phone.trim() || null,
          city: updated.city.trim() || null,
          country: updated.country.trim() || null,
          address: updated.address.trim() || null,
          state: updated.state.trim() || null,
          postal_code: updated.postal_code.trim() || null,
          registration_number: updated.registration_number.trim() || null,
          contact_person: updated.contact_person.trim() || null,
          logo_url: updated.logo_url.trim() || null,
          cover_url: updated.cover_url.trim() || null,
        })
        .eq("id", ngo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ngo-profile-edit"] });
      qc.invalidateQueries({ queryKey: ["my-ngo"] });
      toast.success("Organization profile updated successfully!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((prev) => ({ ...prev, logo_url: reader.result as string }));
        toast.success("Logo preview updated. Remember to save changes.");
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Loading organization settings...
      </div>
    );
  }

  if (!ngo) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Building2 className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">No NGO Registered Yet</h1>
        <p className="mt-2 text-muted-foreground">
          Register your organization to start publishing volunteer opportunities.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/ngo/register">Register NGO</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/dashboard">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Organization Profile</h1>
            <Badge
              variant={
                ngo.status === "verified"
                  ? "default"
                  : ngo.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
              className="capitalize"
            >
              {ngo.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage public details, contact info, and branding for {ngo.name}.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/ngos/$id" params={{ id: ngo.id }}>
            <Globe className="size-4" /> View Public Profile
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">General Information</CardTitle>
          <CardDescription>
            This information is shown to volunteers browsing your opportunities and profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate(form);
            }}
            className="space-y-6"
          >
            {/* Logo / Branding */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 font-display text-3xl font-semibold text-primary ring-1 ring-border">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="size-full object-cover" />
                ) : (
                  form.name.charAt(0) || "N"
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" /> Upload Logo
                  </Button>
                  {form.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG or SVG up to 2MB. Square ratio recommended.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ngo-name">Organization Name *</Label>
                <Input
                  id="ngo-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ngo-reg">Registration Number</Label>
                <Input
                  id="ngo-reg"
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                  placeholder="Trust or NGO registration number"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ngo-mission">Mission Statement *</Label>
              <Textarea
                id="ngo-mission"
                rows={2}
                required
                value={form.mission}
                onChange={(e) => setForm({ ...form, mission: e.target.value })}
                placeholder="What is your organization's core purpose?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ngo-desc">About / Description *</Label>
              <Textarea
                id="ngo-desc"
                rows={3}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell volunteers about your history and impact..."
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-4 font-display text-base font-semibold">Contact & Location</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-contact">Contact Person</Label>
                  <Input
                    id="ngo-contact"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-website">Website URL</Label>
                  <Input
                    id="ngo-website"
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-email">Official Email</Label>
                  <Input
                    id="ngo-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-phone">Phone Number</Label>
                  <Input
                    id="ngo-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="ngo-address">Address</Label>
                <Input
                  id="ngo-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-city">City</Label>
                  <Input
                    id="ngo-city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-state">State</Label>
                  <Input
                    id="ngo-state"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-postal">Postal Code</Label>
                  <Input
                    id="ngo-postal"
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ngo-country">Country</Label>
                  <Input
                    id="ngo-country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="rounded-full px-8"
              >
                {updateProfile.isPending ? "Saving changes..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
