import { useState } from "react";
import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunity-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, ShieldCheck, Sparkles, Handshake, Award, UserPlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: pageMeta("Volunteer Connect — Find meaningful volunteering opportunities", "Discover volunteering opportunities from trusted NGOs and make a difference in your community.") }),
  component: HomePage,
});

function HomePage() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSubscribed(true);
    toast.success("Subscribed to Impact Digest! Welcome to our community.");
    setNewsletterEmail("");
  };

  const { data: featured } = useQuery({
    queryKey: ["featured-opportunities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("id,title,category,city,location_mode,starts_at,slots,cover_url,ngos(name)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []).map((o) => ({ ...o, ngo: o.ngos })) as OpportunityCardData[];
    },
  });

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-32 top-10 size-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -right-24 top-40 size-96 rounded-full bg-accent/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary/70 px-3 py-1 text-xs font-semibold tracking-wide uppercase text-primary">
              <Sparkles className="size-3.5" /> Community Resource Network
            </div>
            <h1 className="max-w-[20ch] font-display text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl lg:text-6xl">
              Make a Difference. <span className="text-primary">Volunteer Today.</span>
            </h1>
            <p className="mt-6 max-w-[58ch] text-lg text-muted-foreground text-balance">
              Discover meaningful opportunities from trusted NGOs and create real impact in your community. One platform for civic engagement — verified, secure, and free to join.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/opportunities">Find Opportunities <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to="/auth" search={{ mode: "signup", role: "ngo_admin" } as never}>Register Your NGO</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-foreground py-12 text-background">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { v: "1,200+", l: "Verified NGOs" },
            { v: "45k", l: "Active Volunteers" },
            { v: "8,900", l: "Opportunities Posted" },
            { v: "1.2M", l: "Lives Impacted" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-3xl font-semibold">{s.v}</div>
              <div className="mt-1 text-sm text-background/60">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-10 font-display text-3xl font-semibold tracking-tight">Explore by cause</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              to="/opportunities"
              search={{ category: c.key } as never}
              className="group rounded-2xl bg-card p-5 ring-1 ring-border transition-all hover:bg-secondary/60 hover:ring-primary/30"
            >
              <div className="mb-4 grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                <c.icon className="size-4" />
              </div>
              <div className="text-sm font-semibold">{c.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED OPPORTUNITIES */}
      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">Priority requests</h2>
              <p className="mt-2 text-muted-foreground">Immediate help needed from our verified partners.</p>
            </div>
            <Button asChild variant="link" className="hidden sm:inline-flex text-primary">
              <Link to="/opportunities">View all <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          {featured && featured.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((o) => <OpportunityCard key={o.id} o={o} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">Opportunities will appear here once verified NGOs start posting.</p>
              <Button asChild className="mt-4 rounded-full"><Link to="/auth" search={{ mode: "signup", role: "ngo_admin" } as never}>Be the first NGO</Link></Button>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">Efficient civic participation in five steps.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-5">
          {[
            { icon: UserPlus, t: "Create account", d: "Sign up as a volunteer or NGO." },
            { icon: Sparkles, t: "Discover", d: "Filter by cause, place, or skill." },
            { icon: Handshake, t: "Apply", d: "One-click applications." },
            { icon: ShieldCheck, t: "Volunteer", d: "Show up and make impact." },
            { icon: Award, t: "Get certified", d: "Verified certificates for your work." },
          ].map((step, i) => (
            <div key={step.t} className="relative flex flex-col items-center text-center">
              <div className="grid size-12 place-items-center rounded-full bg-card font-display text-sm font-semibold text-primary ring-1 ring-border">
                {i + 1}
              </div>
              <step.icon className="mt-4 size-5 text-accent" />
              <h4 className="mt-3 font-semibold">{step.t}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-display text-2xl leading-relaxed text-balance md:text-3xl">
            "Volunteer Connect made it easy to find causes I actually care about. The application flow was one click, and I earned a certificate I could share on LinkedIn."
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold">A</div>
            <div className="text-left">
              <div className="text-sm font-semibold">Amara Okoye</div>
              <div className="text-xs text-muted-foreground">Volunteer · Lagos</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-8 font-display text-3xl font-semibold tracking-tight">Frequent questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: "How do I verify my NGO?", a: "Register an NGO account, submit your organization details, and a super admin reviews and approves within 48 hours." },
            { q: "Is Volunteer Connect free?", a: "Yes — free for both volunteers and NGOs. We're funded by community partners." },
            { q: "Can I volunteer remotely?", a: "Many opportunities offer remote or hybrid options. Filter by location mode when browsing." },
            { q: "What about certificates?", a: "NGOs can issue verified digital certificates directly through the platform once you complete an opportunity." },
          ].map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* NEWSLETTER */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-primary p-10 text-primary-foreground md:p-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">Impact Digest</h2>
              <p className="mt-3 text-primary-foreground/80">Monthly opportunities and impact stories, straight to your inbox.</p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-3 rounded-2xl bg-primary-foreground/15 p-4 text-primary-foreground backdrop-blur-sm">
                <CheckCircle2 className="size-6 text-accent shrink-0" />
                <div>
                  <p className="font-semibold">You're subscribed!</p>
                  <p className="text-xs text-primary-foreground/80">Thank you for joining our community of changemakers.</p>
                </div>
              </div>
            ) : (
              <form className="flex gap-2" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 rounded-full bg-background px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button type="submit" variant="secondary" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Subscribe
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
