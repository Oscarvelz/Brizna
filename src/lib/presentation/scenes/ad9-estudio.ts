/**
 * AD9 · Estudio y el Asesor — los 16 bloques de Cifras y su reorden, el
 * héroe «Te deben» con su población exacta, el orden de lectura (lo
 * primario antes que lo secundario), y el Asesor como lo que es: reglas
 * deterministas escritas en código, NO una IA — «sin base no se inventa».
 * Censo E (E-1…E-45) y D-47…D-50. Escenario: estudio-cifras.
 *
 * H-D6 (los dos motores de informes) vive AQUÍ, en la escena final: el
 * centro de exportación es el motor de informes de las cifras; el informe
 * antiguo pegado al respaldo es otra pieza. AD15 NO debe duplicarlo.
 *
 * ANCLAS NUEVAS (present salvo nota; el integrador las registra en
 * anchors.ts y acuña las present en el archivo dueño):
 *  - estudio          spot "estudio"          routes/estadisticas.tsx (la píldora Estudio|Asesor)
 *  - estudio-buscar   present                 routes/estadisticas.tsx (TitleSearch; emisión en components/app-shell.tsx)
 *  - estudio-ir-asesor present                routes/estadisticas.tsx (botón «Asesor» de la píldora)
 *  - cifras-orden     present                 components/cifras-order-button.tsx (botón y diálogo de orden)
 *  - cif-pulso, cif-meta, cif-mes, cif-fiabilidad, cif-calendario,
 *    cif-mejores, cif-precio, cif-propinas, cif-fijo, cif-hora
 *                     id (B3, ids DOM reales) components/cifras-insights.tsx
 *  - cif-esfuerzo     id (B3)                  components/effort-week.tsx
 *  - cif-semana, cif-horas, cif-anio, cif-clientes, cif-pospuesto
 *                     id (B3)                  components/cobros-charts.tsx
 *  - asesor           spot "asesor"            components/asesor.tsx (el héroe)
 *  - asesor-pasos     spot "asesor-pasos"      components/asesor.tsx
 *  - asesor-grupos    spot "asesor-grupos"     components/asesor.tsx
 *  - asesor-chequeos  spot "asesor-chequeos"   components/asesor.tsx
 * Anclas que ya existían y se reusan: ninguna de este módulo (el piso
 * Quick no llegó a Estudio); la regla de totales únicos se RECONOCE
 * desde Q4/AD1, no se enseña desde cero.
 */
import type { Module } from "../guion.ts";

