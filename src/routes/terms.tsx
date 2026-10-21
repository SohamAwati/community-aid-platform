import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: pageMeta("Terms of Service — Volunteer Connect", "Terms of using Volunteer Connect.") }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 prose prose-sm">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-6 text-muted-foreground">By using Volunteer Connect you agree to act in good faith, treat NGOs and volunteers with respect, and not post fraudulent listings. NGOs must be legitimate organizations; volunteers must accurately represent their skills.</p>
      <p className="mt-6 text-muted-foreground">We reserve the right to suspend accounts that violate these terms.</p>
    </div>
  ),
});
