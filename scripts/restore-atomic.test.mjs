// Movimiento 2 (auditoría 2026-11-08, hallazgos 13 y 18): restore atomicity invariants.
//
// Why source invariants plus an engine check, not an end-to-end restore test:
// src/lib/server/lawn.ts cannot be imported by `node --test` — it resolves "@/…"
// aliases and @tanstack/react-start and reads migrations via import.meta.glob, and
// this repo has no bundler-based test runner (the src tests only import relative
// TS modules). So the end-to-end "restore an old-format backup on a disposable
// database" test stays BLOCKED on a runner that can load lawn.ts; what can be
// pinned today is (a) the shape of the restore path, so a future edit cannot
// silently un-wrap the transaction or bring back per-row legacy inserts, and
// (b) that the PGlite transaction primitive withTransaction is built on really
// rolls back — the same primitive src/spa/sync.ts already relies on.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { projectRoot } from "./with-app-env.mjs";

const root = projectRoot();
const lawn = readFileSync(join(root, "src/lib/server/lawn.ts"), "utf8");
const spaDb = readFileSync(join(root, "src/spa/db.ts"), "utf8");
const serverDb = readFileSync(join(root, "src/lib/db.ts"), "utf8");
const backupWatch = readFileSync(join(root, "src/components/backup-watch.tsx"), "utf8");

function applyBackupBody() {
  const start = lawn.indexOf("async function applyBackup(");
  const end = lawn.indexOf("export const restoreBackup", start);
  assert.ok(start >= 0 && end > start, "applyBackup not found");
  return lawn.slice(start, end);
}

test("applyBackup restores inside ONE withTransaction, safety copy before, schedule after", () => {
  const body = applyBackupBody();
  const snap = body.indexOf("await snapshotBackup(userId, true);");
  const tx = body.indexOf("await withTransaction(");
  const schedule = body.indexOf("await ensureScheduleForUser(userId);");
  assert.ok(snap >= 0 && tx > snap, "the pre-restore safety copy must stay outside/before the transaction");
  assert.ok(schedule > tx, "schedule top-up must run after the transaction commits");
  assert.equal(body.indexOf("await ensureScheduleForUser(userId);", tx), schedule, "no schedule top-up inside the transaction");
});

test("both database modules export the withTransaction contract", () => {
  assert.match(spaDb, /export function withTransaction/);
  assert.match(spaDb, /pg\.transaction\(/);
  assert.match(serverDb, /export async function withTransaction/);
});

test("legacy backup rows go through the bulk path, not per-row inserts", () => {
  const body = applyBackupBody();
  assert.match(body, /legacyJobRows/);
  assert.match(body, /legacyPaymentRows/);
  assert.match(body, /bulkRestore\("jobs", legacyJobRows, sql\)/);
  assert.match(body, /bulkRestore\("payments", legacyPaymentRows, sql\)/);
  assert.ok(!body.includes("coalesce($6::timestamptz, now())"), "old per-row legacy payment insert is back");
});

test("snapshot dedup and the watcher no-op are wired (hallazgo 13)", () => {
  assert.match(lawn, /backupContentChecksum/);
  assert.match(lawn, /payload->>'contentChecksum'/);
  assert.match(backupWatch, /__bzWriteEpoch/);
  assert.match(backupWatch, /whenIdle/);
});

test("photos guard: restore and sync refuse rather than wipe photos (hallazgo 19)", () => {
  assert.match(applyBackupBody(), /PHOTOS_ENABLED/);
  const sync = readFileSync(join(root, "src/spa/sync.ts"), "utf8");
  assert.match(sync, /photos would be lost by this sync/);
});

test("PGlite transactions roll back on a mid-way failure (the primitive withTransaction uses)", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  try {
    await pg.exec("create table t (id int primary key, v text)");
    await pg.query("insert into t values (1, 'before')");
    await assert.rejects(
      pg.transaction(async (tx) => {
        await tx.query("delete from t");
        await tx.query("insert into t values (2, 'half-restored')");
        throw new Error("crash mid-restore");
      }),
      /crash mid-restore/,
    );
    const rows = (await pg.query("select id, v from t order by id")).rows;
    assert.deepEqual(rows, [{ id: 1, v: "before" }]);
  } finally {
    await pg.close();
  }
});