export const AD9: Module = {
  id: "ad9-estudio",
  n: 15,
  floor: "advanced",
  title: ["Estudio y el Asesor", "Stats and the Advisor"],
  promise: [
    "Podrás leer tus cifras en el orden correcto y saber qué te está diciendo el Asesor — y qué no puede decirte.",
    "You will be able to read your figures in the right order and know what the Advisor is telling you — and what it cannot tell you.",
  ],
  ready: true,
  chapters: [
    { id: "estructura", title: ["La estructura de Estudio", "The structure of Stats"] },
    { id: "el-mes", title: ["El mes, primero", "The month, first"] },
    { id: "el-negocio", title: ["El negocio entero", "The whole business"] },
    { id: "asesor", title: ["El Asesor: reglas, no magia", "The Advisor: rules, not magic"] },
  ],
  scenes: [
    {
      id: "ad9-dos-vistas", chapter: "estructura", anchors: ["estudio", "estudio-buscar"],
      keys: [["estudio", "stats"], ["asesor", "advisor"], ["buscar", "search"]],
      steps: [
        { kind: "stage", build: "estudio-cifras" },
        { kind: "go", screen: "/estadisticas" },
        { kind: "show", anchor: "estudio", caption: ["Dos vistas, una pestaña: Estudio cuenta; el Asesor aconseja.", "Two views, one tab: Stats counts; the Advisor advises."], contexto: ["Deslizar dentro de Estudio voltea la vista sin salir de la pestaña.", "Swiping inside Stats flips the view without leaving the tab."] },
        { kind: "show", anchor: "estudio-buscar", caption: ["La lupa filtra los bloques por palabra: escribe «deuda», quedan los tuyos.", "The search filters blocks by word: type “debt”, and yours stay."] },
      ],
    },
    {
      id: "ad9-orden", chapter: "estructura", anchors: ["cifras-orden", "cif-pulso"],
      keys: [["orden", "order"], ["cifras", "figures"], ["bloques", "blocks"]],
      steps: [
        { kind: "show", anchor: "cifras-orden", caption: ["Tus 16 bloques se reordenan aquí, flecha a flecha.", "Your 16 blocks reorder here, arrow by arrow."] },
        { kind: "show", anchor: "cifras-orden", caption: ["Guardar pregunta antes de aplicar tu orden nuevo.", "Saving asks before applying your new order."], contexto: ["«Orden de siempre» solo lo prepara: no se guarda hasta que confirmas.", "“Default order” only prepares it: nothing saves until you confirm."] },
        { kind: "show", anchor: "cif-pulso", caption: ["Tu orden vive en este aparato y manda en esta pantalla.", "Your order lives on this device and rules this screen."] },
      ],
    },
    {
      id: "ad9-pulso", chapter: "el-mes", anchors: ["cif-pulso"],
      keys: [["este mes", "this month"], ["cobrado", "collected"], ["anillo", "ring"]],
      steps: [
        { kind: "show", anchor: "cif-pulso", caption: ["Lee primero Este mes: anillo fuera, cobrado; dentro, trabajo hecho.", "Read This month first: outer ring, collected; inner, work done."] },
        { kind: "show", anchor: "cif-pulso", caption: ["Ambos anillos se miden contra lo esperado del mes.", "Both rings measure against the month's expected total."], contexto: ["Y pronostica: si haces lo que queda, el mes llega a tanto.", "And it forecasts the month's total if you finish what remains."] },
      ],
    },
    {
      id: "ad9-te-deben", chapter: "el-mes", anchors: ["cif-pulso"],
      keys: [["te deben", "they owe you"], ["deuda", "debt"], ["cobros", "payments"]],
      steps: [
        { kind: "ask", anchor: "cif-pulso", caption: ["¿Quién entra en «Te deben»? Ya conoces la regla.", "Who counts in “Owed to you”? You know the rule."] },
        { kind: "show", anchor: "cif-pulso", caption: ["Solo saldos positivos de clientes activos y no vetados.", "Only positive balances of active, non-blacklisted clients."], contexto: ["Un saldo a favor no resta; archivados y lista negra no cuentan.", "A credit balance never subtracts; archived and blacklisted never count."] },
      ],
    },
    {
      id: "ad9-meta", chapter: "el-mes", anchors: ["cif-meta", "cif-esfuerzo"],
      keys: [["meta", "goal"], ["esfuerzo", "effort"], ["patios", "yards"]],
      steps: [
        { kind: "show", anchor: "cif-meta", caption: ["Meta del mes: patios por día necesarios y tu ritmo.", "Monthly goal: yards per day needed and your pace."] },
        { kind: "show", anchor: "cif-esfuerzo", caption: ["Esfuerzo la alimenta: toca un día y editas su meta.", "Effort feeds it: tap a day and edit its goal."], contexto: ["La meta de cada día se guarda para las semanas siguientes.", "Each day's goal is kept for the following weeks."] },
      ],
    },
    {
      id: "ad9-fijo-hora", chapter: "el-mes", anchors: ["cif-fijo", "cif-hora"],
      keys: [["ingreso fijo", "fixed income"], ["por hora", "per hour"]],
      steps: [
        { kind: "show", anchor: "cif-fijo", caption: ["Ingreso fijo: tu mes normal, sin extras ni una vez.", "Fixed income: your normal month, no extras or one-offs."], contexto: ["Cuenta fijos activos, sin pausa ni lista negra, por su frecuencia.", "It counts active regulars, not paused or blacklisted, by frequency."] },
        { kind: "show", anchor: "cif-hora", caption: ["$ por hora solo suma días de trabajo confirmados.", "$ per hour only adds confirmed work days."], contexto: ["Sin horas confirmadas, el bloque lo dice; no inventa tu hora.", "With no confirmed hours, the block says so; it invents nothing."] },
      ],
    },
    {
      id: "ad9-tendencia", chapter: "el-negocio", anchors: ["cif-mes", "cif-semana", "cif-calendario"],
      keys: [["ingresos", "income"], ["semana", "week"], ["temporadas", "seasons"]],
      steps: [
        { kind: "show", anchor: "cif-mes", caption: ["Mes a mes: toca el gráfico y fijas un mes entero.", "Month by month: tap the chart and pin a whole month."] },
        { kind: "show", anchor: "cif-semana", caption: ["Esta semana se compara con la pasada al mismo día.", "This week compares with last week at the same weekday."] },
        { kind: "show", anchor: "cif-calendario", caption: ["Días y temporadas: tu mejor día sale del mapa de calor.", "Days and seasons: your best day comes from the heat map."] },
      ],
    },
    {
      id: "ad9-deuda", chapter: "el-negocio", anchors: ["cif-fiabilidad"],
      keys: [["quién te debe", "who owes you"], ["antigüedad", "age"], ["riesgo", "risk"]],
      steps: [
        { kind: "show", anchor: "cif-fiabilidad", caption: ["Quién te debe ordena la deuda por antigüedad, en cinco cubos.", "Who owes you sorts debt by age, in five buckets."] },
        { kind: "show", anchor: "cif-fiabilidad", caption: ["El saldo inicial tiene cubo propio: nunca se disfraza de viejo.", "Opening balance has its own bucket: never disguised as old."], contexto: ["Los niveles — al corriente, espera, alto riesgo — salen de tus Ajustes.", "The tiers — current, waiting, high risk — come from your Settings."] },
      ],
    },
    {
      id: "ad9-clientes", chapter: "el-negocio", anchors: ["cif-mejores", "cif-precio", "cif-clientes"],
      keys: [["mejores clientes", "best clients"], ["precio", "price"], ["clientes nuevos", "new clients"]],
      steps: [
        { kind: "show", anchor: "cif-mejores", caption: ["Mejores clientes: quién sostiene tu año, en trabajos y ticket.", "Best clients: who carries your year, in jobs and average ticket."] },
        { kind: "show", anchor: "cif-precio", caption: ["Precio por trabajo separa cortes, extras y una vez.", "Price per job separates cuts, extras, and one-offs."], contexto: ["Los cortes gratis, a $0, quedan fuera de los promedios.", "Free cuts, at $0, stay out of the averages."] },
        { kind: "show", anchor: "cif-clientes", caption: ["Toca una barra de altas o bajas y aterrizas en Clientes.", "Tap a new or lost bar and you land in Clients."] },
      ],
    },
    {
      id: "ad9-resto", chapter: "el-negocio", anchors: ["cif-propinas", "cif-horas", "cif-anio", "cif-pospuesto"],
      keys: [["propinas", "tips"], ["horas", "hours"], ["cada año", "each year"], ["pospuesto", "postponed"]],
      verify: "El bloque «Por qué se pospuso» (cif-pospuesto) solo se pinta si hay motivos registrados (E-25); el escenario no registra ninguno: si el ancla no resuelve, la escena se salta con gracia y la lección queda en las palabras de esta escena.",
      steps: [
        { kind: "show", anchor: "cif-propinas", caption: ["Propinas viven aparte: nunca se suman a lo cobrado.", "Tips live apart: never added to what you collected."] },
        { kind: "show", anchor: "cif-horas", caption: ["Horas de trabajo cuenta también tus días parados y su motivo.", "Work hours also counts your stopped days and their reason."] },
        { kind: "show", anchor: "cif-anio", caption: ["Cada año guarda también lo de por vida: cobrado y cortes.", "Each year also holds the lifetime totals: collected and cuts."] },
        { kind: "show", anchor: "cif-pospuesto", caption: ["Si pospusiste alguna vez, aquí se cuentan los motivos.", "If you ever postponed, the reasons are counted here."] },
      ],
    },
    {
      id: "ad9-ir-asesor", chapter: "asesor", anchors: ["estudio-ir-asesor", "asesor"],
      keys: [["asesor", "advisor"], ["consejos", "advice"]],
      steps: [
        { kind: "do", anchor: "estudio-ir-asesor", caption: ["Pasa al Asesor: mismas cifras, convertidas en consejo.", "Switch to the Advisor: same figures, turned into advice."] },
        { kind: "show", anchor: "asesor", caption: ["Su veredicto: un puntaje de 0 a 100 y su palabra.", "Its verdict: a score from 0 to 100 and its word."], contexto: ["Bien desde 75; Regular, 50 a 74; Atención, bajo 50.", "Good from 75; Fair, 50 to 74; Attention, under 50."] },
      ],
    },
    {
      id: "ad9-heroe", chapter: "asesor", anchors: ["asesor"],
      keys: [["te deben", "they owe you"], ["fijo al mes", "fixed monthly"], ["clientes", "clients"]],
      steps: [
        { kind: "show", anchor: "asesor", caption: ["Su fila de tres: Te deben, Fijo al mes, Clientes.", "Its row of three: Owed to you, Fixed monthly, Clients."] },
        { kind: "show", anchor: "asesor", caption: ["Su «Te deben» es el de siempre: la misma población exacta.", "Its “Owed to you” is the usual one: the same exact population."], contexto: ["Activos, no vetados, solo saldos positivos: por eso coincide con Estudio.", "Active, not blacklisted, positive balances only: that is why it matches Stats."] },
      ],
    },
    {
      id: "ad9-reglas", chapter: "asesor", anchors: ["asesor"],
      keys: [["asesor", "advisor"], ["puntaje", "score"]],
      steps: [
        { kind: "show", anchor: "asesor", caption: ["El Asesor no es una IA: son reglas escritas, siempre las mismas.", "The Advisor is not an AI: written rules, always the same."], contexto: ["Ninguna IA lo alimenta: lee tu libro y aplica umbrales del código.", "No AI feeds it: it reads your book and applies coded thresholds."] },
        { kind: "show", anchor: "asesor", caption: ["Sin base no se inventa: sin clientes ni trabajos, no hay puntaje.", "No basis, no invention: no clients or jobs, no score."], contexto: ["Cada consejo tiene su puerta: cobrar, por ejemplo, exige $20 atrasados.", "Every tip has its gate: collecting, for example, needs $20 overdue."] },
      ],
    },
    {
      id: "ad9-pasos", chapter: "asesor", anchors: ["asesor-pasos"],
      keys: [["asesor", "advisor"], ["pasos", "steps"], ["cobrar", "collect"]],
      steps: [
        { kind: "show", anchor: "asesor-pasos", caption: ["«Lo que yo haría ahora»: tres consejos, ordenados por peso.", "“What I would do now”: three tips, ordered by weight."] },
        { kind: "show", anchor: "asesor-pasos", caption: ["Cada tarjeta trae su cifra de impacto y sus botones de hacer.", "Each card carries its impact figure and its action buttons."], contexto: ["«Ver a quién» abre la lista: cada persona, con su frase propia.", "“See who” opens the list: each person, with their own line."] },
      ],
    },
    {
      id: "ad9-grupos-chequeos", chapter: "asesor", anchors: ["asesor-grupos", "asesor-chequeos"],
      keys: [["grupos", "groups"], ["chequeos", "checks"], ["estrellas", "stars"]],
      steps: [
        { kind: "show", anchor: "asesor-grupos", caption: ["Cinco grupos y cada cliente en uno solo: el primero que toca.", "Five groups and each client in just one: the first that fits."], contexto: ["El orden manda: Morosos, En riesgo, Ocasionales, Estrellas, Fieles.", "The order rules: Late payers, At risk, One-offs, Stars, Faithful."] },
        { kind: "show", anchor: "asesor-chequeos", caption: ["Cinco chequeos forman el puntaje: una media con pesos.", "Five checks form the score: a weighted average."] },
        { kind: "show", anchor: "asesor-chequeos", caption: ["Cobro pesa 30; Clientes, 25; los demás, 15 cada uno.", "Collecting weighs 30; Clients, 25; the rest, 15 each."], contexto: ["Abre un chequeo: te dice qué es «lo sano» y cómo llegar.", "Open a check: it shows what “healthy” is and how to reach it."] },
      ],
    },
    {
      id: "ad9-informes", chapter: "asesor", anchors: ["estudio"],
      keys: [["exportar", "export"], ["respaldo", "backup"]],
      steps: [
        { kind: "show", anchor: "estudio", caption: ["Para llevarte las cifras, el motor es el centro de exportación.", "To take figures with you, the engine is the export center."], contexto: ["El informe antiguo pegado al respaldo es otra pieza, más simple.", "The old report glued to the backup is another, simpler piece."] },
        { kind: "ref", topic: "asesor" },
      ],
    },
  ],
};
