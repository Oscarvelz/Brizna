/**
 * AD2 · La ficha entera — la ficha como expediente completo (PLAN §1.2).
 * Leerla (tarjeta, fiabilidad), editarla (con su comprobación de
 * repetidos y sus consecuencias de horario/precio), su registro
 * (Movimientos, Historial con fotos de corte y precio tocable, Cambios
 * hechos), extras y trabajos de una vez, y los TRES mecanismos que no
 * deben confundirse — Pausa (decisión tuya), serio/alto riesgo (estado
 * calculado que congela visitas, con Seguir atendiendo) y lista negra
 * (veto que saca la deuda de los totales) — censo B-96…B-102, D-39.
 * Cierre (ronda de cierre de la Ola 2, orden de Oscar 2026-11-14):
 * el capítulo «salir» CAMINA las dos puertas de salida sin confundirlas
 * — Archivar (deslizar → Baja → Archivos, con su revisión, su extra
 * cancelado «Cliente archivado» y su Reactivar con agenda regenerada;
 * archivar y reactivar dejan Deshacer) y Borrar (deslizar → Borrar →
 * desglose leído línea a línea y CONFIRMADO sobre el escenario sellado;
 * borrar NO tiene Deshacer: su red es la copia automática previa, y un
 * repetido unido se archiva, nunca se borra) — censo B-34, B-39 y
 * B-130…B-132. Escenario del cierre: «salida-doble» (seeds-w2-a.ts) —
 * Abel Prueba (debe $80, un extra pendiente) y Beto Prueba (desglose:
 * debe $40, $20 a favor, 2 pagos, 3 visitas) ordenan primero en la
 * lista (orden por defecto Nombre A–Z).
 * Escenario: «ficha-completa» (seeds-w2-a.ts) — Aurelio debe $120;
 * Lucía Prado, en pausa, debe $80; Omar Reyes debe $240 (serio por
 * monto); Hugo Prado, vetado, debe $80; Nuria Solís es de una vez.
 *
 * ANCLAS NUEVAS que este archivo cita (present, <superficie>-<control>;
 * el integrador las acuña en anchors.ts y en el archivo dueño):
 *  - ficha-tarjeta → src/routes/clientes.$id.tsx (tarjeta principal bz-cl-card)
 *  - ficha-fiabilidad → src/routes/clientes.$id.tsx (tarjeta Fiabilidad, bz-cl-tone)
 *  - ficha-editar → src/routes/clientes.$id.tsx (botón Editar ficha y lápiz del título)
 *  - ficha-pista → src/components/client-form.tsx (campo Pista, CueField)
 *  - historial-precio → src/routes/clientes.$id.tsx (precio tocable de JobHistory)
 *  - ficha-foto-corte → src/routes/clientes.$id.tsx (Ver foto de cada corte, JobHistory)
 *  - ficha-cambios → src/routes/clientes.$id.tsx (pliegue Cambios hechos; hoy data-spot="cambios-hechos")
 *  - ficha-pausa → src/components/service-pause.tsx (botón Pausa; hoy data-spot="pausa")
 *  - ficha-continuar → src/components/service-pause.tsx (el mismo botón en Continuar; hoy data-ref="continuar")
 *  - ficha-riesgo → src/routes/clientes.$id.tsx (RiskBanner de alto riesgo)
 *  - ficha-seguir → src/components/keep-serving.tsx (botón Seguir atendiendo)
 *  - ficha-lista-negra → src/routes/clientes.$id.tsx (botón Pasar a lista negra)
 *  - ficha-borrar → src/routes/clientes.$id.tsx (botón Eliminar para siempre)
 *  - ficha-borrar-confirmar → src/routes/clientes.$id.tsx (diálogo de borrado con desglose; emisión en confirm-dialog)
 *  - tarjeta-cliente → src/components/swipe-row.tsx (raíz deslizable de la tarjeta de cliente)
 *  - lista-baja / lista-borrar → src/routes/clientes.index.tsx (botones revelados al deslizar)
 *  - baja-confirmar / borrar-confirmar → src/routes/clientes.index.tsx (confirmaciones; emisión en confirm-dialog)
 *  - clientes-archivos → src/routes/clientes.index.tsx (rectángulo Archivos del inventario)
 *  - ficha-archivar / ficha-reactivar → src/routes/clientes.$id.tsx (el botón Mover a archivos / Reactivar)
 *  - reactivar-confirmar → src/routes/clientes.$id.tsx (confirmación de reactivar; emisión en confirm-dialog)
 * El resto son anclas ya registradas en anchors.ts.
 */
