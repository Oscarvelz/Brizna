import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import "@/styles.css";
import "@/alive.css";
import "@/night.css";
import "@/sky.css";
import "@/weather-sky.css";
import "@/cifras.css";
import { restoreSky } from "@/lib/weather-sky";
restoreSky();
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/theme";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "@/routeTree.gen";
import { setPaneRouteTree } from "@/lib/pane-context";
import { getPglite, getSql, setDbUser } from "@/lib/db";
import { I18nProvider } from "@/lib/i18n";
import { lockDue, markSeen, unlock } from "@/lib/device-lock";
import { saveBackupNow } from "@/lib/server/lawn";
import { CLOUD_READY, emitUser, keepSignedIn, setSessionGone, getUser, lastUser, onUser, rememberUser, supabase, type BriznaUser } from "@/spa/cloud";
import { setKeepCopy, startSync } from "@/spa/sync";
import { signOutHere } from "@/spa/session";
import { Locked, Login, Splash } from "@/spa/login";
import { warmPglite } from "@/spa/pg-warm";

// Tiny Buffer stand-in for the two report exports that used Node's Buffer.
const g = globalThis as any;
if (!g.Buffer) {
  g.Buffer = {
    from(input: Uint8Array | string, enc?: string) {
      const bytes = typeof input === "string"
        ? (enc === "base64" ? Uint8Array.from(atob(input), (c) => c.charCodeAt(0)) : new TextEncoder().encode(input))
        : input;
      return {
        toString(out?: string) {
          if (out === "base64") {
            let s = "";
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return btoa(s);
          }
          return new TextDecoder().decode(bytes);
        },
      };
    },
  };
}

try { new Function(APPEARANCE_BOOT_SCRIPT)(); } catch { /* look defaults */ }

setPaneRouteTree(routeTree);

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: AppErrorComponent,
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

const root = createRoot(document.getElementById("root")!);

let openedFor: string | null = null;

function useUser(): BriznaUser | null {
  const [u, setU] = useState<BriznaUser | null>(getUser());
  useEffect(() => onUser(setU), []);
  return u;
}

function Gate() {
  const user = useUser();
  const [booted, setBooted] = useState(false);
  const [recovery, setRecovery] = useState(() => /type=recovery/.test(location.hash));
  const [expiredRaw, setExpired] = useState(false);
  const [relogin, setRelogin] = useState(false);
  // "Mantener sesión abierta": an ended cloud session doesn't block the app; Ajustes offers to sign in again.
  const softExpired = expiredRaw && keepSignedIn() && !relogin;
  const expired = expiredRaw && !softExpired;
  useEffect(() => { setSessionGone(expiredRaw); }, [expiredRaw]);
  useEffect(() => {
    const go = () => setRelogin(true);
    window.addEventListener("brizna-relogin", go);
    return () => window.removeEventListener("brizna-relogin", go);
  }, []);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const hiddenAt = useRef(0);
  const tried = useRef("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (session) { setExpired(false); setRelogin(false); emitUser(rememberUser(session)); }
    });
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (data.session) emitUser(rememberUser(data.session));
        else if (!error && lastUser() && navigator.onLine) setExpired(true);
      } catch { /* offline: keep the remembered user */ }
      setBooted(true);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setOpen(false); return; }
    setOpen(!lockDue(user.id));
    const onVis = () => {
      if (document.visibilityState === "hidden") return;
      if (lockDue(user.id)) { tried.current = ""; setFailed(false); setOpen(false); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user]);

  // While Brizna is open and unlocked, keep stamping "seen" so a short trip to another app never asks.
  useEffect(() => {
    if (!user || !open) return;
    const uid = user.id;
    markSeen(uid);
    const stamp = () => { if (document.visibilityState === "hidden") markSeen(uid); };
    const t = window.setInterval(() => { if (document.visibilityState === "visible") markSeen(uid); }, 20_000);
    document.addEventListener("visibilitychange", stamp);
    window.addEventListener("pagehide", stamp);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", stamp); window.removeEventListener("pagehide", stamp); };
  }, [user, open]);

  const tryUnlock = async () => {
    if (!user) return;
    setFailed(false);
    try { if (await unlock(user.id)) { markSeen(user.id); setOpen(true); } else setFailed(true); } catch { setFailed(true); }
  };
  useEffect(() => {
    if (user && !open && booted && tried.current !== user.id && lockDue(user.id)) { tried.current = user.id; void tryUnlock(); }
  });

  // Another account signed in on top of an open one: start clean with that account's data.
  if (user && openedFor && openedFor !== user.id) { location.reload(); return <Splash />; }

  if (!booted && !user) return <Splash />;
  if (recovery) return <Login recovery />;
  if (!user || expired) {
    return <Login note={expired ? "Tu sesión venció. Entra de nuevo para sincronizar; tus datos siguen en este equipo. / Your session expired: sign in again to sync." : undefined} />;
  }
  if (!open) return <Locked failed={failed} onOpen={() => void tryUnlock()} onSignOut={() => void signOutHere()} />;
  // The early-opened database belongs to someone else: reload so this account opens its own.
  if (preopenedFor && preopenedFor !== user.id) { location.reload(); return <Splash />; }
  if (openedFor !== user.id) {
    openedFor = user.id;
    setDbUser(user.id);
    void getSql();
    setKeepCopy(() => saveBackupNow());
    startSync(user.id);
  }
  return <RouterProvider router={router} />;
}

// Database opened early (before sign-in checks finish) for the account last used here.
let preopenedFor: string | null = null;

function start() {
  void warmPglite();
  if (CLOUD_READY) {
    const last = lastUser();
    if (last) {
      preopenedFor = last.id;
      setDbUser(last.id);
      void getSql().catch(() => undefined);
    }
  }
  if (!CLOUD_READY) {
    emitUser({ id: "local", email: "", name: "Local" }); // local test copy: no accounts
    (globalThis as any).__bzSql = getSql; (globalThis as any).__bzPg = getPglite; // local test copy only (127.0.0.1): lets tests seed and check figures
    const wait = Number(new URLSearchParams(location.search).get("bzwait") || 0); // tests: pretend a sign-in screen
    if (wait > 0) { window.setTimeout(() => { void getSql(); root.render(<StrictMode><RouterProvider router={router} /></StrictMode>); }, wait); return; }
    void getSql();
    root.render(<StrictMode><RouterProvider router={router} /></StrictMode>);
    return;
  }
  const remembered = lastUser();
  if (remembered) emitUser(remembered);
  root.render(
    <StrictMode>
      <I18nProvider>
        <Gate />
      </I18nProvider>
    </StrictMode>,
  );
}

function OtherTab() {
  const es = (document.documentElement.lang || "es").startsWith("es");
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "Figtree, system-ui, sans-serif" }}>
      <div>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, margin: 0 }}>Brizna</h1>
        <p style={{ marginTop: 12 }}>{es ? "Brizna ya está abierta en otra pestaña o ventana. Ciérrala y toca Reintentar." : "Brizna is already open in another tab or window. Close it and tap Retry."}</p>
        <button type="button" onClick={() => location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 12, border: 0, background: "#1f6a3a", color: "#fff", fontSize: 16 }}>
          {es ? "Reintentar" : "Retry"}
        </button>
      </div>
    </main>
  );
}

// One tab at a time owns the on-device database (two would overwrite each other).
if (navigator.locks?.request) {
  void navigator.locks.request("brizna-db", { ifAvailable: true }, (lock) => {
    if (!lock) { root.render(<OtherTab />); return; }
    start();
    return new Promise<void>(() => undefined); // hold until the tab closes
  });
} else {
  start();
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js"); });
}
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);
