import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sprout, Menu, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { NotificationMenu } from "@/components/notification-menu";

export function SiteHeader() {
  const { user, isNgoAdmin, isSuperAdmin, loading } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Volunteer Connect</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {isNgoAdmin && !isSuperAdmin ? (
            <Link to="/ngo/opportunities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Manage Opportunities</Link>
          ) : (
            <Link to="/opportunities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Opportunities</Link>
          )}
          {user && !isNgoAdmin && (
            <Link to="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Leaderboard</Link>
          )}
          <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link to="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            className="rounded-full"
          >
            {resolvedTheme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-muted-foreground" />}
          </Button>

          {user && <NotificationMenu userId={user.id} />}
          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <span className="max-w-[10rem] truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/dashboard">Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/profile">Profile</Link></DropdownMenuItem>
                {!isNgoAdmin && <DropdownMenuItem asChild><Link to="/volunteers/$id" params={{ id: user.id }}>My portfolio</Link></DropdownMenuItem>}
                {!isNgoAdmin && <DropdownMenuItem asChild><Link to="/volunteer/certificates">My certificates</Link></DropdownMenuItem>}
                {!isNgoAdmin && <DropdownMenuItem asChild><Link to="/teams">Teams</Link></DropdownMenuItem>}
                {!isNgoAdmin && <DropdownMenuItem asChild><Link to="/leaderboard">Leaderboard</Link></DropdownMenuItem>}
                {isNgoAdmin && <DropdownMenuItem asChild><Link to="/ngo/opportunities">Manage opportunities</Link></DropdownMenuItem>}
                {isNgoAdmin && <DropdownMenuItem asChild><Link to="/ngo/profile">NGO profile & settings</Link></DropdownMenuItem>}
                {isSuperAdmin && <DropdownMenuItem asChild><Link to="/admin">Admin panel</Link></DropdownMenuItem>}
                <DropdownMenuItem asChild><Link to="/reports">Reports</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/auth" search={{ mode: "signup" } as never}>Join</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {isNgoAdmin && !isSuperAdmin ? (
              <Link to="/ngo/opportunities" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">Manage Opportunities</Link>
            ) : (
              <Link to="/opportunities" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">Opportunities</Link>
            )}
            {user && !isNgoAdmin && (
              <Link to="/leaderboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">Leaderboard</Link>
            )}
            <Link to="/about" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">About</Link>
            <Link to="/faq" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">FAQ</Link>
            <Link to="/contact" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">Contact</Link>
          </div>
        </div>
      )}
    </header>
  );
}
