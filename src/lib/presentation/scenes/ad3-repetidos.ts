/**
 * AD3 · Repetidos — detectar y unir duplicados sin perder un centavo
 * ni un corte (PLAN §1.2; censo B-121…B-128, dup-compare.tsx).
 * El motor de parecido (nombre / teléfono / dirección, con pesos),
 * los cuatro disparos, la comparación lado a lado con sus tres
 * decisiones — «Es otro cliente» se recuerda — y Unir actuado de
 * verdad sobre el escenario sellado: copia previa, deudas que se
 * suman ($40 + $80 = $120), el corte del mismo día que no pasa y se
 * cuenta, el que se va archivado (no borrado) y Deshacer unión desde
 * Cambios hechos, también actuado, con sus dos cautelas.
 * Reparto ajustado: «Luis Vega» (debe $40) y «Luis Vegas» (debe $80),
 * mismo teléfono y misma dirección, sembrados por «repetidos-par»
 * (seeds-w2-a.ts). Ambos cortaron el mismo día hace 14 días: ese es
 * el corte en conflicto de la unión.
 *
 * ANCLAS NUEVAS que este archivo cita (present, <superficie>-<control>;
 * el integrador las acuña en anchors.ts y en el archivo dueño):
 *  - dup-escanear → src/components/dup-compare.tsx (línea DupScanLine en el
 *      Inventario de clientes.index.tsx; hoy data-ref="inv-dups")
 *  - dup-grupo → src/components/dup-compare.tsx (cada grupo en la lista de escaneo)
 *  - dup-comparar → src/components/dup-compare.tsx (diálogo «¿Es el mismo cliente?»)
 *  - dup-cambiar → src/components/dup-compare.tsx (botón Cambiar, bz-dup-swap)
 *  - dup-usar → src/components/dup-compare.tsx (botón Usar existente)
 *  - dup-otro → src/components/dup-compare.tsx (botón Es otro cliente)
 *  - dup-unir → src/components/dup-compare.tsx (botón Unir)
 *  - dup-deshacer → src/routes/clientes.$id.tsx (Deshacer unión en Cambios hechos)
 * El resto son anclas ya registradas en anchors.ts.
 */
import type { Module } from "../guion.ts";

