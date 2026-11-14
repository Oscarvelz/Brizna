/**
 * AD13 · Manos y memoria — el swipe de páginas entero, la Malla que solo
 * cicla en el teléfono, Vista partida y ventana flotante con sus DOS
 * dobles toques distintos, el asa que miente, y el mapa completo de lo
 * efímero: qué persiste, qué es de sesión y qué se pierde (censo H,
 * mapa de persistencia A–D).
 *
 * SHOW-INSTEAD-OF-DO (declarado): el conductor no puede ejecutar un swipe
 * real ni un doble toque real — fingirlos con un toque sería mentir el
 * gesto. Esas escenas son ask/show sobre la superficie real, con el gesto
 * nombrado en el pie: ad13-swipe, ad13-estudio-flip, ad13-malla,
 * ad13-partida-doble, ad13-flotante-doble. Ninguna escena usa `do` ni
 * `press` para un gesto que el conductor no hace de verdad.
 *
 * ANCLAS NUEVAS (present; el integrador las registra en anchors.ts):
 *  - vista-menu      — components/app-shell.tsx (el menú/botón Vista)
 *  - asa-ruta        — components/job-card.tsx (el asa con data-drag-handle;
 *                      estado: ≥2 patios pendientes hoy)
 *  - asa-quieta      — components/job-card.tsx (los seis puntos sin handle)
 *  - deshacer-barra  — components/undo-bar.tsx (estado: hay historial)
 * El resto son anclas ya registradas (pestana-*, vistas, dia-hoy,
 * en-la-mira, tarjeta-*, agenda).
 */
import type { Module } from "../guion.ts";

