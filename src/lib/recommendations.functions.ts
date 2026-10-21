import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RecommendationItem {
  id: string;
  title: string;
  category: string;
  city: string | null;
  location_mode: "onsite" | "remote" | "hybrid";
  starts_at: string | null;
  slots: number;
  cover_url: string | null;
  ngo: { name: string } | null;
  score: number;
  reason: string;
}

export const getRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecommendationItem[]> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: opps }, { data: pastApps }] = await Promise.all([
      supabase.from("profiles").select("skills,interests,city,country,availability").eq("id", userId).maybeSingle(),
      supabase
        .from("opportunities")
        .select("id,title,description,category,skills_required,city,country,location_mode,starts_at,slots,cover_url,ngos(name)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("applications").select("opportunities(category)").eq("volunteer_id", userId),
    ]);

    const candidates = (opps ?? []).map((o) => ({
      ...o,
      ngo: (o as { ngos?: { name: string } | null }).ngos ?? null,
    }));

    const userSkills = new Set((profile?.skills ?? []).map((s: string) => s.toLowerCase()));
    const userInterests = new Set((profile?.interests ?? []).map((s: string) => s.toLowerCase()));
    const historyCats = new Set(
      (pastApps ?? [])
        .map((a) => (a as { opportunities?: { category?: string } | null }).opportunities?.category)
        .filter((v): v is string => !!v),
    );
    const userCity = (profile?.city ?? "").toLowerCase();

    // Rule-based scoring first (fast fallback + baseline)
    const scored = candidates.map((o) => {
      let score = 0;
      const reasons: string[] = [];
      const skills = (o.skills_required ?? []) as string[];
      const overlap = skills.filter((s) => userSkills.has(s.toLowerCase()));
      if (overlap.length > 0) {
        score += overlap.length * 25;
        reasons.push(`matches your skills: ${overlap.slice(0, 3).join(", ")}`);
      }
      if (userInterests.has(o.category.toLowerCase())) {
        score += 20;
        reasons.push(`aligns with your interest in ${o.category.replace(/_/g, " ")}`);
      }
      if (historyCats.has(o.category)) {
        score += 15;
        reasons.push(`similar to your past volunteering`);
      }
      if (userCity && o.city && o.city.toLowerCase() === userCity) {
        score += 15;
        reasons.push(`local to ${o.city}`);
      }
      if (o.location_mode === "remote") {
        score += 5;
        if (reasons.length === 0) reasons.push("remote-friendly opportunity");
      }
      if (reasons.length === 0) reasons.push("popular new opportunity you may like");
      return {
        id: o.id,
        title: o.title,
        category: o.category,
        city: o.city,
        location_mode: o.location_mode,
        starts_at: o.starts_at,
        slots: o.slots,
        cover_url: o.cover_url,
        ngo: o.ngo,
        score,
        reason: reasons.slice(0, 2).join(" · "),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const topBase = scored.slice(0, 12);

    // Try AI re-ranking for the top base set. Fall back silently on any error.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey && topBase.length > 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "You are a volunteering match engine. Return strict JSON only, no prose. For each opportunity, produce a personalized one-sentence reason (max 18 words) explaining why it fits this volunteer, and a score 0-100.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  volunteer: {
                    skills: [...userSkills],
                    interests: [...userInterests],
                    city: profile?.city ?? null,
                    availability: profile?.availability ?? null,
                    history_categories: [...historyCats],
                  },
                  opportunities: topBase.map((o) => ({
                    id: o.id,
                    title: o.title,
                    category: o.category,
                    city: o.city,
                    mode: o.location_mode,
                  })),
                  format: '{"items":[{"id":"...","score":0-100,"reason":"..."}]}',
                }),
              },
            ],
            response_format: { type: "json_object" },
          }),
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
          const content = data.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(content) as { items?: { id: string; score: number; reason: string }[] };
          const map = new Map(parsed.items?.map((i) => [i.id, i]) ?? []);
          const merged = topBase.map((o) => {
            const ai = map.get(o.id);
            return ai ? { ...o, score: (o.score + ai.score) / 2, reason: ai.reason || o.reason } : o;
          });
          merged.sort((a, b) => b.score - a.score);
          return merged;
        }
      } catch {
        // fall through to rule-based
      }
    }

    return topBase;
  });
