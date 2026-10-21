import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { dateFilterBounds } from "@/lib/workflow-rules";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunity-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, Sparkles, TrendingUp, MapPin, Clock, Building2, Plus, ArrowRight } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  location_mode: z.enum(["onsite", "remote", "hybrid"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  city: z.string().optional(),
  skill: z.string().optional(),
  view: z.enum(["all", "trending", "nearby", "recent"]).optional(),
});

export const Route = createFileRoute("/opportunities")({
  validateSearch: searchSchema,
  head: () => ({ meta: pageMeta("Browse opportunities — Volunteer Connect", "Search verified volunteer opportunities by cause, skill, location, and availability.") }),
  component: OppList,
});

const POPULAR_SKILLS = [
  "Teaching",
  "Mentoring",
  "First Aid",
  "Healthcare",
  "Social Media",
  "Design",
  "Web Development",
  "Fundraising",
  "Event Planning",
  "Translation",
  "Logistics",
  "Counseling",
  "Animal Care",
  "Gardening",
];

const TABS = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "nearby", label: "Nearby", icon: MapPin },
  { key: "recent", label: "New", icon: Clock },
] as const;

function OppList() {
  const initial = Route.useSearch();
  const { user, isNgoAdmin, isSuperAdmin } = useAuth();

  if (isNgoAdmin && !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background p-8 text-center sm:p-12 shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Building2 className="size-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Browse Opportunities Directory
          </h1>
          <p className="mt-3 max-w-xl mx-auto text-base text-muted-foreground">
            The Browse Opportunities directory is designed for Volunteers and Super Admins to discover and apply for volunteering drives.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            As an NGO partner, your organization drives, listings, and volunteer applicant rosters are managed through your dedicated NGO Workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-sm">
              <Link to="/ngo/opportunities">
                Manage My Opportunities
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-emerald-500/30">
              <Link to="/ngo/opportunities/new">
                <Plus className="mr-1.5 size-4" /> Post New Opportunity
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link to="/dashboard">
                NGO Dashboard <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState<string>(initial.category ?? "all");
  const [locationMode, setLocationMode] = useState<string>(initial.location_mode ?? "all");
  const [skill, setSkill] = useState<string>(initial.skill ?? "all");
  const [view, setView] = useState<"all" | "trending" | "nearby" | "recent">(initial.view ?? "all");

  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [city, setCity] = useState(initial.city ?? "");

  const { data: myProfile } = useQuery({
    enabled: !!user && view === "nearby",
    queryKey: ["profile-city", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return (await supabase.from("profiles").select("city").eq("id", user.id).maybeSingle()).data;
    },
  });

  const { data: trendingIds } = useQuery({
    enabled: view === "trending",
    queryKey: ["trending-app-counts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const { data } = await supabase.from("applications").select("opportunity_id").gte("created_at", since);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r) => counts.set(r.opportunity_id, (counts.get(r.opportunity_id) ?? 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => id);
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["opportunities", { q, category, locationMode, skill, view, profileCity: myProfile?.city, trendingIds, from, to, city }],
    queryFn: async () => {
      let qb = supabase
        .from("opportunities")
        .select("id,title,description,category,city,location_mode,starts_at,slots,cover_url,skills_required,ngos(name)")
        .eq("status", "published")
        .limit(60);

      if (view === "recent") qb = qb.order("created_at", { ascending: false });
      else if (view === "trending") {
        if (!trendingIds || trendingIds.length === 0) return [];
        qb = qb.in("id", trendingIds);
      } else if (view === "nearby") {
        if (myProfile?.city) qb = qb.ilike("city", myProfile.city);
        qb = qb.order("created_at", { ascending: false });
      } else {
        qb = qb.order("created_at", { ascending: false });
      }

      const bounds = dateFilterBounds(from, to);
      if (bounds.from) qb = qb.gte("starts_at", bounds.from);
      if (bounds.to) qb = qb.lte("starts_at", bounds.to);
      if (city.trim()) qb = qb.ilike("city", `%${city.trim().replace(/[%,]/g, "")}%`);
      if (category !== "all") qb = qb.eq("category", category as CategoryKey);
      if (locationMode !== "all") qb = qb.eq("location_mode", locationMode as "onsite" | "remote" | "hybrid");
      if (skill !== "all") {
        qb = qb.contains("skills_required", [skill]);
      }
      if (q.trim()) {
        const term = q.trim().replace(/[%,]/g, " ");
        qb = qb.or(`title.ilike.%${term}%,description.ilike.%${term}%,city.ilike.%${term}%`);
      }

      const { data, error } = await qb;
      if (error) throw error;
      let rows = (data ?? []).map((o) => ({ ...o, ngo: o.ngos })) as (OpportunityCardData & { id: string })[];

      if (view === "trending" && trendingIds) {
        const order = new Map(trendingIds.map((id, i) => [id, i]));
        rows = rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
      }
      return rows;
    },
  });

  const activeTab = TABS.find((t) => t.key === view) ?? TABS[0];
  const emptyMsg =
    view === "trending" ? "No trending opportunities in the last 7 days yet."
    : view === "nearby" ? (myProfile?.city ? `Nothing near ${myProfile.city} right now. Try remote or another cause.` : "Add your city in your profile to see nearby opportunities.")
    : "No opportunities match those filters yet.";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Browse opportunities</h1>
        <p className="mt-2 text-muted-foreground">Verified opportunities from trusted NGOs worldwide.</p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5 rounded-full data-[state=active]:bg-background">
              <t.icon className="size-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-8 flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, cause, city, or keyword..." className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All causes</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={skill} onValueChange={setSkill}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Skill" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any skill</SelectItem>
            {POPULAR_SKILLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locationMode} onValueChange={setLocationMode}>
          <SelectTrigger className="sm:w-36"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any place</SelectItem>
            <SelectItem value="onsite">On-site</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="filter-city">City</Label><Input id="filter-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any city" /></div>
        <div className="space-y-1.5"><Label htmlFor="filter-from">Starts from</Label><Input id="filter-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="filter-to">Starts before</Label><Input id="filter-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {(category !== "all" || locationMode !== "all" || skill !== "all" || q) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          {category !== "all" && <Badge variant="secondary" onClick={() => setCategory("all")} className="cursor-pointer">{CATEGORY_LABEL[category as CategoryKey]} ×</Badge>}
          {skill !== "all" && <Badge variant="secondary" onClick={() => setSkill("all")} className="cursor-pointer">{skill} ×</Badge>}
          {locationMode !== "all" && <Badge variant="secondary" onClick={() => setLocationMode("all")} className="cursor-pointer capitalize">{locationMode} ×</Badge>}
          {q && <Badge variant="secondary" onClick={() => setQ("")} className="cursor-pointer">"{q}" ×</Badge>}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <activeTab.icon className="size-4" />
        <span>
          {view === "trending" && "Most-applied roles in the last 7 days"}
          {view === "nearby" && (myProfile?.city ? `Opportunities in ${myProfile.city}` : "Sign in and add a city to personalize")}
          {view === "recent" && "Freshly posted opportunities"}
          {view === "all" && "All published opportunities"}
        </span>
      </div>

      {isError ? <div className="py-12 text-center"><p className="text-destructive">Opportunities could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button></div> : isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.map((o) => <OpportunityCard key={o.id} o={o} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">{emptyMsg}</p>
          <Button variant="link" className="mt-2" onClick={() => { setQ(""); setCategory("all"); setSkill("all"); setLocationMode("all"); setCity(""); setFrom(""); setTo(""); setView("all"); }}>Reset filters</Button>
        </div>
      )}
    </div>
  );
}
