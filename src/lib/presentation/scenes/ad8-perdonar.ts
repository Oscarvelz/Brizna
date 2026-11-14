/**
 * AD8 · Perdonar — y después (el buque insignia de las consecuencias) —
 * el ciclo completo en AMBAS direcciones, censo D sección R-1…R-14:
 * parcial con cifras (perdonar $80 de $120, quedan $40), total, en grupo
 * con su confirmación, el perdón dentro de Deshacer y el límite de
 * Deshacer (20 entradas, solo memoria, muere al recargar — R-14/D-57),
 * el reloj de atraso que el perdón reinicia (R-6/H-D7), dónde queda
 * anotado (pliegue «Perdonado este mes», fila tachada en Movimientos,
 * R-7), el auto-archivo del cliente de una vez (R-8) y el pago del resto
 * tras un parcial por la vía normal (R-9).
 *
 * EL DESPUÉS DEL PERDÓN TOTAL, contra CANON 1.5.69 (esta copia es
 * 1.5.66): el pago tardío entra por Adelanto (o Pagado con cantidad) en
 * la ficha, queda como adelanto que se gasta solo en el próximo Hecho
 * (R-11/R-12) y DESDE 1.5.69 APARECE en las listas de Cobrado de Cobros
 * con fila propia marcada «Adelanto» + método; totales y listas cuentan
 * lo mismo (H-D2 cerrado en canon). Puesta en escena: el perdón y la
 * declaración por Adelanto se ACTÚAN en la ficha (la copia 1.5.66 los
 * ejecuta igual); la aparición en la lista de Cobrado se lleva con
 * show+contexto sobre la superficie Cobrado de Cobros, redactada a la
 * verdad 1.5.69, con el verify de la escena — ni se enseña la lectura
 * vieja de 1.5.66 ni se finge la fila en esta copia.
 * Escenarios re-sembrados por capítulo: perdon-parcial, perdon-total,
 * perdon-grupo, perdon-unavez — un perdón actuado no se des-actúa para
 * la escena siguiente; cada capítulo nace con su aritmética limpia.
 *
 * ANCLAS NUEVAS (present, <superficie>-<control>) — a acuñar por la ola:
 *  - cobros-perdonar            · routes/cobros.tsx (botón Perdonar de la tarjeta de Por cobrar)
 *  - perdonar-cantidad          · routes/cobros.tsx (campo «Cantidad a perdonar» del diálogo Waive)
 *  - perdonar-confirmar         · routes/cobros.tsx (confirmar «Perdonar saldo»; emisión en confirm-dialog)
 *  - cobros-grupo               · routes/cobros.tsx (casillas de elección en Por cobrar) [definida en AD7]
 *  - cobros-perdonar-elegidos   · routes/cobros.tsx (botón Perdonar elegidos)
 *  - cobros-grupo-confirmar     · routes/cobros.tsx (confirmación «Perdonar saldos»)
 *  - ficha-perdonar             · routes/clientes.$id.tsx (botón Perdonar de WaiveButton)
 *  - ficha-perdonar-cantidad    · routes/clientes.$id.tsx (campo del diálogo de WaiveButton)
 *  - ficha-perdonar-confirmar   · routes/clientes.$id.tsx (confirmar de WaiveButton; emisión en confirm-dialog)
 *  - deshacer-barra             · components/undo-bar.tsx (pastilla Deshacer/Rehacer)
 *  - deshacer-confirmar         · components/undo-bar.tsx (confirmación de deshacer)
 * Anclas de AD7 que se reusan: cobros-perdonado.
 * Anclas existentes que se reusan: ficha-deuda, ficha-adelanto,
 * pago-cantidad, pago-confirmar, movimientos, cobrado, hecho.
 */
import type { Module } from "../guion.ts";

