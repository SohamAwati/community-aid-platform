import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: pageMeta("Teams — Volunteer Connect", "Create and join volunteer teams.") }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: teams } = useQuery({
    enabled: !!user,
    queryKey: ["my-teams", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id, role, teams(id, name, description, owner_id, created_at)")
        .eq("user_id", user!.id);
      return (memberships ?? [])
        .map((m) => {
          const t = (m as { teams?: { id: string; name: string; description: string | null; owner_id: string; created_at: string } | null }).teams;
          return t ? { ...t, myRole: m.role as string } : null;
        })
        .filter((t): t is NonNullable<typeof t> => !!t);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { data: team, error } = await supabase
        .from("teams")
        .insert({ name: name.trim(), description: description.trim() || null, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      const { error: memberErr } = await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: user!.id, role: "owner" });
      if (memberErr) throw memberErr;
      return team;
    },
    onSuccess: () => {
      toast.success("Team created");
      setName(""); setDescription(""); setShowNew(false);
      qc.invalidateQueries({ queryKey: ["my-teams"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">Volunteer together with friends, colleagues, or classmates.</p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)} className="rounded-full">
          <Plus className="size-4" /> New team
        </Button>
      </div>

      {showNew && (
        <Card className="mb-6">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label>Team name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Green Warriors" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What does your team care about?" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-full">
                {create.isPending ? "Creating..." : "Create team"}
              </Button>
              <Button variant="outline" onClick={() => setShowNew(false)} className="rounded-full">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!teams || teams.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 size-8 opacity-50" />
            You're not on any teams yet. Create one to start volunteering together.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="group">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Users className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg font-semibold group-hover:text-primary">{t.name}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">{t.myRole}</div>
                    </div>
                  </div>
                  {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
