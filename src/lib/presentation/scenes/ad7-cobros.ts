/**
 * AD7 · Cobros a fondo — las vistas Por cobrar / Abonado / Cobrado, la
 * honestidad de sus definiciones (H-D3: Abonado se deriva de la palabra
 * «abono» en la nota del pago y de seguir debiendo; H-D4: «En espera»
 * mezcla nivel espera, serio/alto riesgo y pausados, vía inEspera()), el
 * Alto riesgo con sus tres disparadores y la congelación de visitas, los
 * dos relojes del dinero (cuándo entra contra cuándo se trabajó, con el
 * cubo «Saldo inicial» de Estudio) y un orden de cobro que protege el
 * negocio. Censo D-28…D-49, D-31…D-40. No re-enseña abonar: eso fue Q4;
 * Perdonar entero es AD8.
 * Escenario: cobros-tablero (seis casos, uno por vista y por riesgo).
 *
 * ANCLAS NUEVAS (present, <superficie>-<control>) — a acuñar por la ola:
 *  - cobros-abonado       · routes/cobros.tsx (fila/vista Abonado anidada en Por cobrar)
 *  - cobros-espera        · routes/cobros.tsx (pliegue En espera, id cob-espera)
 *  - cobros-perdonado     · routes/cobros.tsx (pliegue Perdonado este mes, id cob-perdonado)
 *  - cobros-hecho         · routes/cobros.tsx (nido Trabajo ya hecho, id cob-hecho)
 *  - cobros-tarjeta       · routes/cobros.tsx (tarjeta de deudor en Por cobrar)
 *  - cobros-riesgo        · routes/cobros.tsx (chip Alto riesgo de la tarjeta)
 *  - cobros-orden         · routes/cobros.tsx (selector de orden de Por cobrar)
 *  - cobros-grupo         · routes/cobros.tsx (casillas y barra Cobrar elegidos)
 *  - ajustes-espera       · routes/ajustes.tsx (pliegue Espera y alto riesgo, id aj-espera)
 *  - estudio-antiguedad   · components/cifras-insights.tsx (cubos de antigüedad de «Quién te debe»)
 * Anclas existentes que se reusan: por-cobrar, cobrado, ficha-deuda, agenda.
 */
import type { Module } from "../guion.ts";

