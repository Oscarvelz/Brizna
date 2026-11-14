/**
 * Q6 · Encontrar todo — el Manual desde su pliegue en Ajustes, un tema y
 * su «Ver en la app» aterrizando con el anillo sobre el control real, y
 * las pistas (?): la misma fuente en burbuja. Cierra el piso: desde aquí,
 * cada función tiene maestro en este índice de Ajustes. Censo F y H-19.
 * Escenario: ruta-base (para que el salto de «Ver en la app» aterrice
 * sobre una tarjeta de hoy viva). La búsqueda que encuentra escenas es
 * una ola posterior: ningún pie de este módulo la promete.
 */
import type { Module } from "../guion.ts";

export const Q6: Module = {
  id: "q6-encontrar",
  n: 6,
  floor: "quick",
  title: ["Encontrar todo", "Finding everything"],
  promise: [
    "Podrás encontrar cualquier función, tema o lección sin que nadie te la enseñe.",
    "You will be able to find any function, topic or lesson without anyone teaching you.",
  ],
  ready: true,
  chapters: [
    { id: "manual", title: ["El Manual", "The Manual"] },
    { id: "salto", title: ["Ver en la app", "See it in the app"] },
    { id: "pistas", title: ["Las pistas (?)", "The (?) hints"] },
  ],
  scenes: [
    {
      id: "q6-pliegue", chapter: "manual", anchors: ["aj-manual"],
      keys: [["manual", "manual"], ["ajustes", "settings"], ["ayuda", "help"]],
      steps: [
        { kind: "stage", build: "ruta-base" },
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-manual", caption: ["El Manual vive en Ajustes, en su propio pliegue.", "The Manual lives in Settings, in its own fold."] },
      ],
    },
    {
      id: "q6-abrir", chapter: "manual", anchors: ["manual-abrir"],
      keys: [["abrir el manual", "open the manual"], ["manual", "manual"]],
      steps: [{ kind: "do", anchor: "manual-abrir", caption: ["Ábrelo: el Manual es la ayuda entera, en una pantalla.", "Open it: the Manual is the whole help, on one screen."] }],
    },
    {
      id: "q6-portada", chapter: "manual", anchors: ["mn-doc"],
      keys: [["capítulos", "chapters"], ["temas", "topics"], ["índice", "index"]],
      steps: [
        { kind: "go", screen: "/manual" },
        { kind: "show", anchor: "mn-doc", caption: ["Capítulos y temas numerados: todo Brizna, explicado una vez.", "Numbered chapters and topics: all of Brizna, explained once."] },
      ],
    },
    {
      id: "q6-tema", chapter: "manual", anchors: ["manual-tema"],
      keys: [["tema", "topic"], ["ejemplo", "example"]],
      steps: [{ kind: "show", anchor: "manual-tema", caption: ["Cada tema trae cómo funciona, un ejemplo y qué pasa si…", "Each topic covers how it works, an example, and what if…"] }],
    },
    {
      id: "q6-ver", chapter: "salto", anchors: ["manual-ver-en-app"],
      keys: [["ver en la app", "see it in the app"], ["tema", "topic"]],
      steps: [{ kind: "do", anchor: "manual-ver-en-app", caption: ["Toca «Ver en la app» en un tema.", "Tap “See it in the app” on a topic."] }],
    },
    {
      id: "q6-anillo", chapter: "salto", anchors: ["hecho"],
      keys: [["anillo", "ring"], ["control", "control"]],
      steps: [{ kind: "show", anchor: "hecho", caption: ["Aterrizas en el control exacto, rodeado de luz unos segundos.", "You land on the exact control, ringed with light for a few seconds."], contexto: ["Un toque o un desplazamiento apaga el anillo antes: nunca estorba.", "A tap or a scroll turns the ring off sooner: never in the way."] }],
    },
    {
      id: "q6-pista", chapter: "pistas", anchors: ["pista-boton", "pista-burbuja"],
      keys: [["pista", "hint"], ["burbuja", "bubble"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "do", anchor: "pista-boton", caption: ["¿Prisa? Toca cualquier (?) junto a un título.", "In a hurry? Tap any (?) beside a title."] },
        { kind: "show", anchor: "pista-burbuja", caption: ["La burbuja dice lo mismo que el Manual: una sola fuente.", "The bubble says what the Manual says: one single source."] },
      ],
    },
    {
      id: "q6-mas", chapter: "pistas", anchors: ["pista-burbuja"],
      keys: [["más en el manual", "more in the manual"], ["tema", "topic"]],
      steps: [
        { kind: "show", anchor: "pista-burbuja", caption: ["«Más en el manual» te lleva a ese tema exacto.", "“More in the manual” takes you to that exact topic."] },
        { kind: "ref", topic: "manual-uso" },
      ],
    },
    {
      id: "q6-cierre", chapter: "pistas", anchors: ["aj-manual"],
      keys: [["ajustes", "settings"], ["manual", "manual"], ["ayuda", "help"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-manual", caption: ["Desde hoy, cada función tiene maestro: estas lecciones viven en Ajustes.", "From today, every function has a teacher: these lessons live in Settings."] },
      ],
    },
  ],
};
