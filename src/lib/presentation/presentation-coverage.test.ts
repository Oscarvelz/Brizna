/**
 * presentation-coverage.test.ts — la foto de superficies contra el árbol
 * vivo (FENCE-DESIGN §4: «un alta sin escena es un defecto silencioso»).
 *
 * Recalcula los mismos conjuntos que scripts/presentation-surfaces.mjs
 * guarda en surface-baseline.json y exige:
 *  - Ninguna superficie desaparece en silencio: todo token de la foto que
 *    ya no está en el árbol falla, salvo exención «retirado» en waivers.ts.
 *  - Ninguna superficie de ancla nace sin nombre: todo token data-spot o
 *    data-present nuevo (en el árbol pero no en la foto) debe tener fila
 *    en el registro de anclas o una exención — una superficie nueva sin
 *    registro es exactamente el hueco que esta cerca existe para ver.
 * Los temas del Manual, los pliegues, las cifras y las rutas vigilan solo
 * desapariciones (sus altas las gobiernan el lint del Manual y el resto
 * de la suite); la foto se regenera con el generador cuando una ola mueve
 * superficies a propósito.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ANCHORS } from "./anchors.ts";
import { WAIVERS } from "./waivers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");

type Baseline = {
  spot: string[];
  present: string[];
  topics: string[];
  folds: string[];
  cif: string[];
  routes: string[];
};

const baseline = JSON.parse(readFileSync(join(HERE, "surface-baseline.json"), "utf8")) as Baseline;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function extract(): Baseline {
  const spot = new Set<string>();
  const present = new Set<string>();
  const topics = new Set<string>();
  const folds = new Set<string>();
  const cif = new Set<string>();
  for (const file of walk(SRC)) {
    if (file.includes("/lib/presentation/")) continue;
    const text = readFileSync(file, "utf8");
    const base = file.split("/").pop() ?? "";
    for (const m of text.matchAll(/data-spot(?:-alt)?="([^"]+)"/g)) {
      for (const token of (m[1] ?? "").split(/\s+/)) if (token) spot.add(token);
    }
    for (const m of text.matchAll(/\btopic="([a-z0-9-]+)"/g)) spot.add(m[1] ?? "");
    for (const m of text.matchAll(/data-present="([a-z0-9-]+)"/g)) present.add(m[1] ?? "");
    for (const m of text.matchAll(/(?<![\w-])present(?:Confirm|Extra|Alt)?="([a-z0-9-]+)"/g)) present.add(m[1] ?? "");
    for (const m of text.matchAll(/"\/[a-z]*":\s*"([a-z0-9-]+)"/g)) present.add(m[1] ?? "");
    for (const m of text.matchAll(/data-present=\{[^}]*\}/g)) {
      for (const q of m[0].matchAll(/[?:]\s*"([a-z0-9-]+)"/g)) present.add(q[1] ?? "");
    }
    for (const m of text.matchAll(/\bid="(aj-[a-z0-9-]+)"/g)) folds.add(m[1] ?? "");
    for (const m of text.matchAll(/\bid="(cif-[a-z0-9-]+)"/g)) cif.add(m[1] ?? "");
    if (base === "topics.ts") {
      for (const m of text.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)) topics.add(m[1] ?? "");
    }
  }
  const routes = new Set<string>();
  for (const file of walk(join(SRC, "routes"))) {
    if (!file.endsWith(".tsx")) continue;
    const parts = relative(join(SRC, "routes"), file)
      .replace(/\.tsx$/, "")
      .split(".")
      .filter((p) => p !== "index")
      .map((p) => (p.startsWith("$") ? `:${p.slice(1)}` : p));
    routes.add("/" + parts.join("/"));
  }
  const sorted = (s: Set<string>) => [...s].sort();
  return {
    spot: sorted(spot),
    present: sorted(present),
    topics: sorted(topics),
    folds: sorted(folds),
    cif: sorted(cif),
    routes: sorted(routes),
  };
}

const waived = new Set(WAIVERS.map((w) => w.token));
const retired = new Set(WAIVERS.filter((w) => w.reason === "retirado").map((w) => w.token));

test("cobertura: ninguna superficie desaparece sin exención de retirado", () => {
  const now = extract();
  const sets: [keyof Baseline, string[]][] = [
    ["spot", now.spot],
    ["present", now.present],
    ["topics", now.topics],
    ["folds", now.folds],
    ["cif", now.cif],
    ["routes", now.routes],
  ];
  for (const [name, current] of sets) {
    const alive = new Set(current);
    for (const token of baseline[name]) {
      assert.ok(
        alive.has(token) || retired.has(token),
        `${name}: «${token}» estaba en la foto y ya no está en el árbol (¿retirado sin exención?)`,
      );
    }
  }
});

test("cobertura: toda superficie de ancla nueva tiene registro o exención", () => {
  const now = extract();
  const registered = new Set(ANCHORS.map((a) => a.value));
  for (const [name, current] of [["spot", now.spot], ["present", now.present]] as const) {
    const known = new Set(baseline[name]);
    for (const token of current) {
      if (known.has(token)) continue;
      assert.ok(
        registered.has(token) || waived.has(token),
        `${name}: «${token}» es nuevo y no tiene fila en el registro ni exención`,
      );
    }
  }
});