export const AD3: Module = {
  id: "ad3-repetidos",
  n: 9,
  floor: "advanced",
  title: ["Repetidos", "Duplicates"],
  promise: [
    "Podrás detectar y unir duplicados sin perder un centavo ni un corte.",
    "You will be able to detect and merge duplicates without losing a cent or a cut.",
  ],
  ready: true,
  chapters: [
    { id: "motor", title: ["El motor de parecido", "The similarity engine"] },
    { id: "comparar", title: ["Comparar y decidir", "Comparing and deciding"] },
    { id: "unir", title: ["Unir, y qué pasa después", "Merging, and what happens after"] },
    { id: "deshacer", title: ["Deshacer la unión", "Undoing the merge"] },
  ],
  scenes: [
    {
      id: "ad3-dos-luis", chapter: "motor", anchors: ["lista-clientes"],
      keys: [["clientes", "clients"], ["repetidos", "duplicates"]],
      steps: [
        { kind: "stage", build: "repetidos-par" },
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["Dos tarjetas casi iguales: Luis Vega y Luis Vegas.", "Two almost identical cards: Luis Vega and Luis Vegas."] },
      ],
    },
    {
      id: "ad3-sus-deudas", chapter: "motor", anchors: ["ficha-deuda"],
      keys: [["deuda", "debt"], ["ficha", "file"]],
      steps: [
        { kind: "go", screen: "/clientes/:dup" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Vega debe $40, de un corte ya hecho.", "Vega owes $40, from a cut already done."] },
        { kind: "go", screen: "/clientes/:dup2" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Vegas debe $80: un corte y un extra hechos.", "Vegas owes $80: one cut and one extra done."] },
      ],
    },
    {
      id: "ad3-motor", chapter: "motor", anchors: ["dup-escanear"],
      keys: [["repetidos", "duplicates"], ["inventario", "inventory"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "dup-escanear", caption: ["El inventario avisa: posibles repetidos, con su botón Revisar.", "The inventory warns: possible duplicates, with its Review button."], contexto: ["Nada se une solo jamás: la app propone, tú decides.", "Nothing ever merges by itself: the app proposes, you decide."] },
        { kind: "show", anchor: "dup-escanear", caption: ["El motor compara nombre, teléfono y dirección de cada cliente.", "The engine compares name, phone and address of every client."], contexto: ["Nombre exacto y teléfono pesan más; la dirección casa número y calle.", "Exact name and phone count most; address matches number and street."] },
      ],
    },
    {
      id: "ad3-disparos", chapter: "motor", anchors: ["dup-escanear"],
      keys: [["repetidos", "duplicates"], ["editar", "edit"]],
      steps: [
        { kind: "show", anchor: "dup-escanear", caption: ["La búsqueda salta al crear, al editar y en cada tanda.", "The check fires when creating, editing and in every batch."] },
        { kind: "show", anchor: "dup-escanear", caption: ["Y este escaneo del libro la corre sobre todos, cuando quieras.", "And this book scan runs it over everyone, whenever you want."] },
        { kind: "show", anchor: "dup-escanear", caption: ["Se proponen hasta cinco parecidos, el más fuerte primero.", "Up to five look-alikes are proposed, the strongest first."] },
      ],
    },
    {
      id: "ad3-comparar", chapter: "comparar", anchors: ["dup-escanear", "dup-grupo", "dup-comparar"],
      keys: [["comparación", "comparison"], ["repetidos", "duplicates"]],
      steps: [
        { kind: "do", anchor: "dup-escanear", caption: ["Toca Revisar y mira los grupos parecidos.", "Tap Review and look at the look-alike groups."] },
        { kind: "do", anchor: "dup-grupo", caption: ["Toca el grupo de los Luis: compara lado a lado.", "Tap the Luis group: it compares side by side."] },
        { kind: "show", anchor: "dup-comparar", caption: ["El motivo va primero: mismo teléfono y misma dirección.", "The reason comes first: same phone and same address."] },
      ],
    },
    {
      id: "ad3-comparar-filas", chapter: "comparar", anchors: ["dup-comparar", "dup-cambiar"],
      keys: [["comparación", "comparison"], ["deuda", "debt"]],
      steps: [
        { kind: "show", anchor: "dup-comparar", caption: ["Nombre, teléfono, dirección, precio, visitas y deuda, fila a fila.", "Name, phone, address, price, visits and debt, row by row."], contexto: ["Lo que coincide lleva un visto: la igualdad se ve, no se adivina.", "Matches carry a check: sameness is seen, not guessed."] },
        { kind: "show", anchor: "dup-cambiar", caption: ["Queda quien tiene más cortes hechos; Cambiar invierte esa elección.", "Whoever has more finished cuts stays; Change swaps that choice."] },
      ],
    },
    {
      id: "ad3-otras-decisiones", chapter: "comparar", anchors: ["dup-usar", "dup-otro"],
      keys: [["es otro", "another client"], ["ficha", "file"]],
      steps: [
        { kind: "show", anchor: "dup-usar", caption: ["Usar existente descarta lo nuevo y abre la ficha real.", "Use existing discards the new and opens the real file."] },
        { kind: "show", anchor: "dup-otro", caption: ["¿Son dos personas? Es otro cliente, y se recuerda.", "Are they two people? Another client, and it is remembered."], contexto: ["Queda anotado en Cambios hechos de ambos: ese par deja de proponerse.", "It is noted in both files' Changes: that pair stops being proposed."] },
      ],
    },
    {
      id: "ad3-unir", chapter: "unir", anchors: ["dup-unir"],
      keys: [["unir", "merge"], ["copia", "copy"]],
      steps: [
        { kind: "ask", anchor: "dup-unir", caption: ["¿Y si sí es el mismo? Entonces Unir, pero con red.", "And if it is the same? Then Merge, but with a net."] },
        { kind: "show", anchor: "dup-unir", caption: ["Antes de unir se guarda una copia completa del libro.", "Before merging, a full copy of the book is saved."] },
        { kind: "do", anchor: "dup-unir", caption: ["Toca Unir: todo lo de Vegas pasa a Vega.", "Tap Merge: everything of Vegas moves to Vega."] },
      ],
    },
    {
      id: "ad3-despues-deuda", chapter: "unir", anchors: ["ficha-deuda", "movimientos"],
      keys: [["deuda", "debt"], ["movimientos", "movements"]],
      steps: [
        { kind: "go", screen: "/clientes/:dup" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Las deudas se sumaron: $40 más $80 son $120.", "The debts added up: $40 plus $80 make $120."] },
        { kind: "show", anchor: "movimientos", caption: ["Sus pagos ya viven juntos, cada fila con su fecha.", "Their payments now live together, each row with its date."] },
        { kind: "show", anchor: "movimientos", caption: ["Los campos vacíos de Vega se rellenaron sin pisar los suyos.", "Vega's empty fields were filled without overwriting his own."], contexto: ["Teléfono, dirección, pista y nota corta solo llenan huecos.", "Phone, address, cue and short note only fill gaps."] },
      ],
    },
    {
      id: "ad3-despues-corte", chapter: "unir", anchors: ["historial", "lista-clientes"],
      keys: [["historial", "history"], ["archivo", "archive"]],
      steps: [
        { kind: "show", anchor: "historial", caption: ["Un corte del mismo día no pasó: quedó contado en Archivos.", "One same-day cut did not move: it stayed counted in Archive."], contexto: ["Ambos cortaron ese día: el día ya tenía corte en Vega.", "Both cut that day: the day already had a cut in Vega."] },
        { kind: "go", screen: "/clientes" },
        { kind: "show", anchor: "lista-clientes", caption: ["Ya no hay dos Luis: uno quedó, el otro en Archivos.", "No more two Luis: one stayed, the other in Archive."], contexto: ["El que se va no se borra: queda archivado con lo no movido.", "The one who leaves is not deleted: archived with what did not move."] },
      ],
    },
    {
      id: "ad3-deshacer", chapter: "deshacer", anchors: ["dup-deshacer"],
      keys: [["deshacer", "undo"], ["unir", "merge"]],
      steps: [
        { kind: "go", screen: "/clientes/:dup" },
        { kind: "show", anchor: "dup-deshacer", caption: ["Cambios hechos guarda Deshacer unión, sin prisa de diez segundos.", "Changes made keeps Undo merge, no ten-second rush."], contexto: ["El aviso al unir dura diez segundos; esta puerta no caduca.", "The merge toast lasts ten seconds; this door does not expire."] },
        { kind: "do", anchor: "dup-deshacer", caption: ["Deshazla aquí: cada Luis recupera su sitio.", "Undo it here: each Luis gets his place back."] },
      ],
    },
    {
      id: "ad3-deshacer-despues", chapter: "deshacer", anchors: ["ficha-deuda"],
      keys: [["deuda", "debt"], ["deshacer", "undo"]],
      steps: [
        { kind: "show", anchor: "ficha-deuda", caption: ["Vega volvió a sus $40: filas y saldos restaurados.", "Vega is back to his $40: rows and balances restored."], contexto: ["Los cortes retirados vuelven, salvo que su día ya esté ocupado.", "Removed cuts return, unless their day is already taken."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Deshacer dos veces avisa: esa unión ya estaba deshecha.", "Undoing twice warns: that merge was already undone."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Unir y deshacer dejan rastro: nada de esto es invisible.", "Merging and undoing leave a trace: none of this is invisible."] },
        { kind: "ref", topic: "clientes-repetidos" },
      ],
    },
  ],
};
