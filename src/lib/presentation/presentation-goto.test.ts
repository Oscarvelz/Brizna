/**
 * presentation-goto.test.ts — cerca de los tokens de navegación.
 *
 * Los pasos `go` nombran clientes del escenario con tokens (`:aurelio`,
 * `:lucia`, …) que el conductor sustituye desde stageCtx antes de navegar.
 * Un token que ninguna siembra asigna aterriza en una URL literal y la
 * lección señala a un fantasma (visto en el banco de la Ola 2: AD8 escena 9
 * sobre «No se encontró este cliente»). Esta cerca contrasta, en estático,
 * cada token citado por los guiones contra las claves que las siembras
 * asignan de verdad en su código — con la regla del conductor: una clave
 * terminada en «Id» también responde por su tallo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MODULES } from "./guion.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const SEED_FILES = ["stage-seeds.ts", "seeds-w2-a.ts", "seeds-w2-b.ts", "seeds-w2-c.ts", "seeds-w2-d.ts"];

function assignedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of SEED_FILES) {
    const src = readFileSync(join(HERE, f), "utf8");
    for (const m of src.matchAll(/stageCtx\.([A-Za-z]+)\s*=/g)) keys.add(m[1]);
    for (const m of src.matchAll(/stageCtx\[["']([A-Za-z]+)["']\]\s*=/g)) keys.add(m[1]);
  }
  return keys;
}

test("goto: todo token :nombre de los guiones lo asigna alguna siembra", () => {
  const keys = assignedKeys();
  const resolvable = (token: string) =>
    keys.has(token) || keys.has(`${token}Id`);
  for (const mod of MODULES) {
    for (const scene of mod.scenes) {
      for (const step of scene.steps) {
        if (step.kind !== "go") continue;
        for (const m of step.screen.matchAll(/:([a-z]+)/g)) {
          assert.ok(
            resolvable(m[1]),
            `${mod.id}/${scene.id}: el token :${m[1]} no lo asigna ninguna siembra (claves: ${[...keys].sort().join(", ")})`,
          );
        }
      }
    }
  }
});
