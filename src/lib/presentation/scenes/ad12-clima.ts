/**
 * AD12 · El clima que decide — el cielo como instrumento de trabajo: el
 * veredicto Cortar / Esperar / Alerta con sus umbrales, el Plan de hoy a
 * ~45 minutos por patio, el radar, la honestidad de la lectura («Datos
 * de las H:MM») y el cielo que repinta toda la app. Los mensajes tras
 * parar por lluvia se enseñan en AD10 (E-76); aquí se decide.
 * Censo E (E-66…E-77). Escenario: clima-dia.
 *
 * EL CLIMA ES LECTURA VIVA: ninguna escena afirma un pronóstico. Los
 * pies enseñan el INSTRUMENTO — dónde vive el veredicto y cómo se lee —
 * y las escenas cuyo ancla depende del estado vivo llevan `verify` y
 * palabras condicionales.
 *
 * ANCLAS NUEVAS (present salvo nota; el integrador las registra):
 *  - clima          spot "clima"   routes/clima.tsx (el héroe «Para el trabajo»)
 *  - clima-pastilla present         components/weather-chip.tsx (la pastilla de la cabecera)
 *  - clima-lugar    present         routes/clima.tsx (la cabecera del lugar)
 *  - clima-plan     present         routes/clima.tsx (la tarjeta «Plan de hoy»)
 *  - clima-hechos   present         routes/clima.tsx (lluvia, viento y humedad)
 *  - clima-horas    present         routes/clima.tsx (la tira de próximas horas)
 *  - clima-radar    present         routes/clima.tsx (la tarjeta del radar)
 *  - clima-manana   present         routes/clima.tsx (mañana y consejos)
 *  - clima-datos    present         routes/clima.tsx (la línea «Datos de las…»)
 *  - clima-parar    present         routes/clima.tsx (el botón «Parar el día»)
 * Ninguna ancla de este módulo existía en el registro: todas son
 * nuevas y se listan arriba.
 */
import type { Module } from "../guion.ts";

