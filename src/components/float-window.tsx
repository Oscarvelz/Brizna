import { useNavigate } from "@tanstack/react-router";
import { BarChart3, CalendarDays, CircleDollarSign, Droplet, GripHorizontal, Home, Maximize2, Minus, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PaneView, usePane } from "@/lib/pane-context";
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

const MIN_W = 240;
const MIN_H = 260;
const BUBBLE = 56;

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

function fit(s: FloatState): FloatState {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(MIN_W, s.w), vw - 8);
  const h = Math.min(Math.max(MIN_H, s.h), vh - 8);
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

export function FloatHost() {
  const pane = usePane();
  const [state, save] = useFloatState();
  const [live, setLive] = useState<FloatState | null>(null);
  const [tabletOn, setTabletOn] = useState(true);
  const navigate = useNavigate();
  const { t } = useI18n();
  const tx = useTx();
  const gesture = useRef<{ kind: "move" | "br" | "bl" | "bubble"; px: number; py: number; start: FloatState; moved: boolean } | null>(null);

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
  const s = live ?? state;
  const label = tabletTabLabel(s.path);
  const Icon = TABS.find((tab) => tab.to === s.path)?.icon ?? Home;

  function begin(kind: "move" | "br" | "bl" | "bubble", event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind, px: event.clientX, py: event.clientY, start: state, moved: false };
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.px;
    const dy = event.clientY - g.py;
    if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
    const a = g.start;
    let next: FloatState = a;
    if (g.kind === "move") next = { ...a, x: a.x + dx, y: a.y + dy };
    else if (g.kind === "br") next = { ...a, w: a.w + dx, h: a.h + dy };
    else if (g.kind === "bl") {
      const w = Math.max(MIN_W, a.w - dx);
      next = { ...a, x: a.x + (a.w - w), w, h: a.h + dy };
    } else next = { ...a, bx: a.bx + dx, by: a.by + dy };
    setLive(fit(next));
  }

  function end() {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    let next = live ?? state;
    if (g.kind === "bubble") {
      if (!g.moved) next = { ...state, min: false };
      else {
        // Snap the bubble to the nearest side, like Samsung's.
        const vw = window.innerWidth;
        next = { ...next, bx: next.bx + BUBBLE / 2 < vw / 2 ? 6 : vw - BUBBLE - 6 };
      }
    }
    setLive(null);
    save(fit(next));
  }

  const dragging = live !== null;

  return (
    <>
      <div
        role="dialog"
        aria-label={tx(`Ventana flotante: ${label[0]}`, `Floating window: ${label[1]}`)}
        className={cn(
          "fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-border))] bg-bg shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] print:hidden",
          s.min && "invisible pointer-events-none",
        )}
        style={{ left: s.x, top: s.y, width: s.w, height: s.h, opacity: s.alpha }}
        data-no-swipe
      >
        <div
          className="flex h-10 shrink-0 cursor-grab touch-none select-none items-center gap-1 border-b border-border/70 bg-surface pl-2 pr-1 active:cursor-grabbing"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            begin("move", e);
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <GripHorizontal className="size-4 shrink-0 text-muted" />
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tx(label[0], label[1])}</span>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg"
            aria-label={tx("Transparencia", "Transparency")}
            title={tx("Transparencia", "Transparency")}
            onClick={() => save({ ...state, alpha: state.alpha > 0.9 ? 0.8 : state.alpha > 0.7 ? 0.6 : 1 })}
          >
            <Droplet className="size-4" fill={state.alpha < 1 ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg"
            aria-label={tx("Plegar en burbuja", "Fold into a bubble")}
            title={tx("Plegar", "Fold")}
            onClick={() => save(fit({ ...state, min: true, bx: Math.min(state.x + state.w - BUBBLE, window.innerWidth - BUBBLE - 6), by: state.y }))}
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg"
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
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg"
            aria-label={tx("Cerrar ventana flotante", "Close floating window")}
            title={tx("Cerrar", "Close")}
            onClick={() => save({ ...state, open: false, min: false })}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PaneView id="float" path={state.path} onPath={(tab) => tab !== readFloat().path && save({ ...readFloat(), path: tab })} />
          {dragging ? <div className="absolute inset-0" /> : null}
        </div>
        <div className="flex h-11 shrink-0 items-center justify-center border-t border-border/70 bg-surface px-7">
          <div className="grid h-8 w-full max-w-[15rem] grid-cols-5 rounded-full bg-surface-2 p-0.5">
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
                  className={cn("grid place-items-center rounded-full", on ? "bg-surface text-primary shadow-sm" : "text-muted")}
                >
                  <TabIcon className="size-4" strokeWidth={on ? 2.4 : 1.8} />
                </button>
              );
            })}
          </div>
        </div>
        {(["bl", "br"] as const).map((corner) => (
          <div
            key={corner}
            role="separator"
            aria-label={tx("Cambiar tamaño", "Resize")}
            className={cn(
              "absolute bottom-0 z-10 size-7 touch-none",
              corner === "br" ? "right-0 cursor-nwse-resize" : "left-0 cursor-nesw-resize",
            )}
            onPointerDown={(e) => begin(corner, e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <span
              className={cn(
                "absolute bottom-1.5 size-3 border-b-2 border-[color-mix(in_srgb,var(--color-primary)_70%,transparent)]",
                corner === "br" ? "right-1.5 rounded-br-md border-r-2" : "left-1.5 rounded-bl-md border-l-2",
              )}
            />
          </div>
        ))}
      </div>
      {s.min ? (
        <button
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
