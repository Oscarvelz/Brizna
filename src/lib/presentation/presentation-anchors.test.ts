/**
 * presentation-anchors.test.ts — cercas del registro de anclas
 * (FENCE-DESIGN §§2, 3 y 8; ANCHOR-REGISTRY §§2–4).
 *
 *  F-0  paridad con ANCHOR-REGISTRY.md: el documento existe en la raíz del
 *       árbol de trabajo y nombra las cuatro estrategias que el registro
 *       usa (spot, id, present, hook). Si el .md faltara, se salta con
 *       motivo declarado — la paridad fila a fila vive en anchors.ts,
 *       cuyo encabezado manda transcribir, no inventar.
 *  F-1  cada AnchorRec resuelve en la fuente: spot → el archivo contiene
 *       data-spot con el valor como token (o la emisión familiar
 *       data-spot={topic} con topic="valor" en el mismo archivo);
 *       id → id="valor"; present → el literal "valor" aparece exactamente
 *       una vez en su archivo y el archivo emite data-present o recibe la
 *       prop present; hook → el atributo existe en su archivo.
 *  F-2  ningún data-present duplicado ni huérfano en src: todo valor
 *       emitido (literal, por prop present/presentConfirm/presentExtra/
 *       presentAlt, por mapa de pestañas o por rama de ternario) tiene
 *       fila en el registro, y cada fila present se emite una sola vez.
 *  F-3  todo ancla citada por los guiones (declarada en la escena o
 *       tocada por un paso) existe en ANCHORS, y las escenas declaran
 *       exactamente las anclas que sus pasos tocan.
 *  F-5  escaneo profundo de los manifiestos: ninguna clave se llama
 *       selector, locator, x, y, coords ni css — las escenas citan
 *       anclas y nada más (prohibidos selectores, localizadores y
 *       coordenadas, §0.6).
 *  F-6  regla de estado (declarada aquí): un paso que cita un ancla con
 *       presencia «estado: …» solo es válido si, recorriendo el módulo
 *       en orden, un paso stage o go ya ocurrió antes (en la misma
 *       escena o en una anterior del módulo): algo de la lección puso el
 *       mundo en ese estado antes de señalarlo.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ANCHORS, anchorById } from "./anchors.ts";
import { MODULES as ALL_MODULES } from "./guion.ts";
import type { Module, Step } from "./guion.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");
const ROOT = join(HERE, "..", "..", "..");
/** La escalera entera desde el registro único (Ola 2): todo módulo `ready`
 * queda bajo las cercas el día que nace, sin tocar este archivo. */
