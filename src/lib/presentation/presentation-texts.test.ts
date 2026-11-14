/**
 * presentation-texts.test.ts — cercas de texto de los guiones
 * (FENCE-DESIGN §8; PLAN §0.2: explicación total, pies cortos, bilingüe
 * desde el nacimiento).
 *
 *  Bilingüe: todo pie, contexto, título, promesa, clave de búsqueda y
 *       texto tecleado de los seis manifiestos es un par [es, en] de dos
 *       cadenas no vacías — ningún texto nace en un solo idioma.
 *  Pies cortos: cada pie Y cada contexto mide ≤15 palabras en AMBOS
 *       idiomas (la ley de brevedad manda sobre el avance; el contexto
 *       es un pie más, no un párrafo).
 *  Duración: la duración anunciada nace del reloj del guion —
 *       moduleSeconds(mod, lang) > 0 y durationLabel(mod, lang) no vacío
 *       para cada módulo listo, en ambos idiomas; y ningún manifiesto
 *       trae un campo de duración escrito a mano (duration, duracion,
 *       minutos…): la cifra se calcula, no se declara.
 *  Nombres: cada palabra clave de búsqueda, en minúsculas, aparece como
 *       subcadena en el texto del Manual (src/lib/manual/topics.ts) o en
 *       el código de alguno de los archivos de las anclas que la escena
 *       cita — las claves solo usan palabras reales de la app, en el
 *       vocabulario del usuario.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { anchorById } from "./anchors.ts";
import { durationLabel, MODULES as ALL_MODULES, moduleSeconds } from "./guion.ts";
import type { Module, Pair, Step } from "./guion.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");
/** La escalera entera desde el registro único: un módulo nuevo entra en las
 * cercas el día que nace `ready`, sin tocar este archivo. */
const MODULES: Module[] = ALL_MODULES.filter((m) => m.ready);
const MAX_WORDS = 15;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function assertPair(pair: Pair, what: string) {
  assert.ok(Array.isArray(pair) && pair.length === 2, `${what}: no es un par [es, en]`);
  for (const lang of [0, 1] as const) {
    assert.equal(typeof pair[lang], "string", `${what}: el lado ${lang} no es texto`);
    assert.ok(pair[lang].trim().length > 0, `${what}: el lado ${lang} está vacío`);
  }
}

function assertPie(pair: Pair, what: string) {
  assertPair(pair, what);
  for (const lang of [0, 1] as const) {
    const n = words(pair[lang]);
    assert.ok(n <= MAX_WORDS, `${what}: ${n} palabras (> ${MAX_WORDS}) en «${pair[lang]}»`);
  }
}

function stepPies(step: Step): { caption?: Pair; contexto?: Pair }[] {
  const out: { caption?: Pair; contexto?: Pair }[] = [];
  if ("caption" in step && step.caption) out.push({ caption: step.caption, contexto: step.contexto });
  return out;
}

test("bilingüe y pies cortos: todo texto de los guiones es un par ≤15 palabras", () => {
  for (const mod of MODULES) {
    assertPair(mod.title, `${mod.id} título`);
    assertPair(mod.promise, `${mod.id} promesa`);
    for (const ch of mod.chapters) assertPair(ch.title, `${mod.id}/${ch.id} capítulo`);
    for (const scene of mod.scenes) {
      for (const key of scene.keys) assertPair(key, `${mod.id}/${scene.id} clave`);
      for (const step of scene.steps) {
        for (const pie of stepPies(step)) {
          assertPie(pie.caption as Pair, `${mod.id}/${scene.id} pie`);
          if (pie.contexto) assertPie(pie.contexto, `${mod.id}/${scene.id} contexto`);
        }
        if (step.kind === "type") assertPair(step.text, `${mod.id}/${scene.id} texto tecleado`);
      }
    }
  }
});

test("duración: nace del reloj del guion, nunca escrita a mano", () => {
  for (const mod of MODULES) {
    assert.ok(mod.ready, `${mod.id} debería estar listo en esta ola`);
    for (const lang of ["es", "en"] as const) {
      assert.ok(moduleSeconds(mod, lang) > 0, `${mod.id}: moduleSeconds(${lang}) debe ser > 0`);
      assert.ok(durationLabel(mod, lang).trim().length > 0, `${mod.id}: durationLabel(${lang}) vacío`);
    }
  }
  const banned = /duration|duracion|minutos|minutes/i;
  const scan = (node: unknown, path: string) => {
    if (Array.isArray(node)) node.forEach((v, i) => scan(v, `${path}[${i}]`));
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        assert.ok(!banned.test(k), `campo de duración escrito a mano «${k}» en ${path}`);
        scan(v, `${path}.${k}`);
      }
    }
  };
  for (const mod of MODULES) scan(mod, mod.id);
});

test("nombres: cada clave vive en el Manual o en el código de sus anclas", () => {
  const topics = readFileSync(join(SRC, "lib", "manual", "topics.ts"), "utf8").toLowerCase();
  const fileCache = new Map<string, string>();
  const fileText = (rel: string) => {
    if (!fileCache.has(rel)) fileCache.set(rel, readFileSync(join(SRC, rel), "utf8").toLowerCase());
    return fileCache.get(rel) as string;
  };
  for (const mod of MODULES) {
    for (const scene of mod.scenes) {
      const anchorTexts = scene.anchors
        .map((id) => anchorById(id))
        .filter((r) => r != null)
        .map((r) => fileText(r.file));
      for (const key of scene.keys) {
        for (const raw of key) {
          const word = raw.toLowerCase();
          const inTopics = topics.includes(word);
          const inAnchors = anchorTexts.some((t) => t.includes(word));
          assert.ok(
            inTopics || inAnchors,
            `${mod.id}/${scene.id}: la clave «${raw}» no aparece ni en el Manual ni en los archivos de sus anclas`,
          );
        }
      }
    }
  }
});
