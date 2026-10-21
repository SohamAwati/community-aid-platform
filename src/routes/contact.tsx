import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: pageMeta("Contact — Volunteer Connect", "Reach the Volunteer Connect team.") }),
  component: ContactPage,
});

function ContactPage() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Get in touch</h1>
      <p className="mt-3 text-muted-foreground">Questions, feedback, partnerships — we'd love to hear from you.</p>
      <form
        className="mt-10 space-y-4"
        onSubmit={(e) => {
          e.preventDefault(); setBusy(true);
          setTimeout(() => { setBusy(false); toast.success("Message sent — we'll reply within 2 business days."); (e.target as HTMLFormElement).reset(); }, 700);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="n">Name</Label><Input id="n" required /></div>
          <div><Label htmlFor="e">Email</Label><Input id="e" type="email" required /></div>
        </div>
        <div><Label htmlFor="s">Subject</Label><Input id="s" required /></div>
        <div><Label htmlFor="m">Message</Label><Textarea id="m" rows={6} required /></div>
        <Button type="submit" disabled={busy} className="rounded-full">{busy ? "Sending..." : "Send message"}</Button>
      </form>
    </div>
  );
}
