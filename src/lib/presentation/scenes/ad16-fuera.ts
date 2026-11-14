/**
 * AD16 · Fuera de la app — lo que Brizna hace fuera de su ventana
 * (censo G; puesta en escena fallada en OQ-1: teatro + narración).
 *
 * (a) EL TEATRO DE WIDGETS: los pasos { kind: "theatre", piece } — paso
 * nuevo de esta ola, que el integrador añade a guion.ts/conductor con el
 * mismo coste de reloj que un `show` — abren el teatro
 * (components/presentation/widget-theatre.tsx) sobre un escenario de
 * pantalla de inicio, con la foto REAL del libro-escenario. Los toques
 * por zona se enseñan como pasos `show` sobre las zonas del teatro
 * (anclas teatro-*): dentro del teatro, tocar no navega a ningún sitio
 * real — se enseña el destino, no se ejecuta.
 *
 * (b) LAS PUERTAS DEL SHELL son narración + simulación sobre superficies
 * reales de la app, solo con `show`: el pliegue Notificaciones (nunca se
 * toca Permitir/Proteger/Probar — un aviso de prueba es un aviso real),
 * la huella (nunca se registra), la recuperación silenciosa, el candado
 * fantasma y la puerta de rescate (nunca se provoca un fallo, un
 * candado ni un bucle de recargas).
 *
 * ⚠️ OQ-6 / G-11: el dato del Panel trae 4 deudores y el widget pinta 3.
 * NINGÚN pie de este módulo afirma cuántos deudores enseña el Panel; el
 * teatro pinta las 3 filas del layout real. La escena ad16-panel-cobrar
 * lleva la discrepancia en `verify`.
 *
 * ANCLAS NUEVAS (el integrador las registra en anchors.ts):
 *  Del teatro (present; dueño: components/presentation/widget-theatre.tsx;
 *  presencia: el teatro está abierto en esa pieza):
 *  - teatro-hoy-cuerpo, teatro-hoy-cobrar, teatro-semana-tira,
 *    teatro-panel-dia, teatro-panel-semana, teatro-panel-cobrar
 *  De pliegue (id; mismas que AD14): aj-notificaciones
 *  (routes/ajustes.tsx; presencia: solo app Android), aj-huella
 *  (components/fingerprint-control.tsx), aj-recordatorios
 *  (routes/ajustes.tsx).
 * Ya registradas: agenda (spot), pestana-hoy (present), tarjeta-mensaje
 * (present).
 */
import type { Module, Pair, Step } from "../guion.ts";

/** El paso de teatro: cada pieza se ancla en su zona principal (la que las
 * escenas declaran): Hoy → el cuerpo, Semana → la tira, Panel → el día. */
const PIECE_ANCHOR = { hoy: "teatro-hoy-cuerpo", semana: "teatro-semana-tira", panel: "teatro-panel-dia" } as const;
const th = (piece: "hoy" | "semana" | "panel", caption: Pair, contexto?: Pair): Step => ({
  kind: "theatre",
  piece,
  anchor: PIECE_ANCHOR[piece],
  caption,
  ...(contexto ? { contexto } : {}),
});

