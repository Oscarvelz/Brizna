// Brizna on the device: the same Postgres schema, running in the browser (PGlite)
// and saved in IndexedDB, so every screen works with no internet.
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { setFlushFailed } from "@/lib/flush-state";
import { warmPglite } from "./pg-warm";

export type DbSource = "neon" | "pglite";
export const dbSource: DbSource = "pglite";

export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;
export const DB_NAME = "idb://brizna";
const OWNER = "brizna.dbOwner";

/* 1.5.51 (auditoría interna, A3): the rescue door's bookkeeping. Failed opens are
 * counted on the device (a corrupt store fails every time, so the count is what tells
 * a loop apart from a hiccup); a successful open clears it. The "generation" is how
 * the rescue renames without deleting: bumping it points the app at a fresh store
 * (brizna-g1, brizna-g2…) while the old one stays on disk, untouched and recoverable —
 * the cloud copy and the exported backups are the safety net that refills the book. */
const GEN_KEY = "brizna.db-gen";
const FAIL_KEY = "brizna.db-failures";

export function dbGeneration(): number {
  try { return Math.max(0, Number(localStorage.getItem(GEN_KEY)) || 0); } catch { return 0; }
}

export function dbFailureCount(): number {
  try { return Math.max(0, Number(localStorage.getItem(FAIL_KEY)) || 0); } catch { return 0; }
}

function noteDbFailure() {
  try { localStorage.setItem(FAIL_KEY, String(dbFailureCount() + 1)); } catch { /* ignore */ }
}

function noteDbSuccess() {
  try { localStorage.removeItem(FAIL_KEY); } catch { /* ignore */ }
}

export function clearDbFailures() {
  try { localStorage.removeItem(FAIL_KEY); } catch { /* ignore */ }
}

/** Rescue: future opens use a NEW store on this device. The old store is not deleted. */
export function startWithFreshStore() {
  try {
    localStorage.setItem(GEN_KEY, String(dbGeneration() + 1));
    localStorage.removeItem(FAIL_KEY);
  } catch { /* ignore */ }
}

/** 1.5.53 (C1): the account whose book is this device's base store, if any has ever
 *  opened here. The gate uses it to admit the owner provisionally when no session is
 *  remembered: the book is here, so the book opens. */
export function localBookOwner(): string | null {
  try { return localStorage.getItem(OWNER); } catch { return null; }
}

let dbUser: string | null = null;
/** Which account's on-device database to open. The first account on a device keeps
 *  the original database (so data typed before sign-in is kept); others get their own. */
export function setDbUser(uid: string) { dbUser = uid; }
function dbName(): string {
  const forced = (globalThis as any).__bzDb as string | undefined;
  if (forced) return forced;
  const gen = dbGeneration();
  const base = gen > 0 ? `idb://brizna-g${gen}` : DB_NAME;
  if (!dbUser) return base;
  let owner: string | null = null;
  try { owner = localStorage.getItem(OWNER); } catch { /* ignore */ }
  if (!owner) { try { localStorage.setItem(OWNER, dbUser); } catch { /* ignore */ } return base; }
  return owner === dbUser ? base : `${base}-${dbUser}`;
}

let pgPromise: Promise<PGlite> | null = null;

// Saving to the phone's storage (IndexedDB) walks every database file and took ~0.25 s.
// PGlite did it after EVERY query, reads included, which made screens slow to fill.
// Now it happens once after changes: right after each save (before the screen says done),
// shortly after any background write, and when the app is hidden.
let realSync: (() => Promise<void>) | null = null;
let needFlush = false;
let flushTimer: ReturnType<typeof setTimeout> | 0 = 0;
const WRITE_RE = /^\s*(insert|update|delete|create|alter|drop|truncate|with|do|copy|vacuum|reindex|set\s+local|begin|commit)\b/i;

function markWrite() {
  needFlush = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = 0; void flushDb(); }, 200);
}

// 1.5.51 (auditoría interna, A4): callbacks that may only run once the data is DURABLE
// — the agenda's "ensured today" stamp is the first tenant. They drain after a
// successful flush; a failed flush keeps them waiting for the next one, and if the
// process dies first they simply never run, which is exactly the point.
const flushWaiters: Array<() => void> = [];
(globalThis as { __bzOnFlush?: (fn: () => void) => void }).__bzOnFlush = (fn) => {
  if (!needFlush && !flushTimer && !flushing) {
    fn();
    return;
  }
  flushWaiters.push(fn);
};
let flushing = false;

