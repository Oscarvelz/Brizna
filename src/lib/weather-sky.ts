import { afterSplash } from "@/spa/splash-ready";

/** Current weather drives the animated sky behind the app (html[data-sky]). */
export type SkyKind = "despejado" | "nubes" | "lluvia" | "tormenta" | "niebla" | "nieve";

const KEY = "brizna.sky";

export function skyKind(code: number): SkyKind {
  if (code >= 95) return "tormenta";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "lluvia";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "nieve";
  if (code === 45 || code === 48) return "niebla";
  if (code >= 2 && code <= 3) return "nubes";
  return "despejado";
}

export function applySky(code: number) {
  const kind = skyKind(code);
  // 1.5.03: a new sky restyles the whole page and starts its layers; never during the launch splash's fade.
  if (typeof document !== "undefined" && document.documentElement.dataset.sky !== kind) {
    afterSplash(() => { document.documentElement.dataset.sky = kind; }, 120);
  }
  try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), kind })); } catch { /* ignore */ }
}

/** On boot: reuse the last reading if it's under 3 hours old. */
export function restoreSky() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const { at, kind } = JSON.parse(raw) as { at: number; kind: SkyKind };
    if (kind && Date.now() - at < 3 * 3600_000) document.documentElement.dataset.sky = kind;
  } catch { /* ignore */ }
}
