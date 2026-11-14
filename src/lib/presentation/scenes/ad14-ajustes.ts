/**
 * AD14 · Ajustes, tarjeta a tarjeta — las 17 superficies del censo F,
 * contadas desde el censo y el orden de la casa (ajustes-order), no de
 * memoria: 16 pliegues — nombre, pantalla (tema+idioma), tableta, horas,
 * sonidos (vive en settings-finder.tsx), espera, recordatorios,
 * notificaciones (solo Android), temporada+horizonte, vacaciones,
 * exportar, ejemplo, copia, manual, nube y huella (estas dos, fuera del
 * archivo principal) — más la sección suelta de Salir, que es la
 * superficie 17. Dentro del pliegue del Manual, los tres «Ajustes
 * rápidos» escondidos (F-59).
 *
 * Capítulos agrupados por familias de pliegues para que una división sea
 * MECÁNICA si la cerca de duración lo pide: AD14a = capítulos base +
 * trabajo; AD14b = capítulos salidas + cuenta (ver el informe de la ola).
 *
 * Cada pliegue se enseña con `show`: este módulo nombra y explica; no
 * cambia ningún ajuste del alumno (ni siquiera en el escenario haría
 * falta tocarlos para saber qué tocan).
 *
 * ANCLAS NUEVAS (el integrador las registra en anchors.ts):
 *  Por id DOM del pliegue (by: "id", el Fold emite el id):
 *  - aj-nombre, aj-pantalla, aj-tableta, aj-horas, aj-espera,
 *    aj-recordatorios, aj-notificaciones, aj-temporada, aj-vacaciones,
 *    aj-exportar, aj-ejemplo, aj-copia — routes/ajustes.tsx
 *  - aj-sonidos — components/settings-finder.tsx
 *  - aj-nube — components/sync-status.tsx
 *  - aj-huella — components/fingerprint-control.tsx
 *  Por present (acuñadas):
 *  - ajustes-buscar — routes/ajustes.tsx (TitleSearch de Ajustes)
 *  - ajustes-orden — components/settings-order-button.tsx
 *  - aj-rapidos — components/user-manual.tsx (los tres Ajustes rápidos)
 *  - aj-salir — routes/ajustes.tsx (la sección SignOutControl)
 *  - aj-version — routes/ajustes.tsx (el pie de versión)
 * Ya registrada: aj-manual (id). aj-notificaciones tiene presencia
 * «estado: solo dentro de la app Android» — fuera de ella la escena se
 * salta con gracia, como manda la ley.
 */
import type { Module } from "../guion.ts";

