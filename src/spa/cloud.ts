import { createClient, type Session } from "@supabase/supabase-js";
import { CLOUD_READY, SUPABASE_KEY, SUPABASE_URL } from "./config";
export { CLOUD_READY };

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "brizna-auth" },
});

export type BriznaUser = { id: string; email: string; name: string };
const LAST = "brizna.lastUser";

export function rememberUser(s: Session | null): BriznaUser | null {
  if (!s?.user) return null;
  const meta = s.user.user_metadata ?? {};
  const u: BriznaUser = {
    id: s.user.id,
    email: s.user.email ?? "",
    name: (meta.name as string | undefined) || (meta.full_name as string | undefined) || "",
  };
  try { localStorage.setItem(LAST, JSON.stringify(u)); } catch { /* ignore */ }
  return u;
}

/** The last signed-in user on this device: lets Brizna open with no internet. */
export function lastUser(): BriznaUser | null {
  try {
    const u = JSON.parse(localStorage.getItem(LAST) || "null") as BriznaUser | null;
    return u && typeof u.id === "string" ? u : null;
  } catch {
    return null;
  }
}

export function forgetUser() {
  try { localStorage.removeItem(LAST); } catch { /* ignore */ }
}

let current: BriznaUser | null = null;
let listeners: ((u: BriznaUser | null) => void)[] = [];
export function getUser() { return current; }
export function onUser(fn: (u: BriznaUser | null) => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}
export function emitUser(u: BriznaUser | null) {
  current = u;
  listeners.forEach((f) => f(u));
}
