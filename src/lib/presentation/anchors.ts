/**
 * anchors — el registro de anclas vivas de la Presentación (ANCHOR-REGISTRY.md).
 *
 * Una escena nunca guarda una coordenada ni un localizador: guarda un id de
 * este registro, y el conductor lo resuelve contra la app tal como está hoy.
 * Estrategias (ANCHOR-REGISTRY §1, en el vocabulario del contrato compartido):
 *  - "spot"    B1: el gancho de la casa, [data-spot~="value"].
 *  - "id"      B3: un id DOM existente, document.getElementById(value).
 *  - "present" B6: ancla acuñada para la Presentación, [data-present="value"],
 *              sobre el elemento interactivo exacto (§2: <superficie>-<control>).
 *  - "hook"    B4: otro data-* estable emitido por el componente dueño.
 * (B2 registro y B5 lugar no son destinos de escena en esta ola: las rutas de
 * llegada son los pasos `go`, y los temas del Manual son pasos `ref`.)
 *
 * `file` es el archivo dueño RELATIVO a src/ donde el localizador se emite o
 * donde vive su literal (cuando la emisión está en un componente compartido,
 * p. ej. ConfirmDialog, el literal vive en el llamador y `file` es el llamador).
 * `presence`: "siempre" o "estado: <qué debe ser verdad>" — una escena que
 * apunta a un ancla de estado la precede de un paso stage/go (cerca F-6).
 */

export interface AnchorRec {
  id: string;
  by: "spot" | "id" | "present" | "hook";
  value: string;
  file: string;
  serves: string;
  presence: "siempre" | `estado: ${string}`;
}

