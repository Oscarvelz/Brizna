import { useNavigate } from "@tanstack/react-router";
import { BarChart3, CalendarDays, CircleDollarSign, Droplet, GripHorizontal, Home, Maximize2, Minus, Users, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PaneView, usePane } from "@/lib/pane-context";
import { syncPaneWidth, usePaneWidthClasses } from "@/lib/pane-width";
import { useI18n, useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readFloat, readTabletEnabled, tabletTabLabel, writeFloat, type FloatState, type TabletTab } from "@/lib/tablet-mode";

const TABS = [
  { to: "/", icon: Home, label: "nav.today" },
  { to: "/agenda", icon: CalendarDays, label: "nav.agenda" },
  { to: "/clientes", icon: Users, label: "nav.clients" },
  { to: "/cobros", icon: CircleDollarSign, label: "nav.payments" },
  { to: "/estadisticas", icon: BarChart3, label: "nav.stats" },
] as const satisfies readonly { to: TabletTab; icon: typeof Home; label: string }[];

const MIN_W = 320;
const MIN_H = 280;
const BUBBLE = 56;
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Kind = "move" | "bubble" | Edge;
const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** Live floating-window state shared by the shell buttons and the window itself. */
export function useFloatState(): [FloatState, (next: FloatState) => void] {
  const [state, setState] = useState<FloatState>(() => readFloat());
  useEffect(() => {
    const sync = () => setState(readFloat());
    window.addEventListener("ols-float", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ols-float", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [state, writeFloat];
}

function limits() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minW = Math.min(MIN_W, vw - 8);
  const minH = Math.min(MIN_H, vh - 8);
  return { vw, vh, minW, minH, maxW: vw - 8, maxH: vh - 8 };
}

function fit(s: FloatState): FloatState {
  const { vw, vh, minW, minH, maxW, maxH } = limits();
  const w = Math.min(Math.max(minW, s.w), maxW);
  const h = Math.min(Math.max(minH, s.h), maxH);
  return {
    ...s,
    w,
    h,
    x: Math.min(Math.max(-(w - 96), s.x), vw - 96),
    y: Math.min(Math.max(0, s.y), vh - 44),
    bx: Math.min(Math.max(4, s.bx), vw - BUBBLE - 4),
    by: Math.min(Math.max(4, s.by), vh - BUBBLE - 4),
  };
}

/** Resize from any edge or corner: the opposite edge stays put; size is clamped to min/max and the screen. */
function resized(a: FloatState, edge: Edge, dx: number, dy: number): FloatState {
  const { vw, vh, minW, minH, maxW, maxH } = limits();
  let { x, y, w, h } = a;
  if (edge.includes("e")) w = Math.min(Math.max(minW, a.w + dx), maxW, vw - 4 - a.x);
  if (edge.includes("s")) h = Math.min(Math.max(minH, a.h + dy), maxH, vh - 4 - a.y);
  if (edge.includes("w")) {
    const right = a.x + a.w;
    w = Math.min(Math.max(minW, a.w - dx), maxW, right - 4);
    x = right - w;
  }
  if (edge.startsWith("n")) {
    const bottom = a.y + a.h;
    h = Math.min(Math.max(minH, a.h - dy), maxH, bottom - 4);
    y = bottom - h;
  }
  return { ...a, x, y, w, h };
}

export function FloatHost() {
  const pane = usePane();
  const [state, save] = useFloatState();
  const win = useRef<HTMLDivElement | null>(null);
  const bubble = useRef<HTMLButtonElement | null>(null);
  const frame = useRef(0);
  const settle = useRef(0);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  usePaneWidthClasses(body);
  const [tabletOn, setTabletOn] = useState(true);
  const navigate = useNavigate();
  const { t } = useI18n();
  const tx = useTx();
  const gesture = useRef<{
    kind: Kind;
    px: number;
    py: number;
    start: FloatState;
    next: FloatState;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const sync = () => setTabletOn(readTabletEnabled());
    sync();
    window.addEventListener("ols-tablet", sync);
    const onResize = () => {
      const now = readFloat();
      if (now.open) writeFloat(fit(now));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("ols-tablet", sync);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (pane || !state.open || !tabletOn) return null;
  const s = state;
  const label = tabletTabLabel(s.path);
  const Icon = TABS.find((tab) => tab.to === s.path)?.icon ?? Home;

  // Drag and resize write straight to the window's style once per frame (no React render per move),
  // then the final size/place is saved once on release (persisted in localStorage).
  function paint(next: FloatState, kind: Kind) {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (kind === "bubble") {
        const el = bubble.current;
        if (el) el.style.transform = `translate3d(${next.bx - s.bx}px, ${next.by - s.by}px, 0)`;
        return;
      }
      const el = win.current;
      if (!el) return;
      if (kind === "move") {
        el.style.transform = `translate3d(${next.x - s.x}px, ${next.y - s.y}px, 0)`;
        return;
      }
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
      el.style.width = `${next.w}px`;
      el.style.height = `${next.h}px`;
    });
  }

  // 1.4.70: the page inside keeps its width while a resize is in flight (one relayout on a pause and on release,
  // not one per frame), and the gesture never re-renders React: classes are set on the element directly.
  function freeze() {
    const el = win.current;
    if (!el || !body) return;
    el.style.setProperty("--bz-freeze-w", `${body.clientWidth}px`);
  }
  function thaw() {
    const el = win.current;
    if (settle.current) {
      window.clearTimeout(settle.current);
      settle.current = 0;
    }
    if (!el) return;
    el.classList.remove("is-dragging", "is-moving", "is-resizing");
    el.style.removeProperty("--bz-freeze-w");
    if (body) syncPaneWidth(body, body.getBoundingClientRect().width);
  }

  function begin(kind: Kind, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already gone */
    }
    gesture.current = {
      kind,
      px: event.clientX,
      py: event.clientY,
      start: state,
      next: state,
      moved: false,
    };
    const el = win.current;
    if (kind !== "bubble" && el) {
      if (kind !== "move") freeze();
      el.classList.add("is-dragging", kind === "move" ? "is-moving" : "is-resizing");
    }
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.px;
    const dy = event.clientY - g.py;
    if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
    const a = g.start;
    let next: FloatState;
    if (g.kind === "move") next = fit({ ...a, x: a.x + dx, y: a.y + dy });
    else if (g.kind === "bubble") next = fit({ ...a, bx: a.bx + dx, by: a.by + dy });
    else next = resized(a, g.kind, dx, dy);
    g.next = next;
    paint(next, g.kind);
    if (g.kind !== "move" && g.kind !== "bubble") {
      // A real pause (420 ms without a move) while resizing: let the page take the new width once, then keep holding it.
      if (settle.current) window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        settle.current = 0;
        if (gesture.current && body) {
          const el = win.current;
          el?.style.removeProperty("--bz-freeze-w");
          syncPaneWidth(body, body.getBoundingClientRect().width);
          freeze();
        }
      }, 420);
    }
  }

  function end() {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    let next = g.next;
    if (g.kind === "bubble") {
      if (!g.moved) next = { ...state, min: false };
      else {
        // Snap the bubble to the nearest side, like Samsung's.
        const vw = window.innerWidth;
        next = { ...next, bx: next.bx + BUBBLE / 2 < vw / 2 ? 6 : vw - BUBBLE - 6 };
      }
    }
    // Clear the in-flight styles; React paints the saved values in the same frame.
    for (const el of [win.current, bubble.current]) if (el) el.style.transform = "";
    save(fit(next));
    // Let the saved size land first, then give the page its new width once (next frame).
    requestAnimationFrame(thaw);
  }

  const narrow = s.w < 380;

  return (
    <>
      <div
        ref={win}
        role="dialog"
        aria-label={tx(`Ventana flotante: ${label[0]}`, `Floating window: ${label[1]}`)}
        className={cn("bz-float print:hidden", s.min && "invisible pointer-events-none", narrow && "is-narrow")}
        style={{ left: s.x, top: s.y, width: s.w, height: s.h, opacity: s.alpha }}
        data-no-swipe
      >
        <div className="bz-float-frame">
          <div
            className="bz-float-bar"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              begin("move", e);
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <GripHorizontal className="bz-float-grip" aria-hidden />
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="bz-float-title">{tx(label[0], label[1])}</span>
            <button
              type="button"
              className="bz-float-btn"
              aria-label={tx("Transparencia", "Transparency")}
              title={tx("Transparencia", "Transparency")}
              onClick={() => save({ ...state, alpha: state.alpha > 0.9 ? 0.8 : state.alpha > 0.7 ? 0.6 : 1 })}
            >
              <Droplet className="size-4" fill={state.alpha < 1 ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="bz-float-btn"
              aria-label={tx("Plegar en burbuja", "Fold into a bubble")}
              title={tx("Plegar", "Fold")}
              onClick={() =>
                save(
                  fit({
                    ...state,
                    min: true,
                    bx: Math.min(state.x + state.w - BUBBLE, window.innerWidth - BUBBLE - 6),
                    by: state.y,
                  }),
                )
              }
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              className="bz-float-btn"
              aria-label={tx("Abrir en pantalla completa", "Open full screen")}
              title={tx("Pantalla completa", "Full screen")}
              onClick={() => {
                save({ ...state, open: false, min: false });
                void navigate({ to: state.path });
              }}
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              type="button"
              className="bz-float-btn"
              aria-label={tx("Cerrar ventana flotante", "Close floating window")}
              title={tx("Cerrar", "Close")}
              onClick={() => save({ ...state, open: false, min: false })}
            >
              <X className="size-4" />
            </button>
          </div>
          <div ref={setBody} className="bz-float-body">
            <FloatPane path={state.path} />
          </div>
          <div className="bz-float-tabs">
            <div className="bz-float-tabset">
              {TABS.map((tab) => {
                const on = tab.to === s.path;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.to}
                    type="button"
                    aria-label={t(tab.label)}
                    aria-pressed={on}
                    onClick={() => save({ ...state, path: tab.to })}
                    className={cn("bz-float-tab", on && "is-on")}
                  >
                    <TabIcon className="size-4" strokeWidth={on ? 2.4 : 1.8} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {EDGES.map((edge) => (
          <div
            key={edge}
            role="separator"
            aria-label={tx("Cambiar tamaño", "Resize")}
            className={cn("bz-float-h", `is-${edge}`)}
            onPointerDown={(e) => begin(edge, e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onDoubleClick={() => {
              // Double tap an edge: fill that direction (or back to the saved size).
              const { vw, vh } = limits();
              if (edge === "e" || edge === "w") save(fit({ ...state, x: 4, w: state.w >= vw - 12 ? Math.round(vw * 0.5) : vw - 8 }));
              else if (edge === "n" || edge === "s") save(fit({ ...state, y: 4, h: state.h >= vh - 12 ? Math.round(vh * 0.55) : vh - 8 }));
            }}
          >
            <span aria-hidden />
          </div>
        ))}
      </div>
      {s.min ? (
        <button
          ref={bubble}
          type="button"
          aria-label={tx(`Abrir ventana flotante: ${label[0]}`, `Open floating window: ${label[1]}`)}
          className="fixed z-[60] grid touch-none place-items-center rounded-full bg-primary text-primary-fg shadow-[0_10px_30px_-8px_rgba(0,0,0,0.5)] ring-4 ring-[color-mix(in_srgb,var(--color-sun)_55%,transparent)] print:hidden"
          style={{ left: s.bx, top: s.by, width: BUBBLE, height: BUBBLE }}
          onPointerDown={(e) => begin("bubble", e)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") save({ ...state, min: false });
          }}
          data-no-swipe
        >
          <Icon className="size-6" />
        </button>
      ) : null}
    </>
  );
}

/** The window's page. Memoized: moving or resizing the window never re-renders the page inside it. */
const FloatPane = memo(function FloatPane({ path }: { path: TabletTab }) {
  const onPath = useCallback((tab: TabletTab) => {
    const now = readFloat();
    if (tab !== now.path) writeFloat({ ...now, path: tab });
  }, []);
  return <PaneView id="float" path={path} onPath={onPath} />;
});
