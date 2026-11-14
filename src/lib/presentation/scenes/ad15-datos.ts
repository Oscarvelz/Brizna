/**
 * AD15 · Tus datos, a salvo — el respaldo en formato 6, la valla de lo que
 * NUNCA viaja, las 4 puertas que rechazan una copia mala en voz alta,
 * Restaurar ≠ Añadir varios, la muestra de 14 y cómo sale sin tocar lo
 * real, el libro provisional sin red y «la red observa antes de
 * reescribir», y la puerta de rescate (censo F, DAT/SEG/MUE).
 *
 * LEY DE ACTUACIÓN DE ESTE MÓDULO: ninguna escena dispara una descarga,
 * una restauración ni un borrado. Los botones serios se ENSEÑAN con
 * `show` — jamás con `do`/`tap` — : la lección es dónde vive la puerta,
 * qué la guarda y qué pasaría; el dedo del alumno decide otro día, fuera
 * de la lección. Escenas marcadas: ad15-guardar, ad15-restaurar,
 * ad15-archivo, ad15-muestra-quitar (todas show, ninguna actuada).
 * Borrar un cliente con su desglose de dinero es lección de AD2; aquí
 * viven solo las puertas serias del nivel de la app.
 *
 * ANCLAS NUEVAS (el integrador las registra; las de pliegue son las
 * mismas ids que AD14 declara — registro único):
 *  Por id: aj-copia, aj-ejemplo — routes/ajustes.tsx · aj-nube —
 *  components/sync-status.tsx.
 *  Por present (acuñadas):
 *  - copia-guardar — routes/ajustes.tsx (Guardar copia ahora/archivo)
 *  - copia-restaurar — routes/ajustes.tsx (botón Restaurar de la lista)
 *  - copia-archivo — routes/ajustes.tsx (Restaurar archivo)
 *  - ejemplo-quitar — routes/ajustes.tsx (Quitar ejemplo; el literal
 *    vive en components/sample-data.tsx)
 *  Presencia de las present: «estado: el pliegue está desplegado y el
 *  control visible» — las escenas van precedidas de su pliegue.
 */
import type { Module } from "../guion.ts";

