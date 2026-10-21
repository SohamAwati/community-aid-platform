import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/$id")({
  head: () => ({ meta: pageMeta("Team details — Volunteer Connect", "View your team and manage its members.") }),
  component: TeamDetail,
});

function TeamDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteName, setInviteName] = useState("");

  const { data: team } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => (await supabase.from("teams").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", id],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, role, joined_at").eq("team_id", id);
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url, city").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((m) => ({ ...m, profile: map.get(m.user_id) ?? null }));
    },
  });

  const isOwner = team?.owner_id === user?.id;

  const invite = useMutation({
    mutationFn: async () => {
      if (!inviteName.trim()) throw new Error("Enter a name to search");
      const { data: matches } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${inviteName.trim()}%`)
        .limit(1);
      if (!matches || matches.length === 0) throw new Error("No user found with that name");
      const target = matches[0];
      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: id, user_id: target.id, role: "member" });
      if (error) throw error;
      return target;
    },
    onSuccess: (t) => {
      toast.success(`Added ${t.full_name}`);
      setInviteName("");
      qc.invalidateQueries({ queryKey: ["team-members", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("team_id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["team-members", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!team) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">Loading team...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/teams" className="text-sm text-muted-foreground hover:text-foreground">← All teams</Link>
      <div className="mt-3 mb-8 flex items-start gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{team.name}</h1>
          {team.description && <p className="mt-1 text-muted-foreground">{team.description}</p>}
        </div>
      </div>

      {isOwner && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="font-display text-base">Invite a volunteer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Search by name</Label>
              <div className="flex gap-2">
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                <Button onClick={() => invite.mutate()} disabled={invite.isPending} className="rounded-full">
                  <UserPlus className="size-4" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">The person must have a Volunteer Connect profile.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Members ({members?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
              <div className="grid size-9 place-items-center rounded-full bg-muted text-sm font-semibold">
                {m.profile?.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <Link to="/volunteers/$id" params={{ id: m.user_id }} className="truncate font-medium hover:text-primary">
                  {m.profile?.full_name ?? "Unknown"}
                </Link>
                {m.profile?.city && <div className="text-xs text-muted-foreground">{m.profile.city}</div>}
              </div>
              <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">{m.role}</Badge>
              {isOwner && m.user_id !== user?.id && (
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(m.user_id)} aria-label="Remove">
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
