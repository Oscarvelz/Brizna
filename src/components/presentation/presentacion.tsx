/**
 * La Presentación Guiada — el conductor.
 *
 * El conductor representa el guion (guion.ts) sobre el escenario sellado
 * (stage.ts): la app que se ve es la app de verdad, pero su libro es un
 * escenario vacío y efímero que el guion construye y que se descarta entero
 * al salir — el libro real queda byte a byte intacto (ley suprema). Ninguna
 * salida toca el libro real: todas aterrizan por la misma puerta
 * (`bz.pres.stay`), y «Quedarme aquí» disuelve el escenario y deja al usuario
 * en ese mismo lugar de SU app.
 *
 * Porte fiel del conductor de Faro (presentacion.tsx), adaptado a la casa:
 * navegación por rutas TanStack, anclas resueltas por el registro vivo
 * (anchors.ts), siembras de stage-seeds.ts, textos por pares ES/EN vía el
 * i18n de Brizna, y la tarjeta C′ cerrada de PLAN §0.3. La novedad de Brizna
 * es el paso `press`: la presión larga real (la del mapa de la tarjeta,
 * 550ms, censo A-55) se espera de verdad en interactivo y el conductor la
 * mantiene él mismo en automático.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Gauge, Hand, List, Pause, Play, X } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { readTabletEnabled } from "@/lib/tablet-mode";
import { useI18n, useTx } from "@/lib/i18n";
import {
  WORDS_PER_MINUTE, dwellMs, durationLabel, effSpeed, moduleById, pick, playableScenes, stepMs, wordCount,
  type Module, type Scene, type Step,
} from "@/lib/presentation/guion";
import {
  clearLaunch, clearStay, peekLaunch, peekStay, readPresState, setLaunch, setStay, takeLaunch, writePresState,
  type PresState,
} from "@/lib/presentation/state";
import { enterStage, exitStage, stageOn, STAGE_EVENT } from "@/lib/presentation/stage";
import { inAndroidApp } from "@/spa/native";
import { readStoredLocale } from "@/lib/theme";
import { toast } from "sonner";
import { anchorById, resolveAnchor } from "@/lib/presentation/anchors";
import { STAGE_SEEDS, stageCtx } from "@/lib/presentation/stage-seeds";
import { findTopic } from "@/lib/manual/topics";
import { rememberOrigin } from "@/lib/manual/nav";
import { WidgetTheatre } from "./widget-theatre";
import "./presentacion.css";

const SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const;

/** El respiro de la presión mostrada: la presión del conductor dura los
 * `ms` reales del compás MÁS este margen. El temporizador de la app y el
 * oído interactivo se arman durante el propio pointerdown —antes de que el
 * conductor programe su suelta—, así que el margen garantiza que ambos
 * disparen antes de soltar, a cualquier velocidad de reproducción. El
 * requisito del compás no se acorta jamás: la suelta nunca baja de `ms`. */
const PRESS_BREATHE_MS = 150;

/** El aviso de lanzamiento: el conductor lo escucha para pintar la
 * ventana de apertura en el mismo toque, sin esperar al escenario. */
const LAUNCH_EVENT = "bz-pres-launch";

/** 1.6.01 (R2C-6/R2D-2): la entrada al escenario se negó — el guardián de
 * preferencias no pudo tomar su fotografía. El conductor lo escucha para
 * retirar la ventana de apertura como cuando el alumno cancela la entrada. */
const REFUSED_EVENT = "bz-pres-refused";

/** Lanza un módulo: la intención viaja en sessionStorage y el conductor, ya
 * montado en la raíz, entra en el escenario (la app se remonta sobre el libro
 * de escenario vía StageHost). La escena de arranque, si viene, es el
 * PRINCIPIO del capítulo donde iba el alumno — el índice la calcula: las
 * escenas de un capítulo dependen del estado que las anteriores dejan, y el
 * capítulo es la unidad de sentada. */
export function launchPresentation(moduleId: string, sceneId?: string) {
  setLaunch({ moduleId, sceneId });
  window.dispatchEvent(new Event(LAUNCH_EVENT));
  void enterStage().catch((err: unknown) => {
    // 1.6.01 (R2C-6/R2D-2): sin fotografía del guardián no hay escenario —
    // la intención se retira, el conductor cierra la ventana de apertura y
    // el motivo se dice en voz alta. Cualquier otro fallo conserva el
    // comportamiento de siempre.
    if (err instanceof Error && err.name === "GuardRefused") {
      clearLaunch();
      window.dispatchEvent(new Event(REFUSED_EVENT));
      toast.error(
        readStoredLocale() === "en"
          ? "The presentation couldn't start: there was no room for the snapshot that protects your settings. Free up space on this device and try again."
          : "La presentación no pudo empezar: no cupo la foto que protege tus ajustes. Libera espacio en este aparato y prueba otra vez.",
      );
    }
  });
}

/* ================================ StageHost ================================ */

/** El anfitrión del escenario: vive dentro de AppProviders y envuelve el
 * Outlet. Al evento del escenario limpia la caché de React Query entera y
 * remonta sus hijos con una llave nueva, para que ninguna pantalla siga
 * mostrando (ni escribiendo) las filas del otro libro. */
export function StageHost({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    const onSwitch = () => {
      queryClient.clear();
      setMountKey((k) => k + 1);
    };
    window.addEventListener(STAGE_EVENT, onSwitch);
    return () => window.removeEventListener(STAGE_EVENT, onSwitch);
  }, [queryClient]);
  return <Fragment key={mountKey}>{children}</Fragment>;
}

/* ================================= CONDUCTOR ================================= */

type RunState = {
  mod: Module;
  sceneIdx: number;
  stepIdx: number;
  mode: "auto" | "interactive";
  speed: number;
  playing: boolean;
  won: boolean;
  finished: boolean;
  chaptersOpen: boolean;
  speedOpen: boolean;
  /** La ventana de «Quedarme aquí» está abierta: el reloj se detiene y la
   * ventana le dice al alumno que podrá continuar donde quedó (ley de
   * Oscar, 2026-11-14). */
  stayOpen: boolean;
  /** La ventana de confirmación de salida está abierta (la ✕ pregunta
   * antes de disolver nada, Oscar 2026-11-14): el reloj se detiene igual
   * que con la de «Quedarme aquí». */
  exitOpen: boolean;
  skipped: string[];
  /** La pila de retorno de «Anterior»: las posiciones CON PIE que el alumno
   * ya ocupó, en orden. Retroceder es volver a una posición vivida — nunca
   * re-ejecutar la maquinaria (un `stage` re-sembraría el escenario a mitad
   * de módulo) ni caer en una pantalla que el compás no pisó. */
  back: { sceneIdx: number; stepIdx: number }[];
  /** 1.6.24 (Prejuicio R7, R8D-1): el camino que la corrida está
   * repitiendo en silencio para llegar a su escena de arranque —
   * mientras sceneIdx < replayUntil, el motor ejecuta solo la
   * maquinaria de esas escenas (sin pies ni esperas de lectura),
   * para que la escena destino nazca con la pantalla, las
   * superficies y la historia que su guion hereda de las
   * anteriores. */
  replayUntil?: number;
};

/** Las rutas `go` pueden nombrar a cualquier cliente del escenario por su
 * clave en stageCtx (`:aurelio`, `:dup`, …) y la forma `$id` de la ruta de la
 * ficha (alias de :aurelio): se sustituyen antes de navegar. Las siembras
 * guardan los ids con dos convenciones — la clave desnuda (`dup`) y la clave
 * con sufijo (`aurelioId`, la original de la Ola 1) — así que toda clave
 * terminada en «Id» responde también por su tallo (`:lucia` ← `luciaId`). */
function resolveScreen(screen: string): string {
  let out = screen;
  for (const [key, value] of Object.entries(stageCtx)) {
    if (typeof value !== "string" || !value) continue;
    out = out.split(`:${key}`).join(value);
    if (key.endsWith("Id")) out = out.split(`:${key.slice(0, -2)}`).join(value);
  }
  const id = stageCtx.aurelioId;
  if (id) out = out.split("$id").join(id);
  return out;
}

function waitAnchor(anchor: string, timeout = 2200): Promise<HTMLElement | null> {
  // 1.6.18 (Prejuicio R5, R6D-3): si el ancla vive dentro de un pliegue,
  // el conductor lo abre antes de esperar — trece escenas anclaban en
  // cuerpos de pliegues nacidos cerrados que ninguna escena podía
  // abrir, y sus módulos jamás se anotaban como aprendidos.
  const fold = anchorById(anchor)?.fold;
  if (fold) window.dispatchEvent(new CustomEvent("ols-open-fold", { detail: fold }));
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const el = resolveAnchor(anchor) as HTMLElement | null | undefined;
      if (el) return resolve(el);
      if (performance.now() - t0 > timeout) return resolve(null);
      window.setTimeout(tick, 120);
    };
    tick();
  });
}

/** El descendiente interactivo de un ancla: la casa ancla a veces el
 * contenedor, y el toque (o la presión) debe caer en el control de verdad. */
const interactiveTarget = (el: HTMLElement): HTMLElement =>
  el.matches('button, a, [role="button"], input, summary, [tabindex]')
    ? el
    : (el.querySelector<HTMLElement>('button, a, [role="button"], input, summary, [tabindex]') ?? el);

/** El toque del conductor. */
const tapEl = (el: HTMLElement) => {
  // 1.6.18 (Prejuicio R5, R6D-2): el toque automático es un toque de
  // verdad — pointerdown, pointerup y click, como el dedo. Solo con
  // click, los controles que actúan al soltar (la calculadora de la
  // nota) jamás se abrían en Automático y su escena no completaba.
  const t = interactiveTarget(el);
  t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
  t.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
  t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
};

/* LA HUELLA DE UNA DEMOSTRACIÓN (principios 4, 8 y 11): los anclas cuya
 * lección es el control MÁS la región donde su efecto se despliega — las
 * vistas (la lista que se achica y crece) y los filtros de Clientes (la
 * lista que separan). Para ellas la tarjeta se sienta arriba, la ventana
 * clara cubre la huella hasta el fondo de la pantalla y la pantalla misma
 * se desplaza: la huella entera, en color normal, dentro del cuadro. */
const isFootprint = (a?: string): boolean =>
  !!a && (a.startsWith("vistas") || a === "clientes-filtros");

