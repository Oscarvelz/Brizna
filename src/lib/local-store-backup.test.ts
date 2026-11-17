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
import { applyLocalStore, collectLocalStore, localStoreExcluded, localStoreOmissions, sanitizeLocalStore } from "./local-store-backup.ts";

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
  "ols.last-email",
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
  // 1.6.01 (R2C-1): la familia de la Presentación — la fotografía del
  // guardián es una foto del almacén ENTERO de este aparato (credenciales
  // vetadas incluidas como contenido): jamás viaja ni se planta.
  "bz.pres.prefguard",
  "bz.pres.sessionguard",
  "bz.pres.launch",
  "bz.pres.stay",
  "bz.pres.offer.u1",
  "bz.seen.pres",
  // 1.6.01 (R2C-7): la contabilidad del bloqueo es de este aparato.
  "brizna.lockSeen.3f2a91c0-0000-4000-8000-000000000000",
  // 1.6.09 (Prejuicio R3, R3C-2/3/4): la credencial «keep» de la sesión, la
  // marca de ediciones provisionales (contabilidad de sync) y la caché del
  // cielo con hora — la segunda caza las halló viajando contra la ley de la
  // cabecera; su censo de escritores no las vio porque nacen de constantes,
  // no de literales, y aquí quedan nombradas.
  "ols.keep-bearer",
  "brizna.prov-edited",
  "brizna.sky",
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
  // 1.6.01 (R2C-7): la demora de re-bloqueo es una elección del usuario,
  // no una credencial — viaja como cualquier preferencia.
  "brizna.lockAfter",
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

test("1.6.01 (R2C-1): la fotografía del sello no viaja ni se planta", () => {
  const store = fakeStore({
    "bz.pres.prefguard": "{\"brizna.lock.u1\":\"native\"}",
    "bz.seen.pres": "1",
    "ols-pad-folders": "[]",
  });
  const copy = collectLocalStore(store);
  assert.deepEqual(Object.keys(copy), ["ols-pad-folders"]);
  const target = fakeStore({});
  applyLocalStore(target, {
    "bz.pres.prefguard": "{\"brizna.lock.u1\":\"planted\"}",
    "ols-pad-folders": "[{\"id\":\"f9\"}]",
  });
  assert.equal(target.getItem("bz.pres.prefguard"), null);
  assert.equal(target.getItem("ols-pad-folders"), "[{\"id\":\"f9\"}]");
});

test("1.6.01 (R2C-4): aplicar la capa es todo o nada — un fallo a mitad revierte lo escrito", () => {
  const map = new Map(Object.entries({ "ols-look-v2": "viejo", "ols-week-pin": "1" }));
  const store = {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (k === "bz-estudio-view") throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
  assert.throws(() =>
    applyLocalStore(store, { "ols-look-v2": "nuevo", "bz-estudio-view": "grid", "ols-week-pin": "0" }),
  );
  // Lo ya escrito volvió a su valor anterior; lo no intentado quedó intacto.
  assert.equal(store.getItem("ols-look-v2"), "viejo");
  assert.equal(store.getItem("ols-week-pin"), "1");
});

test("1.6.01 (R2C-5): las omisiones por tamaño se cuentan; lo excluido por ley no cuenta", () => {
  const raw: Record<string, string> = {
    "ols-pad-folders": "[]",
    "ols-note-main": "x".repeat(400_001),
    "brizna.lock.u1": "native",
    "brizna.clima.25.7,-80.1": "x".repeat(500_000),
  };
  assert.equal(localStoreOmissions(raw), 1);
  assert.equal(localStoreOmissions({ "ols-pad-folders": "[]" }), 0);
});
