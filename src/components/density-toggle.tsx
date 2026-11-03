import { LayoutGrid, LayoutList, Rows3, StretchHorizontal } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

/** fabGap: on phones, leave room on the right for the round + button so it never sits on the last option. */
export function DensityToggle({ fabGap = false }: { fabGap?: boolean } = {}) {
  const scope = useDensityScope();
  const density = useDensity();
  const cols = useQuadCols();
  const { t } = useI18n();
  return (
    <div className={cn("flex w-full min-w-0 rounded-md bg-surface-2 p-0.5 ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))]", fabGap && "max-md:w-[calc(100%-4.5rem)]")} role="group" aria-label={t("density.label")}>
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
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