export const AD16: Module = {
  id: "ad16-fuera",
  n: 22,
  floor: "advanced",
  title: ["Fuera de la app", "Outside the app"],
  promise: [
    "Podrás poner los widgets, recibir los avisos en el día exacto y rescatar la app si un día no abre.",
    "You will be able to place the widgets, receive alerts on the exact day, and rescue the app if one day it will not open.",
  ],
  ready: true,
  chapters: [
    { id: "teatro", title: ["El teatro de widgets", "The widget theatre"] },
    { id: "avisos", title: ["Los avisos del teléfono", "The phone alerts"] },
    { id: "huella", title: ["Huella y voz del shell", "Shell fingerprint and voice"] },
    { id: "rescate", title: ["Cuando la app no abre", "When the app won't open"] },
  ],
  scenes: [
    {
      id: "ad16-teatro-hoy", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["hoy", "today"]],
      steps: [
        { kind: "stage", build: "ruta-widget" },
        { kind: "go", screen: "/" },
        th("hoy", ["Este es Hoy fuera de la app: tu día, sin abrirla.", "This is Today outside the app: your day, unopened."], ["Una sola foto alimenta los tres widgets; Brizna la renueva al vivir.", "One single snapshot feeds all three widgets; Brizna refreshes it."]),
      ],
    },
    {
      id: "ad16-hoy-cuerpo", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["hoy", "today"], ["toque", "tap"]],
      steps: [
        { kind: "show", anchor: "teatro-hoy-cuerpo", caption: ["Tocar el cuerpo del widget abre Brizna en Hoy.", "Tapping the widget's body opens Brizna on Today."], contexto: ["Aquí el toque solo se enseña: el teatro nunca navega.", "Here the tap is only taught: the theatre never navigates."] },
      ],
    },
    {
      id: "ad16-hoy-cobrar", chapter: "teatro", anchors: ["teatro-hoy-cobrar"],
      keys: [["widget", "widget"], ["por cobrar", "to collect"], ["cobros", "payments"]],
      steps: [
        { kind: "show", anchor: "teatro-hoy-cobrar", caption: ["Tocar Por cobrar abre Cobros directamente.", "Tapping To collect opens Payments directly."], contexto: ["El total suma solo activos fuera de lista negra: regla única.", "The total counts only active, non-blacklisted clients: one rule."] },
      ],
    },
    {
      id: "ad16-hoy-estirar", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["estirar", "stretch"], ["tamaño", "size"]],
      steps: [
        th("hoy", ["Estira el widget: otro tamaño se revela solo estirando.", "Stretch the widget: another size reveals itself only by stretching."], ["Mediano: los tres primeros clientes y la línea de alerta.", "Middle: the first three clients and the alert line."]),
      ],
    },
    {
      id: "ad16-hoy-grande", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["grande", "large"]],
      steps: [
        th("hoy", ["El grande lista hasta seis clientes y dice «y más».", "The large one lists up to six clients, then “and more”."]),
      ],
    },
    {
      id: "ad16-semana", chapter: "teatro", anchors: ["teatro-semana-tira"],
      keys: [["widget", "widget"], ["semana", "week"]],
      steps: [
        th("semana", ["Semana: siete días desde hoy, con hoy resaltado.", "Week: seven days from today, with today highlighted."], ["Es el único widget sin Por cobrar: solo mira el ritmo.", "It is the only widget without To collect: rhythm only."]),
      ],
    },
    {
      id: "ad16-semana-tira", chapter: "teatro", anchors: ["teatro-semana-tira"],
      keys: [["semana", "week"], ["agenda", "schedule"], ["tira", "strip"]],
      steps: [
        { kind: "show", anchor: "teatro-semana-tira", caption: ["Tocar la tira abre Agenda; el resto abre Hoy.", "Tapping the strip opens Schedule; the rest opens Today."] },
      ],
    },
    {
      id: "ad16-panel", chapter: "teatro", anchors: ["teatro-panel-dia"],
      keys: [["panel", "panel"], ["widget", "widget"], ["tableta", "tablet"]],
      steps: [
        th("panel", ["El Panel junta día y semana: pensado para tableta grande.", "The Panel joins day and week: made for big tablets."]),
      ],
    },
    {
      id: "ad16-panel-dia", chapter: "teatro", anchors: ["teatro-panel-dia"],
      keys: [["panel", "panel"], ["hoy", "today"]],
      steps: [
        { kind: "show", anchor: "teatro-panel-dia", caption: ["La zona del día abre Hoy, con hasta seis clientes.", "The day zone opens Today, with up to six clients."] },
      ],
    },
    {
      id: "ad16-panel-semana", chapter: "teatro", anchors: ["teatro-panel-semana"],
      keys: [["panel", "panel"], ["semana", "week"], ["agenda", "schedule"]],
      steps: [
        { kind: "show", anchor: "teatro-panel-semana", caption: ["La zona de la semana abre Agenda de un toque.", "The week zone opens Schedule in one tap."] },
      ],
    },
    {
      id: "ad16-panel-cobrar", chapter: "teatro", anchors: ["teatro-panel-cobrar"],
      keys: [["panel", "panel"], ["por cobrar", "to collect"], ["cobros", "payments"]],
      steps: [
        { kind: "show", anchor: "teatro-panel-cobrar", caption: ["Por cobrar abre Cobros; debajo, los mayores saldos y alertas.", "To collect opens Payments; below, the biggest balances and alerts."] },
      ],
      verify: "OQ-6 / censo G-11 y V-4: getNativePlan trae 4 deudores (limit 4) y el widget Panel pinta 3 filas. Ningún pie afirma el número; el teatro pinta las 3 filas del layout real hasta que el canon lo resuelva.",
    },
    {
      id: "ad16-colocar", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["inicio", "home screen"]],
      steps: [
        th("hoy", ["Colocar: mantén pulsado el inicio, Widgets, Brizna.", "To place: hold the home screen, Widgets, Brizna."], ["La app solo nombra a Hoy; Semana y Panel también están ahí.", "The app only names Today; Week and Panel are there too."]),
      ],
    },
    {
      id: "ad16-config", chapter: "teatro", anchors: ["teatro-hoy-cobrar"],
      keys: [["widget", "widget"], ["apariencia", "look"]],
      steps: [
        { kind: "show", anchor: "teatro-hoy-cobrar", caption: ["Al colocar eliges apariencia y si enseña Por cobrar.", "When placing, you choose its look and whether To collect shows."], contexto: ["Cada widget guarda lo suyo; cambiarlo pide recolocar el widget.", "Each widget keeps its own; changing it means replacing it."] },
      ],
    },
    {
      id: "ad16-noche", chapter: "teatro", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["noche", "night"]],
      steps: [
        { kind: "show", anchor: "teatro-hoy-cuerpo", caption: ["La noche del widget manda primero su propia elección.", "The widget's night follows its own choice first."], contexto: ["Sin elección, sigue a la app; luego, al sistema.", "With no choice, it follows the app; then, the system."] },
      ],
      verify: "Censo G V-6: el tick nativo se arma a las 06:31 y 18:31, un minuto tras el cambio de modo (06:30/18:30). El pie no afirma la hora del tick.",
    },
    {
      id: "ad16-frescura", chapter: "teatro", anchors: ["teatro-semana-tira"],
      keys: [["widget", "widget"], ["semana", "week"]],
      steps: [
        { kind: "show", anchor: "teatro-semana-tira", caption: ["El widget es tan fresco como tu última Brizna abierta.", "The widget is as fresh as your last opened Brizna."], contexto: ["A medianoche repinta solo; tras muchos días, pide abrir Brizna.", "At midnight it repaints by itself; after many days, it asks you to open Brizna."] },
      ],
      verify: "Censo G V-18: el envejecimiento del snapshot (8 días pre-renderizados) se deduce del código; no se ha verificado en un aparato con una foto envejecida a propósito.",
    },
    {
      id: "ad16-notif-pliegue", chapter: "avisos", anchors: ["aj-notificaciones"],
      keys: [["notificaciones", "notifications"], ["permitir", "allow"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-notificaciones", caption: ["Notificaciones vive solo en la app Android: tres permisos, Listo.", "Notifications lives only in the Android app: three permissions, Ready."], contexto: ["Hoy solo miramos: Permitir, Proteger y Probar no se tocan.", "Today we only look: Allow, Protect, and Test stay untouched."] },
      ],
    },
    {
      id: "ad16-notif-tipos", chapter: "avisos", anchors: ["aj-notificaciones"],
      keys: [["notificaciones", "notifications"], ["avisos", "alerts"]],
      steps: [
        { kind: "show", anchor: "aj-notificaciones", caption: ["Cuatro avisos: mañana, pagos, riesgo y lluvia.", "Four alerts: tomorrow, payments, risk, and rain."], contexto: ["La hora de la noche se elige; las demás son fijas: 7:30.", "The evening hour is yours; the others are fixed: 7:30."] },
      ],
    },
    {
      id: "ad16-exacta", chapter: "avisos", anchors: ["aj-notificaciones"],
      keys: [["hora exacta", "exact time"], ["alarma", "alarm"]],
      steps: [
        { kind: "show", anchor: "aj-notificaciones", caption: ["Con hora exacta, el aviso cae exacto; sin ella, algo tarde.", "With exact time, the alert lands exact; without, somewhat late."], contexto: ["La fila de hora exacta solo aparece cuando falta.", "The exact-time row only appears when it is missing."] },
      ],
      verify: "Censo G V-10: el permiso de alarma exacta varía por versión de Android y fabricante; no es probable en banco web.",
    },
    {
      id: "ad16-aterriza", chapter: "avisos", anchors: ["agenda"],
      keys: [["agenda", "schedule"], ["aviso", "alert"], ["día", "day"]],
      steps: [
        { kind: "go", screen: "/agenda" },
        { kind: "show", anchor: "agenda", caption: ["El aviso de mañana aterriza en su día exacto de Agenda.", "Tomorrow's alert lands on its exact Schedule day."], contexto: ["Pagos cae en Cobros; lluvia y riesgo, en Hoy.", "Payments lands in Payments; rain and risk, in Today."] },
      ],
    },
    {
      id: "ad16-dos-sistemas", chapter: "avisos", anchors: ["aj-recordatorios"],
      keys: [["recordatorios", "reminders"], ["notificaciones", "notifications"]],
      steps: [
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "aj-recordatorios", caption: ["Dos sistemas, nombres parecidos: Recordatorios avisa con Brizna abierta.", "Two systems, alike names: Reminders alerts with Brizna open."], contexto: ["En Android, ese interruptor te manda a Notificaciones, justo debajo.", "On Android, that switch sends you to Notifications, just below."] },
      ],
    },
    {
      id: "ad16-huella", chapter: "huella", anchors: ["aj-huella"],
      keys: [["huella", "fingerprint"], ["huella", "fingerprint"]],
      steps: [
        { kind: "show", anchor: "aj-huella", caption: ["La huella se pide en este aparato y funciona sin internet.", "The fingerprint is requested on this device and works offline."], contexto: ["Hoy no se registra ninguna: solo miramos dónde vive.", "Today none is enrolled: we only look where it lives."] },
      ],
    },
    {
      id: "ad16-huella-gracia", chapter: "huella", anchors: ["aj-huella"],
      keys: [["huella", "fingerprint"], ["cerrada más de", "away longer than"]],
      steps: [
        { kind: "show", anchor: "aj-huella", caption: ["La gracia decide cuándo vuelve a pedirla: hasta una hora.", "The grace period decides when it asks again: up to one hour."], contexto: ["Compartir, imprimir o descargar nunca cuentan como ausencia.", "Sharing, printing, or downloading never count as absence."] },
      ],
    },
    {
      id: "ad16-dictado", chapter: "huella", anchors: ["tarjeta-mensaje"],
      keys: [["listo", "ready"], ["ajustes", "settings"], ["mensaje", "message"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "tarjeta-mensaje", caption: ["El dictado del shell pregunta primero: listo, preguntar o bloqueado.", "Shell dictation asks first: ready, will ask, or blocked."], contexto: ["Bloqueado solo se reabre en los ajustes del teléfono.", "Blocked reopens only in the phone's settings."] },
      ],
      verify: "Censo G V-16: la escalera de dictado depende del reconocedor de cada teléfono; la escena enseña la puerta de estados, no un peldaño concreto.",
    },
    {
      id: "ad16-silenciosa", chapter: "rescate", anchors: ["pestana-hoy"],
      keys: [["libro", "book"], ["página", "page"]],
      steps: [
        { kind: "go", screen: "/" },
        { kind: "show", anchor: "pestana-hoy", caption: ["Si la página muere, Brizna la reabre sola, en silencio.", "If the page dies, Brizna reopens it by itself, silently."], contexto: ["Tu libro vive en el almacenamiento, no en la página.", "Your book lives in storage, not in the page."] },
      ],
      verify: "Censo G V-2 y V-13 (solo-memoria-verify): la recuperación silenciosa de android-9 no tiene aún veredicto de dedo en aparato real.",
    },
    {
      id: "ad16-freno", chapter: "rescate", anchors: ["pestana-hoy"],
      keys: [["guardados", "saved"], ["espera", "waiting"]],
      steps: [
        { kind: "show", anchor: "pestana-hoy", caption: ["Tres reaperturas en un minuto: Brizna espera y lo dice.", "Three reopenings in a minute: Brizna waits and says so."], contexto: ["La pantalla de espera promete: tus datos están guardados.", "The waiting screen promises: your data is saved."] },
      ],
    },
    {
      id: "ad16-fantasma", chapter: "rescate", anchors: ["pestana-hoy"],
      keys: [["pestaña", "tab"], ["abierta", "open"]],
      steps: [
        { kind: "ask", anchor: "pestana-hoy", caption: ["¿«Ya abierta en otra pestaña» sin tener ninguna? El fantasma.", "“Already open in another tab” with none open? The ghost."] },
        { kind: "show", anchor: "pestana-hoy", caption: ["Brizna espera seis segundos al dueño que se está yendo.", "Brizna waits six seconds for the owner that is leaving."], contexto: ["En el teléfono, tu Chrome no puede sujetar este candado.", "On the phone, your Chrome cannot hold this lock."] },
      ],
      verify: "Censo G V-14 (solo-memoria-verify): la espera de 6 s se probó en Chrome, no dentro del WebView del shell.",
    },
    {
      id: "ad16-db-tarda", chapter: "rescate", anchors: ["pestana-hoy"],
      keys: [["segundos", "seconds"], ["recarga", "reloads"]],
      steps: [
        { kind: "show", anchor: "pestana-hoy", caption: ["Si la base no responde en treinta segundos, pantalla honesta.", "If the database stalls for thirty seconds, an honest screen appears."], contexto: ["Reintentar recarga; un rechazo rápido enseña otra tarjeta.", "Retry reloads; a fast refusal shows another card."] },
      ],
    },
    {
      id: "ad16-rescate", chapter: "rescate", anchors: ["pestana-hoy"],
      keys: [["base vacía", "empty database"], ["no se borra", "not deleted"]],
      steps: [
        { kind: "ask", anchor: "pestana-hoy", caption: ["¿Tres aperturas fallidas? Llega la puerta de rescate.", "Three failed openings? The rescue door arrives."] },
        { kind: "show", anchor: "pestana-hoy", caption: ["Reintentar, o empezar vacío aquí: la dañada se guarda, no se borra.", "Retry, or start empty here: the damaged one is kept."], contexto: ["Tu cuenta y tus copias no se tocan: viven fuera.", "Your account and copies are untouched: they live outside."] },
      ],
      verify: "Censo G V-15: la puerta de rescate existe en código con su banco, pero ningún aparato real ha llegado a los 3 fallos; escena escrita contra código no ejercitado.",
    },
    {
      id: "ad16-cierre", chapter: "rescate", anchors: ["teatro-hoy-cuerpo"],
      keys: [["widget", "widget"], ["fuera", "outside"]],
      steps: [
        th("hoy", ["Fuera, Brizna sigue trabajando: widgets, avisos y rescate.", "Outside, Brizna keeps working: widgets, alerts, and rescue."]),
      ],
    },
  ],
};
