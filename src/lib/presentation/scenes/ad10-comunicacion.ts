/**
 * AD10 · Comunicación completa — el arte entero tras Q5: el dictado en
 * español y su escalera de reserva, el dictado con traducción, «A inglés»
 * con su doble vía (verdad 1.5.69) y su glosario de jardinería, los
 * mensajes listos (incluidos los de lluvia de Clima), y la DOBLE puerta
 * de revisión antes de enviar — también en los saltos de llamada y
 * mapa. La app nunca envía sola y en esta lección NO se envía nada:
 * la segunda puerta se abre y se mira; jamás se confirma.
 * Censo I (I-1…I-20 verificados en código; el resto, contra
 * components/message-composer.tsx, lib/dictate.ts y lib/translate.ts) y
 * E-76 (mensajes de lluvia). Escenario: comunicacion-ruta.
 *
 * LATIDOS SIMULADOS (el conductor nunca depende de red viva ni de un
 * micrófono vivo): el dictado y la traducción se MUESTRAN — el texto que
 * producirían se teclea con pasos `type` y las tarjetas explican el
 * resto. Ningún paso toca «Sí, abrir…»: nada sale del aparato.
 *
 * ANCLAS NUEVAS (present; el integrador las registra y las acuña):
 *  - compositor-dictar    components/message-composer.tsx (botón Dictar)
 *  - compositor-ingles    components/message-composer.tsx (botón «A inglés»)
 *  - compositor-corregir  components/message-composer.tsx (botón Corregir)
 *  - compositor-listas    components/message-composer.tsx (fila de mensajes listos)
 *  - compositor-nota      components/message-composer.tsx (botón «Traer una nota»)
 *  - mensaje-confirmar    components/message-composer.tsx (la confirmación de envío; emisión en confirm-dialog)
 *  - clima-mensajes       routes/clima.tsx (sección de mensajes listos tras parar por lluvia)
 * Ya existían y se reusan: contact-row, tarjeta-mensaje,
 * tarjeta-whatsapp, tarjeta-llamada, tarjeta-mapa, mensaje-compositor,
 * mensaje-texto, mensaje-enviar.
 */
import type { Module } from "../guion.ts";

