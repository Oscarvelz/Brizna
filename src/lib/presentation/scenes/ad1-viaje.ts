/**
 * AD1 · El viaje del dato — LA COLUMNA (PLAN §1.2, espina §0.2).
 * Un cliente continuo (Don Aurelio, debe $120) y un dólar seguidos por
 * Hoy → Clientes → su ficha → Agenda → Cobros → Estudio/Asesor → la foto
 * del widget (solo nombrada: su escenario es de AD16). La regla de
 * totales únicos (censo D-40) se dice UNA vez, entera, en Cobros, y luego
 * solo se RECONOCE en cada superficie. Censo A, B, D-40/D-41/D-56, E-9/E-30.
 * Escenario: «viaje-dinero» (seeds-w2-a.ts) — Aurelio debe $120 (dos
 * cortes pendientes + un extra hecho) y Hugo Prado, en lista negra,
 * debe $80 que su ficha enseña y ningún total suma.
 *
 * ANCLAS NUEVAS que este archivo cita (present, <superficie>-<control>;
 * el integrador las acuña en anchors.ts y en el archivo dueño):
 *  - estudio-te-deben → src/components/cifras-insights.tsx
 *      (el mosaico «Te deben» de Este mes / PulseSection; hoy data-spot
 *      no tiene fila propia: el bloque vive en ese componente).
 *  - estudio-vista-asesor → src/routes/estadisticas.tsx
 *      (la píldora Estudio|Asesor, StudyToggle, data-spot="estudio").
 *  - asesor-heroe → src/components/asesor.tsx
 *      (el héroe del Asesor con su fila Te deben; data-spot="asesor").
 * El resto son anclas ya registradas en anchors.ts.
 */
import type { Module } from "../guion.ts";

