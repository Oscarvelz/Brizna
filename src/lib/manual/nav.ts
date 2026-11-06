/**
 * Hint ↔ manual ↔ app navigation. Every jump is a real history entry (push), so the phone's
 * back button, the browser back, Esc and the in-app arrow all walk the same path home.
 */

const FOCUS_KEY = "bz-focus";
const ORIGIN_KEY = "bz-manual-origin";

type Origin = { path: string; at: number };

let popAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    popAt = Date.now();
  });
}

/** True right after a back/forward step (system back, history.back, Esc). */
export function justPopped(ms = 1500): boolean {
  return Date.now() - popAt < ms;
}

/** Position of this entry in the app's own history (0 = the first screen opened). */
export function historyIndex(): number {
  if (typeof window === "undefined") return 0;
  const state = window.history.state as { __TSR_index?: number } | null;
  return typeof state?.__TSR_index === "number" ? state.__TSR_index : 0;
}

/** history.back() only stays inside Brizna when there is an earlier Brizna screen. */
export function canGoBack(): boolean {
  return historyIndex() > 0;
}

export function historyKey(): string {
  if (typeof window === "undefined") return "";
  const state = window.history.state as { __TSR_key?: string; key?: string; bzKey?: string } | null;
  const key = state?.__TSR_key ?? state?.key ?? state?.bzKey;
  if (key) return key;
  // 1.4.96: the very first screen (opened straight from a link or the home screen) has no router key yet, so its
  // scroll could not be remembered and back from a jump landed at the top. Give that entry a key of its own.
  try {
    const made = `bz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    window.history.replaceState({ ...(state ?? {}), bzKey: made }, "", window.location.href);
    return made;
  } catch {
    return "";
  }
}

/** Remember which screen opened the manual, for the "Volver a …" chip. */
export function rememberOrigin(path: string) {
  try {
    sessionStorage.setItem(ORIGIN_KEY, JSON.stringify({ path, at: Date.now() } satisfies Origin));
  } catch {
    /* private mode */
  }
}

export function readOrigin(): string | null {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Origin;
    return typeof o.path === "string" ? o.path : null;
  } catch {
    return null;
  }
}

/** Ask the next screen to open, scroll to and glow one thing: a topic's (?) or an element id. */
export type FocusWant = {
  topic?: string;
  id?: string;
  /** 1.4.96 link refs: exact element (CSS), what to light when it is not there, and the lines to show near it. */
  sel?: string;
  alt?: string;
  note?: string;
  missing?: string;
  /** Same-screen jump: give it a back step (markJump). Cross-screen: back returns to where the link was. */
  same?: boolean;
};

export function requestFocus(target: FocusWant & { path: string }) {
  try {
    sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ ...target, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

/** The pending focus for this screen, if any (taken once). */
export function takeFocus(path: string): FocusWant | null {
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    const f = JSON.parse(raw) as FocusWant & { path: string; at: number };
    if (Date.now() - f.at > 15000) {
      sessionStorage.removeItem(FOCUS_KEY);
      return null;
    }
    if (f.path !== path) return null;
    sessionStorage.removeItem(FOCUS_KEY);
    return f;
  } catch {
    return null;
  }
}

const SCREEN_NAMES: Record<string, [string, string]> = {
  "/": ["Hoy", "Today"],
  "/agenda": ["Agenda", "Schedule"],
  "/clientes": ["Clientes", "Clients"],
  "/cobros": ["Cobros", "Payments"],
  "/estadisticas": ["Estudio", "Stats"],
  "/ajustes": ["Ajustes", "Settings"],
  "/notas": ["Bloc", "Pad"],
  "/fichero": ["Fichero", "Cabinet"],
  "/nuevo": ["Nuevo cliente", "New client"],
  "/clima": ["Clima", "Weather"],
};

export function screenName(path: string | null, locale: string): string | null {
  if (!path) return null;
  const hit = SCREEN_NAMES[path] ?? (path.startsWith("/clientes/") ? (["la ficha", "the file"] as [string, string]) : null);
  if (!hit) return null;
  return locale === "en" ? hit[1] : hit[0];
}

/** Glow one element for a moment (lawn sweep), honoring reduced motion via CSS. */
export function glow(el: Element, cls = "bz-glow", ms = 2800) {
  el.classList.remove(cls);
  // restart the animation if it is already glowing
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

/** Scroll position of each history entry, by its key (filled by NavHost while you scroll). */
export const scrollMemory = new Map<string, number>();

/** Save this entry's scroll right now (before leaving it). */
export function rememberScroll() {
  const key = historyKey();
  if (key) scrollMemory.set(key, window.scrollY);
}