export const AD15: Module = {
  id: "ad15-datos",
  n: 21,
  floor: "advanced",
  title: ["Tus datos, a salvo", "Your data, safe"],
  promise: [
    "Podrás respaldar, restaurar y moverte de aparato sin perder ni inventar nada.",
    "You will be able to back up, restore, and move devices without losing or inventing anything.",
  ],
  ready: true,
  chapters: [
    { id: "copia", title: ["La copia y lo que viaja", "The copy and what travels"] },
    { id: "puertas", title: ["Las puertas que rechazan", "The doors that refuse"] },
    { id: "muestra", title: ["La muestra de 14", "The sample of 14"] },
    { id: "provisional", title: ["Sin red y el rescate", "Offline and the rescue"] },
  ],
  scenes: [
    {
      id: "ad15-copia", chapter: "copia", anchors: ["aj-copia"],
      keys: [["copia de seguridad", "backup"], ["copia", "copy"]],
      steps: [
        { kind: "stage", build: "ruta-datos" },
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-copia", caption: ["Aquí vive tu red: última copia, clientes, trabajos, peso.", "Your safety net lives here: last copy, clients, jobs, weight."] },
      ],
    },
    {
      id: "ad15-automatica", chapter: "copia", anchors: ["aj-copia"],
      keys: [["copia", "backup"], ["automática", "automatic"]],
      steps: [
        { kind: "show", anchor: "aj-copia", caption: ["La copia se guarda sola: al cambiar datos y al salir.", "The copy saves itself: when data changes and on exit."], contexto: ["Una cada diez minutos como mucho; una idéntica no se repite.", "One every ten minutes at most; an identical one never repeats."] },
        { kind: "show", anchor: "aj-copia", caption: ["Se quedan ocho recientes, una por día y por semana.", "Eight recent ones stay, plus one daily and one weekly."] },
      ],
    },
    {
      id: "ad15-guardar", chapter: "copia", anchors: ["copia-guardar"],
      keys: [["guardar copia ahora", "save a copy now"], ["archivo", "file"]],
      steps: [
        { kind: "show", anchor: "copia-guardar", caption: ["Guardar ahora baja tres piezas: copia, informe y hoja.", "Save now downloads three pieces: copy, report, and sheet."], contexto: ["Hoy solo lo miramos: esta lección no descarga nada.", "Today we only look: this lesson downloads nothing."] },
        { kind: "show", anchor: "copia-guardar", caption: ["Con carpeta elegida quedan solo las cinco recientes por tipo.", "With a folder chosen, only the five newest per type stay."] },
      ],
    },
    {
      id: "ad15-formato", chapter: "copia", anchors: ["aj-copia"],
      keys: [["suma de control", "checksum"], ["copia", "backup"]],
      steps: [
        { kind: "show", anchor: "aj-copia", caption: ["Formato seis: un archivo sellado con su suma de control.", "Format six: one sealed file with its checksum."], contexto: ["Viaja el libro entero: clientes, trabajos, pagos, notas, ajustes.", "The whole book travels: clients, jobs, payments, notes, settings."] },
      ],
    },
    {
      id: "ad15-viaja-equipo", chapter: "copia", anchors: ["aj-copia"],
      keys: [["copia", "backup"], ["aparato", "device"]],
      steps: [
        { kind: "show", anchor: "aj-copia", caption: ["También viaja tu aparato: tema, densidad, carpetas, órdenes.", "Your device travels too: theme, density, folders, orders."], contexto: ["Al restaurar se fusiona: lo tuyo de más no se borra.", "Restoring merges it: your extra things are not erased."] },
      ],
    },
    {
      id: "ad15-nunca", chapter: "copia", anchors: ["aj-copia"],
      keys: [["copia", "backup"], ["sesión", "session"], ["fotos", "photos"]],
      steps: [
        { kind: "ask", anchor: "aj-copia", caption: ["¿Y qué nunca viaja en una copia? La valla tiene nombre.", "And what never travels in a copy? The fence has names."] },
        { kind: "show", anchor: "aj-copia", caption: ["Sesión, cola sin red, fotos y cuentas de este aparato.", "Session, offline queue, photos, and this device's accounts."], contexto: ["Un archivo hecho a mano tampoco puede plantarlos al restaurar.", "A handmade file cannot plant them on restore either."] },
      ],
    },
    {
      id: "ad15-lista", chapter: "puertas", anchors: ["copia-restaurar"],
      keys: [["copias", "backups"], ["restaurar", "restore"], ["lista", "list"]],
      steps: [
        { kind: "show", anchor: "copia-restaurar", caption: ["La lista enseña doce copias: fecha, clientes y trabajos.", "The list shows twelve copies: date, clients, and jobs."], contexto: ["Una copia perdedora de la nube lleva su etiqueta: «Nube · conflicto».", "A losing cloud copy carries its label: “Cloud · conflict”."] },
      ],
    },
    {
      id: "ad15-puertas", chapter: "puertas", anchors: ["copia-restaurar"],
      keys: [["restaurar", "restore"], ["dañada", "damaged"]],
      steps: [
        { kind: "show", anchor: "copia-restaurar", caption: ["Cuatro puertas rechazan una copia mala, en voz alta.", "Four doors refuse a bad copy, out loud."], contexto: ["Más nueva que tu Brizna, sin clientes, sello roto, vacía.", "Newer than your Brizna, no clients, broken seal, empty."] },
        { kind: "show", anchor: "copia-restaurar", caption: ["Una restauración fallida no cambia nada: todo o nada.", "A failed restore changes nothing: all or nothing."] },
      ],
    },
    {
      id: "ad15-restaurar", chapter: "puertas", anchors: ["copia-restaurar"],
      keys: [["restaurar", "restore"], ["copia", "backup"]],
      steps: [
        { kind: "show", anchor: "copia-restaurar", caption: ["Restaurar primero copia lo que hay: volver siempre es posible.", "Restoring first copies what exists: going back always works."], contexto: ["Hoy solo lo miramos: esta lección no restaura nada.", "Today we only look: this lesson restores nothing."] },
        { kind: "show", anchor: "copia-restaurar", caption: ["Dentro: una sola transacción y la Agenda se resiembra.", "Inside: one single transaction, and the Schedule reseeds."] },
      ],
    },
    {
      id: "ad15-archivo", chapter: "puertas", anchors: ["copia-archivo"],
      keys: [["restaurar archivo", "restore file"], ["archivo", "file"]],
      steps: [
        { kind: "show", anchor: "copia-archivo", caption: ["Un archivo que no es copia se rechaza en el selector.", "A file that is not a copy is refused at the picker."], contexto: ["Si la copia trae aparato nuevo, la app se recarga sola.", "If the copy brings a new device layer, the app reloads."] },
      ],
    },
    {
      id: "ad15-vs-varios", chapter: "puertas", anchors: ["aj-copia"],
      keys: [["restaurar", "restore"], ["añadir varios", "add several"]],
      steps: [
        { kind: "ask", anchor: "aj-copia", caption: ["¿Restaurar es como Añadir varios? No: son puertas opuestas.", "Is restoring like Add many? No: opposite doors."] },
        { kind: "show", anchor: "aj-copia", caption: ["Restaurar reemplaza el libro entero; Añadir varios solo suma.", "Restoring replaces the whole book; Add many only adds."] },
      ],
    },
    {
      id: "ad15-muestra", chapter: "muestra", anchors: ["aj-ejemplo"],
      keys: [["ejemplo", "sample"], ["datos de ejemplo", "sample data"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-ejemplo", caption: ["La muestra: catorce clientes ficticios con dos meses de historia.", "The sample: fourteen fictional clients with two months of history."], contexto: ["Historia construida con la lógica real: no datos pintados.", "History built with the real logic: not painted data."] },
        { kind: "show", anchor: "aj-ejemplo", caption: ["Dentro: una en pausa, un perdón, un día de lluvia.", "Inside: one paused, one forgiveness, one rain day."] },
      ],
    },
    {
      id: "ad15-muestra-quitar", chapter: "muestra", anchors: ["ejemplo-quitar"],
      keys: [["quitar ejemplo", "remove sample"], ["ejemplo", "sample"]],
      steps: [
        { kind: "show", anchor: "ejemplo-quitar", caption: ["Quitarla borra solo lo marcado como ejemplo, nada tuyo.", "Removing it deletes only what is marked sample, nothing yours."], contexto: ["Antes de cargar y de quitar, se guarda una copia forzada.", "Before loading and removing, a forced copy is saved."] },
      ],
    },
    {
      id: "ad15-muestra-chip", chapter: "muestra", anchors: ["aj-ejemplo"],
      keys: [["ejemplo", "sample"], ["chip", "chip"]],
      steps: [
        { kind: "show", anchor: "aj-ejemplo", caption: ["El chip Ejemplo te trae a este pliegue de un toque.", "The Sample chip brings you to this fold in one tap."], contexto: ["La muestra es para explorarla solo; este escenario es otra cosa.", "The sample is explored alone; this stage is something else."] },
      ],
    },
    {
      id: "ad15-provisional", chapter: "provisional", anchors: ["aj-nube"],
      keys: [["sin internet", "offline"], ["nube", "cloud"], ["en este equipo", "on this device"]],
      steps: [
        { kind: "show", anchor: "aj-nube", caption: ["Sin sesión ni red, tu libro abre provisional en tu aparato.", "With no session or network, your book opens provisionally here."], contexto: ["Lo provisional no sincroniza; la huella sigue guardando la puerta.", "Provisional work never syncs; the fingerprint still guards it."] },
        { kind: "show", anchor: "aj-nube", caption: ["Sin libro previo no hay provisional: la primera vez pide internet.", "With no prior book, there is no provisional: first time needs internet."] },
      ],
    },
    {
      id: "ad15-observa", chapter: "provisional", anchors: ["aj-nube"],
      keys: [["nube", "cloud"], ["sincronizar", "sync"], ["conflicto", "conflict"]],
      steps: [
        { kind: "ask", anchor: "aj-nube", caption: ["¿Y cuando vuelve la red? La red observa antes de reescribir.", "And when the network returns? It observes before rewriting."] },
        { kind: "show", anchor: "aj-nube", caption: ["Si cambiaron los dos lados, se guardan ambas versiones.", "If both sides changed, both versions are saved."], contexto: ["La perdedora queda en tu lista como «Nube · conflicto».", "The losing one stays in your list as “Cloud · conflict”."] },
      ],
    },
    {
      id: "ad15-nube-dentro", chapter: "provisional", anchors: ["aj-nube"],
      keys: [["nube", "cloud"], ["foto", "photo"]],
      steps: [
        { kind: "show", anchor: "aj-nube", caption: ["La nube guarda una sola foto comprimida por cuenta.", "The cloud keeps one single compressed photo per account."], contexto: ["Tus copias y tus fotos nunca salen de este aparato.", "Your copies and your photos never leave this device."] },
      ],
    },
    {
      id: "ad15-cola", chapter: "provisional", anchors: ["aj-copia"],
      keys: [["cola", "queue"], ["cola sin señal", "offline queue"], ["restaurar", "restore"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-copia", caption: ["Al restaurar, la cola sin red queda en cuarentena.", "On restore, the offline queue goes into quarantine."], contexto: ["Sus operaciones apuntaban al libro viejo: nunca caen sobre el nuevo.", "Its operations pointed at the old book: never onto the new."] },
      ],
    },
    {
      id: "ad15-rescate", chapter: "provisional", anchors: ["aj-copia"],
      keys: [["base vacía", "empty database"], ["no se borra", "not deleted"]],
      steps: [
        { kind: "show", anchor: "aj-copia", caption: ["Si la base no abre, el rescate la renombra, no la borra.", "If the database won't open, rescue renames it, never deletes it."], contexto: ["La app apunta a una base nueva; nube o copia rellenan.", "The app points to a fresh database; cloud or copy refills."] },
      ],
      verify: "Censo F V-4 / G V-15: umbral exacto (3 aperturas fallidas) y pantalla del rescate viven en el arranque; la puerta nunca se ha pisado en un aparato real.",
    },
    {
      id: "ad15-cierre", chapter: "provisional", anchors: ["aj-copia"],
      keys: [["copia", "backup"], ["nada se pierde", "nothing is lost"]],
      steps: [
        { kind: "ask", anchor: "aj-copia", caption: ["¿Miedo a estas puertas? Respeto: cada una anuncia y copia antes.", "Fear these doors? Respect: each announces and copies first."] },
        { kind: "show", anchor: "aj-copia", caption: ["Nada se pierde en silencio: ese es el diseño entero.", "Nothing is lost in silence: that is the whole design."] },
        { kind: "show", anchor: "aj-copia", caption: ["Cambiar de aparato: copia aquí, entra y restaura allí.", "Moving devices: copy here, sign in and restore there."] },
      ],
    },
  ],
};
