import { forgetUser, emitUser, supabase } from "./cloud";
import { hasPending, stopSync, syncNow } from "./sync";

/** Sign out on this device. Waits briefly for unsent changes; the data stays on the device for that account. */
export async function signOutHere() {
  if (hasPending() && navigator.onLine) {
    await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 8000))]);
  }
  stopSync();
  // 1.5.53 (C1): an explicit sign-out must LOOK signed out — the provisional local
  // open steps aside for the rest of this app session (sessionStorage dies with it;
  // the next cold start opens the device's book again, which is the point of C1).
  try { sessionStorage.setItem("brizna.signed-out", "1"); } catch { /* ignore */ }
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* offline: clear locally */ }
  try { localStorage.removeItem("brizna-auth"); } catch { /* ignore */ }
  forgetUser();
  emitUser(null);
  location.replace(location.pathname);
}
