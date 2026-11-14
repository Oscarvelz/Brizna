/**
 * AD11 · Bloc y Fichero — las notas como memoria del negocio: escribir
 * con @menciones que aterrizan en la ficha, guardar como acto con su
 * carpeta, el borrador protegido en TRES ranuras y lo que SÍ se pierde
 * al cerrar de verdad, la calculadora que custodia el cursor, el doble
 * toque Notas → Fichero, y la papelera con su caducidad.
 * Censo E (E-46…E-65) y H-2 (el doble toque de 320 ms vive en el shell).
 * Escenario: bloc-notas (una nota guardada que menciona a Don Aurelio
 * y una nota en la papelera).
 *
 * RONDA DE CIERRE (2026-11-14, orden de Oscar: NOTAS caminadas enteras):
 *  - NACER (ad11-crear): la puerta «Nota nueva» se TOCA, se teclea la
 *    primera línea y el borrador se reconoce sin re-enseñarlo; la escena
 *    termina donde ad11-guardar empieza (el contexto lo dice, no se
 *    duplica el acto de guardar).
 *  - POR CLIENTE (capítulo «cliente»): la ficha de Don Aurelio tiene SU
 *    editor (ficha-nota-texto, RichNotes con otra moneda), que guarda al
 *    salir del texto —la línea de estado de la sección es la prueba— y
 *    lista las páginas del Bloc enlazadas por su nombre; tocar una la
 *    abre en el Bloc.
 *  - FIJAR CAMINADO (ad11-fijadas → ad11-fijada-hoy → ad11-desfijar):
 *    la nota que se fija es LA QUE EL ALUMNO ESCRIBIÓ (nace en crear,
 *    se enlaza en menciones, se guarda en guardar y sigue abierta tras
 *    borrador/qué-se-pierde). La fijada de la semilla («Poda y
 *    materiales») queda como inquilina previa de la tira: la aritmética
 *    de la tira es 1 → 2 → 1, y la semilla suma además una nota suelta
 *    sin fijar en «Materiales». El color enseñado es el del CSS
 *    (H-18): fijada se pinta de VERDE, nunca rosa. El regreso de Hoy no
 *    usa «go /notas» a pelo (abriría un borrador y perdería la nota):
 *    vuelve por la ficha, donde la lista enlazada ordena fijadas
 *    primero y por recencia — la primera enlazada ES la nota recién
 *    fijada (su guardado al fijar la deja la más reciente).
 *
 * EL DOBLE TOQUE NO TIENE PASO DE GRAMÁTICA: el conductor toca con un
 * clic y el shell distingue simple/doble por su ventana de 320 ms.
 * Por eso la entrada al Fichero se NARRA sobre el botón de Notas
 * (show) y la escena entra por la ruta: show-instead-of-do, con su
 * razón declarada aquí y en el informe.
 *
 * ANCLAS NUEVAS (present salvo nota; el integrador las registra):
 *  - notas            spot "notas"     routes/notas.tsx (el editor del Bloc)
 *  - fichero          spot "fichero"   routes/fichero.tsx (la rejilla de carpetas)
 *  - nota-texto       present          components/rich-notes.tsx (el área de escritura)
 *  - nota-guardar     present          routes/notas.tsx (botón Guardar)
 *  - nota-fijar       present          routes/notas.tsx (el pin de la nota)
 *  - nota-mover       present          routes/notas.tsx (botón «Mover a…» del lector)
 *  - nota-buscar      present          routes/notas.tsx (lupa de buscar en la nota)
 *  - nota-calculadora present          components/money-calc.tsx (QuickPad; la prop present ya existe)
 *  - notas-semana     present          routes/notas.tsx (el acordeón «Esta semana»)
 *  - notas-puerta     present          components/app-shell.tsx (NotesDoor: el botón de Notas)
 *  - fichero-papelera present          routes/fichero.tsx (la papelera, en el engranaje)
 *  - nota-nueva       present          routes/notas.tsx (el botón flotante «Nota nueva» del teléfono)
 *  - notas-tira-fijadas present        routes/notas.tsx (la tira de fijadas arriba del Bloc)
 *  - nota-desfijar-confirmar present   routes/notas.tsx (confirmar al desfijar; emisión en confirm-dialog)
 *  - nota-guardada-quedarme present    routes/notas.tsx (el «Quedarme» del diálogo tras guardar; emisión en confirm-dialog vía presentCancel — ronda de cierre: el diálogo modal se responde como compás, no se deja puesto)
 *  - hoy-nota-fijada  present          routes/index.tsx (la sección «Notas fijadas» de Hoy)
 *  - notas-cliente    spot "notas-cliente" routes/clientes.$id.tsx (la sección «Notas del cliente»)
 *  - ficha-nota-texto present          routes/clientes.$id.tsx (el editor propio de la ficha; emisión en rich-notes por prop)
 *  - ficha-nota-enlace present         routes/clientes.$id.tsx (cada página enlazada en la ficha; emisión familiar)
 * Dormido y NO enseñado: las fotos de notas (PHOTOS_ENABLED = false,
 * E-54) y «Agendar» una nota (sin interfaz, VERIFY-1 de E).
 */
