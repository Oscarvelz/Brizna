/**
 * Q1 · El mapa de Brizna — las cinco pestañas, la tarjeta de un vistazo y la
 * ayuda que existe (su lección entera es Q6). Censo A (navegación y tarjeta)
 * y H ((?) y pin). Escenario: ruta-base (Don Aurelio corta hoy, $40).
 */
import type { Module } from "../guion.ts";

export const Q1: Module = {
  id: "q1-mapa",
  n: 1,
  floor: "quick",
  title: ["El mapa de Brizna", "The map of Brizna"],
  promise: [
    "Podrás moverte por las cinco pestañas y saber qué vive en cada una.",
    "You will be able to move through the five tabs and know what lives in each.",
  ],
  ready: true,
  chapters: [
    { id: "pestanas", title: ["Las cinco pestañas", "The five tabs"] },
    { id: "tarjeta", title: ["La tarjeta de un vistazo", "The job card at a glance"] },
    { id: "ayuda", title: ["La ayuda existe", "Help exists"] },
  ],
  scenes: [
    {
      id: "q1-hoy", chapter: "pestanas", anchors: ["pestana-hoy"],
      keys: [["hoy", "today"], ["pestañas", "tabs"]],
      steps: [
        { kind: "stage", build: "ruta-base" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "pestana-hoy", caption: ["Cinco pestañas lo guardan todo; Hoy es tu día de trabajo.", "Five tabs hold everything; Today is your work day."], contexto: ["Todo esto pasa en un escenario de práctica: tu libro real no se toca.", "All this happens on a practice stage: your real book is untouched."] },
        { kind: "ref", topic: "hoy" },
      ],
    },
    {
      id: "q1-agenda", chapter: "pestanas", anchors: ["pestana-agenda"],
      keys: [["agenda", "schedule"], ["visitas", "visits"]],
      steps: [{ kind: "show", anchor: "pestana-agenda", caption: ["Agenda: las visitas que vienen, día por día.", "Schedule: the visits ahead, day by day."] }, { kind: "ref", topic: "agenda" }],
    },
    {
      id: "q1-clientes", chapter: "pestanas", anchors: ["pestana-clientes"],
      keys: [["clientes", "clients"], ["ficha", "client file"]],
      steps: [{ kind: "show", anchor: "pestana-clientes", caption: ["Clientes: tu lista entera, cada uno con su ficha.", "Clients: your whole list, each with their file."] }, { kind: "ref", topic: "lista-clientes" }],
    },
    {
      id: "q1-cobros", chapter: "pestanas", anchors: ["pestana-cobros"],
      keys: [["cobros", "payments"], ["deuda", "debt"]],
      steps: [{ kind: "show", anchor: "pestana-cobros", caption: ["Cobros: quién debe, quién abonó y qué entró.", "Payments: who owes, who paid part, what came in."] }, { kind: "ref", topic: "por-cobrar" }],
    },
    {
      id: "q1-estudio", chapter: "pestanas", anchors: ["pestana-estudio"],
      keys: [["estudio", "stats"], ["asesor", "advisor"]],
      steps: [{ kind: "show", anchor: "pestana-estudio", caption: ["Estudio: tus cifras; dentro vive también el Asesor.", "Stats: your figures; the Advisor lives inside too."], contexto: ["Estudio y Asesor son una sola pestaña: se voltean en la misma pantalla.", "Stats and the Advisor are one tab: they flip on the same screen."] }, { kind: "ref", topic: "estudio" }],
    },
    {
      id: "q1-vistas", chapter: "tarjeta", anchors: ["vistas", "vistas-malla", "vistas-grande"],
      keys: [["vistas", "views"], ["grande", "large"], ["malla", "grid"]],
      steps: [
        { kind: "show", anchor: "vistas", caption: ["Tú eliges el tamaño: Grande luce cada tarjeta; Malla mete más clientes en pantalla.", "You choose the size: Large spreads each card out; Grid fits more clients per screen."] },
        { kind: "do", anchor: "vistas-malla", caption: ["Toca Malla y mira lo que pasa: todo se achica y cabe más.", "Tap Grid and watch what happens: everything shrinks and more fits."] },
        { kind: "do", anchor: "vistas-grande", caption: ["Ahora Grande: cada tarjeta vuelve a lucirse entera.", "Now Large: each card spreads out in full again."] },
        { kind: "ref", topic: "vistas" },
      ],
    },
    {
      id: "q1-nombre", chapter: "tarjeta", anchors: ["tarjeta-nombre"],
      keys: [["nombre", "name"], ["ficha", "client file"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["El nombre manda en la tarjeta; tocarlo abre su ficha.", "The name leads the card; tapping it opens their file."] },
        { kind: "ref", topic: "lista-clientes" },
      ],
    },
    {
      id: "q1-precio-pin", chapter: "tarjeta", anchors: ["tarjeta-precio", "tarjeta-pin"],
      keys: [["precio", "price"], ["pin", "pin"], ["fijado", "pinned"]],
      steps: [
        { kind: "show", anchor: "tarjeta-precio", caption: ["Ese precio es el corte de hoy: se cobra o queda a deber.", "That price is today's cut: it gets collected, or it stays owed."] },
        { kind: "show", anchor: "tarjeta-pin", caption: ["Fijada, su tarjeta no baja en Hoy: el patio queda a mano.", "Pinned, his card never sinks in Today: the yard stays at hand."] },
        { kind: "do", anchor: "tarjeta-pin", caption: ["Toca el pin: su tarjeta queda fijada arriba en Hoy.", "Tap the pin: his card stays pinned at the top of Today."] },
      ],
    },
    {
      id: "q1-estado", chapter: "tarjeta", anchors: ["tarjeta-estado"],
      keys: [["estado", "status"], ["tarde", "late"], ["pendiente", "pending"]],
      steps: [
        { kind: "ask", anchor: "tarjeta-estado", caption: ["¿Y cómo va este patio? La pastilla ya lo dice.", "And how is this yard doing? The pill already tells you."] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["La píldora avisa sin abrir: Pendiente por hacer, Tarde vencido, Realizado cerrado.", "The pill says it without opening: Pending to do, Late past due, Done closed."] },
        { kind: "ref", topic: "hoy" },
      ],
    },
    {
      id: "q1-ayuda", chapter: "ayuda", anchors: ["pista-boton"],
      keys: [["ayuda", "help"], ["manual", "manual"], ["pista", "hint"]],
      steps: [
        { kind: "show", anchor: "pista-boton", caption: ["Cada (?) explica su control; el Manual lo guarda todo.", "Every (?) explains its control; the Manual holds everything."] },
        { kind: "ref", topic: "manual-uso" },
      ],
    },
  ],
};