export const AD1: Module = {
  id: "ad1-viaje",
  n: 7,
  floor: "advanced",
  title: ["El viaje del dato", "The journey of a piece of data"],
  promise: [
    "Podrás seguir cualquier dato y predecir dónde se verá y qué tocará.",
    "You will be able to follow any piece of data and predict where it will appear and what it will touch.",
  ],
  ready: true,
  chapters: [
    { id: "nace", title: ["El dato nace en Hoy", "The data is born in Today"] },
    { id: "viaja", title: ["El mismo dato, otras pantallas", "The same data, other screens"] },
    { id: "regla", title: ["La regla de totales únicos", "The unique-totals rule"] },
    { id: "se-lee", title: ["Estudio y Asesor leen lo mismo", "Stats and the Advisor read the same"] },
  ],
  scenes: [
    {
      id: "ad1-un-cliente", chapter: "nace", anchors: ["tarjeta-nombre", "tarjeta-precio"],
      keys: [["hoy", "today"], ["precio", "price"]],
      steps: [
        { kind: "stage", build: "viaje-dinero" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["Un solo cliente para todo el viaje: Don Aurelio.", "One single client for the whole journey: Don Aurelio."] },
        { kind: "show", anchor: "tarjeta-precio", caption: ["Y un solo dólar: su corte de hoy cuesta $40.", "And one single dollar: today's cut costs $40."] },
      ],
    },
    {
      id: "ad1-todavia-no-debe", chapter: "nace", anchors: ["tarjeta-estado"],
      keys: [["pendiente", "pending"], ["estado", "status"]],
      steps: [
        { kind: "show", anchor: "tarjeta-estado", caption: ["Dice Pendiente: ese precio todavía no es deuda.", "It says Pending: that price is not debt yet."], contexto: ["El precio suma a la deuda solo al cerrarse pendiente.", "The price adds to the debt only when closed unpaid."] },
      ],
    },
    {
      id: "ad1-en-clientes", chapter: "viaja", anchors: ["lista-clientes", "clientes-filtros"],
      keys: [["clientes", "clients"], ["lista", "list"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["En Clientes es inventario: precio grande, ritmo y saldo.", "In Clients it is inventory: big price, rhythm and balance."] },
        { kind: "show", anchor: "lista-clientes", caption: ["Su precio grande es de inventario; en Hoy era neutro.", "Its big price belongs to inventory; in Today it was neutral."] },
        { kind: "show", anchor: "clientes-filtros", caption: ["Los filtros separan activos, con saldo, alto riesgo y vetados.", "The filters separate active, owing, high risk and blacklisted."] },
      ],
    },
    {
      id: "ad1-en-su-ficha", chapter: "viaja", anchors: ["ficha-deuda", "movimientos"],
      keys: [["ficha", "file"], ["deuda", "debt"], ["movimientos", "movements"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-deuda", caption: ["En su ficha, el trabajo ya hecho vive como saldo: $120.", "On his file, finished work lives as a balance: $120."] },
        { kind: "show", anchor: "movimientos", caption: ["Movimientos guarda cada dólar con su fecha y su medio.", "Movements keeps every dollar with its date and method."], contexto: ["Dos cortes pendientes y un extra hecho forman esos $120.", "Two unpaid cuts and one finished extra make those $120."] },
      ],
    },
    {
      id: "ad1-en-agenda", chapter: "viaja", anchors: ["agenda"],
      keys: [["agenda", "schedule"], ["visita", "visit"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "ask", anchor: "agenda", caption: ["¿Cambió el dato al cambiar de pantalla?", "Did the data change when the screen changed?"] },
        { kind: "show", anchor: "agenda", caption: ["No: es la misma visita, vista desde su fecha.", "No: it is the same visit, seen from its date."] },
        { kind: "show", anchor: "agenda", caption: ["Si mueves esta visita, Hoy mueve la misma, no otra.", "If you move this visit, Today moves the same one."] },
        { kind: "show", anchor: "agenda", caption: ["Su próxima visita también nació de su frecuencia quincenal.", "His next visit was also born from his biweekly frequency."], contexto: ["La frecuencia siembra el futuro; mover una fecha no rompe la regla.", "Frequency plants the future; moving one date breaks no rule."] },
      ],
    },
    {
      id: "ad1-llega-a-cobros", chapter: "regla", anchors: ["por-cobrar"],
      keys: [["cobros", "payments"], ["por cobrar", "to collect"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["En Cobros, sus $120 se juntan con todos los que deben.", "In Payments, his $120 joins everyone who owes."] },
      ],
    },
    {
      id: "ad1-la-regla", chapter: "regla", anchors: ["por-cobrar"],
      keys: [["totales", "totals"], ["lista negra", "blacklist"]],
      steps: [
        { kind: "show", anchor: "por-cobrar", caption: ["La regla, dicha una vez: cuentan activos y no vetados.", "The rule, said once: active, non-blacklisted clients count."], contexto: ["Hugo debe $80 en su ficha, pero vetado no suma aquí.", "Hugo owes $80 on his file, but blacklisted clients never count here."] },
      ],
    },
    {
      id: "ad1-hugo-si-debe", chapter: "regla", anchors: ["ficha-deuda"],
      keys: [["ficha", "file"], ["saldo", "balance"]],
      steps: [
        { kind: "go", screen: "/clientes/:vetado" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su ficha sí enseña sus $80 reales, enteros.", "His file does show his real $80, in full."], contexto: ["No contar en totales no es perdonar ni borrar: sigue debiendo.", "Not counting in totals is not forgiving or deleting: he still owes."] },
      ],
    },
    {
      id: "ad1-dos-relojes", chapter: "regla", anchors: ["cobrado"],
      keys: [["cobrado", "collected"], ["adelanto", "advance"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobrado", caption: ["Cobrado cuenta el dinero cuando entra, no cuando se trabaja.", "Collected counts money when it arrives, not when the work happens."], contexto: ["Un adelanto cuenta el día que llega, aunque el corte sea después.", "An advance counts the day it arrives, even if the cut is later."] },
        { kind: "show", anchor: "cobrado", caption: ["Trabajo hecho suma por fecha del trabajo: el otro reloj.", "Work done adds by the job's date: the other clock."] },
        { kind: "ref", topic: "por-cobrar" },
      ],
    },
    {
      id: "ad1-en-estudio", chapter: "se-lee", anchors: ["estudio-te-deben"],
      keys: [["estudio", "stats"], ["deuda", "debt"]],
      steps: [
        { kind: "go", screen: "/estadisticas" },
        { kind: "show", anchor: "estudio-te-deben", caption: ["Estudio dice Te deben: reconócelo, es la misma cifra.", "Stats says You are owed: recognize it, the same figure."] },
        { kind: "show", anchor: "estudio-te-deben", caption: ["Ni Hugo ni ningún vetado o archivado entra aquí.", "Neither Hugo nor any blacklisted or archived client enters here."] },
      ],
    },
    {
      id: "ad1-en-asesor", chapter: "se-lee", anchors: ["estudio-vista-asesor", "asesor-heroe"],
      keys: [["asesor", "advisor"], ["totales", "totals"]],
      steps: [
        { kind: "do", anchor: "estudio-vista-asesor", caption: ["Voltea a Asesor: otra lectura del mismo libro.", "Flip to the Advisor: another reading of the same book."] },
        { kind: "show", anchor: "asesor-heroe", caption: ["Su Te deben coincide con Cobros: comparten la regla.", "Its You are owed matches Payments: they share the rule."], contexto: ["Por eso su consejo de cobrar nunca nombra a Hugo.", "That is why its collection advice never names Hugo."] },
        { kind: "show", anchor: "asesor-heroe", caption: ["Si Aurelio paga, cada superficie baja el mismo dólar.", "If Aurelio pays, every surface lowers the same dollar."] },
      ],
    },
    {
      id: "ad1-widget", chapter: "se-lee", anchors: ["por-cobrar"],
      keys: [["widgets", "widgets"], ["por cobrar", "to collect"]],
      verify: "La coincidencia widget↔app sale del código (D-56: getWorkSummary usa el mismo predicado D-40); la foto real del widget en un aparato Android no se contrastó en esta línea — por eso aquí solo se nombra, sin escenificarla (su escena actuada es de AD16).",
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["Fuera de la app, el widget enseña esta misma cifra.", "Outside the app, the widget shows this same figure."], contexto: ["Su Por cobrar toca y abre Cobros: coinciden porque es una regla.", "Its To collect opens Payments: they match because the rule is one."] },
      ],
    },
    {
      id: "ad1-cierre", chapter: "se-lee", anchors: ["tarjeta-nombre"],
      keys: [["hoy", "today"], ["dato", "data"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["Así viaja todo dato: nace, viaja, se lee igual.", "That is how every piece of data travels: born, travels, is read the same."] },
      ],
    },
  ],
};