export const AD10: Module = {
  id: "ad10-comunicacion",
  n: 16,
  floor: "advanced",
  title: ["Comunicación completa", "Complete communication"],
  promise: [
    "Podrás dictar, traducir y enviar mensajes como un profesional en dos idiomas.",
    "You will be able to dictate, translate, and send messages like a professional in two languages.",
  ],
  ready: true,
  chapters: [
    { id: "dictar", title: ["Dictar, sin teclear", "Dictating, hands free"] },
    { id: "traducir", title: ["A inglés, bien dicho", "To English, said right"] },
    { id: "listos", title: ["Mensajes listos", "Ready messages"] },
    { id: "puerta", title: ["La doble puerta", "The double door"] },
  ],
  scenes: [
    {
      id: "ad10-abrir", chapter: "dictar", anchors: ["tarjeta-mensaje", "mensaje-compositor"],
      keys: [["mensaje", "message"], ["compositor", "composer"]],
      steps: [
        { kind: "stage", build: "comunicacion-ruta" },
        { kind: "go", screen: "/" },
        { kind: "do", anchor: "tarjeta-mensaje", caption: ["Abre el compositor de Don Aurelio: el arte completo empieza aquí.", "Open Don Aurelio's composer: the complete art starts here."] },
        { kind: "show", anchor: "mensaje-compositor", caption: ["Tres modos abajo: Escribir, Dictar y A inglés.", "Three modes below: Type, Dictate, and To English."] },
      ],
    },
    {
      id: "ad10-corregir", chapter: "dictar", anchors: ["compositor-corregir"],
      keys: [["corregir", "fix"], ["mensaje", "message"]],
      steps: [
        { kind: "show", anchor: "compositor-corregir", caption: ["Corregir pule tu texto sin cambiar lo que quieres decir.", "Fix polishes your text without changing what you mean."] },
        { kind: "show", anchor: "compositor-corregir", caption: ["Y el dictado ya nace puntuado: preguntas y exclamaciones en su sitio.", "And dictation is born punctuated: questions and exclamations in place."] },
      ],
    },
    {
      id: "ad10-dictar", chapter: "dictar", anchors: ["compositor-dictar", "mensaje-texto"],
      keys: [["dictar", "dictate"], ["micrófono", "microphone"], ["español", "spanish"]],
      steps: [
        { kind: "show", anchor: "compositor-dictar", caption: ["Dictar escucha en español y escribe mientras hablas.", "Dictate listens in Spanish and writes while you speak."] },
        { kind: "type", anchor: "mensaje-texto", text: ["¿A qué hora prefiere que pase mañana?", "What time would you prefer me to come by tomorrow?"], caption: ["Así cae un dictado: entero, con su pregunta puesta.", "This is how dictation lands: whole, with its question set."] },
      ],
    },
    {
      id: "ad10-dictar-control", chapter: "dictar", anchors: ["compositor-dictar", "mensaje-texto"],
      keys: [["dictar", "dictate"], ["oyendo", "listening"]],
      steps: [
        { kind: "show", anchor: "compositor-dictar", caption: ["Un segundo toque para el dictado: lo dicho se queda.", "A second tap stops dictation: what was said stays."] },
        { kind: "show", anchor: "mensaje-texto", caption: ["Lo parcial aparece en vivo: corriges antes de seguir dictando.", "Partial text appears live: you fix it before dictating on."] },
      ],
    },
    {
      id: "ad10-escalera", chapter: "dictar", anchors: ["compositor-dictar"],
      keys: [["dictar", "dictate"], ["ajustes", "settings"], ["permiso", "permission"]],
      steps: [
        { kind: "show", anchor: "compositor-dictar", caption: ["Si un servicio de voz falla, prueba el siguiente de la escalera.", "If one voice service fails, it tries the next on the ladder."], contexto: ["En la app manda el reconocedor del teléfono; en el navegador, su voz.", "In the app the phone's recognizer rules; in the browser, its voice."] },
        { kind: "show", anchor: "compositor-dictar", caption: ["Un error nombra el servicio y su código: nunca un silencio.", "An error names the service and its code: never silence."], contexto: ["Sin permiso, el aviso te lleva a Ajustes o a permitirlo ahí.", "Without permission, the notice takes you to Settings or allows it."] },
      ],
    },
    {
      id: "ad10-dictar-ingles", chapter: "traducir", anchors: ["compositor-ingles", "mensaje-texto"],
      keys: [["dictar", "dictate"], ["traducir", "translate"], ["inglés", "english"]],
      steps: [
        { kind: "show", anchor: "compositor-ingles", caption: ["Dictado con traducción: hablas español, cae en inglés.", "Dictation with translation: you speak Spanish, it lands in English."] },
        { kind: "show", anchor: "mensaje-texto", caption: ["El texto traducido llega a la misma caja, listo para revisar.", "The translated text lands in the same box, ready to review."], contexto: ["El micrófono solo vive mientras dictas: una línea lo recuerda.", "The microphone lives only while you dictate: one line reminds you."] },
      ],
    },
    {
      id: "ad10-a-ingles", chapter: "traducir", anchors: ["mensaje-texto", "compositor-ingles"],
      keys: [["a inglés", "to english"], ["traductor", "translator"], ["conexión", "connection"]],
      steps: [
        { kind: "type", anchor: "mensaje-texto", text: ["El jardín se corta mañana por la mañana.", "The yard will be cut tomorrow morning."], caption: ["Escribe en español primero: «A inglés» trabaja sobre tu texto.", "Write in Spanish first: “To English” works on your text."] },
        { kind: "show", anchor: "compositor-ingles", caption: ["Con conexión traduce el traductor en línea de Google.", "With a connection, it translates with Google's online translator."], contexto: ["Sin red manda el motor del teléfono: el mensaje no se queda preso.", "Offline the phone's engine rules: the message is never trapped."] },
        { kind: "show", anchor: "compositor-ingles", caption: ["Su glosario es de jardinería: jardín sale «yard», nunca «garden».", "Its glossary is gardening: jardín comes out “yard”, never “garden”."] },
      ],
    },
    {
      id: "ad10-descarga", chapter: "traducir", anchors: ["compositor-ingles", "mensaje-texto"],
      keys: [["traductor", "translator"], ["descargando", "downloading"]],
      steps: [
        { kind: "show", anchor: "compositor-ingles", caption: ["La primera vez, el traductor del teléfono se descarga una vez.", "The first time, the phone translator downloads once."] },
        { kind: "show", anchor: "mensaje-texto", caption: ["Una línea bajo el texto lo dice mientras baja: sin sorpresas.", "One line under the text says so while it downloads: no surprises."] },
      ],
    },
    {
      id: "ad10-listas", chapter: "listos", anchors: ["compositor-listas"],
      keys: [["mensajes listos", "ready messages"], ["editar", "edit"]],
      steps: [
        { kind: "show", anchor: "compositor-listas", caption: ["Mensajes listos: un toque y el texto entero cae en la caja.", "Ready messages: one tap and the whole text lands in the box."] },
        { kind: "show", anchor: "compositor-listas", caption: ["Edítalos a tu manera: hasta doce, con tus palabras de siempre.", "Edit them your way: up to twelve, in your usual words."] },
      ],
    },
    {
      id: "ad10-nota", chapter: "listos", anchors: ["compositor-nota", "mensaje-texto"],
      keys: [["nota", "note"], ["bloc", "notepad"]],
      steps: [
        { kind: "show", anchor: "compositor-nota", caption: ["Traer una nota pega lo del Bloc sin salir del mensaje.", "Bring a note pastes from the Pad without leaving the message."] },
        { kind: "show", anchor: "mensaje-texto", caption: ["La nota cae bajo tu texto: un solo mensaje, dos fuentes.", "The note lands below your text: one message, two sources."] },
      ],
    },
    {
      id: "ad10-lluvia", chapter: "listos", anchors: ["clima-mensajes"],
      keys: [["lluvia", "rain"], ["mensajes", "messages"], ["clima", "weather"]],
      verify: "La sección de mensajes de Clima (E-76) solo se pinta tras parar el día por lluvia con clientes afectados, y el clima del escenario es lectura viva: la escena enseña dónde vive y cómo se usa; si el ancla no resuelve, se salta con gracia.",
      steps: [
        { kind: "go", screen: "/clima" },
        { kind: "show", anchor: "clima-mensajes", caption: ["Tras parar por lluvia, Clima redacta el aviso por ti.", "After a rain stop, Weather drafts the notice for you."], contexto: ["Cada afectado trae sus botones: tú envías uno a uno, a mano.", "Each affected client brings their buttons: you send one by one."] },
      ],
    },
    {
      id: "ad10-puerta-envio", chapter: "puerta", anchors: ["tarjeta-mensaje", "mensaje-texto", "mensaje-enviar", "mensaje-confirmar"],
      keys: [["enviar", "send"], ["confirmar", "confirm"], ["revisar", "review"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "do", anchor: "tarjeta-mensaje", caption: ["Vuelve al compositor: mira la doble puerta antes de enviar.", "Return to the composer: watch the double door before sending."] },
        { kind: "type", anchor: "mensaje-texto", text: ["Hola, Don Aurelio. Mañana paso a las 9.", "Hello, Don Aurelio. I come by at 9 tomorrow."], caption: ["Un mensaje breve, listo para pasar las dos puertas.", "A short message, ready to pass both doors."] },
        { kind: "do", anchor: "mensaje-enviar", caption: ["Enviar no envía: abre la segunda puerta, con su nombre.", "Send does not send: it opens the second door, with their name."] },
        { kind: "show", anchor: "mensaje-confirmar", caption: ["Aquí decides tú: la app jamás envía por su cuenta.", "Here you decide: the app never sends on its own."], contexto: ["Confirmar solo abre Mensajes o WhatsApp con el texto listo.", "Confirming only opens Messages or WhatsApp with the text ready."] },
      ],
    },
    {
      id: "ad10-whatsapp", chapter: "puerta", anchors: ["tarjeta-whatsapp"],
      keys: [["whatsapp", "whatsapp"], ["abrir", "open"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-whatsapp", caption: ["WhatsApp pasa por la misma doble puerta, con su nombre.", "WhatsApp passes the same double door, with their name."], contexto: ["Si ese cliente no usa WhatsApp, el mensaje no llega: avísale antes.", "If that client has no WhatsApp, the message never arrives: warn them."] },
      ],
    },
    {
      id: "ad10-saltos", chapter: "puerta", anchors: ["tarjeta-llamada", "tarjeta-mapa"],
      keys: [["llamada", "call"], ["mapa", "map"], ["nombre", "name"]],
      steps: [
        { kind: "show", anchor: "tarjeta-llamada", caption: ["La llamada también pregunta por su nombre antes de marcar.", "The call also asks for their name before dialing."] },
        { kind: "show", anchor: "tarjeta-mapa", caption: ["Y el mapa confirma antes de abrirse con su dirección.", "And the map confirms before opening with their address."], contexto: ["Ningún salto sale sin nombre: así nadie contacta a otro cliente.", "No jump leaves without a name: nobody contacts the wrong client."] },
      ],
    },
    {
      id: "ad10-cierre", chapter: "puerta", anchors: ["contact-row"],
      keys: [["contacto", "contact"], ["mensaje", "message"]],
      steps: [
        { kind: "show", anchor: "contact-row", caption: ["Dictas, traduces, eliges un listo: y siempre revisas dos veces.", "You dictate, translate, pick a ready one: and always review twice."] },
        { kind: "ref", topic: "clima" },
      ],
    },
  ],
};
