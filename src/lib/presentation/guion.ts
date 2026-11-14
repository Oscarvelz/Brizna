/**
 * guion — el registro de guiones de la Presentación Guiada de Brizna.
 *
 * Una presentación NO es video: es un guion (datos) que la app representa en
 * vivo sobre sí misma, en el escenario sellado (stage.ts). Cada módulo es una
 * lista de escenas; cada escena, una lista de pasos. Los textos nacen en pares
 * ES/EN — ninguna escena existe en un solo idioma — y cada pie obedece la ley
 * de la casa: ≤15 palabras, beneficio primero, y su permanencia en pantalla es
 * proporcional a sus palabras (el reloj de abajo), nunca un número fijo.
 *
 * Las escenas apuntan a ANCLAS vivas (anchors.ts), nunca a posiciones: si una
 * ola futura mueve un control, la escena lo sigue; si el ancla muere, la cerca
 * de la suite se pone roja antes de publicar y el conductor salta la escena
 * con gracia (ley de mantenimiento, FENCE-DESIGN §5).
 *
 * Los manifiestos del piso Quick viven en ./scenes/ (un archivo por módulo);
 * el piso Advanced se anuncia aquí con sus promesas y entra `ready: false`
 * hasta que sus escenas se construyan tras la puerta de revisión de Oscar.
 */

import { Q0 } from "./scenes/q0-vuelta.ts";
import { Q1 } from "./scenes/q1-mapa.ts";
import { Q2 } from "./scenes/q2-cliente.ts";
import { Q3 } from "./scenes/q3-dia.ts";
import { Q4 } from "./scenes/q4-dinero.ts";
import { Q5 } from "./scenes/q5-hablar.ts";
import { Q6 } from "./scenes/q6-encontrar.ts";
import { AD1 } from "./scenes/ad1-viaje.ts";
import { AD2 } from "./scenes/ad2-ficha.ts";
import { AD3 } from "./scenes/ad3-repetidos.ts";
import { AD4 } from "./scenes/ad4-baches.ts";
import { AD5 } from "./scenes/ad5-agenda.ts";
import { AD6 } from "./scenes/ad6-temporadas.ts";
import { AD7 } from "./scenes/ad7-cobros.ts";
import { AD8 } from "./scenes/ad8-perdonar.ts";
import { AD9 } from "./scenes/ad9-estudio.ts";
import { AD10 } from "./scenes/ad10-comunicacion.ts";
import { AD11 } from "./scenes/ad11-bloc.ts";
import { AD12 } from "./scenes/ad12-clima.ts";
import { AD13 } from "./scenes/ad13-manos.ts";
import { AD14 } from "./scenes/ad14-ajustes.ts";
import { AD15 } from "./scenes/ad15-datos.ts";
import { AD16 } from "./scenes/ad16-fuera.ts";

export type Pair = readonly [es: string, en: string];
export const pick = (pair: Pair, lang: string): string => (lang === "en" ? pair[1] : pair[0]);

export type Step =
  /** Navega a una ruta de la casa (TanStack). Puede contener `:aurelio`, que el
   * conductor sustituye por el id del cliente del escenario antes de navegar. */
  | { kind: "go"; screen: string }
  /** Siembra del escenario: construye los datos que la lección necesita
   * (stage-seeds.ts, clave `build`). Sin pie: la escena nunca descansa en él. */
  | { kind: "stage"; build: string }
  /** Resalta un ancla con su pie de texto. `contexto`: la ventanita arribita
   * (PLAN §0.4) — solo cuando el pie y la pantalla no bastan. */
  | { kind: "show"; anchor: string; caption: Pair; contexto?: Pair }
  /** Pregunta corta: un latido de pausa, y la respuesta llega con el paso siguiente. */
  | { kind: "ask"; anchor: string; caption: Pair; contexto?: Pair }
  /** Compás interactivo: la escena espera el gesto real del usuario sobre el ancla.
   * En modo automático, el conductor lo ejecuta él mismo tras el latido. */
  | { kind: "do"; anchor: string; caption: Pair; contexto?: Pair }
  /** Presión larga: la escena espera una presión real de al menos `ms` sobre el
   * ancla (la presión larga del mapa de la tarjeta, 550ms — censo A-55). Un toque
   * rápido no cuenta. En automático, el conductor mantiene la presión él mismo. */
  | { kind: "press"; anchor: string; ms: number; caption: Pair; contexto?: Pair }
  /** Deslizar a la izquierda sobre una tarjeta (la puerta de Baja/Borrar de
   * Clientes, censo B-34): la escena espera el arrastre real del usuario
   * (≥60px a la izquierda) y en automático el conductor lo ejecuta él mismo
   * con la misma corriente de puntero que produce un dedo. */
  | { kind: "swipe"; anchor: string; caption: Pair; contexto?: Pair }
  /** Toque del conductor, sin pie (abrir/cerrar un menú, restaurar una vista). */
  | { kind: "tap"; anchor: string }
  /** El conductor escribe en un campo: la representación teclea y la escena
   * sigue tras el pie. En interactivo también lo hace el conductor: teclear la
   * palabra ES la demostración. */
  | { kind: "type"; anchor: string; text: Pair; caption: Pair; contexto?: Pair }
  /** Referencia inmediata al tema del manual, sin perder la escena. */
  | { kind: "ref"; topic: string }
  /** Teatro de widgets (solo AD16, PLAN §2/OQ-1): el conductor alza el teatro
   * sobre una pantalla de inicio de mentira y representa la pieza real del
   * widget con los datos del libro del escenario. Dura como un `show`. */
  | { kind: "theatre"; piece: "hoy" | "semana" | "panel"; anchor: string; caption: Pair; contexto?: Pair };