export const AD14: Module = {
  id: "ad14-ajustes",
  n: 20,
  floor: "advanced",
  title: ["Ajustes, tarjeta a tarjeta", "Settings, card by card"],
  promise: [
    "Podrás configurar Brizna entera a tu manera y saber qué toca cada ajuste.",
    "You will be able to configure all of Brizna your way and know what each setting touches.",
  ],
  ready: true,
  chapters: [
    { id: "base", title: ["La base: nombre, tema y horas", "The base: name, theme, and hours"] },
    { id: "trabajo", title: ["El trabajo: riesgo, avisos y ritmo", "The work: risk, alerts, and pace"] },
    { id: "salidas", title: ["Salidas: exportar, ejemplo y manual", "Outputs: export, sample, and manual"] },
    { id: "cuenta", title: ["La cuenta: nube, huella y salir", "The account: cloud, fingerprint, and exit"] },
  ],
  scenes: [
    {
      id: "ad14-buscar", chapter: "base", anchors: ["ajustes-buscar"],
      keys: [["buscar ajuste", "search settings"], ["ajustes", "settings"]],
      steps: [
        { kind: "stage", build: "ruta-ajustes" },
        { kind: "go", screen: "/ajustes" },
        { kind: "show", anchor: "ajustes-buscar", caption: ["Buscar ajuste filtra los pliegues por palabras clave.", "Search settings filters the folds by keywords."], contexto: ["«Desplegar todo» abre todos a la vez; en pantalla grande nacen abiertos.", "“Expand all” opens them all; on big screens they start open."] },
      ],
    },
    {
      id: "ad14-ayuda", chapter: "base", anchors: ["pista-boton"],
      keys: [["pista", "hint"], ["manual", "manual"]],
      steps: [
        { kind: "show", anchor: "pista-boton", caption: ["Cada pliegue lleva su (?) con su tema exacto del Manual.", "Each fold carries its (?) with its exact Manual topic."] },
      ],
    },
    {
      id: "ad14-orden", chapter: "base", anchors: ["ajustes-orden"],
      keys: [["orden", "order"], ["ajustes", "settings"]],
      steps: [
        { kind: "show", anchor: "ajustes-orden", caption: ["El orden de los pliegues se cambia y vive en este aparato.", "The folds' order can change and lives on this device."], contexto: ["Cubre once pliegues; sonidos, nube y huella quedan fuera del orden.", "It covers eleven folds; sounds, cloud, and fingerprint stay out."] },
      ],
    },
    {
      id: "ad14-nombre", chapter: "base", anchors: ["aj-nombre"],
      keys: [["nombre del negocio", "business name"], ["nombre", "name"]],
      steps: [
        { kind: "show", anchor: "aj-nombre", caption: ["Nombre del negocio: vacío vuelve al nombre de fábrica.", "Business name: leaving it empty restores the factory name."], contexto: ["El nombre también se toca arriba, en cualquier pantalla.", "The name is also tappable at the top, on any screen."] },
      ],
    },
    {
      id: "ad14-pantalla", chapter: "base", anchors: ["aj-pantalla"],
      keys: [["tema", "theme"], ["tema de día", "day theme"], ["noche", "night"]],
      steps: [
        { kind: "show", anchor: "aj-pantalla", caption: ["Tema: Día, Noche o Automático, con paletas para cada modo.", "Theme: Day, Night, or Automatic, with palettes for each."], contexto: ["Automático: día desde las seis y media; noche, seis y media.", "Automatic: day from six-thirty; night at six-thirty."] },
        { kind: "show", anchor: "aj-pantalla", caption: ["Ocho paletas de día y seis de noche; AMOLED manda de noche.", "Eight day palettes and six night ones; AMOLED leads at night."] },
      ],
    },
    {
      id: "ad14-idioma", chapter: "base", anchors: ["aj-pantalla"],
      keys: [["idioma", "language"], ["español", "spanish"], ["english", "english"]],
      steps: [
        { kind: "show", anchor: "aj-pantalla", caption: ["Idioma: Español o English, aplicado al instante.", "Language: Español or English, applied instantly."], contexto: ["Español es el defecto; la puerta de entrada tiene su propio selector.", "Spanish is the default; the sign-in door has its own selector."] },
      ],
    },
    {
      id: "ad14-tableta", chapter: "base", anchors: ["aj-tableta"],
      keys: [["tableta", "tablet"], ["vista", "view"]],
      steps: [
        { kind: "show", anchor: "aj-tableta", caption: ["Modo tableta: interruptor manual sobre la detección automática.", "Tablet mode: a manual switch over automatic detection."], contexto: ["Nace encendido; de aquí salen la partida y la flotante.", "It starts on; the split and the floater come from here."] },
      ],
      verify: "Censo F V-2: el texto del pliegue habla de 2, 3 o 4 ventanas; el código declara 1 o 2. La escena no afirma el número.",
    },
    {
      id: "ad14-horas", chapter: "base", anchors: ["aj-horas"],
      keys: [["horas de trabajo", "work hours"], ["horas", "hours"]],
      steps: [
        { kind: "show", anchor: "aj-horas", caption: ["Horas de trabajo: entrada y salida de tu jornada.", "Work hours: when your workday starts and ends."], contexto: ["Alimentan la pregunta por ayer y tu precio por hora.", "They feed the yesterday question and your hourly rate."] },
      ],
    },
    {
      id: "ad14-sonidos", chapter: "base", anchors: ["aj-sonidos"],
      keys: [["sonidos", "sounds"], ["ding", "ding"]],
      steps: [
        { kind: "show", anchor: "aj-sonidos", caption: ["Sonidos: un ding suave cuando el día queda completo.", "Sounds: a soft ding when the day is complete."], contexto: ["Este pliegue vive en otro archivo: quien busca aquí, lo pierde.", "This fold lives in another file: searching only here misses it."] },
        { kind: "show", anchor: "aj-sonidos", caption: ["Volumen a tu gusto y «Probar ding» para oírlo antes.", "Volume your way, and “Test ding” to hear it first."] },
      ],
    },
    {
      id: "ad14-espera", chapter: "trabajo", anchors: ["aj-espera"],
      keys: [["espera", "waiting"], ["alto riesgo", "high risk"], ["límites", "limits"]],
      steps: [
        { kind: "show", anchor: "aj-espera", caption: ["Espera y riesgo: cuatro umbrales con sus defectos honestos.", "Waiting and risk: four thresholds with honest defaults."], contexto: ["En espera, 45 días; riesgo: 21 días, $200 o 3 cortes.", "Waiting, 45 days; risk: 21 days, $200, or 3 cuts."] },
      ],
    },
    {
      id: "ad14-espera-cadena", chapter: "trabajo", anchors: ["aj-espera"],
      keys: [["límites", "limits"], ["visitas", "visits"]],
      steps: [
        { kind: "show", anchor: "aj-espera", caption: ["Cambiar un umbral reclasifica a cada cliente en el acto.", "Changing a threshold reclassifies every client at once."], contexto: ["Y un caso en riesgo deja de recibir visitas nuevas.", "And a high-risk case stops receiving new visits."] },
      ],
    },
    {
      id: "ad14-recordatorios", chapter: "trabajo", anchors: ["aj-recordatorios"],
      keys: [["recordatorios", "reminders"], ["avisos", "alerts"]],
      steps: [
        { kind: "show", anchor: "aj-recordatorios", caption: ["Recordatorios: avisos dentro de la app al abrirla.", "Reminders: alerts inside the app when you open it."], contexto: ["Confirman el día anterior y avisan antes de la llegada.", "They confirm yesterday and warn before arrival time."] },
      ],
    },
    {
      id: "ad14-recordatorios-tiempos", chapter: "trabajo", anchors: ["aj-recordatorios"],
      keys: [["recordatorios", "reminders"], ["llegada", "arrival"]],
      steps: [
        { kind: "show", anchor: "aj-recordatorios", caption: ["Avisar antes de llegar: quince, treinta, una hora o dos.", "Warn before arrival: fifteen, thirty, one hour, or two."], contexto: ["Una hora es el defecto; confirmar ayer nace encendido.", "One hour is the default; confirming yesterday starts on."] },
      ],
    },
    {
      id: "ad14-notificaciones", chapter: "trabajo", anchors: ["aj-notificaciones"],
      keys: [["notificaciones", "notifications"], ["avisos", "alerts"]],
      steps: [
        { kind: "show", anchor: "aj-notificaciones", caption: ["Notificaciones: el pliegue de avisos que solo existe en Android.", "Notifications: the alerts fold that only exists on Android."], contexto: ["Su lección entera vive en «Fuera de la app», sin tocar nada.", "Its whole lesson lives in “Outside the app”, touching nothing."] },
      ],
    },
    {
      id: "ad14-temporada", chapter: "trabajo", anchors: ["aj-temporada"],
      keys: [["temporada", "season"], ["ritmo", "pace"]],
      steps: [
        { kind: "show", anchor: "aj-temporada", caption: ["Temporada: un ritmo más lento para todos, cada año.", "Season: a slower pace for everyone, every year."], contexto: ["La temporada de un cliente manda sobre la general.", "A client's own season overrules the general one."] },
      ],
    },
    {
      id: "ad14-horizonte", chapter: "trabajo", anchors: ["aj-temporada"],
      keys: [["horizonte", "horizon"], ["temporada", "season"], ["agenda", "schedule"]],
      steps: [
        { kind: "show", anchor: "aj-temporada", caption: ["El horizonte vive aquí dentro: hasta dónde llega la Agenda.", "The horizon lives in here: how far the Schedule reaches."], contexto: ["Guardar regenera la Agenda; lo movido a mano se queda.", "Saving regenerates the Schedule; hand-moved yards stay put."] },
      ],
    },
    {
      id: "ad14-vacaciones", chapter: "trabajo", anchors: ["aj-vacaciones"],
      keys: [["vacaciones", "vacation"], ["descanso", "time off"]],
      steps: [
        { kind: "show", anchor: "aj-vacaciones", caption: ["Vacaciones: al activarlas, los patios del rango se reacomodan.", "Vacation: activating it rearranges the yards in range."], contexto: ["Quitarlas devuelve la Agenda a su sitio; su lección: Temporadas.", "Removing it puts the Schedule back; its lesson: Seasons."] },
        { kind: "show", anchor: "aj-vacaciones", caption: ["El aviso final cuenta cuántos patios se movieron, y cuántos días.", "The final notice counts how many yards moved, and days."] },
      ],
    },
    {
      id: "ad14-exportar", chapter: "salidas", anchors: ["aj-exportar"],
      keys: [["exportar", "export"], ["imprimir", "print"]],
      steps: [
        { kind: "show", anchor: "aj-exportar", caption: ["Exportar e imprimir: seis atajos abren la hoja ya configurada.", "Export and print: six shortcuts open the sheet already set."], contexto: ["Tu última elección se recuerda en este aparato.", "Your last choice is remembered on this device."] },
        { kind: "show", anchor: "aj-exportar", caption: ["La tarjeta dice tu última vez: preset y periodo usados.", "The card names your last time: preset and period used."] },
      ],
    },
    {
      id: "ad14-ejemplo", chapter: "salidas", anchors: ["aj-ejemplo"],
      keys: [["ejemplo", "sample"], ["datos de ejemplo", "sample data"]],
      steps: [
        { kind: "show", anchor: "aj-ejemplo", caption: ["Datos de ejemplo: la vitrina de catorce clientes ficticios.", "Sample data: the showcase of fourteen fictional clients."], contexto: ["Cargarla y quitarla, sin tocar lo real: lección de Datos.", "Loading or removing it never touches real data: the Data lesson."] },
      ],
    },
    {
      id: "ad14-copia", chapter: "salidas", anchors: ["aj-copia"],
      keys: [["copia de seguridad", "backup"], ["copia", "copy"]],
      steps: [
        { kind: "show", anchor: "aj-copia", caption: ["Copia de seguridad: estado, peso y tus copias guardadas.", "Backup: status, weight, and your saved copies."], contexto: ["Qué viaja y qué nunca viaja: lección entera de Datos.", "What travels and what never does: the whole Data lesson."] },
      ],
    },
    {
      id: "ad14-manual", chapter: "salidas", anchors: ["aj-manual"],
      keys: [["manual", "manual"], ["ayuda", "help"]],
      steps: [
        { kind: "show", anchor: "aj-manual", caption: ["El Manual cuenta sus capítulos y temas desde sus datos.", "The Manual counts its chapters and topics from its data."] },
      ],
    },
    {
      id: "ad14-rapidos", chapter: "salidas", anchors: ["aj-rapidos"],
      keys: [["ajustes rápidos", "quick settings"], ["manual", "manual"]],
      steps: [
        { kind: "ask", anchor: "aj-rapidos", caption: ["¿Tres botones escondidos dentro del Manual? Ajustes rápidos.", "Three hidden buttons inside the Manual? Quick settings."] },
        { kind: "show", anchor: "aj-rapidos", caption: ["Semana normal, Cobro corto, Invierno lento: un toque pisa.", "Normal week, Short billing, Slow winter: one tap overwrites all."], contexto: ["Pisan horas, umbrales o temporada enteros, sin abrir sus pliegues.", "They overwrite whole hours, thresholds, or season, skipping their folds."] },
      ],
    },
    {
      id: "ad14-nube", chapter: "cuenta", anchors: ["aj-nube"],
      keys: [["nube", "cloud"], ["sincronizar", "sync"]],
      steps: [
        { kind: "show", anchor: "aj-nube", caption: ["Nube: el estado de tu copia en palabras, sin adivinar.", "Cloud: your copy's status in words, no guessing."], contexto: ["Sesión terminada no es datos perdidos: «Entrar de nuevo» basta.", "Signed out is not lost data: “Sign in again” is enough."] },
        { kind: "show", anchor: "aj-nube", caption: ["«Sincronizar ahora» fuerza la pasada sin esperar a la siguiente.", "“Sync now” forces the pass without waiting for the next."] },
      ],
    },
    {
      id: "ad14-huella", chapter: "cuenta", anchors: ["aj-huella"],
      keys: [["huella", "fingerprint"], ["huella", "fingerprint"]],
      steps: [
        { kind: "show", anchor: "aj-huella", caption: ["Huella: desbloqueo en este aparato, también sin internet.", "Fingerprint: unlocking on this device, even offline."], contexto: ["Su gracia se elige aquí; su lección entera: Fuera de la app.", "Its grace period is chosen here; its lesson: Outside the app."] },
        { kind: "show", anchor: "aj-huella", caption: ["Al pie del pliegue, la cuenta con la que sincronizas.", "At the fold's foot, the account you sync with."] },
      ],
    },
    {
      id: "ad14-salir", chapter: "cuenta", anchors: ["aj-salir"],
      keys: [["salir", "sign out"], ["cuenta", "account"]],
      steps: [
        { kind: "show", anchor: "aj-salir", caption: ["Salir no es un pliegue: es la sección suelta final.", "Sign out is not a fold: it is the final loose section."], contexto: ["La cuenta y los clientes quedan en nube y aparato.", "The account and clients stay in the cloud and on this device."] },
      ],
    },
    {
      id: "ad14-version", chapter: "cuenta", anchors: ["aj-version"],
      keys: [["versión", "version"], ["ajustes", "settings"]],
      steps: [
        { kind: "show", anchor: "aj-version", caption: ["Al pie, la versión: cualquier captura dice qué Brizna corre.", "At the foot, the version: any screenshot names the build."] },
      ],
    },
  ],
};