export const AD8: Module = {
  id: "ad8-perdonar",
  n: 14,
  floor: "advanced",
  title: ["Perdonar — y después", "Forgive — and after"],
  promise: [
    "Podrás perdonar parte o todo, deshacerlo, y declarar el pago si el cliente paga después.",
    "You will be able to forgive part or all, undo it, and record the payment if the client pays later.",
  ],
  ready: true,
  chapters: [
    { id: "parcial", title: ["Perdonar una parte", "Forgiving a part"] },
    { id: "total", title: ["Perdonar todo", "Forgiving it all"] },
    { id: "despues", title: ["Y después: paga lo perdonado", "And after: they pay the forgiven"] },
    { id: "grupo", title: ["En grupo y Deshacer", "In bulk and Undo"] },
    { id: "limites", title: ["Los límites honestos", "The honest limits"] },
  ],
  scenes: [
    {
      id: "ad8-parcial-abrir", chapter: "parcial", anchors: ["cobros-perdonar"],
      keys: [["perdonar", "forgive"], ["perdón", "forgiveness"]],
      steps: [
        { kind: "stage", build: "perdon-parcial" },
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobros-perdonar", caption: ["Perdonar saca dinero de Por cobrar sin que entre nada.", "Forgiving removes money from To collect with nothing coming in."] },
        { kind: "do", anchor: "cobros-perdonar", caption: ["Toca Perdonar en la tarjeta de Don Aurelio.", "Tap Forgive on Don Aurelio's card."] },
      ],
    },
    {
      id: "ad8-parcial-monto", chapter: "parcial", anchors: ["perdonar-cantidad", "perdonar-confirmar"],
      keys: [["cantidad", "amount"], ["parcial", "partial"]],
      steps: [
        { kind: "type", anchor: "perdonar-cantidad", text: ["80", "80"], caption: ["Escribe $80 de sus $120: un perdón parcial.", "Write $80 of his $120: a partial forgiveness."] },
        { kind: "show", anchor: "perdonar-cantidad", caption: ["El diálogo lo dice antes: quedan debiendo $40.", "The dialog says it first: $40 still owing."] },
        { kind: "do", anchor: "perdonar-confirmar", caption: ["Confirma el perdón de $80.", "Confirm the $80 forgiveness."] },
      ],
    },
    {
      id: "ad8-parcial-despues", chapter: "parcial", anchors: ["ficha-deuda", "movimientos"],
      keys: [["saldo", "balance"], ["movimientos", "movements"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su saldo bajó a $40: el resto sigue debiendo.", "His balance dropped to $40: the rest is still owed."] },
        { kind: "show", anchor: "movimientos", caption: ["En Movimientos, el perdón vive como fila tachada.", "In Movements, the forgiveness lives as a struck-through row."], contexto: ["Perdonar reinicia su reloj de atraso: los días cuentan desde hoy.", "Forgiving resets his lateness clock: days count from today."] },
      ],
    },
    {
      id: "ad8-parcial-paga-resto", chapter: "parcial", anchors: ["ficha-deuda"],
      keys: [["el resto", "the rest"], ["por cobrar", "to collect"]],
      steps: [
        { kind: "show", anchor: "ficha-deuda", caption: ["Si paga el resto, entra por la vía normal.", "If he pays the rest, it enters the normal way."], contexto: ["Lo perdonado queda perdonado y lo pagado, pagado: dos filas separadas.", "Forgiven stays forgiven and paid stays paid: two separate rows."] },
      ],
    },
    {
      id: "ad8-total-abrir", chapter: "total", anchors: ["ficha-perdonar", "ficha-perdonar-cantidad"],
      keys: [["todo el saldo", "the whole balance"], ["total", "full"]],
      steps: [
        { kind: "stage", build: "perdon-total" },
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-perdonar", caption: ["En su ficha, Perdonar también vive junto al saldo.", "On his file, Forgive also lives beside the balance."] },
        { kind: "do", anchor: "ficha-perdonar", caption: ["Toca Perdonar en la ficha.", "Tap Forgive on the file."] },
        { kind: "show", anchor: "ficha-perdonar-cantidad", caption: ["El campo nace vacío: vacío significa todo el saldo.", "The field is born empty: empty means the whole balance."] },
      ],
    },
    {
      id: "ad8-total-confirmar", chapter: "total", anchors: ["ficha-perdonar-confirmar", "ficha-deuda", "cobros-perdonado"],
      keys: [["confirmar", "confirm"], ["perdonado este mes", "forgiven this month"]],
      steps: [
        { kind: "do", anchor: "ficha-perdonar-confirmar", caption: ["Confirma: sus $120 salen de Por cobrar.", "Confirm: his $120 leave To collect."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Saldo en cero. No es espera: decidiste no cobrarlo.", "Balance at zero. Not waiting: you decided not to collect it."] },
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobros-perdonado", caption: ["Lo perdonado queda anotado en Perdonado este mes.", "Forgiven money stays recorded in Forgiven this month."] },
      ],
    },
    {
      id: "ad8-despues-puerta", chapter: "despues", anchors: ["ficha-adelanto"],
      keys: [["adelanto", "advance"], ["después", "afterwards"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "ask", anchor: "ficha-adelanto", caption: ["¿Y si mañana paga lo que perdonaste?", "And if tomorrow he pays what you forgave?"] },
        { kind: "show", anchor: "ficha-adelanto", caption: ["No hay botón con ese nombre: la puerta es Adelanto.", "No button has that name: the door is Advance."], contexto: ["Con saldo cero, Abono se apaga; Adelanto queda siempre abierto.", "With zero balance, Partial turns off; Advance stays always open."] },
      ],
    },
    {
      id: "ad8-despues-declarar", chapter: "despues", anchors: ["ficha-adelanto", "pago-cantidad", "pago-confirmar", "ficha-deuda"],
      keys: [["pago por adelantado", "advance payment"], ["adelanto", "advance"]],
      steps: [
        { kind: "do", anchor: "ficha-adelanto", caption: ["Toca Adelanto en su ficha.", "Tap Advance on his file."] },
        { kind: "type", anchor: "pago-cantidad", text: ["120", "120"], caption: ["Escribe los $120 que trajo hoy.", "Write the $120 he brought today."] },
        { kind: "do", anchor: "pago-confirmar", caption: ["Confirma la declaración del pago.", "Confirm recording the payment."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["El saldo no revive: los $120 quedan de adelanto.", "The balance does not revive: the $120 stay as advance."], contexto: ["Lo perdonado no se des-perdona: su fila tachada sigue entera.", "Forgiven is not un-forgiven: its struck row stays whole."] },
      ],
    },
    {
      id: "ad8-despues-lista", chapter: "despues", anchors: ["cobrado", "movimientos"],
      keys: [["cobrado", "collected"], ["adelanto", "advance"]],
      verify: "VERIFICADO al fusionar (2026-11-14, sobre canon 1.5.71): AD8 caminado entero en banco — el adelanto de $120 se declara en escena y el panel Cobrado lo cuenta en Semana/Mes/Año ($120); el predicado de listas 1.5.69 (paid+prepaid, fila «Adelanto») está verbatim en el árbol fusionado.",
      steps: [
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobrado", caption: ["En Cobrado, su fila propia dice «Adelanto» y su método.", "In Collected, its own row says “Advance” and its method."], contexto: ["Totales y listas cuentan lo mismo: ningún dólar queda escondido.", "Totals and lists count the same: no dollar stays hidden."] },
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "movimientos", caption: ["En Movimientos conviven: Perdonado tachado y Adelanto nuevo.", "In Movements they live together: struck Forgiven and new Advance."] },
      ],
    },
    {
      id: "ad8-despues-gasta", chapter: "despues", anchors: ["hecho"],
      keys: [["se usa primero", "used first"], ["hecho", "done"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "hecho", caption: ["Ese adelanto se gasta solo en su próximo Hecho.", "That advance spends itself on his next Done."], contexto: ["El Hecho consume el adelanto antes de crear deuda nueva.", "Done consumes the advance before creating new debt."] },
      ],
    },
    {
      id: "ad8-grupo-elegir", chapter: "grupo", anchors: ["cobros-grupo", "cobros-perdonar-elegidos"],
      keys: [["grupo", "bulk"], ["elegidos", "selected"]],
      steps: [
        { kind: "stage", build: "perdon-grupo" },
        { kind: "go", screen: "/cobros" },
        { kind: "show", anchor: "cobros-grupo", caption: ["Tres vecinos deben $40, $50 y $60.", "Three neighbors owe $40, $50, and $60."] },
        { kind: "show", anchor: "cobros-grupo", caption: ["Marca sus casillas en Por cobrar, una por tarjeta.", "Check their boxes in To collect, one per card."] },
        { kind: "show", anchor: "cobros-perdonar-elegidos", caption: ["Con elegidos, aparece Perdonar elegidos.", "With selections, Forgive selected appears."] },
      ],
    },
    {
      id: "ad8-grupo-confirmar", chapter: "grupo", anchors: ["cobros-perdonar-elegidos", "cobros-grupo-confirmar"],
      keys: [["confirmación", "confirmation"], ["perdonar saldos", "forgive balances"]],
      steps: [
        { kind: "do", anchor: "cobros-perdonar-elegidos", caption: ["Toca Perdonar elegidos.", "Tap Forgive selected."] },
        { kind: "show", anchor: "cobros-grupo-confirmar", caption: ["La confirmación avisa: no se cuenta como cobrado.", "The confirmation warns: it does not count as collected."], contexto: ["En grupo no hay parciales: cada saldo se perdona entero.", "In bulk there are no partials: each balance is forgiven whole."] },
        { kind: "do", anchor: "cobros-grupo-confirmar", caption: ["Confirma con Perdonar saldos.", "Confirm with Forgive balances."] },
      ],
    },
    {
      id: "ad8-grupo-deshacer", chapter: "grupo", anchors: ["deshacer-barra", "deshacer-confirmar"],
      keys: [["deshacer", "undo"], ["perdón", "forgiveness"]],
      steps: [
        { kind: "show", anchor: "deshacer-barra", caption: ["Todo perdón entra en Deshacer como un pago más.", "Every forgiveness enters Undo like any payment."] },
        { kind: "do", anchor: "deshacer-barra", caption: ["Toca Deshacer: la deuda del grupo vuelve exacta.", "Tap Undo: the group's debt returns exactly."] },
        { kind: "show", anchor: "deshacer-confirmar", caption: ["La confirmación cuenta qué se deshace antes de hacerlo.", "The confirmation lists what will be undone before doing it."] },
      ],
    },
    {
      id: "ad8-unavez", chapter: "limites", anchors: ["ficha-perdonar"],
      keys: [["una vez", "one-time"], ["archivo", "archive"]],
      steps: [
        { kind: "stage", build: "perdon-unavez" },
        { kind: "go", screen: "/clientes/:unavez" },
        { kind: "show", anchor: "ficha-perdonar", caption: ["Nora era de una vez y debe $40.", "Nora was one-time and owes $40."], contexto: ["Un perdón total la dejaría en cero, sin pendientes: se archivaría sola.", "A full forgiveness would leave her at zero, nothing pending: archived automatically."] },
        { kind: "show", anchor: "ficha-perdonar", caption: ["Perdonar a un permanente nunca archiva a nadie.", "Forgiving a regular client never archives anyone."] },
      ],
    },
    {
      id: "ad8-limite-deshacer", chapter: "limites", anchors: ["deshacer-barra"],
      keys: [["deshacer", "undo"], ["límite", "limit"]],
      steps: [
        { kind: "show", anchor: "deshacer-barra", caption: ["Deshacer guarda veinte entradas y vive solo en memoria.", "Undo keeps twenty entries and lives only in memory."], contexto: ["Recargar la app lo vacía: pasado eso, el perdón es definitivo.", "Reloading the app empties it: past that, forgiveness is final."] },
        { kind: "show", anchor: "deshacer-barra", caption: ["Es una red con límite, no un seguro eterno.", "It is a net with a limit, not eternal insurance."] },
        { kind: "ref", topic: "perdonado" },
      ],
    },
  ],
};
