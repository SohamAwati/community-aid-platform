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
  const [busy, setBusy] = useState(false);
  const [googleSetupOpen, setGoogleSetupOpen] = useState(false);

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

  const handleGoogleSignIn = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
      toast.success("Signed in with Google!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const fillSuperAdmin = () => {
    setMode("signin");
    setEmail("vaishnavinimse8797@gmail.com");
    setPassword("Nimse@8797");
    toast.info("Super admin credentials filled");
  };

  const loginAsSuperAdmin = async () => {
    setGoogleSetupOpen(false);
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
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName, requested_role: role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account registered! Click the link in your email to activate it and sign in.");
          setMode("signin");
          return;
        }
        toast.success("Account created and signed in!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="w-full gap-2 rounded-full font-medium"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative flex items-center justify-center">
            <span className="w-full border-t border-border" />
            <span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <span className="w-full border-t border-border" />
          </div>

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
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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

      <Dialog open={googleSetupOpen} onOpenChange={setGoogleSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              Google Sign-In Setup Required
            </DialogTitle>
            <DialogDescription>
              Google OAuth is not enabled on your Supabase backend project yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              To enable Google Sign-In, configure your Google Cloud OAuth Client ID and Secret in the Supabase Dashboard:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Open <strong>Supabase Dashboard &gt; Authentication &gt; Providers &gt; Google</strong></li>
              <li>Toggle <strong>Enable Google provider</strong> to ON</li>
              <li>Add your Google Cloud <strong>Client ID</strong> and <strong>Secret</strong></li>
              <li>Set callback URL in Google Cloud Console to: <code className="rounded bg-muted px-1 break-all">https://dnqwypuspatfbswysahx.supabase.co/auth/v1/callback</code></li>
            </ol>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 mt-2">
              <p className="font-semibold text-xs text-primary mb-1">Looking for Super Admin access?</p>
              <p className="text-xs text-muted-foreground">
                You can sign in directly using email <code className="text-foreground">vaishnavinimse8797@gmail.com</code>.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setGoogleSetupOpen(false)} className="rounded-full">
              Dismiss
            </Button>
            <Button onClick={loginAsSuperAdmin} className="rounded-full">
              Sign In as Super Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

