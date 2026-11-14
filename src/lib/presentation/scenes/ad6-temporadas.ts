/**
 * AD6 · Temporadas y vacaciones — la temporada de todos (Ajustes: necesita
 * fechas Y ritmo), la temporada por cliente que sustituye a la global
 * dentro de su ventana, el fin de temporada que devuelve el ritmo normal
 * sin deshacer lo movido a mano, y las vacaciones al ponerlas y al
 * quitarlas. Censo C-54…C-58. La vuelta exacta al quitar vacaciones es
 * VERIFY V-4: la escena de Quitar lo declara y ningún pie promete una
 * vuelta literal a los días originales.
 * Escenarios: temporada-global, temporada-cliente, vacaciones-base y
 * vacaciones-activas (re-sembrados entre capítulos).
 *
 * ANCLAS NUEVAS (present, <superficie>-<control>) — a acuñar por la ola:
 *  - ajustes-temporada            · routes/ajustes.tsx (pliegue Temporada, id aj-temporada)
 *  - ajustes-temporada-interruptor · routes/ajustes.tsx (interruptor «Usar temporada» de SeasonBlock)
 *  - ajustes-temporada-fechas     · routes/ajustes.tsx (Empieza/Termina de SeasonBlock)
 *  - ajustes-temporada-ritmo      · routes/ajustes.tsx («cada cuántos días» de SeasonBlock)
 *  - ficha-temporada              · components/client-form.tsx (temporada por cliente)
 *  - ajustes-vacaciones           · routes/ajustes.tsx (pliegue Modo vacaciones, id aj-vacaciones)
 *  - ajustes-vacaciones-activar   · routes/ajustes.tsx (Activar/Actualizar de vacaciones)
 *  - ajustes-vacaciones-quitar    · routes/ajustes.tsx (botón Quitar vacaciones)
 * Anclas de AD5 que se reusan: agenda, agenda-vacaciones-aviso.
 * Anclas existentes que se reusan: frecuencia.
 */
import type { Module } from "../guion.ts";

