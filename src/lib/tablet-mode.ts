const ENABLED = "ols-tablet-mode";
const LAYOUT = "ols-tablet-layout";
const FLOAT = "ols-float-window";

export const TABLET_TABS = ["/", "/agenda", "/clientes", "/cobros", "/estadisticas"] as const;
export type TabletTab = (typeof TABLET_TABS)[number];

export type TabletLayout = {
  /** 1 = one screen, 2 = two screens (side by side on a tablet or computer, top and bottom on a phone). */
  count: 1 | 2;
  slots: TabletTab[];
  flow: "side" | "stack";
  /** Phone only: two windows, one above the other. */
  phone?: boolean;
  /** Height share of the top window on a phone split. */
  ratio?: number;
  /** Width share of the left window on a tablet or computer split. */
  sideRatio?: number;
};

/** The floating window (third screen), like Samsung's pop-up view. */
export type FloatState = {
  open: boolean;
  /** Folded into a bubble. */
  min: boolean;
  path: TabletTab;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Bubble position. */
  bx: number;
  by: number;
  /** Window transparency, 0.45–1. */
  alpha: number;
};

const DEFAULT_SLOTS: TabletTab[] = ["/", "/agenda", "/clientes", "/cobros", "/estadisticas"];

export function readTabletEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ENABLED) !== "off";
}

export function writeTabletEnabled(on: boolean) {
  try {
    window.localStorage.setItem(ENABLED, on ? "on" : "off");
    window.dispatchEvent(new Event("ols-tablet"));
  } catch {
    /* ignore */
  }
}

const share = (value: unknown, fallback: number) =>
  typeof value === "number" && value >= 0.07 && value <= 0.93 ? value : fallback;

export function readTabletLayout(): TabletLayout {
  if (typeof window === "undefined") return { count: 1, slots: DEFAULT_SLOTS, flow: "side" };
  try {
    const raw = JSON.parse(window.localStorage.getItem(LAYOUT) || "") as Partial<Omit<TabletLayout, "count">> & { count?: number };
    // Older layouts with 3 or 4 windows become two.
    const count = typeof raw.count === "number" && raw.count >= 2 ? 2 : 1;
    const phone = raw.phone === true;
    const slots = Array.isArray(raw.slots)
      ? raw.slots.filter((item): item is TabletTab => (TABLET_TABS as readonly string[]).includes(item))
      : [];
    const filled = [...slots];
    for (const tab of DEFAULT_SLOTS) {
      if (!filled.includes(tab)) filled.push(tab);
    }
    return { count, slots: filled.slice(0, 5), flow: raw.flow === "stack" ? "stack" : "side", phone, ratio: share(raw.ratio, 0.5), sideRatio: share(raw.sideRatio, 0.5) };
  } catch {
    return { count: 1, slots: DEFAULT_SLOTS, flow: "side", phone: false, ratio: 0.5, sideRatio: 0.5 };
  }
}

export function writeTabletLayout(next: TabletLayout) {
  try {
    window.localStorage.setItem(LAYOUT, JSON.stringify(next));
    window.dispatchEvent(new Event("ols-tablet"));
  } catch {
    /* ignore */
  }
}

export function defaultFloat(): FloatState {
  const vw = typeof window === "undefined" ? 400 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const w = Math.round(Math.min(420, Math.max(280, vw * 0.62)));
  const h = Math.round(Math.min(620, Math.max(340, vh * 0.55)));
  return {
    open: false,
    min: false,
    path: "/agenda",
    x: Math.max(8, vw - w - 16),
    y: Math.max(8, Math.round(vh * 0.12)),
    w,
    h,
    bx: Math.max(8, vw - 72),
    by: Math.round(vh * 0.4),
    alpha: 1,
  };
}

export function readFloat(): FloatState {
  const base = defaultFloat();
  if (typeof window === "undefined") return base;
  try {
    const raw = JSON.parse(window.localStorage.getItem(FLOAT) || "") as Partial<FloatState>;
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const path = (TABLET_TABS as readonly string[]).includes(raw.path as string) ? (raw.path as TabletTab) : base.path;
    return {
      open: raw.open === true,
      min: raw.min === true,
      path,
      x: num(raw.x, base.x),
      y: num(raw.y, base.y),
      w: num(raw.w, base.w),
      h: num(raw.h, base.h),
      bx: num(raw.bx, base.bx),
      by: num(raw.by, base.by),
      alpha: Math.min(1, Math.max(0.45, num(raw.alpha, 1))),
    };
  } catch {
    return base;
  }
}

export function writeFloat(next: FloatState) {
  try {
    window.localStorage.setItem(FLOAT, JSON.stringify(next));
    window.dispatchEvent(new Event("ols-float"));
  } catch {
    /* ignore */
  }
}

export function tabletTabLabel(path: string) {
  if (path === "/") return ["Hoy", "Today"] as const;
  if (path === "/agenda") return ["Agenda", "Schedule"] as const;
  if (path === "/clientes") return ["Clientes", "Clients"] as const;
  if (path === "/cobros") return ["Cobros", "Payments"] as const;
  return ["Estudio", "Stats"] as const;
}
