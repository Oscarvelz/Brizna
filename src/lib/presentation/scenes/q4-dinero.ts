/**
 * Q4 · El dinero sin miedo — dónde vive el saldo, sumar un cargo, restar
 * con un abono actuado en el diálogo de pago, y la partición invisible del
 * abono dicha en voz alta con una ventanita de contexto. Censo D.
 * Escenario: ruta-dinero (Don Aurelio debe $120: dos cortes + un extra).
 * Verdad 1.5.69 (canon publicado; esta copia es 1.5.66, la lección se
 * escribe contra la descripción verificada): las listas de Cobrado de
 * Cobros incluyen los pagos `prepaid` con su fila «Adelanto» — totales y
 * listas cuentan lo mismo; ningún pie de este módulo afirma lo contrario.
 * Perdonar y su después son de AD8: este piso no los toca.
 */
import type { Module } from "../guion.ts";

export const Q4: Module = {
  id: "q4-dinero",
  n: 4,
  floor: "quick",
  title: ["El dinero sin miedo", "Money without fear"],
  promise: [
    "Podrás sumar un cargo, abonar una parte con la calculadora y entender el saldo de cualquier cliente.",
    "You will be able to add a charge, record a part payment with the calculator, and understand any client's balance.",
  ],
  ready: true,
  chapters: [
    { id: "donde", title: ["Dónde vive el saldo", "Where the balance lives"] },
    { id: "sumar", title: ["Sumar un cargo", "Adding a charge"] },
    { id: "abonar", title: ["Abonar, y qué pasa", "Paying part, and what happens"] },
  ],
  scenes: [
    {
      id: "q4-saldo", chapter: "donde", anchors: ["ficha-deuda"],
      keys: [["saldo", "balance"], ["deuda", "debt"], ["ficha", "client file"]],
      steps: [
        { kind: "stage", build: "ruta-dinero" },
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-deuda", caption: ["El saldo vive aquí: Don Aurelio debe $120.", "The balance lives here: Don Aurelio owes $120."] },
      ],
    },
    {
      id: "q4-de-que", chapter: "donde", anchors: ["ficha-deuda"],
      keys: [["cortes", "cuts"], ["extra", "extra"]],
      steps: [{ kind: "show", anchor: "ficha-deuda", caption: ["¿De qué? Dos cortes de $40 y un extra de $40.", "From what? Two $40 cuts and one $40 extra."], contexto: ["Cada Hecho pendiente y cada extra hecho suma su precio a esta cifra.", "Every unpaid Done and every finished extra adds its price to this figure."] }],
    },
    {
      id: "q4-por-cobrar", chapter: "donde", anchors: ["por-cobrar"],
      keys: [["por cobrar", "to collect"], ["cobros", "payments"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["En Cobros, Por cobrar junta a todos los que deben.", "In Payments, To collect gathers everyone who owes."], contexto: ["Los totales cuentan clientes activos y no vetados: una sola regla en toda la app.", "Totals count active, non-blacklisted clients: one single rule across the app."] },
      ],
    },
    {
      id: "q4-cobrado", chapter: "donde", anchors: ["cobrado"],
      keys: [["cobrado", "collected"], ["adelanto", "advance"]],
      steps: [{ kind: "show", anchor: "cobrado", caption: ["Cobrado lista cada pago y cada adelanto: totales y listas coinciden.", "Collected lists every payment and advance: totals and lists agree."] }],
    },
    {
      id: "q4-sumar", chapter: "sumar", anchors: ["ficha-extra", "extra-titulo", "extra-precio"],
      keys: [["trabajo extra", "extra job"], ["sumar", "add"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "do", anchor: "ficha-extra", caption: ["¿Un trabajo fuera del corte? Súmalo con Trabajo extra.", "A job beyond the cut? Add it with Extra job."] },
        { kind: "type", anchor: "extra-titulo", text: ["Poda de palmera", "Palm tree trim"], caption: ["Escribe qué hay que hacer: queda en su agenda e historial.", "Write what needs doing: it lands in their schedule and history."] },
        { kind: "type", anchor: "extra-precio", text: ["40", "40"], caption: ["Su precio: $40 más a la cuenta cuando se haga.", "Its price: $40 more on the balance once done."] },
      ],
    },
    {
      id: "q4-extra-nace", chapter: "sumar", anchors: ["extra-guardar", "extra-confirmar", "ficha-deuda"],
      keys: [["extra", "extra"], ["hecho", "done"]],
      steps: [
        { kind: "do", anchor: "extra-guardar", caption: ["Añade el extra.", "Add the extra."] },
        { kind: "do", anchor: "extra-confirmar", caption: ["Confirma: como es de hoy, nace hecho y suma.", "Confirm: being today's, it is born done and adds up."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["El saldo subió a $160: sumar es así de directo.", "The balance rose to $160: adding is that direct."] },
      ],
    },
    {
      id: "q4-abrir-abono", chapter: "abonar", anchors: ["ficha-abono"],
      keys: [["abono", "partial payment"], ["registrar un pago", "record a payment"]],
      steps: [
        { kind: "ask", anchor: "ficha-abono", caption: ["¿Te entrega una parte? Eso es un abono.", "They hand you part of it? That is a partial payment."] },
        { kind: "do", anchor: "ficha-abono", caption: ["Toca Abono en su ficha.", "Tap Partial on their file."] },
      ],
    },
    {
      id: "q4-monto", chapter: "abonar", anchors: ["pago-cantidad", "pago-calculadora"],
      keys: [["cantidad", "amount"], ["calculadora", "calculator"]],
      steps: [
        { kind: "type", anchor: "pago-cantidad", text: ["200", "200"], caption: ["Hoy entrega $200: más de lo que debe.", "Today they hand you $200: more than they owe."] },
        { kind: "show", anchor: "pago-calculadora", caption: ["La calculadora suma por ti: 40 más 15, sin salir del cobro.", "The calculator adds for you: 40 plus 15, without leaving the payment."] },
      ],
    },
    {
      id: "q4-particion", chapter: "abonar", anchors: ["pago-cantidad"],
      keys: [["adelanto", "advance"], ["a la deuda", "to the debt"]],
      steps: [{ kind: "show", anchor: "pago-cantidad", caption: ["Mira el reparto antes de confirmar: deuda y adelanto.", "Watch the split before confirming: debt and advance."], contexto: ["$160 pagan la deuda; los $40 sobrantes quedan de adelanto, no doble cobro.", "$160 pays the debt; the extra $40 stays as an advance, not a double charge."] }],
    },
    {
      id: "q4-confirmar", chapter: "abonar", anchors: ["pago-confirmar", "ficha-deuda"],
      keys: [["confirmar", "confirm"], ["abono", "partial payment"]],
      steps: [
        { kind: "do", anchor: "pago-confirmar", caption: ["Confirma el cobro.", "Confirm the payment."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Saldo en cero y $40 de adelanto para su próximo corte.", "Balance at zero and a $40 advance for their next cut."], contexto: ["El adelanto se gasta solo en el próximo Hecho: nunca se cobra dos veces.", "The advance spends itself on the next Done: never collected twice."] },
      ],
    },
    {
      id: "q4-movimientos", chapter: "abonar", anchors: ["movimientos"],
      keys: [["movimientos", "movements"], ["historial", "history"]],
      steps: [
        { kind: "show", anchor: "movimientos", caption: ["Cada dólar queda en Movimientos: pago, adelanto, fecha y medio.", "Every dollar stays in Movements: payment, advance, date and method."] },
        { kind: "ref", topic: "ficha-deuda" },
      ],
    },
  ],
};