export interface Scene {
  id: string;
  chapter: string;
  /** Toda ancla que la escena toca (la cerca las verifica contra el registro). */
  anchors: string[];
  /** Palabras clave de búsqueda (ES, EN) — la lupa encuentra escenas como temas. */
  keys: Pair[];
  steps: Step[];
  /** Lo que falta contrastar en aparato antes de enseñar esto como hecho (cerca F-4). */
  verify?: string;
}

export interface Chapter {
  id: string;
  title: Pair;
}

export interface Module {
  id: string;
  n: number;
  floor: "quick" | "advanced";
  title: Pair;
  /** La descripción previa del índice: una promesa de capacidad, no un tema. */
  promise: Pair;
  ready: boolean;
  chapters: Chapter[];
  scenes: Scene[];
}

/* ================================ EL RELOJ ================================ */

/** La calibración de lectura: 200 palabras por minuto en pantalla (investigación 2026-11-13). */
export const WORDS_PER_MINUTE = 200;
/** Toda permanencia lleva ~1s de orientación antes de la lectura. */
export const ORIENT_MS = 1000;

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** Permanencia de un pie a velocidad 1×: proporcional a sus palabras. */
export const dwellMs = (caption: Pair, lang: string): number =>
  Math.round((wordCount(pick(caption, lang)) / WORDS_PER_MINUTE) * 60_000) + ORIENT_MS;

/** La lectura de la ventanita de contexto, cuando el paso la lleva: anunciarla
 * sin contarla sería mentir la duración. */
const contextoMs = (step: Step, lang: string): number =>
  "contexto" in step && step.contexto
    ? Math.round((wordCount(pick(step.contexto, lang)) / WORDS_PER_MINUTE) * 60_000)
    : 0;

/** Lo que un paso cuesta en modo automático a 1× (para la duración anunciada). */
export function stepMs(step: Step, lang: string): number {
  switch (step.kind) {
    case "show":
    case "ask":
    case "theatre":
      return dwellMs(step.caption, lang) + contextoMs(step, lang);
    case "do":
      return dwellMs(step.caption, lang) + contextoMs(step, lang) + 1200; // el latido + el gesto
    case "press":
      return dwellMs(step.caption, lang) + contextoMs(step, lang) + step.ms; // el pie + la presión entera
    case "swipe":
      return dwellMs(step.caption, lang) + contextoMs(step, lang) + 800; // el pie + el arrastre
    case "type":
      return dwellMs(step.caption, lang) + contextoMs(step, lang) + 900; // el pie + el tecleo
    case "go":
      return 1400; // el viaje y el asentamiento
    case "tap":
      return 700;
    case "stage":
      return 600; // sembrar y seguir
    case "ref":
      return 0; // la referencia se ofrece; no cuesta tiempo de guion
  }
}

export const sceneMs = (scene: Scene, lang: string): number =>
  scene.steps.reduce((sum, s) => sum + stepMs(s, lang), 0);

/** La duración honesta del índice: automática a 1×, en segundos. */
export const moduleSeconds = (mod: Module, lang: string): number =>
  Math.round(mod.scenes.reduce((sum, s) => sum + sceneMs(s, lang), 0) / 1000);

/** «Aprox. N min» / «Approx. N min» — aproximada y honesta, nunca exacta.
 * Ley de Oscar (2026-11-14): la duración completa se etiqueta «Aprox.» /
 * "Approx." — nunca «unos» / "about". */
export function durationLabel(mod: Module, lang: string): string {
  const sec = moduleSeconds(mod, lang);
  const min = Math.max(1, Math.round(sec / 60));
  return lang === "en" ? `Approx. ${min} min` : `Aprox. ${min} min`;
}

/* ============================ EL PISO ADVANCED ============================ */

const ADVANCED: Module[] = [AD1, AD2, AD3, AD4, AD5, AD6, AD7, AD8, AD9, AD10, AD11, AD12, AD13, AD14, AD15, AD16];

/* ============================ LA ESCALERA ENTERA ============================ */

export const MODULES: readonly Module[] = [Q0, Q1, Q2, Q3, Q4, Q5, Q6, ...ADVANCED];

export const moduleById = (id: string): Module | undefined => MODULES.find((m) => m.id === id);

/** Toda ancla citada por el registro (la cerca la contrasta con el registro de anclas). */
export function allAnchors(): string[] {
  const out = new Set<string>();
  for (const mod of MODULES) for (const scene of mod.scenes) for (const a of scene.anchors) out.add(a);
  return [...out].sort();
}
