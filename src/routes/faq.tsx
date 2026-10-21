import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "How do I sign up as a volunteer?", a: "Click Join, choose Volunteer, and complete your profile. It takes about 2 minutes." },
  { q: "How does NGO verification work?", a: "NGOs register their organization details. A super admin reviews the submission within 48 hours and either verifies, requests more info, or declines." },
  { q: "Is Volunteer Connect free?", a: "Yes — free for both volunteers and NGOs. We're supported by community and civic partners." },
  { q: "Can I volunteer remotely?", a: "Many opportunities are remote or hybrid. Use the location filter when browsing." },
  { q: "How do certificates work?", a: "After you complete an opportunity, the NGO can issue you a verified digital certificate you can share on LinkedIn or your CV." },
  { q: "How do I report inappropriate content?", a: "Use the contact form or email us — every report is reviewed by our moderation team." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: pageMeta("FAQ — Volunteer Connect", "Answers to the most common questions about Volunteer Connect for volunteers and NGOs.") }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Frequently asked questions</h1>
      <Accordion type="single" collapsible className="mt-10">
        {faqs.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  ),
});
