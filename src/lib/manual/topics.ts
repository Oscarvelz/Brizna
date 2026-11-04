/**
 * Brizna manual: the single source of truth for every (?) hint and every manual entry.
 *
 * Two layers, never the same words:
 *  - `what` is the (?) bubble: one or two short, plain sentences (what it is). The manual never shows it.
 *  - The manual page adds what a bubble can't: `how` (step by step), `calc` (how the numbers are made,
 *    read from the real code), `example` (realistic numbers), `cases` (what happens if…), `mistake`,
 *    and `related` topics. Big idea first (`sum`), detail below.
 * A (?) whose topic had nothing more to say lives in HINT_ONLY: its bubble keeps its own sentence and
 * "Más en el manual" opens the richer topic it was merged into (`into`).
 * `npm run lint:manual` (src/lib/manual/manual-lint.test.ts) fails if a page repeats its hint or is thin.
 *
 * Writing rules: plain, short sentences. Never name other apps. Each pair is [español, English].
 * In `how` and `cases`, one line per step or case ("\n"). A case reads "Si pasa esto: lo que hace Brizna".
 * `[[Término]]` inside a text is an explicit link to that place in the app (see name-jump).
 */

export type L = readonly [string, string];

export type ManualPath =
  | "/"
  | "/agenda"
  | "/clientes"
  | "/cobros"
  | "/estadisticas"
  | "/ajustes"
  | "/notas"
  | "/fichero"
  | "/nuevo"
  | "/clima";

export type Go = {
  to: ManualPath;
  search?: Record<string, string>;
  /** Element id on that screen to open (a fold) and glow, when the topic's own (?) is not on screen. */
  focus?: string;
  /** Estudio screen view to show first. */
  view?: "estudio" | "asesor";
  /** Where it is, said plainly ("Cobros, arriba"). */
  where: L;
};

export type Topic = {
  id: string;
  title: L;
  /** One line: the big idea. Read first. */
  sum: L;
  /** The (?) bubble: one or two short sentences. Never shown in the manual. */
  what: L;
  /** Second bubble text, when the same (?) changes with the state (e.g. paused / not paused). */
  whatAlt?: L;
  /** Cómo funciona: one step per line. */
  how: L;
  /** Cómo se calcula: how the figure is made (from the real code). */
  calc?: L;
  /** Ejemplo: a concrete case with realistic numbers. */
  example: L;
  /** Si pasa…: one case per line, "Situación: resultado". */
  cases?: L;
  /** Error común. */
  mistake?: L;
  /** Related topic ids. */
  related?: string[];
  go?: Go;
  /** Extra words for the alphabetical index and the manual search. The title is always indexed. */
  terms?: L[];
};

/** A (?) with its own sentence whose manual page is another, richer topic. */
export type HintOnly = { id: string; what: L; whatAlt?: L; into: string };

export type Chapter = {
  id: string;
  title: L;
  intro: L;
  topics: Topic[];
};

