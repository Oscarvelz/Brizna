/**
 * AD5 · La Agenda de verdad — cómo nace una visita (frecuencia anclada al
 * día de inicio, horizonte, poda, lo movido a mano queda fijo), el modelo
 * VERDADERO de estados (Tarde se calcula; «Pospuesto» no es un estado sino
 * una vista de movidos — censo C-8/C-10, VERIFY V-1), Mover el día entero,
 * reordenar la ruta, días libres y días raros con el guardia del domingo,
 * el Calendario y el aterrizaje de la notificación. Censo C-1…C-68.
 * Escenario: agenda-base (cinco clientes: hoy, tarde, día lleno, una
 * visita movida a mano y un hecho cobrado). No re-enseña la tarjeta:
 * Q1/Q3 ya la presentaron; aquí se lee la Agenda como futuro.
 *
 * ANCLAS NUEVAS (present, <superficie>-<control>) — a acuñar por la ola:
 *  - agenda-periodos        · routes/agenda.tsx (Semana/Mes/Todo + Calendario)
 *  - agenda-calendario      · routes/agenda.tsx (botón Calendario y MonthBoard)
 *  - agenda-conteo          · routes/agenda.tsx (línea «N trabajos · $suma»)
 *  - agenda-mover-dia       · routes/agenda.tsx (botón Mover de la cabecera del día)
 *  - agenda-mover-fecha     · routes/agenda.tsx (selector de fecha del diálogo Mover)
 *  - agenda-reordenar       · components/reorder-jobs.tsx (lista arrastrable del día)
 *  - agenda-acumulado       · routes/agenda.tsx (sección Trabajo acumulado)
 *  - agenda-pasar-atrasados · routes/agenda.tsx (botón Pasar atrasados)
 *  - agenda-informe-dia     · routes/agenda.tsx (informe del día no trabajado)
 *  - agenda-dias-libres     · routes/agenda.tsx (panel Días libres, id ag-libres)
 *  - agenda-dia-libre-chip  · routes/agenda.tsx (chip de día del panel de libres)
 *  - agenda-libre-confirmar · routes/agenda.tsx (diálogo «¿Cambiar este día?»)
 *  - agenda-casi-nunca      · routes/agenda.tsx (fila de días que casi nunca se trabajan)
 *  - agenda-dia-raro        · components/off-day-ask.tsx (diálogo de día raro)
 *  - agenda-vacaciones-aviso · routes/agenda.tsx (aviso de Modo vacaciones)
 *  - tarjeta-deshacer-pospuesto · components/job-card.tsx (botón deshacer pospuesto)
 * Anclas existentes que se reusan: agenda, tarjeta-estado, tarjeta-posponer.
 */
import type { Module } from "../guion.ts";

