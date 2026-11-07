/**
 * Brizna for Android (1.4.97): the WebView app (package com.oscarvelz.brizna, source in android/) puts
 * `window.BriznaNative` on the page. Everything in this file is feature-detected: in a browser or the installed PWA
 * there is no BriznaNative, startNative() returns at once and nothing here runs, so the web app behaves exactly as before.
 *
 * What the bridge does inside the app:
 * - Back: the phone's Back asks BriznaBack(); Brizna's own history (useBackClose sheets, jump-back glides, screens)
 *   handles it exactly as in Chrome. When nothing moves (first screen) the app hears atRoot() and shows
 *   "Pulsa atrás otra vez para salir".
 * - Status/navigation bar colours follow the theme (meta theme-color at the top, the dock colour at the bottom).
 * - Downloads (PDF, hoja, copia JSON): a blob link is handed to the app and saved in Downloads/Brizna.
 * - Share: navigator.share with files goes to the Android share sheet. Printing goes to Android's print dialog.
 * - Fingerprint: WebAuthn does not work in a plain WebView, so device-lock.ts asks the phone's BiometricPrompt.
 * - "A inglés" (android-3): lib/translate.ts asks translate(); ML Kit translates on the phone (model downloaded once).
 * - Reminders and the "Hoy" widget: lib/native-plan.ts works out the schedule and hands it over (setSchedule/setWidget).
 */

export type BriznaNativeBridge = {
  version(): string;
  versionCode?(): number;
  setBars(top: string, bottom: string, darkTop: boolean, darkBottom: boolean): void;
  atRoot(msg: string): void;
  takeRoute?(): string;
  canAuth(): string;
  authenticate(id: string, title: string, subtitle: string): void;
  saveBegin(name: string, mime: string): string;
  saveChunk(id: string, b64: string): string;
  saveEnd(id: string, msgTemplate: string): string;
  shareBegin?(): string;
  shareFile?(id: string, name: string, mime: string): string;
  shareChunk?(id: string, b64: string): string;
  shareEnd?(id: string, title: string, text: string): string;
  print?(title: string): void;
  setSchedule?(json: string): string;
  notifyStatus?(): string;
  requestNotify?(): void;
  requestBattery?(): void;
  requestExact?(): void;
  openAppSettings?(): void;
  testNotify?(delayMs: number, title: string, body: string): void;
  setWidget?(json: string): string;
  /** android-3: Spanish → English with ML Kit on the phone; replies with CustomEvent "briznanative-translate". */
  translate?(id: string, text: string): void;
  translateState?(): string;
};

type W = Window & { BriznaNative?: BriznaNativeBridge; BriznaBack?: () => string; __bzNativeOn?: boolean };

export function native(): BriznaNativeBridge | null {
  if (typeof window === "undefined") return null;
  const n = (window as W).BriznaNative;
  return n && typeof n.version === "function" ? n : null;
}

export const inAndroidApp = (): boolean => native() !== null;

const en = () => typeof document !== "undefined" && document.documentElement.lang === "en";

/* ---------- fingerprint ---------- */

export function nativeCanAuth(): boolean {
  const n = native();
  try { return !!n && n.canAuth() === "yes"; } catch { return false; }
}

/** Asks the phone's own biometric prompt (fingerprint/face, with the phone's PIN as fallback). Resolves false on cancel. */
export function nativeAuth(): Promise<boolean> {
  const n = native();
  if (!n) return Promise.resolve(false);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; ok: boolean }>).detail;
      if (!d || d.id !== id) return;
      window.removeEventListener("briznanative-auth", on);
      resolve(!!d.ok);
    };
    window.addEventListener("briznanative-auth", on);
    try {
      n.authenticate(id, en() ? "Unlock Brizna" : "Desbloquear Brizna", en() ? "Use your fingerprint or your screen lock" : "Usa tu huella o el bloqueo de pantalla");
    } catch {
      window.removeEventListener("briznanative-auth", on);
      resolve(false);
    }
  });
}

/* ---------- reminders status (Ajustes, Notificaciones) ---------- */

export type NativeNotifyStatus = {
  permission: "granted" | "denied" | "ask";
  exact: boolean;
  battery: boolean;
  samsung: boolean;
  widget: boolean;
  next: number;
  count: number;
};

export function nativeNotifyStatus(): NativeNotifyStatus | null {
  const n = native();
  if (!n?.notifyStatus) return null;
  try { return JSON.parse(n.notifyStatus()) as NativeNotifyStatus; } catch { return null; }
}

/* ---------- back ---------- */

function installBack(n: BriznaNativeBridge) {
  const w = window as W;
  const root = () => {
    try { n.atRoot(en() ? "Press back again to close Brizna" : "Pulsa atrás otra vez para salir"); } catch { /* ignore */ }
  };
  // Count every completed history step (popstate in capture, plus the Navigation API for traversals someone else
  // handled first). When Back moves nothing, Brizna is on its first entry: that is the root.
  let steps = 0;
  const step = () => { steps++; };
  window.addEventListener("popstate", step, true);
  const nav = (window as Window & { navigation?: EventTarget }).navigation;
  nav?.addEventListener?.("currententrychange", step);
  w.BriznaBack = () => {
    const before = steps;
    history.back();
    window.setTimeout(() => { if (steps === before) root(); }, 400);
    return "ok";
  };
}

/* ---------- system bar colours ---------- */

