// 1.5.93 (campaña Prejuicio, BZ-6 — la cerca de censo que D4 no tuvo): the backup's
// local layer is captured by ENUMERATION with a short list of exclusions over an
// open universe — the exact shape that let the device-lock credential, the PKCE
// verifiers and the weather packs travel in 1.5.52–1.5.92. This fence pins the
// census both ways: every machinery family the app is known to write must be
// EXCLUDED by the predicate, every user family must TRAVEL, and any NEW literal
// localStorage writer key found in the source must already be classified —
// travel on purpose or excluded on purpose — before this test goes green again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLocalStore, collectLocalStore, localStoreExcluded, sanitizeLocalStore } from "./local-store-backup.ts";

// Machinery and secrets: these must NEVER travel (predicate must exclude them).
const EXCLUDED_KEYS = [
  "brizna-auth",
  "brizna-auth-abc123-code-verifier",
  "brizna-auth-flow-9f2-code-verifier",
  "brizna-auth-flows-code-verifier",
  "brizna.lastUser",
  "brizna.lock.3f2a91c0-0000-4000-8000-000000000000",
  "brizna.lock",
  "brizna.clima.25.7617,-80.1918",
  "brizna.dbOwner",
  "brizna.db-gen",
  "brizna.db-failures",
  "brizna.device",
  "brizna-quiet-boot",
  "ols.had-user",
  "bz-dict-error",
  "ols-weather",
  "brizna.sync.3f2a91c0-0000-4000-8000-000000000000",
  "brizna.sync.copied.3f2a91c0-0000-4000-8000-000000000000",
  "brizna.screens.3f2a91c0-0000-4000-8000-000000000000",
  "brizna.ensured.idb://brizna.2026-11-16",
  "ols-outbox",
  "ols-outbox.local",
  "ols-outbox.3f2a91c0-0000-4000-8000-000000000000",
  "ols-outbox-failed.3f2a91c0-0000-4000-8000-000000000000",
];

// What the user authored or chose: these must TRAVEL (predicate must not exclude).
const TRAVEL_KEYS = [
  "ols-pad-folders",
  // 1.6.00 (BZ-30): los borradores del Bloc viven en localStorage desde esta
  // versión — son texto del usuario, viajan como el catálogo de carpetas.
  "ols-note-unsaved",
  "ols-note-main",
  "ols-note-side",
  "ols-note-pages",
  "ols-pad-draft",
  "ols-pad-0",
  "ols-pad-123",
  "ols-look-v2",
  "ols-ajustes-order",
  "ols-weather-place",
  "bz-estudio-view",
  "ols-agenda-off",
  "ols-agenda-off-pin",
  "ols-inventory-pin",
  "ols-inventory-pin-v2",
  "ols-week-open",
  "ols-week-pin",
];

test("censo: toda familia de maquinaria y secretos queda fuera de la copia", () => {
  for (const k of EXCLUDED_KEYS) assert.equal(localStoreExcluded(k), true, `debe excluirse: ${k}`);
});

test("censo: lo que el usuario escribió o eligió sí viaja", () => {
  for (const k of TRAVEL_KEYS) assert.equal(localStoreExcluded(k), false, `debe viajar: ${k}`);
});

test("censo: ningún escritor literal nuevo nace sin clasificar", () => {
  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const known = new Set([...EXCLUDED_KEYS, ...TRAVEL_KEYS]);
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(name) || /\.test\.ts$/.test(name)) continue;
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(/localStorage\.setItem\(\s*"([^"]+)"/g)) found.add(m[1]);
      for (const m of text.matchAll(/localStorage\.setItem\(\s*'([^']+)'/g)) found.add(m[1]);
    }
  };
  walk(srcRoot);
  assert.ok(found.size > 0, "el escaneo debe encontrar escritores literales");
  for (const k of found) {
    assert.ok(
      known.has(k) || localStoreExcluded(k),
      `clave nueva sin clasificar: "${k}" — decide si viaja o se excluye y anótala en el censo`,
    );
  }
});

function fakeStore(init: Record<string, string>) {
  const map = new Map(Object.entries(init));
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
}

test("la copia no se lleva la credencial del bloqueo, los verificadores ni el clima", () => {
  const store = fakeStore({
    "brizna.lock.u1": "native",
    "brizna-auth-x-code-verifier": "pkce-secret",
    "brizna.clima.25.7,-80.1": "{\"pack\":true}",
    "ols-pad-folders": "[{\"id\":\"f1\"}]",
  });
  const copy = collectLocalStore(store);
  assert.deepEqual(Object.keys(copy), ["ols-pad-folders"]);
});

test("un archivo hecho a mano no puede plantar lo excluido al restaurar", () => {
  const store = fakeStore({});
  applyLocalStore(store, {
    "brizna.lock.u1": "planted",
    "brizna-auth-x-code-verifier": "planted",
    "brizna.clima.25.7,-80.1": "planted",
    "ols-pad-folders": "[]",
  });
  assert.equal(store.getItem("brizna.lock.u1"), null);
  assert.equal(store.getItem("brizna-auth-x-code-verifier"), null);
  assert.equal(store.getItem("brizna.clima.25.7,-80.1"), null);
  assert.equal(store.getItem("ols-pad-folders"), "[]");
});

test("los packs de clima ya no se comen el presupuesto de las carpetas", () => {
  const raw: Record<string, string> = { "ols-pad-folders": "[{\"id\":\"f1\"}]" };
  for (let i = 0; i < 40; i += 1) raw[`brizna.clima.25.${i},-80.${i}`] = "x".repeat(70_000);
  const clean = sanitizeLocalStore(raw);
  assert.equal(clean["ols-pad-folders"], "[{\"id\":\"f1\"}]");
  assert.equal(Object.keys(clean).some((k) => k.startsWith("brizna.clima.")), false);
});
