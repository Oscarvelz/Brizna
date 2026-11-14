/**
 * Q2 · Tu primer cliente — el alta entera, actuada de verdad sobre el
 * escenario vacío: el conductor teclea los datos de Don Aurelio y guarda.
 * Censo B (alta y ficha) y C (qué nace: su primera visita).
 * Lo que no se actúa: la Frecuencia es un selector propio de la casa sin
 * gancho de opción estable — se muestra (viene en «cada 2 semanas», el ritmo
 * de la lección) y el Día de inicio es un selector de fecha: se muestra
 * (nace en hoy, el primer corte de la lección).
 */
import type { Module } from "../guion.ts";

export const Q2: Module = {
  id: "q2-cliente",
  n: 2,
  floor: "quick",
  title: ["Tu primer cliente", "Your first client"],
  promise: [
    "Podrás dar de alta un cliente completo y saber qué significa cada dato que pides.",
    "You will be able to register a complete client and know what each detail you ask for means.",
  ],
  ready: true,
  chapters: [
    { id: "abrir", title: ["Abrir el alta", "Opening the form"] },
    { id: "datos", title: ["Cada dato, en su sitio", "Each detail, in its place"] },
    { id: "nace", title: ["Qué nace al guardar", "What is born when you save"] },
  ],
  scenes: [
    {
      id: "q2-libro-vacio", chapter: "abrir", anchors: ["clientes-filtros"],
      keys: [["clientes", "clients"], ["empezar", "start"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "clientes-filtros", caption: ["Tu libro empieza vacío: cada cliente entra por un alta.", "Your book starts empty: every client enters through this form."] },
      ],
    },
    {
      id: "q2-tipo", chapter: "abrir", anchors: ["tipo-cliente"],
      keys: [["tipo", "type"], ["regular", "regular"], ["una vez", "one-time"]],
      steps: [
        { kind: "go", screen: "/nuevo" },
        { kind: "show", anchor: "tipo-cliente", caption: ["Primero el tipo: cliente regular repite; una vez, solo un trabajo.", "First the type: a regular client repeats; one-time is one job."], contexto: ["Permanente y Una vez piden datos distintos: el formulario cambia con el tipo.", "Regular and one-time ask for different details: the form changes with the type."] },
      ],
    },
    {
      id: "q2-nombre", chapter: "datos", anchors: ["alta-nombre"],
      keys: [["nombre", "name"], ["cliente", "client"]],
      steps: [{ kind: "type", anchor: "alta-nombre", text: ["Don Aurelio", "Don Aurelio"], caption: ["El nombre es lo único obligatorio: es quien manda en cada tarjeta.", "The name is the only required field: it leads every card."] }],
    },
    {
      id: "q2-telefono", chapter: "datos", anchors: ["alta-telefono"],
      keys: [["teléfono", "phone"], ["llamar", "call"]],
      steps: [{ kind: "type", anchor: "alta-telefono", text: ["305 555 0140", "305 555 0140"], caption: ["El teléfono enciende llamar y escribirle desde cualquier tarjeta.", "The phone switches on calling and messaging from any card."] }],
    },
    {
      id: "q2-direccion", chapter: "datos", anchors: ["alta-direccion"],
      keys: [["dirección", "address"], ["mapa", "map"]],
      steps: [{ kind: "type", anchor: "alta-direccion", text: ["123 Palm Street", "123 Palm Street"], caption: ["La dirección enciende el mapa: llegar al patio sin preguntar.", "The address switches on the map: reaching the yard without asking."] }],
    },
    {
      id: "q2-precio", chapter: "datos", anchors: ["alta-precio"],
      keys: [["precio", "price"], ["corte", "cut"]],
      steps: [{ kind: "type", anchor: "alta-precio", text: ["40", "40"], caption: ["El precio por corte: $40 será el monto de cada visita.", "The price per cut: $40 will be the amount of every visit."] }],
    },
    {
      id: "q2-frecuencia", chapter: "datos", anchors: ["frecuencia"],
      keys: [["frecuencia", "frequency"], ["cada 2 semanas", "every 2 weeks"]],
      steps: [{ kind: "show", anchor: "frecuencia", caption: ["La frecuencia siembra sola las visitas: aquí, cada 2 semanas.", "The frequency plants the visits by itself: here, every 2 weeks."] }],
    },
    {
      id: "q2-inicio", chapter: "datos", anchors: ["dia-inicio"],
      keys: [["día de inicio", "start day"], ["primer corte", "first cut"]],
      steps: [{ kind: "show", anchor: "dia-inicio", caption: ["El día de inicio es el primer corte: hoy, para Don Aurelio.", "The start day is the first cut: today, for Don Aurelio."] }],
    },
    {
      id: "q2-cobro", chapter: "datos", anchors: ["cobro-cliente"],
      keys: [["cobro", "payment"], ["se acumula", "adds up"], ["paga el mismo día", "pays the same day"]],
      steps: [{ kind: "show", anchor: "cobro-cliente", caption: ["El cobro decide: cada corte suma a la cuenta, o paga el mismo día.", "Payment decides: each cut adds to the balance, or they pay the same day."] }],
    },
    {
      id: "q2-guardar", chapter: "nace", anchors: ["alta-guardar", "alta-confirmar"],
      keys: [["guardar", "save"], ["añadir", "add"]],
      steps: [
        { kind: "ask", anchor: "alta-guardar", caption: ["¿Todo listo? Guardar pide una última confirmación con el resumen.", "All set? Saving asks one last confirmation with the summary."] },
        { kind: "do", anchor: "alta-guardar", caption: ["Toca el botón de guardar.", "Tap the save button."] },
        { kind: "do", anchor: "alta-confirmar", caption: ["Confirma: nombre, frecuencia y precio en una línea.", "Confirm: name, frequency and price in one line."] },
      ],
    },
    {
      id: "q2-ficha", chapter: "nace", anchors: ["ficha-deuda"],
      keys: [["ficha", "client file"], ["nace", "is born"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Nace su ficha: aquí vivirán su deuda, pagos e historial.", "Their file is born: debt, payments and history will live here."] },
      ],
    },
    {
      id: "q2-primera-visita", chapter: "nace", anchors: ["agenda"],
      keys: [["agenda", "schedule"], ["visita", "visit"], ["hoy", "today"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Y nace su primera visita: hoy, en la Agenda y en Hoy.", "And their first visit is born: today, in Schedule and Today."] },
      ],
    },
    {
      id: "q2-en-la-lista", chapter: "nace", anchors: ["lista-clientes"],
      keys: [["lista", "list"], ["clientes", "clients"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["En la lista ya está, con su precio grande y su ritmo.", "They are on the list now, with their big price and rhythm."] },
      ],
    },
  ],
};
