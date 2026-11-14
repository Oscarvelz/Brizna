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
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Gauge, Hand, List, Pause, Play, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n, useTx } from "@/lib/i18n";
import {
  WORDS_PER_MINUTE, dwellMs, moduleById, pick, stepMs, wordCount,
  type Module, type Scene, type Step,
} from "@/lib/presentation/guion";
import {
  clearStay, peekStay, readPresState, setLaunch, setStay, takeLaunch, writePresState,
  type PresState,
} from "@/lib/presentation/state";
import { enterStage, exitStage, stageOn, STAGE_EVENT } from "@/lib/presentation/stage";
import { resolveAnchor } from "@/lib/presentation/anchors";
import { STAGE_SEEDS, stageCtx } from "@/lib/presentation/stage-seeds";
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

/** Lanza un módulo: la intención viaja en sessionStorage y el conductor, ya
 * montado en la raíz, entra en el escenario (la app se remonta sobre el libro
 * de escenario vía StageHost). La escena de arranque, si viene, es el
 * PRINCIPIO del capítulo donde iba el alumno — el índice la calcula: las
 * escenas de un capítulo dependen del estado que las anteriores dejan, y el
 * capítulo es la unidad de sentada. */
export function launchPresentation(moduleId: string, sceneId?: string) {
  setLaunch({ moduleId, sceneId });
  void enterStage();
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
  skipped: string[];
  /** La pila de retorno de «Anterior»: las posiciones CON PIE que el alumno
   * ya ocupó, en orden. Retroceder es volver a una posición vivida — nunca
   * re-ejecutar la maquinaria (un `stage` re-sembraría el escenario a mitad
   * de módulo) ni caer en una pantalla que el compás no pisó. */
  back: { sceneIdx: number; stepIdx: number }[];
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
  interactiveTarget(el).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
};

const hasCaption = (
  step: Step,
): step is Extract<Step, { caption: unknown }> =>
  step.kind === "show" || step.kind === "ask" || step.kind === "do" || step.kind === "press" || step.kind === "type" || step.kind === "theatre" || step.kind === "swipe";

