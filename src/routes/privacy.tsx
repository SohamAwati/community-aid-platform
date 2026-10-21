import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: pageMeta("Privacy Policy — Volunteer Connect", "How Volunteer Connect handles your data.") }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 prose prose-sm">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-6 text-muted-foreground">We collect the minimum information needed to run Volunteer Connect: your account details, volunteering activity, and the content you create. We do not sell your data.</p>
      <h2 className="mt-10 font-display text-xl font-semibold">What we collect</h2>
      <p className="mt-2 text-muted-foreground">Name, email, profile info you provide, and metadata about your applications and volunteering activity.</p>
      <h2 className="mt-8 font-display text-xl font-semibold">Your rights</h2>
      <p className="mt-2 text-muted-foreground">You can export or delete your account at any time from your profile settings.</p>
    </div>
  ),
});
