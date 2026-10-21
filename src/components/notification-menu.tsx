import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function NotificationMenu({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications", userId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`realtime-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
          const newNotif = payload.new as { title?: string; body?: string };
          if (newNotif?.title) {
            toast.info(newNotif.title, {
              description: newNotif.body,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const markRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
    if (error) { toast.error("Could not mark notification as read"); return; }
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} title="Notifications" className="relative"><Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" />}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-96 w-80 max-w-[90vw] overflow-y-auto">
      <DropdownMenuLabel>Notifications</DropdownMenuLabel>
      {notifications.isError ? <p className="p-3 text-sm text-destructive">Could not load notifications</p> : notifications.isPending ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : !notifications.data?.length ? <p className="p-3 text-sm text-muted-foreground">No notifications yet</p> : notifications.data.map((n) => <DropdownMenuItem key={n.id} asChild><Link to="/volunteer/applications" onClick={() => void markRead(n.id)} className="block space-y-1 whitespace-normal"><span className={n.read ? "text-muted-foreground" : "font-semibold"}>{n.title}</span><span className="block break-words text-xs text-muted-foreground">{n.body}</span></Link></DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}