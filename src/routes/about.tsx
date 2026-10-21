import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: pageMeta("About — Volunteer Connect", "Volunteer Connect exists to make civic engagement effortless — verified NGOs, empowered volunteers, real impact.") }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">About Volunteer Connect</h1>
      <p className="mt-6 text-lg text-muted-foreground">We believe change is built by the willing. Volunteer Connect is a shared civic infrastructure that helps NGOs reach the right volunteers and helps volunteers find causes worth their time.</p>
      <h2 className="mt-12 font-display text-2xl font-semibold">Our mission</h2>
      <p className="mt-3 text-muted-foreground">Democratize access to meaningful volunteering — verified organizations, transparent processes, real certification.</p>
      <h2 className="mt-10 font-display text-2xl font-semibold">How we're different</h2>
      <ul className="mt-3 list-inside list-disc space-y-2 text-muted-foreground">
        <li>Every NGO is manually verified by our team.</li>
        <li>Volunteers get portable, verifiable digital certificates.</li>
        <li>Free forever for both sides.</li>
      </ul>
    </div>
  ),
});
