import { LocalDatabaseEngine } from "@/lib/local-store/database";
import { LocalQueryBuilder } from "@/lib/local-store/query-builder";

// Local database client replacing remote Supabase cloud client
// Completely self-contained, offline-capable, with instant signup and Super Admin preservation.

function createLocalClient() {
  const engine = LocalDatabaseEngine.getInstance();

  return {
    from: (tableName: string) => new LocalQueryBuilder(tableName),

    auth: {
      signUp: (params: {
        email: string;
        password?: string;
        options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
      }) => engine.signUp(params),

      signInWithPassword: (params: { email: string; password?: string }) =>
        engine.signInWithPassword(params),

      signInWithOAuth: (params: {
        provider: "google" | "apple" | "microsoft" | string;
        options?: { redirectTo?: string; skipBrowserRedirect?: boolean };
      }) => engine.signInWithOAuth(params),

      signOut: () => engine.signOut(),

      getSession: () => engine.getSession(),

      getUser: () => engine.getUser(),

      onAuthStateChange: (
        callback: (event: string, session: any) => void
      ) => engine.onAuthStateChange(callback),

      resetPasswordForEmail: (email: string) => engine.resetPasswordForEmail(email),

      updateUser: (attributes: { password?: string; data?: Record<string, unknown> }) =>
        engine.updateUser(attributes),

      setSession: (session: any) => engine.setSession(session),
    },

    rpc: (name: string, params?: Record<string, unknown>) => engine.rpc(name, params),

    storage: engine.storage,

    channel: (name: string) => engine.createChannel(name),

    removeChannel: (channel: any) => engine.removeChannel(channel),
  };
}

export const supabase = createLocalClient() as any;