import type { Module } from "../guion.ts";

export const AD2: Module = {
  id: "ad2-ficha",
  n: 8,
  floor: "advanced",
  title: ["La ficha entera", "The whole client file"],
  promise: [
    "Podrás usar la ficha como el expediente completo de un cliente.",
    "You will be able to use the client file as the complete record of a client.",
  ],
  ready: true,
  chapters: [
    { id: "leer", title: ["Leer la ficha entera", "Reading the whole file"] },
    { id: "editar", title: ["Editar, y qué pasa después", "Editing, and what happens after"] },
    { id: "registro", title: ["Su registro: Movimientos e Historial", "Their record: Movements and History"] },
    { id: "trabajos", title: ["Extras y trabajos de una vez", "Extras and one-time jobs"] },
    { id: "riesgo", title: ["Pausa, serio y lista negra", "Pause, serious and blacklist"] },
    { id: "salir", title: ["Archivar, reactivar y borrar", "Archive, reactivate, and delete"] },
  ],
  scenes: [
    {
      id: "ad2-tarjeta", chapter: "leer", anchors: ["ficha-tarjeta", "ficha-fiabilidad"],
      keys: [["ficha", "file"], ["precio", "price"], ["fiabilidad", "reliability"]],
      steps: [
        { kind: "stage", build: "ficha-completa" },
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-tarjeta", caption: ["Su tarjeta manda: frecuencia, desde cuándo y precio por corte.", "Their card leads: frequency, since when and price per cut."] },
        { kind: "show", anchor: "ficha-fiabilidad", caption: ["Fiabilidad lo resume: estado, puntaje y días sin pagar.", "Reliability sums it up: status, score and days unpaid."], contexto: ["Es lectura calculada, no un campo: cambia con pagos y cortes.", "It is calculated reading, not a field: payments and cuts change it."] },
      ],
    },
    {
      id: "ad2-editar", chapter: "editar", anchors: ["ficha-editar", "alta-nombre"],
      keys: [["editar", "edit"], ["ficha", "file"]],
      steps: [
        { kind: "do", anchor: "ficha-editar", caption: ["Editar abre el mismo formulario del alta, ya cargado.", "Editing opens the same form as signup, already filled."] },
        { kind: "show", anchor: "alta-nombre", caption: ["Nombre, teléfono o dirección nuevos disparan otra vez los repetidos.", "A new name, phone or address triggers duplicates again."], contexto: ["La comprobación corre antes de guardar, sin contarse al propio cliente.", "The check runs before saving, without counting the client itself."] },
      ],
    },
    {
      id: "ad2-pista", chapter: "editar", anchors: ["ficha-pista"],
      keys: [["pista", "cue"], ["ficha", "file"]],
      steps: [
        { kind: "type", anchor: "ficha-pista", text: ["Casa azul", "Blue house"], caption: ["La pista distingue patios parecidos sin abrir la ficha.", "The cue tells similar yards apart without opening the file."] },
        { kind: "show", anchor: "ficha-pista", caption: ["Se lee en la lista y en la ficha, y también se busca.", "It shows on the list and the file, and is searchable too."] },
      ],
    },
    {
      id: "ad2-editar-despues", chapter: "editar", anchors: ["alta-guardar"],
      keys: [["guardar", "save"], ["agenda", "schedule"], ["precio", "price"]],
      steps: [
        { kind: "show", anchor: "alta-guardar", caption: ["Guardar pide confirmación antes de tocar nada.", "Saving asks for confirmation before touching anything."] },
      ],
    },
    {
      id: "ad2-horario-precio", chapter: "editar", anchors: ["ficha-tarjeta"],
      keys: [["agenda", "schedule"], ["precio", "price"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-tarjeta", caption: ["Si cambió el horario, la agenda se rehace desde hoy.", "If the schedule changed, the agenda rebuilds from today."], contexto: ["El precio nuevo solo toca cortes de hoy en adelante.", "The new price only touches cuts from today onward."] },
        { kind: "show", anchor: "ficha-tarjeta", caption: ["Un corte atrasado conserva el precio acordado, no el nuevo.", "An overdue cut keeps the agreed price, not the new one."] },
      ],
    },
    {
      id: "ad2-movimientos", chapter: "registro", anchors: ["movimientos"],
      keys: [["movimientos", "movements"], ["deuda", "debt"]],
      steps: [
        { kind: "show", anchor: "movimientos", caption: ["Movimientos es su libro: pagos, perdones y adelantos con fecha.", "Movements is their ledger: payments, forgiveness and advances, dated."] },
        { kind: "show", anchor: "movimientos", caption: ["Aquí compruebas a dónde fue a parar cada dólar.", "Here you check where every dollar ended up."] },
      ],
    },
    {
      id: "ad2-historial", chapter: "registro", anchors: ["historial", "historial-precio"],
      keys: [["historial", "history"], ["precio", "price"]],
      steps: [
        { kind: "show", anchor: "historial", caption: ["Historial cuenta sus patios: hechos, pagado y años como cliente.", "History counts their yards: done, paid and years as client."] },
        { kind: "show", anchor: "historial-precio", caption: ["Toca un precio y la cuenta sigue el nuevo monto.", "Tap a price and the balance follows the new amount."], contexto: ["Si quedaría bajo cero, el sobrante pasa a adelanto.", "If it would go below zero, the excess becomes an advance."] },
      ],
    },
    {
      id: "ad2-foto-corte", chapter: "registro", anchors: ["ficha-foto-corte"],
      keys: [["foto", "photo"], ["historial", "history"]],
      verify: "Las fotos DE LA FICHA están apagadas por bandera en 1.5.66 (PHOTOS_ENABLED=false, censo B VERIFY-1): no se enseñan. Las fotos de cada corte en el Historial sí están vivas en código (B-112); su render en aparato real no se contrastó en esta línea.",
      steps: [
        { kind: "show", anchor: "ficha-foto-corte", caption: ["La foto de cada corte vive aquí: ver, compartir, descargar.", "Each cut's photo lives here: view, share, download."], contexto: ["Quitar la foto no borra el trabajo: el corte se queda.", "Removing the photo does not delete the job: the cut stays."] },
      ],
    },
    {
      id: "ad2-cambios", chapter: "registro", anchors: ["ficha-cambios"],
      keys: [["historial", "history"], ["restaurar", "restore"]],
      steps: [
        { kind: "show", anchor: "ficha-cambios", caption: ["Cambios hechos guarda cada versión guardada de la ficha.", "Changes made keeps every saved version of the file."] },
        { kind: "show", anchor: "ficha-cambios", caption: ["Restaurar una versión no toca pagos ni cortes hechos.", "Restoring a version touches neither payments nor finished cuts."] },
      ],
    },
    {
      id: "ad2-extra", chapter: "trabajos", anchors: ["ficha-extra", "extra-titulo", "extra-precio", "extra-guardar", "extra-confirmar", "ficha-deuda"],
      keys: [["trabajo extra", "extra job"], ["deuda", "debt"]],
      steps: [
        { kind: "do", anchor: "ficha-extra", caption: ["Un trabajo fuera del corte entra con Trabajo extra.", "A job beyond the cut enters with Extra job."] },
        { kind: "type", anchor: "extra-titulo", text: ["Recorte de setos", "Hedge trim"], caption: ["Qué hay que hacer, con sus opciones frecuentes a mano.", "What needs doing, with its frequent choices at hand."] },
        { kind: "type", anchor: "extra-precio", text: ["40", "40"], caption: ["Su precio: $40 cuando se haga.", "Its price: $40 once it is done."] },
        { kind: "do", anchor: "extra-guardar", caption: ["Añade el extra.", "Add the extra."] },
        { kind: "do", anchor: "extra-confirmar", caption: ["Confirma: siendo de hoy, nace hecho y suma.", "Confirm: being today's, it is born done and adds up."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["El saldo subió: un extra futuro, en cambio, esperaría pendiente.", "The balance rose: a future extra would wait pending instead."], contexto: ["Futuro queda en su agenda de ese día, sin sumar todavía.", "A future one stays on that day's schedule, adding nothing yet."] },
      ],
    },
    {
      id: "ad2-una-vez", chapter: "trabajos", anchors: ["ficha-tarjeta", "ficha-deuda"],
      keys: [["una vez", "one-time"], ["ficha", "file"], ["archivo", "archive"]],
      steps: [
        { kind: "go", screen: "/clientes/:unavez" },
        { kind: "show", anchor: "ficha-tarjeta", caption: ["Una clienta de una vez vive igual: deuda, pagos, historial.", "A one-time client lives the same: debt, payments, history."], contexto: ["Sin frecuencia: su único trabajo es su agenda entera.", "No frequency: her single job is her whole schedule."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Al quedar a cero y sin pendientes, se archiva sola.", "At zero with nothing pending, she is archived automatically."] },
      ],
    },
    {
      id: "ad2-pausa", chapter: "riesgo", anchors: ["ficha-continuar", "ficha-deuda"],
      keys: [["pausa", "pause"], ["deuda", "debt"]],
      steps: [
        { kind: "go", screen: "/clientes/:pausa" },
        { kind: "show", anchor: "ficha-deuda", caption: ["Lucía está en pausa y debe $80: siguen en Por cobrar.", "Lucía is paused and owes $80: it stays in To collect."] },
        { kind: "show", anchor: "ficha-continuar", caption: ["Continuar la devuelve a la agenda, desde hoy, con su ritmo.", "Continuing returns her to the schedule, from today, her rhythm."], contexto: ["Pausar canceló sus extras pendientes a la vista; no vuelven solos.", "Pausing visibly cancelled her pending extras; they never return by themselves."] },
      ],
    },
    {
      id: "ad2-pausa-tuya", chapter: "riesgo", anchors: ["ficha-pausa"],
      keys: [["pausa", "pause"], ["agenda", "schedule"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-pausa", caption: ["Pausa la decides tú: sin cortes ni trabajos hasta Continuar.", "Pause is your call: no cuts or jobs until Continuing."] },
        { kind: "show", anchor: "ficha-pausa", caption: ["Mientras tanto, su caso queda marcado En espera, sin perdonarse.", "Meanwhile, their case sits marked as Waiting, unforgiven."] },
      ],
    },
    {
      id: "ad2-serio", chapter: "riesgo", anchors: ["ficha-riesgo", "ficha-seguir", "ficha-deuda"],
      keys: [["serio", "serious"], ["seguir atendiendo", "keep serving"]],
      steps: [
        { kind: "go", screen: "/clientes/:serio" },
        { kind: "show", anchor: "ficha-riesgo", caption: ["Serio no es un botón: el sistema congela por deuda vencida.", "Serious is not a button: the system freezes overdue debt."], contexto: ["Omar debe $240 y cruzó el monto de riesgo, $200.", "Omar owes $240 and crossed the risk amount, $200."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su deuda no cambió: lo que cambió es si se le sigue trabajando.", "His debt did not change: what changed is whether he keeps getting service."] },
        { kind: "show", anchor: "ficha-seguir", caption: ["Seguir atendiendo deshiela su agenda si ya acordaste algo.", "Keep serving thaws his schedule if you already agreed on something."] },
      ],
    },
    {
      id: "ad2-lista-negra", chapter: "riesgo", anchors: ["ficha-lista-negra", "ficha-deuda"],
      keys: [["lista negra", "blacklist"], ["totales", "totals"]],
      steps: [
        { kind: "go", screen: "/clientes/:vetado" },
        { kind: "show", anchor: "ficha-lista-negra", caption: ["Lista negra: vetado, sin agenda sola y fuera de totales.", "Blacklist: barred, no self-scheduling and out of totals."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su ficha sigue enseñando sus $80 reales, enteros.", "His file still shows his real $80, in full."], contexto: ["Quitarlo del veto regenera su agenda y su deuda vuelve a contar.", "Unbarring rebuilds his schedule and his debt counts again."] },
      ],
    },
    {
      id: "ad2-tres-mecanismos", chapter: "riesgo", anchors: ["ficha-pausa"],
      keys: [["pausa", "pause"], ["serio", "serious"], ["lista negra", "blacklist"]],
      steps: [
        { kind: "go", screen: "/clientes/:aurelio" },
        { kind: "show", anchor: "ficha-pausa", caption: ["Tres mecanismos, tres dueños: tú pausas, el sistema marca, tú vetas.", "Three mechanisms, three owners: you pause, the system flags, you blacklist."] },
      ],
    },
    {
      id: "ad2-salir-puerta", chapter: "salir", anchors: ["tarjeta-cliente", "lista-baja", "lista-borrar"],
      keys: [["baja", "archive"], ["borrar", "delete"]],
      steps: [
        { kind: "stage", build: "salida-doble" },
        { kind: "go", screen: "/clientes" },
        { kind: "swipe", anchor: "tarjeta-cliente", caption: ["Desliza la tarjeta de Abel hacia la izquierda.", "Swipe Abel's card to the left."] },
        { kind: "show", anchor: "lista-baja", caption: ["Baja lo archiva: sale de la agenda, guardado entero.", "Archive moves him out: off the schedule, kept whole."] },
        { kind: "show", anchor: "lista-borrar", caption: ["Borrar lo destruye para siempre, con todo su historial.", "Delete destroys him forever, with all his history."] },
      ],
    },
    {
      id: "ad2-salir-archivar", chapter: "salir", anchors: ["lista-baja", "baja-confirmar", "lista-clientes", "deshacer-barra"],
      keys: [["archivos", "archive"], ["deshacer", "undo"]],
      steps: [
        { kind: "do", anchor: "lista-baja", caption: ["Toca Baja en la tarjeta de Abel.", "Tap Archive on Abel's card."] },
        { kind: "show", anchor: "baja-confirmar", caption: ["El diálogo promete: guardado en Archivos con todos sus datos.", "The dialog promises: saved in Archive with all his data."], contexto: ["Sus extras pendientes se cancelan a la vista, no se borran.", "His pending extras are cancelled visibly, never deleted."] },
        { kind: "do", anchor: "baja-confirmar", caption: ["Confirma con Mover a archivos.", "Confirm with Move to archive."] },
        { kind: "show", anchor: "lista-clientes", caption: ["Abel ya no está en la lista: Beto queda primero.", "Abel is gone from the list: Beto is first now."] },
        { kind: "show", anchor: "deshacer-barra", caption: ["Archivar deja Deshacer arriba, por si te arrepientes.", "Archiving leaves Undo on top, in case you regret it."], contexto: ["Reactivar también deja Deshacer. Borrar, nunca: recuerda la diferencia.", "Reactivating leaves Undo too. Deleting, never: remember the difference."] },
      ],
    },
    {
      id: "ad2-salir-archivos", chapter: "salir", anchors: ["clientes-archivos", "lista-clientes", "ficha-tarjeta", "historial", "ficha-deuda"],
      keys: [["archivos", "archive"], ["historial", "history"]],
      steps: [
        { kind: "do", anchor: "clientes-archivos", caption: ["Abre Archivos desde el inventario: ahí espera Abel.", "Open Archive from the inventory: Abel waits there."] },
        { kind: "show", anchor: "lista-clientes", caption: ["Sigue aquí, con su deuda de $80 intacta.", "He is still here, his $80 debt intact."] },
        { kind: "go", screen: "/clientes/:abel" },
        { kind: "show", anchor: "ficha-tarjeta", caption: ["Su ficha guarda todo: horario, cuenta e historial.", "His file keeps everything: schedule, account and history."] },
        { kind: "show", anchor: "historial", caption: ["Su extra pendiente quedó cancelado aquí: «Cliente archivado».", "His pending extra sits cancelled here: “Client archived.”"], contexto: ["Sus cortes generados pendientes desaparecieron al archivarlo.", "His generated pending cuts disappeared when he was archived."] },
        { kind: "show", anchor: "ficha-deuda", caption: ["Su deuda sigue en su ficha, entera: $80.", "His debt stays on his file, whole: $80."], contexto: ["Pero ya no suma en Por cobrar: cuentan los activos.", "But it no longer counts in To collect: active clients count."] },
      ],
    },
    {
      id: "ad2-salir-reactivar", chapter: "salir", anchors: ["ficha-reactivar", "reactivar-confirmar", "ficha-archivar", "agenda"],
      keys: [["reactivar", "reactivate"], ["agenda", "schedule"]],
      steps: [
        { kind: "do", anchor: "ficha-reactivar", caption: ["Toca Reactivar en su ficha: vuelve a la ruta.", "Tap Reactivate on his file: back on the route."] },
        { kind: "show", anchor: "reactivar-confirmar", caption: ["El diálogo promete: vuelve con su horario y su cuenta.", "The dialog promises: back with his schedule and account."] },
        { kind: "do", anchor: "reactivar-confirmar", caption: ["Confirma con Sí, reactivar.", "Confirm with Yes, reactivate."] },
        { kind: "show", anchor: "ficha-archivar", caption: ["La ficha guarda la misma baja: Mover a archivos.", "The file holds the same archive door: Move to archive."], contexto: ["Es la puerta de la lista, también desde dentro.", "It is the list's door, also from inside."] },
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["Su agenda volvió: cortes nuevos desde hoy, su ritmo.", "His schedule is back: new cuts from today, his pace."], contexto: ["El extra cancelado al archivar no volvió solo.", "The extra cancelled at archiving did not return by itself."] },
      ],
    },
    {
      id: "ad2-salir-borrar", chapter: "salir", anchors: ["tarjeta-cliente", "lista-borrar", "borrar-confirmar"],
      keys: [["borrar", "delete"], ["historial", "history"]],
      steps: [
        { kind: "go", screen: "/clientes" },
        { kind: "swipe", anchor: "tarjeta-cliente", caption: ["Con Beto, el mismo gesto: desliza a la izquierda.", "With Beto, the same gesture: swipe left."], contexto: ["Baja guarda; Borrar destruye: no los confundas.", "Archive keeps; Delete destroys: never confuse them."] },
        { kind: "do", anchor: "lista-borrar", caption: ["Toca Borrar en la tarjeta de Beto.", "Tap Delete on Beto's card."] },
        { kind: "show", anchor: "borrar-confirmar", caption: ["El desglose manda leer antes: debe $40.", "The breakdown demands reading first: he owes $40."], contexto: ["La ficha trae esta misma puerta, con este mismo desglose.", "The file carries this same door, with this same breakdown."] },
        { kind: "show", anchor: "borrar-confirmar", caption: ["Tiene $20 a favor: también se borrarían.", "He has $20 in advance: also deleted."] },
        { kind: "show", anchor: "borrar-confirmar", caption: ["Dos pagos y tres visitas se borrarán con él.", "Two payments and three visits will be deleted with him."], contexto: ["Es irreversible: se borra con todo su historial.", "It is irreversible: deleted with all his history."] },
      ],
    },
    {
      id: "ad2-salir-borrar-hecho", chapter: "salir", anchors: ["borrar-confirmar", "lista-clientes"],
      keys: [["borrar", "delete"], ["copia", "copy"]],
      steps: [
        { kind: "do", anchor: "borrar-confirmar", caption: ["Confírmalo aquí: el escenario sellado hace seguro practicarlo.", "Confirm it here: the sealed stage makes it safe to practice."] },
        { kind: "show", anchor: "lista-clientes", caption: ["Beto ya no está: ni aquí ni en Archivos.", "Beto is gone: neither here nor in Archive."], contexto: ["Borrar no tiene Deshacer: su red es la copia previa.", "Deleting has no Undo: its net is the previous backup."] },
        { kind: "show", anchor: "lista-clientes", caption: ["¿Un repetido unido? Se archiva, nunca se borra.", "A merged duplicate? Archived, never deleted."] },
        { kind: "ref", topic: "clientes-repetidos" },
      ],
    },
  ],
};
