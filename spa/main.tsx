import { StrictMode, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import "@/styles.css";
import "@/alive.css";
import "@/night.css";
import "@/sky.css";
import "@/weather-sky.css";
import "@/cifras.css";
import "@/asesor.css";
import "@/clima.css";
import "@/tablet.css";
import { restoreSky } from "@/lib/weather-sky";
restoreSky();
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/theme";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "@/routeTree.gen";
import { setPaneRouteTree } from "@/lib/pane-context";
import { clearDbFailures, dbFailureCount, ensureDbReady, getPglite, getSql, localBookOwner, setDbUser, startWithFreshStore } from "@/lib/db";
import { I18nProvider } from "@/lib/i18n";
import { awayWasInternal, guardInternalTrips, lockDue, markSeen, unlock } from "@/lib/device-lock";
import { saveBackupNow } from "@/lib/server/lawn";
import { CLOUD_READY, emitLocalUser, emitUser, isLocalOnly, keepSignedIn, setSessionGone, getUser, lastUser, onUser, rememberUser, supabase, type BriznaUser } from "@/spa/cloud";
import { setKeepCopy, startSync } from "@/spa/sync";
import { signOutHere } from "@/spa/session";
import { Locked, Login, Splash } from "@/spa/login";
import { warmPglite } from "@/spa/pg-warm";
import { inAndroidApp, startNative } from "@/spa/native";
import { markShellReady, quietNextBoot, useSplashGone } from "@/spa/splash-ready";

// 1.4.97 Brizna for Android: back, bars, downloads, share and print bridges (nothing happens in a browser).
startNative();
guardInternalTrips(); // after startNative, so it wraps the Android app's own share/print too
// The app's storage is its own (a new device to the Nube): the first sign-in says where the clients come from.
const FIRST_OPEN_NOTE = "Primera vez en la app: entra con tu cuenta y tus clientes bajan de la Nube. Si no usas la Nube, entra y restaura una copia en Ajustes\u00a0›\u00a0Copia de seguridad.";

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
  // A provisional (local-only) owner counts as "session gone" too: Ajustes offers
  // "Entrar de nuevo", and signing in reconciles instead of blocking (1.5.53, C1).
  useEffect(() => { setSessionGone(expiredRaw || isLocalOnly()); }, [expiredRaw, user]);
  // Sync belongs to real sessions only. It starts when a signed-in user is present —
  // including the moment a provisional owner's session lands (same id, new emission):
  // its first pass reads the cloud head and the full copy before writing anything.
  const syncStartedFor = useRef("");
  useEffect(() => {
    if (user && !isLocalOnly() && syncStartedFor.current !== user.id) {
      syncStartedFor.current = user.id;
      startSync(user.id);
    }
  }, [user]);
  useEffect(() => {
    const go = () => setRelogin(true);
    window.addEventListener("brizna-relogin", go);
    return () => window.removeEventListener("brizna-relogin", go);
  }, []);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const hiddenAt = useRef(0);
  const tried = useRef("");
  // The fingerprint is asked once the launch splash has gone, so it never pops over it.
  const splashOver = useSplashGone();

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
      if (awayWasInternal()) { markSeen(user.id); return; }
      if (lockDue(user.id)) { tried.current = ""; setFailed(false); setOpen(false); window.dispatchEvent(new Event("bz-locked")); }
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
    if (user && !open && booted && splashOver && tried.current !== user.id && lockDue(user.id)) { tried.current = user.id; void tryUnlock(); }
  });

  // Another account signed in on top of an open one: start clean with that account's data.
  if (user && openedFor && openedFor !== user.id) { quietNextBoot(); location.reload(); return <Splash />; }

  if (!booted && !user) return <Splash />;
  if (recovery) return <Login recovery />;
  if (!user || expired) {
    return <Login note={expired ? "Tu sesión venció. Entra de nuevo para sincronizar; tus datos siguen en este equipo. / Your session expired: sign in again to sync." : inAndroidApp() && !lastUser() ? FIRST_OPEN_NOTE : undefined} />;
  }
  if (!open) return <Locked failed={failed} onOpen={() => void tryUnlock()} onSignOut={() => void signOutHere()} />;
  // The early-opened database belongs to someone else: reload so this account opens its own.
  if (preopenedFor && preopenedFor !== user.id) { quietNextBoot(); location.reload(); return <Splash />; }
  if (openedFor !== user.id) {
    openedFor = user.id;
    setDbUser(user.id);
    void getSql();
    setKeepCopy(() => saveBackupNow());
    // Sync starts from the effect below, not here: a provisional owner (C1) opens
    // the book WITHOUT syncing, and the same effect starts it the moment a real
    // session lands for this same user.
  }
  return <RouterProvider router={router} />;
}