export const AD5: Module = {
  id: "ad5-agenda",
  n: 11,
  floor: "advanced",
  title: ["La Agenda de verdad", "The real Schedule"],
  promise: [
    "Podrás leer la Agenda como el futuro del negocio y mover cualquier visita sin romper la siembra.",
    "You will be able to read the Schedule as the future of the business and move any visit without breaking the planting.",
  ],
  ready: true,
  chapters: [
    { id: "nace", title: ["Cómo nace una visita", "How a visit is born"] },
    { id: "estados", title: ["Los estados verdaderos", "The true states"] },
    { id: "mover", title: ["Mover sin romper", "Moving without breaking"] },
    { id: "libres", title: ["Días libres y días raros", "Off days and rare days"] },
    { id: "calendario", title: ["El Calendario y los avisos", "The Calendar and alerts"] },
  ],
  scenes: [
    {
      id: "ad5-abrir", chapter: "nace", anchors: ["agenda-periodos"],
      keys: [["agenda", "schedule"], ["futuro", "future"]],
      steps: [
        { kind: "stage", build: "agenda-base" },
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda-periodos", caption: ["La Agenda es el futuro del negocio, día por día.", "The Schedule is the business's future, day by day."] },
        { kind: "show", anchor: "agenda-periodos", caption: ["Semana, Mes o Todo acotan cuánto futuro miras.", "Week, Month or All limits how much future you see."] },
      ],
    },
    {
      id: "ad5-frecuencia", chapter: "nace", anchors: ["agenda"],
      keys: [["frecuencia", "frequency"], ["visita", "visit"]],
      steps: [
        { kind: "show", anchor: "agenda", caption: ["Cada visita nace sola, de la frecuencia de su cliente.", "Each visit is born by itself, from its client's frequency."], contexto: ["La frecuencia se ancla al día de inicio: ese día manda el ritmo.", "Frequency anchors to the start date: that day sets the pace."] },
        { kind: "show", anchor: "agenda", caption: ["Semanal cae cada siete días; quincenal, cada catorce.", "Weekly lands every seven days; biweekly, every fourteen."] },
      ],
    },
    {
      id: "ad5-horizonte", chapter: "nace", anchors: ["agenda-conteo"],
      keys: [["12 meses", "12 months"], ["meses por delante", "months ahead"]],
      steps: [
        { kind: "show", anchor: "agenda-conteo", caption: ["La siembra llega hasta el horizonte: meses por delante.", "The planting reaches the horizon: months ahead."], contexto: ["El horizonte vive en Ajustes, junto a Temporada; doce meses por defecto.", "The horizon lives in Settings, beside Season; twelve months by default."] },
        { kind: "show", anchor: "agenda-conteo", caption: ["Esta línea suma trabajos y dinero de la vista.", "This line adds up the view's jobs and money."], contexto: ["Todo más Pendiente vale si se hace todo: no es dinero cobrado.", "All plus Pending only counts if everything gets done: not money collected."] },
      ],
    },
    {
      id: "ad5-poda", chapter: "nace", anchors: ["tarjeta-estado"],
      keys: [["se rehace sola", "rebuilds itself"], ["a mano", "moved by hand"]],
      steps: [
        { kind: "show", anchor: "tarjeta-estado", caption: ["Al cambiar un plan, la siembra se rehace sola.", "When a plan changes, the planting remakes itself."], contexto: ["Lo sembrado que ya no encaja se poda; nada viejo queda duplicado.", "Planted work that no longer fits is pruned; nothing old duplicates."] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["Pero lo movido a mano queda fijo donde lo dejaste.", "But hand-moved work stays fixed where you left it."] },
      ],
    },
    {
      id: "ad5-tarde", chapter: "estados", anchors: ["tarjeta-estado"],
      keys: [["tarde", "late"], ["estado", "state"]],
      steps: [
        { kind: "ask", anchor: "tarjeta-estado", caption: ["¿Dónde se guarda el estado Tarde de Carmen?", "Where is Carmen's Late state stored?"] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["En ningún sitio: Tarde se calcula cada día.", "Nowhere: Late is computed every day."], contexto: ["Pendiente con fecha pasada es Tarde; al hacerlo o moverlo, deja de serlo.", "Pending with a past date is Late; doing or moving it ends that."] },
      ],
    },
    {
      id: "ad5-pospuesto", chapter: "estados", anchors: ["agenda", "tarjeta-estado"],
      keys: [["pospuesto", "postponed"], ["movidos", "moved"]],
      verify: "VERIFY V-1 (censo C): «Pospuesto» es un pseudo-filtro local (originDate ≠ scheduledDate o razón), no un estado guardado; Tarde tampoco se guarda, se calcula. Guionado como el modelo del código, no como el Manual lo presenta.",
      steps: [
        { kind: "do", anchor: "agenda", caption: ["Toca Pospuesto en los filtros de arriba.", "Tap Postponed in the filters above."] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["Pospuesto no es un estado: es la vista de movidos.", "Postponed is not a state: it is the moved view."], contexto: ["Aquí vive todo trabajo con día original distinto o con razón.", "Every job with a different original day or a reason lives here."] },
        { kind: "show", anchor: "tarjeta-estado", caption: ["La visita de Elena se movió por lluvia: aquí está.", "Elena's visit moved for rain: here it is."] },
      ],
    },
    {
      id: "ad5-otros-estados", chapter: "estados", anchors: ["agenda"],
      keys: [["realizado", "done"], ["cancelado", "cancelled"]],
      steps: [
        { kind: "show", anchor: "agenda", caption: ["Realizado guarda el historial del período, ya hecho.", "Done keeps the period's history, already finished."] },
        { kind: "show", anchor: "agenda", caption: ["Cancelado nace dentro de Posponer, con su razón.", "Cancelled is born inside Postpone, with its reason."], contexto: ["No hay botón de cancelar en la tarjeta: nunca lo hubo.", "There is no cancel button on the card: there never was."] },
      ],
    },
    {
      id: "ad5-deshacer-pospuesto", chapter: "estados", anchors: ["tarjeta-deshacer-pospuesto"],
      keys: [["deshacer pospuesto", "undo postpone"], ["volver", "return"]],
      steps: [
        { kind: "show", anchor: "tarjeta-deshacer-pospuesto", caption: ["Un pospuesto puede volver a su día original.", "A postponed job can return to its original day."], contexto: ["Volver borra la razón; si ese día ya tiene su corte, avisa.", "Returning erases the reason; if that day has its cut, it warns."] },
      ],
    },
    {
      id: "ad5-mover-dia", chapter: "mover", anchors: ["agenda-mover-dia", "agenda-mover-fecha"],
      keys: [["mover", "move"], ["patios de este día", "this day's yards"]],
      steps: [
        { kind: "do", anchor: "agenda-mover-dia", caption: ["Mover pasa todos los patios de un día.", "Move shifts every yard of one day."] },
        { kind: "show", anchor: "agenda-mover-fecha", caption: ["Eliges la fecha destino y todo el día viaja.", "You pick the target date and the whole day travels."], contexto: ["Mover es el día entero; Posponer, un solo patio desde su tarjeta.", "Move is the whole day; Postpone, one yard from its card."] },
      ],
    },
    {
      id: "ad5-reordenar", chapter: "mover", anchors: ["agenda-reordenar"],
      keys: [["reordenar", "reorder"], ["ruta", "route"]],
      steps: [
        { kind: "show", anchor: "agenda-reordenar", caption: ["En Pendiente, la lista se reordena arrastrando el asa.", "In Pending, the list reorders by dragging the handle."], contexto: ["El orden es tu ruta; se guarda al soltar el dedo.", "The order is your route; it saves when you let go."] },
        { kind: "show", anchor: "agenda-reordenar", caption: ["Sin arrastre posible, el asa solo alinea los nombres.", "When dragging is impossible, the handle only aligns names."] },
      ],
    },
    {
      id: "ad5-acumulado", chapter: "mover", anchors: ["agenda-acumulado", "agenda-pasar-atrasados"],
      keys: [["trabajo acumulado", "accumulated work"], ["pasar atrasados", "move late ones"]],
      steps: [
        { kind: "show", anchor: "agenda-acumulado", caption: ["Trabajo acumulado junta el atraso de todo el libro.", "Accumulated work gathers lateness from the whole book."] },
        { kind: "show", anchor: "agenda-pasar-atrasados", caption: ["Pasar atrasados lo mueve todo a la fecha elegida.", "Move late shifts everything to the chosen date."], contexto: ["No es solo esta vista: es cada patio tarde que debes.", "Not just this view: it is every late yard you owe."] },
      ],
    },
    {
      id: "ad5-informe", chapter: "mover", anchors: ["agenda-informe-dia"],
      keys: [["informe", "report"], ["no se trabajó", "not worked"]],
      steps: [
        { kind: "show", anchor: "agenda-informe-dia", caption: ["Bajo cada día, el informe dice por qué no se trabajó.", "Below each day, the report says why it was not worked."], contexto: ["Agrupa por razón y nombra a los clientes: Lluvia, Ana, Luis.", "It groups by reason and names the clients: Rain, Ana, Luis."] },
      ],
    },
    {
      id: "ad5-libres", chapter: "libres", anchors: ["agenda-dias-libres", "agenda-dia-libre-chip", "agenda-libre-confirmar"],
      keys: [["días libres", "days off"], ["libre", "off"]],
      steps: [
        { kind: "show", anchor: "agenda-dias-libres", caption: ["Días libres marca fechas que el negocio descansa.", "Off days marks dates the business rests."] },
        { kind: "do", anchor: "agenda-dia-libre-chip", caption: ["Toca un día de esta semana para cambiarlo.", "Tap a day this week to change it."] },
        { kind: "show", anchor: "agenda-libre-confirmar", caption: ["Al cerrar un día, sus patios pasan solos al siguiente abierto.", "Closing a day moves its yards by itself to the next open day."], contexto: ["Al reabrirlo, los ya movidos se quedan donde están.", "Reopening it leaves already-moved yards where they are."] },
      ],
    },
    {
      id: "ad5-casi-nunca", chapter: "libres", anchors: ["agenda-casi-nunca"],
      keys: [["casi nunca", "almost never"], ["casi nunca se trabaja", "almost-never"]],
      steps: [
        { kind: "show", anchor: "agenda-casi-nunca", caption: ["Los días que casi nunca se trabajan frenan la siembra.", "Rarely worked weekdays hold back the planting."], contexto: ["Los cortes regulares no caen ahí; uno movido a mano, sí puede.", "Regular cuts never land there; a hand-moved one can."] },
      ],
    },
    {
      id: "ad5-domingo", chapter: "libres", anchors: ["agenda-dia-raro"],
      keys: [["domingo", "sunday"], ["casi nunca", "almost never"]],
      steps: [
        { kind: "show", anchor: "agenda-dia-raro", caption: ["El domingo siempre pregunta antes de recibir trabajo.", "Sunday always asks before receiving work."], contexto: ["El guardia vive en toda la app: tarjeta, alta, ficha y Agenda.", "The guard lives app-wide: card, signup, file, and Schedule."] },
        { kind: "show", anchor: "agenda-dia-raro", caption: ["Puedes dejarlo ese domingo o pasarlo al lunes.", "You can leave it that Sunday or shift it to Monday."] },
      ],
    },
    {
      id: "ad5-calendario", chapter: "calendario", anchors: ["agenda-calendario"],
      keys: [["calendario", "calendar"], ["mes", "month"]],
      verify: "VERIFY V-6 (censo C): el doble toque del Calendario no tiene destino cableado en AgendaPage (onDive no se pasa); se menciona solo como desplazamiento interno a la lista inferior, nunca como gesto estrella, hasta confirmarlo en la app viva.",
      steps: [
        { kind: "do", anchor: "agenda-calendario", caption: ["Calendario cambia la lista por la rejilla del mes.", "Calendar swaps the list for the month grid."] },
        { kind: "show", anchor: "agenda-calendario", caption: ["Cada celda cuenta los patios de ese día.", "Each cell counts that day's yards."], contexto: ["Un toque elige el día; la lista de abajo pasa a ser ese día.", "One tap picks the day; the list below becomes that day."] },
        { kind: "show", anchor: "agenda-calendario", caption: ["El conteo se tiñe: rojo si pasó, verde si se hizo.", "The count is tinted: red if past, green if done."] },
      ],
    },
    {
      id: "ad5-aterrizaje", chapter: "calendario", anchors: ["agenda"],
      keys: [["aviso", "alert"], ["mañana", "tomorrow"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["El aviso de mañana aterriza aquí, en su día exacto.", "Tomorrow's alert lands here, on its exact day."], contexto: ["La notificación abre Agenda en Pendiente, Todo, sobre esa fecha.", "The notification opens Schedule on Pending, All, over that date."] },
        { kind: "ref", topic: "agenda" },
      ],
    },
  ],
};
