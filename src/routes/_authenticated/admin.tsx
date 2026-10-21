import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldAlert, ShieldCheck, UserPlus, Trash2, Users, FileText,
  BarChart3, Check, X, Search, Ban, CheckCircle2, Layers, Tag, Plus, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { ReportModeration } from "@/components/report-moderation";
import { CATEGORIES, CATEGORY_LABEL, type CategoryKey } from "@/lib/categories";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getSuspendedUserIds, setUserSuspended } from "@/lib/suspension";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: pageMeta("Admin panel — Volunteer Connect", "Review NGO verification, manage users, moderate opportunities, and view analytics.") }),
  component: AdminPanel,
});

type SuperAdmin = { user_id: string; email: string; granted_at: string };

export function AdminPanel() {
  const { isSuperAdmin, loading, user } = useAuth();
  const qc = useQueryClient();

  const [newEmail, setNewEmail] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [oppSearch, setOppSearch] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [customCategories, setCustomCategories] = useState<Array<{ key: string; label: string }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vc_custom_categories");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return [];
  });

  const [suspendedUsers, setSuspendedUsers] = useState<Set<string>>(() => getSuspendedUserIds());

  // Overview metrics
  const { data: overview } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [users, opps, apps, ngos, reviews] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("opportunities").select("id,category,status", { count: "exact" }),
        supabase.from("applications").select("id,status", { count: "exact" }),
        supabase.from("ngos").select("id,status", { count: "exact" }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        opps: opps.count ?? 0,
        apps: apps.count ?? 0,
        ngos: ngos.count ?? 0,
        reviews: reviews.count ?? 0,
        oppRows: opps.data ?? [],
        appRows: apps.data ?? [],
        ngoRows: ngos.data ?? [],
      };
    },
  });

  // NGO Queue
  const { data: pendingNgos } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["admin-pending-ngos"],
    queryFn: async () => (await supabase.from("ngos").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  // Super Admins
  const { data: superAdmins } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["super-admins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_super_admins");
      if (error) throw error;
      return (data ?? []) as SuperAdmin[];
    },
  });

  // All Users / Profiles
  const { data: allProfiles } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("user_roles").select("*"),
      ]);
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });
      return (profs ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? ["volunteer"],
      }));
    },
  });

  // All Opportunities across platform
  const { data: allOpps } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["admin-all-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, ngos(id, name, status)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setNgoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "verified" | "rejected" | "pending" }) => {
      const { error } = await supabase.from("ngos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending-ngos"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("NGO status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update NGO status"),
  });

  const setOppStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "published" | "closed" | "draft" }) => {
      const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-opportunities"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Opportunity status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update opportunity"),
  });

  const deleteOppAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-opportunities"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Opportunity removed by administrator");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete opportunity"),
  });

  const grantAdmin = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("grant_super_admin_by_email", { _email: email });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewEmail("");
      qc.invalidateQueries({ queryKey: ["super-admins"] });
      toast.success("Super admin granted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const revokeAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("revoke_super_admin", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admins"] });
      toast.success("Super admin revoked");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleUserSuspension = (userId: string, name: string) => {
    const next = new Set(suspendedUsers);
    const wasSuspended = next.has(userId);
    if (wasSuspended) {
      next.delete(userId);
      toast.success(`Account for ${name || "User"} activated`);
      void setUserSuspended(userId, false);
    } else {
      next.add(userId);
      toast.error(`Account for ${name || "User"} suspended`);
      void setUserSuspended(userId, true);
    }
    setSuspendedUsers(next);
  };

  const addCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryLabel.trim()) return;
    const key = (newCategoryKey || newCategoryLabel).toLowerCase().replace(/[^a-z0-9]/g, "_");
    const updated = [...customCategories, { key, label: newCategoryLabel.trim() }];
    setCustomCategories(updated);
    localStorage.setItem("vc_custom_categories", JSON.stringify(updated));
    setNewCategoryLabel("");
    setNewCategoryKey("");
    toast.success("Category added successfully");
  };

  const removeCustomCategory = (key: string) => {
    const updated = customCategories.filter((c) => c.key !== key);
    setCustomCategories(updated);
    localStorage.setItem("vc_custom_categories", JSON.stringify(updated));
    toast.success("Category removed");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Verifying administrator access...</div>;
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Chart data: Opportunities by category
  const categoryCountMap = new Map<string, number>();
  (overview?.oppRows ?? []).forEach((o) => {
    categoryCountMap.set(o.category, (categoryCountMap.get(o.category) ?? 0) + 1);
  });
  const chartData = Array.from(categoryCountMap.entries()).map(([cat, count]) => ({
    name: CATEGORY_LABEL[cat as CategoryKey] || cat,
    count,
  }));

  const filteredProfiles = (allProfiles ?? []).filter((p) => {
    const term = userSearch.toLowerCase();
    return (
      (p.full_name ?? "").toLowerCase().includes(term) ||
      (p.city ?? "").toLowerCase().includes(term) ||
      (p.id ?? "").toLowerCase().includes(term)
    );
  });

  const filteredOpps = (allOpps ?? []).filter((o) => {
    const term = oppSearch.toLowerCase();
    return (
      o.title.toLowerCase().includes(term) ||
      (o.city ?? "").toLowerCase().includes(term) ||
      ((o.ngos as any)?.name ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Super Administrator Control Center</h1>
            <p className="text-muted-foreground">Platform oversight, NGO approvals, moderation, and users</p>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/40 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
          Logged in: {user?.email}
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total Users" value={overview?.users ?? 0} icon={Users} />
        <Stat label="Total NGOs" value={overview?.ngos ?? 0} icon={Layers} />
        <Stat label="Opportunities" value={overview?.opps ?? 0} icon={FileText} />
        <Stat label="Applications" value={overview?.apps ?? 0} icon={BarChart3} />
        <Stat label="Reviews & Feedback" value={overview?.reviews ?? 0} icon={Tag} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ngos" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1.5 rounded-2xl">
          <TabsTrigger value="ngos" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <ShieldCheck className="size-4" /> NGO Verification Queue ({pendingNgos?.filter((n) => n.status === "pending").length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <Users className="size-4" /> Users & Accounts
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <FileText className="size-4" /> Opportunities
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <Tag className="size-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <BarChart3 className="size-4" /> Analytics & Reports
          </TabsTrigger>
          <TabsTrigger value="admins" className="rounded-full gap-1.5 data-[state=active]:bg-background">
            <ShieldAlert className="size-4" /> Super Admins
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: NGO VERIFICATION */}
        <TabsContent value="ngos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">NGO Verification Requests</h2>
              <p className="text-sm text-muted-foreground">Verify organizations before they can publish volunteer opportunities.</p>
            </div>
          </div>

          {!pendingNgos || pendingNgos.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">No NGOs in queue.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pendingNgos.map((n) => (
                <Card key={n.id} className="transition-all hover:ring-1 hover:ring-border">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={n.status === "verified" ? "default" : n.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                          {n.status}
                        </Badge>
                        <span className="font-display text-lg font-semibold">{n.name}</span>
                        {n.website && (
                          <a href={n.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                            <ExternalLink className="size-3" /> Website
                          </a>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{n.email} {n.phone && `· ${n.phone}`}</div>
                      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {n.registration_number && <div><span className="text-muted-foreground">Reg No:</span> {n.registration_number}</div>}
                        {n.contact_person && <div><span className="text-muted-foreground">Contact:</span> {n.contact_person}</div>}
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {[n.address, n.city, n.state, n.postal_code, n.country].filter(Boolean).join(", ") || "—"}</div>
                      </div>
                      <p className="pt-1 text-sm">{n.description}</p>
                      {n.mission && <p className="text-xs text-muted-foreground italic">Mission: "{n.mission}"</p>}
                    </div>

                    <div className="flex flex-wrap gap-2 sm:self-center">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link to="/ngos/$id" params={{ id: n.id }}>View Profile</Link>
                      </Button>
                      {n.status !== "verified" && (
                        <Button size="sm" onClick={() => setNgoStatus.mutate({ id: n.id, status: "verified" })} className="rounded-full gap-1 bg-green-600 hover:bg-green-700">
                          <Check className="size-3.5" /> Approve
                        </Button>
                      )}
                      {n.status !== "rejected" && (
                        <Button size="sm" variant="outline" onClick={() => setNgoStatus.mutate({ id: n.id, status: "rejected" })} className="rounded-full gap-1 text-destructive hover:bg-destructive/10">
                          <X className="size-3.5" /> Reject
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: USERS & ACCOUNTS */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">User Account Management</h2>
              <p className="text-sm text-muted-foreground">Review registered volunteers and NGOs, manage roles, and suspend malicious accounts.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search user..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 rounded-full"
              />
            </div>
          </div>

          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {filteredProfiles.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">No users found.</div>
            ) : (
              filteredProfiles.map((p) => {
                const isSuspended = suspendedUsers.has(p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-muted/30">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{p.full_name || "Unnamed User"}</span>
                        {p.roles.map((r: string) => (
                          <Badge key={r} variant={r === "super_admin" ? "default" : r === "ngo_admin" ? "secondary" : "outline"} className="capitalize text-xs">
                            {r.replace("_", " ")}
                          </Badge>
                        ))}
                        {isSuspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: <span className="font-mono">{p.id}</span> {p.city && `· Location: ${p.city}, ${p.country || ""}`}
                      </div>
                      {p.bio && <p className="line-clamp-1 text-xs text-muted-foreground">{p.bio}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link to="/volunteers/$id" params={{ id: p.id }}>Public Portfolio</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant={isSuspended ? "default" : "outline"}
                        className={`rounded-full gap-1.5 ${!isSuspended ? "text-destructive hover:bg-destructive/10" : ""}`}
                        onClick={() => toggleUserSuspension(p.id, p.full_name ?? "")}
                      >
                        {isSuspended ? (
                          <>
                            <CheckCircle2 className="size-3.5" /> Reactivate
                          </>
                        ) : (
                          <>
                            <Ban className="size-3.5" /> Suspend
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* TAB 3: OPPORTUNITIES MODERATION */}
        <TabsContent value="opportunities" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Opportunities Moderation</h2>
              <p className="text-sm text-muted-foreground">Review, edit status, or take down inappropriate opportunity listings across the platform.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search opportunities..."
                value={oppSearch}
                onChange={(e) => setOppSearch(e.target.value)}
                className="pl-9 rounded-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredOpps.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">No opportunities found.</CardContent></Card>
            ) : (
              filteredOpps.map((o) => (
                <Card key={o.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={o.status === "published" ? "default" : "outline"} className="capitalize">
                          {o.status}
                        </Badge>
                        <Badge variant="secondary">{CATEGORY_LABEL[o.category as CategoryKey] || o.category}</Badge>
                        <span className="font-display font-semibold">{o.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Organized by: <span className="font-medium text-foreground">{(o.ngos as any)?.name ?? "NGO"}</span> · {o.city ?? "Location unlisted"} · {o.slots} spots
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{o.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="ghost" className="rounded-full">
                        <Link to="/opportunities/$id" params={{ id: o.id }}>View</Link>
                      </Button>
                      {o.status === "published" ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOppStatus.mutate({ id: o.id, status: "closed" })}>
                          Close
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOppStatus.mutate({ id: o.id, status: "published" })}>
                          Publish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Remove "${o.title}" from platform?`)) {
                            deleteOppAdmin.mutate(o.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 4: CATEGORIES MANAGEMENT */}
        <TabsContent value="categories" className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Opportunity Categories</h2>
            <p className="text-sm text-muted-foreground">Manage and expand cause categories for opportunity classifications.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Add New Category</CardTitle>
              <CardDescription>Expand available causes for NGOs and volunteers.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addCustomCategory} className="flex flex-wrap gap-3">
                <Input
                  required
                  placeholder="Category Name (e.g. Mental Health, Youth Empowerment)"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  className="max-w-md"
                />
                <Button type="submit" className="rounded-full gap-1.5">
                  <Plus className="size-4" /> Add Category
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                    <c.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{c.label}</div>
                    <div className="text-[10px] uppercase font-mono text-muted-foreground">Standard · {c.key}</div>
                  </div>
                </div>
                <Badge variant="outline">Default</Badge>
              </div>
            ))}

            {customCategories.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-2xl border border-primary/30 bg-card p-4">
                <div>
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground">Custom · {c.key}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeCustomCategory(c.key)} className="size-7 text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TAB 5: ANALYTICS & REPORTS */}
        <TabsContent value="analytics" className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Platform-wide Analytics & Monitoring</h2>
            <p className="text-sm text-muted-foreground">Distribution of causes and volunteer engagement.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Opportunities by Cause</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="oklch(0.73 0.14 245)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No opportunity data available for charting yet.</p>
              )}
            </CardContent>
          </Card>

          <ReportModeration />
        </TabsContent>

        {/* TAB 6: SUPER ADMINS */}
        <TabsContent value="admins" className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Super Administrator Credentials & Roles</h2>
            <p className="text-sm text-muted-foreground">Manage authorized administrative personnel for Volunteer Connect.</p>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <form
                onSubmit={(e) => { e.preventDefault(); if (newEmail.trim()) grantAdmin.mutate(newEmail.trim()); }}
                className="flex flex-wrap items-center gap-2"
              >
                <Input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="submit" disabled={grantAdmin.isPending} className="rounded-full">
                  <UserPlus className="size-4" /> Grant super admin
                </Button>
                <p className="w-full text-xs text-muted-foreground">
                  The user must already have an account. Only existing super admins can grant this role.
                </p>
              </form>

              <div className="divide-y divide-border rounded-lg border border-border">
                {(superAdmins ?? []).length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No super admins yet.</div>
                ) : (
                  (superAdmins ?? []).map((sa) => (
                    <div key={sa.user_id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{sa.email}</div>
                        <div className="text-xs text-muted-foreground">Granted {new Date(sa.granted_at).toLocaleDateString()}</div>
                      </div>
                      {sa.user_id === user?.id ? (
                        <Badge variant="secondary">You</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Revoke super admin from ${sa.email}?`)) revokeAdmin.mutate(sa.user_id);
                          }}
                          className="rounded-full"
                        >
                          <Trash2 className="size-4" /> Revoke
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
