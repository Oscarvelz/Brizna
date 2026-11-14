/**
 * Q5 · Hablar con el cliente — los cuatro botones de la tarjeta y sus
 * tonos, la presión larga del mapa (550 ms, la dirección secreta), y un
 * mensaje escrito de principio a fin hasta la puerta de revisión: la app
 * nunca envía sola, y esta lección NO envía nada (escenario ficticio).
 * Censo I y A-55/H-1. Escenario: ruta-base (Don Aurelio, hoy).
 * «A inglés» se nombra en general, sin motor: con conexión traduce el
 * traductor en línea y sin red el del teléfono (verdad 1.5.69); su lección
 * entera es AD10.
 */
import type { Module } from "../guion.ts";

export const Q5: Module = {
  id: "q5-hablar",
  n: 5,
  floor: "quick",
  title: ["Hablar con el cliente", "Talking with the client"],
  promise: [
    "Podrás contactar a cualquier cliente desde su tarjeta y escribirle un mensaje completo sin miedo.",
    "You will be able to contact any client from their card and write them a complete message without fear.",
  ],
  ready: true,
  chapters: [
    { id: "botones", title: ["Los cuatro botones", "The four buttons"] },
    { id: "mapa", title: ["El mapa y su secreto", "The map and its secret"] },
    { id: "escribir", title: ["Escribir el mensaje", "Writing the message"] },
  ],
  scenes: [
    {
      id: "q5-fila", chapter: "botones", anchors: ["contact-row"],
      keys: [["contacto", "contact"], ["botones", "buttons"], ["tarjeta", "card"]],
      steps: [
        { kind: "stage", build: "ruta-base" },
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "contact-row", caption: ["Cuatro botones hablan con el cliente sin salir de su tarjeta.", "Four buttons talk with the client without leaving their card."] },
      ],
    },
    {
      id: "q5-mensaje", chapter: "botones", anchors: ["tarjeta-mensaje"],
      keys: [["mensaje", "message"], ["color", "color"]],
      steps: [{ kind: "show", anchor: "tarjeta-mensaje", caption: ["Mensaje, en mostaza: abre el compositor para escribirle aquí mismo.", "Message, in mustard: it opens the composer to write right here."] }],
    },
    {
      id: "q5-whatsapp", chapter: "botones", anchors: ["tarjeta-whatsapp"],
      keys: [["whatsapp", "whatsapp"], ["verde", "green"]],
      steps: [{ kind: "show", anchor: "tarjeta-whatsapp", caption: ["WhatsApp, en verde: se reconoce por sus letras WA.", "WhatsApp, in green: you know it by its WA letters."] }],
    },
    {
      id: "q5-llamada", chapter: "botones", anchors: ["tarjeta-llamada"],
      keys: [["llamada", "call"], ["confirmar", "confirm"], ["teléfono", "phone"]],
      steps: [{ kind: "show", anchor: "tarjeta-llamada", caption: ["Llamada, en azul: antes de marcar, pregunta por su nombre.", "Call, in blue: before dialing, it asks for their name."], contexto: ["Cada salto confirma con el nombre: así no contactas a otro cliente.", "Every jump confirms the name first: you never contact the wrong client."] }],
    },
    {
      id: "q5-mapa", chapter: "mapa", anchors: ["tarjeta-mapa"],
      keys: [["mapa", "map"], ["rojo", "red"], ["dirección", "address"]],
      steps: [{ kind: "show", anchor: "tarjeta-mapa", caption: ["Mapa, en rojo: un toque abre Google Maps con su dirección.", "Map, in red: one tap opens Google Maps with their address."] }],
    },
    {
      id: "q5-direccion", chapter: "mapa", anchors: ["tarjeta-mapa"],
      keys: [["dirección", "address"], ["mantener", "press"]],
      steps: [{ kind: "press", anchor: "tarjeta-mapa", ms: 550, caption: ["Mantén el mapa: su dirección secreta aparece bajo los botones.", "Hold the map button: their secret address appears under the buttons."], contexto: ["La tarjeta nunca enseña la calle: mantener es verla; tocar, ir a ella.", "The card never shows the street: holding shows it; tapping goes there."] }],
    },
    {
      id: "q5-abrir", chapter: "escribir", anchors: ["tarjeta-mensaje", "mensaje-compositor"],
      keys: [["mensaje", "message"], ["compositor", "composer"]],
      steps: [
        { kind: "do", anchor: "tarjeta-mensaje", caption: ["Abre el mensaje de Don Aurelio.", "Open Don Aurelio's message."] },
        { kind: "show", anchor: "mensaje-compositor", caption: ["El compositor: escribes, dictas o pasas tu mensaje a inglés.", "The composer: you type, dictate, or turn your message into English."] },
      ],
    },
    {
      id: "q5-texto", chapter: "escribir", anchors: ["mensaje-texto"],
      keys: [["escribir", "write"], ["mensaje", "message"]],
      steps: [{ kind: "type", anchor: "mensaje-texto", text: ["Hola, Don Aurelio. Hoy llego a las 10.", "Hello, Don Aurelio. I'll arrive at 10 today."], caption: ["Escribe como hablas: la app ordena el texto por ti.", "Write as you speak: the app tidies the text for you."] }],
    },
    {
      id: "q5-revisar", chapter: "escribir", anchors: ["mensaje-enviar"],
      keys: [["enviar", "send"], ["revisar", "review"]],
      steps: [{ kind: "show", anchor: "mensaje-enviar", caption: ["Antes de enviar, siempre revisas: la app nunca envía sola.", "Before sending, always review: the app never sends on its own."], contexto: ["Enviar pregunta una vez más a quién va: esa puerta evita el cliente equivocado.", "Sending asks once more who it goes to: that door avoids the wrong client."] }],
    },
    {
      id: "q5-cierre", chapter: "escribir", anchors: ["contact-row"],
      keys: [["colores", "colors"], ["contacto", "contact"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "contact-row", caption: ["Mostaza, verde, azul, rojo: cada color es un canal.", "Mustard, green, blue, red: each color is a channel."] },
      ],
    },
  ],
};
