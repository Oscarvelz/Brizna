/**
 * In-page jumps (a tile that scrolls to a section further down) get one history step,
 * so the phone's back button returns you to the spot you jumped from instead of leaving the screen.
 */
let pending: { y: number; path: string } | null = null;
let installed = false;

function pathNow(): string {
  return window.location.hash.split("?")[0] || "#/";
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", () => {
    const p = pending;
    if (!p) return;
    if ((window.history.state as { bzJump?: boolean } | null)?.bzJump) return;
    if (pathNow() !== p.path) return;
    pending = null;
    const y = p.y;
    // let the router settle, then glide back
    window.setTimeout(() => window.scrollTo({ top: y, behavior: "smooth" }), 30);
  });
}

/** Call right before scrolling to a section on the same screen. */
export function markJump() {
  if (typeof window === "undefined") return;
  install();
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  if (state.bzJump && pending && pending.path === pathNow()) return; // keep the first spot
  pending = { y: window.scrollY, path: pathNow() };
  window.history.pushState({ ...state, bzJump: true }, "", window.location.href);
}