/** Make sure every change so far is saved on the device. */
export function flushDb(): Promise<void> {
  if (!needFlush || !realSync) return Promise.resolve();
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = 0; }
  needFlush = false;
  flushing = true;
  const sync = realSync;
  // MOVIMIENTO 2 (hallazgo 14): a failed save is no longer silent. The failure is
  // published through flush-state, and the shell shows a persistent banner until a
  // later flush succeeds and clears it.
  const next = lane
    .then(() => sync())
    .then(() => {
      flushing = false;
      setFlushFailed(false);
      const waiters = flushWaiters.splice(0);
      for (const fn of waiters) {
        try { fn(); } catch { /* a waiter's failure is its own */ }
      }
    })
    .catch((err) => { flushing = false; needFlush = true; setFlushFailed(true); console.warn("[brizna db] save", err); });
  lane = next;
  return next;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushDb(); });
  window.addEventListener("pagehide", () => void flushDb());
}
let sqlPromise: Promise<Sql> | null = null;
// One query at a time keeps PGlite's transaction state simple across screens.
let lane: Promise<unknown> = Promise.resolve();

async function open(): Promise<PGlite> {
  (globalThis as any).__bzTrace?.push(["db-open", "", Date.now()]);
  (globalThis as any).__bzDbKey = dbName();
  const parts = await warmPglite();
  (globalThis as any).__bzTrace?.push(["db-parts", "", Date.now()]);
  const pg = new PGlite(dbName(), {
    ...(parts ?? {}),
    relaxedDurability: false,
    parsers: { [OID_INT8]: Number, [OID_DATE]: identity, [OID_INTERVAL]: identity },
  });
  await pg.waitReady;
  realSync = pg.syncToFs.bind(pg);
  (pg as any).syncToFs = async () => undefined; // saved by flushDb() instead
  // Day boundaries (payments "this month", "last paid") must follow Miami time, not UTC.
  await pg.exec("set time zone 'America/New_York'").catch(() => undefined);
  (globalThis as any).__bzTrace?.push(["db-ready", "", Date.now()]);
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
  const migrations = import.meta.glob("../../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const done = (await pg.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name);
  for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
    needFlush = true;
    await pg.transaction(async (tx) => {
      await tx.exec(migrations[path]);
      await tx.query("insert into _migrations (name) values ($1)", [name]);
    });
  }
  (globalThis as any).__bzTrace?.push(["db-migrated", "", Date.now()]);
  if (needFlush && realSync) {
    needFlush = false;
    try { await realSync(); setFlushFailed(false); }
    catch (err) { needFlush = true; setFlushFailed(true); throw err; }
  }
  return pg;
}

export function getPglite(): Promise<PGlite> {
  pgPromise ??= open()
    .then((pg) => { noteDbSuccess(); return pg; })
    .catch((err) => { noteDbFailure(); pgPromise = null; throw err; });
  return pgPromise;
}

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function makeSql(run: Run): Sql {
  const sql = (async <T,>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T,>(text: string, params: unknown[] = []) => run<T>(text, params);
  return sql;
}

function toSql(pg: PGlite): Sql {
  const run = <T,>(text: string, params: unknown[]) => {
    const next = lane.then(async () => {
      const tr = (globalThis as any).__bzQTrace as unknown[] | undefined;
      const t0 = tr ? performance.now() : 0;
      if (WRITE_RE.test(text)) markWrite();
      const r = await pg.query<T>(text, params);
      if (tr) tr.push([Math.round(performance.now() - t0), text.replace(/\s+/g, " ").slice(0, 90)]);
      return r;
    }).then((r) => r.rows);
    lane = next.catch(() => undefined);
    return next;
  };
  return makeSql(run);
}

/** Run work alone on the database (no screen queries in between). */
export function exclusive<T>(fn: (pg: PGlite) => Promise<T>): Promise<T> {
  const next = lane.then(() => getPglite()).then((pg) => fn(pg)).finally(() => markWrite());
  lane = next.catch(() => undefined);
  return next;
}

/**
 * MOVIMIENTO 2 (hallazgo 18): run `fn` in ONE PGlite transaction, alone on the lane
 * (exclusive), with a Sql handle bound to the transaction itself — the handle must
 * bypass the lane, which exclusive is already holding. Any throw rolls back.
 * The server build (src/lib/db.ts) exports the same contract.
 */
export function withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  return exclusive(async (pg) =>
    pg.transaction(async (tx) =>
      fn(makeSql(async <R,>(text: string, params: unknown[]) => ((await tx.query(text, params)) as { rows: R[] }).rows)),
    ),
  );
}

export function getSql(): Promise<Sql> {
  sqlPromise ??= getPglite().then(toSql).catch((err) => { sqlPromise = null; throw err; });
  return sqlPromise;
}

export function ensureDbReady(): Promise<void> {
  return getSql().then(() => undefined);
}
