import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { isValidEmail, isValidPhone } from "@/lib/utils";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["volunteer", "ngo_admin"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  head: () => ({ meta: pageMeta("Sign in — Volunteer Connect", "Sign in or join Volunteer Connect as a volunteer or NGO.") }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, isNgoAdmin, isSuperAdmin } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [role, setRole] = useState<"volunteer" | "ngo_admin">(initialRole ?? "volunteer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Pune");
  const [experience, setExperience] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && !busy) {
      if (isSuperAdmin) {
        navigate({ to: "/admin", replace: true });
      } else if (mode === "signup" && isNgoAdmin) {
        navigate({ to: "/ngo/register", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [user, loading, navigate, busy, mode, isNgoAdmin, isSuperAdmin]);

  const fillSuperAdmin = () => {
    setMode("signin");
    setEmail("vaishnavinimse8797@gmail.com");
    setPassword("Nimse@8797");
    toast.info("Super admin credentials filled");
  };

  const loginAsSuperAdmin = async () => {
    setMode("signin");
    setEmail("vaishnavinimse8797@gmail.com");
    setPassword("Nimse@8797");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "vaishnavinimse8797@gmail.com",
        password: "Nimse@8797",
      });
      if (error) throw error;
      toast.success("Welcome, Super Administrator!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      if (!isValidEmail(email)) {
        toast.error("Please enter a valid email address (e.g. name@domain.com)");
        setBusy(false);
        return;
      }
      if (!isValidPhone(phone)) {
        toast.error("Please enter a valid 10-digit phone number (e.g. +91 9876543210)");
        setBusy(false);
        return;
      }
      if (!city.trim()) {
        toast.error("Please provide your city of residence");
        setBusy(false);
        return;
      }
      if (role === "volunteer" && !experience.trim()) {
        toast.error("Please briefly mention your experience or skills");
        setBusy(false);
        return;
      }
    }

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              city: city.trim(),
              experience: experience.trim(),
              requested_role: role,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account registered! Please sign in.");
          setMode("signin");
          return;
        }
        toast.success("Account created and signed in!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">{mode === "signup" ? "Join Volunteer Connect" : "Welcome back"}</CardTitle>
          <CardDescription>{mode === "signup" ? "Create your account in seconds." : "Sign in to continue."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {mode === "signup" && (
            <div>
              <Label className="mb-2 block">I am a...</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as "volunteer" | "ngo_admin")} className="grid grid-cols-2 gap-2">
                <label className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm ${role === "volunteer" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  <RadioGroupItem value="volunteer" className="sr-only" />
                  <span className="font-semibold">Volunteer</span>
                  <span className="text-xs text-muted-foreground">Find and apply to opportunities</span>
                </label>
                <label className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm ${role === "ngo_admin" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  <RadioGroupItem value="ngo_admin" className="sr-only" />
                  <span className="font-semibold">NGO / Organization</span>
                  <span className="text-xs text-muted-foreground">Post opportunities & manage volunteers</span>
                </label>
              </RadioGroup>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">Full name *</Label>
                  <Input id="name" required placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone number *</Label>
                  <Input id="phone" type="tel" required placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">NGOs will contact you on this number.</p>
                </div>
                <div>
                  <Label htmlFor="city">City of residence *</Label>
                  <Input id="city" required placeholder="e.g. Pune, Maharashtra" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                {role === "volunteer" && (
                  <div>
                    <Label htmlFor="exp">Volunteering experience or skills *</Label>
                    <Input id="exp" required placeholder="e.g. 2 years tutoring, animal rescue, or coding" value={experience} onChange={(e) => setExperience(e.target.value)} />
                  </div>
                )}
              </>
            )}
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={async () => {
                      if (!email) {
                        toast.error("Enter your email above first");
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Password reset link sent! Check your email.");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full rounded-full">
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          {mode === "signin" && (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Super Admin Access:</span>
                <button
                  type="button"
                  onClick={fillSuperAdmin}
                  className="font-semibold text-primary hover:underline"
                >
                  Autofill credentials
                </button>
              </div>
              <p className="mt-1 text-muted-foreground">
                <code className="text-[11px]">vaishnavinimse8797@gmail.com</code>
              </p>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