export function Presentacion() {
  const { locale } = useI18n();
  const tx = useTx();
  const lang = locale;
  const navigate = useNavigate();
  const [run, setRun] = useState<RunState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [shaking, setShaking] = useState(0);
  /** El conductor no remonta con el Outlet (vive junto a los anfitriones):
   * escucha el evento del escenario para repintarse y para recoger la
   * intención de lanzamiento cuando el escenario se enciende. */
  const [stageTick, setStageTick] = useState(0);
  const stagedRef = useRef<Set<string>>(new Set());
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
    if (!launch) return;
    const mod = moduleById(launch.moduleId);
    if (!mod || !mod.ready || !mod.scenes.length) return;
    const prefs = readPresState();
    const startIdx = launch.sceneId
      ? Math.max(0, mod.scenes.findIndex((s) => s.id === launch.sceneId))
      : 0;
    // El escenario amanece en Hoy, como la app misma — salvo que la primera
    // escena del arranque abra con su propio `go`.
    const firstGo = mod.scenes[startIdx]?.steps.find((s) => s.kind === "go");
    const startPath =
      firstGo && firstGo.kind === "go" ? resolveScreen(firstGo.screen) : "/";
    void navigate({ to: startPath as never });
    later(() => {
      setRun({
        mod, sceneIdx: startIdx, stepIdx: 0,
        mode: prefs.mode, speed: prefs.speed,
        playing: true, won: false, finished: false, chaptersOpen: false, speedOpen: false, stayOpen: false, skipped: [], back: [],
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
    const back = curStep && "caption" in curStep
      ? [...r.back, { sceneIdx: r.sceneIdx, stepIdx: r.stepIdx }]
      : r.back;
    if (r.stepIdx + 1 < (r.mod.scenes[r.sceneIdx]?.steps.length ?? 0)) {
      const next = { ...r, stepIdx: r.stepIdx + 1, won: false, back };
      setRun(next);
      saveProgress(next, false); // el progreso se guarda en cada avance
      return;
    }
    if (r.sceneIdx + 1 < r.mod.scenes.length) {
      const next = { ...r, sceneIdx: r.sceneIdx + 1, stepIdx: 0, won: false, back };
      setRun(next);
      saveProgress(next, false);
      return;
    }
    const done = { ...r, finished: true, won: false, back };
    setRun(done);
    saveProgress(done, true);
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
      saveProgress(done, true);
    }
  }, [clearTimers, saveProgress]);

  const exitToIndex = useCallback(() => {
    const r = runRef.current;
    if (r) saveProgress(r, r.finished);
    setStay({ path: "/ajustes", openPres: true });
    setRun(null);
    // Se navega ANTES de disolver: al remontar, el usuario ya está en
    // Ajustes y el pliegue lee el openPres y se abre solo.
    void navigate({ to: "/ajustes" as never });
    void exitStage();
  }, [navigate, saveProgress]);

  const stayHere = useCallback(() => {
    const r = runRef.current;
    if (r) saveProgress(r, r.finished);
    setStay({ path: window.location.pathname });
    setRun(null);
    // exitStage conserva la ruta: el escenario se disuelve y StageHost
    // remonta los datos reales bajo este mismo lugar.
    void exitStage();
  }, [saveProgress]);

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

  /* ------------------------------ el motor de pasos ------------------------------ */
  useEffect(() => {
    if (!run || !scene || !step || run.finished || run.chaptersOpen || run.speedOpen || run.stayOpen) return;
    const r = run;
    let cancelled = false;
    const speed = r.speed;
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
      if (step.kind === "stage") {
        const key = `${r.mod.id}:${r.sceneIdx}:${r.stepIdx}`;
        if (!stagedRef.current.has(key)) {
          stagedRef.current.add(key);
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
        later(() => { if (!cancelled) advance(); }, stepMs(step, lang) / speed);
        return;
      }
      if (step.kind === "go") {
        const target = resolveScreen(step.screen);
        // Un token sin resolver (`:lucia` sin cliente en el contexto) jamás
        // navega a la URL literal: la escena se salta con gracia (ley de
        // mantenimiento — nunca señalar a un fantasma).
        if (target.includes(":")) { skipScene(scene.id); return; }
        void navigate({ to: target as never });
        later(() => { if (!cancelled) advance(); }, stepMs(step, lang) / speed);
        return;
      }
      if (step.kind === "ref") { advance(); return; }
      const el = await waitAnchor(step.anchor);
      if (cancelled) return;
      if (!el) { skipScene(scene.id); return; } // ancla muerta: la escena se salta con gracia
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      later(() => { if (!cancelled) armRect(el); }, reduce ? 60 : 380);
      // La permanencia del paso: el pie + la lectura de la ventanita, si la hay.
      const capDwell = hasCaption(step)
        ? dwellMs(step.caption, lang) + (step.contexto ? Math.round((wordCount(pick(step.contexto, lang)) / WORDS_PER_MINUTE) * 60_000) : 0)
        : 0;

      if (step.kind === "tap") {
        later(() => { if (!cancelled) { tapEl(el); later(() => { if (!cancelled) advance(); }, 420 / speed); } }, 300 / speed);
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
        if (!input && !editable) { skipScene(scene.id); return; }
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
        if (r.mode === "interactive") {
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
          const beat = Math.max(650, capDwell * 0.55) / speed;
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
        if (r.mode === "interactive") {
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
          const beat = Math.max(650, capDwell * 0.55) / speed;
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
      if (r.mode === "interactive") {
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
        const beat = Math.max(650, capDwell * 0.55) / speed;
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
  }, [run?.sceneIdx, run?.stepIdx, run?.mode, run?.playing, run?.speed, run?.chaptersOpen, run?.speedOpen, run?.stayOpen, run?.finished]);

  /* Esc: una capa a la vez (velocidad → capítulos → salir al índice). */
  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const cur = runRef.current;
      if (!cur) return;
      if (cur.speedOpen) setRun({ ...cur, speedOpen: false });
      else if (cur.chaptersOpen) setRun({ ...cur, chaptersOpen: false });
      else exitToIndex();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, exitToIndex]);

  const stageActive = typeof window !== "undefined" && stageOn();
  if (!stageActive || !run) return null;

  const mod = run.mod;
  const chapter = scene ? mod.chapters.find((c) => c.id === scene.chapter) : null;
  const totalScenes = mod.scenes.length;
  const caption = step && hasCaption(step) ? pick(step.caption, lang) : null;
  const contexto = step && hasCaption(step) && step.contexto ? pick(step.contexto, lang) : null;
  const isGesture = step?.kind === "do" || step?.kind === "press" || step?.kind === "swipe";
  /** Hay atrás solo si la pila de retorno guarda alguna posición vivida. */
  const canGoBack = run.back.length > 0;
  const hole = rect ? {
    left: Math.max(4, rect.left - 10), top: Math.max(4, rect.top - 10),
    width: rect.width + 20, height: rect.height + 20,
  } : null;
  const cardBelow = hole ? (window.innerHeight - (hole.top + hole.height)) > 240 : true;
  // La tarjeta se centra sobre el foco y se abraza a los bordes — con SU
  // ancho real en cada ancho de pantalla (370 bajo 48rem; 442 desde ahí;
  // siempre 100vw−20 como techo). La fórmula anterior llevaba el 370 fijo
  // en la sangre: a 320px el tope derecho (100vw−380) salía negativo y la
  // tarjeta amanecía 60px fuera de la pantalla (banco, 2026-11-14).
  const vwNow = window.innerWidth;
  const cardW = Math.min(vwNow >= 768 ? 442 : 370, vwNow - 20);
  const cardStyle: React.CSSProperties = hole ? {
    left: Math.min(Math.max(10, hole.left + hole.width / 2 - cardW / 2), vwNow - cardW - 10),
    ...(cardBelow ? { top: hole.top + hole.height + 14 } : { bottom: window.innerHeight - hole.top + 14 }),
  } : { left: "50%", top: "38%", transform: "translateX(-50%)" };

  const jumpToScene = (idx: number) => {
    clearTimers();
    setRect(null);
    const next = { ...run, sceneIdx: idx, stepIdx: 0, won: false, chaptersOpen: false, speedOpen: false, finished: false, back: [] };
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
        window.setTimeout(() => el.dispatchEvent(mk("pointermove", x0 - (170 * i) / 9)), (420 * i) / 9 / run.speed);
      }
      window.setTimeout(() => el.dispatchEvent(mk("pointerup", x0 - 170)), 520 / run.speed);
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
  const shieldRects: React.CSSProperties[] = hole ? [
    { left: 0, top: 0, width: "100%", height: Math.max(0, hole.top) },
    { left: 0, top: hole.top + hole.height, width: "100%", bottom: 0 },
    { left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height },
    { left: hole.left + hole.width, top: hole.top, right: 0, height: hole.height },
  ] : [{ left: 0, top: 0, width: "100%", height: "100%" }];

  return (
    <div className="pres-root" role="dialog" aria-modal="false" aria-label={pick(mod.title, lang)} data-skipped={run.skipped.join(" ")}>
      {/* el escudo rodea el recorte: ningún toque desvía el guion, y el objetivo del
          compás recibe el suyo de verdad, a través del hueco */}
      {shieldRects.map((style, i) => (
        <div key={i} className="pres-shield" style={style} onPointerDown={onShieldTap} />
      ))}
      {hole && !run.finished ? (
        <div className={`pres-hole${run.won ? " is-won" : ""}`} style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} aria-hidden />
      ) : null}
      <div className="pres-thread" aria-hidden><i style={{ width: `${((run.sceneIdx + (run.finished ? 1 : 0)) / totalScenes) * 100}%` }} /></div>

      {step?.kind === "theatre" && !run.finished ? (
        <div className="pres-theatre" aria-hidden={false}>
          <WidgetTheatre piece={step.piece} />
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
                "Algunas escenas se saltaron: una parte de esta lección ya no coincide con tu Brizna. Quedan marcadas para revisión.",
                "Some scenes were skipped: part of this lesson no longer matches your Brizna. They are flagged for review.",
              )}
            </p>
          ) : null}
          <div className="pres-done-acts">
            <button type="button" className="pres-btn" onClick={exitToIndex}>{tx("Volver al índice", "Back to the index")}</button>
            <button type="button" className="pres-btn ghost" onClick={stayHere}>{tx("Quedarme aquí", "Stay here")}</button>
          </div>
        </div>
      ) : caption ? (
        <div key={shaking} className={`pres-card${shaking ? " is-shake" : ""}`} style={cardStyle} aria-live="polite">
          {contexto ? <div className="pres-contexto" role="note">{contexto}</div> : null}
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
            <button type="button" className="pres-ctl hd" aria-label={tx("Salir", "Exit")} onClick={exitToIndex}><X aria-hidden /></button>
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
          <p className={`pres-caption${step?.kind === "ask" ? " is-ask" : ""}${isGesture ? " is-do" : ""}`}>
            {isGesture ? <i className={`pres-dot${run.won ? " is-won" : ""}`} aria-hidden /> : null}
            {caption}
            {run.won ? <Check className="pres-won" aria-hidden /> : null}
          </p>
          <div className="pres-botrow">
            <span className="pres-chapname">{pick(mod.title, lang)}{chapter ? ` · ${pick(chapter.title, lang)}` : ""}</span>
            <span className="pres-botlinks">
              {isGesture ? (
                <button type="button" className="pres-showme" onClick={showMe}>
                  {tx("Muéstrame tú", "Show me")}
                </button>
              ) : null}
              <button type="button" className="pres-stay" onClick={openStay}>{tx("Quedarme aquí", "Stay here")}</button>
            </span>
          </div>
        </div>
      ) : null}

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
    </div>
  );
}
