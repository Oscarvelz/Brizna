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
      ],
    },
    {
      id: "q1-agenda", chapter: "pestanas", anchors: ["pestana-agenda"],
      keys: [["agenda", "schedule"], ["visitas", "visits"]],
      steps: [{ kind: "show", anchor: "pestana-agenda", caption: ["Agenda: las visitas que vienen, día por día.", "Schedule: the visits ahead, day by day."] }],
    },
    {
      id: "q1-clientes", chapter: "pestanas", anchors: ["pestana-clientes"],
      keys: [["clientes", "clients"], ["ficha", "client file"]],
      steps: [{ kind: "show", anchor: "pestana-clientes", caption: ["Clientes: tu lista entera, cada uno con su ficha.", "Clients: your whole list, each with their file."] }],
    },
    {
      id: "q1-cobros", chapter: "pestanas", anchors: ["pestana-cobros"],
      keys: [["cobros", "payments"], ["deuda", "debt"]],
      steps: [{ kind: "show", anchor: "pestana-cobros", caption: ["Cobros: quién debe, quién abonó y qué entró.", "Payments: who owes, who paid part, what came in."] }],
    },
    {
      id: "q1-estudio", chapter: "pestanas", anchors: ["pestana-estudio"],
      keys: [["estudio", "stats"], ["asesor", "advisor"]],
      steps: [{ kind: "show", anchor: "pestana-estudio", caption: ["Estudio: tus cifras; dentro vive también el Asesor.", "Stats: your figures; the Advisor lives inside too."], contexto: ["Estudio y Asesor son una sola pestaña: se voltean en la misma pantalla.", "Stats and the Advisor are one tab: they flip on the same screen."] }],
    },
    {
      id: "q1-vistas", chapter: "tarjeta", anchors: ["vistas"],
      keys: [["vistas", "views"], ["grande", "large"], ["malla", "grid"]],
      steps: [{ kind: "show", anchor: "vistas", caption: ["Cuatro vistas miran el mismo día: Grande, Media, Lista, Malla.", "Four views look at the same day: Large, Medium, List, Grid."] }],
    },
    {
      id: "q1-nombre", chapter: "tarjeta", anchors: ["tarjeta-nombre"],
      keys: [["nombre", "name"], ["ficha", "client file"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["El nombre manda en la tarjeta; tocarlo abre su ficha.", "The name leads the card; tapping it opens their file."] },
      ],
    },
    {
      id: "q1-precio-pin", chapter: "tarjeta", anchors: ["tarjeta-precio", "tarjeta-pin"],
      keys: [["precio", "price"], ["pin", "pin"], ["fijado", "pinned"]],
      steps: [
        { kind: "show", anchor: "tarjeta-precio", caption: ["El precio va en su esquina, tranquilo: este corte, $40.", "The price sits in its corner, quietly: this cut, $40."] },
        { kind: "show", anchor: "tarjeta-pin", caption: ["El pin va desnudo sobre el borde; verde significa fijado.", "The pin sits bare on the edge; green means pinned."] },
      ],
    },
    {
      id: "q1-estado", chapter: "tarjeta", anchors: ["tarjeta-estado"],
      keys: [["estado", "status"], ["tarde", "late"], ["pendiente", "pending"]],
      steps: [
        { kind: "ask", anchor: "tarjeta-estado", caption: ["¿Y cómo va este patio? La pastilla ya lo dice.", "And how is this yard doing? The pill already tells you."] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["Pendiente, Tarde con sus días, Realizado: sin abrir nada.", "Pending, Late with its days, Done: without opening anything."] },
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
