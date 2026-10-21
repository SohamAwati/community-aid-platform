import { Link } from "@tanstack/react-router";
import { MapPin, Calendar, Users } from "lucide-react";
import { CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";

export interface OpportunityCardData {
  id: string;
  title: string;
  category: CategoryKey;
  city: string | null;
  location_mode: "onsite" | "remote" | "hybrid";
  starts_at: string | null;
  slots: number;
  cover_url: string | null;
  ngo?: { name: string } | null;
}

export function OpportunityCard({ o }: { o: OpportunityCardData }) {
  return (
    <Link
      to="/opportunities/$id"
      params={{ id: o.id }}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-all hover:ring-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="aspect-[4/3] overflow-hidden bg-secondary">
        {o.cover_url ? (
          <img src={o.cover_url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary to-sky/60">
            <span className="font-display text-3xl text-primary/40">{o.title.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full font-medium">{CATEGORY_LABEL[o.category]}</Badge>
          {o.location_mode !== "onsite" && (
            <Badge variant="outline" className="rounded-full font-medium capitalize">{o.location_mode}</Badge>
          )}
        </div>
        {o.ngo?.name && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-primary">{o.ngo.name}</p>
        )}
        <h3 className="mb-3 line-clamp-2 font-display text-lg font-semibold leading-tight">{o.title}</h3>
        <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
          {o.city && <div className="flex items-center gap-2"><MapPin className="size-3.5" /><span>{o.city}</span></div>}
          {o.starts_at && (
            <div className="flex items-center gap-2"><Calendar className="size-3.5" />
              <span>{new Date(o.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          )}
          <div className="flex items-center gap-2"><Users className="size-3.5" /><span>{o.slots} spot{o.slots !== 1 ? "s" : ""}</span></div>
        </div>
      </div>
    </Link>
  );
}
