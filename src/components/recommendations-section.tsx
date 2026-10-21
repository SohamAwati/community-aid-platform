import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { getRecommendations, type RecommendationItem } from "@/lib/recommendations.functions";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunity-card";
import type { CategoryKey } from "@/lib/categories";

export function RecommendationsSection() {
  const fetchRecs = useServerFn(getRecommendations);
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => fetchRecs(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="mb-10">
        <SectionHeader />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </section>
    );
  }

  const items = (data ?? []).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <SectionHeader />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((rec) => <RecCard key={rec.id} rec={rec} />)}
      </div>
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Sparkles className="size-5 text-primary" /> Recommended for you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Tailored to your skills, interests and history.</p>
      </div>
      <Link to="/opportunities" className="text-sm font-medium text-primary hover:underline">Browse all →</Link>
    </div>
  );
}

function RecCard({ rec }: { rec: RecommendationItem }) {
  const data: OpportunityCardData = {
    id: rec.id,
    title: rec.title,
    category: rec.category as CategoryKey,
    city: rec.city,
    location_mode: rec.location_mode,
    starts_at: rec.starts_at,
    slots: rec.slots,
    cover_url: rec.cover_url,
    ngo: rec.ngo,
  };
  return (
    <div className="flex flex-col gap-2">
      <OpportunityCard o={data} />
      <div className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary/90 ring-1 ring-primary/10">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        <span className="line-clamp-2">{rec.reason}</span>
      </div>
    </div>
  );
}
