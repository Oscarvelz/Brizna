// Brizna on the device: the same Postgres schema, running in the browser (PGlite)
// and saved in IndexedDB, so every screen works with no internet.
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";

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

let pgPromise: Promise<PGlite> | null = null;
let sqlPromise: Promise<Sql> | null = null;
// One query at a time keeps PGlite's transaction state simple across screens.
let lane: Promise<unknown> = Promise.resolve();

async function open(): Promise<PGlite> {
  (globalThis as any).__bzTrace?.push(["db-open", "", Date.now()]);
  const pg = new PGlite((globalThis as any).__bzDb || DB_NAME, {
    relaxedDurability: false,
    parsers: { [OID_INT8]: Number, [OID_DATE]: identity, [OID_INTERVAL]: identity },
  });
  await pg.waitReady;
  (globalThis as any).__bzTrace?.push(["db-ready", "", Date.now()]);
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
  const migrations = import.meta.glob("../../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const done = (await pg.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name);
  for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
    await pg.transaction(async (tx) => {
      await tx.exec(migrations[path]);
      await tx.query("insert into _migrations (name) values ($1)", [name]);
    });
  }
  (globalThis as any).__bzTrace?.push(["db-migrated", "", Date.now()]);
  return pg;
}

export function getPglite(): Promise<PGlite> {
  pgPromise ??= open().catch((err) => { pgPromise = null; throw err; });
  return pgPromise;
}

function toSql(pg: PGlite): Sql {
  const run = <T,>(text: string, params: unknown[]) => {
    const next = lane.then(() => pg.query<T>(text, params)).then((r) => r.rows);
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

export function getSql(): Promise<Sql> {
  sqlPromise ??= getPglite().then(toSql).catch((err) => { sqlPromise = null; throw err; });
  return sqlPromise;
}

export function ensureDbReady(): Promise<void> {
  return getSql().then(() => undefined);
}
