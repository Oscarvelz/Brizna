// Brizna on the device: the same Postgres schema, running in the browser (PGlite)
// and saved in IndexedDB, so every screen works with no internet.
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";
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

let dbUser: string | null = null;
/** Which account's on-device database to open. The first account on a device keeps
 *  the original database (so data typed before sign-in is kept); others get their own. */
export function setDbUser(uid: string) { dbUser = uid; }
function dbName(): string {
  const forced = (globalThis as any).__bzDb as string | undefined;
  if (forced) return forced;
  if (!dbUser) return DB_NAME;
  let owner: string | null = null;
  try { owner = localStorage.getItem(OWNER); } catch { /* ignore */ }
  if (!owner) { try { localStorage.setItem(OWNER, dbUser); } catch { /* ignore */ } return DB_NAME; }
  return owner === dbUser ? DB_NAME : `${DB_NAME}-${dbUser}`;
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

/** Make sure every change so far is saved on the device. */
export function flushDb(): Promise<void> {
  if (!needFlush || !realSync) return Promise.resolve();
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = 0; }
  needFlush = false;
  const sync = realSync;
  const next = lane.then(() => sync()).catch((err) => { needFlush = true; console.warn("[brizna db] save", err); });
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
  if (needFlush && realSync) { needFlush = false; await realSync(); }
  return pg;
}

export function getPglite(): Promise<PGlite> {
  pgPromise ??= open().catch((err) => { pgPromise = null; throw err; });
  return pgPromise;
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
  const sql = (async <T,>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T,>(text: string, params: unknown[] = []) => run<T>(text, params);
  return sql;
}

/** Run work alone on the database (no screen queries in between). */
export function exclusive<T>(fn: (pg: PGlite) => Promise<T>): Promise<T> {
  const next = lane.then(() => getPglite()).then((pg) => fn(pg)).finally(() => markWrite());
  lane = next.catch(() => undefined);
  return next;
}

export function getSql(): Promise<Sql> {
  sqlPromise ??= getPglite().then(toSql).catch((err) => { sqlPromise = null; throw err; });
  return sqlPromise;
}

export function ensureDbReady(): Promise<void> {
  return getSql().then(() => undefined);
}
