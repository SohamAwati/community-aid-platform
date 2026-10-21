import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#f472b6", "#22d3ee"];

export function ImpactCharts() {
  const { user } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["impact-charts", user?.id],
    queryFn: async () => {
      const { data: apps } = await supabase
        .from("applications")
        .select("status,created_at,completed_at,hours_logged,opportunities(category,hours_estimate)")
        .eq("volunteer_id", user!.id);
      const monthly = new Map<string, number>();
      const causes = new Map<string, number>();
      (apps ?? []).forEach((a) => {
        const opp = (a as { opportunities?: { category?: string; hours_estimate?: number } | null }).opportunities;
        const isDone = a.status === "completed" || a.completed_at;
        if (isDone) {
          const h = a.hours_logged || opp?.hours_estimate || 4;
          const key = new Date(a.completed_at ?? a.created_at).toISOString().slice(0, 7);
          monthly.set(key, (monthly.get(key) ?? 0) + h);
          if (opp?.category) causes.set(opp.category, (causes.get(opp.category) ?? 0) + 1);
        }
      });
      const months = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ month: k.slice(5), hours: v }));
      const cats = [...causes.entries()].map(([k, v]) => ({ name: CATEGORY_LABEL[k as CategoryKey] ?? k, value: v }));
      return { months, cats };
    },
  });

  const hasData = data && (data.months.length > 0 || data.cats.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Monthly volunteering hours</CardTitle></CardHeader>
        <CardContent className="h-64">
          {!hasData || data!.months.length === 0 ? (
            <p className="pt-8 text-center text-sm text-muted-foreground">Complete opportunities to see your monthly trend.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data!.months}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Causes supported</CardTitle></CardHeader>
        <CardContent className="h-64">
          {!hasData || data!.cats.length === 0 ? (
            <p className="pt-8 text-center text-sm text-muted-foreground">Your cause breakdown appears after completing events.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data!.cats} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                  {data!.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
