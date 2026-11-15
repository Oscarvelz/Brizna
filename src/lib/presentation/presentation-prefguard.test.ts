// Presentation pref guard (principle 13 with engine teeth): demonstrations
// touch device preferences that live OUTSIDE the swapped book (density,
// Estudio view, theme, locale — localStorage). The guard photographs the
// store on stage entry and restores it on every exit, so a scene that leaves
// a toggle changed — or an exit mid-scene, or a hard death — can never leave
// the user's real preferences altered. The browser proof runs on the bench;
// these probes pin the guard's shape: snapshot fidelity, created-key removal,
// deleted-key revival, and the exclusions that must never roll back
// (presentation progress, the guard's own keys, sb-* session tokens).
// Run: node --experimental-strip-types --test src/lib/presentation/presentation-prefguard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { armPrefGuard, restorePrefGuard, PREF_GUARD_KEY, type StoreLike } from "./pref-guard.ts";

function toyStore(seed: Record<string, string>): StoreLike & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

const HOUSE = {
  "ols-density": "full",
  "ols-locale": "es",
  "bz-estudio-view": "estudio",
  "bz.seen.pres": "{\"done\":[]}",
  "sb-xyz-auth-token": "token-1",
};

test("a demonstration's preference changes are fully undone on restore", () => {
  const store = toyStore({ ...HOUSE });
  armPrefGuard(store);
  // La demostración: cambia la densidad, voltea el Estudio, borra el idioma
  // y crea una preferencia nueva.
  store.setItem("ols-density", "quad");
  store.setItem("bz-estudio-view", "asesor");
  store.removeItem("ols-locale");
  store.setItem("ols-week-open", "3");
  assert.equal(restorePrefGuard(store), true);
  const after = store.dump();
  assert.equal(after["ols-density"], "full");
  assert.equal(after["bz-estudio-view"], "estudio");
  assert.equal(after["ols-locale"], "es");
  assert.ok(!("ols-week-open" in after), "a key the demonstration created must be removed");
  assert.ok(!(PREF_GUARD_KEY in after), "the photograph retires itself");
});

test("the exclusions never roll back", () => {
  const store = toyStore({ ...HOUSE });
  armPrefGuard(store);
  store.setItem("bz.seen.pres", "{\"done\":[\"q0-vuelta\"]}");
  store.setItem("sb-xyz-auth-token", "token-2-refreshed");
  assert.equal(restorePrefGuard(store), true);
  const after = store.dump();
  assert.equal(after["bz.seen.pres"], "{\"done\":[\"q0-vuelta\"]}", "presentation progress is real and stays");
  assert.equal(after["sb-xyz-auth-token"], "token-2-refreshed", "a refreshed session token must not be replayed");
});

test("arming twice keeps the ORIGINAL photograph; restoring unarmed is a no-op", () => {
  const store = toyStore({ ...HOUSE });
  armPrefGuard(store);
  store.setItem("ols-density", "list");
  armPrefGuard(store); // una segunda entrada no refotografía la casa cambiada
  assert.equal(restorePrefGuard(store), true);
  assert.equal(store.dump()["ols-density"], "full");
  assert.equal(restorePrefGuard(store), false, "nothing armed, nothing restored");
});

test("stage.ts wires the guard: armed on entry, restored on exit and at boot", () => {
  const stageSrc = readFileSync(join(import.meta.dirname, "stage.ts"), "utf8");
  const enter = stageSrc.slice(stageSrc.indexOf("export async function enterStage"), stageSrc.indexOf("export async function exitStage"));
  const exit = stageSrc.slice(stageSrc.indexOf("export async function exitStage"));
  assert.ok(enter.indexOf("armPrefGuardHere()") >= 0 && enter.indexOf("armPrefGuardHere()") < enter.indexOf("switchDatabase("),
    "enterStage must arm the guard before switching books");
  assert.ok(exit.indexOf("restorePrefGuardHere()") > exit.indexOf("switchDatabase(null)") && exit.indexOf("restorePrefGuardHere()") < exit.indexOf("dispatchSwitch()"),
    "exitStage must restore before the remount reads preferences");
  const boot = stageSrc.slice(stageSrc.indexOf("if (!(globalThis as"));
  assert.ok(boot.indexOf("restorePrefGuardHere()") >= 0 && boot.indexOf("restorePrefGuardHere()") < boot.indexOf("deleteStageStore()"),
    "the boot sweep must restore a dead stage's preferences first");
});
