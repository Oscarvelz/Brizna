import { createClient, type Session } from "@supabase/supabase-js";
import { CLOUD_READY, SUPABASE_KEY, SUPABASE_URL } from "./config";
export { CLOUD_READY };
const LAST = "brizna.lastUser";

/** "Mantener sesión abierta": on (default) = the session lives on this device until you sign out;
 *  off = it lives only while the app is open (sessionStorage), so you sign in each time. */
const KEEP = "brizna.keep";
export function keepSignedIn(): boolean {
  try { return localStorage.getItem(KEEP) !== "0"; } catch { return true; }
}
export function setKeepSignedIn(on: boolean) {
  try {
    localStorage.setItem(KEEP, on ? "1" : "0");
    if (!on) { localStorage.removeItem(LAST); }
  } catch { /* ignore */ }
}
function box(): Storage {
  return keepSignedIn() ? localStorage : sessionStorage;
}
const authStorage = {
  getItem: (k: string) => { try { return box().getItem(k) ; } catch { return null; } },
  setItem: (k: string, v: string) => {
    try {
      box().setItem(k, v);
      (keepSignedIn() ? sessionStorage : localStorage).removeItem(k);
    } catch { /* ignore */ }
  },
  removeItem: (k: string) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "brizna-auth", storage: authStorage },
});

export type BriznaUser = { id: string; email: string; name: string };

/* 1.5.53 (auditoría interna, C1 — Oscar's rule): a device that already holds a book
 * opens it without a session; the account reconciles when the network returns, and
 * the sync's first pass OBSERVES both sides before it writes anything. A local-only
 * user is the book's owner, admitted provisionally: no sync starts for them, Ajustes
 * offers "Entrar de nuevo" (sessionGone), and the device lock still guards the door.
 * A real session (rememberUser) ends the provisional state. */
let localOnly = false;
export function isLocalOnly() { return localOnly; }
export function emitLocalUser(u: BriznaUser) {
  localOnly = true;
  emitUser(u);
}

export function rememberUser(s: Session | null): BriznaUser | null {
  if (!s?.user) return null;
  localOnly = false;
  const meta = s.user.user_metadata ?? {};
  const u: BriznaUser = {
    id: s.user.id,
    email: s.user.email ?? "",
    name: (meta.name as string | undefined) || (meta.full_name as string | undefined) || "",
  };
  try { box().setItem(LAST, JSON.stringify(u)); } catch { /* ignore */ }
  return u;
}

/** The last signed-in user on this device: lets Brizna open with no internet. */
export function lastUser(): BriznaUser | null {
  try {
    const u = JSON.parse(box().getItem(LAST) || "null") as BriznaUser | null;
    return u && typeof u.id === "string" ? u : null;
  } catch {
    return null;
  }
}

export function forgetUser() {
  localOnly = false;
  try { localStorage.removeItem(LAST); sessionStorage.removeItem(LAST); } catch { /* ignore */ }
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

/** Kept signed in but the cloud session ended (password changed, etc.): the app stays open with
 *  the data on this device; Ajustes offers "Entrar de nuevo" to resume syncing. */
let gone = false;
export function sessionGone() { return gone; }
export function setSessionGone(v: boolean) {
  if (gone === v) return;
  gone = v;
  try { window.dispatchEvent(new Event("brizna-session")); } catch { /* ignore */ }
}
export function askSignInAgain() {
  try { window.dispatchEvent(new Event("brizna-relogin")); } catch { /* ignore */ }
}