export const MANUAL_CHAPTERS: Chapter[] = [
  /* ------------------------------------------------------------------ 1 */
  {
    id: "dia",
    title: ["El día de trabajo", "The work day"],
    intro: ["Hoy, Hecho y el cierre del día.", "Today, Done, and closing the day."],
    topics: [
      {
        id: "hoy",
        title: ["Hoy", "Today"],
        sum: ["Tu ruta de hoy y de los seis días que siguen.", "Today's route and the next six days."],
        what: [
          "Tu día de trabajo: hoy primero y luego los seis días siguientes. Lo atrasado se queda arriba hasta que lo resuelvas.",
          "Your work day: today first, then the next six days. Late yards stay on top until you clear them.",
        ],
        how: [
          "Arriba sale Atrasados (en rojo) si algún patio pendiente tenía fecha anterior a hoy.\nDebajo va el bloque Hoy y después un bloque por cada uno de los seis días siguientes.\nToca un patio para abrirlo; arrastra los de hoy para ordenar tu ruta.\nMarca Hecho al terminar; el patio baja a Hechos hoy, al final de la pantalla.\nDesplegar todo abre o cierra todos los bloques de una vez.",
          "Late (in red) shows on top when a pending yard had a date before today.\nBelow comes the Today block, then one block for each of the next six days.\nTap a yard to open it; drag today's yards to order your route.\nMark Done when you finish; the yard drops to Done today, at the bottom.\nExpand all opens or closes every block at once.",
        ],
        calc: [
          "Un patio es atrasado cuando sigue pendiente y su fecha ya pasó. No se borra ni se cobra solo: sigue en Atrasados hasta que lo marques Hecho, lo pases a otro día o lo canceles.",
          "A yard is late when it is still pending and its date has passed. It is never deleted or charged on its own: it stays in Late until you mark it Done, move it, or cancel it.",
        ],
        example: [
          "Es martes. El lunes llovió y no fuiste a casa de los Pérez. Hoy abres Brizna: los Pérez salen arriba en rojo, en Atrasados, y debajo tus 9 patios del martes. Los haces primero o usas Pasar los de hoy para moverlos al jueves.",
          "It is Tuesday. Monday it rained and you skipped the Pérez yard. Today you open Brizna: the Pérez yard sits on top in red, under Late, with your 9 Tuesday yards below. Do it first, or move it to Thursday.",
        ],
        cases: [
          "Marcaste Hecho por error: abre Hechos hoy, toca el patio y usa Deshacer Hecho; el cobro de ese corte también se revierte.\nNo vas a hacer un patio: toca Posponer y elige la razón Cancelado; el corte se cancela, no se cobra y el cliente no se borra.\nUn día de la semana no tiene patios: su bloque dice Sin patios este día.\nUn cliente está en pausa o archivado: sus cortes pendientes se quitaron y no salen aquí.",
          "You marked Done by mistake: open Done today, tap the yard, and use Undo Done; that cut's payment is reversed too.\nYou will not do a yard: tap Postpone and pick the reason Canceled; the cut is canceled, not charged, and the client is not deleted.\nA day has no yards: its block says No yards this day.\nA client is paused or archived: their pending cuts were removed and do not show here.",
        ],
        related: ["hecho", "todos", "pasar-pendientes", "vistas"],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [["Atrasados", "Late"], ["Ruta", "Route"], ["Desplegar todo", "Expand all"], ["Hechos hoy", "Done today"]],
      },
      {
        id: "vistas",
        title: ["Vistas", "Views"],
        sum: ["Cuánto detalle ves en cada tarjeta.", "How much detail each card shows."],
        what: [
          "Grande, Media, Lista y Malla cambian cuánto ves de cada patio. Cada pantalla recuerda la suya.",
          "Large, Medium, List, and Grid change how much you see of each yard. Each screen remembers its own.",
        ],
        how: [
          "Toca el botón de vista arriba de la lista y elige.\nMalla empieza en 2 columnas; otro toque pone 3, luego 4 y vuelve a 2.\nHoy, Clientes, Agenda, Cobros, la ficha y el Fichero guardan cada uno su vista: cambiar una no cambia las otras.",
          "Tap the view button above the list and pick one.\nGrid starts at 2 columns; another tap gives 3, then 4, then back to 2.\nToday, Clients, Schedule, Payments, the file, and the cabinet each keep their own view: changing one does not change the others.",
        ],
        example: [
          "Viernes por la tarde, 12 personas te deben. En Cobros pones Lista: ves nombre y monto en una línea y cobras rápido. Para revisar a Don Rafa, que debe tres cortes, cambias a Grande y ves el corte, el atraso y Perdonar.",
          "Friday afternoon, 12 people owe you. In Payments you pick List: name and amount on one line, so you collect fast. To review Don Rafa, who owes three cuts, you switch to Large and see the cut, the lateness, and Forgive.",
        ],
        cases: [
          "Malla en 4 columnas: solo cabe el nombre; toca la tarjeta para ver el resto.\nMalla en 2 columnas: hay detalle y algunas acciones.\nEn Clientes, Lista pone el precio junto al nombre.",
          "Grid at 4 columns: only the name fits; tap the card for the rest.\nGrid at 2 columns: some detail and a few actions.\nIn Clients, List puts the price next to the name.",
        ],
        mistake: [
          "Pensar que se perdió información en Malla o Lista: solo está escondida. Los datos no cambian con la vista.",
          "Thinking information was lost in Grid or List: it is only hidden. The data does not change with the view.",
        ],
        related: ["hoy", "por-cobrar", "lista-clientes"],
        go: { to: "/", where: ["Hoy, arriba de la lista", "Today, above the list"] },
        terms: [["Malla", "Grid"], ["Grande", "Large"], ["Media", "Medium"], ["Lista", "List"]],
      },
      {
        id: "hecho",
        title: ["Hecho", "Done"],
        sum: ["Cierra un patio y dice si pagaron.", "Closes a yard and says whether they paid."],
        what: [
          "Hecho cierra un patio por uno de tres caminos: cobrado (verde), pendiente (rojo) o abonado (amarillo).",
          "Done closes a yard by one of three paths: paid (green), unpaid (red), or partial (yellow).",
        ],
        how: [
          "Toca Hecho en el patio y elige el camino.\nBrizna pide confirmar. Si marcas Sin confirmación extra por hoy y haces click en Hecho, no te pedirá confirmación adicional: cada cliente de hoy se marca al instante y queda cobrado si paga el mismo día, o pendiente (sumado a su cuenta) si se le acumula. No anota propina ni abono; para eso desmarca la casilla. Vale solo hoy y en este equipo; al día siguiente Hecho vuelve a pedir confirmación.\nPuedes anotar el método (efectivo, tarjeta…) y una propina.\nEl patio pasa a Hechos hoy y la cuenta del cliente se actualiza al momento.",
          "Tap Done on the yard and pick the path.\nBrizna asks you to confirm. If you check No extra confirmation for today and tap Done, it won't ask for extra confirmation: each of today's clients is marked right away and paid if they pay the same day, or unpaid (added to their balance) if it adds up. It records no tip or partial payment; for that, untick the box. It lasts only today, on this device; the next day Done asks for confirmation again.\nYou can note the method (cash, card…) and a tip.\nThe yard moves to Done today and the client's account updates at once.",
        ],
        calc: [
          "Cobrado: anota un pago por el precio de ese corte. No toca la deuda vieja.\nPendiente: suma el precio a la deuda. Si el cliente tenía adelanto, se usa primero.\nAbonado: suma el precio a la deuda y resta lo que te dieron. Si te dan más que toda la deuda, lo que sobra queda como adelanto.",
          "Paid: records a payment for that cut's price. It does not touch older debt.\nUnpaid: adds the price to the debt. If the client had an advance, it is used first.\nPartial: adds the price to the debt and subtracts what they gave you. If they give more than the whole debt, the extra becomes an advance.",
        ],
        example: [
          "Doña Marta ya debía $30. Hoy el corte es $40 y te da $50. Eliges Hecho y abonado con 50: la deuda sube a $70 y baja a $20. En Cobrado entran $50.",
          "Doña Marta already owed $30. Today's cut is $40 and she gives you $50. You pick Done with a partial payment of 50: the debt goes up to $70 and down to $20. Collected gets $50.",
        ],
        cases: [
          "Te equivocaste de camino: usa Deshacer Hecho en Hechos hoy; el pago o la deuda de ese corte se revierten y el patio vuelve a pendiente.\nEl cliente tenía $40 de adelanto y eliges pendiente: el adelanto paga el corte y la deuda no sube.\nTe dan $5 de más por buen trabajo: anótalo como propina, no como abono.\nSin internet: Hecho funciona igual y se sube a la nube al volver la conexión.",
          "You picked the wrong path: use Undo Done in Done today; that cut's payment or debt is reversed and the yard goes back to pending.\nThe client had a $40 advance and you pick unpaid: the advance pays the cut and the debt does not grow.\nThey hand you $5 extra for good work: record it as a tip, not as a partial.\nOffline: Done works the same and uploads when the connection returns.",
        ],
        mistake: [
          "Usar Hecho y cobrado cuando además te pagaron deuda vieja: solo entra el precio de hoy. Usa abonado con el total que te dieron.",
          "Using Done and paid when they also paid older debt: only today's price goes in. Use partial with the full amount they gave you.",
        ],
        related: ["todos", "ficha-deuda", "propina", "por-cobrar"],
        go: { to: "/", where: ["Hoy, en cada patio", "Today, on each yard"] },
        terms: [
          ["Hecho y cobrado", "Done and paid"],
          ["Hecho y pendiente", "Done and unpaid"],
          ["Hecho y abonado", "Done with a partial payment"],
          ["Deshacer Hecho", "Undo Done"],
          ["Sin confirmación extra", "No extra confirmation"],
        ],
      },
      {
        id: "todos",
        title: ["Todos: cerrar el día", "All: close the day"],
        sum: ["Al final del día, marca quién pagó en un solo paso.", "At day's end, mark who paid in one step."],
        what: [
          "Cierra todos los patios de hoy de una vez: eliges quién pagó o abonó y el resto queda pendiente.",
          "Closes all of today's yards at once: you choose who paid or left a partial, and the rest stay unpaid.",
        ],
        how: [
          "Toca Todos en el bloque Hoy (sale cuando quedan 2 o más patios pendientes).\nSe abre ¿Quién pagó hoy? con cada patio y su precio.\nCada patio empieza como Pagó si paga el mismo día, o como Pendiente si se le acumula; cámbialo si hace falta. Abonó pide el monto.\nConfirma: cada patio se marca Hecho con su camino y suena un ding.",
          "Tap All in the Today block (it shows when 2 or more yards are pending).\nWho paid today? opens with each yard and its price.\nEach yard starts as Paid if they pay the same day, or Unpaid if it adds up; change it if needed. Partial asks for the amount.\nConfirm: each yard is marked Done by its path and a ding plays.",
        ],
        example: [
          "Terminas 8 patios. Seis pagaron en efectivo, Kevin abonó $20 de $50 y Luis paga a fin de mes. En Todos revisas: seis en Pagó, Kevin en Abonó con 20, y Luis en Pendiente. Un toque y el día queda cerrado: los $40 de Luis y los $30 que le faltan a Kevin pasan a Por cobrar.",
          "You finish 8 yards. Six paid cash, Kevin gave $20 of $50, and Luis pays at month end. In All you check: six on Paid, Kevin on Partial with 20, and Luis on Unpaid. One tap and the day is closed: Luis's $40 and the $30 Kevin still owes go to To collect.",
        ],
        cases: [
          "Dejaste Abonó sin monto: Brizna te pide escribirlo antes de cerrar.\nUn patio no se hizo: no uses Todos para él; pásalo a otro día primero.\nTe equivocaste en uno: abre Hechos hoy y usa Deshacer Hecho solo en ese patio.\nEl ding molesta: en Ajustes, Sonidos, se baja o se apaga. Cada Hecho suena más bajito que el cierre.",
          "You left Partial without an amount: Brizna asks for it before closing.\nA yard was not done: do not use All for it; move it first.\nYou got one wrong: open Done today and use Undo Done on that yard only.\nThe ding bothers you: lower it or turn it off in Settings, Sounds. Each Done plays softer than the close.",
        ],
        mistake: [
          "Cerrar con Todos antes de pasar los patios que no hiciste: quedarían marcados Hecho y sumarían deuda.",
          "Closing with All before moving the yards you skipped: they would be marked Done and add debt.",
        ],
        related: ["hecho", "pasar-pendientes", "por-cobrar"],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [["¿Quién pagó hoy?", "Who paid today?"], ["Sonidos", "Sounds"], ["Ding", "Ding"]],
      },
      {
        id: "parar-dia",
        title: ["Parar el día y sus razones", "Stopping and reasons"],
        sum: ["Lluvia u otra razón: lo pendiente pasa al siguiente día abierto.", "Rain or another reason: what is pending moves to the next open day."],
        what: [
          "Para el trabajo de hoy por lluvia u otra razón. Lo pendiente pasa al siguiente día abierto.",
          "Stops today's work for rain or another reason. What is pending moves to the next open day.",
        ],
        how: [
          "En Hoy toca Parar y elige la razón: lluvia, médico, dentista u otra escrita a mano.\nLos patios de hoy que siguen pendientes pasan al siguiente día abierto (salta días libres y los días que casi nunca se trabajan).\nTu salida queda a la hora exacta en que paraste.\nSale Mensajes listos por la lluvia: un texto para cada cliente movido. Tú envías cada mensaje.\nLa razón queda en esa fecha de la Agenda y en Estudio.",
          "On Today tap Stop and pick the reason: rain, doctor, dentist, or one you type.\nToday's still-pending yards move to the next open day (skipping days off and almost-never days).\nYour clock-out is set to the exact time you stopped.\nMessages ready for the rain appears: a text for each moved client. You send each message.\nThe reason stays on that date in the Schedule and in Stats.",
        ],
        calc: [
          "Días parados (Estudio) cuenta este año los días con una razón de parada, agrupados por razón.\nPor qué se pospuso (Estudio) cuenta, en los últimos 90 días, los patios movidos con una razón: lluvia, día libre o la que escribiste al pasarlos.",
          "Stopped days (Stats) counts this year's days with a stop reason, grouped by reason.\nWhy it was postponed (Stats) counts, over the last 90 days, the yards moved with a reason: rain, day off, or the one you typed when moving them.",
        ],
        example: [
          "Miércoles, 1:40 de la tarde: cae un aguacero y te quedan 4 patios. Tocas Parar, Lluvia. Los 4 pasan al jueves, tu salida queda a la 1:40 y tus horas del día cuentan solo hasta ahí. En la Agenda, el miércoles dice ¿Por qué no se trabajó? Lluvia, con los 4 nombres.",
          "Wednesday, 1:40 pm: a downpour hits with 4 yards left. You tap Stop, Rain. The 4 move to Thursday, your clock-out is 1:40, and the day's hours count only up to then. In the Schedule, Wednesday shows Why was this day not worked? Rain, with the 4 names.",
        ],
        cases: [
          "El jueves es día libre: los patios saltan al viernes.\nYa marcaste Hecho a algunos: esos se quedan en hoy; solo se mueven los pendientes.\nUn cliente en pausa: no se mueve porque no tiene cortes.\nEl día se trabajó normal: la fecha no muestra ningún reporte.",
          "Thursday is a day off: the yards jump to Friday.\nYou already marked some Done: those stay today; only pending yards move.\nA paused client: nothing moves because they have no cuts.\nThe day was worked as usual: the date shows no report.",
        ],
        mistake: [
          "Usar Parar para mover a una fecha concreta: Parar siempre elige el siguiente día abierto. Para elegir el día, usa Pasar los de hoy.",
          "Using Stop to move to a specific date: Stop always picks the next open day. To choose the day, use Move today's jobs.",
        ],
        related: ["pasar-pendientes", "dias-libres", "horas", "clima"],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [
          ["Parar por lluvia", "Stop for rain"],
          ["Lluvia", "Rain"],
          ["Días parados", "Stopped days"],
          ["Por qué se pospuso", "Why it was postponed"],
          ["¿Por qué no se trabajó?", "Why was this day not worked?"],
        ],
      },
      {
        id: "pasar-pendientes",
        title: ["Pasar trabajo a otro día", "Move work to another day"],
        sum: ["Mueve lo que falta de hoy, o lo atrasado, al día que elijas.", "Moves what is left today, or the late work, to a day you choose."],
        what: [
          "Pasa los patios de hoy que siguen pendientes al día que elijas. No se cobra nada al moverlos.",
          "Moves today's still-pending yards to the day you choose. Nothing is collected by moving them.",
        ],
        how: [
          "Pasar los de hoy: mueve solo los pendientes con fecha de hoy.\nPasar el trabajo atrasado: mueve todos los pendientes con fecha anterior a hoy.\nElige el día y, si quieres, escribe una razón (hasta 80 letras).\nCada patio recuerda su fecha original, así puedes usar Deshacer pospuesto en su tarjeta.",
          "Move today's jobs: moves only the pending yards dated today.\nMove the late work: moves every pending yard dated before today.\nPick the day and, if you like, type a reason (up to 80 letters).\nEach yard remembers its original date, so you can use Undo postpone on its card.",
        ],
        calc: [
          "Si un cliente ya tiene un corte en el día elegido, ese patio pasa al día siguiente libre para él (hasta 21 días). La razón cuenta en Estudio, Por qué se pospuso.",
          "If a client already has a cut on the chosen day, that yard goes to their next free day (up to 21 days). The reason counts in Stats, Why it was postponed.",
        ],
        example: [
          "Sábado: cortaste medio día porque se rompió la cuchilla. Quedan 5 patios. Pasar los de hoy al lunes con la razón Cuchilla rota: los 5 salen el lunes y el sábado queda limpio. Si la próxima semana ves a uno que no iba ahí, Deshacer pospuesto lo devuelve.",
          "Saturday: you cut half a day because the blade broke. 5 yards are left. Move today's jobs to Monday with the reason Broken blade: the 5 show on Monday and Saturday is clear. If one didn't belong there, Undo postpone sends it back.",
        ],
        cases: [
          "Ya marcaste Hecho a algunos: no se mueven.\nEliges un domingo o un día libre: se respeta tu elección; el día libre solo bloquea la agenda automática.\nUn corte movido no se vuelve a crear en su fecha original.",
          "Some are already Done: they do not move.\nYou pick a Sunday or a day off: your choice is kept; a day off only blocks the automatic schedule.\nA moved cut is not created again on its original date.",
        ],
        mistake: [
          "Usar Todos para cerrar el día antes de pasar lo que no hiciste: quedaría como hecho y con deuda.",
          "Using All to close the day before moving what you skipped: it would end up done and owed.",
        ],
        related: ["parar-dia", "hoy", "agenda", "vacaciones"],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [["Pasar los de hoy", "Move today's jobs"], ["Trabajo atrasado", "Late work"], ["Trabajo acumulado", "Accumulated work"], ["Deshacer pospuesto", "Undo postpone"]],
      },
      {
        id: "horas",
        title: ["Horas de trabajo", "Work hours"],
        sum: ["Tu entrada y salida, para saber cuánto ganas por hora.", "Your clock-in and clock-out, to know what you earn per hour."],
        what: ["Si no cambias la hora, queda el horario de Ajustes.", "If you do not change the time, the hours from Settings are used."],
        how: [
          "El horario de siempre es 8:00 a 5:30; se cambia en Ajustes, Horas de trabajo.\nEn Hoy puedes marcar entrada o salida: elige ahora o el horario de siempre.\nAl final del día, Sí, las trabajé confirma el día.\nParar el día pone la salida a la hora en que paraste.",
          "The usual hours are 8:00 to 5:30; change them in Settings, Work hours.\nOn Today you can clock in or out: choose now or the usual hours.\nAt day's end, Yes, I worked them confirms the day.\nStop the day sets clock-out to the time you stopped.",
        ],
        calc: [
          "$ por hora usa solo días confirmados. Un día sin confirmar de antes de ayer se confirma solo con el horario de Ajustes. Un turno de más de 18 horas no cuenta.",
          "$ per hour uses confirmed days only. An unconfirmed day from before yesterday is confirmed on its own with the Settings hours. A shift longer than 18 hours does not count.",
        ],
        example: [
          "Entras a las 7:15 en vez de 8:00 y sales a las 4:00. Marcas entrada ahora a las 7:15 y salida ahora a las 4:00: son 8 h 45 min. Si ese día cobraste $350, tu día dejó unos $40 por hora.",
          "You start at 7:15 instead of 8:00 and finish at 4:00. You clock in now at 7:15 and out now at 4:00: 8 h 45 min. If you collected $350 that day, it paid about $40 an hour.",
        ],
        cases: [
          "Olvidaste confirmar ayer: hoy todavía puedes; pasado mañana se toma el horario de Ajustes.\nNo abriste la app un día: ese día no tiene horas.\nCambias el horario en Ajustes: vale para los días que no tocaste a mano.",
          "You forgot to confirm yesterday: you still can today; the day after, the Settings hours are used.\nYou did not open the app one day: that day has no hours.\nYou change the hours in Settings: it applies to days you did not set by hand.",
        ],
        related: ["por-hora", "parar-dia", "ajustes-usuales"],
        go: { to: "/ajustes", focus: "aj-horas", where: ["Ajustes, Horas de trabajo", "Settings, Work hours"] },
        terms: [["Entrada", "Clock-in"], ["Salida", "Clock-out"]],
      },
      {
        id: "ejemplo",
        title: ["Datos de ejemplo", "Sample data"],
        sum: ["Un negocio de ejemplo para ver la app en acción.", "A sample business to see the app in action."],
        what: [
          "Carga un negocio de ejemplo para probar la app. Al quitarlo, lo tuyo se queda.",
          "Loads a sample business to try the app. When you remove it, your own data stays.",
        ],
        how: [
          "En Ajustes, Datos de ejemplo, toca Cargar ejemplo y confirma.\nSe crean 14 clientes de Miami con dos meses de cortes, pagos, abonos, adelantos, una deuda perdonada, una parada por lluvia, horas, notas y metas.\nArriba aparece Ejemplo mientras está cargado.\nQuitar ejemplo borra exactamente lo que se creó.",
          "In Settings, Sample data, tap Load sample and confirm.\n14 Miami clients are created with two months of cuts, payments, partials, advances, one forgiven debt, a rain stop, hours, notes, and goals.\nSample shows at the top while it is loaded.\nRemove sample deletes exactly what was created.",
        ],
        calc: [
          "Cada cliente de ejemplo lleva una marca interna; al quitar, se borran esos clientes con sus cortes, pagos y notas, y las horas, notas del día y metas que el ejemplo añadió, solo si siguen tal como se crearon.",
          "Each sample client carries an internal mark; removing deletes those clients with their cuts, payments, and notes, plus the hours, day notes, and goals the sample added, only if they are still as created.",
        ],
        example: [
          "Quieres ver cómo luce Cobros con gente que debe. Cargas el ejemplo: Robert Miller debe dos semanas por Zelle, Luis Hernández paga a fin de mes y María González paga en efectivo con propina. Juegas, marcas Hecho, y al terminar tocas Quitar ejemplo.",
          "You want to see Payments with people who owe. You load the sample: Robert Miller owes two weeks by Zelle, Luis Hernández pays at month end, and María González pays cash with tips. You play, mark Done, and when finished tap Remove sample.",
        ],
        cases: [
          "Marcaste Hecho o cobraste a un cliente de ejemplo: eso se va con él al quitar.\nCambiaste a mano las horas de un día del ejemplo: ese día se queda, porque ya es tuyo.\nTocas Cargar ejemplo otra vez: dice que ya está cargado y no duplica nada.",
          "You marked Done or collected on a sample client: it goes with them on removal.\nYou changed a sample day's hours by hand: that day stays, because it is now yours.\nYou tap Load sample again: it says it is already loaded and duplicates nothing.",
        ],
        mistake: [
          "Mezclar clientes reales con el ejemplo y luego quitarlo esperando que se queden los cobros hechos a clientes de ejemplo.",
          "Mixing real clients with the sample and then removing it, expecting payments on sample clients to stay.",
        ],
        related: ["copia", "por-cobrar", "estudio"],
        go: { to: "/ajustes", focus: "aj-ejemplo", where: ["Ajustes, Datos de ejemplo", "Settings, Sample data"] },
        terms: [["Ejemplo", "Sample"], ["Cargar ejemplo", "Load sample"], ["Quitar ejemplo", "Remove sample"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 2 */
  {
    id: "clientes",
    title: ["Clientes", "Clients"],
    intro: ["La lista, la ficha y cómo se cobra a cada uno.", "The list, the file, and how each one pays."],
    topics: [
      {
        id: "clientes-filtros",
        title: ["Filtros y conteo", "Filters and counts"],
        sum: ["Muestra un solo tipo de cliente y cuántos hay.", "Shows one kind of client and how many there are."],
        what: [
          "Sirven para ver un tipo de cliente: los de la ruta, los que deben, los casos aparte o el archivo.",
          "They show one kind of client: the route, people who owe, special cases, or the archive.",
        ],
        how: [
          "Toca el embudo y elige un filtro; cada uno trae su propia explicación.\nArriba, el conteo muestra Permanentes, Una vez, Juntos y Archivos; cada número abre esa lista.\nLa lupa busca por nombre, teléfono, dirección o pista dentro del filtro que elegiste.",
          "Tap the funnel and pick a filter; each one has its own explanation.\nOn top, the counts show Regular, One-time, Together, and Archive; each number opens that list.\nThe magnifying glass searches by name, phone, address, or cue inside the filter you chose.",
        ],
        calc: [
          "Activos y Juntos: todos los que siguen en la ruta (regulares y de una vez).\nCon saldo: deben más de $0, aunque estén archivados.\nCasos especiales: 3 o más cortes este mes, o un trabajo extra este mes.\nAlto riesgo: pasaron alguno de tus límites de Ajustes (días, monto o cortes sin pagar).\nLista negra: no entran en la agenda automática.",
          "Active and Together: everyone still on the route (regular and one-time).\nWith a balance: they owe more than $0, even if archived.\nSpecial cases: 3 or more cuts this month, or an extra job this month.\nHigh risk: they passed one of your Settings limits (days, amount, or unpaid cuts).\nBlacklist: they never enter the automatic schedule.",
        ],
        example: [
          "Tienes 38 clientes: 31 permanentes, 7 de una vez y 4 en el archivo. El lunes por la mañana eliges Con saldo: salen 6 nombres, ordenados por lo que deben, y llamas primero al de arriba.",
          "You have 38 clients: 31 regular, 7 one-time, and 4 archived. Monday morning you pick With a balance: 6 names show, sorted by what they owe, and you call the top one first.",
        ],
        cases: [
          "Un cliente archivado todavía debe: sale en Con saldo y su deuda sigue en Por cobrar.\nPones a alguien en la lista negra: sus trabajos pendientes se quitan y no vuelven solos.",
          "An archived client still owes: they show under With a balance and the debt stays in To collect.\nYou blacklist someone: their pending jobs are removed and do not come back on their own.",
        ],
        related: ["lista-clientes", "archivo", "espera", "tipo-cliente"],
        go: { to: "/clientes", where: ["Clientes, el embudo", "Clients, the funnel"] },
        terms: [["Activos", "Active"], ["Embudo", "Funnel"], ["Inventario", "Inventory"], ["Permanentes", "Regular"], ["Juntos", "Together"], ["Casos especiales", "Special cases"], ["Lista negra", "Blacklist"], ["Con saldo", "With a balance"]],
      },
      {
        id: "lista-clientes",
        title: ["La lista de clientes", "The client list"],
        sum: ["Llamar, escribir o ir con un toque.", "Call, text, or go there in one tap."],
        what: [
          "Los iconos llaman, escriben o abren el mapa. Desliza a la izquierda para dar de baja o borrar.",
          "The icons call, text, or open the map. Swipe left to take them off or delete.",
        ],
        how: [
          "Toca el nombre para abrir la ficha.\nEl teléfono llama, el globo de mensaje escribe y el pin abre el mapa con la dirección.\nDesliza a la izquierda: Dar de baja lo manda al archivo; Borrar lo quita para siempre (siempre pregunta).\nLa pista sale junto al nombre, para distinguir dos patios iguales sin abrir la ficha.",
          "Tap the name to open the file.\nThe phone calls, the bubble writes a message, and the pin opens the map at the address.\nSwipe left: Take off sends them to the archive; Delete removes them forever (it always asks).\nThe cue shows next to the name, to tell two similar yards apart without opening the file.",
        ],
        example: [
          "Tienes dos clientes llamados José. A uno le pones la pista Casa amarilla y al otro Esquina del parque. En la lista ves José · Casa amarilla y José · Esquina del parque, y tocas el pin del correcto para llegar.",
          "You have two clients named José. You give one the cue Yellow house and the other Park corner. The list shows José · Yellow house and José · Park corner, and you tap the right pin to get there.",
        ],
        cases: [
          "No hay dirección: el pin no lleva a ningún lado; añádela en la ficha.\nNo hay teléfono: llamar y escribir no aparecen.\nBorraste a alguien por error: antes de borrar se guarda una copia; puedes recuperarlo desde Copia de seguridad.",
          "No address: the pin goes nowhere; add it on the file.\nNo phone: call and text do not show.\nYou deleted someone by mistake: a copy is saved right before deleting; you can get them back from Backup.",
        ],
        mistake: [
          "Borrar en vez de dar de baja: borrar quita también su historial y sus cifras. Dar de baja los guarda.",
          "Deleting instead of taking off: deleting also removes their history and figures. Taking off keeps them.",
        ],
        related: ["archivo", "clientes-filtros", "notas-cliente"],
        go: { to: "/clientes", focus: "lista-clientes", where: ["Clientes", "Clients"] },
        terms: [["Pista", "Cue"], ["Referencia", "Reference"], ["Dirección", "Address"], ["Mapa", "Map"]],
      },
      {
        id: "archivo",
        title: ["Archivo, altas y bajas", "Archive, new and gone"],
        sum: ["Clientes que ya no atiendes, guardados aparte.", "Clients you no longer serve, kept apart."],
        what: [
          "Los clientes dados de baja, con todos sus datos. Reactivar los vuelve a la agenda; Borrar es para siempre.",
          "Clients taken off the route, with all their data. Reactivate puts them back on the schedule; Delete is forever.",
        ],
        how: [
          "Busca, ordena y selecciona uno o todos.\nReactivar lo devuelve a la ruta y la agenda le arma los cortes desde hoy.\nBorrar pregunta antes y guarda una copia de seguridad justo antes de borrar.",
          "Search, sort, and select one or all.\nReactivate puts them back on the route and the schedule builds their cuts from today.\nDelete asks first and saves a backup right before deleting.",
        ],
        calc: [
          "Al dar de baja se quitan sus cortes pendientes (también los atrasados). Lo que deba sigue en Por cobrar.\nEn Estudio, Clientes nuevos y bajas: altas son los clientes creados ese mes; bajas, los dados de baja ese mes. Si reactivas a alguien, deja de contar como baja.",
          "Taking someone off removes their pending cuts (late ones too). What they owe stays in To collect.\nIn Stats, New clients and departures: new are clients created that month; departures, those taken off that month. If you reactivate someone, they stop counting as a departure.",
        ],
        example: [
          "En octubre la señora Díaz se muda y te debe $45. La das de baja: desaparecen sus cortes, pero los $45 siguen en Por cobrar y ella sale en Con saldo. En Estudio, octubre cuenta 1 baja. En marzo vuelve: Reactivar y sus cortes regresan.",
          "In October Mrs. Díaz moves away owing $45. You take her off: her cuts disappear, but the $45 stays in To collect and she shows under With a balance. In Stats, October counts 1 departure. In March she returns: Reactivate and her cuts come back.",
        ],
        cases: [
          "Reactivas a un cliente con temporada: sus cortes siguen la temporada desde hoy.\nBorras a alguien que debía: su deuda desaparece con él; para dejar constancia, mejor usa Perdonar y luego dale de baja.",
          "You reactivate a client with a season: their cuts follow the season from today.\nYou delete someone who owed: the debt goes with them; to keep a record, Forgive first, then take them off.",
        ],
        related: ["lista-clientes", "perdonado", "clientes-filtros"],
        go: { to: "/clientes", search: { filter: "inactive" }, where: ["Clientes, filtro Archivos", "Clients, Archive filter"] },
        terms: [["Reactivar", "Reactivate"], ["Dar de baja", "Take off"], ["Altas", "New"], ["Bajas", "Departures"], ["Clientes nuevos y bajas", "New clients and departures"]],
      },
      {
        id: "tipo-cliente",
        title: ["Regular o de una vez", "Regular or one-time"],
        sum: ["Si el patio se repite o es un trabajo suelto.", "Whether the yard repeats or is a single job."],
        what: [
          "Regular: se corta cada cierto tiempo. De una vez: un trabajo suelto que no se repite.",
          "Regular: it is cut on a schedule. One-time: a single job that does not repeat.",
        ],
        how: [
          "En Nuevo cliente elige Tipo.\nRegular: eliges frecuencia y día de inicio, y la agenda arma los cortes sola.\nDe una vez: eliges la fecha y escribes qué hay que hacer; las opciones frecuentes (un corte, una limpieza…) llenan el texto con un toque.\nSe crea un solo trabajo, con el precio que pusiste.",
          "In New client pick Type.\nRegular: choose a frequency and start day, and the schedule builds the cuts itself.\nOne-time: pick the date and type what needs doing; the frequent options (a cut, a cleanup…) fill the text in one tap.\nA single job is created, at the price you set.",
        ],
        example: [
          "Un vecino te pide limpiar su patio lleno de hojas antes de una fiesta el sábado: $120. Lo creas de una vez, para el sábado, con Limpieza. Sale en Hoy ese día, y al marcar Hecho cuenta como trabajo de una vez en Estudio.",
          "A neighbor asks you to clear a leaf-covered yard before a Saturday party: $120. You create it as one-time, for Saturday, with Cleanup. It shows on Today that day, and when marked Done it counts as a one-time job in Stats.",
        ],
        cases: [
          "Sin fecha: el trabajo de una vez queda para hoy.\nEl cliente de una vez quiere repetir: edita la ficha y cámbialo a regular.\nAsesor sugiere pasar a los clientes de una vez a un plan cada 2 semanas, con lo que valdría al año.",
          "No date: the one-time job is set for today.\nThe one-time client wants to repeat: edit the file and switch to regular.\nAdvisor suggests moving one-time clients to an every-2-weeks plan, with what it would be worth a year.",
        ],
        related: ["frecuencia", "cobro-cliente", "asesor-pasos"],
        go: { to: "/nuevo", where: ["Nuevo cliente, Tipo", "New client, Type"] },
        terms: [["De una vez", "One-time"], ["¿Qué hay que hacer?", "What needs doing?"], ["Trabajo suelto", "Single job"]],
      },
      {
        id: "deuda-anterior",
        title: ["Deuda anterior", "Earlier debt"],
        sum: ["Lo que ya te debía antes de usar la app.", "What they owed you before the app."],
        what: [
          "Lo que ya te debía antes de entrar en la app. Si no debe nada, déjalo vacío.",
          "What they already owed you before joining the app. If they owe nothing, leave it empty.",
        ],
        how: [
          "Al crear el cliente, escribe el monto en Deuda anterior.\nEse monto pasa a Por cobrar desde el primer día.\nSe cobra como cualquier deuda: Pagado, abono o Perdonar.",
          "When you create the client, type the amount in Earlier debt.\nThat amount goes to To collect from day one.\nIt is collected like any debt: Paid, partial, or Forgive.",
        ],
        calc: [
          "No cuenta como dinero cobrado ni como trabajo hecho. En Estudio, Quién te debe, la parte que no cubren sus cortes anotados sale aparte como Saldo inicial.",
          "It does not count as money collected or work done. In Stats, Who owes you, the part not covered by recorded cuts shows apart as Opening balance.",
        ],
        example: [
          "Empiezas con Brizna y el señor Ortiz te debe $80 de dos cortes de agosto. Lo creas con Deuda anterior 80. En Por cobrar sale con $80, y en Quién te debe esos $80 van en Saldo inicial, no en 0–30 días.",
          "You start with Brizna and Mr. Ortiz owes $80 from two August cuts. You create him with Earlier debt 80. He shows with $80 in To collect, and in Who owes you those $80 sit in Opening balance, not 0–30 days.",
        ],
        mistake: [
          "Anotar la deuda vieja como un corte de hoy: inflaría el trabajo hecho y el ingreso del mes.",
          "Entering old debt as today's cut: it would inflate work done and the month's income.",
        ],
        related: ["ficha-deuda", "quien-debe", "por-cobrar"],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
        terms: [["Saldo inicial", "Opening balance"]],
      },
      {
        id: "frecuencia",
        title: ["Frecuencia y día de inicio", "Frequency and start day"],
        sum: ["Cada cuánto se corta; la agenda se arma sola.", "How often it is cut; the schedule builds itself."],
        what: [
          "Cada cuánto se corta este patio. A partir del día de inicio, la app arma sola los siguientes cortes.",
          "How often this yard is cut. From the start day, the app builds the next cuts on its own.",
        ],
        how: [
          "Elige una frecuencia: 1 vez al mes, cada 2 semanas, 3 veces al mes, cada semana, 2 veces por semana o Personalizada (cada cuántos días).\nElige el día de inicio: ese es el primer corte y fija el día de la semana.\nLa agenda crea los cortes hasta los Meses por delante de Ajustes (12 de siempre).",
          "Pick a frequency: once a month, every 2 weeks, 3 times a month, every week, twice a week, or Custom (every so many days).\nPick the start day: that is the first cut and it sets the weekday.\nThe schedule creates cuts up to Months ahead in Settings (12 by default).",
        ],
        calc: [
          "Cada semana: cada 7 días. Cada 2 semanas: cada 14. 3 veces al mes: cada 10. 1 vez al mes: el mismo día de cada mes. 2 veces por semana: los dos días que elijas. Personalizada: cada N días desde el inicio.\nSi un corte cae en un día libre o en uno que casi nunca se trabaja, pasa al siguiente día abierto.",
          "Every week: every 7 days. Every 2 weeks: every 14. 3 times a month: every 10. Once a month: the same day each month. Twice a week: the two days you pick. Custom: every N days from the start.\nIf a cut falls on a day off or an almost-never day, it moves to the next open day.",
        ],
        example: [
          "Nuevo cliente, cada 2 semanas, inicio jueves 6 de noviembre. Cortes: 6 y 20 de noviembre, 4 y 18 de diciembre… Si el 20 marcas día libre, ese corte pasa al viernes 21.",
          "New client, every 2 weeks, start Thursday November 6. Cuts: November 6 and 20, December 4 and 18… If you mark the 20th as a day off, that cut moves to Friday the 21st.",
        ],
        cases: [
          "Cambias la frecuencia o el día después: los cortes pendientes desde hoy se rehacen con el nuevo ritmo; los ya hechos no cambian.\nMoviste un corte a mano: se queda donde lo pusiste, salvo que luego cambies la frecuencia o el día; entonces se rehace con los demás.\nHay temporada activa: dentro de esas fechas manda la temporada.",
          "You change the frequency or day later: pending cuts from today are rebuilt with the new pace; finished ones do not change.\nYou moved a cut by hand: it stays where you put it, unless you later change the frequency or day; then it is rebuilt with the rest.\nA season is on: inside those dates the season rules.",
        ],
        mistake: [
          "Poner como inicio una fecha vieja esperando cortes atrasados: la agenda solo crea cortes desde hoy.",
          "Setting an old start date expecting late cuts: the schedule only creates cuts from today.",
        ],
        related: ["temporada", "dias-libres", "tipo-cliente"],
        go: { to: "/nuevo", where: ["Nuevo cliente, Frecuencia", "New client, Frequency"] },
        terms: [["Cada cuántos días", "Every how many days"], ["Día de inicio", "Start day"], ["Personalizada", "Custom"]],
      },
      {
        id: "cobro-cliente",
        title: ["Cómo paga el cliente", "How the client pays"],
        sum: ["Se acumula, o paga el mismo día.", "It adds up, or they pay the same day."],
        what: [
          "Si no paga el mismo día, el precio se suma a su cuenta hasta que marques Pagado o Perdonar.",
          "If they do not pay the same day, the price is added to their account until you mark Paid or Forgive.",
        ],
        how: [
          "En la ficha o en Nuevo cliente elige Se acumula o Paga el mismo día.\nSe acumula: cada corte hecho suma su precio a la deuda; tú marcas Pagado cuando te pague.\nPaga el mismo día: en Todos su patio sale ya en Pagó, y con Sin confirmación extra un toque en Hecho lo da por cobrado.\nEl cambio queda anotado en el historial de la ficha.",
          "On the file or in New client choose It adds up or Pays the same day.\nIt adds up: each finished cut adds its price to the debt; you mark Paid when they pay.\nPays the same day: in All their yard starts on Paid, and with No extra confirmation one tap on Done counts it as paid.\nThe change is noted in the file's history.",
        ],
        example: [
          "María paga en efectivo al terminar: Paga el mismo día. Robert paga por transferencia cada dos semanas: Se acumula. Tras dos cortes de $60, Robert debe $120; cuando llega su pago, Pagado en la ficha y su deuda vuelve a $0.",
          "María pays cash when you finish: Pays the same day. Robert pays by transfer every two weeks: It adds up. After two $60 cuts, Robert owes $120; when his payment comes, Paid on the file and his debt is back to $0.",
        ],
        cases: [
          "Un cliente que paga el mismo día un día no paga: marca Hecho y pendiente; ese corte sí se suma.\nCambias a Paga el mismo día con deuda vieja: la deuda no se borra; sigue en Por cobrar.\nAgregas varios clientes a la vez: la casilla Paga el mismo día vale para todos los de esa tanda.",
          "A same-day client doesn't pay one day: mark Done and unpaid; that cut is added.\nYou switch to Pays the same day with old debt: the debt is not erased; it stays in To collect.\nYou add several clients at once: the Pays the same day box applies to that whole batch.",
        ],
        related: ["hecho", "ficha-deuda", "todos"],
        go: { to: "/nuevo", where: ["Nuevo cliente, Cobro", "New client, Payment"] },
        terms: [["Se acumula", "It adds up"], ["Paga el mismo día", "Pays the same day"]],
      },
      {
        id: "notas-cliente",
        title: ["Notas y en cada visita", "Notes and every visit"],
        sum: ["Portón, perro, llave: lo que hay que recordar.", "Gate, dog, key: what to remember."],
        what: [
          "Un bloc guardado con el contacto: portón, perro, llave o lo que haya que recordar.",
          "A pad saved with the contact: a gate, a dog, a key, or anything to remember.",
        ],
        how: [
          "Notas del cliente: texto libre, se abre desde la ficha y viaja con la copia de seguridad.\nEn cada visita: frases cortas que salen en la tarjeta de cada corte (orilla, soplado, perro suelto). No crean trabajos ni cambian el precio.\nEn el Bloc, escribe @ y el nombre: esa nota también queda en su ficha.",
          "Client notes: free text, opened from the file, travels with the backup.\nOn each visit: short phrases shown on every cut card (edging, blowing, loose dog). They create no jobs and do not change the price.\nIn the Pad, type @ and the name: that note also lands on their file.",
        ],
        example: [
          "En la ficha de Kevin escribes: Llave bajo la maceta roja, perro Max muerde. En En cada visita pones Orilla y Sacar ramas. Cada vez que su patio sale en Hoy, la tarjeta te recuerda Orilla · Sacar ramas sin abrir nada.",
          "On Kevin's file you write: Key under the red pot, dog Max bites. In On each visit you add Edging and Haul branches. Every time his yard shows on Today, the card reminds you Edging · Haul branches without opening anything.",
        ],
        cases: [
          "Quieres cobrar algo extra una vez: no uses En cada visita; añade un trabajo extra con su precio.\nCambias de teléfono: las notas vuelven al entrar con tu cuenta.",
          "You want to charge something extra once: don't use On each visit; add an extra job with its price.\nYou change phones: the notes come back when you sign in.",
        ],
        related: ["notas", "lista-clientes", "precio"],
        go: { to: "/nuevo", where: ["Nuevo cliente, al final", "New client, at the end"] },
        terms: [["En cada visita", "On each visit"], ["Notas del cliente", "Client notes"]],
      },
      {
        id: "ficha-deuda",
        title: ["Deuda, abono y adelanto", "Debt, partial, and advance"],
        sum: ["Lo que debe un cliente, y cómo lo baja.", "What a client owes, and how it goes down."],
        what: [
          "Deuda es lo que te deben. Abono es un pago parcial; adelanto es dinero pagado antes del corte.",
          "Debt is what they owe you. A partial is part of the debt paid; an advance is money paid before the cut.",
        ],
        how: [
          "En la ficha, Pagado propone la deuda completa; puedes cambiar el monto.\nSi pagan menos que la deuda, es un abono: la deuda baja y el resto sigue.\nSi pagan más que la deuda, lo que sobra queda como adelanto.\nEl próximo corte se paga primero con el adelanto: al marcar Hecho no se cobra otra vez.",
          "On the file, Paid suggests the whole debt; you can change the amount.\nIf they pay less than the debt, it is a partial: the debt drops and the rest remains.\nIf they pay more than the debt, the extra becomes an advance.\nThe next cut is paid first from the advance: marking Done does not charge again.",
        ],
        calc: [
          "Un pago va primero a la deuda; solo lo que sobra se vuelve adelanto. Abonos y adelantos cuentan en Cobrado el día que entran. Un adelanto que no alcanza para el corte se usa entero y el resto pasa a deuda.",
          "A payment goes to the debt first; only what is left becomes an advance. Partials and advances count in Collected the day they come in. An advance too small for the cut is used up and the rest becomes debt.",
        ],
        example: [
          "Ana debe $90. Te da $150. La deuda queda en $0 y le quedan $60 de adelanto. Su próximo corte de $45 se paga solo con el adelanto (le quedan $15). El siguiente usa los $15 y $30 pasan a deuda.",
          "Ana owes $90. She gives you $150. The debt goes to $0 and she has a $60 advance. Her next $45 cut is paid from the advance ($15 left). The one after uses the $15 and $30 becomes debt.",
        ],
        cases: [
          "Registraste un pago por error: Deshacer lo revierte y la deuda o el adelanto vuelven a como estaban.\nQuieres que deje de acumular: toca Se acumula para cambiarlo a Paga el mismo día.\nEl corte se cobra con adelanto y luego lo deshaces: el adelanto vuelve a su cuenta.",
          "You recorded a payment by mistake: Undo reverses it and the debt or advance goes back to how it was.\nYou want it to stop adding up: tap It adds up to switch to Pays the same day.\nA cut is paid from the advance and then undone: the advance goes back to their account.",
        ],
        mistake: [
          "Anotar un adelanto como propina: la propina no paga cortes y no entra en Cobrado.",
          "Recording an advance as a tip: a tip pays no cuts and does not count in Collected.",
        ],
        related: ["por-cobrar", "hecho", "propina", "perdonado"],
        go: { to: "/clientes", where: ["La ficha del cliente, Deuda", "The client file, Debt"] },
        terms: [["Abono", "Partial"], ["Adelanto", "Advance"], ["Ficha", "Client file"], ["Pagado", "Paid"]],
      },
      {
        id: "precio",
        title: ["Precio y cambios de precio", "Price and price changes"],
        sum: ["Corrige un corte ya hecho, o sube el precio desde hoy.", "Fix a finished cut, or raise the price from today."],
        what: [
          "Corrige el precio de un corte ya hecho desde el historial del cliente. La cuenta se ajusta sola.",
          "Fix the price of a finished cut from the client's history. The account adjusts itself.",
        ],
        how: [
          "Corte ya hecho: en la ficha, Historial, toca el precio, escribe el nuevo y guarda.\nPrecio desde hoy: edita el precio de la ficha y guarda.",
          "Finished cut: on the file, History, tap the price, type the new one, and save.\nPrice from today: edit the file's price and save.",
        ],
        calc: [
          "En un corte hecho, la diferencia se suma o resta a la deuda, aunque ya estuviera pagado. Si la deuda quedaría bajo cero, lo que sobra pasa a adelanto.\nAl cambiar el precio de la ficha, todos los cortes pendientes (también los atrasados) toman el precio nuevo; los hechos conservan el suyo.",
          "On a finished cut, the difference is added to or taken from the debt, even if it was already paid. If the debt would go below zero, the extra becomes an advance.\nWhen you change the file's price, every pending cut (late ones too) takes the new price; finished ones keep theirs.",
        ],
        example: [
          "El corte de los Rivera decía $40 pero el pasto estaba altísimo y cobraste $55. En Historial cambias 40 por 55: su cuenta sube $15. En enero subes su precio a $45: desde ese momento todos sus cortes pendientes valen $45, y los de diciembre siguen en $40.",
          "The Rivera cut said $40 but the grass was huge and you charged $55. In History you change 40 to 55: their account goes up $15. In January you raise their price to $45: from then on all pending cuts are $45, and December's stay at $40.",
        ],
        cases: [
          "Bajas el precio de un corte ya pagado: la diferencia queda como adelanto para el próximo.\nUn corte atrasado de antes del cambio: toma el precio nuevo porque sigue pendiente.\nUn corte de $0 (cortesía): no cuenta para el precio promedio en Estudio.",
          "You lower the price of a paid cut: the difference becomes an advance for the next one.\nA late cut from before the change: takes the new price because it is still pending.\nA $0 cut (courtesy): it does not count toward the average price in Stats.",
        ],
        related: ["ficha-deuda", "precio-trabajo", "asesor-pasos"],
        go: { to: "/clientes", where: ["La ficha del cliente, Historial", "The client file, History"] },
        terms: [["Historial", "History"], ["Precio después de hecho", "Price after done"], ["Subir precio", "Raise price"]],
      },
      {
        id: "pausa",
        title: ["Pausa y Continuar", "Pause and Play"],
        sum: ["Deja quieto un patio mientras pagan.", "Holds a yard while they pay."],
        what: [
          "Pausa deja el patio quieto mientras pagan la deuda. No se agenda hasta que decidas Continuar.",
          "Pause holds the yard while they pay the debt. It is not scheduled until you choose Play.",
        ],
        whatAlt: [
          "En pausa: no hay cortes hasta que decidas Continuar. El caso vive en En espera.",
          "Paused: no cuts until you tap Play. The case lives in Waiting.",
        ],
        how: [
          "Toca las dos rayitas en Por cobrar (vistas Grande y Media) o en la ficha.\nConfirma en la ventana que aparece.\nSus cortes pendientes se quitan y el caso pasa a En espera.\nContinuar vuelve a armar sus cortes desde hoy, con su frecuencia de siempre.",
          "Tap the two bars in To collect (Large and Medium views) or on the file.\nConfirm in the window that appears.\nTheir pending cuts are removed and the case moves to Waiting.\nPlay rebuilds their cuts from today, at their usual frequency.",
        ],
        calc: [
          "La deuda no cambia con la pausa: sigue en Por cobrar y sigue contando para En espera y Alto riesgo. En Estudio no entra en el Ingreso fijo mientras está en pausa, y Asesor lo cuenta en En riesgo (o en Morosos si su deuda ya va atrasada).",
          "The debt does not change with a pause: it stays in To collect and keeps counting toward Waiting and High risk. In Stats it leaves Steady income while paused, and Advisor counts it under At risk (or Late payers if the debt is already overdue).",
        ],
        example: [
          "El señor Gómez debe $180 de cuatro cortes. Lo pausas: no vas más a su casa, pero los $180 siguen en Por cobrar. Te paga $100 el viernes y $80 la semana siguiente; tocas Continuar y su próximo corte aparece en la agenda.",
          "Mr. Gómez owes $180 from four cuts. You pause him: no more visits, but the $180 stays in To collect. He pays $100 Friday and $80 the next week; you tap Play and his next cut appears on the schedule.",
        ],
        cases: [
          "Tenía un corte atrasado: también se quita al pausar.\nPausas a alguien que no debe nada: igual se detienen sus cortes; útil si se va de viaje.\nTodos y Parar el día no tocan a clientes en pausa.",
          "They had a late cut: it is removed too when paused.\nYou pause someone who owes nothing: their cuts still stop; handy if they travel.\nAll and Stop the day never touch paused clients.",
        ],
        mistake: [
          "Pausar pensando que perdona la deuda: solo Perdonar la borra.",
          "Pausing thinking it forgives the debt: only Forgive clears it.",
        ],
        related: ["espera", "perdonado", "asesor-grupos"],
        go: { to: "/cobros", search: { view: "espera" }, where: ["Cobros, En espera", "Payments, Waiting"] },
        terms: [["Pausa", "Pause"], ["Continuar", "Play"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 3 */
  {
    id: "agenda",
    title: ["Agenda", "Schedule"],
    intro: ["Qué toca, cuándo, y qué se movió.", "What is due, when, and what moved."],
    topics: [
      {
        id: "agenda",
        title: ["Agenda y calendario", "Schedule and calendar"],
        sum: ["Arriba eliges el período; abajo, el estado.", "Pick the period on top; the state below."],
        what: [
          "Arriba eliges el período (Calendario, Semana, Mes o Todo) y abajo el estado. Los dos filtran juntos.",
          "On top you pick the period (Calendar, Week, Month, or All) and below the state. Both filter together.",
        ],
        how: [
          "Elige el período: Semana (lunes a domingo), Mes, Todo o Calendario (el mes en cuadros).\nElige el estado: Pendiente, Tarde, Realizado, Pospuesto o Cancelado.\nLa lista muestra solo lo que cumple las dos cosas.\nToca un día del calendario para ver sus patios y, si no se trabajó normal, la razón.",
          "Pick the period: Week (Monday to Sunday), Month, All, or Calendar (the month in squares).\nPick the state: Pending, Late, Done, Postponed, or Canceled.\nThe list shows only what matches both.\nTap a calendar day to see its yards and, if it was not a normal day, the reason.",
        ],
        calc: [
          "Pendiente: por hacer desde hoy. Tarde: pendiente con fecha pasada (no sale en Pendiente). Realizado: marcado Hecho. Pospuesto: movido de su fecha original, con la razón. Cancelado: lo cancelaste con Posponer y la razón Cancelado.",
          "Pending: to do from today. Late: pending with a past date (it does not show under Pending). Done: marked Done. Postponed: moved from its original date, with the reason. Canceled: you canceled it with Postpone and the reason Canceled.",
        ],
        example: [
          "Quieres saber cuánto hiciste en octubre: Mes + Realizado (estando en octubre). Para ver qué se movió por la lluvia esta semana: Semana + Pospuesto; cada patio dice de qué día venía y por qué.",
          "You want to know what you did in October: Month + Done (while in October). To see what rain moved this week: Week + Postponed; each yard says which day it came from and why.",
        ],
        cases: [
          "No encuentras un patio atrasado en Pendiente: está en Tarde.\nUn patio pospuesto: Deshacer pospuesto lo devuelve a su fecha original.\nCancelaste un corte: no se vuelve a crear en esa fecha.",
          "You can't find a late yard under Pending: it is under Late.\nA postponed yard: Undo postpone sends it back to its original date.\nYou canceled a cut: it is not created again on that date.",
        ],
        related: ["agenda-todo", "pasar-pendientes", "parar-dia", "dias-libres"],
        go: { to: "/agenda", focus: "agenda-controles", where: ["Agenda, arriba", "Schedule, at the top"] },
        terms: [["Calendario", "Calendar"], ["Pospuesto", "Postponed"], ["Realizado", "Done"], ["Tarde", "Late"], ["Cancelado", "Canceled"]],
      },
      {
        id: "agenda-todo",
        title: ["Todo, con Pendiente", "All, with Pending"],
        sum: ["Lo que falta por hacer y lo que valdría.", "What is left to do and what it would be worth."],
        what: [
          "Los patios pendientes de toda la agenda y lo que valdrían si se hacen. No es dinero cobrado.",
          "The pending yards on the whole schedule and what they would be worth once done. It is not money collected.",
        ],
        how: [
          "En Agenda elige Todo y luego Pendiente.\nArriba sale cuántos patios quedan y la suma de sus precios.\nLa lista llega hasta donde se arma la agenda (Meses por delante, en Ajustes).",
          "In Schedule pick All, then Pending.\nOn top you see how many yards are left and the sum of their prices.\nThe list reaches as far as the schedule is built (Months ahead, in Settings).",
        ],
        calc: [
          "Suma el precio de cada patio pendiente desde hoy. No incluye los atrasados (están en Tarde) ni lo que ya te deben.",
          "Adds up the price of each pending yard from today. It leaves out late yards (they are under Late) and what you are already owed.",
        ],
        example: [
          "Con 30 clientes semanales a $45 y la agenda armada a 12 meses, Todo + Pendiente puede mostrar más de 1.500 patios y unos $70.000. No es una promesa: es lo que valdría si todo sigue igual y lo haces todo.",
          "With 30 weekly clients at $45 and the schedule built 12 months out, All + Pending may show over 1,500 yards and about $70,000. It is not a promise: it is what it would be worth if nothing changes and you do it all.",
        ],
        cases: [
          "Bajas Meses por delante a 4: la suma baja, porque la agenda llega menos lejos.\nUna temporada espacia los cortes: también baja la suma.",
          "You lower Months ahead to 4: the sum drops, because the schedule reaches less far.\nA season spaces cuts out: the sum drops too.",
        ],
        mistake: [
          "Leerlo como lo que vas a ganar este mes: para el mes mira Estudio, Este mes, o el Ingreso fijo.",
          "Reading it as what you will earn this month: for the month see Stats, This month, or Steady income.",
        ],
        related: ["agenda", "ingreso-fijo", "este-mes", "clientes-filtros"],
        go: { to: "/agenda", where: ["Agenda, Todo + Pendiente", "Schedule, All + Pending"] },
      },
      {
        id: "dias-libres",
        title: ["Días libres", "Days off"],
        sum: ["Marca un día libre; sus patios se mueven solos.", "Mark a day off; its yards move on their own."],
        what: [
          "Marca un día concreto como libre. Sus patios pasan solos al siguiente día abierto.",
          "Marks a specific day as off. Its yards move on their own to the next open day.",
        ],
        how: [
          "En Agenda, Días libres, toca una fecha de esta semana.\nEscribe la razón o deja Día libre.\nLos patios pendientes de esa fecha pasan al siguiente día abierto, con esa razón.\nAl abrir el bloque también eliges los días que casi nunca se trabajan (normalmente el domingo).",
          "In Schedule, Days off, tap a date this week.\nType the reason or leave Day off.\nThat date's pending yards move to the next open day, with that reason.\nWhen open, the block also lets you pick the days that are almost never worked (usually Sunday).",
        ],
        calc: [
          "Siguiente día abierto: el primer día después que no sea libre ni de los que casi nunca se trabajan. Un día que casi nunca se trabaja no recibe cortes regulares de la agenda automática; un patio pospuesto a mano o un trabajo extra o de una vez sí puede caer ahí y cuenta en las cifras. En Estudio, los días libres no suman a la Meta del mes.",
          "Next open day: the first day after that is neither off nor an almost-never day. An almost-never day gets no regular cuts from the automatic schedule; a yard moved by hand or an extra or one-time job can still land there and counts in the figures. In Stats, days off do not add to the Month goal.",
        ],
        example: [
          "El viernes es la graduación de tu hija. Tocas el viernes y escribes Graduación. Sus 7 patios pasan al sábado. Si el domingo es día de descanso, nada cae ahí; si el sábado también fuera libre, irían al lunes.",
          "Friday is your daughter's graduation. You tap Friday and type Graduation. Its 7 yards move to Saturday. If Sunday is a rest day, nothing lands there; if Saturday were also off, they would go to Monday.",
        ],
        cases: [
          "Quitas el día libre: la fecha vuelve a estar abierta, pero los patios ya movidos se quedan donde están.\nAgregas un trabajo de una vez en domingo: se queda, aunque sea tu día de descanso.",
          "You remove the day off: the date is open again, but the yards already moved stay where they are.\nYou add a one-time job on Sunday: it stays, even on your rest day.",
        ],
        related: ["vacaciones", "parar-dia", "frecuencia", "meta-mes"],
        go: { to: "/agenda", focus: "ag-libres", where: ["Agenda, Días libres", "Schedule, Days off"] },
        terms: [["Domingo", "Sunday"], ["Días que casi nunca se trabajan", "Days almost never worked"], ["Día libre", "Day off"]],
      },
      {
        id: "temporada",
        title: ["Temporadas", "Seasons"],
        sum: ["En invierno, los cortes más espaciados, para todos o para uno.", "In winter, cuts spaced out, for everyone or for one."],
        what: [
          "Un tramo del año en que todos los cortes regulares se espacian más, sin editar cada ficha.",
          "A stretch of the year when every regular cut is spaced further apart, without editing each file.",
        ],
        how: [
          "Para todos: en Ajustes, Temporada para todos, pon inicio y fin (mes-día, como 11-01 y 02-28) y cada cuántos días.\nPara un cliente: en su ficha, Temporada, pon sus propias fechas y su número; si lo dejas apagado, sigue la de todos.\nLa agenda se rehace sola al guardar.",
          "For everyone: in Settings, Season for everyone, set start and end (month-day, like 11-01 and 02-28) and every how many days.\nFor one client: on their file, Season, set their own dates and number; if you leave it off, they follow everyone's.\nThe schedule rebuilds itself when you save.",
        ],
        calc: [
          "Dentro de las fechas, cada cliente regular se corta cada N días (de 7 a 60), contando desde su día de inicio. Fuera, vuelve su frecuencia normal. El tramo puede cruzar el año (de noviembre a febrero). Los patios que moviste a mano no vuelven atrás.",
          "Inside the dates, each regular client is cut every N days (7 to 60), counted from their start day. Outside, their usual frequency returns. The stretch can cross the new year (November to February). Yards you moved by hand do not jump back.",
        ],
        example: [
          "En Miami el pasto crece menos en invierno. Pones Temporada para todos del 11-01 al 02-28 cada 21 días: un cliente semanal pasa de unos 17 cortes a unos 6 en esos cuatro meses. La señora Lee quiere cada 14: le pones su propia temporada con 14.",
          "In Miami grass grows slower in winter. You set Season for everyone from 11-01 to 02-28 every 21 days: a weekly client goes from about 17 cuts to about 6 in those four months. Mrs. Lee wants every 14: you give her her own season with 14.",
        ],
        cases: [
          "Apagas la temporada: los cortes pendientes vuelven al ritmo normal.\nIngreso fijo (Estudio) no cuenta temporadas: es tu mes normal.\nAsesor puede sugerir ajustar la temporada si tus inviernos dejan bastante menos.",
          "You turn the season off: pending cuts go back to the usual pace.\nSteady income (Stats) ignores seasons: it is your normal month.\nAdvisor may suggest setting the season if your winters bring in much less.",
        ],
        related: ["frecuencia", "ajustes-usuales", "asesor-pasos", "ingreso-fijo"],
        go: { to: "/ajustes", focus: "aj-temporada", where: ["Ajustes, Temporada para todos", "Settings, Season for everyone"] },
        terms: [["Invierno", "Winter"], ["Meses por delante", "Months ahead"], ["Temporada de un cliente", "A client's season"], ["Temporada para todos", "Season for everyone"]],
      },
      {
        id: "vacaciones",
        title: ["Vacaciones", "Time off"],
        sum: ["Te vas unos días; la agenda se reacomoda.", "You leave for a few days; the schedule rearranges."],
        what: [
          "Elige ida y vuelta: lo pendiente de esas fechas y lo atrasado se corren para después del regreso.",
          "Choose departure and return: what is pending on those dates, and what is late, shifts to after you come back.",
        ],
        how: [
          "En Ajustes, Vacaciones, elige el primer y el último día fuera.\nGuarda: Brizna dice cuántos patios movió.\nSi cambias las fechas, primero deshace el corrimiento anterior y luego aplica el nuevo.\nQuitar vacaciones devuelve los patios a sus días.",
          "In Settings, Time off, pick the first and last day away.\nSave: Brizna says how many yards it moved.\nIf you change the dates, it first undoes the earlier shift and then applies the new one.\nRemove time off sends the yards back to their days.",
        ],
        calc: [
          "Cada patio pendiente dentro de las fechas se corre tantos días como dura el viaje, así conserva su orden. Lo atrasado de antes de irte pasa al día del regreso. Los días de vacaciones no cuentan para la Meta del mes.",
          "Each pending yard inside the dates shifts by as many days as the trip lasts, so it keeps its order. Late work from before you leave goes to the return day. Vacation days do not count toward the Month goal.",
        ],
        example: [
          "Te vas a Managua del 20 al 26 de diciembre (7 días). El corte de los Pérez del 20 pasa al 27 y el de Ana del 23 pasa al 30. Un patio que iba atrasado desde el 18 sale el 27, el día que vuelves.",
          "You fly out December 20 to 26 (7 days). The Pérez cut on the 20th moves to the 27th and Ana's on the 23rd moves to the 30th. A yard late since the 18th shows on the 27th, the day you return.",
        ],
        cases: [
          "Vuelves antes: acorta la fecha de regreso y los patios se reacomodan.\nUn cliente ya tenía corte el día al que se corre otro: ese patio pasa a su siguiente día libre.\nEl regreso cae en domingo: los patios llegan ahí igual; muévelos con Pasar los de hoy si hace falta.",
          "You come back early: shorten the return date and the yards rearrange.\nA client already had a cut on the day another shifts to: that yard goes to their next free day.\nThe return lands on a Sunday: the yards still land there; move them with Move today's jobs if needed.",
        ],
        related: ["dias-libres", "pasar-pendientes", "meta-mes"],
        go: { to: "/ajustes", focus: "aj-vacaciones", where: ["Ajustes, Vacaciones", "Settings, Time off"] },
        terms: [["Viaje", "Trip"], ["Regreso", "Return"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 4 */
  {
    id: "cobros",
    title: ["Cobros", "Payments"],
    intro: ["Quién debe, quién pagó y qué hacer con cada caso.", "Who owes, who paid, and what to do with each case."],
    topics: [
      {
        id: "por-cobrar",
        title: ["Por cobrar y Abonado", "To collect and Partial paid"],
        sum: ["El dinero que todavía te deben, y quién ya dejó una parte.", "The money still owed to you, and who already paid part."],
        what: [
          "El saldo que todavía te deben. Si se retrasan siguen aquí: no se perdonan solos.",
          "The balance still owed to you. If they fall behind they stay here: nothing is forgiven on its own.",
        ],
        how: [
          "Toca el monto para ver la lista de quienes deben, de mayor a menor.\nDebajo, Abonado: toca el número de personas para ver a quienes dejaron una parte y aún deben.\nDesde cada fila: Pagado, abono, Perdonar o Pausa.\nCada persona lleva su estado: al corriente con saldo, En espera o Alto riesgo (naranja).",
          "Tap the amount to see who owes, largest first.\nBelow, Partial paid: tap the number of people to see who left part and still owes.\nFrom each row: Paid, partial, Forgive, or Pause.\nEach person carries a state: current with a balance, Waiting, or High risk (orange).",
        ],
        calc: [
          "Por cobrar suma la deuda de todos los clientes, también de los archivados. Sube con cada corte que no se paga y con la deuda anterior; baja con pagos, abonos y Perdonar.\nAbonado suma los abonos de este año de las personas que todavía deben. Cuando alguien paga todo, sale de Abonado.",
          "To collect adds every client's debt, archived ones too. It grows with each unpaid cut and with earlier debt; it drops with payments, partials, and Forgive.\nPartial paid adds this year's partials from people who still owe. When someone pays in full, they leave Partial paid.",
        ],
        example: [
          "Por cobrar: $415, 6 personas. Kevin debía $100 y te dio $40: sale en Abonado con $40 y sigue debiendo $60. El viernes te paga los $60: sale de Abonado y Por cobrar baja a $355.",
          "To collect: $415, 6 people. Kevin owed $100 and gave you $40: he shows in Partial paid with $40 and still owes $60. Friday he pays the $60: he leaves Partial paid and To collect drops to $355.",
        ],
        cases: [
          "Alguien con adelanto: no aparece aquí; el adelanto no es deuda.\nDas de baja a quien debe: su deuda sigue sumando aquí.\nDeshaces un pago: la deuda vuelve a subir.",
          "Someone with an advance: they do not show here; an advance is not debt.\nYou take off someone who owes: their debt keeps counting here.\nYou undo a payment: the debt goes back up.",
        ],
        mistake: [
          "Esperar que una deuda vieja desaparezca sola: solo un pago o Perdonar la quitan.",
          "Expecting old debt to vanish on its own: only a payment or Forgive removes it.",
        ],
        related: ["ficha-deuda", "espera", "perdonado", "quien-debe"],
        go: { to: "/cobros", where: ["Cobros, arriba a la izquierda", "Payments, top left"] },
        terms: [["Saldo", "Balance"], ["Al corriente", "Current"], ["Deuda", "Debt"], ["Abonado", "Partial paid"], ["Abono", "Partial"]],
      },
      {
        id: "cobrado",
        title: ["Cobrado y trabajo hecho", "Collected and work done"],
        sum: ["Lo que ya entró, al lado de lo que vale lo terminado.", "What came in, next to what finished work is worth."],
        what: [
          "Dinero que ya te pagaron: esta semana, este mes y este año. Toca una fila para ver la lista.",
          "Money already paid to you: this week, this month, and this year. Tap a row to see the list.",
        ],
        how: [
          "Cobrado (arriba a la derecha) tiene tres filas: semana, mes y año. Cada una abre los pagos de ese tramo.\nTrabajo ya hecho muestra lo que vale lo terminado en los mismos tramos, haya pagado o no.\nCompáralos: si el trabajo hecho va muy por encima de lo cobrado, se está acumulando deuda.",
          "Collected (top right) has three rows: week, month, and year. Each opens that stretch's payments.\nWork already done shows what finished work is worth over the same stretches, paid or not.\nCompare them: if work done runs far above collected, debt is piling up.",
        ],
        calc: [
          "Cobrado: suma de pagos, abonos y adelantos por el día en que entraron. La semana va de lunes a domingo. No incluye propinas, deuda anterior ni lo perdonado.\nTrabajo ya hecho: suma del precio de los patios marcados Hecho, por la fecha del patio.",
          "Collected: sum of payments, partials, and advances by the day they came in. The week runs Monday to Sunday. It leaves out tips, earlier debt, and forgiven amounts.\nWork already done: sum of the prices of yards marked Done, by the yard's date.",
        ],
        example: [
          "Esta semana hiciste 40 patios a $45: trabajo hecho $1.800. Cobrado de la semana: $1.950, porque Robert te pagó $240 de dos semanas atrasadas y te faltan $90 de esta. Por eso Cobrado puede ser mayor o menor que el trabajo hecho.",
          "This week you did 40 yards at $45: work done $1,800. Collected this week: $1,950, because Robert paid $240 for two past weeks and $90 from this week is still owed. That's why Collected can be above or below work done.",
        ],
        cases: [
          "Un adelanto que entra hoy: cuenta en Cobrado hoy, aunque el corte sea la semana que viene.\nDeshaces un Hecho y cobrado: sale de las dos cifras.\nUn patio movido a la semana que viene y hecho allí: cuenta en esa semana.",
          "An advance that comes in today: counts in Collected today, even if the cut is next week.\nYou undo a Done and paid: it leaves both figures.\nA yard moved to next week and done there: counts in that week.",
        ],
        related: ["por-cobrar", "ingresos-mes", "propina", "este-mes"],
        go: { to: "/cobros", where: ["Cobros, arriba a la derecha", "Payments, top right"] },
        terms: [["Trabajo ya hecho", "Work already done"], ["Cobrado", "Collected"]],
      },
      {
        id: "espera",
        title: ["En espera y alto riesgo", "Waiting and high risk"],
        sum: ["Cuándo un atraso pasa a esperar, y cuándo a naranja.", "When a late payment becomes Waiting, and when it turns orange."],
        what: [
          "En espera: se atrasó pero va a pagar. Alto riesgo: pasó tus límites de días, monto o cortes sin pagar.",
          "Waiting: late, but they will pay. High risk: they passed your limits for days, amount, or unpaid cuts.",
        ],
        how: [
          "En Ajustes, Espera y alto riesgo, pon: Días para En espera, Días para alto riesgo (después de En espera), Monto y Cortes sin pagar.\nCobros muestra cada caso con su color y En espera agrupa a los atrasados y a los pausados.\nEl dinero nunca sale de Por cobrar por cambiar de estado.",
          "In Settings, Waiting and high risk, set: Days for Waiting, Days for high risk (after Waiting), Amount, and Unpaid cuts.\nPayments shows each case with its color, and Waiting groups late payers and paused clients.\nThe money never leaves To collect by changing state.",
        ],
        calc: [
          "Los días cuentan desde el último pago, o desde el último corte si nunca pagó.\nEn espera: debe y pasaron los Días para En espera (45 de siempre).\nAlto riesgo: pasaron además los días de alto riesgo (21 más, o sea 66), o la deuda llegó al monto ($200), o tiene esos cortes sin pagar (3). Basta con uno.\nCortes sin pagar: los cortes más recientes que cubre su deuda (un abono paga primero lo más viejo).",
          "Days count from the last payment, or from the last cut if they never paid.\nWaiting: they owe and the Days for Waiting passed (45 by default).\nHigh risk: the high-risk days passed too (21 more, so 66), or the debt reached the amount ($200), or they have that many unpaid cuts (3). Any one is enough.\nUnpaid cuts: the most recent cuts their debt covers (a partial pays the oldest first).",
        ],
        example: [
          "Luis pagó por última vez el 1 de septiembre y debe $80 de dos cortes. El 16 de octubre (45 días) pasa a En espera. Si nada cambia, el 6 de noviembre (66 días) pasa a Alto riesgo, en naranja. Si antes le haces un tercer corte sin pago, pasa a naranja ese mismo día.",
          "Luis last paid on September 1 and owes $80 for two cuts. On October 16 (45 days) he becomes Waiting. If nothing changes, on November 6 (66 days) he turns High risk, in orange. If you do a third unpaid cut before then, he turns orange that same day.",
        ],
        cases: [
          "Te paga una parte: los días vuelven a contar desde ese pago.\nUsas Cobro corto en Ajustes rápidos: En espera a los 21 días y alto riesgo 10 días después, con $100 o 2 cortes.\nUn cliente en alto riesgo sale en Clientes, filtro Alto riesgo, y Asesor lo pone en Morosos.",
          "They pay part: days start counting again from that payment.\nYou use Short collection in Quick settings: Waiting at 21 days and high risk 10 days later, at $100 or 2 cuts.\nA high-risk client shows in Clients, High risk filter, and Advisor puts them under Late payers.",
        ],
        mistake: [
          "Creer que En espera significa perdonado: el dinero sigue en Por cobrar hasta que pagan o usas Perdonar.",
          "Thinking Waiting means forgiven: the money stays in To collect until they pay or you use Forgive.",
        ],
        related: ["pausa", "por-cobrar", "perdonado", "ajustes-usuales"],
        go: { to: "/ajustes", focus: "aj-espera", where: ["Ajustes, Espera y alto riesgo", "Settings, Waiting and high risk"] },
        terms: [["Alto riesgo", "High risk"], ["En espera", "Waiting"], ["Atraso", "Late payment"], ["Cortes sin pagar", "Unpaid cuts"]],
      },
      {
        id: "perdonado",
        title: ["Perdonar", "Forgive"],
        sum: ["Dinero que decidiste no cobrar.", "Money you chose not to collect."],
        what: [
          "Dinero que decidiste no cobrar. Sale de Por cobrar y queda anotado como perdonado.",
          "Money you decided not to collect. It leaves To collect and is recorded as forgiven.",
        ],
        how: [
          "En Cobros (vista Grande) o en la ficha, toca Perdonar.\nBrizna siempre pregunta antes.\nSe perdona toda la deuda de ese cliente de una vez.\nEn Cobros, Perdonado este mes muestra cuánto perdonaste en el mes.",
          "In Payments (Large view) or on the file, tap Forgive.\nBrizna always asks first.\nThe client's whole debt is forgiven at once.\nIn Payments, Forgiven this month shows how much you forgave this month.",
        ],
        calc: [
          "Perdonar es lo único que borra una deuda sin un pago. No cuenta como cobrado ni como propina, y no toca el adelanto del cliente.",
          "Forgive is the only way to clear a debt without a payment. It does not count as collected or as a tip, and it does not touch the client's advance.",
        ],
        example: [
          "Doña Carmen, de 82 años, te debe $35 de un corte de agosto y se le hace difícil pagar. Tocas Perdonar: Por cobrar baja $35 y Perdonado este mes sube $35. Su próximo corte se cobra normal.",
          "Doña Carmen, 82, owes $35 for an August cut and is struggling to pay. You tap Forgive: To collect drops $35 and Forgiven this month rises $35. Her next cut is charged as usual.",
        ],
        cases: [
          "Te equivocaste de cliente: Deshacer devuelve la deuda completa.\nSolo quieres perdonar una parte: registra un abono por lo que sí te pagó y luego decide sobre el resto.\nQuieres darlo de baja: perdona primero si no vas a cobrar; así su deuda no queda colgando en Por cobrar.",
          "Wrong client: Undo brings the whole debt back.\nYou only want to forgive part: record a partial for what they did pay, then decide on the rest.\nYou want to take them off: forgive first if you won't collect, so the debt does not linger in To collect.",
        ],
        mistake: [
          "Confundir perdonar con esperar: un atraso que sí vas a cobrar se queda en En espera, no se perdona.",
          "Confusing forgive with wait: a late payment you will still collect stays in Waiting, not forgiven.",
        ],
        related: ["por-cobrar", "espera", "archivo"],
        go: { to: "/cobros", focus: "cob-perdonado", where: ["Cobros, Perdonado este mes", "Payments, Forgiven this month"] },
        terms: [["Perdonado este mes", "Forgiven this month"], ["Perdonado", "Forgiven"]],
      },
      {
        id: "propina",
        title: ["Propinas", "Tips"],
        sum: ["Dinero de más que no toca la deuda, sumado mes a mes.", "Extra money that does not touch the debt, added up month by month."],
        what: [
          "Dinero de más que te dan. No baja ni sube la deuda y no entra en Cobrado.",
          "Extra money they give you. It does not change the debt and does not count in Collected.",
        ],
        how: [
          "Al marcar Hecho o al registrar un pago, escribe la propina en su casilla.\nSi solo te dan propina, se anota sola, sin pago.\nEn Estudio, Propinas: lo del año, cuántas veces, el promedio, quién da más y una barra por cada uno de los últimos 12 meses.",
          "When you mark Done or record a payment, type the tip in its box.\nIf they only give a tip, it is recorded on its own, with no payment.\nIn Stats, Tips: the year's total, how many times, the average, who tips most, and a bar for each of the last 12 months.",
        ],
        calc: [
          "La propina se guarda aparte del pago. Por eso no cambia la deuda, no cuenta en Cobrado ni en $ por hora, y en Cada año va aparte del dinero cobrado.",
          "A tip is stored apart from the payment. So it does not change the debt, does not count in Collected or $ per hour, and in Each year it sits apart from money collected.",
        ],
        example: [
          "María paga su corte de $45 con un billete de $50 y te dice quédate el cambio. Hecho y cobrado, propina 5: Cobrado sube $45 y Propinas $5. En diciembre ves que este año María te dejó $60 en propinas, la que más.",
          "María pays her $45 cut with a $50 bill and says keep the change. Done and paid, tip 5: Collected rises $45 and Tips $5. In December you see María left you $60 in tips this year, the most of anyone.",
        ],
        cases: [
          "Te dan de más porque deben: no es propina; anótalo como pago o abono.\nDeshaces el Hecho: la propina de ese Hecho no se borra sola; revísala en sus pagos.",
          "They give extra because they owe: it is not a tip; record it as a payment or partial.\nYou undo the Done: that Done's tip is not removed on its own; check it in their payments.",
        ],
        mistake: [
          "Anotar un adelanto como propina: no pagaría el próximo corte.",
          "Recording an advance as a tip: it would not pay the next cut.",
        ],
        related: ["hecho", "ficha-deuda", "cobrado", "cada-anio"],
        go: { to: "/", where: ["Hoy, al marcar Hecho", "Today, when you mark Done"] },
        terms: [["Propina", "Tip"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 5 */
  {
    id: "estudio",
    title: ["Estudio y Asesor", "Stats and Advisor"],
    intro: ["Tus cifras en el tiempo, y un consejo claro.", "Your figures over time, and plain advice."],
    topics: [
      {
        id: "estudio",
        title: ["Estudio | Asesor", "Stats | Advisor"],
        sum: ["Dos vistas: tus cifras, o qué hacer con ellas.", "Two views: your figures, or what to do with them."],
        what: [
          "Estudio son tus cifras en el tiempo. Asesor te dice en palabras simples cómo va el negocio.",
          "Stats is your figures over time. Advisor tells you in plain words how the business is doing.",
        ],
        how: [
          "Arriba eliges Estudio o Asesor; la pantalla recuerda tu elección.\nCada bloque empieza con su cifra grande y una frase; el detalle va debajo.\nCada bloque se pliega; el pin lo deja abierto. Desplegar abre todo.\nLa lupa deja solo los bloques que tienen esa palabra.\nEl botón de orden, junto al título, sube o baja cada bloque; Guardar pregunta antes y Orden de siempre lo devuelve.",
          "On top you pick Stats or Advisor; the screen remembers your choice.\nEach block starts with its big figure and one sentence; detail goes below.\nEach block folds; the pin keeps it open. Expand opens everything.\nThe magnifying glass leaves only the blocks with that word.\nThe order button, next to the title, moves each block up or down; Save asks first and Usual order puts it back.",
        ],
        calc: [
          "Todo sale de lo que marcas en la app: patios hechos (por su fecha), pagos (por el día en que entran), horas confirmadas y metas. Nada se adivina: si algo no se anotó, no cuenta.",
          "Everything comes from what you mark in the app: finished yards (by their date), payments (by the day they come in), confirmed hours, and goals. Nothing is guessed: if it was not recorded, it does not count.",
        ],
        example: [
          "Lo que más miras es cuánto te deben y tu $ por hora. Abres el orden, subes Quién te debe y $ por hora arriba del todo, y Guardar. Desde ese día Estudio abre con esas dos cifras.",
          "What you check most is what you are owed and your $ per hour. You open the order, move Who owes you and $ per hour to the very top, and Save. From then on Stats opens with those two.",
        ],
        cases: [
          "Empiezas de cero: los bloques dicen qué falta para mostrar algo (marcar cortes, confirmar horas, poner metas).\nCancelas el orden: no cambia nada.",
          "Starting from zero: blocks say what is missing to show something (mark cuts, confirm hours, set goals).\nYou cancel the order: nothing changes.",
        ],
        related: ["este-mes", "asesor", "meta-mes", "por-hora"],
        go: { to: "/estadisticas", view: "estudio", where: ["Estudio", "Stats"] },
        terms: [["Cifras", "Figures"], ["Estudio", "Stats"], ["Orden de las cifras", "Order of the figures"], ["Orden de siempre", "Usual order"]],
      },
      {
        id: "este-mes",
        title: ["Este mes", "This month"],
        sum: ["Cobrado y hecho, contra lo esperado del mes.", "Collected and done, against the month's expected."],
        what: [
          "El anillo grande es lo cobrado este mes; el de adentro, el trabajo ya hecho. Los dos se miden contra lo esperado.",
          "The big ring is what you collected this month; the inner one, the work already done. Both are measured against expected.",
        ],
        how: [
          "Mira el anillo grande: cuánto del mes ya entró en dinero.\nMira el de adentro: cuánto del trabajo del mes ya está hecho.\nDebajo: Te deben, la comparación con el mes pasado a esta misma fecha y la tasa de cobro de 90 días.",
          "Look at the big ring: how much of the month already came in as money.\nLook at the inner one: how much of the month's work is done.\nBelow: Owed to you, the comparison with last month to the same date, and the 90-day collection rate.",
        ],
        calc: [
          "Esperado = trabajo hecho este mes + lo pendiente desde hoy hasta fin de mes + lo atrasado de este mes.\nCobrado = pagos, abonos y adelantos desde el día 1 hasta hoy.\nTasa de cobro = lo cobrado ÷ el trabajo hecho en los últimos 90 días. Puede pasar de 100% porque los adelantos cuentan cuando entran.",
          "Expected = work done this month + what is pending from today to month end + this month's late work.\nCollected = payments, partials, and advances from the 1st to today.\nCollection rate = collected ÷ work done over the last 90 days. It can pass 100% because advances count when they come in.",
        ],
        example: [
          "Día 15. Agendado del mes: $4.000 (hecho $2.100, por hacer $1.800, atrasado $100). Cobraste $1.700. El anillo grande va al 43% y el de adentro al 53%. La brecha de $400 entre hecho y cobrado es deuda nueva del mes.",
          "The 15th. The month's schedule: $4,000 (done $2,100, to do $1,800, late $100). You collected $1,700. The big ring is at 43% and the inner one at 53%. The $400 gap between done and collected is new debt this month.",
        ],
        cases: [
          "Un día de lluvia mueve patios al mes siguiente: lo esperado de este mes baja.\nCobras deuda vieja este mes: el anillo de cobrado puede adelantarse al de trabajo.",
          "A rain day pushes yards into next month: this month's expected drops.\nYou collect old debt this month: the collected ring can pass the work ring.",
        ],
        related: ["meta-mes", "cobrado", "ingresos-mes", "agenda-todo"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-pulso", where: ["Estudio, Este mes", "Stats, This month"] },
        terms: [["Anillo", "Ring"], ["Esperado", "Expected"], ["Tasa de cobro", "Collection rate"]],
      },
      {
        id: "meta-mes",
        title: ["Metas de patios", "Yard goals"],
        sum: ["Tu meta diaria, y cuántos patios por día faltan para el mes.", "Your daily goal, and how many yards a day are left for the month."],
        what: [
          "La meta del mes suma la meta de patios de cada día de trabajo. La rayita marca dónde deberías ir hoy.",
          "The month goal adds up the yard goal of each working day. The tick shows where you should be today.",
        ],
        how: [
          "En Esfuerzo de la semana toca un día y pon su meta de patios (empieza en 8, o en lo que ya cortaste ese día).\nEsa meta queda también para ese día de la semana en las semanas siguientes.\nMeta del mes junta todo: lo hecho, la rayita de hoy y cuántos patios por día te faltan.\nCada barra de Esfuerzo es verde si llegaste, roja si un día pasado quedó corto y amarilla mientras hoy sigue en curso.",
          "In This week's effort tap a day and set its yard goal (it starts at 8, or at what you already cut that day).\nThat goal also stays for that weekday in later weeks.\nMonth goal pulls it together: what is done, today's tick, and how many yards a day are left.\nEach Effort bar is green if you reached it, red if a past day fell short, and yellow while today is in progress.",
        ],
        calc: [
          "Meta del mes = suma, día por día, de la meta de esa fecha (o la de ese día de la semana). No suman los días libres, los días que casi nunca se trabajan ni las vacaciones.\nHecho = todos los trabajos hechos del mes (cortes, extras y de una vez).\nRayita = la meta de los días ya pasados.\nPor día = lo que falta ÷ los días de trabajo que quedan, contando hoy, redondeado hacia arriba.",
          "Month goal = sum, day by day, of that date's goal (or that weekday's). Days off, almost-never days, and vacation do not add.\nDone = every job done this month (cuts, extras, and one-time).\nTick = the goal of the days already past.\nPer day = what is left ÷ the working days left, counting today, rounded up.",
        ],
        example: [
          "Meta de 10 patios de lunes a sábado. Noviembre tiene 25 días de trabajo: meta del mes 250. Día 17, llevas 140 y la rayita marca 150: vas 10 atrás. Quedan 11 días contando hoy: 110 ÷ 11 = 10 por día. Contratas ayuda el sábado y le pones 16: la meta sube y ese número también.",
          "A 10-yard goal Monday to Saturday. November has 25 working days: month goal 250. On the 17th you have 140 and the tick is at 150: 10 behind. 11 days left counting today: 110 ÷ 11 = 10 a day. You hire help Saturday and set 16: the goal rises and so does that number.",
        ],
        cases: [
          "Quitas la meta de una fecha: esa fecha vuelve a la meta de su día de la semana.\nMarcas un día libre: su meta deja de contar y el por día se reparte en los demás.\nSin metas: el bloque te pide tocar un día para poner la primera.",
          "You clear a date's goal: that date goes back to its weekday's goal.\nYou mark a day off: its goal stops counting and the per-day spreads over the rest.\nNo goals: the block asks you to tap a day to set the first one.",
        ],
        related: ["este-mes", "dias-libres", "vacaciones", "asesor-chequeos"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-meta", where: ["Estudio, Meta del mes", "Stats, Month goal"] },
        terms: [["Meta", "Goal"], ["Meta del mes", "Month goal"], ["Esfuerzo de la semana", "This week's effort"]],
      },
      {
        id: "ingreso-fijo",
        title: ["Ingreso fijo del mes", "Steady monthly income"],
        sum: ["Tu piso: lo que entra si todo sigue igual.", "Your floor: what comes in if nothing changes."],
        what: [
          "Lo que dejan tus clientes fijos activos en un mes normal. Es tu piso: lo que entra si todo sigue igual.",
          "What your active regular clients bring in a normal month. It is your floor: what comes in if nothing changes.",
        ],
        how: [
          "Mira la cifra grande: tu mes normal.\nDebajo, los clientes que más aportan y cuántas visitas suman al mes.\nCompáralo con Este mes para ver si el mes va por encima o por debajo de tu piso.",
          "Look at the big figure: your normal month.\nBelow, the clients who bring the most and how many visits they add up to a month.\nCompare it with This month to see whether the month runs above or below your floor.",
        ],
        calc: [
          "Por cada cliente regular activo: visitas al mes × precio. Cada semana cuenta 4 visitas, cada 2 semanas 2, 3 veces al mes 3, 1 vez al mes 1; a medida, 30,44 ÷ sus días. No cuentan extras, trabajos de una vez, clientes en pausa, la lista negra ni las temporadas.",
          "For each active regular client: visits a month × price. Weekly counts 4 visits, every 2 weeks 2, 3 times a month 3, once a month 1; custom, 30.44 ÷ its days. Extras, one-time jobs, paused clients, the blacklist, and seasons do not count.",
        ],
        example: [
          "20 clientes semanales a $45 (4 × 45 = $180 cada uno) y 10 cada 2 semanas a $55 ($110 cada uno): 20 × 180 + 10 × 110 = $4.700 al mes. Si pausas a un semanal, el piso baja $180.",
          "20 weekly clients at $45 (4 × 45 = $180 each) and 10 every 2 weeks at $55 ($110 each): 20 × 180 + 10 × 110 = $4,700 a month. Pause one weekly client and the floor drops $180.",
        ],
        cases: [
          "Subes un precio: el piso sube en el acto.\nUn mes con 5 semanas: dejas más que el piso, porque el piso cuenta 4 visitas.\nEn invierno con temporada: entras por debajo del piso; es normal.",
          "You raise a price: the floor rises at once.\nA 5-week month: you bring in more than the floor, which counts 4 visits.\nIn winter with a season on: you come in under the floor; that is normal.",
        ],
        related: ["este-mes", "pausa", "asesor-chequeos", "temporada"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-fijo", where: ["Estudio, Ingreso fijo del mes", "Stats, Steady monthly income"] },
        terms: [["Ingreso fijo", "Fixed income"], ["Piso", "Floor"]],
      },
      {
        id: "por-hora",
        title: ["$ por hora", "$ per hour"],
        sum: ["Cuánto ganas por cada hora trabajada.", "What you earn for each hour worked."],
        what: [
          "Lo cobrado dividido entre tus horas confirmadas, en la semana y en el mes. El anillo compara la semana con el mes.",
          "What you collected divided by your confirmed hours, for the week and the month. The ring compares the week with the month.",
        ],
        how: [
          "La cifra grande es tu $ por hora de esta semana (o del mes si esta semana aún no tiene horas).\nDebajo van las horas y el dinero de cada tramo.\nConfirma tus horas al final del día para que la cifra sea real.",
          "The big figure is this week's $ per hour (or the month's if this week has no hours yet).\nBelow are each stretch's hours and money.\nConfirm your hours at day's end so the figure is real.",
        ],
        calc: [
          "$ por hora = lo cobrado ÷ horas confirmadas. Las dos cosas cuentan hasta el último día confirmado: hoy entra solo cuando confirmas hoy. Anillo = $ por hora de la semana ÷ el del mes; lleno es igual o mejor.",
          "$ per hour = collected ÷ confirmed hours. Both count up to the last confirmed day: today joins only once you confirm today. Ring = this week's $ per hour ÷ the month's; full means as good or better.",
        ],
        example: [
          "Semana: cobraste $1.260 en 31 h 30 min confirmadas: $40 por hora. Mes: $3.900 en 108 h: $36 por hora. El anillo va lleno porque la semana va mejor que el mes.",
          "Week: you collected $1,260 over 31 hr 30 min confirmed: $40 an hour. Month: $3,900 over 108 hr: $36 an hour. The ring is full because the week beats the month.",
        ],
        cases: [
          "Cobras una deuda grande un día: el $ por hora de esa semana sube, aunque no trabajaste más.\nNo confirmas varios días: a los dos días se toma el horario de Ajustes.\nLas propinas no cuentan.",
          "You collect a big debt one day: that week's $ per hour jumps, though you did not work more.\nYou skip confirming for days: after two days the Settings hours are used.\nTips do not count.",
        ],
        related: ["horas", "cobrado", "semana-vs"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-hora", where: ["Estudio, $ por hora", "Stats, $ per hour"] },
      },
      {
        id: "ingresos-mes",
        title: ["Ingresos, mes a mes", "Income, month by month"],
        sum: ["Lo cobrado cada mes contra lo trabajado.", "Collected each month against work done."],
        what: [
          "Verde: lo cobrado cada mes. Línea punteada: lo que valió el trabajo hecho ese mes.",
          "Green: collected each month. Dotted line: what that month's work was worth.",
        ],
        how: [
          "Son los últimos 12 meses; el último va en curso.\nToca un mes para ver su detalle: cortes, extras, trabajos de una vez y propinas.\nSi la línea va por encima del verde, ese mes quedó dinero por cobrar.",
          "It shows the last 12 months; the last one is in progress.\nTap a month for its detail: cuts, extras, one-time jobs, and tips.\nWhen the line runs above the green, money was left to collect that month.",
        ],
        calc: [
          "Verde = pagos, abonos y adelantos por el mes en que entraron. Línea = precio de los trabajos hechos por el mes de su fecha. Las propinas van aparte.",
          "Green = payments, partials, and advances by the month they came in. Line = price of finished jobs by the month of their date. Tips are kept apart.",
        ],
        example: [
          "Julio: trabajaste $5.200 y cobraste $4.600: la línea va $600 por encima. Agosto: trabajaste $4.900 y cobraste $5.300 porque entró parte de lo de julio. Mirando los dos meses juntos, ves que la gente paga con un mes de atraso.",
          "July: $5,200 of work and $4,600 collected: the line runs $600 above. August: $4,900 of work and $5,300 collected because part of July came in. Looking at both, you see people pay a month late.",
        ],
        related: ["este-mes", "cobrado", "semana-vs", "cada-anio"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-mes", where: ["Estudio, Ingresos mes a mes", "Stats, Income month by month"] },
      },
      {
        id: "quien-debe",
        title: ["Quién te debe", "Who owes you"],
        sum: ["Lo que te deben, por antigüedad.", "What you are owed, by age."],
        what: [
          "Lo que te deben, repartido por la edad de cada trabajo sin pagar.",
          "What you are owed, split by the age of each unpaid job.",
        ],
        how: [
          "Arriba, el total y las franjas: 0–30, 31–60, 61–90 y más de 90 días, más Saldo inicial.\nDebajo, quién debe más, con su trabajo sin pagar más viejo y su estado (al corriente, En espera, Alto riesgo).\nToca un nombre para abrir su ficha.",
          "On top, the total and the bands: 0–30, 31–60, 61–90, and over 90 days, plus Opening balance.\nBelow, who owes the most, with their oldest unpaid job and their state (current, Waiting, High risk).\nTap a name to open their file.",
        ],
        calc: [
          "Un pago cubre primero lo más viejo. Por eso la deuda que queda se reparte en los trabajos más recientes, del más nuevo al más viejo, hasta cubrir el saldo. Lo que sobra (deuda de antes del primer corte anotado) va a Saldo inicial. Fiabilidad de pago mide si pagan a tiempo; no es el mismo número que Por cobrar.",
          "A payment covers the oldest first. So the remaining debt is spread over the most recent jobs, newest to oldest, until the balance is covered. Anything left (debt from before the first recorded cut) goes to Opening balance. Payment reliability measures whether they pay on time; it is not the same number as To collect.",
        ],
        example: [
          "Pedro debe $135. Sus últimos cortes: hoy hace 10 días ($45), hace 24 ($45) y hace 38 ($45). Los $135 se reparten: $90 en 0–30 y $45 en 31–60. Si te debía $50 de antes de la app y nunca los pagó, esos van en Saldo inicial.",
          "Pedro owes $135. His last cuts: 10 days ago ($45), 24 days ago ($45), and 38 days ago ($45). The $135 splits into $90 in 0–30 and $45 in 31–60. If he owed $50 from before the app and never paid it, that sits in Opening balance.",
        ],
        cases: [
          "Te paga una parte: se cubren los trabajos más viejos y la franja de 31–60 se vacía antes que la de 0–30.\nUn cliente archivado que debe: sigue aquí.",
          "They pay part: the oldest jobs are covered and the 31–60 band empties before 0–30.\nAn archived client who owes: still here.",
        ],
        related: ["por-cobrar", "espera", "deuda-anterior", "asesor-grupos"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-fiabilidad", where: ["Estudio, Quién debe", "Stats, Who owes"] },
        terms: [["Fiabilidad de pago", "Payment reliability"], ["Antigüedad de la deuda", "Debt age"], ["Saldo inicial", "Opening balance"]],
      },
      {
        id: "dias-temporadas",
        title: ["Días y temporadas", "Days and seasons"],
        sum: ["Qué días y qué meses rinden más.", "Which days and months pay best."],
        what: [
          "Cada fila es un mes y cada columna un día de la semana. Más verde, más trabajos hechos.",
          "Each row is a month and each column a weekday. Greener means more jobs done.",
        ],
        how: [
          "Toca un cuadro para ver cuántos trabajos y cuánto valieron.\nDebajo, cada día de la semana con lo que dejó en los últimos 12 meses y cuántos días se trabajó.\nAsí ves qué ruta vale más y qué meses aflojan.",
          "Tap a square to see how many jobs and what they were worth.\nBelow, each weekday with what it brought in over the last 12 months and how many days were worked.\nThat way you see which route is worth more and which months slow down.",
        ],
        calc: [
          "Cuenta los trabajos hechos de los últimos 12 meses por mes y día de la semana. El valor de cada día de la semana es la suma de sus precios; los días trabajados son las fechas distintas con algo hecho.",
          "Counts the finished jobs of the last 12 months by month and weekday. Each weekday's value is the sum of its prices; days worked are the distinct dates with something done.",
        ],
        example: [
          "Ves que tus martes dejaron $14.000 en 48 días ($290 por día) y tus sábados $9.000 en 46 ($195 por día). Si quieres sumar clientes, los sábados tienen espacio; y enero y febrero salen más pálidos: menos patios en invierno.",
          "You see your Tuesdays brought $14,000 over 48 days ($290 a day) and your Saturdays $9,000 over 46 ($195 a day). If you want more clients, Saturdays have room; and January and February look paler: fewer yards in winter.",
        ],
        related: ["temporada", "asesor-pasos", "semana-vs"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-calendario", where: ["Estudio, Días y temporadas", "Stats, Days and seasons"] },
        terms: [["Mapa de calor", "Heat map"]],
      },
      {
        id: "mejores-clientes",
        title: ["Mejores clientes", "Best clients"],
        sum: ["Quién te dejó más en un año.", "Who brought you the most in a year."],
        what: [
          "Lo que valió el trabajo hecho para cada cliente en los últimos 12 meses. La barra compara con el primero.",
          "What the work done for each client was worth over the last 12 months. The bar compares with the first one.",
        ],
        how: [
          "Salen los 8 que más dejaron, con trabajos, cortes y promedio por trabajo.\nToca un nombre para abrir su ficha.\nUn cliente archivado puede salir si trabajaste para él este año.",
          "The top 8 show, with jobs, cuts, and average per job.\nTap a name to open their file.\nAn archived client can show if you worked for them this year.",
        ],
        calc: [
          "Suma el precio de todos los trabajos hechos (cortes, extras y de una vez) por cliente en los últimos 12 meses, pagados o no. La barra = su total ÷ el total del primero.",
          "Adds the price of every finished job (cuts, extras, and one-time) per client over the last 12 months, paid or not. The bar = their total ÷ the top client's total.",
        ],
        example: [
          "Robert: 50 cortes a $60 más dos podas de $150: $3.300. María: 52 cortes a $45: $2.340. La barra de María llega al 71% de la de Robert, aunque María fue más veces.",
          "Robert: 50 cuts at $60 plus two $150 trims: $3,300. María: 52 cuts at $45: $2,340. María's bar reaches 71% of Robert's, even though María had more visits.",
        ],
        mistake: [
          "Leerlo como quién paga mejor: aquí cuenta el trabajo, no el pago. Para el pago mira Quién te debe.",
          "Reading it as who pays best: this counts work, not payment. For payment see Who owes you.",
        ],
        related: ["asesor-grupos", "quien-debe", "precio-trabajo"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-mejores", where: ["Estudio, Mejores clientes", "Stats, Best clients"] },
      },
      {
        id: "precio-trabajo",
        title: ["Precio por trabajo", "Price per job"],
        sum: ["Cuánto vale en promedio cada trabajo.", "What each job is worth on average."],
        what: [
          "El promedio de lo que valió cada trabajo hecho en los últimos 12 meses, separado por tipo.",
          "The average value of each job done over the last 12 months, by kind.",
        ],
        how: [
          "Arriba, el promedio de cortes, extras y trabajos de una vez.\nLa línea muestra el precio medio de un corte, mes a mes.\nSi la línea sube, tus subidas de precio están llegando.",
          "On top, the average for cuts, extras, and one-time jobs.\nThe line shows a cut's average price, month by month.\nIf the line rises, your price increases are landing.",
        ],
        calc: [
          "Promedio = suma de precios ÷ número de trabajos, por tipo. Los trabajos de $0 (cortesías) no cuentan. La línea mensual = valor de los cortes del mes ÷ cortes con precio de ese mes.",
          "Average = sum of prices ÷ number of jobs, by kind. $0 jobs (courtesies) do not count. The monthly line = the month's cut value ÷ priced cuts that month.",
        ],
        example: [
          "En marzo subes a 6 clientes de $40 a $45. La línea pasa de $46 a $48 en abril. Le regalas un corte a un vecino ($0): el promedio no baja.",
          "In March you raise 6 clients from $40 to $45. The line goes from $46 to $48 in April. You give a neighbor a free cut ($0): the average does not drop.",
        ],
        related: ["precio", "asesor-chequeos", "mejores-clientes"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-precio", where: ["Estudio, Precio por trabajo", "Stats, Price per job"] },
        terms: [["Ticket promedio", "Average ticket"], ["Cortesía", "Courtesy"]],
      },
      {
        id: "semana-vs",
        title: ["Esta semana y la pasada", "This week vs. last"],
        sum: ["¿Vas mejor o peor que la semana pasada?", "Are you ahead of or behind last week?"],
        what: [
          "Esta semana hasta hoy contra la semana pasada hasta el mismo día. Abajo, las últimas 8 semanas.",
          "This week so far against last week up to the same day. Below, the last 8 weeks.",
        ],
        how: [
          "Arriba: trabajos, cortes y cobrado de esta semana, con la diferencia contra la pasada.\nAbajo: 8 semanas; verde es lo cobrado y la barra de al lado lo que valió el trabajo hecho, por tipo.\nLa semana va de lunes a domingo.",
          "On top: this week's jobs, cuts, and collected, with the difference against last week.\nBelow: 8 weeks; green is collected and the bar beside it what the work was worth, by kind.\nThe week runs Monday to Sunday.",
        ],
        calc: [
          "Si hoy es jueves, compara lunes a jueves de esta semana contra lunes a jueves de la pasada (hoy menos 7 días). Así un lunes no se ve mal contra una semana completa.",
          "If today is Thursday, it compares Monday to Thursday this week against Monday to Thursday last week (today minus 7 days). So a Monday never looks bad against a full week.",
        ],
        example: [
          "Jueves: llevas 31 patios y $1.150 cobrados. La semana pasada a esta altura llevabas 36 y $1.300: −5 patios. Fue el martes de lluvia; con Pasar los de hoy los recuperas el sábado.",
          "Thursday: 31 yards and $1,150 collected so far. Last week by now you had 36 and $1,300: −5 yards. It was Tuesday's rain; you catch up Saturday.",
        ],
        related: ["por-hora", "ingresos-mes", "parar-dia"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-semana", where: ["Estudio, Esta semana", "Stats, This week"] },
      },
      {
        id: "cada-anio",
        title: ["Cada año y de por vida", "Each year and lifetime"],
        sum: ["Lo cobrado y los cortes, año por año.", "Collected money and cuts, year by year."],
        what: [
          "Cuánto cobraste y cuántos cortes hiciste cada año, y arriba el total de por vida.",
          "How much you collected and how many cuts you made each year, with the lifetime total on top.",
        ],
        how: [
          "Arriba, De por vida: todo lo cobrado desde el primer pago y todos los cortes hechos.\nDebajo, una fila por año con su dinero, sus cortes y sus horas de trabajo.\nEl conteo no se reinicia al cambiar de año.",
          "On top, Lifetime: everything collected since the first payment and every cut done.\nBelow, one row per year with its money, its cuts, and its work hours.\nThe count does not reset when the year changes.",
        ],
        calc: [
          "Son dos cuentas distintas: dinero (pagos, abonos y adelantos, sin propinas) y cortes (patios marcados Hecho, pagados o no). Un corte sin pagar cuenta como corte pero no como dinero.",
          "They are two separate counts: money (payments, partials, and advances, tips apart) and cuts (yards marked Done, paid or not). An unpaid cut counts as a cut but not as money.",
        ],
        example: [
          "2025: $41.000 y 880 cortes. 2026 hasta noviembre: $46.500 y 905 cortes. De por vida: $87.500 y 1.785 cortes. Ya pasaste el año anterior antes de diciembre.",
          "2025: $41,000 and 880 cuts. 2026 through November: $46,500 and 905 cuts. Lifetime: $87,500 and 1,785 cuts. You already beat last year before December.",
        ],
        related: ["ingresos-mes", "propina", "horas"],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-anio", where: ["Estudio, Cada año", "Stats, Each year"] },
        terms: [["De por vida", "Lifetime"]],
      },
      {
        id: "asesor",
        title: ["Asesor: el puntaje", "Advisor: the score"],
        sum: ["De 0 a 100, cómo va tu negocio.", "From 0 to 100, how your business is doing."],
        what: [
          "Un puntaje de 0 a 100 de cómo va el negocio. Con 75 o más, va bien.",
          "A 0 to 100 score of how the business is doing. At 75 or more, it is doing well.",
        ],
        how: [
          "Arriba, el puntaje y una frase, en verde (75 o más), amarillo (50 a 74) o rojo (menos de 50).\nDebajo: lo que te deben, tu ingreso fijo al mes y tus clientes activos.\nLuego vienen Lo que yo haría ahora, tus grupos de clientes y los Cinco chequeos que forman el puntaje.",
          "On top, the score and a sentence, in green (75 or more), yellow (50 to 74), or red (under 50).\nBelow: what you are owed, your fixed monthly income, and your active clients.\nThen come What I'd do now, your client groups, and the Five checks that make the score.",
        ],
        calc: [
          "El puntaje pesa los Cinco chequeos: Cobras a tiempo 30%, Clientes que se van 25%, Tus precios 15%, Semana llena 15% e Ingreso fijo 15%. Cada chequeo da de 0 a 1 y se suma con su peso.",
          "The score weighs the Five checks: Paid on time 30%, Clients leaving 25%, Your prices 15%, Full week 15%, and Fixed income 15%. Each check gives 0 to 1 and is added with its weight.",
        ],
        example: [
          "Cobras a tiempo 0,8, Clientes que se van 1, Tus precios 0,75, Semana llena 0,9 e Ingreso fijo 0,7. Puntaje = 100 × (0,8×0,30 + 1×0,25 + 0,75×0,15 + 0,9×0,15 + 0,7×0,15) = 84: va bien. Si tres clientes se atrasan, baja Cobras a tiempo y el puntaje con él.",
          "Paid on time 0.8, Clients leaving 1, Your prices 0.75, Full week 0.9, and Fixed income 0.7. Score = 100 × (0.8×0.30 + 1×0.25 + 0.75×0.15 + 0.9×0.15 + 0.7×0.15) = 84: doing well. If three clients fall behind, Paid on time drops and the score with it.",
        ],
        cases: [
          "Sin trabajos hechos todavía: Asesor espera a tener datos.\nUn cliente en la lista negra: no cuenta en nada del Asesor.",
          "No finished jobs yet: Advisor waits for data.\nA blacklisted client: does not count anywhere in Advisor.",
        ],
        related: ["asesor-chequeos", "asesor-pasos", "asesor-grupos", "estudio"],
        go: { to: "/estadisticas", view: "asesor", where: ["Estudio, botón Asesor", "Stats, Advisor button"] },
        terms: [["Puntaje", "Score"], ["Asesor", "Advisor"]],
      },
      {
        id: "asesor-pasos",
        title: ["Lo que yo haría ahora", "What I'd do now"],
        sum: ["Las tres jugadas que más dinero valen.", "The three moves worth the most money."],
        what: [
          "Tres tarjetas con lo más importante que hacer ahora y lo que vale cada una en dinero.",
          "Three cards with the most important things to do now and what each is worth in money.",
        ],
        how: [
          "Cada tarjeta dice qué hacer, a quién y cuánto vale.\nSu botón lo hace de un toque: abrir Cobros, ver la agenda, ver clientes o ajustar la temporada.\nSi dice Nada urgente, todo está en orden.",
          "Each card says what to do, with whom, and what it is worth.\nIts button does it in one tap: open Payments, see the schedule, see clients, or set the season.\nIf it says Nothing urgent, everything is in order.",
        ],
        calc: [
          "Cobrar: deuda atrasada (si pasa de $20); va primero quien debe más, con un empujón por antigüedad.\nSubir precios: clientes de más de un año que pagan 90% o menos del precio usual de su frecuencia; sugiere cerca de +15% al múltiplo de $5, sin pasar el usual ni +20%, y al menos +$5 (sale si suma $60 al año o más).\nRecuperar: lo que dejan al año los que se están yendo.\nLlenar: un día con 3 o más patios de espacio, por tu precio medio.\nPlanes: pasar a los de una vez a cada 2 semanas.\nTemporada: si tus inviernos dejan 12% menos o más.\nSalen las tres de más peso.",
          "Collect: overdue debt (if over $20); the biggest debt first, nudged by age.\nRaise prices: clients over a year who pay 90% or less of the usual price for their frequency; suggests about +15% to the nearest $5, never past the usual or +20%, and at least +$5 (shows if it adds $60 a year or more).\nWin back: what the ones drifting away bring in a year.\nFill: a day with room for 3 or more yards, at your average price.\nPlans: moving one-time clients to every 2 weeks.\nSeason: if your winters bring in 12% less or more.\nThe three heaviest show.",
        ],
        example: [
          "Asesor dice Subir precios: 4 clientes, +$1.040 al año. Uno es la señora Lee: paga $35 cada semana y lo usual es $45. Sugiere $40 (+15%, al múltiplo de $5): $5 × 4 visitas × 12 meses = $240 al año solo con ella.",
          "Advisor says Raise prices: 4 clients, +$1,040 a year. One is Mrs. Lee: she pays $35 weekly and the usual is $45. It suggests $40 (+15%, to the nearest $5): $5 × 4 visits × 12 months = $240 a year from her alone.",
        ],
        cases: [
          "Un cliente debe con atraso: no le sugiere subir precio; primero cobrar.\nCliente de menos de un año: no entra en Subir precios.",
          "A client owes and is overdue: no price raise is suggested; collect first.\nA client under a year: not included in Raise prices.",
        ],
        related: ["asesor", "asesor-grupos", "precio", "temporada"],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor", "Advisor"] },
      },
      {
        id: "asesor-grupos",
        title: ["Tus clientes, en grupos", "Your clients, in groups"],
        sum: ["Estrellas, Fieles, En riesgo, Morosos y Ocasionales.", "Stars, Loyal, At risk, Late payers, and One-time."],
        what: [
          "Tus clientes en cinco grupos. Toca uno para ver quiénes son y qué hacer con cada uno.",
          "Your clients in five groups. Tap one to see who is in it and what to do with each.",
        ],
        how: [
          "Cada grupo muestra cuántos son y su dinero: lo que deben (Morosos), lo que dejaron (Ocasionales) o lo que dejan al mes (los demás).\nToca un grupo para ver la lista y el consejo de cada uno: cobrar, llamar, ofrecer un plan, subir precio o agradecer.",
          "Each group shows how many and their money: what they owe (Late payers), what they brought (One-time), or what they bring a month (the rest).\nTap a group to see the list and each one's tip: collect, call, offer a plan, raise the price, or thank them.",
        ],
        calc: [
          "Cada cliente cae en el primer grupo que le toca, en este orden:\nMorosos: debe y ya está En espera o Alto riesgo.\nEn riesgo: dado de baja hace menos de 120 días, en pausa, sin corte hace mucho más que su ritmo, o con 3 o más cortes movidos o cancelados en 90 días.\nOcasionales: clientes de una vez.\nEstrellas: el 25% de regulares que más dejaron en 12 meses.\nFieles: el resto.",
          "Each client lands in the first group that fits, in this order:\nLate payers: owes and is already Waiting or High risk.\nAt risk: taken off under 120 days ago, paused, no cut for well past their pace, or 3 or more cuts moved or canceled in 90 days.\nOne-time: one-time clients.\nStars: the top 25% of regulars by 12-month value.\nLoyal: the rest.",
        ],
        example: [
          "Kevin es de tus mejores clientes, pero debe $150 desde hace 50 días: aparece en Morosos, no en Estrellas, porque Morosos va primero. Cuando paga, vuelve a Estrellas.",
          "Kevin is one of your best clients, but has owed $150 for 50 days: he shows under Late payers, not Stars, because Late payers comes first. Once he pays, he is back in Stars.",
        ],
        related: ["asesor", "asesor-pasos", "espera", "mejores-clientes"],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor, grupos", "Advisor, groups"] },
        terms: [["Estrellas", "Stars"], ["Fieles", "Loyal"], ["En riesgo", "At risk"], ["Morosos", "Late payers"], ["Ocasionales", "One-time"]],
      },
      {
        id: "asesor-chequeos",
        title: ["Cinco chequeos y Palabras claras", "Five checks and Plain words"],
        sum: ["Cinco revisiones del negocio y un glosario corto.", "Five business checks and a short glossary."],
        what: [
          "Cinco revisiones del negocio, cada una en verde, amarillo o rojo. Palabras claras explica cada término.",
          "Five business checks, each green, yellow, or red. Plain words explains each term.",
        ],
        how: [
          "Toca un chequeo para leer por qué está así y qué lo mejora.\nPalabras claras, al final, explica cada término del Asesor.",
          "Tap a check to read why it is that way and what improves it.\nPlain words, at the end, explains each Advisor term.",
        ],
        calc: [
          "Cobras a tiempo: lo cobrado ÷ el trabajo de 90 días; verde con 92% o más y 10% o menos de clientes morosos.\nTus precios: clientes de más de un año que pagan 90% o menos de lo usual; verde si son 10% o menos.\nClientes que se van: los En riesgo ÷ los regulares activos; verde con 6% o menos.\nSemana llena: patios agendados en las próximas 4 semanas contra tu meta diaria (o tu día más lleno); verde al 85%.\nIngreso fijo: tu piso ÷ el promedio de los últimos 3 meses; verde con 75% y si ningún cliente pasa del 25% de lo que dejas.",
          "Paid on time: collected ÷ work over 90 days; green at 92% or more with 10% or fewer late payers.\nYour prices: clients over a year paying 90% or less of the usual; green if 10% or fewer.\nClients leaving: At risk ÷ active regulars; green at 6% or less.\nFull week: yards booked over the next 4 weeks against your daily goal (or your busiest day); green at 85%.\nFixed income: your floor ÷ the last 3 months' average; green at 75% and if no client is over 25% of what you bring in.",
        ],
        example: [
          "En 90 días hiciste $12.000 de trabajo y cobraste $10.400 (87%), con 3 morosos de 35 clientes (9%): Cobras a tiempo queda en amarillo. Cobras $700 de lo atrasado y pasa a 92%: verde.",
          "Over 90 days you did $12,000 of work and collected $10,400 (87%), with 3 late payers out of 35 clients (9%): Paid on time is yellow. You collect $700 of the overdue and it reaches 92%: green.",
        ],
        related: ["asesor", "meta-mes", "ingreso-fijo", "espera"],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor, al final", "Advisor, at the end"] },
        terms: [["Chequeos", "Checks"], ["Glosario", "Glossary"], ["Palabras claras", "Plain words"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 6 */
  {
    id: "notas",
    title: ["Bloc de notas", "Notepad"],
    intro: ["Recordatorios, materiales y recados.", "Reminders, materials, and errands."],
    topics: [
      {
        id: "notas",
        title: ["Bloc de notas", "Notepad"],
        sum: ["Escribe, y toca Guardar.", "Write, then tap Save."],
        what: ["Recordatorios, materiales, recados…", "Reminders, materials, errands…"],
        how: [
          "Escribe y toca Guardar: el texto no se guarda solo.\nEl más abre una nota en blanco; no se crea nada hasta que guardas.\nSi sales con algo sin guardar, pregunta qué hacer.\nEscribe @ y elige un cliente: la nota queda también en su ficha.\nLa calculadora, junto al pin, saca una cuenta y En la nota la escribe donde estás; se mueve por el asa y se achica por la esquina.\nAbajo, Esta semana: toca un día para ver sus patios (hoy primero y luego seis días).",
          "Write and tap Save: text does not save itself.\nThe plus opens a blank note; nothing is created until you save.\nIf you leave with unsaved text, it asks what to do.\nType @ and pick a client: the note also lands on their file.\nThe calculator, next to the pin, works out a sum and Into note writes it where you are; drag it by the handle and shrink it from the corner.\nBelow, This week: tap a day to see its yards (today first, then six days).",
        ],
        example: [
          "En la tienda anotas: 2 cuchillas, 1 galón de mezcla, hilo 0.095. Con la calculadora sumas 2 × 18,50 + 24 + 12 = 73 y En la nota escribe 73. Debajo pones @Kevin cambiar la llave del portón: esa línea aparece también en la ficha de Kevin.",
          "At the store you note: 2 blades, 1 gallon of mix, 0.095 line. With the calculator you add 2 × 18.50 + 24 + 12 = 73 and Into note writes 73. Below you add @Kevin new gate key: that line also shows on Kevin's file.",
        ],
        cases: [
          "Cierras la app sin guardar: el borrador se recupera al volver al bloc.\nSin internet: guardas igual; se sube a la nube después.",
          "You close the app without saving: the draft comes back when you return to the pad.\nOffline: you still save; it uploads later.",
        ],
        related: ["fichero", "notas-cliente"],
        go: { to: "/notas", where: ["Bloc de notas", "Notepad"] },
        terms: [["Bloc", "Pad"], ["Guardar", "Save"], ["@Nombre", "@Name"], ["Calculadora", "Calculator"], ["Esta semana", "This week"]],
      },
      {
        id: "fichero",
        title: ["Fichero, carpetas y fijar", "Cabinet, folders, and pins"],
        sum: ["Donde se guardan y se leen las notas.", "Where notes are kept and read."],
        what: [
          "Toda nota entra en una carpeta. El Fichero se abre con doble toque en el icono de notas.",
          "Every note goes into a folder. Double-tap the notes icon to open the cabinet.",
        ],
        how: [
          "Carpetas de siempre: Trabajo por hacer, Materiales, Recordatorios y No especificada; crea las tuyas con el engranaje (también renombrar y borrar).\nDesliza una nota a la derecha para cambiarla de carpeta y a la izquierda para mandarla a la papelera.\nDoble toque abre el editor.\nFijar marca la nota y la muestra en Hoy; fuera de las carpetas solo se ven las fijadas.",
          "Default folders: To do, Materials, Reminders, and Unspecified; make your own with the gear (rename and delete too).\nSwipe a note right to change its folder and left to send it to the trash.\nDouble-tap opens the editor.\nPin marks the note and shows it on Today; outside the folders only pinned notes show.",
        ],
        example: [
          "Fijas Pagar el seguro del trailer el 15. Cada mañana sale en Hoy, arriba de tus patios. El 15 lo pagas, desfijas la nota y la mueves a Recordatorios para el año que viene.",
          "You pin Pay the trailer insurance on the 15th. Every morning it shows on Today, above your yards. On the 15th you pay it, unpin the note, and move it to Reminders for next year.",
        ],
        cases: [
          "Borras una carpeta: Brizna pregunta antes de borrarla.\nMandaste una nota a la papelera por error: sácala de la papelera.",
          "You delete a folder: Brizna asks before deleting it.\nYou trashed a note by mistake: take it out of the trash.",
        ],
        related: ["notas", "hoy"],
        go: { to: "/fichero", where: ["Fichero", "Cabinet"] },
        terms: [["Carpetas", "Folders"], ["Papelera", "Trash"], ["Fichero", "Cabinet"], ["Fijar", "Pin"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 7 */
  {
    id: "clima",
    title: ["Clima", "Weather"],
    intro: ["¿Se puede cortar hoy?", "Can you cut today?"],
    topics: [
      {
        id: "clima",
        title: ["Clima y el cielo", "Weather and the sky"],
        sum: ["Un veredicto claro: cortar, esperar o alerta.", "A clear verdict: cut, wait, or alert."],
        what: [
          "Dice si conviene cortar ahora, con la lluvia, el viento y el calor de las próximas horas.",
          "Says whether to cut now, with the rain, wind, and heat for the next hours.",
        ],
        how: [
          "Toca el clima arriba para abrirlo.\nArriba sale el veredicto; debajo, las próximas 12 horas, el radar y el día de mañana.\nEn Tu zona usa tu ubicación o escribe un código postal o una ciudad.\nSe actualiza solo cada 10 minutos.\nDetrás de cada pantalla, el cielo de fondo muestra el tiempo de ahora (nubes, lluvia, tormenta, niebla o despejado); es solo decoración.",
          "Tap the weather on top to open it.\nThe verdict is on top; below, the next 12 hours, the radar, and tomorrow.\nIn Your area use your location or type a ZIP code or a city.\nIt refreshes itself every 10 minutes.\nBehind every screen, the sky shows the weather now (clouds, rain, storm, fog, or clear); it is only decoration.",
        ],
        calc: [
          "Alerta: hay tormenta ahora o en las próximas 8 horas, o ya está lloviendo.\nEsperar: lluvia probable (50% o más) en las próximas 8 horas, o viento de 30 km/h o más.\nCortar: las próximas 4 horas se ven secas (menos de 30% de lluvia).\nCalor: aviso con 32 °C (90 °F) o más, sensación de 34 °C, o UV de 8.",
          "Alert: a storm now or in the next 8 hours, or it is already raining.\nWait: likely rain (50% or more) in the next 8 hours, or wind of 30 km/h or more.\nCut: the next 4 hours look dry (under 30% rain).\nHeat: a warning at 32 °C (90 °F) or more, feels-like 34 °C, or UV 8.",
        ],
        example: [
          "10 de la mañana, despejado, pero a las 2 hay 60% de lluvia: dice Lluvia cerca. Corta lo urgente y deja el soplado para después. Haces primero los patios grandes y, si a las 2 llueve, usas Parar el día.",
          "10 am, clear, but 60% rain at 2: it says Rain is close. Cut what is urgent and leave the blowing for later. You do the big yards first and, if it rains at 2, use Stop the day.",
        ],
        cases: [
          "Sin internet: muestra el último clima guardado.\nSin permiso de ubicación: escribe tu código postal en Tu zona.",
          "Offline: it shows the last saved weather.\nNo location permission: type your ZIP code in Your area.",
        ],
        related: ["parar-dia", "hoy"],
        go: { to: "/clima", where: ["Clima", "Weather"] },
        terms: [["Radar", "Radar"], ["Código postal", "ZIP code"], ["Lluvia", "Rain"], ["Cielo", "Sky"], ["Tormenta", "Storm"]],
      },
    ],
  },

  /* ------------------------------------------------------------------ 8 */
  {
    id: "ajustes",
    title: ["Ajustes", "Settings"],
    intro: ["Tu horario, tus límites, tus copias y tu cuenta.", "Your hours, your limits, your copies, and your account."],
    topics: [
      {
        id: "busca",
        title: ["Buscar y plegar ajustes", "Search and fold settings"],
        sum: ["La lupa deja solo el ajuste que buscas.", "The magnifying glass leaves only the setting you want."],
        what: [
          "La lupa deja solo el ajuste que buscas; lo demás se esconde.",
          "The magnifying glass leaves only the setting you want; the rest hides.",
        ],
        how: [
          "Toca la lupa en la línea de Ajustes y escribe unas letras.\nSolo quedan los ajustes que tienen esa palabra (también palabras parecidas o sin acentos).\nCada ajuste se pliega solo; el pin lo deja abierto la próxima vez.\nDesplegar todo abre o cierra todos los de la página de una vez.",
          "Tap the magnifying glass on the Settings line and type a few letters.\nOnly settings with that word stay (similar words and words without accents too).\nEach setting folds on its own; the pin keeps it open next time.\nExpand all opens or closes every setting on the page at once.",
        ],
        example: [
          "Quieres cambiar la hora de salida. Escribes hor: queda solo Horas de trabajo, ya abierto. Lo cambias a 6:00 y borras la búsqueda: vuelven todos los ajustes.",
          "You want to change your clock-out. You type hor: only Work hours stays, already open. You change it to 6:00 and clear the search: every setting comes back.",
        ],
        cases: [
          "No sale nada: prueba otra palabra, como cobro, copia o huella.\nEl manual tiene su propia lupa, que busca solo en el manual.",
          "Nothing shows: try another word, like payment, backup, or fingerprint.\nThe manual has its own magnifying glass, which searches only the manual.",
        ],
        related: ["manual-uso", "ajustes-usuales"],
        go: { to: "/ajustes", where: ["Ajustes, la lupa", "Settings, the magnifying glass"] },
        terms: [["Lupa", "Magnifying glass"], ["Desplegar todo", "Expand all"], ["Pin", "Pin"], ["Plegar", "Fold"]],
      },
      {
        id: "nombre-negocio",
        title: ["Nombre del negocio", "Business name"],
        sum: ["El nombre que sale arriba y en los reportes.", "The name shown at the top and on reports."],
        what: [
          "El nombre de tu empresa. Sale arriba en Brizna y en lo que exportas o imprimes.",
          "Your business name. It shows at the top of Brizna and on what you export or print.",
        ],
        how: [
          "Toca el título de arriba, o cámbialo en Ajustes, Nombre del negocio.\nPulsa Guardar nombre.\nSi te equivocas, Deshacer lo devuelve.",
          "Tap the title at the top, or change it in Settings, Business name.\nPress Save name.\nIf you get it wrong, Undo brings it back.",
        ],
        calc: [
          "Se usa en: la parte de arriba de cada pantalla, el título de los avisos de Recordatorios, la frase del Asesor y la portada de cada PDF, hoja o impresión. Si lo dejas vacío, se usa el nombre de siempre.",
          "It is used on: the top of every screen, the title of Reminders alerts, Advisor's headline, and the cover of every PDF, sheet, or printout. Leave it empty and the default name is used.",
        ],
        example: [
          "Escribes Velásquez Lawn Care. Tu resumen del mes para el contador sale con ese nombre en la portada, y el aviso de las 8:30 dice Velásquez Lawn Care: Hay 2 cortes atrasados por hacer.",
          "You type Velásquez Lawn Care. Your month summary for the CPA carries that name on its cover, and the 8:30 alert reads Velásquez Lawn Care: 2 late cuts to do.",
        ],
        related: ["exportar", "recordatorios"],
        go: { to: "/ajustes", focus: "aj-nombre", where: ["Ajustes, Nombre del negocio", "Settings, Business name"] },
        terms: [["Empresa", "Business"]],
      },
      {
        id: "manual-uso",
        title: ["Manual", "Manual"],
        sum: ["Todo lo que hace Brizna, explicado con detalle.", "Everything Brizna does, explained in detail."],
        what: [
          "La guía de Brizna. Cada (?) abre aquí su tema, y atrás te regresa adonde estabas.",
          "Brizna's guide. Every (?) opens its topic here, and back returns you to where you were.",
        ],
        how: [
          "El (?) da la idea en una o dos frases; Más en el manual abre aquí el detalle.\nCada tema tiene: Cómo funciona, Cómo se calcula, un Ejemplo, Si pasa… y temas relacionados.\nLa lupa busca en todo el texto del manual.\nVolver, la flecha del teléfono o Esc te regresan a la pantalla de antes.\nVer en la app te lleva al lugar exacto y lo enmarca con una luz unos segundos; un toque o un desliz la quitan antes.\nImprimir todo o un capítulo, y el Índice A–Z, están arriba.",
          "The (?) gives the idea in one or two sentences; More in the manual opens the detail here.\nEach topic has: How it works, How it's counted, an Example, What if…, and related topics.\nThe magnifying glass searches the whole manual text.\nBack, the phone's back arrow, or Esc returns you to the screen you came from.\nSee it in the app takes you to the exact spot and frames it with a light for a few seconds; a tap or a scroll clears it sooner.\nPrint all or one chapter, and the A–Z index, are on top.",
        ],
        example: [
          "En Ajustes no entiendes cuándo alguien pasa a naranja. Tocas el (?) de Espera y alto riesgo y luego Más en el manual: el ejemplo explica los 45 + 21 días. Tocas Volver y estás otra vez en Ajustes, donde estabas.",
          "In Settings you don't get when someone turns orange. You tap the Waiting and high risk (?), then More in the manual: the example explains the 45 + 21 days. You tap Back and you're in Settings again, right where you were.",
        ],
        related: ["busca", "ajustes-usuales"],
        go: { to: "/ajustes", focus: "aj-manual", where: ["Ajustes, Manual", "Settings, Manual"] },
        terms: [["Ayuda", "Help"], ["Guía", "Guide"], ["Índice A–Z", "A–Z index"]],
      },
      {
        id: "tema",
        title: ["Tema e idioma", "Theme and language"],
        sum: ["Los colores de día y de noche, y español o English.", "Day and night colors, and Spanish or English."],
        what: [
          "El tema de día y el de noche se quedan como los dejes, aunque refresques la pantalla.",
          "The day theme and the night theme stay as you left them, even if you refresh.",
        ],
        how: [
          "En Ajustes, Pantalla, elige un tema de día y uno de noche.\nAutomático cambia según la hora: noche antes de las 6:30 de la mañana y desde las 6:30 de la tarde.\nEl botón sol/luna de arriba cambia a mano entre los dos.\nIdioma: Español (el de siempre) o English; cambia los textos y el corrector del bloc.",
          "In Settings, Screen, pick a day theme and a night theme.\nAutomatic follows the hour: night before 6:30 in the morning and from 6:30 in the evening.\nThe sun/moon button on top switches between them by hand.\nLanguage: Spanish (the default) or English; it changes the text and the pad's spellcheck.",
        ],
        calc: [
          "De día: Jardín, Costa, Barro, Pino, Cielo, Lima, Arena y Flor. De noche: Noche, Medianoche, Ciruela, Grafito, Luciérnaga y AMOLED (negro puro, ahorra batería en pantallas OLED).",
          "Day: Garden, Coast, Clay, Pine, Sky, Lime, Sand, and Bloom. Night: Night, Midnight, Plum, Graphite, Firefly, and AMOLED (pure black, saves battery on OLED screens).",
        ],
        example: [
          "Trabajas al sol de 8 a 5: Arena de día se lee bien con brillo alto. De noche, revisando cobros en la cama, AMOLED no te encandila. Con Automático no tocas nada: a las 6:30 de la tarde cambia solo.",
          "You work in the sun 8 to 5: Sand by day reads well at high brightness. At night, checking payments in bed, AMOLED won't glare. With Automatic you touch nothing: at 6:30 pm it switches itself.",
        ],
        cases: [
          "Cambias el idioma en la pantalla de Entrar: esa elección queda guardada.\nLos datos que escribiste (nombres, notas) no se traducen.",
          "You change the language on the sign-in screen: that choice is kept.\nWhat you typed (names, notes) is not translated.",
        ],
        related: ["clima", "busca"],
        go: { to: "/ajustes", focus: "aj-pantalla", where: ["Ajustes, Pantalla", "Settings, Screen"] },
        terms: [["Automático", "Automatic"], ["AMOLED", "AMOLED"], ["Colores", "Colors"], ["Idioma", "Language"], ["English", "Español"]],
      },
      {
        id: "tableta",
        title: ["Modo tableta", "Tablet mode"],
        sum: ["Dos pantallas a la vez y una ventana flotante.", "Two screens at once and a floating window."],
        what: [
          "Parte la pantalla en dos y añade una ventana flotante. Lo que hagas en una se ve al momento en las otras.",
          "Splits the screen in two and adds a floating window. What you do in one shows up at once in the others.",
        ],
        how: [
          "Actívalo en Ajustes, Modo tableta.\nEn tableta o computadora, el botón Vista de la barra izquierda (justo antes de Ajustes) elige 1 pantalla, Lado a lado o Arriba y abajo.\nLa barra del medio reparte el espacio; doble toque la centra.\nLas pestañas de la izquierda cambian la pantalla que tocaste por última vez.\nLa ventana flotante se mueve, se agranda y se pliega en una burbuja.",
          "Turn it on in Settings, Tablet mode.\nOn a tablet or computer, the View button in the left rail (just before Settings) picks 1 screen, Side by side, or Top and bottom.\nThe middle bar shares the space; double-tap centers it.\nThe tabs on the left change the screen you touched last.\nThe floating window moves, resizes, and folds into a bubble.",
        ],
        example: [
          "Cobrando el viernes: a la izquierda Cobros, a la derecha la ficha del cliente. Marcas Pagado en la ficha y Por cobrar baja al instante en la otra mitad. La calculadora flotante queda arriba para sumar los billetes.",
          "Collecting Friday: Payments on the left, the client file on the right. You mark Paid on the file and To collect drops at once in the other half. The floating calculator stays on top to add up the bills.",
        ],
        cases: [
          "Apagado: las pantallas siguen de una en una.\nEn el teléfono: se parte arriba y abajo.\nCambiar de lugar intercambia las dos mitades.",
          "Off: screens show one at a time.\nOn a phone: it splits top and bottom.\nSwap places switches the two halves.",
        ],
        related: ["vistas", "notas"],
        go: { to: "/ajustes", focus: "aj-tableta", where: ["Ajustes, Modo tableta", "Settings, Tablet mode"] },
        terms: [["Ventana flotante", "Floating window"], ["Vista", "View"], ["Lado a lado", "Side by side"]],
      },
      {
        id: "recordatorios",
        title: ["Recordatorios", "Reminders"],
        sum: ["Avisos al abrir la app.", "Alerts when you open the app."],
        what: [
          "Avisos cuando abres la app: cortes atrasados y la hora de llegada de cada patio.",
          "Alerts when you open the app: late cuts and each yard's arrival time.",
        ],
        how: [
          "Actívalos en Ajustes, Recordatorios, y acepta el permiso de avisos del teléfono.\nElige con cuánto tiempo antes avisar (1 hora de siempre).\nLos avisos salen mientras Brizna está abierta.",
          "Turn them on in Settings, Reminders, and accept the phone's notification permission.\nChoose how long before to alert (1 hour by default).\nAlerts show while Brizna is open.",
        ],
        calc: [
          "Atrasados: un aviso por día con cuántos cortes van tarde (vuelve a avisar si el número cambia).\nPatios de hoy: cada uno avisa una vez, desde su hora de llegada menos el tiempo elegido hasta 15 minutos después. Un patio sin hora avisa al abrir.",
          "Late: one alert a day with how many cuts are late (it alerts again if the number changes).\nToday's yards: each alerts once, from its arrival time minus the chosen lead until 15 minutes after. A yard with no time alerts on open.",
        ],
        example: [
          "El patio de Carmen tiene llegada a las 12:00 y avisas 1 hora antes. Abres Brizna a las 11:10: sale Carmen, Llegada 12:00 y su dirección. A las 11:40 no vuelve a salir, ya avisó.",
          "Carmen's yard has a 12:00 arrival and you alert 1 hour ahead. You open Brizna at 11:10: Carmen, Arrival 12:00, and her address appear. At 11:40 it does not repeat; it already alerted.",
        ],
        cases: [
          "Negaste el permiso: no sale nada; actívalo en los ajustes del teléfono.\nBrizna cerrada: no hay aviso hasta que la abras.",
          "You denied permission: nothing shows; turn it on in the phone's settings.\nBrizna closed: no alert until you open it.",
        ],
        related: ["hoy", "nombre-negocio"],
        go: { to: "/ajustes", focus: "aj-recordatorios", where: ["Ajustes, Recordatorios", "Settings, Reminders"] },
        terms: [["Avisos", "Alerts"]],
      },
      {
        id: "exportar",
        title: ["Exportar e imprimir", "Export and print"],
        sum: ["Un informe en PDF, hoja de cálculo o papel.", "A report as a PDF, a worksheet, or on paper."],
        what: [
          "Elige qué entra, de qué fechas y de qué clientes. Sale en PDF, en hoja de cálculo o a la impresora.",
          "Choose what goes in, which dates, and which clients. It comes out as a PDF, a worksheet, or to the printer.",
        ],
        how: [
          "Empieza con un atajo (también desde el icono de impresora de la barra izquierda en tableta).\nElige fechas: esta semana, este mes, mes pasado, este año, año pasado, todo o fechas a mano.\nMarca las secciones y los clientes.\nEn Privacidad: oculta teléfonos, deja solo iniciales o quita los montos.\nSaca PDF, Hoja (XLSX), Imprimir o Compartir.",
          "Start with a shortcut (also from the printer icon in the left rail on a tablet).\nPick dates: this week, this month, last month, this year, last year, all, or your own dates.\nCheck the sections and clients.\nIn Privacy: hide phone numbers, show initials only, or drop the amounts.\nGet a PDF, Sheet (XLSX), Print, or Share.",
        ],
        calc: [
          "Todo: cada sección y cada cliente, todas las fechas.\nCobros y deudas: resumen, quién debe y pagos del mes.\nAgenda semanal: la ruta de la semana y los 7 días siguientes, con notas.\nResumen del mes: cifras, pagos, trabajos, horas, propinas, pospuestos y Asesor, sin teléfonos.\nClientes: directorio con precios, sin archivados.\nPara el contador: el año pasado, con pagos, propinas y trabajos, sin teléfonos.\nSi cambias una casilla, el atajo pasa a A medida.",
          "Everything: every section and client, all dates.\nPayments & debts: summary, who owes, and the month's payments.\nThis week's route: the week's route and the next 7 days, with notes.\nMonth summary: figures, payments, jobs, hours, tips, postponed, and Advisor, without phones.\nClients: a directory with prices, no archived clients.\nFor the CPA: last year, with payments, tips, and jobs, without phones.\nChange any box and the shortcut becomes Custom.",
        ],
        example: [
          "En febrero tu contador pide los números del año: Para el contador, Hoja (XLSX). En la hoja filtra y suma ingresos por mes y propinas aparte. Para tu ayudante sacas Agenda semanal con Quitar montos: ve la ruta pero no cuánto cobras.",
          "In February your CPA asks for the year's numbers: For the CPA, Sheet (XLSX). In the sheet they filter and sum income by month with tips apart. For your helper you print This week's route with amounts off: the route, not what you charge.",
        ],
        related: ["copia", "nombre-negocio", "propina"],
        go: { to: "/ajustes", focus: "aj-exportar", where: ["Ajustes, Exportar e imprimir", "Settings, Export and print"] },
        terms: [["PDF", "PDF"], ["XLSX", "XLSX"], ["Hoja de cálculo", "Worksheet"], ["Privacidad", "Privacy"], ["Para el contador", "For the CPA"], ["Compartir", "Share"], ["Informe", "Report"], ["A medida", "Custom"]],
      },
      {
        id: "copia",
        title: ["Copia de seguridad", "Backup"],
        sum: ["Un respaldo de tus clientes y trabajos.", "A backup of your clients and jobs."],
        what: [
          "Guarda un respaldo de tus clientes, trabajos y pagos. Restaurar reemplaza lo de ahora por esa copia.",
          "Keeps a backup of your clients, jobs, and payments. Restore replaces what is there now with that copy.",
        ],
        how: [
          "Se guarda sola cuando cambias datos y antes de cosas delicadas (borrar un cliente, restaurar).\nGuardar copia hace una al momento.\nGuardar archivo descarga una copia al teléfono o la computadora.\nElegir carpeta guarda ahí las copias y deja las 5 más recientes.\nRestaurar pide confirmar y primero guarda lo que hay ahora.",
          "It saves itself when data changes and before delicate actions (deleting a client, restoring).\nSave copy makes one right now.\nSave file downloads a copy to the phone or computer.\nChoose folder saves copies there and keeps the 5 most recent.\nRestore asks to confirm and first saves what is there now.",
        ],
        calc: [
          "Una copia automática como mucho cada 10 minutos. Se conservan las 8 más recientes, una por día de la última semana y una por semana del último mes. Las copias llevan una suma de control: si un archivo se dañó, Brizna lo nota antes de usarlo.",
          "At most one automatic copy every 10 minutes. It keeps the 8 most recent, one per day for the last week, and one per week for the last month. Copies carry a checksum: if a file got damaged, Brizna notices before using it.",
        ],
        example: [
          "El martes borras sin querer a los Rivera, con dos años de historial. Abres Copia de seguridad, eliges la copia de justo antes de las 3:12 y Restaurar: los Rivera vuelven con todo, y lo que había a las 3:15 también quedó guardado por si acaso.",
          "Tuesday you accidentally delete the Riveras, with two years of history. You open Backup, pick the copy from right before 3:12, and Restore: the Riveras are back with everything, and what you had at 3:15 was saved too, just in case.",
        ],
        cases: [
          "Restauras una copia vieja: lo hecho después se pierde de la app, pero queda en la copia que se guardó antes de restaurar.\nCambios en dos equipos a la vez: las dos versiones se guardan aquí y eliges cuál queda.",
          "You restore an old copy: what happened after is gone from the app, but it stays in the copy saved before restoring.\nChanges on two devices at once: both versions are saved here and you pick which one stays.",
        ],
        mistake: [
          "Restaurar para deshacer un solo toque: para eso usa Deshacer; restaurar cambia todo.",
          "Restoring to undo a single tap: use Undo for that; restoring changes everything.",
        ],
        related: ["nube", "ejemplo", "exportar"],
        go: { to: "/ajustes", focus: "aj-copia", where: ["Ajustes, Copia de seguridad", "Settings, Backup"] },
        terms: [["Restaurar", "Restore"], ["Respaldo", "Backup"]],
      },
      {
        id: "nube",
        title: ["Nube y sesión", "Cloud and session"],
        sum: ["Tus datos también fuera del teléfono, y cómo sigues dentro.", "Your data also off the phone, and how you stay signed in."],
        what: [
          "Tu cuenta y tus clientes quedan en la nube y en este equipo. Sin internet, los cambios se suben al volver la conexión.",
          "Your account and clients stay in the cloud and on this device. Offline, changes upload when the connection returns.",
        ],
        how: [
          "Todo se guarda primero en el equipo, así la app va rápida y funciona sin internet.\nUnos segundos después de un cambio, se sube a la nube.\nEl recuadro Nube dice si todo está guardado y tiene Sincronizar ahora.\nAl cambiar de teléfono, entra con tu cuenta y todo vuelve.\nEn Entrar, Mantener sesión abierta te deja dentro hasta que cierres sesión; sin marcar, la sesión acaba al salir de la app.",
          "Everything saves on the device first, so the app is fast and works offline.\nA few seconds after a change, it uploads to the cloud.\nThe Cloud card says whether everything is saved and has Sync now.\nWhen you change phones, sign in with your account and everything comes back.\nOn Sign in, Keep me signed in keeps you in until you sign out; without it, you are signed out each time you leave the app.",
        ],
        calc: [
          "Si este equipo y la nube cambiaron a la vez (por ejemplo, tableta sin internet y teléfono con internet), Brizna no pisa nada: guarda las dos versiones en Copia de seguridad y pregunta Cambios en dos lugares. Eliges Quedarme con este equipo o Usar lo de la nube. Si cierras el aviso, vuelve en 10 minutos y nada se sobrescribe mientras tanto.\nSi tu otro equipo tiene una Brizna más nueva, pide actualizar antes de recibir sus cambios.",
          "If this device and the cloud both changed (say, a tablet offline and a phone online), Brizna overwrites nothing: it saves both versions in Backup and asks Changes in two places. You choose Keep this device's or Use the cloud's. Close the notice and it returns in 10 minutes, with nothing overwritten meanwhile.\nIf your other device runs a newer Brizna, it asks you to update before taking its changes.",
        ],
        example: [
          "Sábado en un barrio sin señal: marcas 9 Hecho en el teléfono. Al llegar a casa, con wifi, se suben solos. El domingo abres la tableta y los 9 ya están ahí.",
          "Saturday in an area with no signal: you mark 9 Done on the phone. At home, on wifi, they upload on their own. Sunday you open the tablet and the 9 are already there.",
        ],
        cases: [
          "Cierras sesión: tus datos siguen en la nube; entras otra vez con el mismo correo.\nUn equipo nuevo con datos y una nube vacía: Brizna no borra el equipo; sube lo suyo.",
          "You sign out: your data stays in the cloud; sign in again with the same email.\nA new device with data and an empty cloud: Brizna never wipes the device; it uploads its own.",
        ],
        related: ["copia", "huella"],
        go: { to: "/ajustes", focus: "aj-nube", where: ["Ajustes, al final", "Settings, at the end"] },
        terms: [["Sincronizar", "Sync"], ["Sin internet", "Offline"], ["Sesión", "Session"], ["Cerrar sesión", "Sign out"], ["Mantener sesión abierta", "Keep me signed in"], ["Cambios en dos lugares", "Changes in two places"]],
      },
      {
        id: "huella",
        title: ["Huella", "Fingerprint"],
        sum: ["Pide tu huella o tu cara al abrir.", "Asks for your fingerprint or face when opening."],
        what: [
          "Pide tu huella o tu cara al abrir Brizna en este equipo. Funciona sin internet.",
          "Asks for your fingerprint or face when you open Brizna on this device. It works offline.",
        ],
        how: [
          "Actívala en Ajustes, Huella; el teléfono te pide la huella una vez para registrarla.\nElige cuánto tiempo fuera antes de pedirla otra vez: 5 min, 30 min, 1 h, 4 h o 12 h.\nPara apagarla, desactívala en el mismo lugar.",
          "Turn it on in Settings, Fingerprint; the phone asks for your fingerprint once to register it.\nChoose how long away before it asks again: 5 min, 30 min, 1 hr, 4 hr, or 12 hr.\nTo turn it off, switch it off in the same place.",
        ],
        calc: [
          "Cuenta el tiempo desde la última vez que usaste Brizna desbloqueada. Si pasaste fuera menos que el tiempo elegido (1 h de siempre), no la pide. La comprobación ocurre en el teléfono; nada se envía.",
          "It counts from the last time you used Brizna unlocked. If you were away for less than the chosen time (1 hour by default), it does not ask. The check happens on the phone; nothing is sent.",
        ],
        example: [
          "Con 1 h: contestas una llamada de 20 minutos y vuelves: entra directo. Dejas el teléfono en la camioneta toda la mañana: al abrir, pide la huella, así nadie ve tus cobros.",
          "With 1 hour: you take a 20-minute call and come back: straight in. You leave the phone in the truck all morning: on opening it asks for your fingerprint, so nobody sees your payments.",
        ],
        cases: [
          "Tu teléfono no tiene huella ni cara: no se puede activar.\nEs por equipo: en la tableta se activa aparte.",
          "Your phone has no fingerprint or face unlock: it cannot be turned on.\nIt is per device: on the tablet you turn it on separately.",
        ],
        related: ["nube"],
        go: { to: "/ajustes", focus: "aj-huella", where: ["Ajustes, Huella", "Settings, Fingerprint"] },
        terms: [["Desbloqueo", "Unlock"], ["Bloqueo", "Lock"]],
      },
      {
        id: "ajustes-usuales",
        title: ["Ajustes rápidos", "Quick settings"],
        sum: ["Tres atajos para dejar todo listo.", "Three shortcuts to set things up."],
        what: [
          "Tres atajos que dejan varios ajustes listos de un toque: Semana normal, Cobro corto e Invierno lento.",
          "Three shortcuts that set several settings in one tap: Normal week, Short collection, and Slow winter.",
        ],
        how: [
          "En Ajustes, Manual, debajo de Abrir el manual.\nUn toque guarda los valores al momento.\nDespués puedes ajustar cada número a mano en su lugar.",
          "In Settings, Manual, below Open the manual.\nOne tap saves the values at once.\nAfterwards you can tune each number by hand in its own place.",
        ],
        calc: [
          "Semana normal: entrada 8:00, salida 5:30, En espera a los 45 días, alto riesgo 21 días después, o con $200, o 3 cortes sin pagar.\nCobro corto: En espera a los 21 días, alto riesgo 10 días después, o con $100, o 2 cortes sin pagar.\nInvierno lento: temporada del 11-01 al 02-28 cada 21 días y la agenda armada a 12 meses.",
          "Normal week: clock-in 8:00, clock-out 5:30, Waiting at 45 days, high risk 21 days later, or at $200, or 3 unpaid cuts.\nShort collection: Waiting at 21 days, high risk 10 days later, or at $100, or 2 unpaid cuts.\nSlow winter: season from 11-01 to 02-28 every 21 days and the schedule built 12 months out.",
        ],
        example: [
          "Tienes clientes que se estiran mucho. Tocas Cobro corto: quien no paga en 21 días pasa a En espera, y a los 31 o al llegar a $100 se pone naranja. Llega noviembre y tocas Invierno lento: tus semanales pasan a cada 21 días hasta marzo.",
          "Some clients stretch it out. You tap Short collection: anyone unpaid for 21 days becomes Waiting, and at 31 days or $100 they turn orange. November comes and you tap Slow winter: weekly clients go to every 21 days until March.",
        ],
        related: ["espera", "temporada", "horas"],
        go: { to: "/ajustes", focus: "aj-manual", where: ["Ajustes, Manual", "Settings, Manual"] },
        terms: [["Semana normal", "Normal week"], ["Cobro corto", "Short collection"], ["Invierno lento", "Slow winter"]],
      },
    ],
  },
];

/* ------------------------------------------------------------------ hint-only (?) bubbles */

/**
 * Bubbles whose topic had nothing more to say on its own page. Each keeps its own short sentence;
 * "Más en el manual" opens the richer topic named in `into`, where its detail now lives.
 */
export const HINT_ONLY: HintOnly[] = [
  {
    id: "desplegar-hoy",
    into: "hoy",
    what: ["Abre o cierra de una vez los bloques de Hoy, atrasados y los días que siguen.", "Opens or closes Today, late jobs, and the coming days all at once."],
  },
  {
    id: "sin-confirmacion",
    into: "hecho",
    what: [
      "En Hoy, si marcas esta casilla y haces click en Hecho, no te pedirá confirmación adicional. Mañana vuelve a funcionar normal.",
      "On Today, if you check this box and tap Done, it won't ask for extra confirmation. Tomorrow it works normally again.",
    ],
  },
  {
    id: "sonidos",
    into: "todos",
    what: ["Un ding corto al cerrar el día y uno más bajito en cada Hecho. Se apagan o se bajan aquí.", "A short ding when the day closes and a softer one on each Done. Turn them off or down here."],
  },
  {
    id: "agenda-dia",
    into: "parar-dia",
    what: ["La razón por la que no se siguió trabajando en esta fecha. Si el día fue normal, no aparece.", "Why work did not continue on this date. If the day was normal, it does not show."],
  },
  {
    id: "dias-parados",
    into: "parar-dia",
    what: ["Días en los que paraste el trabajo y la razón que quedó guardada.", "Days you stopped work and the reason that was saved."],
  },
  {
    id: "pospuesto",
    into: "parar-dia",
    what: ["Últimos 90 días. Cuenta los patios movidos con una razón.", "Last 90 days. Counts yards moved with a reason."],
  },
  {
    id: "pasar-atrasado",
    into: "pasar-pendientes",
    what: [
      "Pasa los patios que ya iban tarde al día que elijas. No se marcan Hecho ni se cobra nada.",
      "Moves the yards that were already late to the day you choose. They are not marked Done and nothing is collected.",
    ],
  },
  {
    id: "trabajo-acumulado",
    into: "pasar-pendientes",
    what: ["Lo que quedó sin hacer, para pasarlo junto a mañana o a otra fecha.", "What was left undone, to move it together to tomorrow or another date."],
  },
  {
    id: "inventario",
    into: "clientes-filtros",
    what: [
      "[[Permanentes]] cada semana, [[Una vez]] no se repite, [[Juntos]] los dos y [[Archivos]] dados de baja.",
      "[[Regular]] every week, [[One-time]] does not repeat, [[Together]] both, and [[Archive]] taken off.",
    ],
  },
  {
    id: "pista",
    into: "lista-clientes",
    what: ["Algo corto para distinguir este patio si hay otro con el mismo nombre. Se ve en la lista.", "Something short to tell this yard apart from another with the same name. It shows on the list."],
  },
  {
    id: "direccion",
    into: "lista-clientes",
    what: ["Si hay dirección, un toque abre el mapa para llegar al patio.", "If there is an address, one tap opens the map to reach the yard."],
  },
  {
    id: "altas-bajas",
    into: "archivo",
    what: ["Altas: patios que añadiste ese mes. Bajas: clientes que diste de baja ese mes.", "New: yards you added that month. Departures: clients you took off that month."],
  },
  {
    id: "una-vez",
    into: "tipo-cliente",
    what: ["Toca una opción frecuente para llenar el texto, o escribe otra.", "Tap a frequent option to fill the text, or type another."],
  },
  {
    id: "cada-cuantos",
    into: "frecuencia",
    what: ["Un ritmo a tu medida: la app arma los cortes con este intervalo desde el día de inicio.", "A pace of your own: the app builds cuts at this interval from the start day."],
  },
  {
    id: "dia-inicio",
    into: "frecuencia",
    what: ["El primer corte es este día. El resto cae solo, según la frecuencia.", "The first cut is this day. The rest follow on their own, by the frequency."],
  },
  {
    id: "paga-mismo-dia",
    into: "cobro-cliente",
    what: [
      "Vacía: cada corte suma el precio a lo que debe. Marcada: cobras al marcar Hecho y ese corte no se suma.",
      "Empty: each cut adds its price to what they owe. Checked: you collect on Done and that cut is not added.",
    ],
  },
  {
    id: "en-cada-visita",
    into: "notas-cliente",
    what: ["Sale en la tarjeta de cada corte, sin crear un trabajo extra. Ejemplo: orilla, soplado, perro suelto.", "It shows on each cut card without creating an extra job. Example: edging, blowing, loose dog."],
  },
  {
    id: "temporada-cliente",
    into: "temporada",
    what: [
      "Otro ritmo para este patio en una parte del año. Si lo dejas apagado, vale la temporada de todos.",
      "A different pace for this yard in part of the year. If you leave it off, everyone's season applies.",
    ],
  },
  {
    id: "dia-casi-nunca",
    into: "dias-libres",
    what: ["Suele ser el domingo. La agenda automática no pone cortes regulares ahí.", "Usually Sunday. The automatic schedule puts no regular cuts there."],
  },
  {
    id: "abonado",
    into: "por-cobrar",
    what: ["Quien dejó una parte y todavía debe. Si paga toda la deuda, sale de aquí.", "Someone who paid part and still owes. If they pay the whole debt, they leave this list."],
  },
  {
    id: "trabajo-hecho",
    into: "cobrado",
    what: [
      "Suma el precio de los patios ya terminados, hayan pagado o no. El dinero en mano está en Cobrado.",
      "Adds up the price of finished yards, paid or not. Cash in hand is under Collected.",
    ],
  },
  {
    id: "en-espera",
    into: "espera",
    what: [
      "Quien se atrasó y va a pagar, o a quien pausaste mientras baja la deuda. El dinero no sale de Por cobrar.",
      "Someone who fell behind and will pay, or someone you paused while the debt goes down. The money stays in To collect.",
    ],
  },
  {
    id: "propinas",
    into: "propina",
    what: ["Dinero de más que no cambia la deuda. Arriba, lo de este año; las barras, los últimos 12 meses.", "Extra money that does not change the debt. On top, this year; the bars, the last 12 months."],
  },
  {
    id: "esfuerzo",
    into: "meta-mes",
    what: ["Toca un día para poner su meta de patios. La meta se mantiene ese día en las semanas siguientes.", "Tap a day to set its yard goal. The goal stays for that weekday in later weeks."],
  },
  {
    id: "orden-cifras",
    into: "estudio",
    what: ["Sube o baja cada bloque. Guardar pregunta antes; Cancelar no cambia nada.", "Moves each block up or down. Save asks first; Cancel changes nothing."],
  },
  {
    id: "esta-semana",
    into: "notas",
    what: ["Toca un día para ver sus patios. Hoy va primero y después los seis días siguientes.", "Tap a day to see its yards. Today comes first, then the next six days."],
  },
  {
    id: "calculadora",
    into: "notas",
    what: ["Saca la cuenta sola. En la nota la escribe en la nota.", "Works out the amount on its own. Into note writes it into the note."],
  },
  {
    id: "fijar",
    into: "fichero",
    what: ["Fijar muestra la nota en Hoy como recordatorio.", "Pin shows the note on Today as a reminder."],
  },
  {
    id: "cielo",
    into: "clima",
    what: ["El fondo muestra el tiempo de ahora. Es solo un fondo; no cambia tus datos.", "The background shows the weather now. It is only a background; it does not change your data."],
  },
  {
    id: "ajustes",
    into: "busca",
    what: ["Abre o cierra de una vez todos los ajustes de esta página.", "Opens or closes every setting on this page at once."],
  },
  {
    id: "idioma",
    into: "tema",
    what: ["Español es el idioma de siempre. English cambia los textos de la app y el corrector del bloc.", "Spanish is the default. English changes the app text and the notepad spellcheck."],
  },
  {
    id: "sesion",
    into: "nube",
    what: [
      "Mantener sesión abierta te deja dentro hasta que cierres sesión. Vacía, la sesión acaba al salir de la app.",
      "Keep me signed in keeps you in until you sign out. Unchecked, the session ends when you leave the app.",
    ],
  },
];

/* ------------------------------------------------------------------ lookups */

export type Numbered = Topic & { num: string; chapter: Chapter; chapterNum: number };

export const MANUAL_TOPICS: Numbered[] = MANUAL_CHAPTERS.flatMap((chapter, ci) =>
  chapter.topics.map((topic, ti) => ({ ...topic, num: `${ci + 1}.${ti + 1}`, chapter, chapterNum: ci + 1 })),
);

const BY_ID = new Map(MANUAL_TOPICS.map((t) => [t.id, t]));
const HINT_BY_ID = new Map(HINT_ONLY.map((h) => [h.id, h]));

/** Older manual ids (links saved before 1.4.2) and their entry now. */
const ALIASES: Record<string, string> = {
  "cobros-por-cobrar": "por-cobrar",
  "cobros-abonado": "abonado",
  "cobros-perdonar": "perdonado",
  "cobros-corriente": "por-cobrar",
  cobros: "por-cobrar",
  fiabilidad: "quien-debe",
  "alto-riesgo": "espera",
  "propina-anio": "propinas",
  "propina-mes": "propinas",
  "cifras-vida-dinero": "cada-anio",
  "cifras-vida-patios": "cada-anio",
  "cifras-asesor": "asesor",
  "cifras-orden": "orden-cifras",
  cifras: "estudio",
  lluvia: "parar-dia",
  "notas-etiquetas": "fichero",
  "notas-agenda": "fijar",
  clientes: "clientes-filtros",
  ritmo: "estudio",
};

/** The manual page for an id: a topic, a merged (?) id, or an old alias. */
export function findTopic(id: string | undefined | null): Numbered | null {
  if (!id) return null;
  const key = BY_ID.has(id) || HINT_BY_ID.has(id) ? id : (ALIASES[id] ?? id);
  return BY_ID.get(key) ?? BY_ID.get(HINT_BY_ID.get(key)?.into ?? "") ?? null;
}

export type HintEntry = {
  /** The (?) id itself (stays on the element, for focus). */
  id: string;
  what: L;
  whatAlt?: L;
  /** The manual topic "Más en el manual" opens. */
  topic: Numbered;
};

/** What a (?) shows: its own sentence, and the manual page it leads to. */
export function findHint(id: string | undefined | null): HintEntry | null {
  if (!id) return null;
  const key = BY_ID.has(id) || HINT_BY_ID.has(id) ? id : (ALIASES[id] ?? id);
  const own = BY_ID.get(key);
  if (own) return { id: key, what: own.what, whatAlt: own.whatAlt, topic: own };
  const hint = HINT_BY_ID.get(key);
  const topic = hint ? BY_ID.get(hint.into) : undefined;
  return hint && topic ? { id: key, what: hint.what, whatAlt: hint.whatAlt, topic } : null;
}

export function pick(locale: string, pair: L): string {
  return locale === "en" ? pair[1] : pair[0];
}

/** The manual body of a topic (everything the page shows under its one-line summary), in order. */
export function topicBody(topic: Topic): L[] {
  return [topic.how, topic.calc, topic.example, topic.cases, topic.mistake].filter(Boolean) as L[];
}

/** Plain text of a topic for search: title, summary, body, words, and the bubble texts that lead here. */
export function topicText(topic: Topic, locale: string): string {
  const bubbles = HINT_ONLY.filter((h) => h.into === topic.id).flatMap((h) => [h.what, h.whatAlt]);
  const parts = [topic.title, topic.sum, ...topicBody(topic), topic.what, topic.whatAlt, ...bubbles, ...(topic.terms ?? [])]
    .filter(Boolean)
    .map((pair) => pick(locale, pair as L));
  return parts.join(" ").replace(/\[\[|\]\]/g, "");
}

export type IndexTerm = { term: string; topics: Numbered[] };

/** Alphabetical index: every title and every listed term, one line per word, sorted the Spanish way. */
export function alphaIndex(locale: string): { letter: string; items: IndexTerm[] }[] {
  const byTerm = new Map<string, IndexTerm>();
  for (const topic of MANUAL_TOPICS) {
    const title = pick(locale, topic.title);
    for (const pair of [topic.title, ...(topic.terms ?? [])]) {
      const term = pick(locale, pair);
      // a word that only repeats the start of its own title adds nothing
      if (pair !== topic.title && title.toLowerCase().startsWith(term.toLowerCase())) continue;
      const key = term.toLowerCase();
      const row = byTerm.get(key) ?? { term, topics: [] };
      if (!row.topics.includes(topic)) row.topics.push(topic);
      byTerm.set(key, row);
    }
  }
  const all = [...byTerm.values()];
  for (const row of all) row.topics.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
  const coll = new Intl.Collator(locale === "en" ? "en" : "es", { sensitivity: "base", ignorePunctuation: true });
  const lead = (s: string) => s.replace(/^[¿¡$@"'(\s]+/, "");
  all.sort((a, b) => coll.compare(lead(a.term), lead(b.term)));
  const groups: { letter: string; items: IndexTerm[] }[] = [];
  for (const item of all) {
    const first = lead(item.term).charAt(0).toLocaleUpperCase(locale === "en" ? "en" : "es");
    const letter = /[0-9]/.test(first) ? "#" : first === "Ñ" ? "Ñ" : first.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "#";
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.items.push(item);
    else groups.push({ letter, items: [item] });
  }
  return groups;
}
