// Fingerprint / face unlock with the phone's own biometrics (WebAuthn platform authenticator).
// Works offline: the check happens on the device, nothing is sent anywhere.
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
export const LOCK_AFTER_CHOICES = [5, 30, 60, 240, 720] as const; // minutes
export function lockAfterMinutes(): number {
  try {
    const n = Number(localStorage.getItem(AFTER_KEY));
    return (LOCK_AFTER_CHOICES as readonly number[]).includes(n) ? n : 60;
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
    return !seen || Date.now() - seen > lockAfterMinutes() * 60_000;
  } catch {
    return true;
  }
}
