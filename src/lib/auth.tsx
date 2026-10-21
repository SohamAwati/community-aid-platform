import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "volunteer" | "ngo_admin" | "super_admin";

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isVolunteer: boolean;
  isNgoAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  roles: [],
  loading: true,
  isVolunteer: false,
  isNgoAdmin: false,
  isSuperAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let request = 0;
    const syncSession = (nextSession: Session | null) => {
      const currentRequest = ++request;
      setSession(nextSession);
      setRoles([]);
      setLoading(!!nextSession);
      if (!nextSession) return;
      // Defer database calls outside the auth callback to avoid a deadlock.
      setTimeout(async () => {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id);
        if (!mounted || currentRequest !== request) return;
        if (error) console.error("Account permissions could not be loaded", error.message);
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setLoading(false);
      }, 0);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted || event === "TOKEN_REFRESHED") return;
      syncSession(nextSession);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && request === 0) syncSession(data.session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  return (
    <AuthCtx.Provider
      value={{
        session,
        user,
        roles,
        loading,
        isVolunteer: roles.includes("volunteer"),
        isNgoAdmin: roles.includes("ngo_admin"),
        isSuperAdmin: roles.includes("super_admin"),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
