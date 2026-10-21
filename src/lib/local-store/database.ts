import {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_ID,
  INITIAL_USERS,
  INITIAL_PROFILES,
  INITIAL_USER_ROLES,
  INITIAL_NGOS,
  INITIAL_OPPORTUNITIES,
  INITIAL_BADGES,
  INITIAL_USER_BADGES,
  INITIAL_VOLUNTEER_STATS,
  INITIAL_APPLICATIONS,
  INITIAL_CERTIFICATES,
  INITIAL_REVIEWS,
  INITIAL_TEAMS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_SAVED,
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
} from "./seed-data";

export interface LocalSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: LocalUser;
}

export interface LocalUser {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
  email_confirmed_at: string;
}

type AuthCallback = (event: string, session: LocalSession | null) => void;
type ChannelCallback = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;

const STORAGE_KEY = "vc_local_database_v2";
const SESSION_KEY = "vc_local_session_v2";
const FILES_STORAGE_KEY = "vc_local_files_v2";
const IDB_NAME = "vc_file_storage_db";
const IDB_STORE = "files";

function openFileIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetFile(key: string): Promise<string | null> {
  const db = await openFileIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetFile(key: string, value: string): Promise<void> {
  const db = await openFileIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDeleteFile(key: string): Promise<void> {
  const db = await openFileIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllFiles(): Promise<Record<string, string>> {
  const db = await openFileIdb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      const result: Record<string, string> = {};
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          result[String(cursor.key)] = cursor.value;
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

export class LocalDatabaseEngine {
  private static instance: LocalDatabaseEngine;
  private tables: Record<string, Record<string, unknown>[]> = {};
  private authListeners: Set<AuthCallback> = new Set();
  private channelListeners: Map<string, Set<ChannelCallback>> = new Map();
  private currentSession: LocalSession | null = null;
  private files: Map<string, string> = new Map();

  private constructor() {
    this.init();
  }

  public static getInstance(): LocalDatabaseEngine {
    if (!LocalDatabaseEngine.instance) {
      LocalDatabaseEngine.instance = new LocalDatabaseEngine();
    }
    return LocalDatabaseEngine.instance;
  }

  private init() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.tables = JSON.parse(stored);
        } else {
          this.resetToSeed();
        }

        const storedSession = window.localStorage.getItem(SESSION_KEY);
        if (storedSession) {
          this.currentSession = JSON.parse(storedSession);
        }

        const storedFiles = window.localStorage.getItem(FILES_STORAGE_KEY);
        if (storedFiles) {
          const parsed = JSON.parse(storedFiles);
          this.files = new Map(Object.entries(parsed));
        }
        // Load files from IndexedDB asynchronously for robust large file storage
        this.loadFilesFromIdb();
      } catch (e) {
        console.warn("Failed to load local database from localStorage, initializing defaults", e);
        this.resetToSeed();
      }
    } else {
      this.resetToSeed();
    }

    // Always guarantee Super Admin exists
    this.ensureSuperAdmin();
    this.ensureDefaultCertificates();
  }

  private ensureSuperAdmin() {
    const users = this.tables["users"] || [];
    let sa = users.find((u) => String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    if (!sa) {
      const initialSA = INITIAL_USERS.find((u) => u.email === SUPER_ADMIN_EMAIL)!;
      users.push({ ...initialSA });
      this.tables["users"] = users;
    }

    const roles = this.tables["user_roles"] || [];
    if (!roles.some((r) => r.user_id === SUPER_ADMIN_ID && r.role === "super_admin")) {
      roles.push({
        id: "ur-sa",
        user_id: SUPER_ADMIN_ID,
        role: "super_admin",
        created_at: new Date().toISOString(),
      });
      this.tables["user_roles"] = roles;
    }

    const profs = this.tables["profiles"] || [];
    if (!profs.some((p) => p.id === SUPER_ADMIN_ID)) {
      const saProf = INITIAL_PROFILES.find((p) => p.id === SUPER_ADMIN_ID)!;
      profs.push({ ...saProf });
      this.tables["profiles"] = profs;
    }

    this.persist();
  }

  private ensureDefaultCertificates() {
    const certs = this.tables["certificates"] || [];
    let updatedCerts = false;
    for (const initCert of INITIAL_CERTIFICATES) {
      if (!certs.some((c) => c.id === initCert.id)) {
        certs.push({ ...initCert });
        updatedCerts = true;
      }
    }
    if (updatedCerts) {
      this.tables["certificates"] = certs;
    }

    const apps = this.tables["applications"] || [];
    let updatedApps = false;
    for (const initApp of INITIAL_APPLICATIONS) {
      if (!apps.some((a) => a.id === initApp.id)) {
        apps.push({ ...initApp });
        updatedApps = true;
      }
    }
    if (updatedApps) {
      this.tables["applications"] = apps;
    }

    if (updatedCerts || updatedApps) {
      this.persist();
    }
  }

  private resetToSeed() {
    this.tables = {
      users: [...INITIAL_USERS],
      profiles: [...INITIAL_PROFILES],
      user_roles: [...INITIAL_USER_ROLES],
      ngos: [...INITIAL_NGOS],
      opportunities: [...INITIAL_OPPORTUNITIES],
      badges: [...INITIAL_BADGES],
      user_badges: [...INITIAL_USER_BADGES],
      volunteer_stats: [...INITIAL_VOLUNTEER_STATS],
      applications: [...INITIAL_APPLICATIONS],
      certificates: [...INITIAL_CERTIFICATES],
      reviews: [...INITIAL_REVIEWS],
      teams: [...INITIAL_TEAMS],
      team_members: [...INITIAL_TEAM_MEMBERS],
      saved_opportunities: [...INITIAL_SAVED],
      notifications: [...INITIAL_NOTIFICATIONS],
      reports: [...INITIAL_REPORTS],
      opportunity_views: [],
    };
    this.persist();
  }

  private persist() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
        if (this.currentSession) {
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(this.currentSession));
        } else {
          window.localStorage.removeItem(SESSION_KEY);
        }
      } catch (e) {
        console.warn("Storage quota or localStorage error", e);
      }
    }
  }

  public getTable(name: string): Record<string, unknown>[] {
    if (!this.tables[name]) {
      this.tables[name] = [];
    }
    return this.tables[name];
  }

  public setTable(name: string, data: Record<string, unknown>[]) {
    this.tables[name] = data;
    this.persist();
  }

  // --- Auth API ---

  public async signUp(params: {
    email: string;
    password?: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }): Promise<{ data: { user: LocalUser | null; session: LocalSession | null }; error: Error | null }> {
    const email = params.email.trim().toLowerCase();
    const users = this.getTable("users");
    const existing = users.find((u) => String(u.email).toLowerCase() === email);

    if (existing) {
      // If user already exists, check password or sign them in
      if (params.password && existing.password === params.password) {
        return this.signInWithPassword({ email, password: params.password });
      }
      return {
        data: { user: null, session: null },
        error: new Error("An account with this email already exists. Please sign in."),
      };
    }

    const userId = "usr-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);
    const requestedRole = (params.options?.data?.requested_role as string) || "volunteer";
    const fullName = (params.options?.data?.full_name as string) || email.split("@")[0];
    const avatarUrl =
      (params.options?.data?.avatar_url as string) ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;

    const newUser: Record<string, unknown> = {
      id: userId,
      email,
      password: params.password || "password123",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
      role: requestedRole,
      user_metadata: {
        full_name: fullName,
        requested_role: requestedRole,
        avatar_url: avatarUrl,
      },
    };

    users.push(newUser);
    this.setTable("users", users);

    // Auto-create profile with complete applicant details
    const profiles = this.getTable("profiles");
    profiles.push({
      id: userId,
      full_name: fullName,
      avatar_url: avatarUrl,
      skills: (params.options?.data?.skills as string[]) || [],
      interests: (params.options?.data?.interests as string[]) || [],
      languages: ["English"],
      city: (params.options?.data?.city as string) || "Pune",
      state: (params.options?.data?.state as string) || "Maharashtra",
      country: (params.options?.data?.country as string) || "India",
      phone: (params.options?.data?.phone as string) || "",
      experience: (params.options?.data?.experience as string) || "",
      occupation_status: (params.options?.data?.occupation_status as string) || (requestedRole === "volunteer" ? "student" : "working"),
      organization: (params.options?.data?.organization as string) || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.setTable("profiles", profiles);

    // Assign role
    const roles = this.getTable("user_roles");
    roles.push({
      id: "ur-" + Math.random().toString(36).substring(2, 9),
      user_id: userId,
      role: requestedRole,
      created_at: new Date().toISOString(),
    });
    this.setTable("user_roles", roles);

    // Create volunteer stats
    const stats = this.getTable("volunteer_stats");
    stats.push({
      user_id: userId,
      total_hours: 0,
      completed_count: 0,
      xp: 0,
      level: 1,
      streak_days: 1,
      impact_score: 0,
      last_activity_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.setTable("volunteer_stats", stats);

    const sessionUser: LocalUser = {
      id: userId,
      email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: newUser.user_metadata as Record<string, unknown>,
      aud: "authenticated",
      created_at: newUser.created_at as string,
      email_confirmed_at: newUser.email_confirmed_at as string,
    };

    const session: LocalSession = {
      access_token: "mock-jwt-" + userId + "-" + Date.now(),
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      refresh_token: "mock-refresh-" + userId,
      user: sessionUser,
    };

    this.currentSession = session;
    this.persist();
    this.notifyAuthChange("SIGNED_IN", session);

    return {
      data: { user: sessionUser, session },
      error: null,
    };
  }

  public async signInWithPassword(params: {
    email: string;
    password?: string;
  }): Promise<{ data: { user: LocalUser | null; session: LocalSession | null }; error: Error | null }> {
    const email = params.email.trim().toLowerCase();
    const password = params.password || "";

    // Super Admin check
    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      if (password === SUPER_ADMIN_PASSWORD || password === "superadmin") {
        const saUser: LocalUser = {
          id: SUPER_ADMIN_ID,
          email: SUPER_ADMIN_EMAIL,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {
            full_name: "Vaishnavi Nimse",
            requested_role: "super_admin",
            avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop",
          },
          aud: "authenticated",
          created_at: "2026-01-01T00:00:00.000Z",
          email_confirmed_at: "2026-01-01T00:00:00.000Z",
        };

        const session: LocalSession = {
          access_token: "mock-jwt-sa-" + Date.now(),
          token_type: "bearer",
          expires_in: 3600 * 24 * 7,
          refresh_token: "mock-refresh-sa",
          user: saUser,
        };

        this.currentSession = session;
        this.persist();
        this.notifyAuthChange("SIGNED_IN", session);

        return { data: { user: saUser, session }, error: null };
      } else {
        return { data: { user: null, session: null }, error: new Error("Invalid login credentials") };
      }
    }

    const users = this.getTable("users");
    const found = users.find((u) => String(u.email).toLowerCase() === email);

    if (!found) {
      return { data: { user: null, session: null }, error: new Error("Invalid login credentials") };
    }

    if (found.password && found.password !== password) {
      return { data: { user: null, session: null }, error: new Error("Invalid login credentials") };
    }

    const sessionUser: LocalUser = {
      id: String(found.id),
      email: String(found.email),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: (found.user_metadata as Record<string, unknown>) || {},
      aud: "authenticated",
      created_at: String(found.created_at || new Date().toISOString()),
      email_confirmed_at: String(found.email_confirmed_at || new Date().toISOString()),
    };

    const session: LocalSession = {
      access_token: "mock-jwt-" + sessionUser.id + "-" + Date.now(),
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      refresh_token: "mock-refresh-" + sessionUser.id,
      user: sessionUser,
    };

    this.currentSession = session;
    this.persist();
    this.notifyAuthChange("SIGNED_IN", session);

    return { data: { user: sessionUser, session }, error: null };
  }

  public async signInWithOAuth(params: {
    provider: string;
    options?: { redirectTo?: string; skipBrowserRedirect?: boolean };
  }): Promise<{ data: { provider: string; url: string | null }; error: Error | null }> {
    // Quick demonstration / OAuth simulation - Vaishnavi Nimse
    const demoUser = INITIAL_USERS[0]; // Vaishnavi Nimse (Super Admin)
    const sessionUser: LocalUser = {
      id: demoUser.id,
      email: demoUser.email,
      app_metadata: { provider: params.provider, providers: [params.provider] },
      user_metadata: demoUser.user_metadata,
      aud: "authenticated",
      created_at: demoUser.created_at,
      email_confirmed_at: demoUser.email_confirmed_at,
    };

    const session: LocalSession = {
      access_token: "mock-oauth-" + params.provider + "-" + Date.now(),
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      refresh_token: "mock-refresh-oauth",
      user: sessionUser,
    };

    this.currentSession = session;
    this.persist();
    this.notifyAuthChange("SIGNED_IN", session);

    return {
      data: { provider: params.provider, url: params.options?.redirectTo || "/admin" },
      error: null,
    };
  }

  public async signOut(): Promise<{ error: Error | null }> {
    this.currentSession = null;
    this.persist();
    this.notifyAuthChange("SIGNED_OUT", null);
    return { error: null };
  }

  public async getSession(): Promise<{ data: { session: LocalSession | null }; error: Error | null }> {
    return { data: { session: this.currentSession }, error: null };
  }

  public async getUser(): Promise<{ data: { user: LocalUser | null }; error: Error | null }> {
    return { data: { user: this.currentSession?.user ?? null }, error: null };
  }

  public onAuthStateChange(callback: AuthCallback): { data: { subscription: { unsubscribe: () => void } } } {
    this.authListeners.add(callback);
    // Initial emission
    if (this.currentSession) {
      setTimeout(() => callback("INITIAL_SESSION", this.currentSession), 0);
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.authListeners.delete(callback);
          },
        },
      },
    };
  }

  public async resetPasswordForEmail(_email: string): Promise<{ data: Record<string, unknown>; error: Error | null }> {
    return { data: {}, error: null };
  }

  public async updateUser(attributes: {
    password?: string;
    data?: Record<string, unknown>;
  }): Promise<{ data: { user: LocalUser | null }; error: Error | null }> {
    if (!this.currentSession) {
      return { data: { user: null }, error: new Error("User not signed in") };
    }
    const uid = this.currentSession.user.id;
    const users = this.getTable("users");
    const u = users.find((x) => x.id === uid);
    if (u) {
      if (attributes.password) u.password = attributes.password;
      if (attributes.data) {
        u.user_metadata = { ...(u.user_metadata as Record<string, unknown>), ...attributes.data };
        this.currentSession.user.user_metadata = u.user_metadata as Record<string, unknown>;
      }
      this.setTable("users", users);
      this.persist();
    }
    return { data: { user: this.currentSession.user }, error: null };
  }

  public async setSession(session: LocalSession | null): Promise<{ data: { session: LocalSession | null }; error: Error | null }> {
    this.currentSession = session;
    this.persist();
    this.notifyAuthChange("TOKEN_REFRESHED", session);
    return { data: { session }, error: null };
  }

  private notifyAuthChange(event: string, session: LocalSession | null) {
    for (const listener of this.authListeners) {
      try {
        listener(event, session);
      } catch (err) {
        console.error("Auth listener error", err);
      }
    }
  }

  // --- Realtime Channels ---

  public createChannel(name: string) {
    const self = this;
    const channelCallbacks: ChannelCallback[] = [];

    const channelObj = {
      name,
      on: (
        _type: string,
        _filter: Record<string, unknown>,
        callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void
      ) => {
        channelCallbacks.push(callback);
        return channelObj;
      },
      subscribe: () => {
        let set = self.channelListeners.get(name);
        if (!set) {
          set = new Set();
          self.channelListeners.set(name, set);
        }
        for (const cb of channelCallbacks) {
          set.add(cb);
        }
        return channelObj;
      },
    };

    return channelObj;
  }

  public removeChannel(channel: { name: string }) {
    this.channelListeners.delete(channel.name);
  }

  public emitChange(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", record: Record<string, unknown>) {
    for (const [, set] of this.channelListeners) {
      for (const cb of set) {
        try {
          cb({ eventType, new: record, old: record });
        } catch (e) {
          console.error("Channel callback error", e);
        }
      }
    }
  }

  private async loadFilesFromIdb() {
    if (typeof window === "undefined" || !window.indexedDB) return;
    try {
      const all = await idbGetAllFiles();
      for (const [k, v] of Object.entries(all)) {
        this.files.set(k, v);
      }
    } catch (e) {
      console.warn("Failed to load files from IndexedDB", e);
    }
  }

  private persistFiles() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const obj = Object.fromEntries(this.files.entries());
        window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(obj));
      } catch (e) {
        console.warn("Storage quota warning for files, relying on IndexedDB", e);
      }
    }
  }

  // --- Storage API ---

  public storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: File | Blob | string, _opts?: { upsert?: boolean }) => {
        try {
          let content = "";
          if (typeof file === "string") {
            content = file;
          } else if (file instanceof Blob) {
            content = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          }
          const cleanPath = path.replace(/^\/+/, "");
          const withoutBucket = cleanPath.replace(new RegExp(`^${bucket}/`), "");

          this.files.set(`${bucket}:${path}`, content);
          this.files.set(path, content);
          this.files.set(`${bucket}:${cleanPath}`, content);
          this.files.set(cleanPath, content);
          this.files.set(`${bucket}:${withoutBucket}`, content);
          this.files.set(withoutBucket, content);

          this.persistFiles();

          await Promise.all([
            idbSetFile(`${bucket}:${path}`, content),
            idbSetFile(path, content),
            idbSetFile(`${bucket}:${cleanPath}`, content),
            idbSetFile(cleanPath, content),
            idbSetFile(`${bucket}:${withoutBucket}`, content),
            idbSetFile(withoutBucket, content),
          ]);

          return { data: { path }, error: null };
        } catch (e) {
          return { data: null, error: e as Error };
        }
      },
      remove: async (paths: string[]) => {
        for (const p of paths) {
          const cleanPath = p.replace(/^\/+/, "");
          const withoutBucket = cleanPath.replace(new RegExp(`^${bucket}/`), "");
          this.files.delete(`${bucket}:${p}`);
          this.files.delete(p);
          this.files.delete(`${bucket}:${cleanPath}`);
          this.files.delete(cleanPath);
          this.files.delete(`${bucket}:${withoutBucket}`);
          this.files.delete(withoutBucket);
          void idbDeleteFile(`${bucket}:${p}`);
          void idbDeleteFile(p);
          void idbDeleteFile(`${bucket}:${cleanPath}`);
          void idbDeleteFile(cleanPath);
          void idbDeleteFile(`${bucket}:${withoutBucket}`);
          void idbDeleteFile(withoutBucket);
        }
        this.persistFiles();
        return { data: paths, error: null };
      },
      createSignedUrl: async (path: string, _expiresIn: number, _opts?: { download?: boolean }) => {
        if (!path) {
          return { data: null, error: new Error("File path is required") };
        }
        if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:")) {
          return { data: { signedUrl: path }, error: null };
        }

        const cleanPath = path.replace(/^\/+/, "");
        const withoutBucket = cleanPath.replace(new RegExp(`^${bucket}/`), "");

        let url =
          this.files.get(`${bucket}:${path}`) ||
          this.files.get(path) ||
          this.files.get(`${bucket}:${cleanPath}`) ||
          this.files.get(cleanPath) ||
          this.files.get(`${bucket}:${withoutBucket}`) ||
          this.files.get(withoutBucket);

        if (!url && typeof window !== "undefined") {
          url =
            (await idbGetFile(`${bucket}:${path}`)) ||
            (await idbGetFile(path)) ||
            (await idbGetFile(`${bucket}:${cleanPath}`)) ||
            (await idbGetFile(cleanPath)) ||
            (await idbGetFile(`${bucket}:${withoutBucket}`)) ||
            (await idbGetFile(withoutBucket)) ||
            undefined;

          if (url) {
            this.files.set(`${bucket}:${path}`, url);
            this.files.set(path, url);
            this.files.set(cleanPath, url);
            this.files.set(withoutBucket, url);
          }
        }

        // Fuzzy match if needed
        if (!url) {
          for (const [k, v] of this.files.entries()) {
            if (k.endsWith(withoutBucket) || (withoutBucket && k.includes(withoutBucket))) {
              url = v;
              break;
            }
          }
        }

        if (url) {
          return { data: { signedUrl: url }, error: null };
        }

        // Fallback placeholder verified certificate data-URI
        const fallbackSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="550" viewBox="0 0 800 550"><rect width="800" height="550" fill="#f8fafc" stroke="#2563eb" stroke-width="8"/><text x="400" y="140" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1e3a8a" text-anchor="middle">VOLUNTEER CONNECT</text><text x="400" y="190" font-family="Arial, sans-serif" font-size="20" fill="#64748b" text-anchor="middle">OFFICIAL PARTICIPATION CERTIFICATE</text><text x="400" y="290" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a" text-anchor="middle">COMMUNITY CIVIC SERVICE AWARD</text><text x="400" y="340" font-family="Arial, sans-serif" font-size="16" fill="#475569" text-anchor="middle">Awarded in recognition of active volunteering and dedication.</text><text x="400" y="470" font-family="Arial, sans-serif" font-size="14" fill="#16a34a" font-weight="bold" text-anchor="middle">&#10003; Verified by Host NGO</text></svg>`
        )}`;
        return { data: { signedUrl: fallbackSvg }, error: null };
      },
      getPublicUrl: (path: string) => {
        const cleanPath = path.replace(/^\/+/, "");
        const withoutBucket = cleanPath.replace(new RegExp(`^${bucket}/`), "");
        const url =
          this.files.get(`${bucket}:${path}`) ||
          this.files.get(path) ||
          this.files.get(`${bucket}:${cleanPath}`) ||
          this.files.get(cleanPath) ||
          this.files.get(`${bucket}:${withoutBucket}`) ||
          this.files.get(withoutBucket) ||
          `https://volunteer-connect.local/storage/${bucket}/${cleanPath}`;
        return { data: { publicUrl: url } };
      },
    }),
  };

  // --- RPC Methods ---

  public async rpc(
    name: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: unknown; error: Error | null }> {
    const currentUserId = this.currentSession?.user?.id;

    switch (name) {
      case "list_super_admins": {
        const roles = this.getTable("user_roles");
        const users = this.getTable("users");
        const saRoles = roles.filter((r) => r.role === "super_admin");
        const result = saRoles.map((r) => {
          const u = users.find((x) => x.id === r.user_id);
          return {
            user_id: r.user_id,
            email: u?.email || "unknown@admin.org",
            granted_at: r.created_at,
          };
        });
        return { data: result, error: null };
      }

      case "grant_super_admin_by_email": {
        const email = String(params._email || "").trim().toLowerCase();
        const users = this.getTable("users");
        const u = users.find((x) => String(x.email).toLowerCase() === email);
        if (!u) {
          return { data: null, error: new Error(`No user found with email ${email}`) };
        }
        const roles = this.getTable("user_roles");
        if (!roles.some((r) => r.user_id === u.id && r.role === "super_admin")) {
          roles.push({
            id: "ur-" + Math.random().toString(36).substring(2, 9),
            user_id: u.id,
            role: "super_admin",
            created_at: new Date().toISOString(),
          });
          this.setTable("user_roles", roles);
        }
        return { data: u.id, error: null };
      }

      case "revoke_super_admin": {
        const targetUserId = String(params._user_id || "");
        if (targetUserId === currentUserId) {
          return { data: null, error: new Error("You cannot revoke your own super admin role") };
        }
        const roles = this.getTable("user_roles");
        const filtered = roles.filter((r) => !(r.user_id === targetUserId && r.role === "super_admin"));
        this.setTable("user_roles", filtered);
        return { data: null, error: null };
      }

      case "verify_certificate": {
        const code = String(params._code || "").trim().toUpperCase();
        const certs = this.getTable("certificates");
        const opps = this.getTable("opportunities");
        const ngos = this.getTable("ngos");
        const profiles = this.getTable("profiles");

        const foundCert = certs.find((c) => String(c.code).toUpperCase() === code);
        if (!foundCert) {
          return { data: [], error: null };
        }

        const opp = opps.find((o) => o.id === foundCert.opportunity_id);
        const ngo = opp ? ngos.find((n) => n.id === opp.ngo_id) : null;
        const prof = profiles.find((p) => p.id === foundCert.volunteer_id);

        return {
          data: [
            {
              code: foundCert.code,
              hours: foundCert.hours,
              issued_at: foundCert.issued_at,
              volunteer_name: prof?.full_name || "Volunteer",
              opportunity_title: opp?.title || "Community Volunteering Opportunity",
              ngo_name: ngo?.name || "Verified NGO Partner",
            },
          ],
          error: null,
        };
      }

      case "get_applicant_emails": {
        const oppId = String(params._opp_id || "");
        const apps = this.getTable("applications").filter((a) => a.opportunity_id === oppId);
        const users = this.getTable("users");
        const result = apps.map((a) => {
          const u = users.find((x) => x.id === a.volunteer_id);
          return {
            volunteer_id: a.volunteer_id,
            email: u?.email || "volunteer@community.org",
          };
        });
        return { data: result, error: null };
      }

      case "get_profiles_private": {
        const ids = (params._ids as string[]) || [];
        const profiles = this.getTable("profiles");
        const result = profiles
          .filter((p) => ids.includes(p.id as string))
          .map((p) => ({
            id: p.id,
            city: p.city || "Pune",
            state: p.state || "Maharashtra",
            country: p.country || "India",
            phone: p.phone || "+91 98765 00000",
            occupation_status: p.occupation_status || "Volunteer",
            organization: p.organization || "Independent",
            experience: p.experience || "Active community helper",
          }));
        return { data: result, error: null };
      }

      case "award_completion": {
        const appId = String(params._application_id || "");
        const apps = this.getTable("applications");
        const app = apps.find((a) => a.id === appId);
        if (!app) return { data: null, error: new Error("Application not found") };

        const opps = this.getTable("opportunities");
        const opp = opps.find((o) => o.id === app.opportunity_id);
        const hours = (app.hours_logged as number) || (opp?.hours_estimate as number) || 4;

        app.status = "completed";
        app.completed_at = new Date().toISOString();
        app.hours_logged = hours;
        this.setTable("applications", apps);

        // Update stats
        const stats = this.getTable("volunteer_stats");
        let vStat = stats.find((s) => s.user_id === app.volunteer_id);
        if (!vStat) {
          vStat = {
            user_id: app.volunteer_id,
            total_hours: 0,
            completed_count: 0,
            xp: 0,
            level: 1,
            streak_days: 1,
            impact_score: 0,
            last_activity_at: new Date().toISOString(),
          };
          stats.push(vStat);
        }
        vStat.total_hours = ((vStat.total_hours as number) || 0) + hours;
        vStat.completed_count = ((vStat.completed_count as number) || 0) + 1;
        vStat.xp = ((vStat.xp as number) || 0) + hours * 10;
        vStat.level = Math.max(1, Math.floor(((vStat.xp as number) || 0) / 100) + 1);
        vStat.streak_days = ((vStat.streak_days as number) || 0) + 1;
        vStat.impact_score = ((vStat.impact_score as number) || 0) + hours * 5;
        vStat.last_activity_at = new Date().toISOString();
        this.setTable("volunteer_stats", stats);

        // Issue certificate
        const certs = this.getTable("certificates");
        const existingCert = certs.find(
          (c) => c.volunteer_id === app.volunteer_id && c.opportunity_id === app.opportunity_id
        );
        if (!existingCert) {
          certs.push({
            id: "cert-" + Math.random().toString(36).substring(2, 9),
            volunteer_id: app.volunteer_id,
            opportunity_id: app.opportunity_id,
            hours,
            code: "VC-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
            issued_at: new Date().toISOString(),
          });
          this.setTable("certificates", certs);
        }

        // Award first_completion badge if not already
        const badges = this.getTable("badges");
        const userBadges = this.getTable("user_badges");
        const compBadge = badges.find((b) => b.code === "first_completion");
        if (compBadge && !userBadges.some((ub) => ub.user_id === app.volunteer_id && ub.badge_id === compBadge.id)) {
          userBadges.push({
            user_id: app.volunteer_id,
            badge_id: compBadge.id,
            earned_at: new Date().toISOString(),
          });
          this.setTable("user_badges", userBadges);
        }

        return { data: null, error: null };
      }

      case "set_my_role": {
        const role = String(params._role || "volunteer");
        if (!currentUserId) return { data: null, error: new Error("Not signed in") };
        const roles = this.getTable("user_roles");
        const found = roles.find((r) => r.user_id === currentUserId);
        if (found) {
          found.role = role;
        } else {
          roles.push({
            id: "ur-" + Math.random().toString(36).substring(2, 9),
            user_id: currentUserId,
            role,
            created_at: new Date().toISOString(),
          });
        }
        this.setTable("user_roles", roles);
        return { data: null, error: null };
      }

      case "application_availability": {
        const oppId = String(params._opportunity_id || "");
        const opp = this.getTable("opportunities").find((o) => o.id === oppId);
        const slots = (opp?.slots as number) || 50;
        const apps = this.getTable("applications").filter(
          (a) => a.opportunity_id === oppId && ["pending", "accepted", "completed"].includes(String(a.status))
        );
        const remaining = Math.max(0, slots - apps.length);
        return { data: [{ remaining }], error: null };
      }

      case "list_my_reports": {
        const reports = this.getTable("reports");
        const sa = this.isSuperAdmin(currentUserId);
        const result = sa ? reports : reports.filter((r) => r.reporter_id === currentUserId);
        return { data: result, error: null };
      }

      case "submit_report": {
        if (!currentUserId) return { data: null, error: new Error("Must be signed in to submit report") };
        const repId = "rep-" + Math.random().toString(36).substring(2, 9);
        const reports = this.getTable("reports");
        const newRep = {
          id: repId,
          reporter_id: currentUserId,
          subject: String(params._subject || "").trim(),
          details: String(params._details || "").trim(),
          status: "pending",
          resolution: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
        };
        reports.unshift(newRep);
        this.setTable("reports", reports);
        return { data: repId, error: null };
      }

      case "review_report": {
        const repId = String(params._id || "");
        const status = String(params._status || "");
        const resolution = String(params._resolution || "");
        const reports = this.getTable("reports");
        const r = reports.find((x) => x.id === repId);
        if (!r) return { data: null, error: new Error("Report not found") };
        r.status = status;
        r.resolution = resolution;
        r.reviewed_by = currentUserId;
        r.reviewed_at = new Date().toISOString();
        this.setTable("reports", reports);
        return { data: null, error: null };
      }

      default:
        console.warn(`Local RPC called for unknown function: ${name}`, params);
        return { data: null, error: null };
    }
  }

  private isSuperAdmin(userId?: string): boolean {
    if (!userId) return false;
    const roles = this.getTable("user_roles");
    return roles.some((r) => r.user_id === userId && r.role === "super_admin");
  }
}
