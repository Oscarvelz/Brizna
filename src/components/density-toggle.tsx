import { LayoutGrid, LayoutList, Rows3, StretchHorizontal } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  pickDensity,
  readDensity,
  readQuadCols,
  subscribeDensity,
  type Density,
  type QuadCols,
  type ScreenKind,
} from "@/lib/density";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ScopeContext = createContext("hoy");

export function DensityScope({ scope, children }: { scope: string; children: ReactNode }) {
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

export function useDensityScope(): string {
  return useContext(ScopeContext);
}

const OPTIONS: { value: Density; key: MsgKey; icon: typeof Rows3 }[] = [
  { value: "full", key: "density.full", icon: StretchHorizontal },
  { value: "compact", key: "density.compact", icon: Rows3 },
  { value: "dense", key: "density.dense", icon: LayoutList },
  { value: "quad", key: "density.quad", icon: LayoutGrid },
];

export function useDensity(): Density {
  const scope = useDensityScope();
  const [density, setDensity] = useState<Density>(() => readDensity(scope));
  useEffect(() => {
    const read = () => setDensity(readDensity(scope));
    read();
    return subscribeDensity(read);
  }, [scope]);
  return density;
}

function readScreen(): ScreenKind {
  if (typeof window === "undefined") return "phone";
  const w = window.innerWidth;
  if (w < 640) return "phone";
  if (w < 1024) return "tablet";
  return "desk";
}

export function useScreen(): ScreenKind {
  const [screen, setScreen] = useState<ScreenKind>("phone");
  useEffect(() => {
    const read = () => setScreen(readScreen());
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return screen;
}

export function useQuadCols(): QuadCols {
  const scope = useDensityScope();
  const [cols, setCols] = useState<QuadCols>(() => readQuadCols(scope));
  useEffect(() => {
    const read = () => setCols(readQuadCols(scope));
    read();
    return subscribeDensity(read);
  }, [scope]);
  return cols;
}

/** Toggles whose row currently sits under the round + button. */
const under = new Set<object>();

/**
 * 1.4.62 (Oscar): the four segments stretch across the full width; no dead gap on the right.
 * When the page scrolls the row under the round + button, the button steps aside (fades out)
 * until the row moves on, so Malla is never covered.
 */
function useFabTuck(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const me = {};
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      const fab = [...document.querySelectorAll<HTMLElement>(".alive-fab")].find((f) => f.getBoundingClientRect().width > 0);
      let hit = false;
      if (el && fab) {
        const a = el.getBoundingClientRect();
        const r = fab.getBoundingClientRect();
        // use the button's full size, not its tucked (scaled) one, so it does not flicker at the edge
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, hw = fab.offsetWidth / 2 + 4, hh = fab.offsetHeight / 2 + 4;
        hit = a.bottom > cy - hh && a.top < cy + hh && a.right > cx - hw && a.left < cx + hw;
      }
      if (hit) under.add(me);
      else under.delete(me);
      document.documentElement.toggleAttribute("data-fab-tuck", under.size > 0);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    // layout settles after mount (folds open, the + button mounts later): re-check now and then
    const tick = window.setInterval(queue, 800);
    window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(tick);
      window.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
      under.delete(me);
      document.documentElement.toggleAttribute("data-fab-tuck", under.size > 0);
    };
  }, [ref]);
}

export function DensityToggle() {
  const box = useRef<HTMLDivElement | null>(null);
  useFabTuck(box);
  const scope = useDensityScope();
  const density = useDensity();
  const cols = useQuadCols();
  const { t } = useI18n();
  return (
    <div ref={box} data-spot="vistas" className={cn("flex w-full min-w-0 rounded-md bg-surface-2 p-0.5 ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))]")} role="group" aria-label={t("density.label")}>
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const on = density === opt.value;
        const label = opt.value === "quad" && on ? `${t(opt.key)} ×${cols}` : t(opt.key);
        return (
          <button
            key={opt.value}
            type="button"
            title={label}
            aria-pressed={on}
            onClick={() => pickDensity(scope, opt.value)}
            className={cn(
              "flex h-14 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-xs font-semibold text-muted",
              on && "bg-surface text-primary ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_38%,var(--color-border))]",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="max-w-full whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
