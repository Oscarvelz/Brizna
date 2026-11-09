/**
 * 1.5.52 (auditoría interna, D4 — Oscar: «el respaldo debe guardar todo»): the device
 * layer of the book rides in the backup. Everything the user authored or chose that
 * lives in localStorage — the Fichero's folder catalog with its colors, notification
 * prefs, own frequencies, the whole look (theme, palettes, density), card orders,
 * Notepad drafts, the weather place, Ajustes order… — is captured by ENUMERATION at
 * copy time, so a key the app grows tomorrow travels too, without anyone updating a
 * list. What does NOT travel is a short, named set of machinery and secrets:
 *
 * - the session itself (`brizna-auth`, `brizna.lastUser`): a backup file must never
 *   carry a credential or decide who you are — signing in does that;
 * - this device's database bookkeeping (`brizna.dbOwner`, `brizna.db-gen`,
 *   `brizna.db-failures`, `brizna.device`): names and state of THIS device's stores;
 * - sync bookkeeping (`brizna.sync.*`): revision/hash accounting per device — a
 *   restored device must start at zero and OBSERVE the cloud first (C1's rule);
 * - the offline queue (`ols-outbox*`, every scope, plus its failed list): those ops
 *   belong to a living book's ids (D1's fence) — into another book they are poison;
 * - screen snapshots (`brizna.screens.*`): a device cache that rebuilds from the book;
 * - day stamps (`brizna.ensured.*`): the restoring device must earn its own;
 * - the cached weather pack (`ols-weather`): a timed cache — the PLACE travels
 *   (`ols-weather-place`), the pack refetches and says its hour honestly;
 * - diagnostics and session flags (`bz-dict-error`, `brizna-quiet-boot`, `ols.had-user`).
 *
 * The same predicate filters both ways: what collect skips, apply also refuses, so a
 * hand-made file cannot plant any of these keys through a restore either.
 * Restoring MERGES: it writes the keys the copy carries and deletes nothing — a key
 * this device has and the copy does not is left exactly as it was.
 */

export function localStoreExcluded(key: string): boolean {
  return (
    key === "brizna-auth" ||
    key === "brizna.lastUser" ||
    key === "brizna.dbOwner" ||
    key === "brizna.db-gen" ||
    key === "brizna.db-failures" ||
    key === "brizna.device" ||
    key === "brizna-quiet-boot" ||
    key === "ols.had-user" ||
    key === "bz-dict-error" ||
    key === "ols-weather" ||
    key.startsWith("brizna.sync") ||
    key.startsWith("brizna.screens.") ||
    key.startsWith("brizna.ensured.") ||
    key.startsWith("ols-outbox")
  );
}

const MAX_KEY = 128;
const MAX_VALUE = 400_000; // mirrors query-snapshot's per-entry cap
const MAX_ENTRIES = 500;
const MAX_TOTAL = 2_500_000; // mirrors query-snapshot's total cap

/** Keeps only what may travel: string values, sane sizes, nothing excluded. */
export function sanitizeLocalStore(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let total = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_ENTRIES) break;
    if (typeof v !== "string" || k.length === 0 || k.length > MAX_KEY || v.length > MAX_VALUE) continue;
    if (localStoreExcluded(k)) continue;
    total += k.length + v.length;
    if (total > MAX_TOTAL) break;
    out[k] = v;
  }
  return out;
}

/** Snapshot of this device's travel-worthy local layer. */
export function collectLocalStore(store: Storage): Record<string, string> {
  const raw: Record<string, string> = {};
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k) continue;
    const v = store.getItem(k);
    if (v != null) raw[k] = v;
  }
  return sanitizeLocalStore(raw);
}

/** Writes the copy's local layer onto this device. Returns true when anything
 *  actually changed (the caller reloads then, so boot-read preferences land). */
export function applyLocalStore(store: Storage, data: Record<string, string>): boolean {
  const clean = sanitizeLocalStore(data);
  let changed = false;
  for (const [k, v] of Object.entries(clean)) {
    if (store.getItem(k) !== v) {
      store.setItem(k, v);
      changed = true;
    }
  }
  return changed;
}