export const AD13: Module = {
  id: "ad13-manos",
  n: 19,
  floor: "advanced",
  title: ["Manos y memoria", "Hands and memory"],
  promise: [
    "Podrás moverte como un experto y saber qué recuerda la app y qué olvida.",
    "You will be able to move like an expert and know what the app remembers and what it forgets.",
  ],
  ready: true,
  chapters: [
    { id: "deslizar", title: ["Deslizar entre pestañas", "Swiping between tabs"] },
    { id: "malla", title: ["La Malla que cicla", "The cycling Grid"] },
    { id: "dos-sitios", title: ["Dos sitios a la vez", "Two places at once"] },
    { id: "asa", title: ["El asa — y el asa que miente", "The grip — and the grip that lies"] },
    { id: "memoria", title: ["Qué se queda, qué se va", "What stays, what goes"] },
  ],
  scenes: [
    {
      id: "ad13-swipe", chapter: "deslizar", anchors: ["pestana-agenda"],
      keys: [["deslizar", "swipe"], ["pestañas", "tabs"]],
      steps: [
        { kind: "stage", build: "ruta-manos" },
        { kind: "go", screen: "/" },
        { kind: "ask", anchor: "pestana-agenda", caption: ["¿Cambiar de pestaña sin tocar botones? Desliza la página entera.", "Change tabs without touching buttons? Swipe the whole page."] },
        { kind: "show", anchor: "pestana-agenda", caption: ["Hoy, Agenda, Clientes, Cobros, Estudio — y vuelta circular.", "Today, Schedule, Clients, Payments, Stats — and around again."], contexto: ["La página sigue a tu dedo en vivo; también funciona arrastrando con el ratón.", "The page follows your finger live; dragging with the mouse works too."] },
      ],
    },
    {
      id: "ad13-swipe-freno", chapter: "deslizar", anchors: ["pestana-hoy"],
      keys: [["deslizar", "swipe"], ["atrás", "back"]],
      steps: [
        { kind: "show", anchor: "pestana-hoy", caption: ["El swipe no arranca en campos, mapas ni diálogos.", "The swipe never starts in fields, maps, or dialogs."], contexto: ["Los bordes de 24 píxeles quedan libres para el Atrás de Android.", "The 24-pixel edges stay free for Android's Back gesture."] },
      ],
    },
    {
      id: "ad13-estudio-flip", chapter: "deslizar", anchors: ["pestana-estudio"],
      keys: [["estudio", "stats"], ["asesor", "advisor"], ["deslizar", "swipe"]],
      steps: [
        { kind: "go", screen: "/estadisticas" },
        { kind: "show", anchor: "pestana-estudio", caption: ["Dentro de Estudio, deslizar voltea Estudio y Asesor.", "Inside Stats, swiping flips between Stats and Advisor."], contexto: ["Ese swipe nunca sale de la pestaña: solo cambia la cara.", "That swipe never leaves the tab: it only flips the side."] },
      ],
    },
    {
      id: "ad13-malla", chapter: "malla", anchors: ["vistas"],
      keys: [["malla", "grid"], ["columnas", "columns"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "ask", anchor: "vistas", caption: ["¿Ya estás en Malla? Tócala otra vez.", "Already on Grid? Tap it again."] },
        { kind: "show", anchor: "vistas", caption: ["Cada toque extra cicla las columnas: dos, tres, cuatro, dos.", "Each extra tap cycles the columns: two, three, four, two."], contexto: ["El ciclo solo existe en el teléfono; en pantalla grande, siempre dos.", "The cycle exists only on the phone; on big screens, always two."] },
      ],
    },
    {
      id: "ad13-vista-menu", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["vista", "view"], ["2 pantallas", "2 screens"]],
      steps: [
        { kind: "show", anchor: "vista-menu", caption: ["El menú Vista parte la pantalla y abre la ventana flotante.", "The View menu splits the screen and opens the floating window."] },
      ],
    },
    {
      id: "ad13-partida", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["barra del medio", "middle bar"], ["reparte el espacio", "shares the space"]],
      steps: [
        { kind: "show", anchor: "vista-menu", caption: ["Partida: arrastra el divisor central para repartir el espacio.", "Split: drag the center divider to share the space."], contexto: ["Las flechas del teclado mueven el divisor de cuatro en cuatro.", "The keyboard arrows move the divider four percent at a time."] },
      ],
    },
    {
      id: "ad13-partida-doble", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["doble toque", "double tap"], ["barra del medio", "middle bar"]],
      steps: [
        { kind: "ask", anchor: "vista-menu", caption: ["¿Divisor desparejo? Doble toque sobre él.", "Divider uneven? Double-tap on it."] },
        { kind: "show", anchor: "vista-menu", caption: ["El doble toque en el divisor lo centra exactamente.", "Double-tapping the divider centers it exactly."] },
      ],
      verify: "Censo H V-3: el colapso de un panel a tira de iconos no se localizó en el código — esta escena no lo enseña.",
    },
    {
      id: "ad13-flotante", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["flotante", "floating"], ["ventana", "window"]],
      steps: [
        { kind: "show", anchor: "vista-menu", caption: ["La flotante se mueve por su barra y crece desde cualquier borde.", "The floater moves by its bar and grows from any edge."], contexto: ["Dentro lleva sus cinco pestañas; Alt más F la abre o la pliega.", "It carries its five tabs inside; Alt plus F opens or folds it."] },
      ],
    },
    {
      id: "ad13-flotante-doble", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["doble toque", "double tap"], ["flotante", "floating"]],
      steps: [
        { kind: "ask", anchor: "vista-menu", caption: ["¿Otro doble toque? Este vive en los bordes flotantes.", "Another double tap? This one lives on the floater's edges."] },
        { kind: "show", anchor: "vista-menu", caption: ["Doble toque en un borde: se expande; otro, vuelve.", "Double-tap an edge: it expands; again, it returns."], contexto: ["No es el doble toque del divisor: cada uno manda en su sitio.", "Not the divider's double tap: each rules its own place."] },
      ],
    },
    {
      id: "ad13-flotante-burbuja", chapter: "dos-sitios", anchors: ["vista-menu"],
      keys: [["burbuja", "bubble"], ["flotante", "floating"], ["plegar en burbuja", "fold into bubble"]],
      steps: [
        { kind: "show", anchor: "vista-menu", caption: ["El menos la pliega en burbuja; tocarla la despliega.", "The minus folds it into a bubble; tapping it unfolds it."], contexto: ["Su botón de transparencia cicla: entera, ochenta, sesenta, entera.", "Its transparency button cycles: full, eighty, sixty, full."] },
      ],
    },
    {
      id: "ad13-asa", chapter: "asa", anchors: ["asa-ruta"],
      keys: [["asa", "grip"], ["ruta", "route"], ["arrastra", "drag"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "asa-ruta", caption: ["Mantén el asa de seis puntos y arrastra: reordenas la ruta.", "Hold the six-dot grip and drag: you reorder the route."], contexto: ["El orden nuevo se guarda solo al soltar la tarjeta.", "The new order saves by itself when you release the card."] },
      ],
    },
    {
      id: "ad13-asa-miente", chapter: "asa", anchors: ["asa-quieta"],
      keys: [["asa", "grip"], ["fijados", "pinned"]],
      steps: [
        { kind: "ask", anchor: "asa-quieta", caption: ["¿Y estos puntos iguales? No arrastran nada.", "And these identical dots? They drag nothing."] },
        { kind: "show", anchor: "asa-quieta", caption: ["Fijados y Hechos dibujan los puntos como ancla quieta.", "Pinned and Done draw the dots as a quiet anchor."], contexto: ["En Lista no hay asa: su lugar lo ocupa el pin desnudo.", "List has no grip at all: the bare pin takes its place."] },
      ],
    },
    {
      id: "ad13-agenda-mover", chapter: "asa", anchors: ["agenda"],
      keys: [["agenda", "schedule"], ["mover", "move"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["En Agenda, reordenar pide primero el botón Mover.", "In Schedule, reordering first asks for the Move button."], contexto: ["Mover solo aparece con el filtro Pendiente: es su puerta.", "Move only appears with the Pending filter: that is its gate."] },
      ],
    },
    {
      id: "ad13-persiste-libro", chapter: "memoria", anchors: ["tarjeta-nombre"],
      keys: [["memoria", "memory"], ["libro", "book"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["Primera capa: el libro sobrevive a todo. Clientes, cortes, pagos.", "First layer: the book survives everything. Clients, cuts, payments."], contexto: ["Regla de oro: si no pulsaste Guardar, no está en esta capa.", "Golden rule: without tapping Save, it is not in this layer."] },
      ],
    },
    {
      id: "ad13-persiste-aparato", chapter: "memoria", anchors: ["vistas"],
      keys: [["memoria", "memory"], ["tema", "theme"]],
      steps: [
        { kind: "show", anchor: "vistas", caption: ["Segunda capa: este aparato recuerda tema, idioma y densidad.", "Second layer: this device remembers theme, language, and density."], contexto: ["También la partida, la flotante, los pins y los órdenes.", "Also the split, the floater, the pins, and the orders."] },
      ],
    },
    {
      id: "ad13-sesion", chapter: "memoria", anchors: ["dia-hoy"],
      keys: [["sesión", "session"], ["borrador", "draft"]],
      steps: [
        { kind: "show", anchor: "dia-hoy", caption: ["Tercera capa: solo sesión. Borradores de nota y pliegues abiertos.", "Third layer: session only. Note drafts and open folds."], contexto: ["Sobreviven a recargar; mueren al cerrar la app de verdad.", "They survive a reload; they die when the app truly closes."] },
      ],
    },
    {
      id: "ad13-hoy-renace", chapter: "memoria", anchors: ["dia-hoy"],
      keys: [["hoy", "today"], ["memoria", "memory"]],
      steps: [
        { kind: "show", anchor: "dia-hoy", caption: ["Hoy siempre renace igual: solo el día de hoy abierto.", "Today always reopens the same: only today's fold open."] },
      ],
    },
    {
      id: "ad13-busquedas", chapter: "memoria", anchors: ["pestana-clientes"],
      keys: [["buscar", "search"], ["filtro", "filter"]],
      steps: [
        { kind: "show", anchor: "pestana-clientes", caption: ["Buscar y ordenar se pierde al salir de la pantalla.", "Searching and sorting are lost when you leave the screen."], contexto: ["Lo que va en la dirección sí sobrevive: filtro, vista, carpeta.", "What rides in the address survives: filter, view, folder."] },
      ],
    },
    {
      id: "ad13-direccion", chapter: "memoria", anchors: ["tarjeta-estado"],
      keys: [["dirección", "address"], ["estado", "status"]],
      steps: [
        { kind: "show", anchor: "tarjeta-estado", caption: ["La dirección revelada y esta tarjeta viven solo aquí.", "The revealed address and this card live only here."], contexto: ["Cambiar de pestaña o recargar las vuelve a esconder.", "Changing tab or reloading hides them again."] },
      ],
    },
    {
      id: "ad13-deshacer", chapter: "memoria", anchors: ["deshacer-barra"],
      keys: [["deshacer", "undo"], ["memoria", "memory"]],
      steps: [
        { kind: "show", anchor: "deshacer-barra", caption: ["Deshacer guarda veinte acciones, solo en esta apertura.", "Undo holds twenty actions, only in this opening."], contexto: ["Recargar vacía la pila: lo hecho queda hecho en el libro.", "Reloading empties the stack: what is done stays in the book."] },
      ],
      verify: "Censo H V-2: la semilla decía que las flechas nunca se desactivan; el código no pinta la barra sin historial. Se enseña el código.",
    },
    {
      id: "ad13-puente", chapter: "memoria", anchors: ["pestana-agenda"],
      keys: [["deslizar", "swipe"], ["memoria", "memory"]],
      steps: [
        { kind: "show", anchor: "pestana-agenda", caption: ["El swipe guarda fotos de tus pestañas por cinco minutos.", "The swipe keeps snapshots of your tabs for five minutes."], contexto: ["Por eso volver se siente instantáneo; recargar borra esas fotos.", "That is why returning feels instant; reloading erases those snapshots."] },
      ],
    },
    {
      id: "ad13-cierre", chapter: "memoria", anchors: ["pestana-hoy"],
      keys: [["memoria", "memory"], ["guardar", "save"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "ask", anchor: "pestana-hoy", caption: ["¿La frase que queda? Buscar no guarda; Guardar, sí.", "The phrase that stays? Searching saves nothing; Save does."] },
        { kind: "show", anchor: "pestana-hoy", caption: ["Y sin red, guardado aquí significa: en la cola, esperando.", "And offline, saved here means: in the queue, waiting."] },
      ],
    },
  ],
};
