/**
 * Brizna manual: the single source of truth for every (?) hint and every manual entry.
 *
 * A hint shows `what` of its topic, word for word. The manual shows the same `what`
 * under "Qué es", so the two can never disagree. Each pair is [español, English].
 *
 * Writing rules: plain, short sentences. One-line `sum` first. Never name other apps.
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
  /** One line: what this is for. Read first. */
  sum: L;
  /** What it is. This is also the exact text of the (?) bubble. */
  what: L;
  /** Second text, when the same (?) changes with the state (e.g. paused / not paused). */
  whatAlt?: L;
  how?: L;
  tip?: L;
  go?: Go;
  /** Extra words for the alphabetical index and the manual search. The title is always indexed. */
  terms?: L[];
};

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
          "Hoy es el día de trabajo. Hoy va primero y después siguen los seis días siguientes. Lo atrasado se queda arriba hasta que lo resuelvas.",
          "Today is the work day. Today comes first, then the next six days. Late yards stay at the top until you clear them.",
        ],
        how: [
          "Toca un patio para abrirlo. Marca Hecho al terminar. Lo atrasado sale arriba, en rojo.",
          "Tap a yard to open it. Mark Done when you finish. Late yards show at the top, in red.",
        ],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [["Atrasados", "Late"], ["Ruta", "Route"]],
      },
      {
        id: "vistas",
        title: ["Vistas", "Views"],
        sum: ["Cuánto detalle ves en cada tarjeta.", "How much detail each card shows."],
        what: [
          "Grande, Media, Lista y Malla cambian cuánto ves de cada patio. Cada pantalla recuerda la suya: Hoy, Clientes, Agenda, Cobros, la ficha y el Fichero no se pisan.",
          "Large, Medium, List, and Mesh change how much you see of each yard. Each screen remembers its own: Today, Clients, Schedule, Payments, the file, and the cabinet do not overwrite each other.",
        ],
        how: [
          "Malla empieza en 2 columnas. Otro toque pone 3, luego 4, y vuelve a 2. En 2 hay detalle y algunas acciones; en 4, solo el nombre. En Clientes, Lista pone el precio junto al nombre. En Cobros, Grande muestra el corte, el atraso y Perdonar.",
          "Mesh starts at 2 columns. Another tap gives 3, then 4, then back to 2. At 2 there is detail and some actions; at 4, only the name. In Clients, List puts the price next to the name. In Payments, Large shows the cut, the lateness, and Forgive.",
        ],
        tip: ["Usa Lista para cobrar rápido y Grande para revisar un caso.", "Use List to collect fast and Large to review one case."],
        go: { to: "/", where: ["Hoy, arriba de la lista", "Today, above the list"] },
        terms: [["Malla", "Mesh"], ["Grande", "Large"], ["Media", "Medium"], ["Lista", "List"]],
      },
      {
        id: "desplegar-hoy",
        title: ["Desplegar todo en Hoy", "Expand all on Today"],
        sum: ["Abre o cierra todos los bloques de Hoy de una vez.", "Opens or closes every block on Today at once."],
        what: [
          "Abre o cierra de una vez los bloques de Hoy, atrasados y los días que siguen.",
          "Opens or closes Today, late jobs, and the coming days all at once.",
        ],
        go: { to: "/", where: ["Hoy, arriba", "Today, at the top"] },
      },
      {
        id: "hecho",
        title: ["Hecho", "Done"],
        sum: ["Cierra un patio y dice si pagaron.", "Closes a yard and says whether they paid."],
        what: [
          "Hecho cierra un patio. Hay tres caminos: Hecho y cobrado (verde), Hecho y pendiente (rojo) y Hecho y abonado (amarillo).",
          "Done closes a yard. There are three paths: Done and paid (green), Done and unpaid (red), and Done with a partial payment (yellow).",
        ],
        how: [
          "Verde anota el pago de hoy en Cobrado. Rojo pasa el monto a Por cobrar. Amarillo anota solo una parte; el resto sigue por cobrar.",
          "Green records today's payment under Collected. Red moves the amount to To collect. Yellow records only part; the rest stays to collect.",
        ],
        tip: ["Si te dan de más, anótalo como propina: no cambia la deuda.", "If they give extra, record it as a tip: it does not change the debt."],
        go: { to: "/", where: ["Hoy, en cada patio", "Today, on each yard"] },
        terms: [["Hecho y cobrado", "Done and paid"], ["Hecho y pendiente", "Done and unpaid"], ["Hecho y abonado", "Done with a partial payment"]],
      },
      {
        id: "sin-confirmacion",
        title: ["Sin confirmación extra por hoy", "No extra confirmation for today"],
        sum: ["Marca Hecho sin la pregunta extra, solo hoy.", "Mark Done without the extra question, today only."],
        what: [
          "Solo vale para hoy. Mañana vuelve a pedir confirmación, para no marcar un patio por error.",
          "Only for today. Tomorrow it asks for confirmation again, so you do not mark a yard by mistake.",
        ],
        go: { to: "/", where: ["Hoy, debajo de los bloques", "Today, below the blocks"] },
      },
      {
        id: "todos",
        title: ["Todos: cerrar el día", "All: close the day"],
        sum: ["Al final del día, marca quién pagó en un solo paso.", "At day's end, mark who paid in one step."],
        what: [
          "Todos, al final del día, pregunta quién pagó y quién abonó entre los patios de hoy. El resto queda pendiente y entra en Cobros.",
          "All, at the end of the day, asks who paid and who left a partial among today's yards. The rest stay unpaid and go to Payments.",
        ],
        tip: ["No hace falta ir uno por uno si ya cerraste la ruta. Al terminar suena un ding suave.", "No need to go one by one once the route is done. A soft ding plays when it finishes."],
        go: { to: "/", where: ["Hoy", "Today"] },
      },
      {
        id: "parar-dia",
        title: ["Parar el día", "Stop the day"],
        sum: ["Lluvia u otra razón: los pendientes pasan al siguiente día abierto.", "Rain or another reason: pending yards move to the next open day."],
        what: [
          "Parar por lluvia mueve los pendientes de hoy al siguiente día abierto. También puedes parar por médico, dentista u otra razón escrita a mano. Se guarda la hora exacta.",
          "Stop for rain moves today's pending yards to the next open day. You can also stop for a doctor, the dentist, or a reason you type. The exact time is saved.",
        ],
        tip: ["Estudio cuenta esos días en Días parados.", "Study counts those days under Stopped days."],
        go: { to: "/", where: ["Hoy", "Today"] },
        terms: [["Parar por lluvia", "Stop for rain"], ["Lluvia", "Rain"]],
      },
      {
        id: "pasar-pendientes",
        title: ["Pasar los pendientes de hoy", "Move today's pending yards"],
        sum: ["Mueve lo que falta de hoy a otro día.", "Moves what is left today to another day."],
        what: [
          "Pasa los patios de hoy que siguen pendientes al día que elijas. Los que ya marcaste Hecho se quedan. No se cobra al pasarlos. La razón, si la pones, queda en esa fecha.",
          "Moves today's yards that are still pending to the day you choose. Ones you already marked Done stay. Nothing is collected by moving them. The reason, if you add one, stays on that date.",
        ],
        go: { to: "/", where: ["Hoy", "Today"] },
      },
      {
        id: "pasar-atrasado",
        title: ["Pasar el trabajo atrasado", "Move the late work"],
        sum: ["Mueve todo lo atrasado a un día que elijas.", "Moves all the late work to a day you choose."],
        what: [
          "Pasa los patios que ya iban tarde al día que elijas. No se marcan Hecho ni se cobra. La razón, si la pones, queda en esa fecha.",
          "Moves the yards that were already late to the day you choose. They are not marked Done and nothing is collected. The reason, if you add one, stays on that date.",
        ],
        go: { to: "/", where: ["Hoy", "Today"] },
      },
      {
        id: "horas",
        title: ["Horas de trabajo", "Work hours"],
        sum: ["Tu entrada y salida, para saber cuánto ganas por hora.", "Your clock-in and clock-out, to know what you earn per hour."],
        what: ["Si no cambias la hora, queda el horario de Ajustes.", "If you do not change the time, the hours from Settings are used."],
        how: [
          "La entrada de siempre es 8:00 y la salida 5:30; se cambian en Ajustes. Desde Hoy, cambiar la hora pide confirmar: ahora, o el horario de siempre. Al final, Sí, trabajé esas horas confirma el día.",
          "The usual clock-in is 8:00 and clock-out 5:30; change them in Settings. From Today, changing the time asks you to confirm: now, or the usual hours. At the end, Yes, I worked those hours confirms the day.",
        ],
        tip: ["Solo las horas confirmadas cuentan para $ por hora.", "Only confirmed hours count for $ per hour."],
        go: { to: "/ajustes", focus: "aj-horas", where: ["Ajustes, Horas de trabajo", "Settings, Work hours"] },
        terms: [["Entrada", "Clock-in"], ["Salida", "Clock-out"]],
      },
      {
        id: "sonidos",
        title: ["Sonidos", "Sounds"],
        sum: ["Un ding suave al cerrar el día.", "A soft ding when you close the day."],
        what: [
          "Cuando Todos termina, suena un ding corto. Cada Hecho suena más bajito. En Ajustes, Sonidos, se apagan o se baja el volumen.",
          "When All finishes, a short ding plays. Each Done is quieter. In Settings, Sounds, you can turn them off or lower the volume.",
        ],
        go: { to: "/ajustes", focus: "aj-sonidos", where: ["Ajustes, Sonidos", "Settings, Sounds"] },
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
        title: ["Filtros de Clientes", "Client filters"],
        sum: ["Muestra un solo tipo de cliente.", "Shows one kind of client."],
        what: [
          "Sirven para ver un tipo de cliente: los de la ruta, los de cada semana, los que deben y los casos aparte.",
          "They show one kind of client: people on the route, weekly yards, people who still owe, and the special cases.",
        ],
        how: ["Toca el embudo y elige. Cada filtro trae su explicación.", "Tap the funnel and pick one. Each filter has its own explanation."],
        go: { to: "/clientes", where: ["Clientes, el embudo", "Clients, the funnel"] },
        terms: [["Activos", "Active"], ["Embudo", "Funnel"]],
      },
      {
        id: "inventario",
        title: ["Inventario de clientes", "Client inventory"],
        sum: ["Cuántos clientes tienes, por tipo.", "How many clients you have, by kind."],
        what: [
          "[[Permanentes]]: cada semana. [[Una vez]]: no se repite. [[Juntos]]: los dos. [[Archivos]]: dado de baja.",
          "[[Regular]]: every week. [[One-time]]: does not repeat. [[Together]]: both. [[Archive]]: taken off.",
        ],
        go: { to: "/clientes", focus: "inventario", where: ["Clientes, arriba", "Clients, at the top"] },
        terms: [["Permanentes", "Regular"], ["Archivos", "Archive"]],
      },
      {
        id: "lista-clientes",
        title: ["La lista de clientes", "The client list"],
        sum: ["Llamar, escribir o ir con un toque.", "Call, text, or go there in one tap."],
        what: [
          "Los iconos llaman, escriben o abren el mapa. Desliza a la izquierda para dar de baja o borrar.",
          "The icons call, text, or open the map. Swipe left to take them off or delete.",
        ],
        go: { to: "/clientes", focus: "lista-clientes", where: ["Clientes", "Clients"] },
      },
      {
        id: "archivo",
        title: ["Archivo", "Archive"],
        sum: ["Clientes que ya no atiendes, guardados aparte.", "Clients you no longer serve, kept apart."],
        what: [
          "Busca, ordena, selecciona uno o todos. Reactivar los vuelve a la agenda. Borrar es para siempre.",
          "Search, sort, select one or all. Reactivate puts them back on the schedule. Delete is forever.",
        ],
        go: { to: "/clientes", search: { filter: "inactive" }, where: ["Clientes, filtro Archivos", "Clients, Archive filter"] },
        terms: [["Reactivar", "Reactivate"], ["Dar de baja", "Take off"]],
      },
      {
        id: "tipo-cliente",
        title: ["Regular o de una vez", "Regular or one-time"],
        sum: ["Si el patio se repite o es un trabajo suelto.", "Whether the yard repeats or is a single job."],
        what: [
          "Regular: se corta cada cierto tiempo. De una vez: un trabajo suelto que no se repite.",
          "Regular: it is cut on a schedule. One-time: a single job that does not repeat.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, Tipo", "New client, Type"] },
      },
      {
        id: "una-vez",
        title: ["Patio de una vez", "One-time yard"],
        sum: ["Un trabajo suelto, con opciones rápidas.", "A single job, with quick options."],
        what: [
          "En ¿Qué hay que hacer? salen opciones frecuentes, como un corte o una limpieza. Tócalas para llenar el texto, o escribe otra.",
          "Under What needs doing? frequent options appear, such as a cut or a cleanup. Tap one to fill the text, or type another.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
      },
      {
        id: "deuda-anterior",
        title: ["Deuda anterior", "Earlier debt"],
        sum: ["Lo que ya te debía antes de usar la app.", "What they owed you before the app."],
        what: [
          "Lo que ya debía antes de entrar en la app, como $80 de cortes pasados. Queda en Por cobrar. Si no debe nada, déjalo vacío.",
          "What they already owed before joining the app, such as $80 from past cuts. It goes to To collect. If they owe nothing, leave it empty.",
        ],
        tip: ["En Estudio sale aparte, como Saldo inicial.", "In Study it shows apart, as Opening balance."],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
        terms: [["Saldo inicial", "Opening balance"]],
      },
      {
        id: "pista",
        title: ["Pista o referencia", "Cue or reference"],
        sum: ["Una palabra para no confundir dos patios.", "A word to tell two yards apart."],
        what: [
          "Algo corto para distinguir este patio si hay otro con el mismo nombre. Se ve en la lista, sin abrir la ficha.",
          "Something short to tell this yard apart if another has the same name. It shows on the list, without opening the file.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
      },
      {
        id: "direccion",
        title: ["Dirección", "Address"],
        sum: ["Un toque y el mapa te lleva.", "One tap and the map takes you there."],
        what: [
          "Si hay dirección, un toque abre Google Maps para llegar al patio.",
          "If there is an address, one tap opens Google Maps to reach the yard.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
        terms: [["Mapa", "Map"]],
      },
      {
        id: "frecuencia",
        title: ["Frecuencia", "Frequency"],
        sum: ["Cada cuánto se corta; la agenda se arma sola.", "How often it is cut; the schedule builds itself."],
        what: [
          "A partir del día de inicio la app arma sola los siguientes cortes.",
          "From the start day the app builds the next cuts on its own.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
      },
      {
        id: "cada-cuantos",
        title: ["Cada cuántos días", "Every how many days"],
        sum: ["Un ritmo a tu medida, en días.", "A pace of your own, in days."],
        what: [
          "La app arma sola los cortes futuros con este intervalo, a partir del día de inicio.",
          "The app builds future cuts on its own with this interval, starting from the start day.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, Frecuencia a medida", "New client, custom Frequency"] },
      },
      {
        id: "dia-inicio",
        title: ["Día de inicio", "Start day"],
        sum: ["El primer corte; el resto cae solo.", "The first cut; the rest follow."],
        what: [
          "El primer corte es este día. El resto cae solo, según la frecuencia, a partir de esa fecha.",
          "The first cut is this day. The rest fall on their own, by the frequency, from that date.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
      },
      {
        id: "en-cada-visita",
        title: ["En cada visita", "On each visit"],
        sum: ["Un recordatorio fijo en cada corte.", "A standing reminder on every cut."],
        what: [
          "Sale en la tarjeta de cada corte. No crea un trabajo extra. Ejemplo: orilla, soplado, perro suelto.",
          "It shows on each cut card. It does not create an extra job. Example: edging, blowing, loose dog.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente", "New client"] },
      },
      {
        id: "temporada-cliente",
        title: ["Temporada de un cliente", "A client's season"],
        sum: ["Otro ritmo para este patio en una parte del año.", "A different pace for this yard in part of the year."],
        what: [
          "Un tramo del año con otro ritmo. Mes y día, como 11-01 y 02-28. El número es cada cuántos días. Si lo dejas apagado, vale la temporada de todos en Ajustes.",
          "A stretch of the year with a different pace. Month and day, like 11-01 and 02-28. The number is every how many days. If you leave it off, the season for everyone in Settings applies.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, Temporada", "New client, Season"] },
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
          "Se acumula: cada corte suma a la cuenta y tú marcas Pagado cuando te pague. Paga el mismo día: al marcar Hecho, el cobro se registra solo.",
          "It adds up: each cut is added to the account and you mark Paid when they pay. Pays the same day: when you mark Done, the payment is recorded on its own.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, Cobro", "New client, Payment"] },
      },
      {
        id: "paga-mismo-dia",
        title: ["Paga el mismo día", "Pays the same day"],
        sum: ["Marcada: cobras al marcar Hecho. Vacía: la deuda crece.", "Checked: you collect on Done. Empty: the debt grows."],
        what: [
          "Si la casilla está vacía, cada corte suma el precio a lo que debe. La deuda se acumula. Si la marcas, cobras al marcar Hecho y ese corte no se suma.",
          "If the box is empty, each cut adds the price to what they owe. The debt piles up. If you check it, you collect when you mark Done and that cut is not added.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, varios a la vez", "New client, several at once"] },
      },
      {
        id: "notas-cliente",
        title: ["Notas del cliente", "Client notes"],
        sum: ["Portón, perro, llave: lo que hay que recordar.", "Gate, dog, key: what to remember."],
        what: [
          "Este bloc queda guardado con el contacto. Sirve para portón, perro, llave o lo que haya que recordar.",
          "This pad stays saved with the contact. Use it for a gate, a dog, a key, or anything to remember.",
        ],
        go: { to: "/nuevo", where: ["Nuevo cliente, al final", "New client, at the end"] },
      },
      {
        id: "ficha-deuda",
        title: ["Deuda, abono y adelanto", "Debt, partial, and advance"],
        sum: ["Lo que debe un cliente, y cómo lo baja.", "What a client owes, and how it goes down."],
        what: [
          "Deuda es el monto acumulado que te deben. Abono es un pago parcial. Adelanto es dinero pagado antes del corte: al marcar Hecho no se cobra otra vez. Toca Se acumula para que pague el mismo día.",
          "Debt is the amount they still owe you. Partial is a partial payment. Advance is money paid before the cut: when you mark Done it is not charged again. Tap It adds up so they pay the same day.",
        ],
        go: { to: "/clientes", where: ["La ficha del cliente, Deuda", "The client file, Debt"] },
        terms: [["Abono", "Partial"], ["Adelanto", "Advance"], ["Ficha", "Client file"]],
      },
      {
        id: "precio",
        title: ["Precio después de hecho", "Price after done"],
        sum: ["Corrige el precio de un corte ya hecho.", "Fix the price of a cut already done."],
        what: [
          "Ejemplo: el corte decía $40 y fueron $55. En el historial del cliente, toca el precio, escribe 55 y guarda. La cuenta sube $15.",
          "Example: the cut said $40 and it was $55. In the client history, tap the price, type 55, and save. The account goes up $15.",
        ],
        tip: ["Si el precio baja y la cuenta quedaría en negativo, lo que sobra pasa a adelanto.", "If the price drops and the balance would go below zero, the extra becomes an advance."],
        go: { to: "/clientes", where: ["La ficha del cliente, Historial", "The client file, History"] },
        terms: [["Historial", "History"]],
      },
      {
        id: "pausa",
        title: ["Pausa y Continuar", "Pause and Play"],
        sum: ["Deja quieto un patio mientras pagan.", "Holds a yard while they pay."],
        what: [
          "La función Pausa deja el patio quieto mientras pagan la deuda. No se agenda hasta que decidas Continuar.",
          "The Pause function holds the yard while they pay the debt. It is not scheduled until you choose Play.",
        ],
        whatAlt: [
          "En pausa: no hay cortes ni trabajos hasta que decidas Continuar. El caso vive en En espera.",
          "Paused: no cuts or jobs until you tap Play. The case lives in Waiting.",
        ],
        how: [
          "Toca las dos rayitas, en Por cobrar (Grande y Media) o en la ficha. Siempre hay una ventana de confirmación. Lo que debe se queda en Por cobrar.",
          "Tap the two bars, in To collect (Large and Medium) or on the file. There is always a confirmation window. What they owe stays in To collect.",
        ],
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
          "Calendario, Semana, Mes y Todo eligen el período. Pendiente, Tarde, Realizado, Pospuesto y Cancelado eligen el estado. Van juntos. Realizado con Semana es lo hecho esta semana. Con Mes, este mes. Con Todo, todo lo hecho. Con Calendario, esos días en el mes.",
          "Calendar, Week, Month, and All pick the period. Pending, Late, Done, Postponed, and Canceled pick the state. They work together. Done with Week is what was finished this week. With Month, this month. With All, everything finished. With Calendar, those days on the month.",
        ],
        tip: ["Pospuesto muestra los patios movidos y la razón de cada día.", "Postponed shows the moved yards and the reason for each day."],
        go: { to: "/agenda", focus: "agenda-controles", where: ["Agenda, arriba", "Schedule, at the top"] },
        terms: [["Calendario", "Calendar"], ["Pospuesto", "Postponed"], ["Realizado", "Done"]],
      },
      {
        id: "agenda-todo",
        title: ["Todo, con Pendiente", "All, with Pending"],
        sum: ["Lo que falta por hacer y lo que valdría.", "What is left to do and what it would be worth."],
        what: [
          "Son los patios pendientes de toda la agenda y la suma de lo que valen si se hacen. No es dinero ya cobrado. Cuántos clientes hay, y el dinero si cada uno pagara una vez, está en Clientes, en Activos, y con el detalle en Inventario de clientes.",
          "These are the pending yards on the whole schedule and what they are worth if they get done. It is not money already collected. How many clients there are, and the money if each paid once, is in Clients, under Active, and in detail in Client inventory.",
        ],
        go: { to: "/agenda", where: ["Agenda, Todo + Pendiente", "Schedule, All + Pending"] },
      },
      {
        id: "dias-libres",
        title: ["Días libres de esta semana", "Days off this week"],
        sum: ["Marca un día libre; sus patios se mueven solos.", "Mark a day off; its yards move on their own."],
        what: [
          "Son fechas concretas de esta semana y, al abrir, también los días que casi nunca se trabajan. Un toque pide la razón. Los patios de un día libre se pasan al siguiente día abierto. El domingo sigue libre, salvo un patio pospuesto a mano o un trabajo extra o de una vez.",
          "These are specific dates this week and, when open, also the days that are almost never worked. One tap asks for the reason. Yards on a day off move to the next open day. Sunday stays free, except a yard postponed by hand or an extra or one-time job.",
        ],
        go: { to: "/agenda", focus: "ag-libres", where: ["Agenda, Días libres", "Schedule, Days off"] },
      },
      {
        id: "dia-casi-nunca",
        title: ["Días que casi nunca se trabajan", "Days that are almost never worked"],
        sum: ["Tu día de descanso fijo, normalmente el domingo.", "Your fixed rest day, usually Sunday."],
        what: [
          "Suele ser el domingo. La agenda automática no pone cortes regulares ahí. Un patio pospuesto a mano, o un trabajo extra o de una vez, sí se queda y cuenta en las cifras.",
          "It is usually Sunday. The automatic schedule does not put regular cuts there. A yard postponed by hand, or an extra or one-time job, stays and counts in the figures.",
        ],
        go: { to: "/agenda", focus: "ag-libres", where: ["Agenda, Días libres", "Schedule, Days off"] },
        terms: [["Domingo", "Sunday"]],
      },
      {
        id: "trabajo-acumulado",
        title: ["Trabajo acumulado", "Accumulated work"],
        sum: ["Lo que quedó sin hacer, para pasarlo junto.", "What was left undone, to move it together."],
        what: [
          "Si cortaste medio día, pasa lo que quedó a mañana o a otra fecha. Los atrasados se mueven juntos.",
          "If you only cut for half the day, move what is left to tomorrow or another date. Late jobs move together.",
        ],
        go: { to: "/agenda", where: ["Agenda", "Schedule"] },
      },
      {
        id: "agenda-dia",
        title: ["¿Por qué no se trabajó este día?", "Why was this day not worked?"],
        sum: ["La razón de un día que no fue normal.", "The reason for a day that was not normal."],
        what: [
          "Aquí se reporta la razón de por qué no se siguió trabajando en esta fecha. Si se trabajó normalmente, este reporte no aparece.",
          "This report says why work did not continue on that date. If the day was worked as usual, this report does not appear.",
        ],
        how: [
          "La razón sale de Parar el día: lluvia, médico, dentista u otra escrita a mano. Si unos patios se movieron, su nombre queda junto a la razón.",
          "The reason comes from Stop the day: rain, a doctor, the dentist, or another reason you type. If some yards were moved, their names sit next to the reason.",
        ],
        go: { to: "/agenda", where: ["Agenda, en esa fecha", "Schedule, on that date"] },
      },
      {
        id: "temporada",
        title: ["Temporada para todos", "Season for everyone"],
        sum: ["En invierno, todos los cortes más espaciados.", "In winter, every cut spaced further apart."],
        what: [
          "Es un tramo del año en el que todos los cortes regulares se espacian más, sin cambiar cada ficha. Por ejemplo, de noviembre a febrero cada 21 días. Un cliente puede tener su propio ritmo. Los patios que ya moviste no vuelven atrás.",
          "It is a stretch of the year when every regular cut is spaced out, without editing each file. For example, November through February every 21 days. A client can keep their own pace. Yards you already moved do not jump back.",
        ],
        tip: ["Meses por delante decide hasta cuándo se arma la agenda.", "Months ahead decides how far the schedule is built."],
        go: { to: "/ajustes", focus: "aj-temporada", where: ["Ajustes, Temporada para todos", "Settings, Season for everyone"] },
        terms: [["Invierno", "Winter"], ["Meses por delante", "Months ahead"]],
      },
      {
        id: "vacaciones",
        title: ["Vacaciones", "Time off"],
        sum: ["Te vas unos días; la agenda se reacomoda.", "You leave for a few days; the schedule rearranges."],
        what: [
          "Elige ida y vuelta. Todo lo pendiente de esas fechas, y lo atrasado, se pasa al día del regreso. Si acortas o alargas las fechas, la agenda se reacomoda sola.",
          "Choose departure and return. Everything pending on those dates, and what is late, moves to the return day. If you shorten or lengthen the dates, the schedule rearranges itself.",
        ],
        go: { to: "/ajustes", focus: "aj-vacaciones", where: ["Ajustes, Vacaciones", "Settings, Time off"] },
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
        title: ["Por cobrar", "To collect"],
        sum: ["El dinero que todavía te deben.", "The money still owed to you."],
        what: [
          "El saldo que todavía te deben. Toca para ver a esas personas. Si se retrasan, siguen aquí: no se perdonan solas.",
          "The balance they still owe you. Tap to see those people. If they fall behind, they stay here: they are not forgiven on their own.",
        ],
        tip: ["Al corriente con saldo: deben, pero todavía no llegan a En espera ni a Alto riesgo.", "Current with a balance: they owe, but are not yet in Waiting or High risk."],
        go: { to: "/cobros", where: ["Cobros, arriba a la izquierda", "Payments, top left"] },
        terms: [["Saldo", "Balance"], ["Al corriente", "Current"], ["Deuda", "Debt"]],
      },
      {
        id: "abonado",
        title: ["Abonado", "Partial paid"],
        sum: ["Quien pagó una parte y todavía debe.", "Who paid part and still owes."],
        what: [
          "Quien dejó una parte y todavía debe. Sirve para darles seguimiento. Si pagan toda la deuda, salen de aquí. Toca para ver quiénes son.",
          "Someone who left a partial payment and still owes. It is for follow-up. If they pay the whole debt, they leave this list. Tap to see who they are.",
        ],
        how: [
          "Está en el mismo recuadro que Por cobrar. El número de personas se toca y abre la lista.",
          "It sits in the same card as To collect. Tap the number of people to open the list.",
        ],
        go: { to: "/cobros", where: ["Cobros, recuadro Por cobrar", "Payments, To collect card"] },
        terms: [["Abono", "Partial"]],
      },
      {
        id: "cobrado",
        title: ["Cobrado", "Collected"],
        sum: ["Lo que ya entró: semana, mes y año.", "What already came in: week, month, and year."],
        what: [
          "Dinero que ya te pagaron: esta semana, este mes y este año. Toca una fila para ver la lista.",
          "Money they already paid you: this week, this month, and this year. Tap a row to see the list.",
        ],
        tip: ["Las propinas no entran en Cobrado; se cuentan aparte.", "Tips do not go into Collected; they are counted apart."],
        go: { to: "/cobros", where: ["Cobros, arriba a la derecha", "Payments, top right"] },
      },
      {
        id: "trabajo-hecho",
        title: ["Trabajo ya hecho", "Work already done"],
        sum: ["Lo que vale lo terminado, pagado o no.", "What finished work is worth, paid or not."],
        what: [
          "Suma el precio de los patios ya terminados, hayan pagado o no. El dinero en mano está en Cobrado, no aquí.",
          "Adds up the price of yards already finished, whether they paid or not. Cash in hand is under Collected, not here.",
        ],
        go: { to: "/cobros", focus: "cob-hecho", where: ["Cobros, Trabajo ya hecho", "Payments, Work already done"] },
      },
      {
        id: "en-espera",
        title: ["En espera", "Waiting"],
        sum: ["Se atrasó, pero va a pagar.", "Late, but they will pay."],
        what: [
          "Quien se atrasó y va a pagar, o a quien pausaste mientras baja la deuda. El dinero no sale de Por cobrar. La función Continuar vuelve a poner el patio en la agenda.",
          "Someone who fell behind and will pay, or someone you paused while they pay the debt down. The money does not leave To collect. The Play function puts the yard back on the schedule.",
        ],
        go: { to: "/cobros", focus: "cob-espera", where: ["Cobros, En espera", "Payments, Waiting"] },
        terms: [["Atraso", "Late payment"]],
      },
      {
        id: "espera",
        title: ["Límites de espera y alto riesgo", "Waiting and high-risk limits"],
        sum: ["Cuándo un atraso pasa a naranja.", "When a late payment turns orange."],
        what: [
          "En espera es alguien que se atrasó y va a pagar. Alto riesgo es cuando pasa los días, el monto o los cortes sin pagar que pongas aquí. El dinero sigue en Por cobrar. Solo la función Perdonar lo borra.",
          "Waiting is someone who is late and will pay. High risk is when they pass the days, the amount, or the unpaid cuts you set here. The money stays in To collect. Only the Forgive function clears it.",
        ],
        how: [
          "Ejemplo: debe $80 desde hace 50 días. Con 45 días de espera, está En espera. Si pasan 21 días más, la deuda llega a $200 o van 3 cortes sin pagar, pasa a Alto riesgo, en naranja. Basta con uno de esos límites.",
          "Example: owes $80 for 50 days. With 45 days of waiting, they are Waiting. If 21 more days pass, the debt reaches $200, or 3 cuts go unpaid, they become High risk, in orange. Any one limit is enough.",
        ],
        go: { to: "/ajustes", focus: "aj-espera", where: ["Ajustes, Espera y alto riesgo", "Settings, Waiting and high risk"] },
        terms: [["Alto riesgo", "High risk"]],
      },
      {
        id: "perdonado",
        title: ["Perdonar", "Forgive"],
        sum: ["Dinero que decidiste no cobrar.", "Money you chose not to collect."],
        what: [
          "Dinero que decidiste no cobrar. Sale de Por cobrar. No es un atraso: un atraso se queda en En espera.",
          "Money you decided not to collect. It leaves To collect. It is not a late payment: a late payment stays in Waiting.",
        ],
        tip: ["Perdonar es lo único que borra un saldo sin un pago. Siempre pregunta antes.", "Forgive is the only way to clear a balance without a payment. It always asks first."],
        go: { to: "/cobros", focus: "cob-perdonado", where: ["Cobros, Perdonado este mes", "Payments, Forgiven this month"] },
        terms: [["Perdonado este mes", "Forgiven this month"]],
      },
      {
        id: "propina",
        title: ["Propina", "Tip"],
        sum: ["Dinero de más que no toca la deuda.", "Extra money that does not touch the debt."],
        what: [
          "Si alguien da más de lo que debe, anótalo como propina al marcar Hecho o al cobrar. La propina no baja ni sube la deuda y no entra en Cobrado.",
          "If someone gives more than they owe, record it as a tip when you mark Done or take a payment. A tip does not change the debt and does not go into Collected.",
        ],
        tip: ["Estudio la suma en el mes y en el año, en Propinas.", "Study adds it up for the month and the year, in Tips."],
        go: { to: "/", where: ["Hoy, al marcar Hecho", "Today, when you mark Done"] },
      },
    ],
  },

  /* ------------------------------------------------------------------ 5 */
  {
    id: "estudio",
    title: ["Estudio y Asesor", "Study and Advisor"],
    intro: ["Tus cifras en el tiempo, y un consejo claro.", "Your figures over time, and plain advice."],
    topics: [
      {
        id: "estudio",
        title: ["Estudio | Asesor", "Study | Advisor"],
        sum: ["Dos vistas: tus cifras, o qué hacer con ellas.", "Two views: your figures, or what to do with them."],
        what: [
          "Arriba hay dos botones: Estudio y Asesor. Estudio son tus cifras en el tiempo. Asesor te dice en palabras simples cómo va el negocio. La pantalla recuerda cuál elegiste.",
          "At the top there are two buttons: Study and Advisor. Study is your figures over time. Advisor tells you in plain words how the business is doing. The screen remembers your choice.",
        ],
        how: [
          "Cada bloque de Estudio empieza con su cifra grande y una frase; el detalle va debajo. Cada bloque se pliega y el pin lo deja abierto. La palomilla de arriba despliega todo. La lupa busca una cifra.",
          "Each Study block starts with its big figure and one sentence; detail goes below. Each block folds and the pin keeps it open. The check at the top expands everything. The magnifying glass finds a figure.",
        ],
        go: { to: "/estadisticas", view: "estudio", where: ["Estudio", "Study"] },
        terms: [["Cifras", "Figures"], ["Estudio", "Study"]],
      },
      {
        id: "este-mes",
        title: ["Este mes", "This month"],
        sum: ["Cobrado y hecho, contra lo esperado del mes.", "Collected and done, against the month's expected."],
        what: [
          "El anillo grande es lo cobrado este mes. El de adentro, el trabajo ya hecho. Los dos se miden contra lo esperado: lo que vale todo el trabajo agendado del mes (hecho, por hacer y atrasado).",
          "The big ring is what you collected this month. The inner one is the work already done. Both are measured against expected: what all of this month's scheduled work is worth (done, still to do, and late).",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-pulso", where: ["Estudio, Este mes", "Study, This month"] },
        terms: [["Anillo", "Ring"], ["Esperado", "Expected"]],
      },
      {
        id: "meta-mes",
        title: ["Meta del mes", "Month goal"],
        sum: ["Cuántos patios faltan por día para cumplir.", "How many yards a day are left to reach it."],
        what: [
          "La meta del mes suma la meta de patios de cada día de trabajo del mes (la que pones en Esfuerzo de la semana). Los días libres y las vacaciones no cuentan. Cuenta cada trabajo hecho, como Esfuerzo. La rayita marca dónde deberías ir hoy.",
          "The month goal adds up the yard goal of every working day this month (the one you set in This week's effort). Days off and vacation don't count. It counts every job done, like Effort. The tick marks where you should be today.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-meta", where: ["Estudio, Meta del mes", "Study, Month goal"] },
        terms: [["Meta", "Goal"]],
      },
      {
        id: "esfuerzo",
        title: ["Esfuerzo de la semana", "This week's effort"],
        sum: ["Tu meta de patios para cada día.", "Your yard goal for each day."],
        what: [
          "Toca un día para poner su meta de patios. La meta de un lunes (o el día que toques) se mantiene las semanas siguientes. Si cambias un día concreto, solo cambia esa fecha. Si te ayudan, súbela. Si quieres, iguala la meta a lo que ya cortaste.",
          "Tap a day to set its yard goal. A Monday goal (or the day you tap) stays for later weeks. Changing one date changes only that date. Raise it if you have help. You can also match the goal to what you already cut.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-esfuerzo", where: ["Estudio, Esfuerzo de la semana", "Study, This week's effort"] },
      },
      {
        id: "ingreso-fijo",
        title: ["Ingreso fijo del mes", "Steady monthly income"],
        sum: ["Tu piso: lo que entra si todo sigue igual.", "Your floor: what comes in if nothing changes."],
        what: [
          "Lo que dejan tus clientes fijos activos en un mes normal: visitas al mes (según su frecuencia) por su precio. No cuenta extras, trabajos de una vez, clientes en pausa ni temporadas. Es tu piso: lo que entra si todo sigue igual.",
          "What your active regular clients bring in a normal month: visits a month (from their frequency) times their price. It leaves out extras, one-time jobs, paused clients, and seasons. It is your floor: what comes in if nothing changes.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-fijo", where: ["Estudio, Ingreso fijo del mes", "Study, Steady monthly income"] },
        terms: [["Ingreso fijo", "Fixed income"]],
      },
      {
        id: "por-hora",
        title: ["$ por hora", "$ per hour"],
        sum: ["Cuánto ganas por cada hora trabajada.", "What you earn for each hour worked."],
        what: [
          "Lo cobrado dividido entre tus horas de trabajo confirmadas, en la semana y en el mes. Cuenta hasta el último día con horas confirmadas. El anillo compara la semana con el mes: lleno es igual o mejor.",
          "What you collected divided by your confirmed work hours, for the week and the month. It counts up to the last day with confirmed hours. The ring compares the week with the month: full means as good or better.",
        ],
        tip: ["Confirma tus horas al final del día para que la cifra sea real.", "Confirm your hours at day's end so the figure is real."],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-hora", where: ["Estudio, $ por hora", "Study, $ per hour"] },
      },
      {
        id: "ingresos-mes",
        title: ["Ingresos, mes a mes", "Income, month by month"],
        sum: ["Lo cobrado cada mes contra lo trabajado.", "Collected each month against work done."],
        what: [
          "Verde: lo cobrado cada mes. Línea punteada: lo que valió el trabajo hecho ese mes. Si la línea va por encima del verde, quedó dinero por cobrar. El último mes va en curso. Toca un mes para ver el detalle.",
          "Green: collected each month. Dotted line: what the work done that month was worth. When the line runs above the green, money was left to collect. The last month is in progress. Tap a month for details.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-mes", where: ["Estudio, Ingresos mes a mes", "Study, Income month by month"] },
      },
      {
        id: "quien-debe",
        title: ["Quién te debe", "Who owes you"],
        sum: ["Lo que te deben, por antigüedad.", "What you are owed, by age."],
        what: [
          "Lo que te deben, repartido por la edad de cada trabajo sin pagar. Un abono paga primero lo más viejo, así que lo que queda debiendo son los trabajos más recientes. Lo que ya debían antes del primer corte anotado va aparte, como Saldo inicial. En espera y Alto riesgo siguen tus límites de Ajustes.",
          "What you are owed, split by the age of each unpaid job. A payment covers the oldest first, so what is still owed is the most recent jobs. What was owed before the first recorded cut goes apart, as Opening balance. Waiting and High risk follow your limits in Settings.",
        ],
        tip: ["Fiabilidad de pago mide si pagan a tiempo. No es el mismo número que Por cobrar.", "Payment reliability measures whether they pay on time. It is not the same number as To collect."],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-fiabilidad", where: ["Estudio, Quién debe", "Study, Who owes"] },
        terms: [["Fiabilidad de pago", "Payment reliability"], ["Antigüedad de la deuda", "Debt age"]],
      },
      {
        id: "dias-temporadas",
        title: ["Días y temporadas", "Days and seasons"],
        sum: ["Qué días y qué meses rinden más.", "Which days and months pay best."],
        what: [
          "Cada fila es un mes y cada columna un día de la semana. Más verde, más trabajos hechos. Abajo, cuánto deja cada día de la semana en los últimos 12 meses: así ves qué ruta vale más. Toca un cuadro para ver el número.",
          "Each row is a month and each column a weekday. Greener means more jobs done. Below, what each weekday brought in over the last 12 months, so you can see which route is worth more. Tap a square for its number.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-calendario", where: ["Estudio, Días y temporadas", "Study, Days and seasons"] },
        terms: [["Mapa de calor", "Heat map"]],
      },
      {
        id: "mejores-clientes",
        title: ["Mejores clientes", "Best clients"],
        sum: ["Quién te dejó más en un año.", "Who brought you the most in a year."],
        what: [
          "Lo que valió el trabajo hecho para cada cliente en los últimos 12 meses (cortes, extras y trabajos de una vez). La barra compara con el primero. Toca un nombre para abrir su ficha.",
          "What the work done for each client was worth over the last 12 months (cuts, extras, and one-time jobs). The bar compares with the first one. Tap a name to open their card.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-mejores", where: ["Estudio, Mejores clientes", "Study, Best clients"] },
      },
      {
        id: "precio-trabajo",
        title: ["Precio por trabajo", "Price per job"],
        sum: ["Cuánto vale en promedio cada trabajo.", "What each job is worth on average."],
        what: [
          "Promedio de lo que valió cada trabajo hecho en los últimos 12 meses, separado por tipo. Los trabajos de $0 (cortesías) no cuentan. La línea es el precio medio de un corte, mes a mes.",
          "Average value of each job done over the last 12 months, by kind. $0 jobs (courtesies) don't count. The line is the average price of a cut, month by month.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-precio", where: ["Estudio, Precio por trabajo", "Study, Price per job"] },
        terms: [["Ticket promedio", "Average ticket"], ["Cortesía", "Courtesy"]],
      },
      {
        id: "propinas",
        title: ["Propinas", "Tips"],
        sum: ["El dinero de más, mes a mes.", "Extra money, month by month."],
        what: [
          "Dinero de más que no cambia la deuda ni entra en Cobrado. Arriba, lo de este año; las barras son los últimos 12 meses.",
          "Extra money that does not change the debt or count as Collected. On top, this year; the bars are the last 12 months.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-propinas", where: ["Estudio, Propinas", "Study, Tips"] },
      },
      {
        id: "semana-vs",
        title: ["Esta semana y la pasada", "This week vs. last"],
        sum: ["¿Vas mejor o peor que la semana pasada?", "Are you ahead of or behind last week?"],
        what: [
          "Arriba, esta semana hasta hoy contra la semana pasada hasta el mismo día. Abajo, las últimas 8 semanas: verde es lo cobrado; la barra de al lado es lo que valió el trabajo hecho, por tipo (cortes, extras, una vez), aunque aún no te hayan pagado.",
          "On top, this week so far against last week up to the same day. Below, the last 8 weeks: green is collected; the bar beside it is what the work done was worth, by kind (cuts, extras, one time), even if not paid yet.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-semana", where: ["Estudio, Esta semana", "Study, This week"] },
      },
      {
        id: "dias-parados",
        title: ["Días parados", "Stopped days"],
        sum: ["Cuántos días paraste y por qué.", "How many days you stopped, and why."],
        what: ["Días en los que paraste el trabajo y la razón que quedó guardada.", "Days you stopped work and the reason that was saved."],
        tip: ["Salen de Parar el día, en Hoy.", "They come from Stop the day, on Today."],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-horas", where: ["Estudio, Horas", "Study, Hours"] },
      },
      {
        id: "cada-anio",
        title: ["Cada año y de por vida", "Each year and lifetime"],
        sum: ["Lo cobrado y los cortes, año por año.", "Collected money and cuts, year by year."],
        what: [
          "Cuánto cobraste y cuántos cortes hiciste en cada año. Arriba, de por vida: todo lo cobrado desde el primer pago (sin propinas) y todos los cortes hechos. El conteo no se borra al cambiar de año.",
          "How much you collected and how many cuts you made each year. On top, lifetime: everything collected since the first payment (tips apart) and every cut done. The count is not erased when the year changes.",
        ],
        tip: ["Son dos cuentas distintas: dinero y patios. Un patio sin pagar también cuenta como corte.", "They are two different counts: money and yards. An unpaid yard still counts as a cut."],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-anio", where: ["Estudio, Cada año", "Study, Each year"] },
        terms: [["De por vida", "Lifetime"]],
      },
      {
        id: "pospuesto",
        title: ["Por qué se pospuso", "Why it was postponed"],
        sum: ["Las razones de los patios movidos.", "The reasons yards were moved."],
        what: ["Últimos 90 días. Cuenta los patios movidos con una razón.", "Last 90 days. Counts yards moved with a reason."],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-pospuesto", where: ["Estudio, Por qué se pospuso", "Study, Why it was postponed"] },
      },
      {
        id: "altas-bajas",
        title: ["Clientes nuevos y bajas", "New clients and departures"],
        sum: ["Cuántos llegan y cuántos se van, por mes.", "How many arrive and leave, by month."],
        what: [
          "Altas: patios que añadiste ese mes. Bajas: clientes que diste de baja ese mes.",
          "New: yards you added that month. Departures: clients you deactivated that month.",
        ],
        go: { to: "/estadisticas", view: "estudio", focus: "cif-clientes", where: ["Estudio, Clientes nuevos y bajas", "Study, New clients and departures"] },
        terms: [["Altas", "New"], ["Bajas", "Departures"]],
      },
      {
        id: "orden-cifras",
        title: ["Orden de las cifras", "Order of the figures"],
        sum: ["Pon arriba lo que más miras.", "Put what you check most at the top."],
        what: [
          "El botón junto a Estudio sube o baja cada bloque. Guardar pregunta antes de dejar ese orden. Cancelar no cambia nada. Orden de siempre empieza con Este mes y Meta del mes.",
          "The button next to Study moves each block up or down. Save asks before keeping that order. Cancel changes nothing. Usual order starts with This month and Month goal.",
        ],
        go: { to: "/estadisticas", view: "estudio", where: ["Estudio, junto al título", "Study, next to the title"] },
      },
      {
        id: "asesor",
        title: ["Asesor: el puntaje", "Advisor: the score"],
        sum: ["De 0 a 100, cómo va tu negocio.", "From 0 to 100, how your business is doing."],
        what: [
          "Asesor te dice en palabras simples cómo va el negocio, con un puntaje de 0 a 100. Con 75 o más, va bien. Debajo: lo que te deben, tu ingreso fijo al mes y tus clientes activos.",
          "Advisor tells you in plain words how the business is doing, with a score from 0 to 100. At 75 or more, it is doing well. Below: what you are owed, your fixed monthly income, and your active clients.",
        ],
        go: { to: "/estadisticas", view: "asesor", where: ["Estudio, botón Asesor", "Study, Advisor button"] },
        terms: [["Puntaje", "Score"], ["Asesor", "Advisor"]],
      },
      {
        id: "asesor-pasos",
        title: ["Lo que yo haría ahora", "What I'd do now"],
        sum: ["Las tres jugadas que más dinero valen.", "The three moves worth the most money."],
        what: [
          "Tres tarjetas con lo más importante que hacer ahora y lo que vale cada una en dinero al año. Cada una trae un botón para hacerlo de un toque: abrir Cobros, ver la agenda, ver clientes o ajustar la temporada.",
          "Three cards with the most important things to do now and what each is worth in money a year. Each has a button to do it in one tap: open Payments, see the schedule, see clients, or set the season.",
        ],
        tip: ["Si dice Nada urgente, todo está en orden.", "If it says Nothing urgent, everything is in order."],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor", "Advisor"] },
      },
      {
        id: "asesor-grupos",
        title: ["Tus clientes, en grupos", "Your clients, in groups"],
        sum: ["Estrellas, Fieles, En riesgo, Morosos y Ocasionales.", "Stars, Loyal, At risk, Late payers, and One-time."],
        what: [
          "Estrellas pagan a tiempo y dejan más. Fieles son la base. En riesgo se están alejando. Morosos te deben con atraso. Ocasionales son trabajos de una vez. Toca un grupo para ver a quién y qué hacer con cada uno.",
          "Stars pay on time and bring the most. Loyal are the base. At risk are drifting away. Late payers owe you, overdue. One-time are single jobs. Tap a group to see who is in it and what to do with each.",
        ],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor, grupos", "Advisor, groups"] },
        terms: [["Estrellas", "Stars"], ["Fieles", "Loyal"], ["En riesgo", "At risk"], ["Morosos", "Late payers"], ["Ocasionales", "One-time"]],
      },
      {
        id: "asesor-chequeos",
        title: ["Cinco chequeos y Palabras claras", "Five checks and Plain words"],
        sum: ["Cinco revisiones del negocio y un glosario corto.", "Five business checks and a short glossary."],
        what: [
          "Cinco chequeos dice cuántos van bien: Cobras a tiempo, Tus precios, Clientes que se van, Semana llena e Ingreso fijo. Toca uno para leer por qué. Palabras claras explica cada término del Asesor.",
          "Five checks says how many are good: Paid on time, Your prices, Clients leaving, Full week, and Fixed income. Tap one to read why. Plain words explains each Advisor term.",
        ],
        go: { to: "/estadisticas", view: "asesor", where: ["Asesor, al final", "Advisor, at the end"] },
        terms: [["Chequeos", "Checks"], ["Glosario", "Glossary"]],
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
          "El texto no se guarda solo: escribes y tocas Guardar. El más abre una nota en blanco; no crea nada hasta que guardas. Al salir del bloc con algo sin guardar, pregunta qué hacer.",
          "Text does not save itself: you write, then tap Save. The plus opens a blank note; nothing is created until you save. Leaving the pad with unsaved text asks what to do.",
        ],
        tip: ["Escribe @ y elige el cliente: la nota queda en su ficha.", "Type @ and pick the client: the note is saved on their file."],
        go: { to: "/notas", where: ["Bloc de notas", "Notepad"] },
        terms: [["Bloc", "Pad"], ["Guardar", "Save"], ["@Nombre", "@Name"]],
      },
      {
        id: "fichero",
        title: ["Fichero y carpetas", "Cabinet and folders"],
        sum: ["Donde se guardan y se leen las notas.", "Where notes are kept and read."],
        what: [
          "Toda nota entra en una carpeta: Trabajo por hacer, Materiales, Recordatorios, No especificada, o una nueva. El Fichero se abre con doble toque en el icono de notas.",
          "Every note goes into a folder: To do, Materials, Reminders, Unspecified, or a new one. Double-tap the notes icon to open the cabinet.",
        ],
        how: [
          "Las carpetas se crean, renombran y borran con el engranaje. Desliza a la derecha para mover una nota de carpeta y a la izquierda para mandarla a la papelera. Doble toque abre el editor.",
          "Folders are created, renamed, and deleted with the gear. Swipe right to move a note to another folder and left to send it to the trash. Double-tap opens the editor.",
        ],
        go: { to: "/fichero", where: ["Fichero", "Cabinet"] },
        terms: [["Carpetas", "Folders"], ["Papelera", "Trash"], ["Fichero", "Cabinet"]],
      },
      {
        id: "fijar",
        title: ["Fijar una nota", "Pin a note"],
        sum: ["La nota sale también en Hoy.", "The note also shows on Today."],
        what: [
          "Fijar deja la nota marcada y la muestra en Hoy como recordatorio. Fuera de las carpetas, en el Fichero, solo se ven las fijadas.",
          "Pin marks the note and shows it on Today as a reminder. On the cabinet home, outside the folders, only pinned notes show.",
        ],
        go: { to: "/fichero", where: ["Fichero", "Cabinet"] },
        terms: [["Pin", "Pin"]],
      },
      {
        id: "esta-semana",
        title: ["Esta semana, en el bloc", "This week, in the pad"],
        sum: ["Los patios de los próximos siete días.", "The yards for the next seven days."],
        what: [
          "Toca un día para ver los patios. Hoy va primero y después los seis días siguientes.",
          "Tap a day to see its yards. Today comes first, then the next six days.",
        ],
        tip: ["Se pliega, y el pin la deja abierta.", "It folds, and the pin keeps it open."],
        go: { to: "/notas", where: ["Bloc de notas, abajo", "Notepad, below"] },
      },
      {
        id: "calculadora",
        title: ["Calculadora", "Calculator"],
        sum: ["Saca una cuenta sin salir de la nota.", "Work out a sum without leaving the note."],
        what: [
          "La calculadora, junto al pin, saca la cuenta sola. En la nota la escribe en la nota. Se puede mover desde el asa y achicar desde la esquina.",
          "The calculator, next to the pin, works out the amount on its own. Into note writes it into the note. Drag the handle to move it and shrink it from the corner.",
        ],
        go: { to: "/notas", where: ["Bloc de notas, junto al pin", "Notepad, next to the pin"] },
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
        title: ["Clima", "Weather"],
        sum: ["Un veredicto claro: cortar, esperar o alerta.", "A clear verdict: cut, wait, or alert."],
        what: [
          "Clima dice si conviene cortar ahora, con la lluvia, el viento y el calor de las próximas horas, el radar y el día de mañana.",
          "Weather says whether to cut now, with the rain, wind, and heat for the next hours, the radar, and tomorrow.",
        ],
        how: [
          "Toca el clima en la parte de arriba para abrirlo. En Tu zona usa tu ubicación o escribe un código postal o una ciudad.",
          "Tap the weather at the top to open it. In Your area use your location or type a ZIP code or a city.",
        ],
        tip: ["Con tormenta o lluvia todo el día, usa Parar el día en Hoy.", "With a storm or rain all day, use Stop the day on Today."],
        go: { to: "/clima", where: ["Clima", "Weather"] },
        terms: [["Radar", "Radar"], ["Código postal", "ZIP code"], ["Lluvia", "Rain"]],
      },
      {
        id: "cielo",
        title: ["El cielo de fondo", "The sky behind the app"],
        sum: ["El fondo de la app cambia con el tiempo de afuera.", "The app background follows the weather outside."],
        what: [
          "Detrás de cada pantalla, el cielo muestra el tiempo de ahora: nubes, lluvia, tormenta, niebla o despejado. Es solo un fondo; no cambia tus datos.",
          "Behind each screen, the sky shows the weather now: clouds, rain, storm, fog, or clear. It is only a background; it does not change your data.",
        ],
        go: { to: "/clima", where: ["Clima", "Weather"] },
        terms: [["Cielo", "Sky"]],
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
        id: "ajustes",
        title: ["Desplegar todo", "Expand all"],
        sum: ["Abre o cierra todos los ajustes.", "Opens or closes every setting."],
        what: [
          "Abre o cierra de una vez todos los ajustes de esta página. La casilla queda alineada con las flechas de abajo.",
          "Opens or closes every setting on this page at once. The box lines up with the arrows below.",
        ],
        tip: ["Cada ajuste se pliega solo. El pin lo deja abierto la próxima vez.", "Each setting folds on its own. The pin keeps it open next time."],
        go: { to: "/ajustes", where: ["Ajustes, arriba", "Settings, at the top"] },
        terms: [["Pin", "Pin"], ["Plegar", "Fold"]],
      },
      {
        id: "nombre-negocio",
        title: ["Nombre del negocio", "Business name"],
        sum: ["El nombre que sale arriba y en los reportes.", "The name shown at the top and on reports."],
        what: [
          "Es el nombre de tu empresa. Sale en la parte de arriba de Brizna y en lo que exportas o imprimes.",
          "It is your business name. It shows at the top of Brizna and on what you export or print.",
        ],
        how: ["Toca el título de arriba o cámbialo en Ajustes y pulsa Guardar nombre.", "Tap the title at the top or change it in Settings and press Save name."],
        go: { to: "/ajustes", focus: "aj-nombre", where: ["Ajustes, Nombre del negocio", "Settings, Business name"] },
        terms: [["Empresa", "Business"]],
      },
      {
        id: "manual-uso",
        title: ["Manual", "Manual"],
        sum: ["Todo lo que hace Brizna, explicado corto.", "Everything Brizna does, briefly explained."],
        what: [
          "Es la guía de Brizna. Cada (?) de la app abre aquí su tema exacto, y atrás te regresa adonde estabas.",
          "It is Brizna's guide. Every (?) in the app opens its exact topic here, and back returns you to where you were.",
        ],
        go: { to: "/ajustes", focus: "aj-manual", where: ["Ajustes, Manual", "Settings, Manual"] },
        terms: [["Ayuda", "Help"], ["Guía", "Guide"]],
      },
      {
        id: "busca",
        title: ["Buscar en Ajustes", "Search settings"],
        sum: ["La lupa deja solo el ajuste que buscas.", "The magnifying glass leaves only the setting you want."],
        what: [
          "La lupa está en la línea de Ajustes. Si escribes hor, se queda Horas de trabajo. Lo demás se esconde, como en los ajustes del teléfono.",
          "The magnifying glass sits on the Settings line. If you type hor, only Work hours stays. Everything else hides, like phone settings.",
        ],
        tip: ["El manual tiene su propia lupa, solo para el manual.", "The manual has its own magnifying glass, for the manual only."],
        go: { to: "/ajustes", where: ["Ajustes, la lupa", "Settings, the magnifying glass"] },
        terms: [["Lupa", "Magnifying glass"]],
      },
      {
        id: "tema",
        title: ["Tema de día y de noche", "Day and night theme"],
        sum: ["Los colores de la app, de día y de noche.", "The app colors, by day and by night."],
        what: [
          "El tema de día y el de noche se quedan como los dejes, aunque bajes la pantalla para refrescar.",
          "The day theme and the night theme stay as you left them, even if you pull to refresh.",
        ],
        how: [
          "Automático cambia según la hora: noche antes de las 6:30 de la mañana y desde las 6:30 de la tarde. Jardín, Costa, Barro, Pino, Cielo, Lima, Arena y Flor son de día. Noche, Medianoche, Ciruela, Grafito, Luciérnaga y AMOLED son de noche.",
          "Automatic follows the hour: night before 6:30 in the morning and from 6:30 in the evening. Garden, Coast, Clay, Pine, Sky, Lime, Sand, and Bloom are for day. Night, Midnight, Plum, Graphite, Firefly, and AMOLED are for night.",
        ],
        go: { to: "/ajustes", focus: "aj-pantalla", where: ["Ajustes, Pantalla", "Settings, Screen"] },
        terms: [["Automático", "Automatic"], ["AMOLED", "AMOLED"], ["Colores", "Colors"]],
      },
      {
        id: "idioma",
        title: ["Idioma", "Language"],
        sum: ["Español o English.", "Spanish or English."],
        what: [
          "Español es el idioma de siempre. English cambia los textos de la app y el corrector del bloc.",
          "Spanish is the default language. English changes the app text and the notepad spellcheck.",
        ],
        go: { to: "/ajustes", focus: "aj-pantalla", where: ["Ajustes, Pantalla", "Settings, Screen"] },
        terms: [["English", "Español"]],
      },
      {
        id: "tableta",
        title: ["Modo tableta", "Tablet mode"],
        sum: ["Dos pantallas a la vez y una ventana flotante.", "Two screens at once and a floating window."],
        what: [
          "Parte la pantalla en dos (lado a lado en tableta o computadora, arriba y abajo en el teléfono) y añade una ventana flotante que puedes mover, agrandar y plegar en una burbuja. Lo que hagas en una se ve al momento en las otras.",
          "Splits the screen in two (side by side on a tablet or computer, top and bottom on a phone) and adds a floating window you can move, resize, and fold into a bubble. What you do in one shows up right away in the others.",
        ],
        tip: ["Si está apagado, la pantalla sigue de una en una.", "When it is off, screens show one at a time."],
        go: { to: "/ajustes", focus: "aj-tableta", where: ["Ajustes, Modo tableta", "Settings, Tablet mode"] },
        terms: [["Ventana flotante", "Floating window"]],
      },
      {
        id: "recordatorios",
        title: ["Recordatorios", "Reminders"],
        sum: ["Avisos al abrir la app.", "Alerts when you open the app."],
        what: [
          "Avisos cuando abres la app: cortes atrasados y la hora de llegada del patio.",
          "Alerts when you open the app: late cuts and the yard arrival time.",
        ],
        go: { to: "/ajustes", focus: "aj-recordatorios", where: ["Ajustes, Recordatorios", "Settings, Reminders"] },
        terms: [["Avisos", "Alerts"]],
      },
      {
        id: "exportar",
        title: ["Exportar e imprimir", "Export and print"],
        sum: ["Un informe en PDF, hoja de cálculo o papel.", "A report as a PDF, a worksheet, or on paper."],
        what: [
          "Elige qué entra (todo o solo algunas partes), de qué fechas y de qué clientes. Sale en PDF para leer e imprimir, en hoja de cálculo para filtrar y sumar, o directo a la impresora.",
          "Choose what goes in (everything or just some parts), which dates and which clients. It comes out as a PDF to read and print, a worksheet to filter and sum, or straight to the printer.",
        ],
        how: [
          "Empieza con un atajo: Todo, Cobros y deudas, Agenda de la semana, Resumen del mes, Clientes o Para el contador. Luego elige fechas, secciones y clientes. En Privacidad puedes ocultar teléfonos, dejar solo iniciales o quitar los montos para un ayudante. Al final: PDF, Hoja (XLSX), Imprimir o Compartir.",
          "Start with a shortcut: Everything, Payments and debts, Week schedule, Month summary, Clients, or For the accountant. Then pick dates, sections, and clients. In Privacy you can hide phone numbers, show initials only, or drop the amounts for a helper. Finally: PDF, Sheet (XLSX), Print, or Share.",
        ],
        tip: ["Si cambias una casilla, el atajo pasa a A medida.", "If you change a box, the shortcut becomes Custom."],
        go: { to: "/ajustes", focus: "aj-exportar", where: ["Ajustes, Exportar e imprimir", "Settings, Export and print"] },
        terms: [["PDF", "PDF"], ["XLSX", "XLSX"], ["Hoja de cálculo", "Worksheet"], ["Privacidad", "Privacy"], ["Para el contador", "For the accountant"], ["Compartir", "Share"], ["Informe", "Report"]],
      },
      {
        id: "copia",
        title: ["Copia de seguridad", "Backup"],
        sum: ["Un respaldo de tus clientes y trabajos.", "A backup of your clients and jobs."],
        what: [
          "Guardar copia deja un respaldo en tu cuenta. Restaurar reemplaza clientes y trabajos actuales por los de esa copia.",
          "Save copy keeps a backup in your account. Restore replaces current clients and jobs with those from that copy.",
        ],
        how: [
          "Se guarda sola al cambiar datos, al salir y cada pocos minutos. Guardar archivo descarga una copia. Elegir carpeta guarda ahí las 5 más recientes. Antes de restaurar, se guarda lo que hay ahora.",
          "It saves on its own when data changes, when you leave, and every few minutes. Save file downloads a copy. Choose folder keeps the 5 most recent there. Before a restore, what is there now is saved.",
        ],
        go: { to: "/ajustes", focus: "aj-copia", where: ["Ajustes, Copia de seguridad", "Settings, Backup"] },
        terms: [["Restaurar", "Restore"], ["Respaldo", "Backup"]],
      },
      {
        id: "nube",
        title: ["Nube", "Cloud"],
        sum: ["Tus datos, guardados también fuera del teléfono.", "Your data, also kept off the phone."],
        what: [
          "La cuenta y los clientes quedan en la nube y en este equipo. Sin internet, los cambios se suben al volver la conexión. Si cambias de teléfono, entra con tu cuenta y todo vuelve.",
          "The account and the clients stay in the cloud and on this device. Offline, changes upload when the connection returns. If you change phones, sign in with your account and everything comes back.",
        ],
        how: ["El recuadro Nube se despliega: dice si todo está guardado y tiene Sincronizar ahora.", "The Cloud card unfolds: it says whether everything is saved and has Sync now."],
        go: { to: "/ajustes", where: ["Ajustes, al final", "Settings, at the end"] },
        terms: [["Sincronizar", "Sync"], ["Sin internet", "Offline"]],
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
          "Elige cuánto tiempo cerrada antes de pedirla otra vez: 5 min, 30 min, 1 h, 4 h o 12 h. Una visita corta a otra app no la pide.",
          "Choose how long it must be closed before it asks again: 5 min, 30 min, 1 h, 4 h, or 12 h. A short trip to another app does not ask.",
        ],
        go: { to: "/ajustes", where: ["Ajustes, al final", "Settings, at the end"] },
        terms: [["Desbloqueo", "Unlock"], ["Bloqueo", "Lock"]],
      },
      {
        id: "sesion",
        title: ["Sesión", "Session"],
        sum: ["Seguir dentro o salir al cerrar.", "Stay signed in or leave on close."],
        what: [
          "En Entrar, Mantener sesión abierta deja la cuenta abierta hasta que cierres sesión. Si la casilla está vacía, la sesión se acaba al salir de la app.",
          "On Sign in, Keep me signed in leaves the account open until you sign out. If the box is empty, the session ends when you leave the app.",
        ],
        tip: ["Al cerrar sesión, tus datos siguen en la nube. Entras otra vez con el mismo correo.", "When you sign out, your data stays in the cloud. Sign in again with the same email."],
        go: { to: "/ajustes", where: ["Ajustes, al final", "Settings, at the end"] },
        terms: [["Cerrar sesión", "Sign out"], ["Mantener sesión abierta", "Keep me signed in"]],
      },
      {
        id: "ajustes-usuales",
        title: ["Ajustes rápidos", "Quick settings"],
        sum: ["Tres atajos para dejar todo listo.", "Three shortcuts to set things up."],
        what: [
          "Semana normal deja la entrada a las 8:00, la salida a las 5:30, En espera a los 45 días y Alto riesgo a los 21 días, $200 o 3 cortes sin pagar. Cobro corto aprieta esos límites. Invierno lento espacia los cortes de noviembre a febrero.",
          "Normal week sets clock-in to 8:00, clock-out to 5:30, Waiting at 45 days, and High risk at 21 days, $200, or 3 unpaid cuts. Short collection tightens those limits. Slow winter spaces cuts from November to February.",
        ],
        go: { to: "/ajustes", focus: "aj-manual", where: ["Ajustes, Manual", "Settings, Manual"] },
        terms: [["Semana normal", "Normal week"], ["Cobro corto", "Short collection"], ["Invierno lento", "Slow winter"]],
      },
    ],
  },
];

/* ------------------------------------------------------------------ lookups */

export type Numbered = Topic & { num: string; chapter: Chapter; chapterNum: number };

export const MANUAL_TOPICS: Numbered[] = MANUAL_CHAPTERS.flatMap((chapter, ci) =>
  chapter.topics.map((topic, ti) => ({ ...topic, num: `${ci + 1}.${ti + 1}`, chapter, chapterNum: ci + 1 })),
);

const BY_ID = new Map(MANUAL_TOPICS.map((t) => [t.id, t]));

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

export function findTopic(id: string | undefined | null): Numbered | null {
  if (!id) return null;
  return BY_ID.get(id) ?? BY_ID.get(ALIASES[id] ?? "") ?? null;
}

export function pick(locale: string, pair: L): string {
  return locale === "en" ? pair[1] : pair[0];
}

/** Plain text of a topic for search (both the visible language and the link markup stripped). */
export function topicText(topic: Topic, locale: string): string {
  const parts = [topic.title, topic.sum, topic.what, topic.whatAlt, topic.how, topic.tip, ...(topic.terms ?? [])]
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
