import { forgetUser, emitUser, supabase } from "./cloud";
import { hasPending, stopSync, syncNow } from "./sync";

/** Sign out on this device. Waits briefly for unsent changes; the data stays on the device for that account. */
export async function signOutHere() {
  if (hasPending() && navigator.onLine) {
    await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 8000))]);
  }
  stopSync();
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* offline: clear locally */ }
  try { localStorage.removeItem("brizna-auth"); } catch { /* ignore */ }
  forgetUser();
  emitUser(null);
  location.replace(location.pathname);
}
