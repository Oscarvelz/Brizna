/**
 * Q0 · La vuelta completa — el estudio rápido del ciclo entero: un cliente,
 * el día de trabajo y el dinero, en una sola pasada a profundidad de trabajo.
 * NO es Q1: El mapa enseña los LUGARES; la vuelta recorre el CICLO. El marco
 * se dice en voz alta en los primeros pies y se repite al cerrar: esto es
 * solo una mirada rápida; al terminar se conocen las piezas principales y se
 * puede empezar — el dominio vive en los demás módulos, nombrados al final
 * y no enseñados aquí.
 * Escenario: vuelta-base (Don Aurelio, quincenal, $40, corta HOY, sin deuda).
 * La vuelta monta sobre él (stageCtx.aurelioId): la segunda clienta, Carmen
 * Ruiz ($40), la da de alta el propio alumno con el alta corta de Q2 (nombre
 * + precio + guardar, sin teléfono/dirección/frecuencia) — un pie lo dice
 * tal cual: una clienta se suma a mano y la vuelta sigue con Don Aurelio.
 * Como el alta de Carmen nace hoy, su tarjeta es la que queda pendiente tras
 * cerrar la de Aurelio, y sobre ella se abre Posponer.
 * Nota de actuación (la misma de Q3): el diálogo de Posponer se ABRE y se
 * enseña; elegir día y razón y confirmar se deja al alumno — mostrado, no
 * hecho, porque su confirmación no tiene ancla en el flujo de Q3.
 * Hecho se resuelve contra la primera tarjeta visible (la de Aurelio, el
 * primer cliente del escenario): Pendiente nace su deuda de $40, el abono
 * de $20 la parte en dos ($20 por cobrar, $20 cobrado hoy).
 */
import type { Module } from "../guion.ts";

