// Fingerprint / face unlock with the phone's own biometrics (WebAuthn platform authenticator).
// Works offline: the check happens on the device, nothing is sent anywhere.
// 1.4.97: inside the Android app (WebView, no WebAuthn) the phone's own BiometricPrompt does the check instead; the
// "away for longer than" rule (lockAfter, default 60 min) is the same.
import { inAndroidApp, nativeAuth, nativeCanAuth } from "@/spa/native";
const NATIVE = "native";
const KEY = (uid: string) => `brizna.lock.${uid}`;

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function rand(n: number) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export async function lockSupported(): Promise<boolean> {
  if (inAndroidApp()) return nativeCanAuth();
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function lockCredential(uid: string): string | null {
  try { return localStorage.getItem(KEY(uid)); } catch { return null; }
}

export async function enableLock(uid: string, email: string): Promise<boolean> {
  markInternal();
  if (inAndroidApp()) {
    if (!(await nativeAuth())) return false;
    localStorage.setItem(KEY(uid), NATIVE);
    return true;
  }
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: "Brizna" },
      user: { id: new TextEncoder().encode(uid.slice(0, 64)), name: email || "Brizna", displayName: email || "Brizna" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(KEY(uid), b64(cred.rawId));
  return true;
}

export function disableLock(uid: string) {
  try { localStorage.removeItem(KEY(uid)); } catch { /* ignore */ }
}

export async function unlock(uid: string): Promise<boolean> {
  const id = lockCredential(uid);
  if (!id) return true;
  markInternal(); // the prompt itself can hide the page for a moment: coming back from it is not a trip away
  if (inAndroidApp()) return nativeAuth();
  if (id === NATIVE) return true; // set in the Android app; a browser never shares its storage, so this is only a safety net
  const got = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: unb64(id), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return Boolean(got);
}

// How long Brizna can stay away before it asks again. Switching apps or closing Brizna
// for less than this never asks. Default 1 hour (Oscar: asking every time made it unusable).
const AFTER_KEY = "brizna.lockAfter";
const SEEN_KEY = (uid: string) => `brizna.lockSeen.${uid}`;
// 1.4.99 (Oscar): "Al instante" (0 = every time Brizna comes back), 5 min, 30 min, 1 h. 4 h and 12 h are gone:
// anyone saved on them moves to 1 h.
export const LOCK_AFTER_CHOICES = [0, 5, 30, 60] as const; // minutes
export function lockAfterMinutes(): number {
  try {
    const raw = localStorage.getItem(AFTER_KEY);
    if (raw === null || raw === "") return 60;
    const n = Number(raw);
    if ((LOCK_AFTER_CHOICES as readonly number[]).includes(n)) return n;
    localStorage.setItem(AFTER_KEY, "60"); // 240, 720 or anything unknown
    return 60;
  } catch {
    return 60;
  }
}
export function setLockAfterMinutes(n: number) {
  try { localStorage.setItem(AFTER_KEY, String(n)); } catch { /* ignore */ }
}
/** Brizna was in use just now (unlocked and visible). */
export function markSeen(uid: string) {
  try { localStorage.setItem(SEEN_KEY(uid), String(Date.now())); } catch { /* ignore */ }
}
/** True when the lock is on and Brizna has been away longer than the chosen time. */
export function lockDue(uid: string): boolean {
  if (!lockCredential(uid)) return false;
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY(uid)) || 0);
    const m = lockAfterMinutes();
    // "Al instante": any real trip away asks again (under a second is a flicker, not a trip).
    return !seen || Date.now() - seen > (m === 0 ? 800 : m * 60_000);
  } catch {
    return true;
  }
}

/* 1.4.99: Brizna's own trips out (the fingerprint prompt, the file picker, the share sheet, print, a download) hide
   the page too. A hide that starts within a few seconds of one of those is "internal": coming back never asks, even
   on "Al instante", so there is never a prompt loop. Only the first hide after the mark counts. */
let internalAt = 0;
let hiddenAt = 0;
export function markInternal() {
  internalAt = Date.now();
}
/** Call when the page becomes visible again: true (once) if the trip away was one of Brizna's own. */
export function awayWasInternal(): boolean {
  const ok = internalAt > 0 && hiddenAt >= internalAt - 500 && hiddenAt - internalAt < 5000;
  internalAt = 0; // one mark covers one trip out
  return ok;
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") hiddenAt = Date.now(); }, true);
  // a file input opens the system picker
  document.addEventListener("click", (e) => {
    const t = e.target as Element | null;
    try { if (t && t.closest && t.closest('input[type="file"], label:has(input[type="file"])')) markInternal(); } catch { /* old engine */ }
  }, true);
}
/** Wraps share and print (browser or the Android app's own) so their sheets count as internal. Call once at start. */
export function guardInternalTrips() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __bzTripGuard?: boolean };
  if (w.__bzTripGuard) return;
  w.__bzTripGuard = true;
  const nav = navigator as Navigator & { share?: (d?: ShareData) => Promise<void> };
  if (typeof nav.share === "function") {
    const share = nav.share.bind(nav);
    try { Object.defineProperty(nav, "share", { configurable: true, value: (d?: ShareData) => { markInternal(); return share(d); } }); } catch { /* ignore */ }
  }
  const print = window.print.bind(window);
  window.print = () => { markInternal(); print(); };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) markInternal();
    return click.call(this);
  };
  // the file picker opened from code (input.click())
  const iclick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
    if (this.type === "file") markInternal();
    return iclick.call(this);
  };
}
