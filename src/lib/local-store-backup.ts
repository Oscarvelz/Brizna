/**
 * 1.5.52 (auditoría interna, D4 — Oscar: «el respaldo debe guardar todo»): the device
 * layer of the book rides in the backup. Everything the user authored or chose that
 * lives in localStorage — the Fichero's folder catalog with its colors, notification
 * prefs, own frequencies, the whole look (theme, palettes, density), card orders,
 * Notepad drafts, the weather place, Ajustes order… — is captured by ENUMERATION at
 * copy time, so a key the app grows tomorrow travels too, without anyone updating a
 * list. What does NOT travel is a short, named set of machinery and secrets:
 *
 * - the session itself (`brizna-auth*` — the key and every auth-js child beside
 *   it, PKCE verifiers included — and `brizna.lastUser`): a backup file must never
 *   carry a credential or decide who you are — signing in does that;
 * - the device lock's credential (`brizna.lock*`): the WebAuthn id enrolled on
 *   THIS device — elsewhere it points at an authenticator that does not exist,
 *   and here it would resurrect a lock the owner turned off (1.5.93, BZ-6);
 * - this device's database bookkeeping (`brizna.dbOwner`, `brizna.db-gen`,
 *   `brizna.db-failures`, `brizna.device`): names and state of THIS device's stores;
 * - sync bookkeeping (`brizna.sync.*`): revision/hash accounting per device — a
 *   restored device must start at zero and OBSERVE the cloud first (C1's rule);
 * - the offline queue (`ols-outbox*`, every scope, plus its failed list): those ops
 *   belong to a living book's ids (D1's fence) — into another book they are poison;
 * - screen snapshots (`brizna.screens.*`): a device cache that rebuilds from the book;
 * - day stamps (`brizna.ensured.*`): the restoring device must earn its own;
 * - the cached weather packs (`ols-weather`, `brizna.clima.*`): timed caches — the
 *   PLACE travels (`ols-weather-place`), the pack refetches and says its hour honestly;
 * - diagnostics and session flags (`bz-dict-error`, `brizna-quiet-boot`, `ols.had-user`).
 *
 * The same predicate filters both ways: what collect skips, apply also refuses, so a
 * hand-made file cannot plant any of these keys through a restore either.
 * Restoring MERGES: it writes the keys the copy carries and deletes nothing — a key
 * this device has and the copy does not is left exactly as it was.
 *
 * 1.6.01 (campaña Prejuicio R2): three cures ride this layer. (R2C-1) The
 * presentation family (`bz.pres.*`, `bz.seen.pres`) never travels: the pref
 * guard's photograph is a snapshot of THIS device's whole store — lock
 * verifiers included as content — and a restore on another device promoted
 * its inner keys to live keys at the stage's boot sweep. (R2C-7) The lock
 * exclusion narrows to the credential family (`brizna.lock` and
 * `brizna.lock.*`, the lockSeen bookkeeping included): `brizna.lockAfter`
 * is the user's own re-lock delay choice, and it travels like any other
 * preference. (R2C-4) Applying the layer is all-or-nothing: a write that
 * fails halfway rolls back the keys it already wrote and the error
 * propagates, so the layer is never left half-applied. (R2C-5) What the
 * size budget leaves out is counted (`localStoreOmissions`) and declared
 * in the copy itself, never dropped in silence.
 */

