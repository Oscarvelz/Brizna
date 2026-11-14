/**
 * presentation-surfaces.mjs — genera la foto de superficies de Brizna
 * (FENCE-DESIGN §4): los conjuntos estables que la Presentación vigila —
 * valores data-spot y data-spot-alt (por token), valores data-present
 * (literales y pasados por prop), ids de tema del Manual, ids de pliegue de
 * Ajustes (aj-*), ids de Cifras (cif-*) y rutas de la app.
 *
 * Salida determinista (conjuntos ordenados, sin marcas de tiempo) en
 * src/lib/presentation/surface-baseline.json. La cerca de cobertura
 * (presentation-coverage.test.ts) recalcula los mismos conjuntos en la
 * prueba y exige que cada token nuevo esté en el registro de anclas o
 * exento, y que ningún token registrado desaparezca sin exención.
 *
 * Uso: `node scripts/presentation-surfaces.mjs` (escribe la foto) o con
 * `--print` (la imprime sin escribir). La lógica de extracción vive aquí en
 * su forma canónica; la prueba la espeja en TS.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(SRC, "lib", "presentation", "surface-baseline.json");

function walk(dir, exts, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(p);
  }
  return acc;
}

function extract() {
  const spot = new Set();
  const present = new Set();
  const topics = new Set();
  const folds = new Set();
  const cif = new Set();

  for (const file of walk(SRC, [".tsx", ".ts"])) {
    // La propia carpeta de la Presentación es la vigilante, no una superficie:
    // sus comentarios y pruebas citan literales que no son emisiones.
    if (file.includes("/lib/presentation/")) continue;
    const text = readFileSync(file, "utf8");
    const base = file.split("/").pop() ?? "";
    for (const m of text.matchAll(/data-spot(?:-alt)?="([^"]+)"/g)) {
      for (const token of (m[1] ?? "").split(/\s+/)) if (token) spot.add(token);
    }
    // La familia Field del alta emite data-spot={topic}: el valor vive en la prop.
    for (const m of text.matchAll(/\btopic="([a-z0-9-]+)"/g)) spot.add(m[1]);
    // data-present con expresión (ternarios): solo los resultados de rama
    // (`? "x"` y `: "y"`), nunca las cadenas comparadas (`=== "z"`).
    for (const m of text.matchAll(/data-present=\{[^}]*\}/g)) {
      for (const q of m[0].matchAll(/[?:]\s*"([a-z0-9-]+)"/g)) present.add(q[1]);
    }
    for (const m of text.matchAll(/data-present="([a-z0-9-]+)"/g)) present.add(m[1]);
    for (const m of text.matchAll(/(?<![\w-])present(?:Confirm|Extra|Alt)?="([a-z0-9-]+)"/g)) present.add(m[1]);
    for (const m of text.matchAll(/present:\s*"([a-z0-9-]+)"/g)) present.add(m[1]);
    // El mapa de pestañas de app-shell: pares "ruta": "valor-present".
    for (const m of text.matchAll(/"\/[a-z]*":\s*"([a-z0-9-]+)"/g)) present.add(m[1]);
    for (const m of text.matchAll(/\bid="(aj-[a-z0-9-]+)"/g)) folds.add(m[1]);
    for (const m of text.matchAll(/\bid="(cif-[a-z0-9-]+)"/g)) cif.add(m[1]);
    if (base === "topics.ts") {
      for (const m of text.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)) topics.add(m[1]);
    }
  }

  const routes = new Set();
  for (const file of walk(join(SRC, "routes"), [".tsx"])) {
    const parts = relative(join(SRC, "routes"), file)
      .replace(/\.tsx$/, "")
      .split(".")
      .filter((p) => p !== "index")
      .map((p) => (p.startsWith("$") ? `:${p.slice(1)}` : p));
    routes.add("/" + parts.join("/"));
  }

  return {
    spot: [...spot].sort(),
    present: [...present].sort(),
    topics: [...topics].sort(),
    folds: [...folds].sort(),
    cif: [...cif].sort(),
    routes: [...routes].sort(),
  };
}

const baseline = extract();
if (process.argv.includes("--print")) {
  process.stdout.write(JSON.stringify(baseline, null, 2) + "\n");
} else {
  writeFileSync(OUT, JSON.stringify(baseline, null, 2) + "\n");
  process.stdout.write(
    `surface-baseline.json: spot=${baseline.spot.length} present=${baseline.present.length} topics=${baseline.topics.length} folds=${baseline.folds.length} cif=${baseline.cif.length} routes=${baseline.routes.length}\n`,
  );
}