// Database opened early (before sign-in checks finish) for the account last used here.
let preopenedFor: string | null = null;

let dbDeadlineArmed = false;
function armDbDeadline() {
  if (dbDeadlineArmed) return;
  dbDeadlineArmed = true;
  // 1.5.51 (auditoría interna, A2): if the on-device database never finishes opening,
  // every screen used to sit on its skeleton forever — a promise that never settles is
  // not an error React Query can retry. After 30 s without the database, the stuck
  // screen says so and offers a way out. A fast REJECTION is a different story (the
  // failure count, A3): the app's own error cards show it, so this stays quiet then.
  void Promise.race([
    ensureDbReady().then(() => true).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 30_000)),
  ]).then((ready) => {
    if (!ready && dbFailureCount() === 0) root.render(<DbStuck />);
  });
}

function start() {
  void warmPglite();
  armDbDeadline();
  if (CLOUD_READY) {
    const last = lastUser();
    if (last) {
      preopenedFor = last.id;
      setDbUser(last.id);
      void getSql().catch(() => undefined);
    } else {
      // 1.5.53 (C1): no remembered session, but a book may already live here — warm
      // the owner's store so the provisional open below is instant.
      const owner = localBookOwner();
      if (owner) {
        preopenedFor = owner;
        setDbUser(owner);
        void getSql().catch(() => undefined);
      }
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
  else {
    // 1.5.53 (auditoría interna, C1 — Oscar's rule): with no remembered session —
    // "Mantener sesión" off, a new cold start, storage cleared — the Login used to
    // stand in front of a whole local book until the network allowed signing in.
    // Now the book's owner is admitted provisionally and the book opens from this
    // device; when the network returns, signing in reconciles (sync observes first).
    // The device lock above the app (fingerprint) is untouched by this.
    let signedOut = false;
    try { signedOut = sessionStorage.getItem("brizna.signed-out") === "1"; } catch { /* ignore */ }
    const owner = localBookOwner();
    if (owner && !signedOut) emitLocalUser({ id: owner, email: "", name: "" });
  }
  root.render(
    <StrictMode>
      <I18nProvider>
        <Gate />
      </I18nProvider>
    </StrictMode>,
  );
}

function OtherTab() {
  useEffect(() => markShellReady(), []);
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

function BootShell({ children }: { children: ReactNode }) {
  useEffect(() => markShellReady(), []);
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "Figtree, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 430 }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, margin: 0 }}>Brizna</h1>
        {children}
      </div>
    </main>
  );
}

const bootBtn: CSSProperties = { marginTop: 16, padding: "10px 20px", borderRadius: 12, border: 0, background: "#1f6a3a", color: "#fff", fontSize: 16 };
const bootBtnQuiet: CSSProperties = { marginTop: 10, padding: "10px 20px", borderRadius: 12, border: "1px solid #999", background: "transparent", fontSize: 16 };

function DbStuck() {
  const es = (document.documentElement.lang || "es").startsWith("es");
  return (
    <BootShell>
      <p style={{ marginTop: 12 }}>{es ? "La base de datos de este equipo no respondió. Puede estar ocupada por otra ventana o tardando más de lo normal." : "This device's database did not answer. It may be busy in another window or just taking longer than usual."}</p>
      <button type="button" onClick={() => location.reload()} style={bootBtn}>
        {es ? "Reintentar" : "Retry"}
      </button>
    </BootShell>
  );
}

function DbRescue() {
  const es = (document.documentElement.lang || "es").startsWith("es");
  return (
    <BootShell>
      <p style={{ marginTop: 12 }}>{es ? "La base de datos guardada en este equipo no se puede abrir, y ya falló varias veces. Tu cuenta y tus copias no se tocan: viven fuera de esta base." : "The database saved on this device cannot be opened, and it has already failed several times. Your account and your backups are untouched: they live outside this database."}</p>
      <p style={{ marginTop: 8 }}>{es ? "Si empiezas con una base vacía, la dañada NO se borra: queda guardada en el equipo y solo deja de usarse. Al entrar, la Nube o una copia pueden rellenar el libro." : "If you start with an empty database, the damaged one is NOT deleted: it stays saved on the device and simply stops being used. Once you are in, the Cloud or a backup can refill the book."}</p>
      <div>
        <button type="button" onClick={() => { clearDbFailures(); location.reload(); }} style={bootBtn}>
          {es ? "Reintentar" : "Retry"}
        </button>
      </div>
      <div>
        <button type="button" onClick={() => { startWithFreshStore(); location.reload(); }} style={bootBtnQuiet}>
          {es ? "Empezar con una base vacía en este equipo" : "Start with an empty database on this device"}
        </button>
      </div>
    </BootShell>
  );
}

function NoLocks() {
  const es = (document.documentElement.lang || "es").startsWith("es");
  return (
    <BootShell>
      <p style={{ marginTop: 12 }}>{es ? "Este navegador no puede asegurar que Brizna se abra una sola vez. Si se abre en dos sitios a la vez, un libro puede pisar al otro sin avisar." : "This browser cannot guarantee that Brizna opens only once. If it is opened in two places at once, one book can overwrite the other without warning."}</p>
      <button type="button" onClick={() => start()} style={bootBtn}>
        {es ? "Abrir de todos modos" : "Open anyway"}
      </button>
    </BootShell>
  );
}

// One tab at a time owns the on-device database (two would overwrite each other).
if (dbFailureCount() >= 3) {
  // 1.5.51 (auditoría interna, A3): the saved store has failed to open again and
  // again — offer the rescue door instead of another lap around the same error loop.
  root.render(<DbRescue />);
} else if (navigator.locks?.request) {
  // 1.5.63 (Oscar hit the wall himself): asking once, instantly, was not enough. When Brizna is
  // reopened right after closing — or reloads itself to install an update — its own previous page
  // can still be shutting down and holding the lock for a moment, and the instant check mistook
  // that corpse for another tab ("ya está abierta en otra pestaña" with no other tab anywhere:
  // on his phone the app's storage is its own, so a browser copy could not even hold this lock).
  // Now a busy lock is waited out behind the splash: a dying holder frees it in a moment and the
  // book opens; only a holder still alive after a few seconds is a real second Brizna and earns
  // the OtherTab screen.
  const begin = (lock: Lock | null) => {
    if (!lock) return "busy" as const;
    start();
    return new Promise<void>(() => undefined); // hold until the tab closes
  };
  void (async () => {
    let first: unknown;
    try {
      first = await navigator.locks.request("brizna-db", { ifAvailable: true }, begin);
    } catch {
      first = "busy";
    }
    if (first !== "busy") return; // granted: begin's promise never settles, so this is really the busy path only
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 6_000);
    try {
      await navigator.locks.request("brizna-db", { signal: ac.signal }, begin);
    } catch {
      root.render(<OtherTab />);
    } finally {
      window.clearTimeout(timer);
    }
  })();
} else {
  // 1.5.51 (auditoría interna, A1): without Web Locks there used to be NO arbitration
  // at all — the app started blind and two copies could overwrite each other in
  // silence. Now the screen says so, and opening is a deliberate tap.
  root.render(<NoLocks />);
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  // 1.4.70: pick up a new release promptly. Check for a new sw.js on open and each time the app comes back to the
  // front (at most once a minute; the browser fetches sw.js bypassing HTTP cache). The new worker skips waiting and
  // claims the page; we then reload once, but only at a calm moment: right away while the page is hidden or within
  // the first seconds after open/resume, otherwise the next time it is hidden (never mid-task, never in a loop).
  const swc = navigator.serviceWorker;
  const hadController = !!swc.controller;
  let lastCheck = 0;
  let calmUntil = Date.now() + 8000;
  let pendingReload = false;
  let reloaded = false;
  const check = (reg?: ServiceWorkerRegistration) => {
    if (Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    void (reg ? Promise.resolve(reg) : swc.getRegistration()).then((r) => r?.update()).catch(() => undefined);
  };
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    quietNextBoot(); // the reload that installs an update never replays the launch splash
    window.location.reload();
  };
  swc.addEventListener("controllerchange", () => {
    if (!hadController) return; // first install: this page already runs the newest code
    if (document.visibilityState === "hidden" || Date.now() < calmUntil) reloadOnce();
    else pendingReload = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (pendingReload) reloadOnce();
      return;
    }
    calmUntil = Date.now() + 8000;
    check();
  });
  window.addEventListener("load", () => {
    void swc.register("./sw.js", { updateViaCache: "none" }).then((reg) => { lastCheck = 0; check(reg); }).catch(() => undefined);
  });
}
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);