export const Q0: Module = {
  id: "q0-vuelta",
  n: 0,
  floor: "quick",
  title: ["La vuelta completa", "The Full Lap"],
  promise: [
    "Podrás recorrer el ciclo entero — cliente, día y dinero — y saber dónde vive cada pieza.",
    "You will be able to go through the whole cycle — client, day, and money — and know where every piece lives.",
  ],
  ready: true,
  chapters: [
    { id: "apertura", title: ["Una mirada rápida", "A quick look"] },
    { id: "clientes", title: ["Clientes", "Clients"] },
    { id: "dia", title: ["El día de trabajo", "The work day"] },
    { id: "dinero", title: ["El dinero", "The money"] },
    { id: "cierre", title: ["Lo que sigue", "What comes next"] },
  ],
  scenes: [
    {
      id: "q0-apertura", chapter: "apertura", anchors: ["pestana-hoy"],
      keys: [["vuelta", "round"], ["empezar", "start"], ["vista", "view"]],
      steps: [
        { kind: "stage", build: "vuelta-base" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "pestana-hoy", caption: ["Esta vuelta mira rápido; dominar vive en los demás módulos.", "This lap moves fast; mastery lives in the other modules."], contexto: ["Esto es práctica: tu libro real no se toca.", "This is practice: your real book stays untouched."] },
        { kind: "show", anchor: "pestana-hoy", caption: ["Al terminar conoces las piezas principales y puedes empezar.", "By the end you know the main pieces and can start."] },
      ],
    },
    {
      id: "q0-alta", chapter: "clientes", anchors: ["alta-nombre", "alta-precio", "alta-guardar", "alta-confirmar"],
      keys: [["nombre", "name"], ["precio", "price"], ["guardar", "save"], ["cliente", "client"]],
      steps: [
        { kind: "go", screen: "/nuevo" },
        { kind: "type", anchor: "alta-nombre", text: ["Carmen Ruiz", "Carmen Ruiz"], caption: ["Sumas una clienta a mano; la vuelta sigue con Aurelio.", "You add one client by hand; the lap continues with Aurelio."] },
        { kind: "type", anchor: "alta-precio", text: ["40", "40"], caption: ["Su precio: $40 por corte, como Don Aurelio.", "Her price: $40 per cut, like Don Aurelio."] },
        { kind: "do", anchor: "alta-guardar", caption: ["Toca Guardar: el alta pide una última confirmación.", "Tap Save: registering asks one last confirmation."] },
        { kind: "do", anchor: "alta-confirmar", caption: ["Confirma: nombre y precio quedan en una línea.", "Confirm: name and price stand in one line."] },
      ],
    },
    {
      id: "q0-lista", chapter: "clientes", anchors: ["lista-clientes"],
      keys: [["lista", "list"], ["clientes", "clients"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["Tus clientes viven aquí, en la lista: Aurelio y Carmen.", "Your clients live here, on the list: Aurelio and Carmen."] },
      ],
    },
    {
      id: "q0-ficha", chapter: "clientes", anchors: ["ficha-deuda", "movimientos"],
      keys: [["ficha", "client file"], ["deuda", "debt"], ["movimientos", "movements"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su ficha guarda su deuda: hoy empieza en cero.", "His file keeps his debt: today it is zero."] },
        { kind: "show", anchor: "movimientos", caption: ["Movimientos guarda cada dólar que entra y sale.", "Movements keeps every dollar that comes and goes."] },
      ],
    },
    {
      id: "q0-hoy", chapter: "dia", anchors: ["dia-hoy"],
      keys: [["hoy", "today"], ["día", "day"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "dia-hoy", caption: ["Hoy trae su tarjeta: Don Aurelio corta hoy, $40.", "Today holds his card: Don Aurelio cuts today, $40."] },
      ],
    },
    {
      id: "q0-hecho", chapter: "dia", anchors: ["hecho", "hecho-pendiente", "hecho-confirmar"],
      keys: [["hecho", "done"], ["pendiente", "unpaid"], ["por cobrar", "to collect"]],
      steps: [
        { kind: "do", anchor: "hecho", caption: ["Terminas su patio: toca Hecho en su tarjeta.", "You finish his yard: tap Done on his card."] },
        { kind: "do", anchor: "hecho-pendiente", caption: ["Elige Pendiente: queda a deber este corte.", "Choose Unpaid: this cut stays owed."] },
        { kind: "do", anchor: "hecho-confirmar", caption: ["Confirma: nace su deuda de $40 en Por cobrar.", "Confirm: his $40 debt is born in To collect."] },
      ],
    },
    {
      id: "q0-posponer", chapter: "dia", anchors: ["tarjeta-posponer"],
      keys: [["posponer", "postpone"], ["mañana", "tomorrow"]],
      steps: [
        { kind: "do", anchor: "tarjeta-posponer", caption: ["¿Carmen no puede hoy? Toca Posponer su tarjeta.", "Carmen cannot today? Tap Postpone on her card."] },
        { kind: "show", anchor: "tarjeta-posponer", caption: ["Eliges día y razón: mañana sigue su ruta normal.", "You pick day and reason; tomorrow her route continues."] },
      ],
    },
    {
      id: "q0-cobros-deuda", chapter: "dinero", anchors: ["por-cobrar"],
      keys: [["por cobrar", "to collect"], ["cobros", "payments"], ["deuda", "debt"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["En Cobros, Por cobrar ya muestra sus $40.", "In Payments, To collect already shows his $40."], contexto: ["La deuda nació al cerrar Hecho pendiente en Hoy.", "The debt was born closing Done unpaid in Today."] },
      ],
    },
    {
      id: "q0-abono", chapter: "dinero", anchors: ["ficha-abono", "pago-cantidad", "pago-confirmar", "ficha-deuda"],
      keys: [["abono", "partial payment"], ["cantidad", "amount"], ["saldo", "balance"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "do", anchor: "ficha-abono", caption: ["Te entrega una parte: toca Abono en su ficha.", "He hands you part of it: tap Partial on his file."] },
        { kind: "type", anchor: "pago-cantidad", text: ["20", "20"], caption: ["Escribes $20: la mitad de lo que debe hoy.", "You type $20: half of what he owes today."] },
        { kind: "do", anchor: "pago-confirmar", caption: ["Confirma el abono de $20.", "Confirm the $20 partial payment."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su saldo baja a $20: la otra mitad sigue viva.", "His balance drops to $20: the other half stays alive."] },
      ],
    },
    {
      id: "q0-cobros-despues", chapter: "dinero", anchors: ["por-cobrar", "cobrado"],
      keys: [["por cobrar", "to collect"], ["cobrado", "collected"], ["dinero", "money"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["Por cobrar bajó a $20: eso falta por entrar.", "To collect dropped to $20: that is still to come in."] },
        { kind: "show", anchor: "cobrado", caption: ["Cobrado muestra los $20 que entraron hoy.", "Collected shows the $20 that came in today."] },
      ],
    },
    {
      id: "q0-puertas", chapter: "cierre", anchors: ["pestana-clientes"],
      keys: [["mensaje", "message"], ["bloc", "pad"], ["fichero", "file"]],
      steps: [
        { kind: "show", anchor: "pestana-clientes", caption: ["Hablar con el cliente, Bloc y Fichero, Encontrar todo: profundiza ahí.", "Talking with the client, Pad and File, Finding everything: go deeper there."], contexto: ["Cada módulo enseña su pieza a fondo.", "Each ladder module teaches its piece in depth."] },
      ],
    },
    {
      id: "q0-cierre", chapter: "cierre", anchors: ["pestana-hoy"],
      keys: [["vuelta", "round"], ["manual", "manual"], ["hoy", "today"]],
      steps: [
        { kind: "show", anchor: "pestana-hoy", caption: ["Vuelta completa: viste el ciclo; dominarlo vive en los demás módulos.", "Full lap done: you have seen the whole cycle; mastery lives in the other modules."] },
      ],
    },
  ],
};