const hasCaption = (
  step: Step,
): step is Extract<Step, { caption: unknown }> =>
  step.kind === "show" || step.kind === "ask" || step.kind === "do" || step.kind === "press" || step.kind === "type" || step.kind === "theatre" || step.kind === "swipe";

export function Presentacion() {
  const { locale } = useI18n();
  const tx = useTx();
  const lang = locale;
  const navigate = useNavigate();
  /* El puente al Manual (Oscar, 2026-11-14): mientras el alumno lee el
   * Manual, el conductor se esconde entero y su reloj se detiene; al
   * volver con Atrás, el mismo compás se rearma donde estaba. */
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inManual = pathname === "/manual";
  const [run, setRun] = useState<RunState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [shaking, setShaking] = useState(0);
  /** LA VENTANA DE APERTURA (Oscar, veredicto telefónico sobre la 1.5.80,
   * 2026-11-14 23:47 EST): el arranque se sentía duro — el toque no
   * recibía respuesta mientras el escenario entraba en silencio. Ahora el
   * toque mismo abre una ventana que explica las dos maneras de aprender
   * (Automático e Interactivo) y los controles de la tarjeta, mientras el
   * escenario se prepara detrás; «Empezar» se enciende cuando el primer
   * compás con pie ya tiene su asiento medido. El estado vive desde la
   * intención de lanzamiento (antes de que exista la corrida) y acompaña
   * a la corrida hasta que el alumno empieza. */
  const [intro, setIntro] = useState<{ mod: Module } | null>(null);
  const introRef = useRef(false);
  introRef.current = !!intro;
  /** El compás con pie que la pre-corrida ya asentó tras la ventana
   * («escena:paso»): con él, «Empezar» se enciende — el asiento está
   * medido o el ancla resultó muerta y el despacho normal la saltará. */
  const [heldAt, setHeldAt] = useState("");
  /** La ventana se canceló mientras el escenario aún entraba: cuando el
   * evento del escenario llegue sin intención viva, el escenario se
   * disuelve solo en vez de quedar abierto sin corrida. */
  const cancelledLaunchRef = useRef(false);
  useEffect(() => {
    const onLaunch = () => {
      const intent = peekLaunch();
      const m = intent ? moduleById(intent.moduleId) : undefined;
      if (m && m.ready) setIntro({ mod: m });
    };
    window.addEventListener(LAUNCH_EVENT, onLaunch);
    return () => window.removeEventListener(LAUNCH_EVENT, onLaunch);
  }, []);
  // 1.6.01 (R2C-6/R2D-2): la entrada negada (sin fotografía del guardián)
  // retira la ventana de apertura como una cancelación durante la entrada:
  // sin intención viva y con la marca puesta, nada queda esperando un
  // escenario que no va a nacer.
  useEffect(() => {
    const onRefused = () => {
      if (runRef.current) return;
      cancelledLaunchRef.current = true;
      clearLaunch();
      setIntro(null);
    };
    window.addEventListener(REFUSED_EVENT, onRefused);
    return () => window.removeEventListener(REFUSED_EVENT, onRefused);
  }, []);
  /** La entrada del módulo en curso: el velo y el hueco nacen apagados y
   * se encienden en 300ms (la clase vive un respiro en la raíz). */
  const [entering, setEntering] = useState(false);
  /** La salida está en su fundido de 200ms: la raíz lleva la clase y las
   * salidas de verdad (índice / quedarme) esperan a que el velo se apague
   * antes de disolver el escenario — salir nunca es un corte. */
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  /** El conductor no remonta con el Outlet (vive junto a los anfitriones):
   * escucha el evento del escenario para repintarse y para recoger la
   * intención de lanzamiento cuando el escenario se enciende. */
  const [stageTick, setStageTick] = useState(0);
  const stagedRef = useRef<Set<string>>(new Set());
  /** Construcciones de escenario ya sembradas en esta sesión (por
   * nombre): la siembra previa del conductor y el paso `stage` comparten
   * este registro para no sembrar dos veces la misma ficción. */
  const sownBuildsRef = useRef<Set<string>>(new Set());
  /** Escenas que ESTA corrida ya produjo (por índice): el camino no
   * re-ejecuta lo vivido — lo producido ya está producido (1.6.27,
   * Prejuicio R8, R9D-5). Nace vacío en cada lanzamiento, como los
   * registros de siembra. */
  const producedRef = useRef<Set<number>>(new Set());
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => {
    const onSwitch = () => setStageTick((t) => t + 1);
    window.addEventListener(STAGE_EVENT, onSwitch);
    return () => window.removeEventListener(STAGE_EVENT, onSwitch);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /* ---- aterrizajes: fuera del escenario, esta instancia solo escucha ---- */
  useEffect(() => {
    if (stageOn()) return;
    const stay = peekStay();
    if (!stay) return;
    // openPres lo recoge el pliegue del índice en Ajustes; aquí no se toca.
    // «Quedarme aquí»: exitStage conserva la ruta, así que la ruta del stay
    // YA es la actual y StageHost ya remontó los datos reales bajo ella —
    // no hay nada que navegar. Si alguna vez difiriera, se navega como red.
    if (!stay.openPres && stay.path && stay.path !== window.location.pathname) {
      void navigate({ to: stay.path as never });
    }
    // La llave se retira tras un respiro, para que quien la espía (el
    // pliegue, en la salida al índice) alcance a leerla.
    const id = window.setTimeout(clearStay, 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageTick]);

  /* ---- arranque dentro del escenario ---- */
  useEffect(() => {
    if (!stageOn() || runRef.current) return;
    const launch = takeLaunch();
    if (!launch) {
      // La ventana de apertura se canceló mientras el escenario entraba:
      // nadie va a correr aquí — el escenario se disuelve solo.
      if (cancelledLaunchRef.current) {
        cancelledLaunchRef.current = false;
        void exitStage();
      }
      return;
    }
    const found = moduleById(launch.moduleId);
    if (!found || !found.ready || !found.scenes.length) return;
    // 1.6.09 (Prejuicio R3, R3D-4): fuera de Android, las escenas marcadas
    // androidOnly no entran en la corrida — su ancla (el pliegue de
    // notificaciones) no existe en la web, se saltaban siempre y el módulo
    // jamás podía marcarse aprendido allí. En Android corren todas.
    // 1.6.11 (R4D-4): el filtro es playableScenes, el mismo que usan el
    // registro de búsqueda y la duración del índice.
    const mod = { ...found, scenes: playableScenes(found, inAndroidApp(), readTabletEnabled()) };
    if (!mod.scenes.length) return;
    const prefs = readPresState();
    const startIdx = launch.sceneId
      ? Math.max(0, mod.scenes.findIndex((s) => s.id === launch.sceneId))
      : 0;
    // 1.6.24 (Prejuicio R7, R8D-1): un arranque a mitad de módulo
    // REPITE EL CAMINO. Las escenas están escritas como capítulos
    // de un viaje: heredan de las anteriores la pantalla, las
    // superficies abiertas y la historia de la sesión, y lanzadas
    // solas morían en su primer ancla (183 de 349 en la caza 7).
    // La corrida nace en la primera escena con replayUntil en la
    // destino: el motor ejecuta solo la maquinaria del camino y
    // la escena destino nace con el estado que su guion hereda.
    // 1.6.27 (Prejuicio R8, R9D-1/R9D-5): corrida nueva, libro
    // nuevo — los registros del conductor viven lo que dura UNA
    // corrida, no la sesión de la app. `enterStage` garantiza un
    // libro vacío en cada entrada, pero la siembra sobrevivía en
    // los refs y la segunda corrida del mismo módulo nacía sin
    // ficción que sembrar: cada ancla moría y el módulo se saltaba
    // entero en silencio. El registro de escenas producidas nace
    // vacío en el mismo acto.
    stagedRef.current.clear();
    sownBuildsRef.current.clear();
    producedRef.current.clear();
    const road = startIdx > 0;
    // El escenario amanece en Hoy, como la app misma — salvo que la primera
    // escena del arranque abra con su propio `go`.
    const firstGo = mod.scenes[road ? 0 : startIdx]?.steps.find((s) => s.kind === "go");
    const startPath =
      firstGo && firstGo.kind === "go" ? resolveScreen(firstGo.screen) : "/";
    void navigate({ to: startPath as never });
    later(() => {
      setRun({
        mod, sceneIdx: road ? 0 : startIdx, stepIdx: 0, replayUntil: road ? startIdx : undefined,
        mode: prefs.mode, speed: prefs.speed,
        playing: true, won: false, finished: false, chaptersOpen: false, speedOpen: false, stayOpen: false, exitOpen: false, skipped: [], back: [],
      });
      // El módulo queda marcado como el último en uso desde el arranque:
      // si el alumno sale sin terminarlo (o la app muere), su ficha abrirá
      // el índice para continuar donde iba.
      const p2: PresState = readPresState();
      p2.modules[mod.id] = { scene: startIdx, done: false };
      p2.lastPlayed = mod.id;
      writePresState(p2);
    }, 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageTick]);

  const scene: Scene | null = run ? (run.mod.scenes[run.sceneIdx] ?? null) : null;
  const step: Step | null = run && scene ? (scene.steps[run.stepIdx] ?? null) : null;
  // 1.6.27 (Prejuicio R8, R9D-2): la escena ENSEÑA el Manual cuando
  // sus anclas declaradas viven en routes/manual.tsx — el registro
  // lo dice, no el guion a mano. En esa escena el conductor sigue
  // despierto DENTRO del Manual: su escenario es el Manual mismo.
  // La visita libre del alumno por el puente «Más en el manual»
  // sigue bajo la ley vieja — el conductor se apaga y Atrás rearma
  // el compás. Sin esta distinción, q6-portada se atrapaba en su
  // propio go (cada Atrás lo rearmaba) y q6-tema/q6-ver no podían
  // despachar jamás.
  const manualScene = scene != null && scene.anchors.some((a) => anchorById(a)?.file === "routes/manual.tsx");

  const saveProgress = useCallback((r: RunState, done: boolean) => {
    const prefs: PresState = readPresState();
    prefs.modules[r.mod.id] = { scene: r.sceneIdx, done };
    prefs.speed = r.speed;
    prefs.mode = r.mode;
    // La marca del último en uso: acompaña al módulo mientras quede
    // incompleto y se retira al completarse (su ficha vuelve a su piso).
    prefs.lastPlayed = done
      ? (prefs.lastPlayed === r.mod.id ? null : prefs.lastPlayed)
      : r.mod.id;
    writePresState(prefs);
  }, []);

  const advance = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    clearTimers();
    setRect(null);
    // Al salir de un compás con pie, su posición entra en la pila de
    // retorno: «Anterior» vuelve exactamente a donde el alumno ya estuvo.
    const curStep = r.mod.scenes[r.sceneIdx]?.steps[r.stepIdx];
    // En el camino repetido el alumno no ha ocupado ninguna
    // posición: nada entra en su pila de retorno (1.6.24, R8D-1).
    const onRoad = r.replayUntil != null && r.sceneIdx < r.replayUntil;
    const back = curStep && "caption" in curStep && !onRoad
      ? [...r.back, { sceneIdx: r.sceneIdx, stepIdx: r.stepIdx }]
      : r.back;
    if (r.stepIdx + 1 < (r.mod.scenes[r.sceneIdx]?.steps.length ?? 0)) {
      const next = { ...r, stepIdx: r.stepIdx + 1, won: false, back };
      setRun(next);
      saveProgress(next, false); // el progreso se guarda en cada avance
      return;
    }
    if (r.sceneIdx + 1 < r.mod.scenes.length) {
      producedRef.current.add(r.sceneIdx);
      const next = { ...r, sceneIdx: r.sceneIdx + 1, stepIdx: 0, won: false, back };
      setRun(next);
      saveProgress(next, false);
      return;
    }
    producedRef.current.add(r.sceneIdx);
    const done = { ...r, finished: true, won: false, back };
    setRun(done);
    // LA LECCIÓN QUE NO PUDO ENSEÑARSE LO DICE (principio 17): si alguna
    // escena se saltó, la tarjeta final ya lo declara — y el registro lo
    // honra: el módulo NO se anota como aprendido; queda en curso, con
    // su lugar guardado, hasta que una pasada limpia lo complete.
    saveProgress(done, done.skipped.length === 0);
  }, [clearTimers, saveProgress]);

  /** Un compás atrás (orden de Oscar, 2026-11-14: en Interactivo hay
   * «Siguiente» y también «Anterior» — se avanza y se retrocede). Atrás es
   * la pila de retorno que `advance` alimenta: se vuelve a la última
   * posición con pie que el alumno ya ocupó, dentro de la escena o
   * cruzando a la anterior — la memoria de lugar exacta. Nunca se cae en
   * la maquinaria (un `stage` re-semilla el escenario; un `go` solo
   * navega) ni se re-ejecuta nada: la posición destino ya fue vivida. El
   * escenario no se deshace: si el compás al que se vuelve es un gesto, el
   * alumno lo ejecuta de nuevo. Con la pila vacía no hay atrás y el botón
   * nace deshabilitado (canGoBack). */
  const goBack = useCallback(() => {
    const r = runRef.current;
    if (!r || r.finished || r.back.length === 0) return;
    clearTimers();
    setRect(null);
    const target = r.back[r.back.length - 1];
    const next = { ...r, sceneIdx: target.sceneIdx, stepIdx: target.stepIdx, won: false, back: r.back.slice(0, -1) };
    setRun(next);
    saveProgress(next, false);
  }, [clearTimers, saveProgress]);

  const skipScene = useCallback((sceneId: string) => {
    const r = runRef.current;
    if (!r) return;
    clearTimers();
    setRect(null);
    const skipped = r.skipped.includes(sceneId) ? r.skipped : [...r.skipped, sceneId];
    if (r.sceneIdx + 1 < r.mod.scenes.length) {
      const next = { ...r, sceneIdx: r.sceneIdx + 1, stepIdx: 0, won: false, skipped };
      setRun(next);
      saveProgress(next, false);
    } else {
      const done = { ...r, finished: true, won: false, skipped };
      setRun(done);
      saveProgress(done, skipped.length === 0); // principio 17: con escenas saltadas no se anota como aprendido
    }
  }, [clearTimers, saveProgress]);

  /** Toda salida pasa por el fundido (investigación de movimiento,
   * 2026-11-14): la raíz viste is-leaving, el velo y la tarjeta se apagan
   * en 200ms — menos que los 300ms de la entrada — y SOLO entonces se
   * disuelve el escenario. Con movimiento reducido, la salida es inmediata. */
  const leaveDelay = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;

  const exitToIndex = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      const r = runRef.current;
      if (r) saveProgress(r, r.finished);
      setIntro(null);
      setStay({ path: "/ajustes", openPres: true });
      setRun(null);
      // Se navega ANTES de disolver: al remontar, el usuario ya está en
      // Ajustes y el pliegue lee el openPres y se abre solo.
      void navigate({ to: "/ajustes" as never });
      void exitStage();
    }, leaveDelay());
  }, [navigate, saveProgress]);

  const stayHere = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      const r = runRef.current;
      if (r) saveProgress(r, r.finished);
      setStay({ path: window.location.pathname });
      setRun(null);
      // exitStage conserva la ruta: el escenario se disuelve y StageHost
      // remonta los datos reales bajo este mismo lugar.
      void exitStage();
    }, leaveDelay());
  }, [saveProgress]);

  /** «Ahora no» en la ventana de apertura: si la corrida ya nació, sale
   * como cualquier salida al índice; si el escenario aún venía entrando,
   * retira la intención y marca la cancelación — cuando el evento del
   * escenario aterrice sin intención viva, el escenario se disuelve solo
   * (la guarda del efecto de arranque) y el aterrizaje ya marcado deja al
   * usuario en el índice, donde estaba. */
  const cancelIntro = useCallback(() => {
    if (runRef.current) { exitToIndex(); return; }
    cancelledLaunchRef.current = true;
    clearLaunch();
    setIntro(null);
    setStay({ path: "/ajustes", openPres: true });
    if (stageOn()) void exitStage();
  }, [exitToIndex]);

  /** «Quedarme aquí» PRIMERO pregunta (ley de Oscar, 2026-11-14): una
   * ventana emergente le dice al alumno qué pasa después — podrá continuar
   * el módulo donde mismo quedó, sin reiniciarlo, y dónde vive su ficha
   * (Ajustes → Presentaciones, la primera de la lista). Confirmar es lo
   * que disuelve el escenario; «Seguir viendo» cierra la ventana y la
   * lección continúa. En la tarjeta final no hay ventana: el módulo ya
   * terminó y quedarse es quedarse. */
  const openStay = useCallback(() => {
    const r = runRef.current;
    if (!r || r.finished) { stayHere(); return; }
    clearTimers();
    setRun({ ...r, stayOpen: true });
  }, [clearTimers, stayHere]);

  const closeStay = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    setRun({ ...r, stayOpen: false });
  }, []);

  /* «Más en el manual» (Oscar, 2026-11-14): si la función de esta escena
   * vive en el Manual, la tarjeta ofrece el salto a su tema exacto para
   * investigar más; el viaje es una entrada real del historial, así que
   * Atrás devuelve al alumno a este mismo compás, que el motor rearma al
   * volver (la raíz se esconde y el reloj se detiene mientras lee). El
   * tema se valida contra el Manual vivo antes de saltar: sin tema, no
   * hay salto — la misma ley sin fantasmas que las anclas. */
  const openManual = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    const sc = r.mod.scenes[r.sceneIdx];
    const ref = sc?.steps.find((s) => s.kind === "ref");
    if (!ref || ref.kind !== "ref" || !findTopic(ref.topic)) return;
    clearTimers();
    rememberOrigin(pathname);
    void navigate({ to: "/manual", search: { t: ref.topic } });
  }, [clearTimers, navigate, pathname]);

  /** La ✕ PRIMERO pregunta (Oscar, 2026-11-14, desde su captura: al tocar
   * la X debe emerger una ventana de confirmación, para no salir de la
   * presentación sin querer): la ventana dice qué pasa después — el
   * módulo queda guardado justo donde va y su ficha abrirá el índice — y
   * solo su «Salir» disuelve el escenario. En la tarjeta final no hay
   * ventana: el módulo ya terminó y salir es simplemente salir. */
  const openExit = useCallback(() => {
    const r = runRef.current;
    if (!r || r.finished) { exitToIndex(); return; }
    clearTimers();
    setRun({ ...r, exitOpen: true });
  }, [clearTimers, exitToIndex]);

  const closeExit = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    setRun({ ...r, exitOpen: false });
  }, []);

  /* La entrada suave del módulo: al nacer un recorrido la raíz viste
   * is-entering un respiro — velo y hueco se encienden en 300ms, nunca a
   * opacidad plena en el primer fotograma — y cualquier resto de una
   * salida anterior se limpia para el próximo módulo. */
  const runModId = run?.mod.id;
  useEffect(() => {
    if (!runModId) return;
    leavingRef.current = false;
    setLeaving(false);
    setEntering(true);
    const id = window.setTimeout(() => setEntering(false), 400);
    return () => window.clearTimeout(id);
  }, [runModId]);

  /* LA TARJETA NACE DONDE VA A VIVIR (Oscar, 2026-11-14, desde su
   * teléfono: al abrirse, la tarjeta aparecía primero en el centro de la
   * pantalla y luego viajaba hasta la función — no dura lo bastante en el
   * centro para leerse, así que parece un bug). Mientras el compás tiene
   * ancla pero su rect aún no se ha medido, la tarjeta NO se pinta en el
   * lugar provisional: la raíz viste is-unplaced y la tarjeta espera
   * invisible; cuando el rect llega, la tarjeta ya está en su sitio y se
   * enciende ahí — nace donde va a vivir. Los compases sin ancla no
   * esperan: el parqueo central ES su lugar verdadero. */
  const [cardShown, setCardShown] = useState(false);
  /* LA LECCIÓN NUNCA SE QUEDA EN BLANCO (Oscar, 2026-11-14, de su
   * teléfono: al avanzar en Q1 la presentación desapareció segundos,
   * solo el hilo arriba). La invisibilidad de is-unplaced es SOLO del
   * nacimiento — el primer compás de la corrida, antes de que la
   * tarjeta haya tenido casa alguna. Una vez nacida en su sitio
   * (bornRef), un compás pendiente ya NO la apaga: la tarjeta permanece
   * viva en su último asiento (lastRectRef) mientras el ancla nueva se
   * mide o muere, y la lección sigue su camino a la vista. Sin esto,
   * cada ancla muerta costaba su espera entera a oscuras, y tres
   * seguidas dejaban la pantalla sin lección. */
  const bornRef = useRef(false);
  const lastRectRef = useRef<DOMRect | null>(null);
  /** La última escena ejecutada: la puerta abierta se cierra al cambiar. */
  const prevSceneRef = useRef(-1);
  /** La altura real de la tarjeta, medida en cada render: su sitio se
   * abraza a la pantalla con esa medida (la tarjeta nunca se corta). */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    if (h > 0 && Math.abs(h - cardH) > 1) setCardH(h);
  });
  useEffect(() => { if (rect) lastRectRef.current = rect; }, [rect]);
  useEffect(() => {
    if (!run) { setCardShown(false); bornRef.current = false; lastRectRef.current = null; prevSceneRef.current = -1; return; }
    // Tras la ventana de apertura la tarjeta espera invisible: su primer
    // fotograma visible es al tocar «Empezar», ya en su sitio.
    if (introRef.current) { setCardShown(false); return; }
    if (!bornRef.current) {
      /* EL NACIMIENTO ES EN EL PRIMER COMPÁS CON PIE (Oscar, 2026-11-14
       * 23:47, sobre la 1.5.80: «la primera ficha se muestra en el
       * centro, no donde va a comenzar»): la maquinaria inicial (stage,
       * go) no tiene pie, y la regla anterior la dejaba encender la
       * tarjeta en el parqueo central mientras sembraba y viajaba — el
       * centro se veía un instante y luego la tarjeta viajaba a su
       * sitio. Ahora la tarjeta NO nace durante la maquinaria: espera
       * invisible hasta el primer compás con pie, y si ese compás tiene
       * ancla, hasta que su asiento esté medido. Un primer pie sin ancla
       * (el teatro de AD16) nace en el centro, porque ESE es su lugar
       * verdadero. */
      const captioned = !!step && hasCaption(step);
      const seated = captioned && (!step || !("anchor" in step && step.anchor) || !!rect);
      if (!seated) { setCardShown(false); return; }
    }
    const raf = requestAnimationFrame(() => { setCardShown(true); bornRef.current = true; });
    return () => cancelAnimationFrame(raf);
  }, [run, rect, step, intro, run?.sceneIdx, run?.stepIdx]);

  /* ------------------------------ el motor de pasos ------------------------------ */
  useEffect(() => {
    if (!run || !scene || !step || run.finished || run.chaptersOpen || run.speedOpen || run.stayOpen || run.exitOpen || (inManual && !manualScene)) return;
    const r = run;
    let cancelled = false;
    // La velocidad EFECTIVA: la etiqueta del selector por el factor de la
    // escala recalibrada (guion.ts, PACE) — a 1× el motor corre al ritmo
    // que antes corría a 0.5×, como ordenó Oscar.
    const speed = effSpeed(r.speed);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const armRect = (el: HTMLElement) => {
      const measure = () => { if (!cancelled) setRect(el.getBoundingClientRect()); };
      measure();
      const iv = window.setInterval(measure, 180);
      timers.current.push(iv as unknown as number);
      window.addEventListener("resize", measure);
      const off = () => window.removeEventListener("resize", measure);
      timers.current.push(window.setTimeout(() => { window.clearInterval(iv); off(); }, 60_000) as unknown as number);
    };

    /* LA PRESENTACIÓN SE MUEVE CON LA PANTALLA (Oscar, 2026-11-15
     * 10:56, sobre la captura de la 1.5.88): en las vistas el selector
     * quedaba varado EN EL MEDIO y las tarjetas de abajo se cortaban;
     * la demostración debe DESPLAZAR la pantalla hacia arriba — y la
     * tarjeta con ella — para que el selector suba justo bajo la
     * tarjeta y la región del efecto llene el resto de la pantalla.
     * El desplazamiento va sobre el contenedor que realmente rueda
     * (la página o la hoja), no a ciegas sobre la ventana; el hueco
     * sigue al elemento porque armRect lo remide sin cesar. */
    const scrollDemonstration = (el: HTMLElement, anchor?: string) => {
      if (!isFootprint(anchor)) {
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        return;
      }
      const cardBottom = cardRef.current?.getBoundingClientRect().bottom ?? 0;
      const targetTop = Math.max(64, Math.round(cardBottom > 0 ? cardBottom + 16 : 232));
      const delta = el.getBoundingClientRect().top - targetTop;
      if (Math.abs(delta) < 4) return;
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const st = window.getComputedStyle(node);
        if ((st.overflowY === "auto" || st.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 4) {
          node.scrollTo({ top: node.scrollTop + delta, behavior: reduce ? "auto" : "smooth" });
          return;
        }
        node = node.parentElement;
      }
      window.scrollTo({ top: window.scrollY + delta, behavior: reduce ? "auto" : "smooth" });
    };

    /** La presión del conductor: pointerdown, mantener, pointerup y el click
     * que la app espera. ConfirmLink (la casa de la presión larga) arma su
     * temporizador con el pointerdown y traga el click si la presión llegó —
     * exactamente el gesto real, ejecutado por el conductor. */
    /** El arrastre del conductor: la misma corriente de puntero que produce
     * un dedo (down, moves con clientX decreciente, up) sobre la fila — la
     * SwipeRow de la casa la sigue y al soltar pasado su SNAP queda abierta. */
    const swipeEl = (el: HTMLElement, after: () => void) => {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x0 = r.left + r.width * 0.75;
      const mk = (type: string, x: number) =>
        new PointerEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true });
      el.dispatchEvent(mk("pointerdown", x0));
      const STEPS = 9;
      for (let i = 1; i <= STEPS; i++) {
        later(() => { if (!cancelled) el.dispatchEvent(mk("pointermove", x0 - (170 * i) / STEPS)); }, (420 * i) / STEPS / speed);
      }
      later(() => {
        if (cancelled) return;
        el.dispatchEvent(mk("pointerup", x0 - 170));
        after();
      }, 520 / speed);
    };

    const pressEl = (el: HTMLElement, holdMs: number, after: () => void) => {
      // holdMs ya trae el requisito real del compás + PRESS_BREATHE_MS (ver
      // la llamada): nunca se divide entre la velocidad.
      const target = interactiveTarget(el);
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
      later(() => {
        if (cancelled) return;
        target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        after();
      }, holdMs);
    };

    const runStep = async () => {
      /* EL ESCENARIO SE SIEMBRA ENTERO ANTES DE ACTUAR (Oscar,
       * 2026-11-14, del fallo de Q1 en su teléfono): entrar a un módulo
       * por una escena intermedia — la reanudación «Sigue donde ibas»,
       * un aterrizaje de búsqueda, un salto de capítulos — no puede
       * dejar sin sembrar la ficción que las escenas siguientes enseñan
       * (sus anclas morirían todas y la lección se quedaría en blanco).
       * Antes de ejecutar el paso en curso se siembran, en orden, todas
       * las construcciones declaradas hasta aquí que esta sesión de
       * escenario aún no tenga — respetando el orden dentro de la
       * escena: solo los pasos de escenario ANTERIORES al paso actual. */
      for (let i = 0; i <= r.sceneIdx; i++) {
        const sceneSteps = r.mod.scenes[i].steps;
        const upto = i < r.sceneIdx ? sceneSteps.length : r.stepIdx;
        for (let j = 0; j < upto; j++) {
          const s = sceneSteps[j];
          if (s.kind !== "stage" || sownBuildsRef.current.has(s.build)) continue;
          sownBuildsRef.current.add(s.build);
          stagedRef.current.add(`${r.mod.id}:${i}:${j}`);
          const sow = STAGE_SEEDS[s.build];
          if (!sow) continue;
          let landed = false;
          const seeding = sow()
            .catch(() => undefined)
            .then(() => { landed = true; });
          await Promise.race([
            seeding,
            new Promise((res) => setTimeout(res, 20_000)),
          ]);
          if (cancelled) return;
          window.dispatchEvent(new Event(STAGE_EVENT));
          if (!landed) {
            void seeding.then(() => {
              if (!cancelled) window.dispatchEvent(new Event(STAGE_EVENT));
            });
          }
        }
      }
      /* LA PUERTA SE CIERRA AL CAMBIAR DE ESCENA (2026-11-14, de la ley
       * «No solo contar, mostrar»): una escena que DEMUESTRA una puerta
       * (Posponer, Parar el día, Enviar…) la deja abierta, y el diálogo
       * abierto tapa las anclas de la escena siguiente — en Interactivo
       * el alumno no podría tocar lo que la lección le pide. Al cambiar
       * de escena, si el primer ancla vive FUERA del diálogo abierto, el
       * conductor lo cierra tocando su velo (bz-scrim, la superficie de
       * descarte de la casa), como haría el usuario con un toque fuera.
       * Si el ancla vive dentro, la puerta se queda: es su casa. */
      if (r.sceneIdx !== prevSceneRef.current) {
        prevSceneRef.current = r.sceneIdx;
        const scrim = [...document.querySelectorAll<HTMLElement>(".bz-scrim")].find(
          (s) => s.getClientRects().length > 0 && !s.closest(".pres-root"),
        );
        if (scrim) {
          const target = "anchor" in step && step.anchor ? resolveAnchor(step.anchor) : null;
          const layer = scrim.parentElement;
          if (!target || !(layer && layer.contains(target))) {
            tapEl(scrim);
            await new Promise((res) => setTimeout(res, 380));
            if (cancelled) return;
          }
        }
      }
      /* LA VENTANA DE APERTURA MANDA EN EL ARRANQUE (Oscar, 2026-11-14
       * 23:47): mientras la ventana está abierta, la maquinaria camina
       * tras ella — el escenario se siembra y el viaje inicial ocurre —
       * y el primer compás CON PIE se resuelve y se asienta (su ancla se
       * mide, la tarjeta ya tiene casa y «Empezar» se enciende), pero
       * ningún compás actúa ni avanza: la lección empieza cuando el
       * alumno toca «Empezar», con la tarjeta naciendo en su sitio. */
      /* 1.6.24 (Prejuicio R7, R8D-1): EL CAMINO SE REPITE EN
       * SILENCIO. Mientras la corrida lleva replayUntil, las
       * escenas anteriores a la destino ejecutan solo su
       * maquinaria: mostrar/preguntar/teatro avanzan sin pausa (su
       * enseñanza pertenece a la corrida entera, no a este
       * tránsito), la ventana de apertura no detiene el camino
       * (detiene la LECCIÓN, que empieza en la escena destino), un
       * ancla muerta en el camino no salta ni anota la escena — el
       * estado se produce a mejor esfuerzo y la escena destino
       * juzga sus propias anclas con las reglas de siempre — y los
       * gestos los hace el conductor aunque la lección sea
       * interactiva, con el reloj comprimido. */
      const replaying = r.replayUntil != null && r.sceneIdx < r.replayUntil;
      if (r.replayUntil != null && !replaying) {
        // El camino terminó: la corrida sigue en su escena con
        // las reglas normales (ventana de apertura incluida).
        setRun((cur) => (cur ? { ...cur, replayUntil: undefined } : cur));
        return;
      }
      // 1.6.27 (Prejuicio R8, R9D-5): en el camino, una escena
      // que esta corrida YA produjo no se re-ejecuta — el camino
      // existe para producir lo no vivido; lo vivido ya está
      // producido. Se avanza sin tocar nada, con la misma prisa
      // silenciosa de la maquinaria del camino.
      if (replaying && producedRef.current.has(r.sceneIdx)) {
        advance();
        return;
      }
      if (replaying && (step.kind === "show" || step.kind === "ask" || step.kind === "theatre" || step.kind === "ref")) {
        advance();
        return;
      }
      const speed = replaying ? 8 : effSpeed(r.speed);
      if (introRef.current && !replaying) {
        if (step.kind === "stage" || step.kind === "go" || step.kind === "ref") {
          // La maquinaria sigue su curso: cae al despacho normal.
        } else if (hasCaption(step)) {
          const el = step.anchor ? await waitAnchor(step.anchor) : null;
          if (cancelled) return;
          if (el) {
            scrollDemonstration(el, step.anchor);
            later(() => { if (!cancelled) armRect(el); }, reduce ? 60 : 380);
          }
          // Asentado (o intentado: un ancla muerta no encierra la
          // ventana — al empezar, el despacho normal la saltará con
          // gracia, como siempre).
          setHeldAt(`${r.sceneIdx}:${r.stepIdx}`);
          return;
        } else {
          return; // Un toque u otra maquinaria con efecto: espera a «Empezar».
        }
      }
      if (step.kind === "stage") {
        const key = `${r.mod.id}:${r.sceneIdx}:${r.stepIdx}`;
        if (!stagedRef.current.has(key)) {
          stagedRef.current.add(key);
          sownBuildsRef.current.add(step.build);
          const sow = STAGE_SEEDS[step.build];
          if (sow) {
            // La siembra se ESPERA y luego se anuncia: las pantallas ya
            // montadas leyeron el escenario vacío al entrar (caché de React
            // Query), así que sin este aviso seguirían mostrando el libro
            // vacío y las anclas de la escena morirían. El StageHost escucha
            // el mismo evento de siempre: limpia la caché y remonta, y la
            // escena continúa sobre la ficción ya sembrada. La espera tiene
            // techo (20 s) y la siembra nunca puede rechazar contra el
            // conductor: si la ficción tarda más (la siembra regular de un
            // cliente genera un año de agenda), el aviso se repite cuando
            // por fin aterriza, y la escena sigue su curso.
            let landed = false;
            const seeding = sow()
              .catch(() => undefined)
              .then(() => { landed = true; });
            await Promise.race([
              seeding,
              new Promise((res) => setTimeout(res, 20_000)),
            ]);
            if (cancelled) return;
            window.dispatchEvent(new Event(STAGE_EVENT));
            if (!landed) {
              void seeding.then(() => {
                if (!cancelled) window.dispatchEvent(new Event(STAGE_EVENT));
              });
            }
          }
        }
        later(() => { if (!cancelled) advance(); }, stepMs(step, lang) / r.speed); // stepMs ya trae la escala recalibrada: se divide entre la ETIQUETA, no entre la efectiva
        return;
      }
      if (step.kind === "go") {
        const target = resolveScreen(step.screen);
        // Un token sin resolver (`:lucia` sin cliente en el contexto) jamás
        // navega a la URL literal: la escena se salta con gracia (ley de
        // mantenimiento — nunca señalar a un fantasma).
        if (target.includes(":")) { if (replaying) { advance(); return; } skipScene(scene.id); return; }
        void navigate({ to: target as never });
        later(() => { if (!cancelled) advance(); }, stepMs(step, lang) / r.speed); // stepMs ya trae la escala recalibrada: se divide entre la ETIQUETA, no entre la efectiva
        return;
      }
      if (step.kind === "ref") { advance(); return; }
      const el = await waitAnchor(step.anchor);
      if (cancelled) return;
      if (!el) { if (replaying) { advance(); return; } skipScene(scene.id); return; } // ancla muerta: la escena se salta con gracia
      scrollDemonstration(el, step.anchor);
      later(() => { if (!cancelled) armRect(el); }, reduce ? 60 : 380);
      // La permanencia del paso: el pie + la lectura de la ventanita, si la hay.
      const capDwell = replaying
        ? 0
        : hasCaption(step)
          ? dwellMs(step.caption, lang) + (step.contexto ? Math.round((wordCount(pick(step.contexto, lang)) / WORDS_PER_MINUTE) * 60_000) : 0)
          : 0;

      if (step.kind === "tap") {
        // Un micro-toque de maquinaria: el tipo tap no lleva pie propio,
        // así que el principio 16 no le pide lectura — no hay leyenda que
        // la acción pudiera pisar. Sí le piden el 9 (su efecto asienta
        // como todo efecto: 650) y el 14 (si una pausa lo interrumpió
        // tras caer, no se repite).
        if (r.won) {
          later(() => { if (!cancelled) advance(); }, 650 / speed);
        } else if (r.playing) {
          later(() => {
            if (cancelled) return;
            tapEl(el);
            setRun((cur) => (cur ? { ...cur, won: true } : cur));
            later(() => { if (!cancelled) advance(); }, 650 / speed);
          }, 300 / speed);
        }
        return;
      }
      if (step.kind === "type") {
        const input = el.matches("input") ? (el as HTMLInputElement) : el.querySelector<HTMLInputElement>("input, textarea");
        // Los editores de notas de la casa son contentEditable, sin input
        // dentro: en ellos se escribe por la vía de edición real
        // (insertText dispara los mismos eventos que teclear de verdad).
        const editable = !input
          ? ((el as HTMLElement).isContentEditable ? (el as HTMLElement) : el.querySelector<HTMLElement>("[contenteditable]"))
          : null;
        if (!input && !editable) { if (replaying) { advance(); return; } skipScene(scene.id); return; }
        const dwell = capDwell / speed;
        later(() => {
          if (cancelled) return;
          if (input) {
            input.focus();
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            setter?.call(input, pick(step.text, lang));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          } else if (editable) {
            editable.focus();
            const sel = window.getSelection();
            if (sel) {
              const range = document.createRange();
              range.selectNodeContents(editable);
              sel.removeAllRanges();
              sel.addRange(range);
            }
            if (!document.execCommand("insertText", false, pick(step.text, lang))) {
              editable.textContent = pick(step.text, lang);
              editable.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        }, Math.min(600, dwell * 0.4));
        if (r.playing || r.mode === "interactive") later(() => { if (!cancelled) advance(); }, dwell + 500 / speed);
        return;
      }
      if (step.kind === "show" || step.kind === "ask" || step.kind === "theatre") {
        if (r.mode === "auto" || step.kind === "ask") {
          if (r.playing) later(() => { if (!cancelled) advance(); }, capDwell / speed);
        }
        return;
      }
      if (step.kind === "press") {
        if (r.mode === "interactive" && !replaying) {
          // La presión debe ser REAL y durar al menos `ms` de reloj verdadero:
          // el temporizador de la app (550ms en ConfirmLink) no conoce la
          // velocidad de la presentación. Un toque rápido no cuenta: sacude.
          let downAt = 0;
          let heldId = 0;
          const cleanup = () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("pointerup", onUp, true);
            document.removeEventListener("pointercancel", onUp, true);
            if (heldId) window.clearTimeout(heldId);
          };
          const onDown = (e: Event) => {
            if (!el.contains(e.target as Node) || downAt) return;
            downAt = performance.now();
            heldId = window.setTimeout(() => {
              cleanup();
              setRun((cur) => (cur ? { ...cur, won: true } : cur));
              later(() => { if (!cancelled) advance(); }, 650);
            }, step.ms);
            timers.current.push(heldId);
          };
          const onUp = (e: Event) => {
            if (!downAt || !el.contains(e.target as Node)) return;
            const held = performance.now() - downAt;
            downAt = 0;
            if (heldId) window.clearTimeout(heldId);
            if (held < step.ms) setShaking((n) => n + 1); // soltó antes: no contó
          };
          document.addEventListener("pointerdown", onDown, true);
          document.addEventListener("pointerup", onUp, true);
          document.addEventListener("pointercancel", onUp, true);
          timers.current.push(window.setTimeout(cleanup, 120_000) as unknown as number);
        } else if (r.playing) {
          // EL GESTO ESPERA LA LEYENDA ENTERA (registro de Faro 1.3.278,
          // aplicado 2026-11-14): antes el gesto automático se ejecutaba
          // al 55% de la vida del pie — el módulo corría más rápido de lo
          // anunciado y las leyendas cortas no se alcanzaban a leer. Ahora
          // el gesto espera la vida COMPLETA del pie y luego asienta, y el
          // total del motor es exactamente lo que stepMs anuncia.
          const beat = capDwell / speed;
          if (r.won) {
            // El gesto ya se ejecutó antes de una pausa: no se repite
            // (principio 14 — reanudar nunca deshace lo mostrado).
            later(() => { if (!cancelled) advance(); }, 650 / speed);
            return;
          }
          later(() => {
            if (cancelled) return;
            // La presión mostrada dura los `ms` REALES del compás (+ un
            // respiro): el temporizador de la app (550 ms en ConfirmLink)
            // no conoce la velocidad de la presentación, así que dividir
            // la presión entre la velocidad la dejaba corta a 1.5×/2× y el
            // gesto mostrado no llegaba. La velocidad manda sobre el reloj
            // de la presentación (pies, pausas), nunca sobre el requisito
            // físico del gesto — y la duración anunciada ya cuenta la
            // presión entera (stepMs suma step.ms), así que no se miente.
            pressEl(el, step.ms + PRESS_BREATHE_MS, () => {
              if (cancelled) return;
              setRun((cur) => (cur ? { ...cur, won: true } : cur));
              later(() => { if (!cancelled) advance(); }, 650 / speed);
            });
          }, beat);
        }
        return;
      }
      if (step.kind === "swipe") {
        if (r.mode === "interactive" && !replaying) {
          // El arrastre debe ser REAL: se sigue el puntero del usuario sobre
          // la tarjeta y solo cuenta un deslizamiento claro a la izquierda.
          let downX = 0;
          let downY = 0;
          let tracking = false;
          const cleanup = () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("pointermove", onMove, true);
            document.removeEventListener("pointerup", onUp, true);
            document.removeEventListener("pointercancel", onUp, true);
          };
          const onDown = (e: PointerEvent) => {
            if (!el.contains(e.target as Node) || tracking) return;
            tracking = true;
            downX = e.clientX;
            downY = e.clientY;
          };
          const onMove = (e: PointerEvent) => {
            if (!tracking) return;
            const dx = e.clientX - downX;
            const dy = e.clientY - downY;
            if (dx <= -60 && Math.abs(dx) > Math.abs(dy)) {
              cleanup();
              setRun((cur) => (cur ? { ...cur, won: true } : cur));
              later(() => { if (!cancelled) advance(); }, 650);
            }
          };
          const onUp = () => { tracking = false; };
          document.addEventListener("pointerdown", onDown, true);
          document.addEventListener("pointermove", onMove, true);
          document.addEventListener("pointerup", onUp, true);
          document.addEventListener("pointercancel", onUp, true);
          timers.current.push(window.setTimeout(cleanup, 120_000) as unknown as number);
        } else if (r.playing) {
          const beat = capDwell / speed;
          if (r.won) {
            // El gesto ya se ejecutó antes de una pausa: no se repite
            // (principio 14 — reanudar nunca deshace lo mostrado).
            later(() => { if (!cancelled) advance(); }, 650 / speed);
            return;
          }
          later(() => {
            if (cancelled) return;
            swipeEl(el, () => {
              if (cancelled) return;
              setRun((cur) => (cur ? { ...cur, won: true } : cur));
              later(() => { if (!cancelled) advance(); }, 650 / speed);
            });
          }, beat);
        }
        return;
      }
      // do: el compás interactivo
      if (r.mode === "interactive" && !replaying) {
        const onTap = (e: Event) => {
          if (el.contains(e.target as Node)) {
            document.removeEventListener("pointerdown", onTap, true);
            setRun((cur) => (cur ? { ...cur, won: true } : cur));
            later(() => { if (!cancelled) advance(); }, 650);
          }
        };
        document.addEventListener("pointerdown", onTap, true);
        timers.current.push(window.setTimeout(() => document.removeEventListener("pointerdown", onTap, true), 120_000) as unknown as number);
      } else if (r.playing) {
        const beat = capDwell / speed;
        if (r.won) {
          // El toque ya cayó antes de una pausa: no se repite (principio
          // 14 — reanudar nunca deshace lo mostrado; en un interruptor,
          // repetirlo lo apagaría).
          later(() => { if (!cancelled) advance(); }, 650 / speed);
          return;
        }
        later(() => {
          if (cancelled) return;
          tapEl(el);
          setRun((cur) => (cur ? { ...cur, won: true } : cur));
          later(() => { if (!cancelled) advance(); }, 650 / speed);
        }, beat);
      }
    };
    void runStep();
    return () => { cancelled = true; clearTimers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.sceneIdx, run?.stepIdx, run?.mode, run?.playing, run?.speed, run?.replayUntil, run?.chaptersOpen, run?.speedOpen, run?.stayOpen, run?.exitOpen, run?.finished, inManual, intro]);

  /* Esc: una capa a la vez (velocidad → capítulos → salir al índice). */
  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const cur = runRef.current;
      if (!cur) return;
      if (cur.exitOpen) setRun({ ...cur, exitOpen: false });
      else if (cur.speedOpen) setRun({ ...cur, speedOpen: false });
      else if (cur.chaptersOpen) setRun({ ...cur, chaptersOpen: false });
      else exitToIndex();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, exitToIndex]);

  /* LA LECCIÓN NUNCA ATRAPA AL ALUMNO (principio 14): si la app pasa a
   * segundo plano a mitad de compás — entra una llamada, llega un aviso,
   * el teléfono va al bolsillo — el reloj se detiene donde está, sin
   * velo congelado ni compás a medias. Al volver, el compás sigue SOLO
   * si estaba corriendo: una pausa del propio alumno jamás se deshace
   * sola. (La muerte de la app ya la cubren el escenario efímero, el
   * barrido de arranque y el guardián de preferencias.) */
  const hiddenPauseRef = useRef(false);
  useEffect(() => {
    const onVis = () => {
      const cur = runRef.current;
      if (document.visibilityState === "hidden") {
        if (cur && cur.playing && !cur.finished) {
          hiddenPauseRef.current = true;
          setRun({ ...cur, playing: false });
        }
      } else if (hiddenPauseRef.current) {
        hiddenPauseRef.current = false;
        const now = runRef.current;
        if (now && !now.finished) setRun({ ...now, playing: true });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* LA VENTANA DE APERTURA (Oscar, 2026-11-14 23:47): pregunta grande —
   * el módulo — y explicación corta: las dos maneras de aprenderla y los
   * controles de la tarjeta, nombrados uno a uno. «Empezar» se enciende
   * cuando el primer compás con pie ya está asentado tras ella; mientras
   * tanto el botón dice la verdad: «Preparando el escenario…». */
  const introReady = !!run && !!step && hasCaption(step)
    && (!("anchor" in step && step.anchor) || !!rect || heldAt === `${run.sceneIdx}:${run.stepIdx}`);
  const renderIntroWindow = (ready: boolean) => {
    const m = intro!.mod;
    const row = (icon: ReactNode, name: string, job: string) => (
      <div className="pres-intro-row">
        <span className="pres-intro-ic">{icon}</span>
        <span><strong>{name}</strong> · {job}</span>
      </div>
    );
    return (
      <div className="pres-stayveil">
        <div className="pres-staynote pres-intro" role="dialog" aria-label={pick(m.title, lang)}>
          <p className="pres-note-title">{pick(m.title, lang)}</p>
          <p className="pres-intro-sub">{durationLabel(m, lang, inAndroidApp(), readTabletEnabled())} · {tx("La app, en vivo, paso a paso", "The app, live, step by step")}</p>
          <p>
            {tx(
              "Puedes verla sola o hacerla tú. En Automático, la presentación avanza y toca cada función por ti; en Interactivo, avanzas tú y tocas tú. Puedes cambiar cuando quieras con el botón de modo de la tarjeta.",
              "You can watch it on its own or do it yourself. In Automatic, the presentation advances and taps each function for you; in Interactive, you advance and you tap. You can switch any time with the card's mode button.",
            )}
          </p>
          <div className="pres-intro-keys">
            {row(<Gauge aria-hidden />, tx("Velocidad", "Speed"), tx("el ritmo de la lección", "the lesson's pace"))}
            {row(<List aria-hidden />, tx("Capítulos", "Chapters"), tx("saltar a otra parte del módulo", "jump to another part of the module"))}
            {row(<Pause aria-hidden />, tx("Pausa", "Pause"), tx("detiene el Automático", "stops the Automatic"))}
            {row(<span className="pres-intro-pair"><ChevronLeft aria-hidden /><ChevronRight aria-hidden /></span>, tx("Ir y volver", "Back and forth"), tx("un paso, en Interactivo", "one step, in Interactive"))}
            {row(<Hand aria-hidden />, tx("Muéstrame tú", "Show me"), tx("si un paso te cuesta, lo hace por ti", "if a step is hard, it does it for you"))}
            {row(<X aria-hidden />, tx("Salir", "Leave"), tx("el módulo queda guardado donde va", "the module stays saved where you left it"))}
          </div>
          <p>
            {tx(
              "Todo pasa en un escenario de práctica: tu libro real no se toca.",
              "Everything happens on a practice stage: your real book stays untouched.",
            )}
          </p>
          <div className="pres-stayacts">
            <button type="button" className="pres-btn ghost" onClick={cancelIntro}>{tx("Ahora no", "Not now")}</button>
            <button type="button" className="pres-btn" disabled={!ready} onClick={() => setIntro(null)}>
              {ready ? tx("Empezar", "Start") : tx("Preparando el escenario…", "Preparing the stage…")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const stageActive = typeof window !== "undefined" && stageOn();
  if (intro && !run) {
    // La fase de la intención: el escenario aún entra y la ventana ya
    // está — el toque recibió su respuesta en el mismo fotograma.
    return <div className="pres-root is-introonly">{renderIntroWindow(false)}</div>;
  }
  if (!stageActive || !run || (inManual && !manualScene)) return null;

  const mod = run.mod;
  const chapter = scene ? mod.chapters.find((c) => c.id === scene.chapter) : null;
  /* El tema del Manual de ESTA escena, si su función vive en el Manual:
   * el paso `ref` de la escena lo declara y findTopic lo valida vivo —
   * sin tema vivo no hay botón (Oscar: el botón, solo para las funciones
   * que existen en el manual). La fila inferior lleva ahora solo el
   * nombre corto del módulo a la izquierda (también Oscar, 2026-11-14:
   * un resumen cortito, para que el botón nuevo respire a la derecha). */
  const refStep = scene?.steps.find((s) => s.kind === "ref");
  const manualTopic = refStep && refStep.kind === "ref" && findTopic(refStep.topic) ? refStep.topic : null;
  const totalScenes = mod.scenes.length;
  const caption = step && hasCaption(step) ? pick(step.caption, lang) : null;
  const contexto = step && hasCaption(step) && step.contexto ? pick(step.contexto, lang) : null;
  const isGesture = step?.kind === "do" || step?.kind === "press" || step?.kind === "swipe";
  /** Hay atrás solo si la pila de retorno guarda alguna posición vivida. */
  const canGoBack = run.back.length > 0;
  // El hueco respira 10px alrededor del foco — y el anillo NUNCA se corta
  // (Oscar, 2026-11-14, desde el recorte de la pestaña Cobros: el anillo
  // verde se salía por el borde inferior del teléfono). La geometría
  // anterior solo protegía arriba y a la izquierda: contra el borde
  // inferior y el derecho el aire se comía el anillo. Ahora el rectángulo
  // entero se contiene en la pantalla con 4px de margen: donde hay sitio,
  // el aire es 10px; donde no, se comprime el aire — jamás el anillo.
  const containHole = (r: DOMRect) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(4, r.left - 10);
    const top = Math.max(4, r.top - 10);
    const right = Math.min(vw - 4, r.right + 10);
    const bottom = Math.min(vh - 4, r.bottom + 10);
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  };
  const hole = rect ? containHole(rect) : null;
  /* El asiento de la TARJETA mientras su compás está pendiente: el
   * último foco medido (el anillo y el velo, en cambio, jamás señalan a
   * un fantasma: sin rect no hay hueco). Así la tarjeta espera viva en
   * su casa anterior y luego se desliza a la nueva — nunca al parqueo
   * del centro a mitad de corrida. */
  const cardHole = hole ?? (lastRectRef.current ? containHole(lastRectRef.current) : null);
  const cardBelow = cardHole ? (window.innerHeight - (cardHole.top + cardHole.height)) > 240 : true;
  // La tarjeta se centra sobre el foco y se abraza a los bordes — con SU
  // ancho real en cada ancho de pantalla (370 bajo 48rem; 442 desde ahí;
  // siempre 100vw−20 como techo). La fórmula anterior llevaba el 370 fijo
  // en la sangre: a 320px el tope derecho (100vw−380) salía negativo y la
  // tarjeta amanecía 60px fuera de la pantalla (banco, 2026-11-14).
  const vwNow = window.innerWidth;
  const cardW = Math.min(vwNow >= 768 ? 442 : 370, vwNow - 20);
  /* LA TARJETA NUNCA SE CORTA POR ARRIBA NI POR ABAJO (defecto cazado por
   * Faro en su verificación de la ley 15, 2026-11-14, y presente aquí con
   * la misma forma): la regla «debajo si quedan más de 240px» suponía una
   * tarjeta de ~240px, pero una leyenda larga la lleva a 300+ y el borde
   * inferior se la comía; y anclada por `bottom` sobre un foco bajo, una
   * tarjeta alta amanecía con el tope fuera de pantalla. La cura es la
   * suya: la tarjeta mide su altura real (cardH, observada en cada
   * render) y su sitio deseado se ABRAZA a la pantalla — se comprime
   * hasta caber, jamás se sale. */
  const vhNow = window.innerHeight;
  /* LA TARJETA NO TAPA LA FUNCIÓN NI SU EFECTO (Oscar, 2026-11-14 23:47
   * y reforzado 2026-11-15 10:42, sobre su teléfono): al demostrar el
   * selector de vistas, la tarjeta se sentaba sobre las tarjetas cuyo
   * cambio de tamaño ERA la lección — primero al centro, luego abajo
   * (mi cura de la 1.5.85, equivocada: dejaba ver el selector pero tapaba
   * las tarjetas, que son el efecto). La demostración de una función es
   * el control MÁS la región donde su efecto se representa; en las
   * vistas el efecto vive ABAJO (la lista que se achica y crece), así
   * que la tarjeta SUBE: arriba del todo, donde no vive nada de la
   * lección. El foco (hueco y anillo) sigue en el selector. */
  const seatTop = !!(step && "anchor" in step && typeof step.anchor === "string" && isFootprint(step.anchor));
  const desiredTop = seatTop
    ? 10
    : cardHole
      ? cardBelow
        ? cardHole.top + cardHole.height + 14
        : cardHole.top - 14 - cardH
      : 0;
  const clampedTop = cardH > 0
    ? Math.min(Math.max(8, desiredTop), Math.max(8, vhNow - cardH - 8))
    : desiredTop;
  const cardStyle: React.CSSProperties = cardHole ? {
    left: Math.min(Math.max(10, cardHole.left + cardHole.width / 2 - cardW / 2), vwNow - cardW - 10),
    top: clampedTop,
  } : { left: "50%", top: "38%", transform: "translateX(-50%)" };

  const jumpToScene = (idx: number) => {
    clearTimers();
    setRect(null);
    // 1.6.24 (Prejuicio R7, R8D-1): un salto HACIA ADELANTE repite
    // la maquinaria de las escenas saltadas (replayUntil), igual
    // que un arranque a mitad de módulo — la escena destino hereda
    // su estado. Un salto hacia atrás conserva la historia ya
    // producida por esta corrida: repetirla aplicaría dos veces
    // sus acciones (un interruptor se apagaría, un cobro se
    // duplicaría), así que allí la escena se apoya en lo vivido y,
    // si su superficie ya se consumió, se salta con la honestidad
    // del principio 17.
    // 1.6.27 (Prejuicio R8, R9D-4): el salto atrás — y el salto a
    // la misma escena — APAGA el camino: la rama de atrás esparcía
    // `...run` sin nombrar replayUntil, así que un camino vivo
    // sobrevivía al salto y re-ejecutaba el tramo ya repetido.
    const fwd = idx > run.sceneIdx;
    const next = fwd
      ? { ...run, sceneIdx: run.sceneIdx + 1, stepIdx: 0, won: false, chaptersOpen: false, speedOpen: false, finished: false, back: [] as { sceneIdx: number; stepIdx: number }[], replayUntil: idx, playing: true }
      : { ...run, sceneIdx: idx, stepIdx: 0, won: false, chaptersOpen: false, speedOpen: false, finished: false, back: [], replayUntil: undefined };
    setRun(next);
    saveProgress(next, false);
  };

  /** «Muéstrame tú»: el conductor ejecuta el gesto de la escena (toque, presión o deslizado). */
  const showMe = () => {
    if (!step || (step.kind !== "do" && step.kind !== "press" && step.kind !== "swipe")) return;
    const el = resolveAnchor(step.anchor) as HTMLElement | null | undefined;
    if (!el) return;
    if (step.kind === "swipe") {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x0 = r.left + r.width * 0.75;
      const mk = (type: string, x: number) =>
        new PointerEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true });
      el.dispatchEvent(mk("pointerdown", x0));
      for (let i = 1; i <= 9; i++) {
        window.setTimeout(() => el.dispatchEvent(mk("pointermove", x0 - (170 * i) / 9)), (420 * i) / 9 / effSpeed(run.speed));
      }
      window.setTimeout(() => el.dispatchEvent(mk("pointerup", x0 - 170)), 520 / effSpeed(run.speed));
      return;
    }
    if (step.kind === "press") {
      const target = interactiveTarget(el);
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
      // Los `ms` REALES del compás + el respiro, a CUALQUIER velocidad: el
      // oído interactivo mide la presión en reloj verdadero y el
      // temporizador de la app también — con `ms / speed` la presión
      // mostrada se soltaba antes de tiempo a 1.5×/2× y el compás no se
      // completaba (la presión del mapa de Q5 es el caso).
      window.setTimeout(() => {
        target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }, step.ms + PRESS_BREATHE_MS);
    } else {
      // do: el gesto completo de un toque — pointerdown, pointerup y click.
      // El click a solas (tapEl) ejecutaba la acción en la app pero el compás
      // interactivo nunca se completaba: su oído espera un pointerdown dentro
      // del ancla, y sin él «Muéstrame tú» dejaba la escena a medias (en un
      // objetivo de vaivén, como el pin, el segundo toque del alumno habría
      // deshecho lo mostrado). La rama de press ya emitía la terna entera.
      const target = interactiveTarget(el);
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }
  };

  const onShieldTap = (e: React.PointerEvent) => { if (isGesture) { e.preventDefault(); setShaking((n) => n + 1); } };
  /* LO DEMOSTRADO SE VE ENTERO Y EN COLOR NORMAL (Oscar, 2026-11-15
   * 10:50): la ventana sin velo no cubre solo el botón enfocado — cubre
   * la huella completa de la demostración, el control MÁS la región
   * donde su efecto se representa. En las vistas, el efecto (las
   * tarjetas que se achican y crecen) vive del selector hasta el fondo
   * de la pantalla: la ventana clara se extiende hasta abajo y las
   * tarjetas se ven en su color normal, integradas, no tras el fondo
   * oscuro. El anillo sigue marcando el control, que es lo que se toca. */
  const clearHole = hole && seatTop
    ? { top: hole.top, left: 0, width: window.innerWidth, height: Math.max(0, window.innerHeight - hole.top) }
    : hole;
  const shieldRects: React.CSSProperties[] = clearHole ? [
    { left: 0, top: 0, width: "100%", height: Math.max(0, clearHole.top) },
    { left: 0, top: clearHole.top + clearHole.height, width: "100%", bottom: 0 },
    { left: 0, top: clearHole.top, width: Math.max(0, clearHole.left), height: clearHole.height },
    { left: clearHole.left + clearHole.width, top: clearHole.top, right: 0, height: clearHole.height },
  ] : [{ left: 0, top: 0, width: "100%", height: "100%" }];

  // 1.6.27 (Prejuicio R8, R9D-3): el teatro se queda mientras
  // la escena lo enseña — no solo mientras dura un paso `theatre`:
  // las escenas de zonas muestran anclas teatro-* con pasos `show`,
  // y el teatro se desmontaba con el paso anterior, así que las
  // nueve morían en su primer ancla. La pieza se lee de la propia
  // ancla (teatro-hoy/semana/panel-*), así que cada escena pinta
  // su pieza sin depender de la escena anterior.
  const theatrePiece: "hoy" | "semana" | "panel" | null =
    step?.kind === "theatre"
      ? step.piece
      : (() => {
          const a =
            (step && "anchor" in step && typeof step.anchor === "string" ? step.anchor : null)
            ?? scene?.anchors.find((x) => x.startsWith("teatro-"));
          const seg = a?.split("-")[1];
          return seg === "hoy" || seg === "semana" || seg === "panel" ? seg : null;
        })();

  return (
    <div className={`pres-root${entering ? " is-entering" : ""}${leaving ? " is-leaving" : ""}${!cardShown ? " is-unplaced" : ""}`} role="dialog" aria-modal="false" aria-label={pick(mod.title, lang)} data-skipped={run.skipped.join(" ")}>
      {/* el escudo rodea el recorte: ningún toque desvía el guion, y el objetivo del
          compás recibe el suyo de verdad, a través del hueco */}
      {shieldRects.map((style, i) => (
        <div key={i} className="pres-shield" style={style} onPointerDown={onShieldTap} />
      ))}
      {/* el velo: los mismos cuatro rectángulos que el escudo, con el
          fondo oscurecido y levemente desaturado, sin desenfoque (ley
          del velo, corrección de Oscar 2026-11-14) — el hueco, sin
          parche, queda nítido */}
      {hole && !run.finished ? shieldRects.map((style, i) => (
        <div key={`blur-${i}`} className="pres-blurpatch" style={style} aria-hidden />
      )) : null}
      {hole && !run.finished ? (
        <div className={`pres-hole${run.won ? " is-won" : ""}`} style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} aria-hidden />
      ) : null}
      {/* LO NOMBRADO QUEDA SEÑALADO (Oscar, 2026-11-15 11:19, refuerzo
          del principio 11): cuando el diálogo se refiere a una REGIÓN —
          la huella de una demostración — no basta con que vaya sin velo:
          un recuadro visible la ata a las palabras, para que el alumno
          vea exactamente a qué «eso» se refiere la leyenda. El anillo
          sigue sobre el control; el marco, sobre lo nombrado. */}
      {hole && seatTop && clearHole && !run.finished ? (
        <div className="pres-regionframe" style={{ left: 6, top: clearHole.top + 2, width: Math.max(0, clearHole.width - 12), height: Math.max(0, clearHole.height - 8) }} aria-hidden />
      ) : null}
      <div className="pres-thread" aria-hidden><i style={{ width: `${((run.sceneIdx + (run.finished ? 1 : 0)) / totalScenes) * 100}%` }} /></div>

      {theatrePiece && !run.finished ? (
        <div className="pres-theatre" aria-hidden={false}>
          <WidgetTheatre piece={theatrePiece} />
        </div>
      ) : null}

      {run.chaptersOpen ? (
        <div className="pres-panel">
          <div className="pres-panel-head">
            <strong className="pres-serif">{pick(mod.title, lang)}</strong>
            <button type="button" className="pres-ctl" aria-label={tx("Cerrar", "Close")} onClick={() => setRun({ ...run, chaptersOpen: false })}><X aria-hidden /></button>
          </div>
          {mod.chapters.map((ch) => (
            <div key={ch.id} className="pres-panel-ch">
              <p className="pres-panel-kicker">{pick(ch.title, lang)}</p>
              {mod.scenes.map((s, i) => s.chapter === ch.id ? (
                <button key={s.id} type="button" className={`pres-panel-scene${i === run.sceneIdx ? " is-now" : ""}`} onClick={() => jumpToScene(i)}>
                  <span className="pres-num">{i + 1}</span>{pick(s.steps.find((x) => hasCaption(x))?.caption ?? mod.title, lang)}
                  {run.skipped.includes(s.id) ? <em>{tx("saltada", "skipped")}</em> : null}
                </button>
              ) : null)}
            </div>
          ))}
        </div>
      ) : run.finished ? (
        <div className="pres-card is-done" style={{ left: "50%", top: "34%", transform: "translateX(-50%)" }}>
          <span className="pres-done-check"><Check aria-hidden /></span>
          <strong className="pres-serif">{tx("Módulo completo", "Module complete")}</strong>
          <p>{pick(mod.promise, lang)}</p>
          {run.skipped.length ? (
            <p className="pres-done-note">
              {tx(
                "Algunas escenas no pudieron mostrarse en esta pasada, así que el módulo no se marca como aprendido.",
                "Some scenes could not be shown this time through, so the module is not marked as learned.",
              )}
            </p>
          ) : null}
          <div className="pres-done-acts">
            <button type="button" className="pres-btn" onClick={exitToIndex}>{tx("Volver al índice", "Back to the index")}</button>
            <button type="button" className="pres-btn ghost" onClick={stayHere}>{tx("Quedarme aquí", "Stay here")}</button>
          </div>
        </div>
      ) : caption ? (
        <div key={shaking} ref={cardRef} className={`pres-card${shaking ? " is-shake" : ""}${seatTop ? " is-topseat" : ""}`} style={cardStyle} aria-live="polite">
          {contexto ? <div key={`ctx-${run.sceneIdx}-${run.stepIdx}`} className="pres-contexto pres-beat" role="note">{contexto}</div> : null}
          <div className="pres-toprow">
            <p className="pres-kicker">
              <span className="pres-num">{run.sceneIdx + 1} / {totalScenes}</span>
            </p>
            {run.mode === "interactive" ? (
              /* La pareja de navegación SOLO ICONOS vive en la CABECERA, a la
                 IZQUIERDA del botón de modo (Oscar, 2026-11-14: primero nació
                 en la fila inferior; él la subió — «no abajo, para ahorrar
                 espacio y el texto se acomode mejor» — y la fila inferior
                 queda para el texto). La palabra vive en el aria-label.
                 ◁ retrocede un compás; ▷ avanza (en compases de gesto no
                 hay ▷: el gesto se ejecuta o se pide con «Muéstrame tú»). */
              <span className="pres-navpair">
                <button type="button" className="pres-navbtn" onClick={goBack}
                  disabled={!canGoBack}
                  aria-label={tx("Anterior", "Previous")}>
                  <ChevronLeft aria-hidden />
                </button>
                {!isGesture ? (
                  <button type="button" className="pres-navbtn pres-nextbtn" onClick={advance}
                    aria-label={tx("Siguiente", "Next")}>
                    <ChevronRight aria-hidden />
                  </button>
                ) : null}
              </span>
            ) : null}
            <button type="button" className="pres-ctl hd" aria-label={tx("Modo", "Mode")}
              onClick={() => {
                const r2 = { ...run, mode: run.mode === "auto" ? "interactive" as const : "auto" as const };
                setRun(r2); saveProgress(r2, false);
              }}>
              {run.mode === "auto" ? <Play aria-hidden /> : <Hand aria-hidden />}
              {run.mode === "auto" ? tx("Automático", "Automatic") : tx("Interactivo", "Interactive")}
            </button>
            <button type="button" className="pres-ctl hd pres-num" aria-label={tx("Velocidad", "Speed")} aria-expanded={run.speedOpen}
              onClick={() => setRun({ ...run, speedOpen: !run.speedOpen })}>
              <Gauge aria-hidden />{run.speed}×
            </button>
            <button type="button" className="pres-ctl hd" aria-label={tx("Capítulos", "Chapters")} onClick={() => setRun({ ...run, chaptersOpen: true })}><List aria-hidden /></button>
            {run.mode === "auto" ? (
              <button type="button" className="pres-ctl hd" aria-label={run.playing ? tx("Pausar", "Pause") : tx("Seguir", "Resume")} onClick={() => setRun({ ...run, playing: !run.playing })}>
                {run.playing ? <Pause aria-hidden /> : <Play aria-hidden />}
              </button>
            ) : null}
            <button type="button" className="pres-ctl hd" aria-label={tx("Salir", "Exit")} onClick={openExit}><X aria-hidden /></button>
          </div>
          {run.speedOpen ? (
            <div className="pres-speedrow" role="group" aria-label={tx("Velocidad", "Speed")}>
              {SPEEDS.map((s) => (
                <button key={s} type="button" className={`pres-speedopt pres-num${s === run.speed ? " is-on" : ""}`}
                  onClick={() => {
                    const r2 = { ...run, speed: s, speedOpen: false };
                    setRun(r2); saveProgress(r2, false);
                  }}>
                  {s}×
                </button>
              ))}
            </div>
          ) : null}
          <p key={`cap-${run.sceneIdx}-${run.stepIdx}`} className={`pres-caption pres-beat${step?.kind === "ask" ? " is-ask" : ""}${isGesture ? " is-do" : ""}`}>
            {isGesture ? <i className={`pres-dot${run.won ? " is-won" : ""}`} aria-hidden /> : null}
            {caption}
            {run.won ? <Check className="pres-won" aria-hidden /> : null}
          </p>
          <div key={`bot-${run.sceneIdx}-${run.stepIdx}`} className="pres-botrow pres-beat">
            <span className="pres-chapname">{pick(mod.title, lang)}</span>
            <span className="pres-botlinks">
              {isGesture ? (
                <button type="button" className="pres-showme" onClick={showMe}>
                  {tx("Muéstrame tú", "Show me")}
                </button>
              ) : null}
              {manualTopic ? (
                <button type="button" className="pres-manualbtn" onClick={openManual}>
                  <BookOpen aria-hidden />{tx("Más en el manual", "More in the manual")}
                </button>
              ) : null}
              <button type="button" className="pres-stay" onClick={openStay}>{tx("Quedarme aquí", "Stay here")}</button>
            </span>
          </div>
        </div>
      ) : null}

      {intro ? renderIntroWindow(introReady) : null}

      {run.stayOpen && !run.finished ? (
        /* La ventana de «Quedarme aquí»: dice qué pasa después ANTES de
           disolver el escenario — continuar donde quedó, sin reiniciar, y
           la dirección exacta de la ficha (que además abrirá el índice). */
        <div className="pres-stayveil">
          <div className="pres-staynote" role="dialog" aria-label={tx("Quedarme aquí", "Stay here")}>
            <p>
              {tx(
                "Si quieres continuar después, podrás seguir este módulo justo donde lo dejas, sin empezar de nuevo.",
                "If you'd like to continue later, you can pick this module up right where you left it, without starting over.",
              )}
            </p>
            <p>
              {tx(
                "Lo encuentras en Ajustes → Presentaciones: esta ficha quedará la primera de la lista.",
                "You'll find it under Settings → Presentations: this card will be the first in the list.",
              )}
            </p>
            <div className="pres-stayacts">
              <button type="button" className="pres-btn ghost" onClick={closeStay}>{tx("Seguir viendo", "Keep watching")}</button>
              <button type="button" className="pres-btn" onClick={stayHere}>{tx("Quedarme aquí", "Stay here")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {run.exitOpen && !run.finished ? (
        /* La ventana de confirmación de la ✕ (Oscar, 2026-11-14): nadie
           sale de la presentación por un toque equivocado. Dice qué pasa
           después — el módulo queda guardado donde va y su ficha abrirá el
           índice — y solo su «Salir» disuelve el escenario; «Seguir
           viendo» cierra la ventana y la lección continúa. */
        <div className="pres-stayveil">
          <div className="pres-staynote" role="dialog" aria-label={tx("Salir de la lección", "Leave the lesson")}>
            <p className="pres-note-title">
              {tx("¿Salir de la lección?", "Leave the lesson?")}
            </p>
            <p>
              {tx(
                "Podrás seguir justo desde aquí: el módulo queda guardado.",
                "You can pick up right from here: the module is saved.",
              )}
            </p>
            <p>
              {tx(
                "Su ficha será la primera en Ajustes → Presentaciones.",
                "Its card will be the first in Settings → Presentations.",
              )}
            </p>
            <div className="pres-stayacts">
              <button type="button" className="pres-btn ghost" onClick={closeExit}>{tx("Seguir viendo", "Keep watching")}</button>
              <button type="button" className="pres-btn" onClick={exitToIndex}>{tx("Salir", "Leave")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
