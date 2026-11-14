// presentation-progress.test.ts — cercas de la línea general de progreso
// (ley universal de Oscar, 2026-11-14): la cuenta honesta del índice.
// Un módulo terminado cuenta entero; uno a medias, la fracción de sí mismo
// ya caminada (su escena guardada sobre su longitud); uno sin tocar, cero.
// Run: node --experimental-strip-types --test src/lib/presentation/presentation-progress.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { overallProgress } from "./progress.ts";
import { MODULES } from "./guion.ts";

const mods = (counts: number[]) =>
  counts.map((sceneCount, i) => ({ id: `m${i}`, ready: true, sceneCount }));

test("el 50% exacto de Oscar: dos de cuatro módulos terminados", () => {
  const p = overallProgress(mods([4, 4, 2, 2]), {
    m0: { scene: 4, done: true },
    m3: { scene: 2, done: true },
  });
  assert.equal(p.percent, 50);
  assert.equal(p.remaining, 50);
  assert.equal(p.finished, 2);
  assert.equal(p.inProgress, 0);
  assert.equal(p.total, 4);
});

test("un módulo a medias cuenta su fracción caminada, ni entero ni cero", () => {
  const p = overallProgress(mods([4, 4]), {
    m0: { scene: 4, done: true },
    m1: { scene: 2, done: false }, // la mitad de sí mismo
  });
  // (1 + 0.5) / 2 = 75%
  assert.equal(p.percent, 75);
  assert.equal(p.remaining, 25);
  assert.equal(p.finished, 1);
  assert.equal(p.inProgress, 1);
});

test("sin tocar nada, la línea dice la verdad: 0% y todo por estudiar", () => {
  const p = overallProgress(mods([3, 3]), {});
  assert.equal(p.percent, 0);
  assert.equal(p.remaining, 100);
  assert.equal(p.finished, 0);
  assert.equal(p.inProgress, 0);
});

test("lanzado pero sin caminar (escena 0) no infla la cuenta", () => {
  const p = overallProgress(mods([3, 3]), { m0: { scene: 0, done: false } });
  assert.equal(p.percent, 0);
  assert.equal(p.inProgress, 0);
});

test("la fracción nunca pasa de entera aunque la escena guardada desborde", () => {
  const p = overallProgress(mods([2]), { m0: { scene: 99, done: false } });
  assert.equal(p.percent, 100);
  assert.equal(p.inProgress, 1);
});

test("el catálogo real alimenta la línea: 23 módulos listos cuentan", () => {
  const real = MODULES.map((m) => ({ id: m.id, ready: m.ready, sceneCount: m.scenes.length }));
  const p = overallProgress(real, {});
  assert.equal(p.total, 23);
  assert.equal(p.percent, 0);
});

test("el índice pinta la línea: barra con su porcentaje y los tres conteos", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/presentation/presentaciones.tsx"),
    "utf8",
  );
  assert.match(src, /overallProgress/);
  assert.match(src, /role="progressbar"/);
  assert.match(src, /de la app/);
  assert.match(src, /en curso/);
});
