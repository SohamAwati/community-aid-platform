import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Download } from "lucide-react";

export const Route = createFileRoute("/certificates/$code")({
  head: () => ({ meta: pageMeta("Verify certificate — Volunteer Connect", "Verify a Volunteer Connect certificate by its unique code.") }),
  component: CertificatePage,
});

function CertificatePage() {
  const { code } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["cert", code],
    queryFn: async () => {
      const { data: rows } = await supabase.rpc("verify_certificate", { _code: code });
      return rows?.[0] ?? null;
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Verifying certificate...</div>;
  if (!data) throw notFound();

  const opp = { title: data.opportunity_title, ngos: data.ngo_name ? { name: data.ngo_name } : null };
  const name = data.volunteer_name ?? "Volunteer";

  const print = () => window.print();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-3xl border-4 border-double border-primary/30 bg-card p-10 shadow-lg print:shadow-none">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Volunteer Connect</div>
          <div className="flex items-center gap-1 text-xs text-primary"><BadgeCheck className="size-4" /> Verified · {data.code}</div>
        </div>
        <p className="text-center text-sm uppercase tracking-widest text-muted-foreground">Certificate of Volunteering</p>
        <h1 className="mt-4 text-center font-display text-4xl font-semibold">{name}</h1>
        <p className="mt-6 text-center text-muted-foreground">has successfully completed</p>
        <h2 className="mt-2 text-center font-display text-2xl font-semibold">{opp?.title ?? "Volunteering activity"}</h2>
        {opp?.ngos?.name && <p className="mt-1 text-center text-sm text-muted-foreground">with <span className="font-medium text-foreground">{opp.ngos.name}</span></p>}
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4 text-center">
          <div className="rounded-xl bg-secondary/50 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Hours</div>
            <div className="mt-1 font-display text-2xl font-semibold">{data.hours ?? 0}</div>
          </div>
          <div className="rounded-xl bg-secondary/50 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Issued</div>
            <div className="mt-1 font-display text-lg font-semibold">{new Date(data.issued_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="mt-8 flex justify-center gap-3 print:hidden">
          <Button onClick={print} className="rounded-full"><Download className="size-4" /> Download / Print</Button>
        </div>
      </div>
    </div>
  );
}
