export type Density = "full" | "compact" | "dense" | "quad";
export type QuadCols = 2 | 3 | 4;
export type ScreenKind = "phone" | "tablet" | "desk";

const EVENT = "ols-density";

function densityKey(scope: string): string {
  return `ols-density:${scope}`;
}

function colsKey(scope: string): string {
  return `ols-density-cols:${scope}`;
}

function legacyDensity(scope: string): string | null {
  if (typeof window === "undefined") return null;
  if (scope === "fichero") {
    const own = window.localStorage.getItem("ols-fichero-density");
    if (own) return own;
  }
  return window.localStorage.getItem("ols-density");
}

function legacyCols(scope: string): string | null {
  if (typeof window === "undefined") return null;
  if (scope === "fichero") {
    const own = window.localStorage.getItem("ols-fichero-cols");
    if (own) return own;
  }
  return window.localStorage.getItem("ols-density-cols");
}

export function readDensity(scope: string): Density {
  if (typeof window === "undefined") return "full";
  const v = window.localStorage.getItem(densityKey(scope)) ?? legacyDensity(scope);
  return v === "compact" || v === "dense" || v === "quad" ? v : "full";
}

export function readQuadCols(scope: string): QuadCols {
  if (typeof window === "undefined") return 2;
  const raw = window.localStorage.getItem(colsKey(scope)) ?? legacyCols(scope);
  if (raw === "4") return 4;
  if (raw === "3") return 3;
  return 2;
}

function ping(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function writeDensity(scope: string, next: Density): void {
  try {
    window.localStorage.setItem(densityKey(scope), next);
  } catch {
    /* ignore */
  }
  ping();
}

/** Entering Malla starts at 2 columns. Each extra tap goes 2, then 3, then 4, then back to 2.
 *  1.5.25 (Oscar): on tablet and desk there IS no 3 or 4 — «solo deja el grid normal» there; the
 *  cycle lives on the phone only, where the extra columns earn their keep. */
export function pickDensity(scope: string, next: Density, screen: ScreenKind = "phone"): void {
  if (next !== "quad") {
    writeDensity(scope, next);
    return;
  }
  const order: QuadCols[] = [2, 3, 4];
  if (readDensity(scope) !== "quad") {
    try {
      window.localStorage.setItem(densityKey(scope), "quad");
      window.localStorage.setItem(colsKey(scope), "2");
    } catch {
      /* ignore */
    }
    ping();
    return;
  }
  if (screen !== "phone") {
    try {
      window.localStorage.setItem(colsKey(scope), "2");
    } catch {
      /* ignore */
    }
    ping();
    return;
  }
  const cur = readQuadCols(scope);
  const i = Math.max(0, order.indexOf(cur));
  const nextCols = order[(i + 1) % order.length];
  try {
    window.localStorage.setItem(colsKey(scope), String(nextCols));
  } catch {
    /* ignore */
  }
  ping();
}

export function viewGrid(density: Density, cols: QuadCols, gap = "gap-2"): string {
  // bz-vg-*: large screens (tablet.css container queries) give the list more columns; phones ignore it.
  if (density !== "quad") return `bz-vg bz-vg-${density} grid min-w-0 [&>*]:min-w-0 ${gap}`;
  const columns = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return `bz-vg bz-vg-quad grid min-w-0 items-stretch gap-1.5 [&>*]:min-w-0 ${columns}`;
}

/** Fixed tile height so a Malla row lines up. */
export function meshFrame(cols: QuadCols): string {
  if (cols === 4) return "h-[6.5rem] w-full overflow-hidden p-2";
  if (cols === 3) return "h-[6.75rem] w-full overflow-hidden p-2";
  return "h-[9.25rem] w-full overflow-hidden p-2";
}

export function subscribeDensity(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