export const AD12: Module = {
  id: "ad12-clima",
  n: 18,
  floor: "advanced",
  title: ["El clima que decide", "The weather that decides"],
  promise: [
    "Podrás decidir cortar, esperar o avisar con el clima como instrumento.",
    "You will be able to decide to mow, wait, or warn with the weather as an instrument.",
  ],
  ready: true,
  chapters: [
    { id: "decidir", title: ["El veredicto y el plan", "The verdict and the plan"] },
    { id: "instrumentos", title: ["Los instrumentos", "The instruments"] },
    { id: "honestidad", title: ["Honestidad y aviso", "Honesty and warning"] },
  ],
  scenes: [
    {
      id: "ad12-pastilla", chapter: "decidir", anchors: ["clima-pastilla"],
      keys: [["clima", "weather"], ["chip", "chip"]],
      steps: [
        { kind: "stage", build: "clima-dia" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "clima-pastilla", caption: ["La pastilla de la cabecera trae el cielo a cada pantalla.", "The header chip brings the sky to every screen."] },
        { kind: "show", anchor: "clima-pastilla", caption: ["Temperatura en °C y °F; un toque abre Clima entero.", "Temperature in °C and °F; one tap opens full Weather."] },
      ],
    },
    {
      id: "ad12-lugar", chapter: "decidir", anchors: ["clima-lugar"],
      keys: [["lugar", "place"], ["ubicación", "location"], ["código postal", "zip code"]],
      steps: [
        { kind: "go", screen: "/clima" },
        { kind: "show", anchor: "clima-lugar", caption: ["El lugar manda en todo el clima; de fábrica, Miami.", "The place rules all weather; Miami by default."] },
        { kind: "show", anchor: "clima-lugar", caption: ["«Mi ubicación» pide el GPS solo cuando lo tocas.", "“My location” asks for GPS only when you tap it."], contexto: ["Nunca al abrir: tu lugar se busca por código postal o ciudad.", "Never on opening: your place is found by ZIP code or city."] },
        { kind: "show", anchor: "clima-lugar", caption: ["Cambiar el lugar avisa a toda la app: chip, cielo y Clima.", "Changing the place tells the whole app: chip, sky, and Weather."] },
      ],
    },
    {
      id: "ad12-veredicto", chapter: "decidir", anchors: ["clima"],
      keys: [["cortar", "mow"], ["esperar", "wait"], ["alerta", "alert"]],
      verify: "El veredicto concreto (Cortar/Esperar/Alerta) y la frase del héroe dependen de la lectura viva del escenario: la escena enseña dónde vive y sus umbrales, nunca afirma el pronóstico del día.",
      steps: [
        { kind: "ask", anchor: "clima", caption: ["¿Cortar, esperar o alerta? El héroe lo decide por ti.", "Mow, wait, or alert? The hero decides for you."] },
        { kind: "show", anchor: "clima", caption: ["Tormenta cercana es Alerta; pasto mojado, Esperar.", "A nearby storm is Alert; wet grass, Wait."], contexto: ["Lluvia cerca dice corta lo urgente; viento fuerte, el recorte vuela.", "Rain nearby says cut the urgent; strong wind, clippings fly."] },
        { kind: "show", anchor: "clima", caption: ["Junto al veredicto: temperatura, sensación y máxima y mínima.", "Beside the verdict: temperature, feels-like, and high and low."] },
      ],
    },
    {
      id: "ad12-plan", chapter: "decidir", anchors: ["clima-plan"],
      keys: [["plan de hoy", "today's plan"], ["patios", "yards"], ["ventana", "window"]],
      steps: [
        { kind: "show", anchor: "clima-plan", caption: ["El Plan de hoy cruza la ventana seca con tus patios.", "Today's plan crosses the dry window with your yards."] },
        { kind: "show", anchor: "clima-plan", caption: ["Cuenta unos 45 minutos por patio: caben todos, unos, o lo urgente.", "It counts about 45 minutes per yard: all fit, some, or the urgent."], contexto: ["La lluvia tras el anochecer no cambia el día: se corta ahí.", "Rain after nightfall does not change the day: the window ends there."] },
        { kind: "show", anchor: "clima-plan", caption: ["Su consejo cambia con el cielo: tormenta, pasto mojado, viento, calor.", "Its advice changes with the sky: storm, wet grass, wind, heat."] },
      ],
    },
    {
      id: "ad12-hechos", chapter: "instrumentos", anchors: ["clima-hechos"],
      keys: [["lluvia", "rain"], ["viento", "wind"], ["humedad", "humidity"]],
      steps: [
        { kind: "show", anchor: "clima-hechos", caption: ["Tres instrumentos dibujados: la gota, la manga y el anillo.", "Three drawn instruments: the drop, the windsock, and the ring."] },
        { kind: "show", anchor: "clima-hechos", caption: ["La manga es el dato: colgando, calma; horizontal, 35 o más.", "The windsock is the data: hanging, calm; horizontal, 35 or more."] },
        { kind: "show", anchor: "clima-hechos", caption: ["La gota se llena con la lluvia de la próxima hora.", "The drop fills with the rain of the next hour."] },
      ],
    },
    {
      id: "ad12-horas", chapter: "instrumentos", anchors: ["clima-horas"],
      keys: [["próximas horas", "next hours"], ["lluvia", "rain"]],
      steps: [
        { kind: "show", anchor: "clima-horas", caption: ["Las próximas 12 horas, en una frase llana y una tira.", "The next 12 hours, in one plain sentence and a strip."] },
        { kind: "show", anchor: "clima-horas", caption: ["Curva de temperatura y barritas de lluvia, hora a hora.", "Temperature curve and rain bars, hour by hour."] },
      ],
    },
    {
      id: "ad12-radar", chapter: "instrumentos", anchors: ["clima-radar"],
      keys: [["radar", "radar"], ["lluvia", "rain"], ["mapa", "map"]],
      steps: [
        { kind: "show", anchor: "clima-radar", caption: ["El radar repite la última hora de lluvia, en bucle.", "The radar replays the last hour of rain, in a loop."] },
        { kind: "show", anchor: "clima-radar", caption: ["Pellizca, arrastra y centra: tu zona es el punto de tu color.", "Pinch, drag, and center: your area is the dot in your color."], contexto: ["Los puntos-momento saltan a un instante; tocar uno pausa el bucle.", "The moment dots jump to an instant; tapping one pauses the loop."] },
        { kind: "show", anchor: "clima-radar", caption: ["Calles o Satélite arriba; la escala «ligera a fuerte», abajo.", "Streets or Satellite above; the “light to heavy” scale, below."] },
      ],
    },
    {
      id: "ad12-manana", chapter: "instrumentos", anchors: ["clima-manana"],
      keys: [["mañana", "tomorrow"], ["sol", "sun"], ["humedad", "humidity"]],
      steps: [
        { kind: "show", anchor: "clima-manana", caption: ["Mañana se recomienda contra hoy: recuperar patios, solo si conviene.", "Tomorrow is weighed against today: recover yards only if wise."] },
        { kind: "show", anchor: "clima-manana", caption: ["Sol fuerte y humedad alta traen su frase de trabajo, no solo datos.", "Strong sun and high humidity bring their work line, not just data."] },
        { kind: "show", anchor: "clima-manana", caption: ["Su barra de probabilidad dice la lluvia antes que el icono.", "Its probability bar tells the rain before the icon does."] },
      ],
    },
    {
      id: "ad12-cielo", chapter: "honestidad", anchors: ["clima-pastilla"],
      keys: [["cielo", "sky"], ["fondo", "background"], ["clima", "weather"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "clima-pastilla", caption: ["El cielo de la lectura repinta el fondo de toda la app.", "The reading's sky repaints the background of the whole app."] },
        { kind: "show", anchor: "clima-pastilla", caption: ["Nubes, lluvia, niebla o nieve: la app viste el tiempo que hace.", "Clouds, rain, fog, or snow: the app dresses as the weather outside."], contexto: ["De noche, luciérnagas a la deriva, más grandes en Hoy y Cobros.", "At night, drifting fireflies, larger on Today and Payments."] },
        { kind: "show", anchor: "clima-pastilla", caption: ["Al abrir restaura la última lectura reciente; refresca cada 20 minutos.", "On opening it restores the last recent reading; refreshes every 20 minutes."] },
      ],
    },
    {
      id: "ad12-honestidad", chapter: "honestidad", anchors: ["clima-datos"],
      keys: [["datos", "data"], ["conexión", "connection"], ["lectura", "reading"]],
      verify: "La línea «Datos de las H:MM» solo se pinta cuando lo visible es la copia guardada (hasta 6 horas) o falló la renovación: la escena la enseña condicionalmente; si la lectura es fresca, el ancla puede no resolverse y la escena se salta con gracia.",
      steps: [
        { kind: "go", screen: "/clima" },
        { kind: "show", anchor: "clima-datos", caption: ["Si lo que ves es una copia, lo dice: «Datos de las…».", "If what you see is a copy, it says so: “Data from…”."] },
        { kind: "show", anchor: "clima-datos", caption: ["Sin conexión lo dice más claro aún, con su hora.", "Offline it says so even more clearly, with the time."], contexto: ["La copia dura hasta seis horas mientras llega la lectura fresca.", "The copy lasts up to six hours while the fresh reading arrives."] },
      ],
    },
    {
      id: "ad12-parar", chapter: "honestidad", anchors: ["clima-parar"],
      keys: [["parar el día", "stop the day"], ["lluvia", "rain"]],
      verify: "El botón se marca solo cuando la lluvia está cerca en la lectura viva; con cielo seco puede verse sin marcar. La escena enseña su sitio y su efecto, sin afirmar que hoy llueva.",
      steps: [
        { kind: "show", anchor: "clima-parar", caption: ["Con lluvia cerca, «Parar el día» se marca solo, aquí mismo.", "With rain near, “Stop the day” marks itself, right here."] },
        { kind: "show", anchor: "clima-parar", caption: ["Confirmas el motivo y los patios pasan al siguiente día abierto.", "You confirm the reason and yards move to the next open day."], contexto: ["Los mensajes a los afectados viven en Comunicación completa (AD10).", "The messages to those affected live in Complete communication (AD10)."] },
      ],
    },
    {
      id: "ad12-cierre", chapter: "honestidad", anchors: ["clima"],
      keys: [["cortar", "mow"], ["clima", "weather"]],
      steps: [
        { kind: "show", anchor: "clima", caption: ["Veredicto, plan e instrumentos: decides cortar, esperar o avisar.", "Verdict, plan, and instruments: you decide to mow, wait, or warn."] },
        { kind: "ref", topic: "clima" },
      ],
    },
  ],
};
