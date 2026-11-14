/**
 * AD4 · Añadir varios: importar en baches — entrar una tanda entera
 * de una vez y revisarla antes de guardarla (PLAN §1.2; censo B-73…
 * B-78 y F-72…F-81, todo en src/routes/nuevo.tsx).
 * Las dos puertas (contactos del teléfono o pegar nombres, hasta 40),
 * la hoja «Revisar clientes», «Copiar a todos», la deuda compartida
 * con su puerta de monto, y los repetidos en dos frentes: dentro de
 * la tanda (Luis Vegas repite a Luis Vega: se quita) y contra el
 * libro (Don Aurelio ya existe: se usa el existente, no se duplica).
 * Distinción expresa, en contexto: Añadir varios SUMA al libro;
 * Restaurar (AD15) REEMPLAZA el libro entero.
 * Tanda escenificada, pequeña a propósito (la lección es el flujo):
 * María León · Pedro Sosa · Don Aurelio · Luis Vega · Luis Vegas.
 * Escenario: «ruta-base» (stage-seeds.ts, ya registrado) — Don Aurelio
 * ya vive en el libro-escenario para que la tanda choque con él.
 * Al guardar aterrizas en Clientes; la deuda marcada ($40 de María)
 * se comprueba después en Cobros. Nada se envía ni se restaura.
 *
 * ANCLAS NUEVAS que este archivo cita (present, <superficie>-<control>;
 * el integrador las acuña en anchors.ts y en el archivo dueño):
 *  - bache-contactos → src/components/client-form.tsx (botón Del teléfono)
 *  - bache-varios → src/routes/nuevo.tsx (botón y hoja Añadir varios)
 *  - bache-nombres → src/routes/nuevo.tsx (el área de texto, un nombre por línea)
 *  - bache-continuar → src/routes/nuevo.tsx (botón Continuar de la hoja de nombres)
 *  - bache-revisar → src/routes/nuevo.tsx (diálogo Revisar clientes, bz-bulk)
 *  - bache-copiar → src/routes/nuevo.tsx (Copiar a todos, primera fila)
 *  - bache-mismo-dia → src/routes/nuevo.tsx (casilla Paga el mismo día por fila)
 *  - bache-deuda → src/routes/nuevo.tsx (bloque compartido Deuda de antes)
 *  - bache-ya-debe → src/routes/nuevo.tsx (casilla Ya debe por fila)
 *  - bache-monto → src/routes/nuevo.tsx (campo de monto de Ya debe)
 *  - bache-repetido-lista → src/routes/nuevo.tsx (aviso Repetido en esta lista)
 *  - bache-quitar → src/routes/nuevo.tsx (botón Quitar de la fila repetida)
 *  - bache-repetido-libro → src/routes/nuevo.tsx (botón Se parece a / Comparar por fila)
 *  - bache-guardar → src/routes/nuevo.tsx (botón de guardar con el resumen de la tanda)
 * Reutiliza además dup-comparar y dup-usar de AD3 (components/dup-compare.tsx).
 */
import type { Module } from "../guion.ts";