function rgb(c: string): [number, number, number] | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0] | 0, p[1] | 0, p[2] | 0]; }
  const h = c.trim().match(/^#([0-9a-f]{6})$/i);
  return h ? [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)] : null;
}
const isDark = (v: [number, number, number]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < 140;

/** The opaque colour of the widest thing at the bottom edge (the dock), else the page background. */
function bottomColor(): string | null {
  let el = document.elementFromPoint(Math.round(innerWidth / 2), innerHeight - 2) as HTMLElement | null;
  while (el) {
    if (el.getBoundingClientRect().width >= innerWidth * 0.92) {
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); if ((p.length > 3 ? p[3] : 1) >= 0.5) return `rgb(${p[0] | 0}, ${p[1] | 0}, ${p[2] | 0})`; }
    }
    el = el.parentElement;
  }
  return null;
}

function installBars(n: BriznaNativeBridge) {
  let last = "";
  let queued = 0;
  const apply = () => {
    queued = 0;
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const top = meta?.content || "#000000";
    // AMOLED night: both bars pure black (the dock is black too; never the day linen behind the page).
    const amoled = document.documentElement.classList.contains("theme-amoled");
    const bottom = amoled ? "#000000" : bottomColor() || top;
    const t = rgb(top), b = rgb(bottom);
    if (!t || !b) return;
    const key = `${top}|${bottom}`;
    if (key === last) return;
    last = key;
    try { n.setBars(`rgb(${t.join(",")})`, `rgb(${b.join(",")})`, isDark(t), isDark(b)); } catch { /* ignore */ }
  };
  const soon = () => { if (!queued) queued = window.setTimeout(apply, 160); };
  new MutationObserver(soon).observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ["content", "data-theme", "data-palette", "class", "style"] });
  addEventListener("scroll", soon, { passive: true });
  addEventListener("resize", soon);
  document.addEventListener("visibilitychange", soon);
  soon();
}

/* ---------- downloads, share, print ---------- */

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const CH = 384 * 1024;

async function saveBlob(n: BriznaNativeBridge, name: string, blob: Blob) {
  const id = n.saveBegin(name || "Brizna", blob.type && blob.type !== "application/octet-stream" ? blob.type : guessMime(name));
  if (!id || id.startsWith("error")) return;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  for (let i = 0; i < bytes.length; i += CH) {
    if (n.saveChunk(id, b64(bytes.subarray(i, i + CH))) !== "ok") return;
  }
  n.saveEnd(id, en() ? "Saved in Downloads › Brizna: %s" : "Guardado en Descargas › Brizna: %s");
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  return ({ pdf: "application/pdf", json: "application/json", csv: "text/csv", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", zip: "application/zip", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain" } as Record<string, string>)[ext] || "application/octet-stream";
}

function installDownloads(n: BriznaNativeBridge) {
  // Brizna revokes its blob URL a few seconds after a.click(); keep the Blob itself so the app can still read it.
  const blobs = new Map<string, Blob>();
  const make = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    const u = make(obj);
    if (obj instanceof Blob) blobs.set(u, obj);
    return u;
  };
  URL.revokeObjectURL = (u: string) => {
    window.setTimeout(() => { blobs.delete(u); revoke(u); }, 60_000);
  };
  const take = (a: HTMLAnchorElement): boolean => {
    if (!a.hasAttribute("download")) return false;
    const href = a.href || "";
    const name = a.getAttribute("download") || "Brizna";
    if (href.startsWith("blob:")) {
      const blob = blobs.get(href);
      if (blob) { void saveBlob(n, name, blob); return true; }
      void fetch(href).then((r) => r.blob()).then((b) => saveBlob(n, name, b)).catch(() => undefined);
      return true;
    }
    if (href.startsWith("data:")) {
      void fetch(href).then((r) => r.blob()).then((b) => saveBlob(n, name, b)).catch(() => undefined);
      return true;
    }
    return false;
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (take(this)) return;
    click.call(this);
  };
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[download]") as HTMLAnchorElement | null;
    if (a && take(a)) e.preventDefault();
  }, true);
}

function installShare(n: BriznaNativeBridge) {
  if (!n.shareBegin || !n.shareFile || !n.shareChunk || !n.shareEnd) return;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d?: ShareData) => boolean };
  const share = async (d: ShareData = {}) => {
    const id = n.shareBegin!();
    if (!id || id === "error") throw new DOMException("share failed", "AbortError");
    for (const f of d.files ?? []) {
      if (n.shareFile!(id, f.name || "Brizna", f.type || guessMime(f.name)) !== "ok") throw new DOMException("share failed", "AbortError");
      const bytes = new Uint8Array(await f.arrayBuffer());
      for (let i = 0; i < bytes.length; i += CH) {
        if (n.shareChunk!(id, b64(bytes.subarray(i, i + CH))) !== "ok") throw new DOMException("share failed", "AbortError");
      }
    }
    const text = [d.text, d.url].filter(Boolean).join("\n");
    if (n.shareEnd!(id, d.title ?? "", text) !== "ok") throw new DOMException("share failed", "AbortError");
  };
  try {
    Object.defineProperty(nav, "share", { configurable: true, value: share });
    Object.defineProperty(nav, "canShare", { configurable: true, value: (d?: ShareData) => Boolean(d && (d.files?.length || d.text || d.url || d.title)) });
  } catch { /* ignore */ }
}

function installPrint(n: BriznaNativeBridge) {
  if (!n.print) return;
  // WebView has no print dialog of its own: Android's print dialog takes the page (print CSS applies); the app sends
  // "afterprint" when the dialog is done so Brizna puts its print pages away.
  window.print = () => { try { n.print!(document.title || "Brizna"); } catch { dispatchEvent(new Event("afterprint")); } };
}

/* ---------- start ---------- */

export function startNative() {
  const n = native();
  const w = typeof window !== "undefined" ? (window as W) : null;
  if (!n || !w || w.__bzNativeOn) return;
  w.__bzNativeOn = true;
  document.documentElement.dataset.android = "";
  installBack(n);
  installBars(n);
  installDownloads(n);
  installShare(n);
  installPrint(n);
}