/** Primer elemento VISIBLE que casa con el selector (el anillo del Manual hace igual). */
function firstVisible(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Resuelve un id del registro contra el DOM vivo. Sin localizador alternativo:
 * si el ancla murió, devuelve null y la escena se salta con gracia (FENCE §5). */
export function resolveAnchor(id: string): HTMLElement | null {
  const rec = ANCHORS.find((a) => a.id === id);
  if (!rec) return null;
  switch (rec.by) {
    case "spot":
      return firstVisible(`[data-spot~="${rec.value}"]`);
    case "id":
      return (typeof document === "undefined" ? null : document.getElementById(rec.value)) as HTMLElement | null;
    case "present":
      return firstVisible(`[data-present="${rec.value}"]`);
    case "hook":
      return firstVisible(`[${rec.value}]`);
  }
}

export const anchorById = (id: string): AnchorRec | undefined => ANCHORS.find((a) => a.id === id);

export const ANCHORS: readonly AnchorRec[] = [
  /* ================= B1 · spot — el sistema de la casa ================= */
  { id: "vistas", by: "spot", value: "vistas", file: "components/density-toggle.tsx", serves: "Q1 A-41 (selector Grande/Media/Lista/Malla)", presence: "siempre" },
  { id: "parar-dia", by: "spot", value: "parar-dia", file: "routes/index.tsx", serves: "Q3 A-79 (Parar el día / por lluvia)", presence: "siempre" },
  { id: "pasar-pendientes", by: "spot", value: "pasar-pendientes", file: "routes/index.tsx", serves: "Q3 A-77/A-78 (Pasar atrasados / los de hoy)", presence: "estado: hay pendientes de hoy o atrasados (la pareja de botones solo se pinta entonces)" },
  { id: "todos", by: "spot", value: "todos", file: "routes/index.tsx", serves: "Q3 A-71 (cerrar el día entero)", presence: "estado: más de un patio pendiente hoy" },
  { id: "hecho", by: "spot", value: "hecho", file: "components/job-card.tsx", serves: "Q1/Q3 A-64/A-65 (botón Hecho; data-spot familiar «hecho propina»)", presence: "estado: una tarjeta con trabajo pendiente visible" },
  { id: "por-cobrar", by: "spot", value: "por-cobrar", file: "routes/cobros.tsx", serves: "Q4 D-44 (cabecera Por cobrar)", presence: "siempre" },
  { id: "cobrado", by: "spot", value: "cobrado", file: "routes/cobros.tsx", serves: "Q4 D-44/D-41 (vista y listas de Cobrado)", presence: "siempre" },
  { id: "ficha-deuda", by: "spot", value: "ficha-deuda", file: "routes/clientes.$id.tsx", serves: "Q4 B-91/D-1 (bloque Deuda de la ficha)", presence: "siempre" },
  { id: "clientes-filtros", by: "spot", value: "clientes-filtros", file: "routes/clientes.index.tsx", serves: "Q2 B-13 (barra de filtros de Clientes)", presence: "siempre" },
  { id: "lista-clientes", by: "spot", value: "lista-clientes", file: "routes/clientes.index.tsx", serves: "Q2 B-1 (tarjeta de la lista; emisión familiar en el enlace de la tarjeta)", presence: "estado: hay clientes en la lista" },
  { id: "tipo-cliente", by: "spot", value: "tipo-cliente", file: "components/client-form.tsx", serves: "Q2 B-42 (Permanente vs Una vez)", presence: "siempre" },
  { id: "cobro-cliente", by: "spot", value: "cobro-cliente", file: "components/client-form.tsx", serves: "Q2 B-65 (bloque Cobro del alta)", presence: "siempre" },
  { id: "frecuencia", by: "spot", value: "frecuencia", file: "components/client-form.tsx", serves: "Q2 B-55 (campo Frecuencia; emisión familiar Field data-spot={topic})", presence: "siempre" },
  { id: "dia-inicio", by: "spot", value: "dia-inicio", file: "components/client-form.tsx", serves: "Q2 B-59 (campo Día de inicio; emisión familiar Field data-spot={topic})", presence: "siempre" },
  { id: "historial", by: "spot", value: "historial", file: "routes/clientes.$id.tsx", serves: "Q2 B-109 (pliegue Historial de la ficha)", presence: "siempre" },
  { id: "movimientos", by: "spot", value: "movimientos", file: "routes/clientes.$id.tsx", serves: "Q4 B-113/D-29 (pliegue Movimientos)", presence: "siempre" },
  { id: "agenda", by: "spot", value: "agenda", file: "routes/agenda.tsx", serves: "Q2/Q3 C (filtros de Agenda)", presence: "siempre" },

  /* ================= B3 · id — ids DOM existentes ================= */
  { id: "dia-hoy", by: "id", value: "dia-hoy", file: "routes/index.tsx", serves: "Q3 A-31/A-35 (pliegue del día de hoy)", presence: "estado: el pliegue de hoy está pintado (llega en el segundo tiempo de Hoy)" },
  { id: "en-la-mira", by: "id", value: "en-la-mira", file: "routes/index.tsx", serves: "Q3 A-61 (sección Fijados)", presence: "estado: hay patios fijados (atrasados o alto riesgo)" },
  { id: "hechos-hoy", by: "id", value: "hechos-hoy", file: "routes/index.tsx", serves: "Q3 A-37 (pliegue Hechos hoy)", presence: "siempre" },
  { id: "aj-manual", by: "id", value: "aj-manual", file: "components/user-manual.tsx", serves: "Q6 F (pliegue del Manual en Ajustes; el id lo emite Fold)", presence: "siempre" },
  { id: "mn-doc", by: "id", value: "mn-doc", file: "routes/manual.tsx", serves: "Q6 F (documento del Manual)", presence: "siempre" },

  /* ================= B4 · hook — data-* del componente dueño ================= */
  { id: "contact-row", by: "hook", value: "data-contact-row", file: "components/job-card.tsx", serves: "Q5 I-1 (la fila de los cuatro botones de la tarjeta)", presence: "estado: tarjeta Grande/Media con teléfono o dirección" },

  /* ================= B6 · present — acuñadas en esta ola ================= */
  // Las cinco pestañas (app-shell: el literal vive en TAB_PRESENT; la emisión, en NavLink/RailItem/PaneBar).
  { id: "pestana-hoy", by: "present", value: "pestana-hoy", file: "components/app-shell.tsx", serves: "Q1 A-1/A-3/A-4 (pestaña Hoy)", presence: "siempre" },
  { id: "pestana-agenda", by: "present", value: "pestana-agenda", file: "components/app-shell.tsx", serves: "Q1 A-1 (pestaña Agenda)", presence: "siempre" },
  { id: "pestana-clientes", by: "present", value: "pestana-clientes", file: "components/app-shell.tsx", serves: "Q1 A-1 (pestaña Clientes)", presence: "siempre" },
  { id: "pestana-cobros", by: "present", value: "pestana-cobros", file: "components/app-shell.tsx", serves: "Q1 A-1 (pestaña Cobros)", presence: "siempre" },
  { id: "pestana-estudio", by: "present", value: "pestana-estudio", file: "components/app-shell.tsx", serves: "Q1 A-1/A-5 (pestaña Estudio)", presence: "siempre" },
  // La tarjeta de trabajo, de un vistazo (job-card).
  { id: "tarjeta-nombre", by: "present", value: "tarjeta-nombre", file: "components/job-card.tsx", serves: "Q1 A-48/A-15 (el nombre manda; puerta a la ficha)", presence: "estado: una tarjeta de trabajo visible" },
  { id: "tarjeta-precio", by: "present", value: "tarjeta-precio", file: "components/job-card.tsx", serves: "Q1 A-49 (el precio, en su esquina y en neutro)", presence: "estado: una tarjeta de trabajo visible" },
  { id: "tarjeta-pin", by: "present", value: "tarjeta-pin", file: "components/job-card.tsx", serves: "Q1 A-58 (el pin desnudo; verde = fijado)", presence: "estado: una tarjeta Grande/Media visible" },
  { id: "tarjeta-estado", by: "present", value: "tarjeta-estado", file: "components/job-card.tsx", serves: "Q1/Q3 A-56/A-57 (la pastilla de estado y sus días)", presence: "estado: una tarjeta Grande/Media visible" },
  { id: "tarjeta-posponer", by: "present", value: "tarjeta-posponer", file: "components/job-card.tsx", serves: "Q3 A-73 (botón Posponer)", presence: "estado: una tarjeta con trabajo pendiente visible" },
  // El diálogo de Hecho y su segunda confirmación (literales en job-card; emisión en confirm-dialog).
  { id: "hecho-cobrado", by: "present", value: "hecho-cobrado", file: "components/job-card.tsx", serves: "Q3 A-65/D-11 (vía Cobrado del diálogo de Hecho)", presence: "estado: el diálogo «¿Cómo cerrar este corte?» está abierto" },
  { id: "hecho-pendiente", by: "present", value: "hecho-pendiente", file: "components/job-card.tsx", serves: "Q3 A-65/D-12 (vía Pendiente del diálogo de Hecho)", presence: "estado: el diálogo «¿Cómo cerrar este corte?» está abierto" },
  { id: "hecho-abonado", by: "present", value: "hecho-abonado", file: "components/job-card.tsx", serves: "Q3 A-65/D-13 (vía Abonado del diálogo de Hecho)", presence: "estado: el diálogo «¿Cómo cerrar este corte?» está abierto" },
  { id: "hecho-calculadora", by: "present", value: "hecho-calculadora", file: "components/job-card.tsx", serves: "Q3 A-69/D-24 (MoneyCalc del diálogo de abono; emisión en money-calc)", presence: "estado: el diálogo de abono de Hecho está abierto" },
  { id: "hecho-abono-confirmar", by: "present", value: "hecho-abono-confirmar", file: "components/job-card.tsx", serves: "Q3 A-69 (confirmar el abono de Hecho; emisión en confirm-dialog)", presence: "estado: el diálogo de abono de Hecho está abierto" },
  { id: "hecho-confirmar", by: "present", value: "hecho-confirmar", file: "components/job-card.tsx", serves: "Q3 A-65/D-10 (la segunda confirmación de Hecho; emisión en confirm-dialog)", presence: "estado: la segunda confirmación de Hecho está abierta" },
  // Los cuatro canales de la tarjeta (literales en job-card; emisión en message-composer/confirm-link).
  { id: "tarjeta-mensaje", by: "present", value: "tarjeta-mensaje", file: "components/job-card.tsx", serves: "Q5 I-3 (botón Mensaje, mostaza)", presence: "estado: tarjeta con teléfono marcable visible" },
  { id: "tarjeta-whatsapp", by: "present", value: "tarjeta-whatsapp", file: "components/job-card.tsx", serves: "Q5 I-4 (botón WhatsApp, verde)", presence: "estado: tarjeta con teléfono válido para WhatsApp visible" },
  { id: "tarjeta-llamada", by: "present", value: "tarjeta-llamada", file: "components/job-card.tsx", serves: "Q5 I-5 (botón Llamada, azul)", presence: "estado: tarjeta con teléfono marcable visible" },
  { id: "tarjeta-mapa", by: "present", value: "tarjeta-mapa", file: "components/job-card.tsx", serves: "Q5 I-6/I-14 (botón Mapa, rojo; su presión larga revela la dirección)", presence: "estado: tarjeta con dirección visible" },
  // El alta de cliente (client-form).
  { id: "alta-nombre", by: "present", value: "alta-nombre", file: "components/client-form.tsx", serves: "Q2 B-46 (campo Nombre)", presence: "siempre" },
  { id: "alta-telefono", by: "present", value: "alta-telefono", file: "components/client-form.tsx", serves: "Q2 B-49 (campo Teléfono)", presence: "siempre" },
  { id: "alta-direccion", by: "present", value: "alta-direccion", file: "components/client-form.tsx", serves: "Q2 B-51 (campo Dirección)", presence: "siempre" },
  { id: "alta-precio", by: "present", value: "alta-precio", file: "components/client-form.tsx", serves: "Q2 B-50 (campo Precio por corte)", presence: "siempre" },
  { id: "alta-frecuencia", by: "present", value: "alta-frecuencia", file: "components/client-form.tsx", serves: "Q2 B-55 (selector Frecuencia; emisión en ui/input NativeSelect)", presence: "siempre" },
  { id: "alta-guardar", by: "present", value: "alta-guardar", file: "components/client-form.tsx", serves: "Q2 B-40 (botón de guardar del alta)", presence: "siempre" },
  { id: "alta-confirmar", by: "present", value: "alta-confirmar", file: "routes/nuevo.tsx", serves: "Q2 B-41 (confirmación con resumen del alta; emisión en confirm-dialog)", presence: "estado: la confirmación «¿Añadir este cliente?» está abierta" },
  // La ficha: registrar pagos y extras (clientes.$id).
  { id: "ficha-pagado", by: "present", value: "ficha-pagado", file: "routes/clientes.$id.tsx", serves: "Q4 B-92/D-20 (posición Pagado del segmentado)", presence: "siempre" },
  { id: "ficha-abono", by: "present", value: "ficha-abono", file: "routes/clientes.$id.tsx", serves: "Q4 B-92/D-22 (posición Abono del segmentado)", presence: "estado: el cliente tiene saldo (con saldo 0, Abono se deshabilita)" },
  { id: "ficha-adelanto", by: "present", value: "ficha-adelanto", file: "routes/clientes.$id.tsx", serves: "Q4 B-92/D-23 (posición Adelanto del segmentado)", presence: "siempre" },
  { id: "ficha-extra", by: "present", value: "ficha-extra", file: "routes/clientes.$id.tsx", serves: "Q4 B-103/D-6 (botón Trabajo extra)", presence: "siempre" },
  { id: "extra-titulo", by: "present", value: "extra-titulo", file: "routes/clientes.$id.tsx", serves: "Q4 B-103 (campo «¿Qué hay que hacer?» del extra)", presence: "estado: el formulario de extra está desplegado" },
  { id: "extra-precio", by: "present", value: "extra-precio", file: "routes/clientes.$id.tsx", serves: "Q4 B-103 (campo Precio extra)", presence: "estado: el formulario de extra está desplegado" },
  { id: "extra-guardar", by: "present", value: "extra-guardar", file: "routes/clientes.$id.tsx", serves: "Q4 B-103 (botón Añadir extra)", presence: "estado: el formulario de extra está desplegado" },
  { id: "extra-confirmar", by: "present", value: "extra-confirmar", file: "routes/clientes.$id.tsx", serves: "Q4 B-104 (confirmación del extra; emisión en confirm-dialog)", presence: "estado: la confirmación «¿Añadir extra?» está abierta" },
  // El diálogo de pago (pay-dialog; emisión de la confirmación en confirm-dialog, de la calculadora en money-calc).
  { id: "pago-cantidad", by: "present", value: "pago-cantidad", file: "components/pay-dialog.tsx", serves: "Q4 D-20/D-22 (campo Cantidad del diálogo de pago)", presence: "estado: un diálogo de pago está abierto" },
  { id: "pago-calculadora", by: "present", value: "pago-calculadora", file: "components/pay-dialog.tsx", serves: "Q4 D-24 (MoneyCalc del diálogo de pago)", presence: "estado: un diálogo de pago está abierto" },
  { id: "pago-confirmar", by: "present", value: "pago-confirmar", file: "components/pay-dialog.tsx", serves: "Q4 D-20 (confirmar el pago; emisión en confirm-dialog)", presence: "estado: un diálogo de pago está abierto" },
  // El compositor de mensajes (message-composer).
  { id: "mensaje-compositor", by: "present", value: "mensaje-compositor", file: "components/message-composer.tsx", serves: "Q5 I (la hoja del compositor)", presence: "estado: el compositor está abierto" },
  { id: "mensaje-texto", by: "present", value: "mensaje-texto", file: "components/message-composer.tsx", serves: "Q5 I (el área de texto del mensaje)", presence: "estado: el compositor está abierto" },
  { id: "mensaje-enviar", by: "present", value: "mensaje-enviar", file: "components/message-composer.tsx", serves: "Q5 I (botón Enviar: la puerta de revisión)", presence: "estado: el compositor está abierto con texto" },
  // Las pistas (?) y el Manual (hint / user-manual / manual).
  { id: "pista-boton", by: "present", value: "pista-boton", file: "components/hint.tsx", serves: "Q1/Q6 H (cada botón (?) de la app; un solo sitio emisor)", presence: "siempre" },
  { id: "pista-burbuja", by: "present", value: "pista-burbuja", file: "components/hint.tsx", serves: "Q6 H (la burbuja de la pista)", presence: "estado: una pista (?) está abierta" },
  { id: "manual-abrir", by: "present", value: "manual-abrir", file: "components/user-manual.tsx", serves: "Q6 F (botón Abrir el manual)", presence: "estado: el pliegue del Manual está desplegado" },
  { id: "manual-tema", by: "present", value: "manual-tema", file: "routes/manual.tsx", serves: "Q6 F (cada tema del Manual; familia por tema)", presence: "siempre" },
  { id: "manual-ver-en-app", by: "present", value: "manual-ver-en-app", file: "routes/manual.tsx", serves: "Q6 F/H-19 («Ver en la app»: salta al control y lo rodea de luz)", presence: "estado: un tema con destino en la app está a la vista" },

  /* ================= Ola 2 (AD) · B1 spot — raíces y secciones de la casa ================= */
  { id: "estudio", by: "spot", value: "estudio", file: "routes/estadisticas.tsx", serves: "AD9 ad9-dos-vistas/ad9-informes (la píldora Estudio|Asesor)", presence: "siempre" },
  { id: "asesor", by: "spot", value: "asesor", file: "components/asesor.tsx", serves: "AD9 ad9-ir-asesor/ad9-heroe/ad9-reglas (la tarjeta héroe del Asesor)", presence: "siempre" },
  { id: "asesor-pasos", by: "spot", value: "asesor-pasos", file: "components/asesor.tsx", serves: "AD9 ad9-pasos (la sección de pasos del Asesor)", presence: "siempre" },
  { id: "asesor-grupos", by: "spot", value: "asesor-grupos", file: "components/asesor.tsx", serves: "AD9 ad9-grupos-chequeos (la sección de grupos del Asesor)", presence: "siempre" },
  { id: "asesor-chequeos", by: "spot", value: "asesor-chequeos", file: "components/asesor.tsx", serves: "AD9 ad9-grupos-chequeos (la sección de chequeos del Asesor)", presence: "siempre" },
  { id: "clima", by: "spot", value: "clima", file: "routes/clima.tsx", serves: "AD12 ad12-veredicto/ad12-cierre (el héroe del Clima)", presence: "siempre" },
  { id: "notas", by: "spot", value: "notas", file: "routes/notas.tsx", serves: "AD11 ad11-abrir/ad11-borrador/ad11-semana (la sección del editor del bloc)", presence: "siempre" },
  { id: "fichero", by: "spot", value: "fichero", file: "routes/fichero.tsx", serves: "AD11 ad11-doble-toque/ad11-carpetas/ad11-papelera (la lista de carpetas)", presence: "siempre" },
  { id: "notas-cliente", by: "spot", value: "notas-cliente", file: "routes/clientes.$id.tsx", serves: "AD11 ad11-cliente/ad11-cliente-enlaces/ad11-fijada-hoy (la sección «Notas del cliente» de la ficha)", presence: "siempre" },
  { id: "ficha-cambios", by: "spot", value: "cambios-hechos", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-cambios (el pliegue Cambios hechos de la ficha)", presence: "siempre" },
  { id: "ficha-temporada", by: "spot", value: "temporada-cliente", file: "components/client-form.tsx", serves: "AD6 ad6-cliente-abrir/ad6-cliente-sustituye (el campo Temporada del cliente; emisión familiar Field data-spot={topic})", presence: "siempre" },

  /* ================= Ola 2 (AD) · B3 id — cifras, pliegues y alias ================= */
  // Las dieciséis cifras de Estudio (ids DOM ya existentes; AD9).
  { id: "cif-pulso", by: "id", value: "cif-pulso", file: "components/cifras-insights.tsx", serves: "AD9 ad9-orden/ad9-pulso/ad9-te-deben (pliegue Este mes)", presence: "siempre" },
  { id: "cif-meta", by: "id", value: "cif-meta", file: "components/cifras-insights.tsx", serves: "AD9 ad9-meta (pliegue Meta del mes)", presence: "siempre" },
  { id: "cif-mes", by: "id", value: "cif-mes", file: "components/cifras-insights.tsx", serves: "AD9 ad9-tendencia (pliegue Mes a mes)", presence: "siempre" },
  { id: "cif-fiabilidad", by: "id", value: "cif-fiabilidad", file: "components/cifras-insights.tsx", serves: "AD9 ad9-deuda (pliegue Quién paga y quién no)", presence: "siempre" },
  { id: "cif-calendario", by: "id", value: "cif-calendario", file: "components/cifras-insights.tsx", serves: "AD9 ad9-tendencia (pliegue Calendario de cortes)", presence: "siempre" },
  { id: "cif-mejores", by: "id", value: "cif-mejores", file: "components/cifras-insights.tsx", serves: "AD9 ad9-clientes (pliegue Mejores clientes)", presence: "siempre" },
  { id: "cif-precio", by: "id", value: "cif-precio", file: "components/cifras-insights.tsx", serves: "AD9 ad9-clientes (pliegue Precio medio)", presence: "siempre" },
  { id: "cif-propinas", by: "id", value: "cif-propinas", file: "components/cifras-insights.tsx", serves: "AD9 ad9-resto (pliegue Propinas)", presence: "siempre" },
  { id: "cif-fijo", by: "id", value: "cif-fijo", file: "components/cifras-insights.tsx", serves: "AD9 ad9-fijo-hora (pliegue Lo fijo)", presence: "siempre" },
  { id: "cif-hora", by: "id", value: "cif-hora", file: "components/cifras-insights.tsx", serves: "AD9 ad9-fijo-hora (pliegue Tu hora)", presence: "siempre" },
  { id: "cif-esfuerzo", by: "id", value: "cif-esfuerzo", file: "components/effort-week.tsx", serves: "AD9 ad9-meta (pliegue Esfuerzo de la semana)", presence: "siempre" },
  { id: "cif-semana", by: "id", value: "cif-semana", file: "components/cobros-charts.tsx", serves: "AD9 ad9-tendencia (pliegue Semana a semana)", presence: "siempre" },
  { id: "cif-horas", by: "id", value: "cif-horas", file: "components/cobros-charts.tsx", serves: "AD9 ad9-resto (pliegue Horas)", presence: "siempre" },
  { id: "cif-anio", by: "id", value: "cif-anio", file: "components/cobros-charts.tsx", serves: "AD9 ad9-resto (pliegue El año)", presence: "siempre" },
  { id: "cif-clientes", by: "id", value: "cif-clientes", file: "components/cobros-charts.tsx", serves: "AD9 ad9-clientes (pliegue Clientes)", presence: "siempre" },
  { id: "cif-pospuesto", by: "id", value: "cif-pospuesto", file: "components/cobros-charts.tsx", serves: "AD9 ad9-resto (pliegue Pospuestos)", presence: "siempre" },
  // Los pliegues de Ajustes (el id lo emite Fold/SettingFold; AD14).
  { id: "aj-nombre", by: "id", value: "aj-nombre", file: "routes/ajustes.tsx", serves: "AD14 ad14-nombre (pliegue Tu nombre)", presence: "siempre" },
  { id: "aj-pantalla", by: "id", value: "aj-pantalla", file: "routes/ajustes.tsx", serves: "AD14 ad14-pantalla/ad14-idioma (pliegue Pantalla e idioma)", presence: "siempre" },
  { id: "aj-tableta", by: "id", value: "aj-tableta", file: "routes/ajustes.tsx", serves: "AD14 ad14-tableta (pliegue Tableta y ordenador)", presence: "siempre" },
  { id: "aj-horas", by: "id", value: "aj-horas", file: "routes/ajustes.tsx", serves: "AD14 ad14-horas (pliegue Horas de trabajo)", presence: "siempre" },
  { id: "aj-espera", by: "id", value: "aj-espera", file: "routes/ajustes.tsx", serves: "AD14 ad14-espera/ad14-espera-cadena (pliegue Espera y riesgo)", presence: "siempre" },
  { id: "aj-recordatorios", by: "id", value: "aj-recordatorios", file: "routes/ajustes.tsx", serves: "AD14 ad14-recordatorios (pliegue Recordatorios)", presence: "siempre" },
  { id: "aj-vacaciones", by: "id", value: "aj-vacaciones", file: "routes/ajustes.tsx", serves: "AD14 ad14-vacaciones (pliegue Vacaciones)", presence: "siempre" },
  { id: "aj-exportar", by: "id", value: "aj-exportar", file: "routes/ajustes.tsx", serves: "AD14 ad14-exportar (pliegue Exportar e imprimir)", presence: "siempre" },
  { id: "aj-ejemplo", by: "id", value: "aj-ejemplo", file: "routes/ajustes.tsx", serves: "AD14 ad14-ejemplo · AD15 ad15-muestra (pliegue Datos de ejemplo)", presence: "siempre" },
  { id: "aj-copia", by: "id", value: "aj-copia", file: "routes/ajustes.tsx", serves: "AD14 ad14-copia · AD15 (pliegue Copia de seguridad)", presence: "siempre" },
  { id: "aj-temporada", by: "id", value: "aj-temporada", file: "routes/ajustes.tsx", serves: "AD14 ad14-temporada/ad14-horizonte (pliegue Temporada para todos)", presence: "siempre" },
  { id: "aj-notificaciones", by: "id", value: "aj-notificaciones", file: "routes/ajustes.tsx", serves: "AD14 ad14-notificaciones · AD16 ad16-notif-pliegue (pliegue Notificaciones del teléfono)", presence: "estado: solo dentro de la app Android (el pliegue NotifyFold no se pinta en la web)" },
  { id: "aj-sonidos", by: "id", value: "aj-sonidos", file: "components/settings-finder.tsx", serves: "AD14 ad14-sonidos (pliegue Sonidos)", presence: "siempre" },
  { id: "aj-nube", by: "id", value: "aj-nube", file: "components/sync-status.tsx", serves: "AD14 ad14-nube · AD15 ad15-nube-dentro (pliegue Cuenta y nube)", presence: "siempre" },
  { id: "aj-huella", by: "id", value: "aj-huella", file: "components/fingerprint-control.tsx", serves: "AD14 ad14-huella · AD16 ad16-huella (pliegue Huella)", presence: "siempre" },
  // Alias: el guion nombra la superficie; el DOM ya tenía su id (Wave-1 style: una fila por nombre de escena).
  { id: "ajustes-espera", by: "id", value: "aj-espera", file: "routes/ajustes.tsx", serves: "AD7 ad7-umbrales (el pliegue Espera y riesgo, para los umbrales)", presence: "siempre" },
  { id: "ajustes-temporada", by: "id", value: "aj-temporada", file: "routes/ajustes.tsx", serves: "AD6 ad6-global-abrir (el pliegue Temporada para todos)", presence: "siempre" },
  { id: "ajustes-vacaciones", by: "id", value: "aj-vacaciones", file: "routes/ajustes.tsx", serves: "AD6 ad6-vacaciones-abrir (el pliegue Vacaciones)", presence: "siempre" },
  { id: "cobros-espera", by: "id", value: "cob-espera", file: "routes/cobros.tsx", serves: "AD7 ad7-espera (el pliegue En espera de Cobros)", presence: "siempre" },
  { id: "cobros-perdonado", by: "id", value: "cob-perdonado", file: "routes/cobros.tsx", serves: "AD8 ad8-total-confirmar (el pliegue Perdonado de Cobrado)", presence: "siempre" },
  { id: "cobros-hecho", by: "id", value: "cob-hecho", file: "routes/cobros.tsx", serves: "AD7 ad7-relojes (el nido de Hechos de Cobros)", presence: "siempre" },
  { id: "agenda-dias-libres", by: "id", value: "ag-libres", file: "routes/agenda.tsx", serves: "AD5 ad5-libres (la sección Días libres de Agenda)", presence: "siempre" },

  /* ================= Ola 2 (AD) · B6 present — acuñadas en esta ola ================= */
  // Agenda a fondo (routes/agenda y sus piezas).
  { id: "agenda-periodos", by: "present", value: "agenda-periodos", file: "routes/agenda.tsx", serves: "AD5 ad5-abrir (la fila de periodos: Semana/Mes/Calendario)", presence: "siempre" },
  { id: "agenda-calendario", by: "present", value: "agenda-calendario", file: "routes/agenda.tsx", serves: "AD5 ad5-calendario (el botón Calendario)", presence: "siempre" },
  { id: "agenda-conteo", by: "present", value: "agenda-conteo", file: "routes/agenda.tsx", serves: "AD5 ad5-horizonte (el conteo de la Agenda: hechos, pendientes, días)", presence: "siempre" },
  { id: "agenda-mover-dia", by: "present", value: "agenda-mover-dia", file: "routes/agenda.tsx", serves: "AD5 ad5-mover-dia (el botón Mover de un día; emisión familiar)", presence: "estado: hay un día con pendientes en la vista de Agenda" },
  { id: "agenda-mover-fecha", by: "present", value: "agenda-mover-fecha", file: "routes/agenda.tsx", serves: "AD5 ad5-mover-dia (la fecha destino del diálogo Mover; emisión en ui/input → picker-field)", presence: "estado: el diálogo «Mover todo el día» está abierto" },
  { id: "agenda-reordenar", by: "present", value: "agenda-reordenar", file: "components/reorder-jobs.tsx", serves: "AD5 ad5-reordenar (la lista arrastrable de un día)", presence: "estado: un día en Pendiente con más de un trabajo (la lista arrastrable)" },
  { id: "agenda-acumulado", by: "present", value: "agenda-acumulado", file: "routes/agenda.tsx", serves: "AD5 ad5-acumulado (la caja Trabajo acumulado)", presence: "estado: hay atrasados o pendientes de hoy en Agenda" },
  { id: "agenda-pasar-atrasados", by: "present", value: "agenda-pasar-atrasados", file: "routes/agenda.tsx", serves: "AD5 ad5-acumulado (el botón Pasar atrasados)", presence: "estado: hay atrasados o pendientes de hoy en Agenda" },
  { id: "agenda-informe-dia", by: "present", value: "agenda-informe-dia", file: "routes/agenda.tsx", serves: "AD5 ad5-informe (el informe de un día no trabajado)", presence: "estado: un día no trabajado con informe en la vista" },
  { id: "agenda-dia-libre-chip", by: "present", value: "agenda-dia-libre-chip", file: "routes/agenda.tsx", serves: "AD5 ad5-libres (cada pastilla de día del panel Días libres; emisión familiar)", presence: "estado: el panel Días libres está desplegado" },
  { id: "agenda-casi-nunca", by: "present", value: "agenda-casi-nunca", file: "routes/agenda.tsx", serves: "AD5 ad5-casi-nunca (la fila «Días que casi nunca se trabajan»)", presence: "estado: el panel Días libres está desplegado" },
  { id: "agenda-libre-confirmar", by: "present", value: "agenda-libre-confirmar", file: "routes/agenda.tsx", serves: "AD5 ad5-libres (confirmar el cambio de un día libre; emisión en confirm-dialog)", presence: "estado: el diálogo «¿Cambiar este día?» está abierto" },
  { id: "agenda-dia-raro", by: "present", value: "agenda-dia-raro", file: "components/off-day-ask.tsx", serves: "AD5 ad5-domingo (confirmar en el aviso de día raro; emisión en confirm-dialog)", presence: "estado: el aviso de día raro está abierto" },
  { id: "agenda-vacaciones-aviso", by: "present", value: "agenda-vacaciones-aviso", file: "routes/agenda.tsx", serves: "AD6 ad6-vacaciones-aviso (el aviso de vacaciones sobre la Agenda)", presence: "estado: el modo vacaciones está activo" },
  // El asa de la tarjeta y deshacer un pospuesto (job-card).
  { id: "asa-ruta", by: "present", value: "asa-ruta", file: "components/job-card.tsx", serves: "AD13 ad13-asa (el asa que sí arrastra: ordena la ruta)", presence: "estado: una tarjeta arrastrable visible (día con dos o más pendientes)" },
  { id: "asa-quieta", by: "present", value: "asa-quieta", file: "components/job-card.tsx", serves: "AD13 ad13-asa-miente (el asa quieta: la tarjeta no se ordena)", presence: "estado: una tarjeta sin arrastre visible (Fijados o Hechos)" },
  { id: "tarjeta-deshacer-pospuesto", by: "present", value: "tarjeta-deshacer-pospuesto", file: "components/job-card.tsx", serves: "AD5 ad5-deshacer-pospuesto (el botón Deshacer pospuesto de la tarjeta)", presence: "estado: una tarjeta pospuesta visible" },
  // Deshacer/Rehacer (undo-bar; una sola emisión, dos módulos la citan).
  { id: "deshacer-barra", by: "present", value: "deshacer-barra", file: "components/undo-bar.tsx", serves: "AD8 ad8-grupo-deshacer · AD13 ad13-deshacer (el botón Deshacer de la barra)", presence: "estado: hay historial (algo que deshacer o rehacer)" },
  { id: "deshacer-confirmar", by: "present", value: "deshacer-confirmar", file: "components/undo-bar.tsx", serves: "AD8 ad8-grupo-deshacer (confirmar el deshacer; emisión en confirm-dialog)", presence: "estado: la confirmación de deshacer/rehacer está abierta" },
  // Estudio y Asesor: piezas sueltas (estadisticas / cifras-insights / asesor).
  { id: "estudio-buscar", by: "present", value: "estudio-buscar", file: "routes/estadisticas.tsx", serves: "AD9 ad9-dos-vistas (la lupa de Estudio; emisión en app-shell TitleSearch)", presence: "siempre" },
  { id: "estudio-ir-asesor", by: "present", value: "estudio-ir-asesor", file: "routes/estadisticas.tsx", serves: "AD9 ad9-ir-asesor (la posición Asesor de la píldora)", presence: "siempre" },
  { id: "estudio-vista-asesor", by: "present", value: "estudio-vista-asesor", file: "routes/estadisticas.tsx", serves: "AD1 ad1-en-asesor (la píldora Estudio|Asesor entera)", presence: "siempre" },
  { id: "estudio-te-deben", by: "present", value: "estudio-te-deben", file: "components/cifras-insights.tsx", serves: "AD1 ad1-en-estudio (la baldosa «Te deben» de Este mes)", presence: "estado: el bloque Este mes de Estudio está desplegado" },
  { id: "estudio-antiguedad", by: "present", value: "estudio-antiguedad", file: "components/cifras-insights.tsx", serves: "AD7 ad7-cubos (la leyenda de antigüedad de la deuda)", presence: "estado: hay deuda (la leyenda vive en el pliegue de fiabilidad)" },
  { id: "cifras-orden", by: "present", value: "cifras-orden", file: "components/cifras-order-button.tsx", serves: "AD9 ad9-orden (el botón Orden de las cifras)", presence: "siempre" },
  { id: "asesor-heroe", by: "present", value: "asesor-heroe", file: "components/asesor.tsx", serves: "AD1 ad1-en-asesor (la tarjeta héroe del Asesor)", presence: "siempre" },
  // Cobros a fondo (routes/cobros).
  { id: "cobros-abonado", by: "present", value: "cobros-abonado", file: "routes/cobros.tsx", serves: "AD7 ad7-abonado (el total Abonado de la tarjeta Por cobrar)", presence: "siempre" },
  { id: "cobros-orden", by: "present", value: "cobros-orden", file: "routes/cobros.tsx", serves: "AD7 ad7-orden-lista (el selector de orden de Por cobrar; emisión en ui/input NativeSelect)", presence: "estado: la vista Por cobrar está abierta" },
  { id: "cobros-tarjeta", by: "present", value: "cobros-tarjeta", file: "routes/cobros.tsx", serves: "AD7 ad7-orden-cobro (la tarjeta de deudor en tamaño Grande)", presence: "estado: una tarjeta de deudor visible en Por cobrar" },
  { id: "cobros-riesgo", by: "present", value: "cobros-riesgo", file: "routes/cobros.tsx", serves: "AD7 ad7-riesgo (la pastilla «Alto riesgo» de la tarjeta Grande)", presence: "estado: una tarjeta en alto riesgo visible en Por cobrar" },
  { id: "cobros-grupo", by: "present", value: "cobros-grupo", file: "routes/cobros.tsx", serves: "AD7 ad7-orden-cobro · AD8 ad8-grupo-elegir (la casilla de elegir de cada tarjeta; emisión familiar)", presence: "estado: una tarjeta de Por cobrar visible" },
  { id: "cobros-perdonar", by: "present", value: "cobros-perdonar", file: "routes/cobros.tsx", serves: "AD8 ad8-parcial-abrir (el botón Perdonar de la tarjeta)", presence: "estado: una tarjeta de Por cobrar visible" },
  { id: "cobros-perdonar-elegidos", by: "present", value: "cobros-perdonar-elegidos", file: "routes/cobros.tsx", serves: "AD8 ad8-grupo-elegir/ad8-grupo-confirmar (el botón Perdonar elegidos)", presence: "estado: hay elegidos en Por cobrar (la barra de grupo solo se pinta con selección)" },
  { id: "cobros-grupo-confirmar", by: "present", value: "cobros-grupo-confirmar", file: "routes/cobros.tsx", serves: "AD8 ad8-grupo-confirmar (confirmar el perdón en grupo; emisión en confirm-dialog)", presence: "estado: la confirmación de perdón en grupo está abierta" },
  { id: "perdonar-cantidad", by: "present", value: "perdonar-cantidad", file: "routes/cobros.tsx", serves: "AD8 ad8-parcial-monto (el campo Cantidad del diálogo Perdonar)", presence: "estado: el diálogo Perdonar de Cobros está abierto" },
  { id: "perdonar-confirmar", by: "present", value: "perdonar-confirmar", file: "routes/cobros.tsx", serves: "AD8 ad8-parcial-monto (confirmar el perdón; emisión en confirm-dialog)", presence: "estado: el diálogo Perdonar de Cobros está abierto" },
  // El compositor, pieza a pieza (message-composer).
  { id: "compositor-dictar", by: "present", value: "compositor-dictar", file: "components/message-composer.tsx", serves: "AD10 ad10-dictar/ad10-escalera (el botón Dictar del compositor)", presence: "estado: el compositor está abierto" },
  { id: "compositor-ingles", by: "present", value: "compositor-ingles", file: "components/message-composer.tsx", serves: "AD10 ad10-a-ingles/ad10-dictar-ingles (el botón «A inglés»)", presence: "estado: el compositor está abierto" },
  { id: "compositor-corregir", by: "present", value: "compositor-corregir", file: "components/message-composer.tsx", serves: "AD10 ad10-corregir (el botón Corregir junto al texto)", presence: "estado: el compositor está abierto" },
  { id: "compositor-listas", by: "present", value: "compositor-listas", file: "components/message-composer.tsx", serves: "AD10 ad10-listas (la fila «Mensajes listos» del compositor)", presence: "estado: el compositor está abierto" },
  { id: "compositor-nota", by: "present", value: "compositor-nota", file: "components/message-composer.tsx", serves: "AD10 ad10-nota (el botón «Traer una nota»)", presence: "estado: el compositor está abierto" },
  { id: "mensaje-confirmar", by: "present", value: "mensaje-confirmar", file: "components/message-composer.tsx", serves: "AD10 ad10-puerta-envio (confirmar el envío; emisión en confirm-dialog)", presence: "estado: la confirmación de envío está abierta" },
  // Repetidos: escanear, comparar, decidir (dup-compare; deshacer vive en la ficha).
  { id: "dup-escanear", by: "present", value: "dup-escanear", file: "components/dup-compare.tsx", serves: "AD3 ad3-motor/ad3-comparar (la línea de posibles repetidos del libro)", presence: "estado: hay posibles repetidos en el libro" },
  { id: "dup-grupo", by: "present", value: "dup-grupo", file: "components/dup-compare.tsx", serves: "AD3 ad3-comparar (cada grupo de la lista de repetidos; emisión familiar)", presence: "estado: la lista de posibles repetidos está abierta" },
  { id: "dup-comparar", by: "present", value: "dup-comparar", file: "components/dup-compare.tsx", serves: "AD3 ad3-comparar · AD4 ad4-repetido-libro (el diálogo «¿Es el mismo cliente?»)", presence: "estado: el diálogo «¿Es el mismo cliente?» está abierto" },
  { id: "dup-cambiar", by: "present", value: "dup-cambiar", file: "components/dup-compare.tsx", serves: "AD3 ad3-comparar-filas (el botón Cambiar: quién se queda)", presence: "estado: el diálogo de repetidos está abierto en modo edición o escaneo" },
  { id: "dup-usar", by: "present", value: "dup-usar", file: "components/dup-compare.tsx", serves: "AD3 ad3-otras-decisiones · AD4 ad4-repetido-libro (el botón Usar existente)", presence: "estado: el diálogo de repetidos está abierto" },
  { id: "dup-otro", by: "present", value: "dup-otro", file: "components/dup-compare.tsx", serves: "AD3 ad3-otras-decisiones (el botón «Es otro cliente»)", presence: "estado: el diálogo de repetidos está abierto" },
  { id: "dup-unir", by: "present", value: "dup-unir", file: "components/dup-compare.tsx", serves: "AD3 ad3-unir (el botón Unir)", presence: "estado: el diálogo de repetidos está abierto" },
  { id: "dup-deshacer", by: "present", value: "dup-deshacer", file: "routes/clientes.$id.tsx", serves: "AD3 ad3-deshacer (el botón Deshacer unión en Cambios hechos)", presence: "estado: el pliegue Cambios hechos está desplegado con una unión por deshacer" },
  // La ficha del cliente a fondo (clientes.$id; pausa y seguir en sus piezas).
  { id: "ficha-tarjeta", by: "present", value: "ficha-tarjeta", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-tarjeta/ad2-una-vez (la tarjeta principal de la ficha)", presence: "siempre" },
  { id: "ficha-fiabilidad", by: "present", value: "ficha-fiabilidad", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-tarjeta (la sección Fiabilidad de la ficha)", presence: "siempre" },
  { id: "ficha-editar", by: "present", value: "ficha-editar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-editar (el botón Editar ficha)", presence: "siempre" },
  { id: "ficha-riesgo", by: "present", value: "ficha-riesgo", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-serio (el aviso Alto riesgo de la ficha)", presence: "estado: el cliente está en alto riesgo" },
  { id: "ficha-seguir", by: "present", value: "ficha-seguir", file: "components/keep-serving.tsx", serves: "AD2 ad2-serio (el botón Seguir atendiendo)", presence: "estado: el cliente está en alto riesgo" },
  { id: "ficha-lista-negra", by: "present", value: "ficha-lista-negra", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-lista-negra (el botón Pasar/Quitar de lista negra)", presence: "siempre" },
  { id: "ficha-borrar", by: "present", value: "ficha-borrar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-borrar (el botón Eliminar para siempre)", presence: "siempre" },
  { id: "ficha-borrar-confirmar", by: "present", value: "ficha-borrar-confirmar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-borrar (confirmar el borrado; emisión en confirm-dialog)", presence: "estado: el diálogo de borrado está abierto" },
  { id: "ficha-perdonar", by: "present", value: "ficha-perdonar", file: "routes/clientes.$id.tsx", serves: "AD8 ad8-total-abrir/ad8-unavez (el botón Perdonar de la ficha)", presence: "estado: el cliente tiene saldo (sin saldo, Perdonar se deshabilita)" },
  { id: "ficha-perdonar-cantidad", by: "present", value: "ficha-perdonar-cantidad", file: "routes/clientes.$id.tsx", serves: "AD8 ad8-total-abrir (el campo Cantidad del diálogo Perdonar)", presence: "estado: el diálogo Perdonar de la ficha está abierto" },
  { id: "ficha-perdonar-confirmar", by: "present", value: "ficha-perdonar-confirmar", file: "routes/clientes.$id.tsx", serves: "AD8 ad8-total-confirmar (confirmar el perdón; emisión en confirm-dialog)", presence: "estado: el diálogo Perdonar de la ficha está abierto" },
  { id: "ficha-pista", by: "present", value: "ficha-pista", file: "components/client-form.tsx", serves: "AD2 ad2-pista (el campo Pista: cómo le gusta que le avisen)", presence: "siempre" },
  { id: "ficha-pausa", by: "present", value: "ficha-pausa", file: "components/service-pause.tsx", serves: "AD2 ad2-pausa-tuya/ad2-tres-mecanismos (el botón Pausa)", presence: "estado: el cliente no está en pausa" },
  { id: "ficha-continuar", by: "present", value: "ficha-continuar", file: "components/service-pause.tsx", serves: "AD2 ad2-pausa (el botón Continuar cuando el cliente está en pausa)", presence: "estado: el cliente está en pausa" },
  { id: "historial-precio", by: "present", value: "historial-precio", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-historial (el precio de un trabajo del Historial; emisión familiar)", presence: "estado: el Historial está desplegado con trabajos hechos" },
  { id: "ficha-foto-corte", by: "present", value: "ficha-foto-corte", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-foto-corte (el botón Ver foto de un corte; emisión familiar)", presence: "estado: un corte con foto en el Historial desplegado" },
  // Salir de un cliente: archivar, reactivar y borrar (AD2 capítulo «salir»; la tarjeta deslizable vive en swipe-row).
  { id: "tarjeta-cliente", by: "present", value: "tarjeta-cliente", file: "components/swipe-row.tsx", serves: "AD2 ad2-salir-puerta/ad2-salir-borrar (la raíz deslizable de la tarjeta de cliente; emisión familiar — se resuelve la primera de la lista)", presence: "estado: hay clientes en la lista" },
  { id: "lista-baja", by: "present", value: "lista-baja", file: "routes/clientes.index.tsx", serves: "AD2 ad2-salir-puerta/ad2-salir-archivar (el botón Baja revelado al deslizar)", presence: "estado: una tarjeta deslizada a la izquierda (sus acciones reveladas)" },
  { id: "lista-borrar", by: "present", value: "lista-borrar", file: "routes/clientes.index.tsx", serves: "AD2 ad2-salir-puerta/ad2-salir-borrar (el botón Borrar revelado al deslizar)", presence: "estado: una tarjeta deslizada a la izquierda (sus acciones reveladas)" },
  { id: "baja-confirmar", by: "present", value: "baja-confirmar", file: "routes/clientes.index.tsx", serves: "AD2 ad2-salir-archivar (confirmar «Mover a archivos» de la lista; emisión en confirm-dialog)", presence: "estado: el diálogo «¿Pasar a archivos a…?» de la lista está abierto" },
  { id: "clientes-archivos", by: "present", value: "clientes-archivos", file: "routes/clientes.index.tsx", serves: "AD2 ad2-salir-archivos (el rectángulo Archivos del inventario, que abre la vista de archivos)", presence: "siempre" },
  { id: "ficha-archivar", by: "present", value: "ficha-archivar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-salir-reactivar (el botón «Mover a archivos» de la ficha; el mismo botón emite ficha-reactivar al estar archivado)", presence: "estado: el cliente está activo (el botón dice «Mover a archivos»)" },
  { id: "ficha-reactivar", by: "present", value: "ficha-reactivar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-salir-reactivar (el botón Reactivar de la ficha de un archivado)", presence: "estado: el cliente está archivado (el botón dice «Reactivar»)" },
  { id: "reactivar-confirmar", by: "present", value: "reactivar-confirmar", file: "routes/clientes.$id.tsx", serves: "AD2 ad2-salir-reactivar (confirmar «Sí, reactivar» de la ficha; emisión en confirm-dialog)", presence: "estado: el diálogo «¿Reactivar a…?» de la ficha está abierto" },
  { id: "borrar-confirmar", by: "present", value: "borrar-confirmar", file: "routes/clientes.index.tsx", serves: "AD2 ad2-salir-borrar/ad2-salir-borrar-hecho (confirmar el borrado con desglose de la lista; emisión en confirm-dialog)", presence: "estado: el diálogo de borrado de la lista está abierto" },
  // Alta en tanda: la hoja y la revisión (routes/nuevo; la puerta está en client-form).
  { id: "bache-contactos", by: "present", value: "bache-contactos", file: "components/client-form.tsx", serves: "AD4 ad4-puertas (el botón «Del teléfono» del alta)", presence: "siempre" },
  { id: "bache-varios", by: "present", value: "bache-varios", file: "routes/nuevo.tsx", serves: "AD4 ad4-puertas/ad4-escribir (la hoja «Añadir varios»)", presence: "estado: la hoja «Añadir varios» está abierta" },
  { id: "bache-nombres", by: "present", value: "bache-nombres", file: "routes/nuevo.tsx", serves: "AD4 ad4-escribir (el área de nombres, uno por línea)", presence: "estado: la hoja «Añadir varios» está abierta" },
  { id: "bache-continuar", by: "present", value: "bache-continuar", file: "routes/nuevo.tsx", serves: "AD4 ad4-escribir (el botón Continuar de la hoja)", presence: "estado: la hoja «Añadir varios» está abierta" },
  { id: "bache-revisar", by: "present", value: "bache-revisar", file: "routes/nuevo.tsx", serves: "AD4 ad4-revisar (el diálogo «Revisar clientes»)", presence: "estado: la hoja «Revisar clientes» está abierta" },
  { id: "bache-deuda", by: "present", value: "bache-deuda", file: "routes/nuevo.tsx", serves: "AD4 ad4-deuda (el bloque Deuda de antes)", presence: "estado: la hoja «Revisar clientes» está abierta" },
  { id: "bache-copiar", by: "present", value: "bache-copiar", file: "routes/nuevo.tsx", serves: "AD4 ad4-copiar (el botón «Copiar a todos»)", presence: "estado: la hoja «Revisar clientes» está abierta con más de un cliente" },
  { id: "bache-ya-debe", by: "present", value: "bache-ya-debe", file: "routes/nuevo.tsx", serves: "AD4 ad4-deuda (el interruptor «Ya debe» de una fila; emisión familiar)", presence: "estado: la hoja «Revisar clientes» está abierta" },
  { id: "bache-monto", by: "present", value: "bache-monto", file: "routes/nuevo.tsx", serves: "AD4 ad4-deuda (el campo de deuda de una fila marcada; emisión en ui/input)", presence: "estado: la fila está marcada «Ya debe» en Revisar clientes" },
  { id: "bache-mismo-dia", by: "present", value: "bache-mismo-dia", file: "routes/nuevo.tsx", serves: "AD4 ad4-copiar (la fila «Paga el mismo día»)", presence: "estado: la hoja «Revisar clientes» está abierta" },
  { id: "bache-repetido-lista", by: "present", value: "bache-repetido-lista", file: "routes/nuevo.tsx", serves: "AD4 ad4-repetido-dentro (el aviso «Repetido en esta lista»)", presence: "estado: una fila repetida dentro de la tanda en Revisar clientes" },
  { id: "bache-quitar", by: "present", value: "bache-quitar", file: "routes/nuevo.tsx", serves: "AD4 ad4-repetido-dentro (el botón Quitar de un repetido)", presence: "estado: una fila repetida dentro de la tanda en Revisar clientes" },
  { id: "bache-repetido-libro", by: "present", value: "bache-repetido-libro", file: "routes/nuevo.tsx", serves: "AD4 ad4-repetido-libro (el aviso «Se parece a…» en el libro)", presence: "estado: una fila con parecido en el libro en Revisar clientes" },
  { id: "bache-guardar", by: "present", value: "bache-guardar", file: "routes/nuevo.tsx", serves: "AD4 ad4-deuda-puerta/ad4-guardar (el botón Guardar de la revisión)", presence: "estado: la hoja «Revisar clientes» está abierta" },
  // El Clima a fondo (routes/clima; la pastilla vive en weather-chip).
  { id: "clima-lugar", by: "present", value: "clima-lugar", file: "routes/clima.tsx", serves: "AD12 ad12-lugar (la fila del lugar: Mi ubicación / Código postal)", presence: "siempre" },
  { id: "clima-pastilla", by: "present", value: "clima-pastilla", file: "components/weather-chip.tsx", serves: "AD12 ad12-pastilla/ad12-cielo (la pastilla del clima en el encabezado)", presence: "siempre" },
  { id: "clima-plan", by: "present", value: "clima-plan", file: "routes/clima.tsx", serves: "AD12 ad12-plan (el Plan de hoy)", presence: "estado: hay lectura de clima de hoy" },
  { id: "clima-datos", by: "present", value: "clima-datos", file: "routes/clima.tsx", serves: "AD12 ad12-honestidad (la hora de la lectura: «Datos de las…»)", presence: "estado: hay una lectura de clima guardada" },
  { id: "clima-parar", by: "present", value: "clima-parar", file: "routes/clima.tsx", serves: "AD12 ad12-parar (el botón Parar el día por lluvia)", presence: "siempre" },
  { id: "clima-mensajes", by: "present", value: "clima-mensajes", file: "routes/clima.tsx", serves: "AD10 ad10-lluvia (la sección «Mensajes listos» tras parar el día)", presence: "estado: el día se paró por lluvia y hay mensajes listos" },
  { id: "clima-hechos", by: "present", value: "clima-hechos", file: "routes/clima.tsx", serves: "AD12 ad12-hechos (los hechos del cielo: viento, humedad, sensación)", presence: "siempre" },
  { id: "clima-horas", by: "present", value: "clima-horas", file: "routes/clima.tsx", serves: "AD12 ad12-horas (la sección Próximas horas)", presence: "estado: hay próximas horas en la lectura" },
  { id: "clima-radar", by: "present", value: "clima-radar", file: "routes/clima.tsx", serves: "AD12 ad12-radar (la sección Radar)", presence: "siempre" },
  { id: "clima-manana", by: "present", value: "clima-manana", file: "routes/clima.tsx", serves: "AD12 ad12-manana (la tarjeta de mañana)", presence: "estado: hay datos de mañana" },
  // El bloc de notas (routes/notas; el texto vive en rich-notes).
  { id: "nota-texto", by: "present", value: "nota-texto", file: "components/rich-notes.tsx", serves: "AD11 ad11-abrir/ad11-formato (el área de texto del bloc)", presence: "estado: el editor del bloc está abierto" },
  { id: "nota-guardar", by: "present", value: "nota-guardar", file: "routes/notas.tsx", serves: "AD11 ad11-guardar (el botón Guardar de la nota)", presence: "siempre" },
  { id: "nota-fijar", by: "present", value: "nota-fijar", file: "routes/notas.tsx", serves: "AD11 ad11-fijadas (el pin de la nota en el editor)", presence: "siempre" },
  { id: "nota-buscar", by: "present", value: "nota-buscar", file: "routes/notas.tsx", serves: "AD11 ad11-formato (la lupa «Buscar en esta nota»)", presence: "siempre" },
  { id: "nota-mover", by: "present", value: "nota-mover", file: "routes/notas.tsx", serves: "AD11 ad11-fijadas (el botón «Mover a…» del teléfono)", presence: "estado: una nota abierta en el teléfono (sin modo escritorio)" },
  { id: "nota-calculadora", by: "present", value: "nota-calculadora", file: "routes/notas.tsx", serves: "AD11 ad11-calculadora (la calculadora del bloc; emisión en money-calc QuickPad)", presence: "estado: la calculadora del bloc está abierta" },
  { id: "notas-semana", by: "present", value: "notas-semana", file: "routes/notas.tsx", serves: "AD11 ad11-semana (el acordeón de Esta semana)", presence: "siempre" },
  { id: "notas-puerta", by: "present", value: "notas-puerta", file: "components/app-shell.tsx", serves: "AD11 ad11-doble-toque (la puerta Notas del menú: doble toque abre el Fichero)", presence: "siempre" },
  // La ronda de cierre de AD11: nacer, fijar de verdad, la ficha y Hoy.
  { id: "nota-nueva", by: "present", value: "nota-nueva", file: "routes/notas.tsx", serves: "AD11 ad11-crear (el botón flotante «Nota nueva» del Bloc en el teléfono; en el escritorio vive en la lista)", presence: "estado: el Bloc en el teléfono, sin modo escritorio (el botón flotante solo se pinta ahí)" },
  { id: "notas-tira-fijadas", by: "present", value: "notas-tira-fijadas", file: "routes/notas.tsx", serves: "AD11 ad11-fijadas/ad11-desfijar (la tira de fijadas arriba del Bloc)", presence: "estado: hay al menos una nota fijada en el Bloc" },
  { id: "nota-desfijar-confirmar", by: "present", value: "nota-desfijar-confirmar", file: "routes/notas.tsx", serves: "AD11 ad11-desfijar (confirmar «Sí, quitar» al desfijar; emisión en confirm-dialog)", presence: "estado: la confirmación de desfijar está abierta" },
  { id: "nota-guardada-quedarme", by: "present", value: "nota-guardada-quedarme", file: "routes/notas.tsx", serves: "AD11 ad11-guardar (el «Quedarme» del diálogo «Nota guardada»; emisión en confirm-dialog vía presentCancel)", presence: "estado: el diálogo tras guardar una nota está abierto" },
  { id: "hoy-nota-fijada", by: "present", value: "hoy-nota-fijada", file: "routes/index.tsx", serves: "AD11 ad11-fijada-hoy (la sección «Notas fijadas» de Hoy)", presence: "estado: hay notas fijadas que mostrar en Hoy" },
  { id: "ficha-nota-texto", by: "present", value: "ficha-nota-texto", file: "routes/clientes.$id.tsx", serves: "AD11 ad11-cliente (el editor de la nota propia de la ficha; emisión en rich-notes por la prop present)", presence: "siempre" },
  { id: "ficha-nota-enlace", by: "present", value: "ficha-nota-enlace", file: "routes/clientes.$id.tsx", serves: "AD11 ad11-cliente-enlaces/ad11-fijada-hoy (cada página del Bloc enlazada en la ficha; emisión familiar)", presence: "estado: la ficha lista páginas del Bloc enlazadas a este cliente" },
  // La Papelera del Fichero.
  { id: "fichero-papelera", by: "present", value: "fichero-papelera", file: "routes/fichero.tsx", serves: "AD11 ad11-papelera (la sección Papelera de la hoja de carpetas)", presence: "estado: la hoja de ajustes de carpetas está abierta" },
  // Ajustes por dentro (routes/ajustes y sus piezas).
  { id: "ajustes-buscar", by: "present", value: "ajustes-buscar", file: "routes/ajustes.tsx", serves: "AD14 ad14-buscar (la lupa de Ajustes; emisión en app-shell TitleSearch)", presence: "siempre" },
  { id: "ajustes-orden", by: "present", value: "ajustes-orden", file: "components/settings-order-button.tsx", serves: "AD14 ad14-orden (el botón Orden de los ajustes)", presence: "siempre" },
  { id: "ajustes-temporada-interruptor", by: "present", value: "ajustes-temporada-interruptor", file: "routes/ajustes.tsx", serves: "AD6 ad6-global-ritmo (el interruptor «Usar temporada»)", presence: "estado: el pliegue Temporada para todos está desplegado" },
  { id: "ajustes-temporada-fechas", by: "present", value: "ajustes-temporada-fechas", file: "routes/ajustes.tsx", serves: "AD6 ad6-global-fechas (la fila «Empieza» de la temporada)", presence: "estado: el pliegue Temporada está desplegado y la temporada está activada" },
  { id: "ajustes-temporada-ritmo", by: "present", value: "ajustes-temporada-ritmo", file: "routes/ajustes.tsx", serves: "AD6 ad6-global-ritmo (la fila «Cada cuántos días»)", presence: "estado: el pliegue Temporada está desplegado y la temporada está activada" },
  { id: "ajustes-vacaciones-activar", by: "present", value: "ajustes-vacaciones-activar", file: "routes/ajustes.tsx", serves: "AD6 ad6-vacaciones-activar (el botón Activar/Actualizar vacaciones)", presence: "estado: el pliegue Vacaciones está desplegado" },
  { id: "ajustes-vacaciones-quitar", by: "present", value: "ajustes-vacaciones-quitar", file: "routes/ajustes.tsx", serves: "AD6 ad6-vacaciones-quitar (el botón Quitar vacaciones)", presence: "estado: el pliegue Vacaciones está desplegado y hay vacaciones activas" },
  { id: "aj-rapidos", by: "present", value: "aj-rapidos", file: "components/user-manual.tsx", serves: "AD14 ad14-rapidos (la fila Ajustes rápidos del Manual)", presence: "estado: el pliegue del Manual está desplegado" },
  { id: "aj-salir", by: "present", value: "aj-salir", file: "routes/ajustes.tsx", serves: "AD14 ad14-salir (la sección de salir de la cuenta)", presence: "siempre" },
  { id: "aj-version", by: "present", value: "aj-version", file: "routes/ajustes.tsx", serves: "AD14 ad14-version (el pie de versión al fondo de Ajustes)", presence: "siempre" },
  // Copias de seguridad (routes/ajustes; quitar el ejemplo vive en sample-data).
  { id: "copia-guardar", by: "present", value: "copia-guardar", file: "routes/ajustes.tsx", serves: "AD15 ad15-guardar (el botón «Guardar copia ahora»)", presence: "estado: el pliegue Copia de seguridad está desplegado" },
  { id: "copia-archivo", by: "present", value: "copia-archivo", file: "routes/ajustes.tsx", serves: "AD15 ad15-archivo (el botón Restaurar archivo)", presence: "estado: el pliegue Copia de seguridad está desplegado" },
  { id: "copia-restaurar", by: "present", value: "copia-restaurar", file: "routes/ajustes.tsx", serves: "AD15 ad15-lista/ad15-restaurar (el botón Restaurar de cada copia; emisión familiar)", presence: "estado: hay copias guardadas y el pliegue Copia está desplegado" },
  { id: "ejemplo-quitar", by: "present", value: "ejemplo-quitar", file: "components/sample-data.tsx", serves: "AD15 ad15-muestra-quitar (el botón Quitar ejemplo)", presence: "estado: el ejemplo está cargado (sin cargar, el botón se deshabilita) y el pliegue Datos de ejemplo está desplegado" },
  // El teatro de ventanas (widget-theatre; ya emitido por el constructor del teatro).
  { id: "teatro-hoy-cobrar", by: "present", value: "teatro-hoy-cobrar", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-hoy-cobrar/ad16-config (el botón Cobrar de la pieza Hoy)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  { id: "teatro-hoy-cuerpo", by: "present", value: "teatro-hoy-cuerpo", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-teatro-hoy/ad16-hoy-cuerpo (el cuerpo de la pieza Hoy)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  { id: "teatro-semana-tira", by: "present", value: "teatro-semana-tira", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-semana/ad16-semana-tira (la tira de la semana)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  { id: "teatro-panel-dia", by: "present", value: "teatro-panel-dia", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-panel/ad16-panel-dia (el panel del día)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  { id: "teatro-panel-semana", by: "present", value: "teatro-panel-semana", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-panel-semana (el panel de la semana)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  { id: "teatro-panel-cobrar", by: "present", value: "teatro-panel-cobrar", file: "components/presentation/widget-theatre.tsx", serves: "AD16 ad16-panel-cobrar (el botón Cobrar del panel)", presence: "estado: el teatro de ventanas está abierto en esa pieza" },
  // La vista de tableta (app-shell: el literal vive en PhoneViewButton; el menú de la barra usa la constante VISTA_MENU_PRESENT).
  { id: "vista-menu", by: "present", value: "vista-menu", file: "components/app-shell.tsx", serves: "AD13 ad13-vista-menu/ad13-partida (el botón Vista: pantallas y ventana flotante)", presence: "estado: el modo tableta está activo" },
];
