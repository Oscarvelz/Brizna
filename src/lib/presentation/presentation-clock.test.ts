/**
 * presentation-clock.test.ts — cercas del reloj único (registro de Faro
 * 1.3.278, aplicado en Brizna el 2026-11-14) y de la ESCALA RECALIBRADA
 * (Oscar, 2026-11-14 23:47: la antigua 0.5 es el nuevo 1 normal).
 *
 *  C-1  el suelo de la leyenda: ningún pie vive menos de MIN_DWELL_MS
 *       nominal, ni en español ni en inglés, por corto que sea — y su
 *       vida REAL a 1× (nominal ÷ velocidad efectiva de la etiqueta 1)
 *       no baja del doble del suelo.
 *  C-2  lo anunciado es lo que el motor corre: las constantes de stepMs
 *       para los gestos automáticos son las del motor (do: pie + 650 de
 *       asentamiento; type: pie + 500; tap: 720 = 300 + 420), llevadas a
 *       la escala recalibrada (÷ PACE), para que la duración del índice
 *       nunca mienta.
 *  C-3  la escala misma: effSpeed(1) = 0.5 — la etiqueta 1 corre al
 *       ritmo que antes corría la de 0.5 — y las demás etiquetas se
 *       reescalan en proporción.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dwellMs, effSpeed, stepMs, MIN_DWELL_MS, PACE, type Step } from "./guion.ts";

test("C-1: ninguna leyenda vive menos que el suelo, en ningún idioma", () => {
  const cortas: [string, string][] = [
    ["Toca Hecho.", "Tap Done."],
    ["Ya está.", "Done."],
    ["Mira el total aquí.", "See the total here."],
  ];
  for (const cap of cortas) {
    assert.ok(dwellMs(cap, "es") >= MIN_DWELL_MS, `ES por debajo del suelo: ${cap[0]}`);
    assert.ok(dwellMs(cap, "en") >= MIN_DWELL_MS, `EN por debajo del suelo: ${cap[1]}`);
    // La vida real a 1× tras la recalibración: nominal ÷ effSpeed(1).
    assert.ok(dwellMs(cap, "es") / effSpeed(1) >= 2 * MIN_DWELL_MS, `ES: vida real a 1× bajo el suelo recalibrado: ${cap[0]}`);
    assert.ok(dwellMs(cap, "en") / effSpeed(1) >= 2 * MIN_DWELL_MS, `EN: vida real a 1× bajo el suelo recalibrado: ${cap[1]}`);
  }
  assert.equal(MIN_DWELL_MS, 2600);
});

test("C-2: stepMs anuncia exactamente lo que el motor corre en los gestos", () => {
  const cap: [string, string] = ["Toca Malla y mira lo que pasa: todo se achica.", "Tap Grid and watch what happens: everything shrinks."];
  const base = dwellMs(cap, "es");
  const doStep: Step = { kind: "do", anchor: "vistas-malla", caption: cap };
  assert.equal(stepMs(doStep, "es"), Math.round((base + 650) / PACE), "do = (pie entero + toque + 650 de asentamiento) ÷ PACE");
  const typeStep: Step = { kind: "type", anchor: "buscar", caption: cap, text: ["x", "x"] };
  assert.equal(stepMs(typeStep, "es"), Math.round((base + 500) / PACE), "type = (pie + 500) ÷ PACE");
  const tapStep: Step = { kind: "tap", anchor: "vistas-malla" };
  assert.equal(stepMs(tapStep, "es"), Math.round(720 / PACE), "tap = (300 hasta el toque + 420 de asentamiento) ÷ PACE");
  const pressStep: Step = { kind: "press", anchor: "hecho", caption: cap, ms: 550 };
  assert.equal(stepMs(pressStep, "es"), Math.round((base + 550 + 800) / PACE), "press = (pie + presión entera + respiro y asentamiento) ÷ PACE");
});

test("C-3: la etiqueta 1 corre al ritmo de la antigua 0.5", () => {
  assert.equal(PACE, 0.5);
  assert.equal(effSpeed(1), 0.5, "el nuevo 1 es la antigua 0.5");
  assert.equal(effSpeed(2), 1, "el nuevo 2 es la antigua 1");
  assert.equal(effSpeed(0.5), 0.25, "el nuevo 0.5 es el estudio más lento");
  assert.equal(effSpeed(0.75), 0.375);
  assert.equal(effSpeed(1.5), 0.75);
});