const MODULES: Module[] = ALL_MODULES.filter((m) => m.ready);

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function walkSrc(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(p, acc);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** Archivos fuente de la app, sin la carpeta de la propia Presentación. */
const APP_FILES = walkSrc(SRC).filter((p) => !p.includes("/lib/presentation/"));

function stepAnchor(step: Step): string | null {
  return "anchor" in step ? step.anchor : null;
}

test("F-0: ANCHOR-REGISTRY.md nombra las estrategias del registro", (t) => {
  const md = join(ROOT, "ANCHOR-REGISTRY.md");
  if (!existsSync(md)) {
    t.skip("ANCHOR-REGISTRY.md ausente en la raíz del árbol de trabajo");
    return;
  }
  const text = readFileSync(md, "utf8");
  const used = new Set(ANCHORS.map((a) => a.by));
  for (const by of used) {
    assert.ok(
      text.includes(by),
      `la estrategia «${by}» se usa en el registro pero no aparece en ANCHOR-REGISTRY.md`,
    );
  }
  assert.ok(text.includes("data-present"), "el documento debe nombrar la moneda B6 (data-present)");
});

test("F-1: cada AnchorRec resuelve en su archivo", () => {
  for (const rec of ANCHORS) {
    const text = readSrc(rec.file);
    if (rec.by === "spot") {
      const literal = [...text.matchAll(/data-spot(?:-alt)?="([^"]+)"/g)]
        .some((m) => (m[1] ?? "").split(/\s+/).includes(rec.value));
      const family = text.includes("data-spot={") && text.includes(`topic="${rec.value}"`);
      assert.ok(literal || family, `${rec.id}: data-spot «${rec.value}» no aparece en ${rec.file}`);
    } else if (rec.by === "id") {
      // Literal id="valor", o el id pasado por prop a un componente que lo
      // pinta (p. ej. DayFold recibe id={isToday ? "dia-hoy" : undefined}).
      const literal = text.includes(`id="${rec.value}"`);
      const byProp = text.includes(`"${rec.value}"`) && text.includes("id=");
      assert.ok(literal || byProp, `${rec.id}: id «${rec.value}» no aparece en ${rec.file}`);
    } else if (rec.by === "hook") {
      assert.ok(text.includes(rec.value), `${rec.id}: el atributo ${rec.value} no aparece en ${rec.file}`);
    } else {
      const count = text.split(`"${rec.value}"`).length - 1;
      assert.equal(count, 1, `${rec.id}: el literal "${rec.value}" debe aparecer una vez en ${rec.file} (aparece ${count})`);
      assert.ok(
        text.includes("data-present") || text.includes("present=") || text.includes("present:") || text.includes("presentConfirm") || text.includes("TAB_PRESENT"),
        `${rec.id}: ${rec.file} no emite data-present ni recibe la prop present`,
      );
    }
  }
});

test("F-2: ningún data-present duplicado ni huérfano en src", () => {
  const registered = new Set(ANCHORS.filter((a) => a.by === "present").map((a) => a.value));
  const emitted = new Map<string, number>();
  const bump = (v: string) => emitted.set(v, (emitted.get(v) ?? 0) + 1);
  for (const file of APP_FILES) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/data-present="([a-z0-9-]+)"/g)) bump(m[1] ?? "");
    for (const m of text.matchAll(/(?<![\w-])present(?:Confirm|Extra|Alt|Cancel)?="([a-z0-9-]+)"/g)) bump(m[1] ?? "");
    for (const m of text.matchAll(/"\/[a-z]*":\s*"([a-z0-9-]+)"/g)) bump(m[1] ?? "");
    for (const m of text.matchAll(/data-present=\{[^}]*\}/g)) {
      for (const q of m[0].matchAll(/[?:]\s*"([a-z0-9-]+)"/g)) bump(q[1] ?? "");
    }
  }
  for (const [value, count] of emitted) {
    assert.ok(registered.has(value), `data-present «${value}» emitido sin fila en el registro`);
    assert.equal(count, 1, `data-present «${value}» emitido ${count} veces (una moneda, un elemento)`);
  }
  for (const value of registered) {
    assert.ok(emitted.has(value), `la fila present «${value}» no se emite en ningún archivo`);
  }
});

test("F-3: los guiones solo citan anclas del registro, y declaran lo que tocan", () => {
  for (const mod of MODULES) {
    for (const scene of mod.scenes) {
      const touched = new Set<string>();
      for (const step of scene.steps) {
        const a = stepAnchor(step);
        if (a) touched.add(a);
      }
      for (const id of scene.anchors) {
        assert.ok(anchorById(id), `${mod.id}/${scene.id}: ancla declarada «${id}» sin fila en ANCHORS`);
        assert.ok(touched.has(id), `${mod.id}/${scene.id}: declara «${id}» pero ningún paso la toca`);
      }
      for (const id of touched) {
        assert.ok(scene.anchors.includes(id), `${mod.id}/${scene.id}: el paso toca «${id}» sin declararla`);
      }
    }
  }
});

test("F-5: ningún manifiesto usa claves de selector, localizador o coordenadas", () => {
  const forbidden = new Set(["selector", "locator", "x", "y", "coords", "css"]);
  const scan = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => scan(v, `${path}[${i}]`));
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        assert.ok(!forbidden.has(k.toLowerCase()), `clave prohibida «${k}» en ${path}`);
        scan(v, `${path}.${k}`);
      }
    }
  };
  for (const mod of MODULES) scan(mod, mod.id);
});

test("F-6: un ancla de estado solo se cita tras un stage o un go en su módulo", () => {
  for (const mod of MODULES) {
    let worldMoved = false;
    for (const scene of mod.scenes) {
      for (const step of scene.steps) {
        if (step.kind === "stage" || step.kind === "go") worldMoved = true;
        const a = stepAnchor(step);
        if (!a) continue;
        const rec = anchorById(a);
        assert.ok(rec, `${mod.id}/${scene.id}: ancla «${a}» sin fila`);
        if (rec.presence.startsWith("estado:")) {
          assert.ok(
            worldMoved,
            `${mod.id}/${scene.id}: cita «${a}» (${rec.presence}) antes de cualquier stage/go del módulo`,
          );
        }
      }
    }
  }
});