export const AD4: Module = {
  id: "ad4-baches",
  n: 10,
  floor: "advanced",
  title: ["Añadir varios: importar en baches", "Add many: importing in batches"],
  promise: [
    "Podrás entrar una tanda entera de clientes de una vez y revisarla antes de guardarla.",
    "You will be able to enter a whole batch of clients at once and review it before saving.",
  ],
  ready: true,
  chapters: [
    { id: "puertas", title: ["Las dos puertas de la tanda", "The batch's two doors"] },
    { id: "revisar", title: ["Revisar antes de guardar", "Reviewing before saving"] },
    { id: "deuda", title: ["La deuda compartida", "The shared debt"] },
    { id: "repetidos", title: ["Repetidos, dentro y contra el libro", "Duplicates, inside and against the book"] },
    { id: "guardar", title: ["Guardar, y qué pasa después", "Saving, and what happens after"] },
  ],
  scenes: [
    {
      id: "ad4-puertas", chapter: "puertas", anchors: ["bache-contactos", "bache-varios"],
      keys: [["varios", "several"], ["contactos", "contacts"]],
      verify: "La puerta de contactos depende del aparato: en la app Android el sistema aún no lee Contactos y la app lo avisa en voz alta (censo B-45 / F-73, verificado en código); qué selector abre cada navegador real no se contrastó en esta línea.",
      steps: [
        { kind: "stage", build: "ruta-base" },
        { kind: "go", screen: "/nuevo" },
        { kind: "ask", anchor: "bache-varios", caption: ["¿Varios patios nuevos? No uno a uno: en tanda.", "Several new yards? Not one by one: in a batch."] },
        { kind: "show", anchor: "bache-contactos", caption: ["Del teléfono trae nombre, teléfono y dirección de tus contactos.", "From the phone it brings name, phone and address of your contacts."], contexto: ["Si el aparato no lee contactos, avisa honesto: escribe a mano.", "If the device cannot read contacts, it says so: type by hand."] },
        { kind: "show", anchor: "bache-varios", caption: ["Añadir varios es la otra puerta: pegar nombres.", "Add several is the other door: pasting names."], contexto: ["Esto suma clientes al libro; Restaurar, en cambio, lo reemplaza entero.", "This adds clients to the book; Restore, instead, replaces it entirely."] },
      ],
    },
    {
      id: "ad4-escribir", chapter: "puertas", anchors: ["bache-varios", "bache-nombres", "bache-continuar"],
      keys: [["nombres", "names"], ["varios", "several"]],
      steps: [
        { kind: "do", anchor: "bache-varios", caption: ["Abre Añadir varios.", "Open Add several."] },
        { kind: "type", anchor: "bache-nombres", text: ["María León\nPedro Sosa\nDon Aurelio\nLuis Vega\nLuis Vegas", "María León\nPedro Sosa\nDon Aurelio\nLuis Vega\nLuis Vegas"], caption: ["Un nombre por línea: cinco, con sorpresas dentro.", "One name per line: five, with surprises inside."] },
        { kind: "show", anchor: "bache-nombres", caption: ["El tope es cuarenta por tanda, y se avisa.", "The cap is forty per batch, and it is announced."], contexto: ["Lo que pase de cuarenta queda fuera, dicho en voz alta.", "Whatever passes forty stays out, and the app says so."] },
        { kind: "do", anchor: "bache-continuar", caption: ["Continúa a la hoja de revisión.", "Continue to the review sheet."] },
      ],
    },
    {
      id: "ad4-revisar", chapter: "revisar", anchors: ["bache-revisar"],
      keys: [["revisar", "review"], ["tanda", "batch"]],
      steps: [
        { kind: "show", anchor: "bache-revisar", caption: ["Revisar clientes: una tarjeta por nombre, nada guardado todavía.", "Review clients: one card per name, nothing saved yet."] },
        { kind: "show", anchor: "bache-revisar", caption: ["Por fila ajustas teléfono, precio, cortes al mes e inicio.", "Per row you adjust phone, price, cuts per month and start."], contexto: ["Cada fila nace con $30, dos cortes e inicio hoy.", "Each row is born with $30, two cuts, starting today."] },
        { kind: "show", anchor: "bache-revisar", caption: ["Salir con trabajo sin guardar pregunta antes de perderlo.", "Leaving with unsaved work asks before losing it."] },
      ],
    },
    {
      id: "ad4-copiar", chapter: "revisar", anchors: ["bache-copiar", "bache-mismo-dia"],
      keys: [["precio", "price"], ["guardar", "save"]],
      steps: [
        { kind: "do", anchor: "bache-copiar", caption: ["Copiar a todos lleva la primera fila a toda la tanda.", "Copy to all carries the first row to the whole batch."], contexto: ["Copia precio, ritmo, inicio y forma de pago, de un toque.", "It copies price, rhythm, start and payment method in one tap."] },
        { kind: "show", anchor: "bache-mismo-dia", caption: ["Paga el mismo día va por fila: cobrar al Hecho.", "Paying the same day is per row: collect at Done."] },
      ],
    },
    {
      id: "ad4-deuda", chapter: "deuda", anchors: ["bache-deuda", "bache-ya-debe", "bache-monto"],
      keys: [["deuda", "debt"], ["tanda", "batch"]],
      steps: [
        { kind: "show", anchor: "bache-deuda", caption: ["Deuda de antes se marca en bloque o por fila.", "Earlier debt is marked in bulk or per row."] },
        { kind: "show", anchor: "bache-deuda", caption: ["Todos y Ninguno marcan la tanda entera de un toque.", "All and None mark the whole batch in one tap."] },
        { kind: "do", anchor: "bache-ya-debe", caption: ["Marca Ya debe en la primera tarjeta, la de María.", "Mark Already owes on the first card, María's."] },
        { kind: "type", anchor: "bache-monto", text: ["40", "40"], caption: ["Escribe $40: esa deuda entra directa en Por cobrar.", "Type $40: that debt goes straight into To collect."] },
        { kind: "ref", topic: "deuda-anterior" },
      ],
    },
    {
      id: "ad4-deuda-puerta", chapter: "deuda", anchors: ["bache-guardar"],
      keys: [["deuda", "debt"], ["guardar", "save"]],
      steps: [
        { kind: "show", anchor: "bache-guardar", caption: ["Sin monto en un marcado, guardar se niega y lo dice.", "With a marked row missing its amount, saving refuses and says why."] },
      ],
    },
    {
      id: "ad4-repetido-dentro", chapter: "repetidos", anchors: ["bache-repetido-lista", "bache-quitar"],
      keys: [["repetidos", "duplicates"], ["tanda", "batch"]],
      steps: [
        { kind: "show", anchor: "bache-repetido-lista", caption: ["Repetido dentro de la tanda: Luis Vegas repite a Luis Vega.", "Duplicate inside the batch: Luis Vegas repeats Luis Vega."] },
        { kind: "do", anchor: "bache-quitar", caption: ["Quita esa fila: la tanda queda limpia.", "Remove that row: the batch is clean."] },
      ],
    },
    {
      id: "ad4-repetido-libro", chapter: "repetidos", anchors: ["bache-repetido-libro", "dup-comparar", "dup-usar"],
      keys: [["repetidos", "duplicates"], ["comparación", "comparison"]],
      steps: [
        { kind: "show", anchor: "bache-repetido-libro", caption: ["Contra el libro también avisa: Don Aurelio ya existe.", "Against the book it also warns: Don Aurelio already exists."] },
        { kind: "do", anchor: "bache-repetido-libro", caption: ["Abre la comparación de esa fila.", "Open that row's comparison."] },
        { kind: "show", anchor: "dup-comparar", caption: ["Es el mismo Aurelio del libro, no un cliente nuevo.", "It is the book's same Aurelio, not a new client."] },
        { kind: "do", anchor: "dup-usar", caption: ["Usar existente quita la fila: no se añade otra vez.", "Use existing removes the row: not added again."] },
      ],
    },
    {
      id: "ad4-guardar", chapter: "guardar", anchors: ["bache-guardar"],
      keys: [["guardar", "save"], ["tanda", "batch"]],
      steps: [
        { kind: "ask", anchor: "bache-guardar", caption: ["¿Lista la tanda? El botón ya anuncia su resultado.", "Batch ready? The button already announces its result."] },
        { kind: "show", anchor: "bache-guardar", caption: ["Anuncia añadir tres, con uno con deuda, antes de tocarlo.", "It announces it will add three, one with debt, before you tap."] },
        { kind: "do", anchor: "bache-guardar", caption: ["Guarda la tanda entera de una sola vez.", "Save the whole batch in one go."] },
      ],
    },
    {
      id: "ad4-despues", chapter: "guardar", anchors: ["lista-clientes"],
      keys: [["clientes", "clients"], ["agenda", "schedule"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["Aterrizas en Clientes: los nuevos ya viven en el libro.", "You land in Clients: the new ones already live in the book."], contexto: ["Cada uno nace con su agenda sembrada según su inicio.", "Each is born with their schedule planted from their start."] },
      ],
    },
    {
      id: "ad4-despues-dinero", chapter: "guardar", anchors: ["por-cobrar"],
      keys: [["por cobrar", "to collect"], ["deuda", "debt"]],
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "por-cobrar", caption: ["Y María ya debe sus $40 aquí, en Por cobrar.", "And María already owes her $40 here, in To collect."] },
      ],
    },
    {
      id: "ad4-despues-hoy", chapter: "guardar", anchors: ["tarjeta-nombre"],
      keys: [["hoy", "today"], ["clientes", "clients"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["Quien empieza hoy ya sale en Hoy, listo para trabajar.", "Whoever starts today already shows in Today, ready to work."] },
        { kind: "show", anchor: "tarjeta-nombre", caption: ["Una tanda revisada entra limpia: sin repetidos, sin deudas mudas.", "A reviewed batch enters clean: no duplicates, no silent debts."] },
      ],
    },
  ],
};
