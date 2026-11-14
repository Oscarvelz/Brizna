/**
 * presentation-search.test.ts — cercas del registro de búsqueda de la
 * Presentación (PLAN §0.7: módulos y escenas registrados como temas del
 * Manual, con ancla + palabras clave, y los DOS aterrizajes por resultado).
 *
 *  (a) Completitud derivada: el registro trae exactamente una entrada por
 *      módulo listo y una por cada escena de cada módulo listo — el conteo
 *      se calcula de MODULES en el acto, así que un módulo futuro (el piso
 *      Advanced, cuando guion.ts lo marque ready) se registra solo o la
 *      cerca se pone roja.
 *  (b) Solo lo listo: ninguna entrada nombra un módulo `ready: false`.
 *  (c) Forma: toda entrada lleva ≥1 par de claves íntegro, una primera
 *      ancla que existe en el registro de anclas, y un goScreen real
 *      (empieza por «/» y no guarda ningún segmento dinámico).
 *  (d) Nombres (la regla de la cerca de textos): cada clave, en minúsculas,
 *      aparece en el texto del Manual o en el código fuente de alguno de
 *      los archivos de las anclas de su escena — las claves solo usan
 *      palabras reales de la app.
 *  (e) El buscador, con sondas vivas: «saldo» y «balance» encuentran la
 *      escena q4-saldo; una errata en palabra larga perdona («saldoo»);
 *      cada palabra debe pegar («saldo xylophone» no encuentra nada) y
 *      «xylophone» a secas tampoco.
 *  (f) La derivación es genérica (sonda con módulos de juguete): un módulo
 *      Advanced listo entra con su módulo + escenas, el `go` dinámico se
 *      corta a su prefijo estático, la escena sin `go` hereda la pantalla,
 *      y un módulo no listo queda fuera entero.
 *  (g) La integración vive en el Manual (sonda de fuente): manual.tsx
 *      pinta la sección «Lecciones» y ofrece los dos aterrizajes con la
 *      misma guarda de escenario que el índice.
 *
 * Run: node --experimental-strip-types --test src/lib/presentation/presentation-search.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { anchorById } from "./anchors.ts";
import { MODULES, moduleById, type Module } from "./guion.ts";
import {
  PRESENTATION_SEARCH,
  buildRegistry,
  presentationWords,
  searchPresentations,
  stripGoScreen,
} from "./search.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");
const ready = MODULES.filter((m) => m.ready);
const notReady = MODULES.filter((m) => !m.ready);
const keyOf = (e: { moduleId: string; sceneId?: string }) => `${e.moduleId}::${e.sceneId ?? ""}`;

test("(a) completitud: una entrada por módulo listo y una por escena, sin duplicados", () => {
  const expected = ready.reduce((n, m) => n + 1 + m.scenes.length, 0);
  assert.equal(
    PRESENTATION_SEARCH.length,
    expected,
    `el registro debe traer ${expected} entradas (módulos listos + sus escenas) y trae ${PRESENTATION_SEARCH.length}`,
  );
  const seen = new Set(PRESENTATION_SEARCH.map(keyOf));
  assert.equal(seen.size, PRESENTATION_SEARCH.length, "hay entradas duplicadas en el registro");
  for (const mod of ready) {
    const moduleEntries = PRESENTATION_SEARCH.filter((e) => e.moduleId === mod.id && e.kind === "module");
    assert.equal(moduleEntries.length, 1, `${mod.id}: debe tener exactamente una entrada de módulo`);
    assert.equal(moduleEntries[0]?.sceneId, undefined, `${mod.id}: la entrada de módulo no lleva sceneId`);
    for (const scene of mod.scenes) {
      const hits = PRESENTATION_SEARCH.filter((e) => e.moduleId === mod.id && e.sceneId === scene.id);
      assert.equal(hits.length, 1, `${mod.id}/${scene.id}: debe tener exactamente una entrada de escena`);
      assert.equal(hits[0]?.kind, "scene", `${mod.id}/${scene.id}: su entrada debe ser de escena`);
    }
  }
});

test("(b) solo lo listo: ningún módulo en preparación aparece en el registro", () => {
  // Con la escalera completa (Ola 2) puede no quedar ningún módulo en
  // preparación: la exclusión de los no listos la prueba con dientes la
  // sonda (f) con su módulo sintético; aquí manda la dirección contraria —
  // toda entrada del registro pertenece a un módulo listo.
  for (const mod of notReady) {
    assert.ok(
      !PRESENTATION_SEARCH.some((e) => e.moduleId === mod.id),
      `${mod.id} no está listo y no debe aparecer en la búsqueda`,
    );
  }
  for (const entry of PRESENTATION_SEARCH) {
    assert.equal(moduleById(entry.moduleId)?.ready, true, `${entry.moduleId}: toda entrada es de un módulo listo`);
  }
});

test("(c) forma: claves íntegras, primera ancla viva y goScreen real en cada entrada", () => {
  for (const entry of PRESENTATION_SEARCH) {
    const what = `${entry.moduleId}/${entry.sceneId ?? "módulo"}`;
    assert.ok(entry.keys.length >= 1, `${what}: debe llevar al menos un par de claves`);
    for (const key of entry.keys) {
      assert.ok(Array.isArray(key) && key.length === 2, `${what}: cada clave es un par [es, en]`);
      assert.ok(key[0].trim().length > 0 && key[1].trim().length > 0, `${what}: ningún lado del par va vacío`);
    }
    assert.ok(entry.firstAnchor.length > 0, `${what}: debe nombrar su primera ancla`);
    assert.ok(anchorById(entry.firstAnchor), `${what}: la ancla «${entry.firstAnchor}» no existe en el registro`);
    assert.ok(entry.goScreen.startsWith("/"), `${what}: goScreen «${entry.goScreen}» debe empezar por /`);
    assert.ok(
      !entry.goScreen.split("/").some((seg) => seg.startsWith(":") || seg.startsWith("$")),
      `${what}: goScreen «${entry.goScreen}» guarda un segmento dinámico`,
    );
    assert.ok(entry.searchText.trim().length > 0, `${what}: el texto buscable no puede ir vacío`);
  }
  // La primera ancla y el título de cada escena son los de su guion, no una copia.
  for (const mod of ready) {
    for (const scene of mod.scenes) {
      const entry = PRESENTATION_SEARCH.find((e) => e.moduleId === mod.id && e.sceneId === scene.id);
      assert.equal(entry?.firstAnchor, scene.anchors[0], `${mod.id}/${scene.id}: firstAnchor debe ser la primera ancla del guion`);
    }
    // Las claves del módulo son la unión de las de sus escenas.
    const moduleEntry = PRESENTATION_SEARCH.find((e) => e.moduleId === mod.id && e.kind === "module");
    const union = new Set(mod.scenes.flatMap((s) => s.keys.map((k) => `${k[0]}${k[1]}`)));
    assert.equal(moduleEntry?.keys.length, union.size, `${mod.id}: las claves del módulo deben ser la unión de sus escenas`);
  }
});

test("(d) nombres: cada clave vive en el Manual o en el código de las anclas de su escena", () => {
  const topics = readFileSync(join(SRC, "lib", "manual", "topics.ts"), "utf8").toLowerCase();
  const fileCache = new Map<string, string>();
  const fileText = (rel: string) => {
    if (!fileCache.has(rel)) fileCache.set(rel, readFileSync(join(SRC, rel), "utf8").toLowerCase());
    return fileCache.get(rel) as string;
  };
  for (const mod of ready) {
    for (const scene of mod.scenes) {
      const entry = PRESENTATION_SEARCH.find((e) => e.moduleId === mod.id && e.sceneId === scene.id);
      assert.ok(entry, `${mod.id}/${scene.id}: falta su entrada`);
      const anchorTexts = scene.anchors
        .map((id) => anchorById(id))
        .filter((r) => r != null)
        .map((r) => fileText(r.file));
      for (const key of entry.keys) {
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

test("(e) buscador: saldo y balance encuentran q4-saldo; la errata perdona; el disparate no", () => {
  const bySaldo = searchPresentations("saldo");
  assert.ok(
    bySaldo.some((e) => e.moduleId === "q4-dinero" && e.sceneId === "q4-saldo"),
    "«saldo» debe encontrar la escena q4-saldo",
  );
  const byBalance = searchPresentations("balance");
  assert.ok(
    byBalance.some((e) => e.moduleId === "q4-dinero" && e.sceneId === "q4-saldo"),
    "«balance» debe encontrar la escena q4-saldo",
  );
  const byTypo = searchPresentations("saldoo");
  assert.ok(
    byTypo.some((e) => e.moduleId === "q4-dinero" && e.sceneId === "q4-saldo"),
    "«saldoo» (errata en palabra larga) debe perdonarse como en el Manual",
  );
  assert.deepEqual(searchPresentations("xylophone"), [], "«xylophone» no debe encontrar nada");
  assert.deepEqual(
    searchPresentations("saldo xylophone"),
    [],
    "cada palabra debe pegar: «saldo xylophone» no debe encontrar nada",
  );
  assert.deepEqual(presentationWords("  Saldo "), ["saldo"], "las palabras se pliegan como en el Manual");
});

test("(f) derivación genérica: un Advanced de juguete entra solo al estar listo", () => {
  assert.equal(stripGoScreen("/clientes/:aurelio"), "/clientes");
  assert.equal(stripGoScreen("/clientes/$id"), "/clientes");
  assert.equal(stripGoScreen("/"), "/");
  assert.equal(stripGoScreen("/cobros"), "/cobros");

  const fake: Module[] = [
    {
      id: "adx-falso",
      n: 99,
      floor: "advanced",
      title: ["Módulo falso", "Fake module"],
      promise: ["Promesa falsa.", "Fake promise."],
      ready: true,
      chapters: [{ id: "c1", title: ["Capítulo", "Chapter"] }],
      scenes: [
        {
          id: "adx-uno",
          chapter: "c1",
          anchors: ["ficha-deuda"],
          keys: [["saldo", "balance"]],
          steps: [
            { kind: "go", screen: "/clientes/:aurelio" },
            { kind: "show", anchor: "ficha-deuda", caption: ["Pie uno de prueba.", "Test caption one."] },
          ],
        },
        {
          id: "adx-dos",
          chapter: "c1",
          anchors: ["cobrado"],
          keys: [["cobrado", "collected"]],
          steps: [{ kind: "show", anchor: "cobrado", caption: ["Pie dos de prueba.", "Test caption two."] }],
        },
      ],
    },
    {
      id: "ady-apagado",
      n: 100,
      floor: "advanced",
      title: ["Apagado", "Off"],
      promise: ["Nada.", "Nothing."],
      ready: false,
      chapters: [],
      scenes: [
        {
          id: "ady-uno",
          chapter: "c1",
          anchors: ["cobrado"],
          keys: [["cobrado", "collected"]],
          steps: [{ kind: "show", anchor: "cobrado", caption: ["No debe salir.", "Must not appear."] }],
        },
      ],
    },
  ];
  const reg = buildRegistry(fake);
  assert.equal(reg.length, 3, "un módulo listo aporta 1 + sus escenas; el apagado, nada");
  assert.ok(!reg.some((e) => e.moduleId === "ady-apagado"), "el módulo no listo queda fuera entero");
  const uno = reg.find((e) => e.sceneId === "adx-uno");
  const dos = reg.find((e) => e.sceneId === "adx-dos");
  assert.equal(uno?.goScreen, "/clientes", "el go dinámico se corta a su prefijo estático");
  assert.equal(dos?.goScreen, "/clientes", "la escena sin go hereda la pantalla vigente del módulo");
  assert.deepEqual(uno?.title, ["Pie uno de prueba.", "Test caption one."], "el nombre de la escena es su primer pie");
  const modEntry = reg.find((e) => e.kind === "module");
  assert.equal(modEntry?.goScreen, "/clientes", "la entrada de módulo aterriza donde su primera escena");
  assert.equal(modEntry?.sceneId, undefined, "la entrada de módulo no lleva sceneId: arranca en su primera escena");
});

test("(g) integración: el Manual pinta «Lecciones» con los dos aterrizajes y la guarda del índice", () => {
  const manual = readFileSync(join(SRC, "routes", "manual.tsx"), "utf8");
  assert.match(manual, /presentation\/search/, "manual.tsx debe buscar en el registro de presentaciones");
  assert.match(manual, /matchPresentations\(words\)/, "la sección usa las mismas palabras plegadas que los temas");
  assert.match(manual, /"Lecciones", "Lessons"/, "la sección se encabeza «Lecciones»");
  assert.match(manual, /"Ver la escena", "See the scene"/, "el aterrizaje a la escena debe ofrecerse");
  assert.match(manual, /"Ir a la función", "Go to the function"/, "el aterrizaje a la función real debe ofrecerse");
  assert.match(manual, /launchPresentation\(entry\.moduleId, sceneId\)/, "«Ver la escena» lanza la presentación en esa escena");
  assert.match(manual, /if \(stageOn\(\)\) return;/, "el lanzamiento lleva la guarda de escenario del índice");
  assert.match(manual, /to: entry\.goScreen as never/, "«Ir a la función» navega en plano a la pantalla real");
});
