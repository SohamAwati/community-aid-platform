import { supabase } from "@/integrations/supabase/client";

const SUSPENDED_STORAGE_KEY = "vc_suspended_users";

export function getSuspendedUserIds(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(SUSPENDED_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function isUserSuspended(userId?: string | null): boolean {
  if (!userId) return false;
  return getSuspendedUserIds().has(userId);
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const current = getSuspendedUserIds();
  if (suspended) {
    current.add(userId);
  } else {
    current.delete(userId);
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(SUSPENDED_STORAGE_KEY, JSON.stringify(Array.from(current)));
    window.dispatchEvent(new CustomEvent("vc_suspension_change", { detail: { userId, suspended } }));
  }

  try {
    await supabase.from("profiles").update({
      is_suspended: suspended,
      status: suspended ? "suspended" : "active",
    } as any).eq("id", userId);
  } catch (err) {
    console.warn("Could not sync suspension to database profile:", err);
  }
}
