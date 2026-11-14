/**
 * presentation-clock.test.ts — cercas del reloj único (registro de Faro
 * 1.3.278, aplicado en Brizna el 2026-11-14).
 *
 *  C-1  el suelo de la leyenda: ningún pie vive menos de MIN_DWELL_MS a
 *       1×, ni en español ni en inglés, por corto que sea.
 *  C-2  lo anunciado es lo que el motor corre: las constantes de stepMs
 *       para los gestos automáticos son las del motor (do: pie + 650 de
 *       asentamiento; type: pie + 500; tap: 720 = 300 + 420), para que la
 *       duración del índice nunca mienta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dwellMs, stepMs, MIN_DWELL_MS, type Step } from "./guion.ts";

test("C-1: ninguna leyenda vive menos que el suelo, en ningún idioma", () => {
  const cortas: [string, string][] = [
    ["Toca Hecho.", "Tap Done."],
    ["Ya está.", "Done."],
    ["Mira el total aquí.", "See the total here."],
  ];
  for (const cap of cortas) {
    assert.ok(dwellMs(cap, "es") >= MIN_DWELL_MS, `ES por debajo del suelo: ${cap[0]}`);
    assert.ok(dwellMs(cap, "en") >= MIN_DWELL_MS, `EN por debajo del suelo: ${cap[1]}`);
  }
  assert.equal(MIN_DWELL_MS, 2600);
});

test("C-2: stepMs anuncia exactamente lo que el motor corre en los gestos", () => {
  const cap: [string, string] = ["Toca Malla y mira lo que pasa: todo se achica.", "Tap Grid and watch what happens: everything shrinks."];
  const base = dwellMs(cap, "es");
  const doStep: Step = { kind: "do", anchor: "vistas-malla", caption: cap };
  assert.equal(stepMs(doStep, "es"), base + 650, "do = pie entero + toque + 650 de asentamiento");
  const typeStep: Step = { kind: "type", anchor: "buscar", caption: cap, text: ["x", "x"] };
  assert.equal(stepMs(typeStep, "es"), base + 500, "type = pie + 500");
  const tapStep: Step = { kind: "tap", anchor: "vistas-malla" };
  assert.equal(stepMs(tapStep, "es"), 720, "tap = 300 hasta el toque + 420 de asentamiento");
  const pressStep: Step = { kind: "press", anchor: "hecho", caption: cap, ms: 550 };
  assert.equal(stepMs(pressStep, "es"), base + 550 + 800, "press = pie + presión entera + respiro y asentamiento");
});