export function localStoreExcluded(key: string): boolean {
  return (
    key === "brizna.lastUser" ||
    key === "brizna.dbOwner" ||
    key === "brizna.db-gen" ||
    key === "brizna.db-failures" ||
    key === "brizna.device" ||
    key === "brizna-quiet-boot" ||
    key === "ols.had-user" ||
    key === "bz-dict-error" ||
    key === "ols-weather" ||
    // 1.6.09 (Prejuicio R3, R3C-2): el portador «keep» de la sesión
    // (`ols.keep-bearer`, el token Bearer que client.ts guarda al mantener
    // la sesión) es una credencial como la de `brizna-auth` — su escritor
    // duerme hoy en el paquete, pero la ley de la cabecera no espera a que
    // despierte: ninguna copia lo lleva ni lo planta.
    key === "ols.keep-bearer" ||
    // 1.6.11 (Prejuicio R3, R4C-1): el correo guardado del inicio de sesión
    // (`ols.last-email`, login-email.ts) es material de identidad como
    // `brizna.lastUser` — la cabecera lo prohíbe («never carry a credential
    // or decide who you are»): una copia no dice quién eres en el aparato
    // que la restaure. Su escritor vive tras una constante, así que el
    // censo de literales de la suite no lo veía; la clave entra al censo.
    key === "ols.last-email" ||
    // 1.6.09 (R3C-3): la marca de ediciones de la sesión provisional
    // (`brizna.prov-edited`) es contabilidad de sync como `brizna.sync.*`:
    // el aparato que restaura debe nacer en cero y observar la nube primero;
    // con la marca ajena nacía con una «edición» que no hizo.
    key === "brizna.prov-edited" ||
    // 1.6.09 (R3C-4): `brizna.sky` es la lectura del cielo con su hora —
    // una caché con hora como los packs de clima; solo el LUGAR viaja.
    key === "brizna.sky" ||
    key.startsWith("brizna.sync") ||
    key.startsWith("brizna.screens.") ||
    key.startsWith("brizna.ensured.") ||
    key.startsWith("ols-outbox") ||
    // 1.5.93 (campaña Prejuicio, BZ-6 — REABIERTO D4): whole FAMILIES that the
    // exact-string list missed. The auth family travels by prefix now: the exact
    // `brizna-auth` key AND every `brizna-auth-…` child (the PKCE code verifiers
    // and flow indexes auth-js keeps beside it) — a backup must never carry
    // sign-in material. The device lock's credential (`brizna.lock.<uid>`: the
    // WebAuthn id enrolled on THIS device, or "native") must never travel
    // either: restored elsewhere it points at an authenticator that does not
    // exist there, and restored here it resurrects a lock the owner turned off.
    // And the weather PACKS (`brizna.clima.<lat>,<lon>`) are timed caches like
    // `ols-weather` — only the place travels; a pack also eats the size budget
    // that the user's own keys need.
    key.startsWith("brizna-auth") ||
    // 1.6.01 (R2C-7): only the credential family stays home — `brizna.lock`
    // itself, `brizna.lock.*` (the enrolled credential `brizna.lock.<uid>`)
    // and the `brizna.lockSeen.*` device bookkeeping. `brizna.lockAfter`
    // is a preference the user chose, not a credential, and travels.
    key === "brizna.lock" ||
    key.startsWith("brizna.lock.") ||
    key.startsWith("brizna.lockSeen.") ||
    key.startsWith("brizna.clima.") ||
    // 1.6.01 (R2C-1): the presentation's own state never travels — above all
    // the pref guard's photograph (`bz.pres.prefguard`), whose CONTENT is a
    // snapshot of this device's whole store, barred credentials included.
    key === "bz.seen.pres" ||
    key.startsWith("bz.pres.")
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

/** 1.6.01 (R2C-5): how many travel-worthy entries the size budget left out
 *  of `raw` — counted with sanitizeLocalStore's own walk, so the number is
 *  exactly what the copy missed. Excluded-by-law keys and non-string values
 *  are not omissions: they were never the copy's to carry. The copy declares
 *  this count inside itself (`localOmitted`) and the copy/restore flows say
 *  it out loud. */
export function localStoreOmissions(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  let omitted = 0;
  let kept = 0;
  let total = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string" || k.length === 0 || k.length > MAX_KEY) continue;
    if (localStoreExcluded(k)) continue;
    if (v.length > MAX_VALUE) { omitted += 1; continue; }
    if (kept >= MAX_ENTRIES) { omitted += 1; continue; }
    total += k.length + v.length;
    if (total > MAX_TOTAL) { omitted += 1; continue; }
    kept += 1;
  }
  return omitted;
}

/** The omissions of this device's live store, enumerated the same way
 *  collectLocalStore enumerates it. */
export function collectLocalStoreOmissions(store: Storage): number {
  const raw: Record<string, string> = {};
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k) continue;
    const v = store.getItem(k);
    if (v != null) raw[k] = v;
  }
  return localStoreOmissions(raw);
}

/** Writes the copy's local layer onto this device. Returns true when anything
 *  actually changed (the caller reloads then, so boot-read preferences land).
 *  1.6.01 (R2C-4): all-or-nothing — if a write fails halfway (quota), the
 *  keys this call already wrote are rolled back to the values they had
 *  before it, and the error propagates: the layer is never left half-applied
 *  under a report that says nothing changed. */
export function applyLocalStore(store: Storage, data: Record<string, string>): boolean {
  const clean = sanitizeLocalStore(data);
  const prior = new Map<string, string | null>();
  let changed = false;
  try {
    for (const [k, v] of Object.entries(clean)) {
      const before = store.getItem(k);
      if (before !== v) {
        if (!prior.has(k)) prior.set(k, before);
        store.setItem(k, v);
        changed = true;
      }
    }
  } catch (err) {
    for (const [k, before] of prior) {
      try {
        if (before === null) store.removeItem(k);
        else store.setItem(k, before);
      } catch { /* rollback is best-effort; the original error is the one that matters */ }
    }
    throw err;
  }
  return changed;
}
