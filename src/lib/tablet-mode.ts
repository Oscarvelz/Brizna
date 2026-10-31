const ENABLED = "ols-tablet-mode";
const LAYOUT = "ols-tablet-layout";

export const TABLET_TABS = ["/", "/agenda", "/clientes", "/cobros", "/estadisticas"] as const;
export type TabletTab = (typeof TABLET_TABS)[number];

export type TabletLayout = {
  count: 1 | 2 | 3 | 4;
  slots: TabletTab[];
  flow: "side" | "stack";
  /** Phone only: two windows, one above the other. */
  phone?: boolean;
  /** Height share of the top window when the split can be dragged. 0.28–0.72. */
  ratio?: number;
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

export function readTabletLayout(): TabletLayout {
  if (typeof window === "undefined") return { count: 1, slots: DEFAULT_SLOTS, flow: "side" };
  try {
    const raw = JSON.parse(window.localStorage.getItem(LAYOUT) || "") as Partial<TabletLayout>;
    const count = raw.count === 2 || raw.count === 3 || raw.count === 4 ? raw.count : 1;
    const flow = raw.flow === "stack" ? "stack" : "side";
    const ratio = typeof raw.ratio === "number" && raw.ratio >= 0.07 && raw.ratio <= 0.93 ? raw.ratio : 0.5;
    const phone = raw.phone === true;
    const slots = Array.isArray(raw.slots)
      ? raw.slots.filter((item): item is TabletTab => (TABLET_TABS as readonly string[]).includes(item))
      : [];
    const filled = [...slots];
    for (const tab of DEFAULT_SLOTS) {
      if (!filled.includes(tab)) filled.push(tab);
    }
    return { count, slots: filled.slice(0, 5), flow, phone, ratio };
  } catch {
    return { count: 1, slots: DEFAULT_SLOTS, flow: "side", phone: false, ratio: 0.5 };
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

export function tabletTabLabel(path: string) {
  if (path === "/") return ["Hoy", "Today"] as const;
  if (path === "/agenda") return ["Agenda", "Schedule"] as const;
  if (path === "/clientes") return ["Clientes", "Clients"] as const;
  if (path === "/cobros") return ["Cobros", "Payments"] as const;
  return ["Cifras", "Figures"] as const;
}