export const AD6: Module = {
  id: "ad6-temporadas",
  n: 12,
  floor: "advanced",
  title: ["Temporadas y vacaciones", "Seasons and vacations"],
  promise: [
    "Podrás frenar y reanudar el negocio sin desordenar ningún patio.",
    "You will be able to pause and resume the business without messing up any yard.",
  ],
  ready: true,
  chapters: [
    { id: "global", title: ["La temporada de todos", "Everyone's season"] },
    { id: "cliente", title: ["La temporada de un cliente", "One client's season"] },
    { id: "vacaciones", title: ["Vacaciones: poner y quitar", "Vacations: setting and removing"] },
  ],
  scenes: [
    {
      id: "ad6-global-abrir", chapter: "global", anchors: ["ajustes-temporada"],
      keys: [["temporada", "season"], ["ajustes", "settings"]],
      steps: [
        { kind: "stage", build: "temporada-global" },
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "ajustes-temporada", caption: ["La temporada vive en Ajustes, no en Agenda.", "The season lives in Settings, not in Schedule."] },
        { kind: "show", anchor: "ajustes-temporada", caption: ["Es un ritmo distinto para todos, por un tramo.", "It is a different pace for everyone, for a stretch."] },
      ],
    },
    {
      id: "ad6-global-fechas", chapter: "global", anchors: ["ajustes-temporada-fechas"],
      keys: [["fechas", "dates"], ["empieza", "starts"]],
      steps: [
        { kind: "show", anchor: "ajustes-temporada-fechas", caption: ["Las fechas son mes y día: valen cada año.", "The dates are month and day: they apply every year."] },
        { kind: "show", anchor: "ajustes-temporada-fechas", caption: ["Una temporada puede cruzar el fin de año.", "A season can cross the end of the year."] },
      ],
    },
    {
      id: "ad6-global-ritmo", chapter: "global", anchors: ["ajustes-temporada-ritmo", "ajustes-temporada-interruptor"],
      keys: [["ritmo", "pace"], ["cada cuántos días", "every how many days"]],
      steps: [
        { kind: "show", anchor: "ajustes-temporada-ritmo", caption: ["Sin ritmo, las fechas solas no cambian nada.", "Without a pace, dates alone change nothing."], contexto: ["Temporada necesita las dos cosas: fechas y cada cuántos días.", "A season needs both: dates and how often, in days."] },
        { kind: "show", anchor: "ajustes-temporada-interruptor", caption: ["Este escenario ya la trae encendida: cada diez días.", "This scenario already has it on: every ten days."] },
      ],
    },
    {
      id: "ad6-global-efecto", chapter: "global", anchors: ["agenda"],
      keys: [["agenda", "schedule"], ["al guardar", "when you save"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Al guardar, la Agenda se rehace sola al nuevo ritmo.", "On saving, the Schedule remakes itself to the new pace."] },
        { kind: "show", anchor: "agenda", caption: ["Dentro de la ventana manda la temporada; fuera, el ritmo normal.", "Inside the window the season rules; outside, the normal pace."] },
      ],
    },
    {
      id: "ad6-cliente-abrir", chapter: "cliente", anchors: ["ficha-temporada"],
      keys: [["temporada", "season"], ["cliente", "client"]],
      steps: [
        { kind: "stage", build: "temporada-cliente" },
        { kind: "go", screen: "/clientes/:lucia" },
        { kind: "show", anchor: "ficha-temporada", caption: ["Lucía lleva su propia temporada en su ficha.", "Lucía carries her own season on her file."] },
        { kind: "show", anchor: "ficha-temporada", caption: ["Sus fechas y su número son solo suyos.", "Her dates and her number are hers alone."] },
      ],
    },
    {
      id: "ad6-cliente-sustituye", chapter: "cliente", anchors: ["ficha-temporada", "frecuencia"],
      keys: [["su propia temporada", "her own season"], ["ventana", "window"]],
      steps: [
        { kind: "show", anchor: "ficha-temporada", caption: ["Encendida, su temporada sustituye a la de todos.", "When on, her season replaces everyone's."], contexto: ["Apagada, el cliente sigue la temporada global, si la hay.", "When off, the client follows the global season, if any."] },
        { kind: "show", anchor: "frecuencia", caption: ["Fuera de su ventana vuelve su frecuencia normal.", "Outside her window her normal frequency returns."] },
      ],
    },
    {
      id: "ad6-fin-temporada", chapter: "cliente", anchors: ["agenda"],
      keys: [["fin", "end"], ["ritmo normal", "usual pace"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Al pasar la ventana, todo vuelve al ritmo normal.", "When the window passes, everything returns to normal pace."] },
        { kind: "show", anchor: "agenda", caption: ["Lo movido a mano no vuelve atrás: queda fijo.", "Hand-moved work does not go back: it stays fixed."], contexto: ["La regeneración respeta lo pospuesto, igual que en Agenda.", "Regeneration respects postponed work, just like in Schedule."] },
      ],
    },
    {
      id: "ad6-vacaciones-abrir", chapter: "vacaciones", anchors: ["ajustes-vacaciones"],
      keys: [["vacaciones", "vacations"], ["modo vacaciones", "time off"]],
      steps: [
        { kind: "stage", build: "vacaciones-base" },
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "ajustes-vacaciones", caption: ["Las vacaciones también viven en Ajustes.", "Vacations also live in Settings."] },
        { kind: "show", anchor: "ajustes-vacaciones", caption: ["Desde y Hasta: el tramo entero que no trabajarás.", "From and To: the whole stretch you will not work."] },
      ],
    },
    {
      id: "ad6-vacaciones-activar", chapter: "vacaciones", anchors: ["ajustes-vacaciones-activar"],
      keys: [["activar", "activate"], ["regreso", "return"]],
      steps: [
        { kind: "show", anchor: "ajustes-vacaciones-activar", caption: ["Activar corre cada patio del tramo lo que dura el viaje.", "Activating shifts each yard in the stretch by the trip's length."], contexto: ["El orden entre patios se conserva; nadie pierde su lugar.", "The order among yards is kept; nobody loses their place."] },
        { kind: "show", anchor: "ajustes-vacaciones-activar", caption: ["Lo atrasado de antes pasa al día del regreso.", "Work late from before moves to the return day."] },
        { kind: "show", anchor: "ajustes-vacaciones-activar", caption: ["Cambiar las fechas primero deshace el corrimiento anterior.", "Changing the dates first undoes the previous shift."] },
      ],
    },
    {
      id: "ad6-vacaciones-aviso", chapter: "vacaciones", anchors: ["agenda-vacaciones-aviso"],
      keys: [["aviso", "notice"], ["vacaciones", "vacations"]],
      steps: [
        { kind: "stage", build: "vacaciones-activas" },
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda-vacaciones-aviso", caption: ["Agenda anuncia las vacaciones en lo alto, con palmera.", "Schedule announces vacations at the top, with a palm."] },
        { kind: "show", anchor: "agenda-vacaciones-aviso", caption: ["Dice el tramo y que el trabajo se movió al regreso.", "It says the stretch and that work moved to the return."] },
      ],
    },
    {
      id: "ad6-vacaciones-quitar", chapter: "vacaciones", anchors: ["ajustes-vacaciones-quitar", "agenda"],
      keys: [["quitar vacaciones", "remove time off"], ["volver", "come back"]],
      verify: "VERIFY V-4 (censo C): «Quitar vacaciones» aplica −vacationShift en bloque desde el inicio guardado; no restaura la fecha original registrada de cada patio. Tras choques o movimientos manuales, la vuelta puede no coincidir con el día de antes del viaje. Ningún pie promete una vuelta literal.",
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "ajustes-vacaciones-quitar", caption: ["Quitar vacaciones corre los patios de vuelta y regenera.", "Removing vacations shifts yards back and regenerates."], contexto: ["La vuelta es el corrimiento inverso, no una foto del antes.", "The return is the reverse shift, not a snapshot of before."] },
        { kind: "show", anchor: "ajustes-vacaciones-quitar", caption: ["Si moviste algo a mano, eso se queda como quedó.", "If you moved something by hand, it stays as it ended."] },
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Tras quitarlas, revisa la Agenda antes de prometer días.", "After removing them, check the Schedule before promising days."] },
      ],
    },
  ],
};
