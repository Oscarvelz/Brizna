// Presentation seal (Cerca 0 foundation): source probes in the house family
// style (see manual-lint.test.ts). The browser proof — real book byte-identical
// after a full module, the ✕ and a hard death — runs on the bench; these probes
// pin the seal's shape in source so a wave cannot quietly unseal it: the stage
// flag is memory-only, the stage store is a different database, every egress
// path reads the seal, the DB override is assigned in exactly two places, the
// enter/exit order is wipe → seal → switch / switch → delete → unseal, and the
// server twin refuses to stage against Neon.
// Run: node --experimental-strip-types --test src/lib/presentation/presentation-seal.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const stageSrc = read("lib/presentation/stage.ts");
const sealSrc = read("lib/presentation/seal-flag.ts");
const spaDbSrc = read("spa/db.ts");
const serverDbSrc = read("lib/db.ts");

test("the stage flag is memory-only: no persisted stage key, seal-flag is a leaf", () => {
  for (const [name, src] of [["stage.ts", stageSrc], ["seal-flag.ts", sealSrc]] as const) {
    assert.ok(
      !/(localStorage|sessionStorage)\s*\.\s*setItem/.test(src),
      `${name}: the stage flag must never be written to storage (a cold boot always opens the real book)`,
    );
  }
  assert.ok(!/^\s*import\s/m.test(sealSrc), "seal-flag.ts must stay a leaf module with no imports");
  assert.match(sealSrc, /export function sealedOn\(\)/);
  assert.match(sealSrc, /export function setSealed\(/);
});

test("the stage store is a different database, reached through dbName()'s override seam", () => {
  const stageName = stageSrc.match(/STAGE_DB_NAME\s*=\s*"([^"]+)"/)?.[1];
  const realName = spaDbSrc.match(/export const DB_NAME\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(stageName, "stage.ts: STAGE_DB_NAME not found");
  assert.ok(realName, "spa/db.ts: DB_NAME not found");
  assert.notEqual(stageName, realName, "the stage must open a different store than the real book");
  const dbNameBody = spaDbSrc.slice(spaDbSrc.indexOf("function dbName()"), spaDbSrc.indexOf("function dbName()") + 500);
  assert.match(dbNameBody, /__bzDb/, "dbName() must honour the __bzDb override the switch sets");
  assert.match(spaDbSrc, /export async function switchDatabase\(/, "spa/db.ts must export switchDatabase");
  assert.match(stageSrc, /export const STAGE_EVENT\s*=\s*"bz-stage-switch"/);
});

test("every egress path reads the seal", () => {
  const gated: Array<[string, string]> = [
    ["spa/sync.ts", "cloud sync (syncNow and its tick)"],
    ["lib/offline-queue.ts", "the offline queue's network flush"],
    ["components/backup-watch.tsx", "the automatic backup tick"],
    ["components/native-host.tsx", "the native widget / reminder refresh"],
    ["components/offline-banner.tsx", "the network flush itself"],
  ];
  for (const [rel, what] of gated) {
    const src = read(rel);
    assert.match(src, /sealedOn/, `${rel}: ${what} must no-op while sealedOn()`);
    assert.match(src, /presentation\/seal-flag/, `${rel}: the seal must come from the leaf seal-flag module`);
  }
});

test("the __bzDb override is assigned only in the db seam and the stage", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts")) files.push(p);
    }
  };
  walk(SRC);
  const allowed = new Set(["spa/db.ts", "lib/presentation/stage.ts"]);
  const offenders: string[] = [];
  for (const f of files) {
    if (/__bzDb\b\s*=(?![=>])/.test(readFileSync(f, "utf8"))) {
      const rel = f.slice(SRC.length + 1).split("\\").join("/");
      if (!allowed.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], "a third assignment site for __bzDb would be a second door into the stage store");
  assert.match(spaDbSrc, /__bzDb\b\s*=(?![=>])/, "spa/db.ts's switchDatabase must be the assignment site");
});

test("enter wipes before opening; exit switches back, deletes the stage, then unseals", () => {
  const enter = stageSrc.slice(stageSrc.indexOf("export async function enterStage"), stageSrc.indexOf("export async function exitStage"));
  const exit = stageSrc.slice(stageSrc.indexOf("export async function exitStage"));
  assert.ok(enter.length > 0 && exit.length > 0, "stage.ts must export enterStage and exitStage");
  const wipeAt = enter.search(/deleteStageStore\(\)/);
  const sealAt = enter.indexOf("setSealed(true)");
  const switchAt = enter.indexOf("switchDatabase(");
  assert.ok(wipeAt >= 0 && switchAt >= 0 && wipeAt < switchAt, "enterStage must wipe any prior stage store before switching to it");
  assert.ok(sealAt >= 0 && sealAt < switchAt, "enterStage must setSealed(true) BEFORE switching databases");
  const backAt = exit.indexOf("switchDatabase(null)");
  const deleteAt = exit.search(/deleteStageStore\(\)/);
  const unsealAt = exit.indexOf("setSealed(false)");
  assert.ok(backAt >= 0 && deleteAt > backAt, "exitStage must switch back to the real book before deleting the stage store");
  assert.ok(unsealAt > deleteAt, "exitStage must setSealed(false) only AFTER the stage store is deleted");
});

test("the server twin refuses to stage against Neon", () => {
  const at = serverDbSrc.indexOf("export async function switchDatabase");
  assert.ok(at >= 0, "lib/db.ts must export switchDatabase with the same contract");
  const body = serverDbSrc.slice(at, at + 1500);
  assert.match(body, /dbSource\s*===\s*"neon"/, "lib/db.ts switchDatabase must check for Neon");
  assert.match(body, /throw/, "lib/db.ts switchDatabase must throw on Neon — presentations never stage against a shared cloud DB");
  assert.match(body, /pglite-stage/, "lib/db.ts switchDatabase must point the PGLite fallback at the sibling stage directory");
});
