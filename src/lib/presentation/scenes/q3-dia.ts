/**
 * Q3 · El día de trabajo — Hoy entero: la ruta, Fijados/Atrasados, las TRES
 * vías de Hecho actuadas sobre tarjetas reales (cobrado, pendiente,
 * abonado), Posponer, Parar por lluvia y Pasar pendientes, cada una con su
 * qué-pasa-después. Censo A y D. Escenario: ruta-dia (cuatro patios: uno
 * atrasado fijado y tres de hoy — alcanzan para las tres vías y posponer).
 * Nota de actuación: Hecho se resuelve contra la primera tarjeta visible,
 * así que el orden de las vías sigue el orden de la pantalla (la atrasada
 * primero, en Fijados). El diálogo de Posponer se abre y se enseña; su
 * confirmación (día + razón) se deja al alumno — ver el informe de la ola.
 */
import type { Module } from "../guion.ts";

export const Q3: Module = {
  id: "q3-dia",
  n: 3,
  floor: "quick",
  title: ["El día de trabajo", "The work day"],
  promise: [
    "Podrás trabajar Hoy entero: ver la ruta, fijar, y cerrar cada patio en sus tres vías.",
    "You will be able to work all of Today: see the route, pin, and close each yard three ways.",
  ],
  ready: true,
  chapters: [
    { id: "ruta", title: ["La ruta de hoy", "Today's route"] },
    { id: "hecho", title: ["Hecho, en sus tres vías", "Done, in its three ways"] },
    { id: "mover", title: ["Mover el día", "Moving the day"] },
  ],
  scenes: [
    {
      id: "q3-ruta", chapter: "ruta", anchors: ["dia-hoy"],
      keys: [["hoy", "today"], ["ruta", "route"]],
      steps: [
        { kind: "stage", build: "ruta-dia" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "dia-hoy", caption: ["Este es tu día: los patios de hoy, en orden de ruta.", "This is your day: today's yards, in route order."] },
      ],
    },
    {
      id: "q3-fijados", chapter: "ruta", anchors: ["en-la-mira"],
      keys: [["fijados", "pinned"], ["atrasados", "late"]],
      steps: [
        { kind: "show", anchor: "en-la-mira", caption: ["Arriba viven los Fijados: atrasados y alto riesgo, hasta resolverlos.", "Pinned live at the top: late and high risk, until resolved."], contexto: ["El pin de un atrasado viene forzado: no se quita hasta hacer el patio.", "A late yard's pin is forced: it stays until the yard is done."] },
      ],
    },
    {
      id: "q3-hecho-abre", chapter: "hecho", anchors: ["hecho"],
      keys: [["hecho", "done"], ["cerrar", "close"]],
      steps: [
        { kind: "ask", anchor: "hecho", caption: ["¿Terminaste un patio? Hecho pregunta cómo se cierra.", "Finished a yard? Done asks how it closes."] },
        { kind: "do", anchor: "hecho", caption: ["Toca Hecho en la primera tarjeta.", "Tap Done on the first card."] },
      ],
    },
    {
      id: "q3-cobrado", chapter: "hecho", anchors: ["hecho-cobrado", "hecho-confirmar"],
      keys: [["cobrado", "paid"], ["hecho", "done"]],
      steps: [
        { kind: "do", anchor: "hecho-cobrado", caption: ["Elige Cobrado: te pagaron este corte hoy.", "Choose Paid: they paid you for this cut today."] },
        { kind: "do", anchor: "hecho-confirmar", caption: ["La segunda confirmación repite la consecuencia: confirma.", "The second confirmation repeats the consequence: confirm it."], contexto: ["Cobrado anota solo el pago de hoy: la deuda vieja sigue por cobrar.", "Paid records only today's payment: older debt stays in To collect."] },
      ],
    },
    {
      id: "q3-pendiente", chapter: "hecho", anchors: ["hecho", "hecho-pendiente", "hecho-confirmar"],
      keys: [["pendiente", "unpaid"], ["por cobrar", "to collect"]],
      steps: [
        { kind: "do", anchor: "hecho", caption: ["Siguiente patio: toca Hecho.", "Next yard: tap Done."] },
        { kind: "do", anchor: "hecho-pendiente", caption: ["Elige Pendiente: el corte se suma a su cuenta.", "Choose Unpaid: the cut is added to their balance."] },
        { kind: "do", anchor: "hecho-confirmar", caption: ["Confirma: su precio entra en Por cobrar.", "Confirm: its price goes into To collect."], contexto: ["Si tenía adelanto, el adelanto paga primero y la deuda crece menos.", "If they had an advance, it pays first and the debt grows less."] },
      ],
    },
    {
      id: "q3-abonado", chapter: "hecho", anchors: ["hecho", "hecho-abonado", "hecho-calculadora", "hecho-abono-confirmar", "hecho-confirmar"],
      keys: [["abonado", "partial"], ["abono", "partial payment"], ["calculadora", "calculator"]],
      steps: [
        { kind: "do", anchor: "hecho", caption: ["Tercer patio: toca Hecho.", "Third yard: tap Done."] },
        { kind: "do", anchor: "hecho-abonado", caption: ["Elige Abonado: te dan una parte ahora.", "Choose Partial: they give you part of it now."] },
        { kind: "show", anchor: "hecho-calculadora", caption: ["La calculadora pone el monto: chips rápidos o cuentas completas.", "The calculator sets the amount: quick chips or full calculations."] },
        { kind: "do", anchor: "hecho-abono-confirmar", caption: ["Confirma el abono escrito.", "Confirm the partial amount written."] },
        { kind: "do", anchor: "hecho-confirmar", caption: ["Y confirma el cierre: el resto sigue por cobrar.", "And confirm the close: the rest stays in To collect."], contexto: ["Abonado suma el corte entero y resta el abono: esa es su aritmética.", "Partial adds the whole cut, then subtracts the payment: that is its math."] },
      ],
    },
    {
      id: "q3-posponer", chapter: "mover", anchors: ["tarjeta-posponer"],
      keys: [["posponer", "postpone"], ["cancelado", "cancelled"]],
      steps: [
        { kind: "do", anchor: "tarjeta-posponer", caption: ["¿Un patio no se puede hoy? Toca Posponer.", "A yard cannot happen today? Tap Postpone."] },
        { kind: "show", anchor: "tarjeta-posponer", caption: ["Eliges día y razón; con Cancelado, el corte no vuelve.", "You pick day and reason; with Cancelled, the cut never returns."], contexto: ["Posponer mueve el patio entero: su precio y su deuda no cambian.", "Postponing moves the whole yard: its price and debt do not change."] },
      ],
    },
    {
      id: "q3-parar", chapter: "mover", anchors: ["parar-dia"],
      keys: [["parar", "stop"], ["lluvia", "rain"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "parar-dia", caption: ["¿Lluvia? Parar el día pasa los patios y prepara los avisos.", "Rain? Stopping the day moves the yards and readies notices."], contexto: ["Se guarda la hora exacta y todo pasa al siguiente día abierto.", "The exact time is saved and everything moves to the next open day."] },
      ],
    },
    {
      id: "q3-pasar", chapter: "mover", anchors: ["pasar-pendientes"],
      keys: [["pasar atrasados", "move late"], ["pendientes", "pending"]],
      steps: [{ kind: "show", anchor: "pasar-pendientes", caption: ["Pasar pendientes mueve el día sin pararlo: día destino y razón.", "Move pending moves the day without stopping it: target day and reason."] }],
    },
    {
      id: "q3-todos", chapter: "mover", anchors: ["todos"],
      keys: [["todos", "all"], ["quién pagó", "who paid"]],
      steps: [{ kind: "show", anchor: "todos", caption: ["Todos cierra el día de una pasada: patio por patio, quién pagó.", "All closes the whole day at once: yard by yard, who paid."] }],
    },
    {
      id: "q3-hechos-hoy", chapter: "mover", anchors: ["hechos-hoy"],
      keys: [["hechos hoy", "done today"], ["deshacer", "undo"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "hechos-hoy", caption: ["Lo cerrado hoy queda aquí; desde aquí también se deshace.", "What closed today stays here; from here it also undoes."] },
      ],
    },
  ],
};