import type { Module } from "../guion.ts";

export const AD11: Module = {
  id: "ad11-bloc",
  n: 17,
  floor: "advanced",
  title: ["Bloc y Fichero", "Pad and File"],
  promise: [
    "Podrás usar las notas como la memoria del negocio sin perder nunca un borrador.",
    "You will be able to use the notes as the memory of the business without ever losing a draft.",
  ],
  ready: true,
  chapters: [
    { id: "escribir", title: ["Escribir y guardar", "Writing and saving"] },
    { id: "proteger", title: ["El borrador, protegido", "The draft, protected"] },
    { id: "cliente", title: ["Por cliente", "Per client"] },
    { id: "fichero", title: ["El Fichero", "The File"] },
  ],
  scenes: [
    {
      id: "ad11-abrir", chapter: "escribir", anchors: ["notas", "nota-texto"],
      keys: [["notas", "notes"], ["bloc", "pad"], ["escribir", "write"]],
      steps: [
        { kind: "stage", build: "bloc-notas" },
        { kind: "go", screen: "/notas" },
        { kind: "show", anchor: "notas", caption: ["El Bloc es la memoria suelta del negocio: todo cabe aquí.", "The Pad is the business's loose memory: everything fits here."] },
        { kind: "show", anchor: "nota-texto", caption: ["Escribes con formato: negrita, listas, título y color de texto.", "You write with formatting: bold, lists, heading, and text color."] },
        { kind: "show", anchor: "nota-texto", caption: ["Doble toque sobre lo leído entra a editar en ese punto.", "Double-tapping read text enters editing at that point."] },
      ],
    },
    {
      id: "ad11-crear", chapter: "escribir", anchors: ["nota-nueva", "nota-texto"],
      keys: [["nota nueva", "new note"], ["escribir", "write"]],
      steps: [
        { kind: "do", anchor: "nota-nueva", caption: ["Toca «Nota nueva»: nace en blanco.", "Tap “New note”: it starts blank."] },
        { kind: "type", anchor: "nota-texto", text: ["Don Aurelio: revisar la cerca trasera el sábado", "Don Aurelio: check the back fence on Saturday"], caption: ["Escribe libre: ya nombra a Don Aurelio.", "Write freely: it already names Don Aurelio."], contexto: ["Al terminar, Guardar la archiva en su carpeta.", "When done, Save files it in its folder."] },
        { kind: "show", anchor: "nota-texto", caption: ["Mientras escribes, vive en el borrador protegido.", "While you write, it lives in the protected draft."], contexto: ["Su refugio: «El borrador, protegido» lo enseña.", "Its shelter: “The draft, protected” teaches it."] },
      ],
    },
    {
      id: "ad11-menciones", chapter: "escribir", anchors: ["nota-texto"],
      keys: [["nombre", "name"], ["cliente", "client"], ["ficha", "client file"]],
      steps: [
        { kind: "type", anchor: "nota-texto", text: ["@Don Aurelio: traer la sierra grande", "@Don Aurelio: bring the big saw"], caption: ["Con @ y su nombre, la nota queda también en su ficha.", "With @ and their name, the note also lands on their file."] },
        { kind: "show", anchor: "nota-texto", caption: ["El menú ofrece hasta seis clientes mientras escribes el nombre.", "The menu offers up to six clients while you type the name."], contexto: ["Al guardar manda el nombre más largo: «@Cris» no roba a «@Cristel».", "On saving the longest name wins: “@Cris” never steals “@Cristel”."] },
      ],
    },
    {
      id: "ad11-formato", chapter: "escribir", anchors: ["nota-texto", "nota-buscar"],
      keys: [["deshacer", "undo"], ["buscar", "search"], ["nota", "note"]],
      steps: [
        { kind: "show", anchor: "nota-texto", caption: ["Deshacer va carácter a carácter; manténlo y salta por palabras.", "Undo goes character by character; hold it and jump by words."] },
        { kind: "show", anchor: "nota-buscar", caption: ["La lupa busca dentro de esta nota, no entre todas.", "The search looks inside this note, not among all of them."] },
      ],
    },
    {
      id: "ad11-guardar", chapter: "escribir", anchors: ["nota-guardar", "nota-guardada-quedarme"],
      keys: [["guardar", "save"], ["carpeta", "folder"]],
      steps: [
        { kind: "do", anchor: "nota-guardar", caption: ["Guardar es un acto: nada se guarda solo en pantalla.", "Saving is an act: nothing saves itself on screen."] },
        { kind: "show", anchor: "nota-guardar", caption: ["Al guardar eliges carpeta, o queda en «No especificada».", "On saving you choose a folder, or it stays “Unspecified”."], contexto: ["Si el texto ya existe en otra nota, avisa antes de duplicar.", "If the text already exists in another note, it warns first."] },
        // El diálogo «Nota guardada» es modal: si nadie lo responde, queda
        // sobre el Bloc y su velo se traga el primer toque real del compás
        // del pin (ad11-fijadas) — el alumno quedaba atrapado. Por eso la
        // elección que este pie nombra SE TOCA: «Quedarme» cierra el
        // diálogo y la nota sigue abierta, que es lo que el paseo necesita.
        { kind: "do", anchor: "nota-guardada-quedarme", caption: ["Toca «Quedarme»: sigues con tu nota abierta.", "Tap “Stay”: you keep working on your note."], contexto: ["Tras guardar eliges: volver, nota nueva o quedarte aquí.", "After saving you choose: go back, new note, or stay here."] },
      ],
    },
    {
      id: "ad11-borrador", chapter: "proteger", anchors: ["notas"],
      keys: [["borrador", "draft"], ["sin guardar", "unsaved"]],
      steps: [
        { kind: "show", anchor: "notas", caption: ["Mientras escribes, tu borrador se guarda solo en tres ranuras.", "While you write, your draft saves itself in three slots."], contexto: ["El Bloc, la nota de una carpeta y cada nota guardada: una ranura cada una.", "The Pad, a folder-started note, and each saved note: one slot each."] },
        { kind: "show", anchor: "notas", caption: ["Si sales a otra pestaña, una puerta pregunta: guardar o salir.", "If you leave for another tab, a door asks: save or leave."], contexto: ["Dentro del Bloc y el Fichero te mueves libre: la puerta no molesta.", "Inside Pad and File you move freely: the door never nags."] },
      ],
    },
    {
      id: "ad11-que-se-pierde", chapter: "proteger", anchors: ["notas"],
      keys: [["borrador", "draft"], ["cerrar", "close"], ["guardada", "saved"]],
      steps: [
        { kind: "ask", anchor: "notas", caption: ["¿Y si cierras la app de verdad, sin guardar?", "And if you truly close the app, without saving?"] },
        { kind: "show", anchor: "notas", caption: ["El borrador muere con la sesión: eso sí se pierde.", "The draft dies with the session: that much is truly lost."], contexto: ["Lo guardado, jamás: notas y carpetas viven en tu libro.", "What is saved, never: notes and folders live in your book."] },
      ],
    },
    {
      id: "ad11-fijadas", chapter: "proteger", anchors: ["nota-fijar", "notas-tira-fijadas", "nota-mover"],
      keys: [["fijada", "pinned"], ["mover", "move"], ["carpeta", "folder"]],
      steps: [
        { kind: "show", anchor: "nota-fijar", caption: ["La nota guardada sigue abierta, su pin apagado.", "The saved note stays open, its pin dimmed."] },
        { kind: "do", anchor: "nota-fijar", caption: ["Toca el pin: queda fijada al instante.", "Tap the pin: pinned at once."] },
        { kind: "show", anchor: "nota-fijar", caption: ["Fijada se pinta de verde, relleno: su señal.", "Pinned turns green, filled in: that is its sign."] },
        { kind: "show", anchor: "notas-tira-fijadas", caption: ["Ya está en la tira, junto a la anterior.", "It is on the strip now, beside the earlier one."] },
        { kind: "show", anchor: "nota-mover", caption: ["El lector dice su carpeta y trae «Mover a…» a la vista.", "The reader names its folder and brings “Move to…” into view."] },
      ],
    },
    {
      id: "ad11-fijada-hoy", chapter: "proteger", anchors: ["hoy-nota-fijada", "notas-cliente", "ficha-nota-enlace"],
      keys: [["hoy", "today"], ["fijada", "pinned"], ["ficha", "client file"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "hoy-nota-fijada", caption: ["En Hoy vive también, junto a la anterior.", "On Today it lives too, beside the earlier one."] },
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "notas-cliente", caption: ["Su ficha la trae de vuelta: sus enlazadas.", "His file brings it back: his linked notes."] },
        { kind: "do", anchor: "ficha-nota-enlace", caption: ["Toca la primera enlazada: esta nota, recién fijada.", "Tap the first linked one: this note, just pinned."] },
      ],
    },
    {
      id: "ad11-desfijar", chapter: "proteger", anchors: ["nota-fijar", "nota-desfijar-confirmar", "notas-tira-fijadas"],
      keys: [["quitar", "unpin"], ["fijada", "pinned"]],
      steps: [
        { kind: "do", anchor: "nota-fijar", caption: ["De vuelta en el Bloc, toca el pin verde.", "Back in the Pad, tap the green pin again."] },
        { kind: "do", anchor: "nota-desfijar-confirmar", caption: ["Pregunta antes de soltarla: confirma «Sí, quitar».", "It asks before letting go: confirm “Yes, unpin”."], contexto: ["Dice: deja Hoy y la tira; no se borra.", "It says: it leaves Today and the strip; never deleted."] },
        { kind: "show", anchor: "notas-tira-fijadas", caption: ["La tira vuelve a una; la nota sigue abierta.", "The strip is back to one; the note stays open."] },
      ],
    },
    {
      id: "ad11-calculadora", chapter: "proteger", anchors: ["nota-calculadora"],
      keys: [["calculadora", "calculator"], ["nota", "note"], ["cuenta", "sum"]],
      steps: [
        { kind: "show", anchor: "nota-calculadora", caption: ["La calculadora flota, se arrastra y recuerda su sitio y tamaño.", "The calculator floats, drags, and remembers its place and size."] },
        { kind: "show", anchor: "nota-calculadora", caption: ["«En la nota» inserta la cuenta en tu cursor, sin perderlo.", "“Into the note” inserts the sum at your cursor, never losing it."], contexto: ["El Bloc custodia el cursor mientras tocas la calculadora: por eso acierta.", "The Pad guards the cursor while you use the calculator: that is why it works."] },
      ],
    },
    {
      id: "ad11-semana", chapter: "proteger", anchors: ["notas-semana", "notas"],
      keys: [["esta semana", "this week"], ["patios", "yards"], ["notas", "notes"]],
      steps: [
        { kind: "show", anchor: "notas-semana", caption: ["Bajo el editor, tu semana: toca un patio y vas a su ficha.", "Below the editor, your week: tap a yard and open its file."] },
        { kind: "show", anchor: "notas", caption: ["En pantalla grande el Bloc es un escritorio de tres paneles.", "On a big screen the Pad is a three-panel desk."], contexto: ["Los divisores se arrastran y se recuerdan; doble toque los repone.", "Dividers drag and are remembered; a double tap resets them."] },
      ],
    },
    {
      id: "ad11-cliente", chapter: "cliente", anchors: ["notas-cliente", "ficha-nota-texto"],
      keys: [["cliente", "client"], ["nota", "note"], ["ficha", "client file"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "notas-cliente", caption: ["Cada cliente guarda sus notas en su propia ficha.", "Every client keeps their notes on their own file."] },
        { kind: "type", anchor: "ficha-nota-texto", text: ["La cerca trasera se revisa el sábado.", "The back fence gets checked on Saturday."], caption: ["Escribe aquí: esta nota vive solo en su ficha.", "Write here: this note lives only on his file."] },
        { kind: "show", anchor: "notas-cliente", caption: ["Su estado lo prueba: guarda al salir del texto.", "Its status proves it: saves when you leave the text."], contexto: ["Cada ficha tiene su borrador propio durante la sesión.", "Each file keeps its own draft during the session."] },
      ],
    },
    {
      id: "ad11-cliente-enlaces", chapter: "cliente", anchors: ["notas-cliente", "ficha-nota-enlace", "notas"],
      keys: [["enlazada", "linked"], ["bloc", "pad"], ["nota", "note"]],
      steps: [
        { kind: "show", anchor: "notas-cliente", caption: ["Sus páginas del Bloc viven en esta sección.", "His Pad pages also live in this section."], contexto: ["Al unir —Repetidos lo enseña—, se mudan con él.", "On merging —Duplicates teaches it—, they move along with him."] },
        { kind: "do", anchor: "ficha-nota-enlace", caption: ["Toca una enlazada y se abre en el Bloc.", "Tap a linked one: it opens in the Pad."] },
        { kind: "show", anchor: "notas", caption: ["Ya estás en el Bloc, con esa página abierta.", "You are in the Pad, with that page open."] },
      ],
    },
    {
      id: "ad11-doble-toque", chapter: "fichero", anchors: ["notas-puerta", "fichero"],
      keys: [["fichero", "file"], ["doble toque", "double tap"], ["notas", "notes"]],
      steps: [
        { kind: "show", anchor: "notas-puerta", caption: ["Doble toque en Notas abre el Fichero; uno solo, el Bloc.", "A double tap on Notes opens the File; a single one, the Pad."], contexto: ["El toque simple espera un latido: por eso Notas «tarda» un poco.", "The single tap waits a beat: that is why Notes feels slow."] },
        { kind: "go", screen: "/fichero" },
        { kind: "show", anchor: "fichero", caption: ["El Fichero: tus carpetas, con sus notas contadas en la portada.", "The File: your folders, with their notes counted on the cover."] },
      ],
    },
    {
      id: "ad11-carpetas", chapter: "fichero", anchors: ["fichero"],
      keys: [["carpetas", "folders"], ["ver todo", "see all"], ["filtros", "filters"]],
      steps: [
        { kind: "show", anchor: "fichero", caption: ["De fábrica: Trabajo por hacer, Materiales, Recordatorios, No especificada.", "From the factory: To do, Materials, Reminders, Unspecified."] },
        { kind: "show", anchor: "fichero", caption: ["«Ver todo» junta las notas; Filtros ordena por fecha y carpeta.", "“See all” gathers the notes; Filters sorts by date and folder."] },
        { kind: "show", anchor: "fichero", caption: ["Una carpeta con notas aparece sola, aunque no esté en el mueble.", "A folder with notes appears by itself, even off the cabinet."] },
      ],
    },
    {
      id: "ad11-mover-buscar", chapter: "fichero", anchors: ["fichero"],
      keys: [["mover", "move"], ["buscar", "search"], ["nota", "note"]],
      steps: [
        { kind: "show", anchor: "fichero", caption: ["Mover tiene gesto y botón: desliza la fila o usa su hoja.", "Moving has a gesture and a button: swipe the row or use its sheet."] },
        { kind: "show", anchor: "fichero", caption: ["En la ficha, buscar con @ encuentra por cliente; con #, por etiqueta.", "On the client file, @ searches by client; # by tag."], contexto: ["El buscador del Fichero es de texto simple: no confundas los dos.", "The File's search is plain text: do not confuse the two."] },
      ],
    },
    {
      id: "ad11-estilo", chapter: "fichero", anchors: ["fichero"],
      keys: [["carpeta", "folder"], ["color", "color"], ["marca", "mark"]],
      steps: [
        { kind: "show", anchor: "fichero", caption: ["El engranaje da a cada carpeta color propio y ocho marcas.", "The gear gives each folder its own color and eight marks."], contexto: ["Carpeta y sus notas llevan estilos separados: dos miniaturas lo prevén.", "Folder and its notes carry separate styles: two previews show it."] },
      ],
    },
    {
      id: "ad11-papelera", chapter: "fichero", anchors: ["fichero-papelera", "fichero"],
      keys: [["papelera", "trash"], ["restaurar", "restore"], ["días", "days"]],
      steps: [
        { kind: "show", anchor: "fichero-papelera", caption: ["Borrar manda a la papelera: nada se pierde al primer toque.", "Deleting sends to the trash: nothing is lost at first tap."] },
        { kind: "show", anchor: "fichero", caption: ["La papelera caduca a los 30 días; ajústalo de 1 a 365.", "The trash expires at 30 days; adjust it from 1 to 365."], contexto: ["Restaurar devuelve nota o carpeta entera; vaciar pide el conteo exacto.", "Restore returns a note or a whole folder; emptying asks the exact count."] },
        { kind: "ref", topic: "fichero" },
      ],
    },
  ],
};
