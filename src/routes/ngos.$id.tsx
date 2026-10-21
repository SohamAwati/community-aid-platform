import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunity-card";
import { BadgeCheck, Globe, Mail, MapPin, Phone, Star, Users, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/ngos/$id")({
  head: () => ({ meta: pageMeta("NGO profile — Volunteer Connect", "Explore this nonprofit’s mission and volunteering opportunities.") }),
  component: NgoProfile,
});

function NgoProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ngo-profile", id],
    queryFn: async () => {
      const [ngo, opps, past, reviews, volunteers] = await Promise.all([
        supabase.from("ngos").select("*").eq("id", id).maybeSingle(),
        supabase.from("opportunities").select("id,title,category,city,location_mode,starts_at,slots,cover_url").eq("ngo_id", id).eq("status", "published").order("created_at", { ascending: false }).limit(9),
        supabase.from("opportunities").select("id,title,category,city,location_mode,starts_at,slots,cover_url").eq("ngo_id", id).eq("status", "closed").order("created_at", { ascending: false }).limit(6),
        supabase.from("reviews").select("rating,comment,created_at,reviewer_id").eq("ngo_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("applications").select("volunteer_id,opportunities!inner(ngo_id)").eq("opportunities.ngo_id", id),
      ]);
      if (!ngo.data) return null;
      const uniqueVols = new Set((volunteers.data ?? []).map((r) => r.volunteer_id)).size;
      const rating = reviews.data && reviews.data.length > 0
        ? reviews.data.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.data.length
        : null;
      return { ngo: ngo.data, opps: opps.data ?? [], past: past.data ?? [], reviews: reviews.data ?? [], uniqueVols, rating };
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to write a review");
      const { error } = await supabase.from("reviews").upsert({
        ngo_id: id,
        reviewer_id: user.id,
        rating: userRating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you for your feedback.");
      setReviewOpen(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["ngo-profile", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to submit review"),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading organization...</div>;
  if (!data) throw notFound();

  const { ngo, opps, past, reviews, uniqueVols, rating } = data;
  const social = (ngo.social_links ?? {}) as Record<string, string>;

  return (
    <div>
      <div className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-sky/40">
        {ngo.cover_url && <img src={ngo.cover_url} alt="" className="size-full object-cover" />}
      </div>
      <div className="mx-auto -mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-3xl font-display font-semibold text-primary">
              {ngo.logo_url ? <img src={ngo.logo_url} alt="" className="size-full object-cover" /> : ngo.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight">{ngo.name}</h1>
                {ngo.status === "verified" && (
                  <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/15">
                    <BadgeCheck className="size-3.5" /> Verified
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {(ngo.city || ngo.country) && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{[ngo.city, ngo.country].filter(Boolean).join(", ")}</span>}
                <span className="flex items-center gap-1"><Users className="size-3.5" />{uniqueVols} volunteer{uniqueVols !== 1 ? "s" : ""}</span>
                {rating !== null && <span className="flex items-center gap-1"><Star className="size-3.5 fill-current text-amber-500" />{rating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              {ngo.mission && (
                <>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mission</h2>
                  <p className="mb-4 text-sm">{ngo.mission}</p>
                </>
              )}
              {ngo.description && (
                <>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
                  <p className="text-sm text-muted-foreground">{ngo.description}</p>
                </>
              )}
              {ngo.causes && ngo.causes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ngo.causes.map((c: string) => (
                    <Badge key={c} variant="secondary" className="rounded-full capitalize">{c.replace(/_/g, " ")}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-2xl bg-secondary/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact</h3>
              {ngo.website && <a href={ngo.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary"><Globe className="size-3.5" />{ngo.website.replace(/^https?:\/\//, "")}</a>}
              {ngo.email && <a href={`mailto:${ngo.email}`} className="flex items-center gap-2 text-sm hover:text-primary"><Mail className="size-3.5" />{ngo.email}</a>}
              {ngo.phone && <div className="flex items-center gap-2 text-sm"><Phone className="size-3.5" />{ngo.phone}</div>}
              {Object.entries(social).filter(([, v]) => !!v).length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Social</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {Object.entries(social).filter(([, v]) => !!v).map(([k, v]) => (
                      <a key={k} href={v} target="_blank" rel="noreferrer" className="rounded-full bg-card px-2 py-1 capitalize ring-1 ring-border hover:text-primary">{k}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-semibold">Current opportunities</h2>
          {opps.length === 0 ? (
            <p className="text-muted-foreground">No open opportunities right now.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {opps.map((o) => <OpportunityCard key={o.id} o={o as OpportunityCardData} />)}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-2xl font-semibold">Past campaigns</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((o) => <OpportunityCard key={o.id} o={o as OpportunityCardData} />)}
            </div>
          </section>
        )}

        <section className="my-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">Reviews & Ratings</h2>
              <p className="text-sm text-muted-foreground">Feedback from volunteers who participated with {ngo.name}.</p>
            </div>
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    if (!user) {
                      navigate({ to: "/auth", search: { mode: "signin" } as never });
                      return;
                    }
                  }}
                  className="rounded-full gap-1.5"
                >
                  <MessageSquarePlus className="size-4" /> Write a Review
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display">Review {ngo.name}</DialogTitle>
                  <DialogDescription>
                    Share your volunteering experience to help other volunteers.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Rating (1 to 5 Stars)
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRating(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`size-6 ${
                              star <= userRating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 font-display font-semibold text-sm">{userRating} / 5</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Your Comments
                    </label>
                    <Textarea
                      rows={4}
                      placeholder="Describe what you enjoyed, how the NGO supported you, or any suggestions..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReviewOpen(false)} className="rounded-full">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitReview.mutate()}
                    disabled={submitReview.isPending}
                    className="rounded-full"
                  >
                    {submitReview.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {reviews.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <p>No reviews yet. Be the first volunteer to share your experience!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((r, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1 text-base"><Star className="size-4 fill-current text-amber-500" /> {r.rating}/5</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm">{r.comment || "Rated without comments."}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