export const AD7: Module = {
  id: "ad7-cobros",
  n: 13,
  floor: "advanced",
  title: ["Cobros a fondo", "Payments in depth"],
  promise: [
    "Podrás leer Cobros como un tablero de riesgo y cobrar en el orden que protege el negocio.",
    "You will be able to read Payments as a risk board and collect in the order that protects the business.",
  ],
  ready: true,
  chapters: [
    { id: "vistas", title: ["Las tres vistas", "The three views"] },
    { id: "riesgo", title: ["En espera y Alto riesgo", "Waiting and High risk"] },
    { id: "relojes", title: ["Los dos relojes del dinero", "Money's two clocks"] },
    { id: "orden", title: ["El orden que protege", "The order that protects"] },
  ],
  scenes: [
    {
      id: "ad7-abrir", chapter: "vistas", anchors: ["por-cobrar"],
      keys: [["cobros", "payments"], ["por cobrar", "to collect"]],
      steps: [
        { kind: "stage", build: "cobros-tablero" },
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["Cobros es un tablero: quién debe, quién pagó, quién espera.", "Payments is a board: who owes, who paid, who waits."] },
        { kind: "show", anchor: "por-cobrar", caption: ["Por cobrar junta a todos los que deben hoy.", "To collect gathers everyone who owes today."] },
      ],
    },
    {
      id: "ad7-orden-lista", chapter: "vistas", anchors: ["cobros-orden"],
      keys: [["orden", "sort"], ["mayor saldo", "highest balance"]],
      steps: [
        { kind: "show", anchor: "cobros-orden", caption: ["La lista se ordena: mayor saldo primero, por defecto.", "The list sorts: largest balance first, by default."] },
        { kind: "show", anchor: "cobros-orden", caption: ["También por nombre, último corte o atraso primero.", "Also by name, last cut, or lateness first."], contexto: ["Atraso usa su día fijo de pago: sin día fijo, no hay atraso.", "Lateness uses their fixed pay day: no fixed day, no lateness."] },
      ],
    },
    {
      id: "ad7-abonado", chapter: "vistas", anchors: ["cobros-abonado"],
      keys: [["abonado", "partial paid"], ["abono", "partial payment"]],
      steps: [
        { kind: "show", anchor: "cobros-abonado", caption: ["Abonado vive dentro de Por cobrar: pagaron parte, deben resto.", "Partial paid lives inside To collect: they paid part, owe the rest."] },
        { kind: "show", anchor: "cobros-abonado", caption: ["Don Aurelio abonó $40 de $120: aquí sigue, debiendo $80.", "Don Aurelio paid $40 of $120: still here, owing $80."], contexto: ["La vista lee la palabra abono en la nota y que aún debe.", "The view reads the word for partial in the note, plus still owing."] },
        { kind: "show", anchor: "cobros-abonado", caption: ["Un adelanto por sobrepago no aparece en esta vista.", "An advance from overpaying does not appear in this view."] },
      ],
    },
    {
      id: "ad7-cobrado", chapter: "vistas", anchors: ["cobrado"],
      keys: [["cobrado", "collected"], ["semana", "week"]],
      steps: [
        { kind: "show", anchor: "cobrado", caption: ["Cobrado se despliega en Semana, Mes y Año.", "Collected unfolds into Week, Month, and Year."] },
        { kind: "show", anchor: "cobrado", caption: ["Julia pagó hoy sus $100: su fila vive aquí.", "Julia paid her $100 today: her row lives here."] },
      ],
    },
    {
      id: "ad7-totales", chapter: "vistas", anchors: ["por-cobrar"],
      keys: [["totales", "totals"], ["lista negra", "blacklist"]],
      steps: [
        { kind: "show", anchor: "por-cobrar", caption: ["Los totales cuentan solo activos y no vetados.", "Totals count only active, non-blacklisted clients."], contexto: ["Es una sola regla en Hoy, Cobros, Estudio y widgets.", "It is one single rule in Today, Payments, Stats, and widgets."] },
        { kind: "show", anchor: "por-cobrar", caption: ["La ficha de cada persona siempre enseña su saldo real.", "Each person's file always shows their real balance."] },
      ],
    },
    {
      id: "ad7-espera", chapter: "riesgo", anchors: ["cobros-espera"],
      keys: [["en espera", "waiting"], ["espera", "wait"]],
      steps: [
        { kind: "show", anchor: "cobros-espera", caption: ["En espera guarda dinero que lleva días sin moverse.", "Waiting holds money that has sat unmoved for days."] },
        { kind: "show", anchor: "cobros-espera", caption: ["Carmen debe $40 desde hace cincuenta días: nivel espera.", "Carmen owes $40 from fifty days ago: waiting level."], contexto: ["La vista mezcla tres cosas: espera, alto riesgo y pausados.", "The view mixes three things: waiting, high risk, and paused."] },
        { kind: "show", anchor: "cobros-espera", caption: ["Marta está en pausa y también aparece aquí.", "Marta is paused and also appears here."], contexto: ["En espera no perdona ni pausa la deuda: sigue por cobrar.", "Waiting neither forgives nor pauses the debt: it stays collectible."] },
      ],
    },
    {
      id: "ad7-riesgo", chapter: "riesgo", anchors: ["cobros-riesgo"],
      keys: [["alto riesgo", "high risk"], ["riesgo", "risk"]],
      steps: [
        { kind: "show", anchor: "cobros-riesgo", caption: ["Alto riesgo es naranja: Rodrigo debe $240.", "High risk is orange: Rodrigo owes $240."] },
        { kind: "show", anchor: "cobros-riesgo", caption: ["Basta un disparador: tiempo, monto o cortes sin pagar.", "One trigger is enough: time, amount, or unpaid cuts."], contexto: ["Tiempo cuenta tras la espera; monto, $200; cortes, tres por defecto.", "Time counts after waiting; amount, $200; cuts, three by default."] },
        { kind: "show", anchor: "cobros-riesgo", caption: ["Con saldo en cero, nunca hay riesgo.", "With a zero balance, there is never risk."] },
      ],
    },
    {
      id: "ad7-riesgo-congela", chapter: "riesgo", anchors: ["agenda", "ficha-deuda"],
      keys: [["visitas nuevas", "new visits"], ["seguir atendiendo", "keep serving"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Alto riesgo congela la agenda: no nacen visitas nuevas.", "High risk freezes the schedule: no new visits are born."], contexto: ["Solo queda su próxima visita, clavada en Hoy como aviso.", "Only its next visit remains, pinned in Today as a warning."] },
        { kind: "go", screen: "/clientes/:riesgo" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Se deshiela pagando, perdonando o con Seguir atendiendo.", "It thaws by paying, forgiving, or with Keep serving."] },
      ],
    },
    {
      id: "ad7-umbrales", chapter: "riesgo", anchors: ["ajustes-espera"],
      keys: [["límites", "limits"], ["ajustes", "settings"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "ajustes-espera", caption: ["Los cuatro umbrales viven en Ajustes: días, monto, cortes.", "The four thresholds live in Settings: days, amount, cuts."] },
        { kind: "show", anchor: "ajustes-espera", caption: ["Cambiarlos reclasifica a todos al instante, sin tocar saldos.", "Changing them reclassifies everyone instantly, touching no balances."] },
      ],
    },
    {
      id: "ad7-relojes", chapter: "relojes", anchors: ["cobrado", "cobros-hecho"],
      keys: [["cobrado", "collected"], ["trabajo hecho", "work done"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobrado", caption: ["Cobrado cuenta el dinero el día que entra.", "Collected counts money the day it comes in."] },
        { kind: "show", anchor: "cobros-hecho", caption: ["Trabajo hecho cuenta el precio el día trabajado.", "Work done counts the price on the day it was worked."], contexto: ["Un adelanto cuenta al entrar, aunque su corte sea después.", "An advance counts when it arrives, though its cut comes later."] },
        { kind: "show", anchor: "cobros-hecho", caption: ["Compararlos dice si la deuda se está acumulando.", "Comparing them tells whether debt is piling up."] },
      ],
    },
    {
      id: "ad7-cubos", chapter: "relojes", anchors: ["estudio-antiguedad"],
      keys: [["por antigüedad", "by age"], ["saldo inicial", "opening balance"]],
      steps: [
        { kind: "go", screen: "/estadisticas" },
        { kind: "show", anchor: "estudio-antiguedad", caption: ["En Estudio, la deuda se ordena por antigüedad.", "In Stats, debt is sorted by age."] },
        { kind: "show", anchor: "estudio-antiguedad", caption: ["La deuda anterior vive en su cubo: Saldo inicial.", "Earlier debt lives in its own bucket: Opening balance."], contexto: ["Iván debe $90 de antes: no se disfraza de deuda viejísima.", "Iván owes $90 from before: not disguised as ancient debt."] },
      ],
    },
    {
      id: "ad7-orden-cobro", chapter: "orden", anchors: ["cobros-tarjeta", "cobros-grupo"],
      keys: [["cobrar", "collect"], ["orden", "order"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobros-tarjeta", caption: ["Cobra protegiendo el negocio: primero riesgo y atraso.", "Collect protecting the business: risk and lateness first."] },
        { kind: "show", anchor: "cobros-tarjeta", caption: ["Luego los saldos mayores; lo reciente puede esperar.", "Then the largest balances; recent debt can wait."] },
        { kind: "show", anchor: "cobros-grupo", caption: ["Cada tarjeta lleva casilla: varios saldos, un solo cobro.", "Each card has a checkbox: several balances, one collection."], contexto: ["Cobrar elegidos registra el saldo completo de cada elegido.", "Collect selected records each selected client's full balance."] },
      ],
    },
  ],
};
