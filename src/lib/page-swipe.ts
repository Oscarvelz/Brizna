/* 1.5.06 (Oscar: "Añade esta misma fluidez de desplazamiento… sin dañar nada"): the screen-to-screen swipe, same feel as Faro 1.3.124.
 * - Starts anywhere on the screen: cards, charts (svg/canvas), lists, (?) buttons, the header.
 * - Keeps away from what has its own sideways drag: fields, sliders, the reorder handle, Cobros/Clientes swipe rows, Fichero
 *   cards, anything touch-action: none or [data-no-swipe]/[data-swipe-own], a sideways scroller that really overflows, the
 *   float window, and sheets/dialogs portaled out of the shell (native DOM containment, not React's portal bubbling).
 * - The two edge strips are Android's back gesture: a touch that starts there is left to the system.
 * - The page follows the finger live (translate only, one compositor layer per section, no React state while dragging);
 *   it switches past a distance or on a short quick flick (velocity of the last ~90 ms), else springs back.
 * - Vertical scroll is untouched: the host is touch-action: pan-y pinch-zoom, the axis locks after 10 px
 *   (sideways only when |dx| >= 1.3 |dy|, about 37°), and a vertical lock, a scroll (pointercancel) or a second finger ends it.
 * - Reduced motion: no following and no slides; the release switches at once.
 * 1.5.07 (Oscar: "haz que funcione con el ratón"): a mouse drag (primary button only) swipes the same way: same follow,
 *   thresholds, flick and exceptions, plus: no edge strips (no back gesture on a mouse), text that is selectable on purpose
 *   (user-select: text, the Bloc editor) keeps selecting, the native image/link drag ghost never starts, nothing is selected
 *   once the drag locks sideways (any selection made by those first px is cleared, user-select off until release), the
 *   pointer is captured so releasing outside the window still ends it (lost capture / blur = spring back), and the click of
 *   the release is swallowed (0.4 s) like a touch. A vertical lock ends it and leaves the normal mouse text selection alone.
 * Sections holding position: fixed elements (FABs, scrims) are not moved
 * themselves (a moved parent would drag them along); their other children are. */

export type SwipeDir = 1 | -1; // 1 = next (finger to the left), -1 = previous
export type SwipeKind = "route" | "flip";

const NO_SWIPE =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='slider'], [data-no-swipe], [data-swipe-own], .bz-swipe, [data-drag-handle], .bz-float, .leaflet-container";
const FIXED = ".fixed, .bz-float, .wx, .wx-flies, [data-fixed]";
export const EDGE_PX = 24;
export const LOCK_PX = 10;
export const LOCK_RATIO = 1.3;
export const FLICK_V = 0.45; // px/ms
export const FLICK_MIN = 18; // px
export const LONG_PRESS_MS = 450;
export function commitDistance(width: number) {
  return Math.round(Math.min(140, Math.max(64, width * 0.2)));
}

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function swipeBlocked(host: HTMLElement, target: Element | null, mouse = false): boolean {
  if (target instanceof Text) target = target.parentElement;
  if (!target || !host.contains(target)) return true;
  if (target.closest(NO_SWIPE)) return true;
  if (mouse && target.closest("[data-note-editor], [data-selectable], option, label[for]")) return true;
  for (let el: Element | null = target; el && el !== host; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (mouse && (cs.userSelect === "text" || cs.getPropertyValue("-webkit-user-select") === "text")) return true;
    if (cs.touchAction === "none") return true;
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/** The parts of the page that move: each section of .alive-page, going one level deeper around fixed elements. */
function movers(host: HTMLElement): HTMLElement[] {
  const page = host.querySelector<HTMLElement>(".alive-page");
  if (!page) return [];
  const out: HTMLElement[] = [];
  const walk = (box: Element, depth: number) => {
    for (const child of Array.from(box.children)) {
      if (!(child instanceof HTMLElement) || child.matches(FIXED)) continue;
      if (child.querySelector(FIXED)) {
        if (depth < 4) walk(child, depth + 1);
        continue;
      }
      if (child.hidden || child.offsetParent === null) continue;
      out.push(child);
    }
  };
  walk(page, 0);
  return out;
}

const EASE = "cubic-bezier(.22, 1, .36, 1)";
let pending: { dir: SwipeDir; at: number } | null = null;

function clear(els: HTMLElement[]) {
  for (const el of els) {
    el.getAnimations?.().forEach((a) => { if ((a as CSSAnimation).animationName === undefined) a.cancel(); });
    el.style.translate = "";
    el.style.opacity = "";
    el.style.transition = "";
    el.style.willChange = "";
  }
}

/** The new screen (or the other Estudio view) slides in from the side the finger went to. */
export function playPendingSlide(host: HTMLElement | null) {
  const p = pending;
  if (!p || !host) return;
  pending = null;
  if (Date.now() - p.at > 900 || reducedMotion()) return;
  const els = movers(host);
  const from = `${p.dir * 44}px 0`;
  for (const el of els) {
    // 1.5.13: translate only, no opacity. Fading every section from .35 forced a full-page repaint of the
    // biggest screens (Estudio) on each frame the slide produced; a pure translate is composited instead.
    el.animate([{ translate: from }, { translate: "0 0" }], { duration: 240, easing: EASE });
  }
}

type Gesture = {
  id: number;
  mouse: boolean;
  x: number;
  y: number;
  t: number;
  axis: "x" | "y" | null;
  els: HTMLElement[];
  width: number;
  samples: { x: number; t: number }[];
  dx: number;
  frame: number;
};

/** Wires the swipe onto the shell column. commit() does the switch and says which kind it was (null = nothing to switch). */
export function installPageSwipe(
  host: HTMLElement,
  opts: { canStart: () => boolean; kind: () => SwipeKind | null; commit: (dir: SwipeDir) => void },
): () => void {
  let g: Gesture | null = null;
  let suppressUntil = 0;

  const paint = () => {
    if (!g) return;
    g.frame = 0;
    const L = Math.max(160, g.width * 0.6);
    const off = Math.sign(g.dx) * L * Math.tanh(Math.abs(g.dx) / L);
    const fade = String(1 - Math.min(0.2, Math.abs(off) / (g.width * 2.4)));
    const tr = `${off.toFixed(1)}px 0`;
    for (const el of g.els) {
      el.style.translate = tr;
      el.style.opacity = fade;
    }
  };

  const springBack = (els: HTMLElement[]) => {
    for (const el of els) {
      el.style.transition = `translate .22s ${EASE}, opacity .22s ease`;
      el.style.translate = "0px 0";
      el.style.opacity = "1";
    }
    window.setTimeout(() => clear(els), 260);
  };

  const end = () => {
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onCancel, true);
    host.removeEventListener("lostpointercapture", onCancel, true);
    window.removeEventListener("blur", onBlur);
    if (g?.mouse && g.axis === "x") {
      host.style.userSelect = "";
      host.style.cursor = "";
      try { if (host.hasPointerCapture(g.id)) host.releasePointerCapture(g.id); } catch { /* already gone */ }
    }
    if (g?.frame) cancelAnimationFrame(g.frame);
    g = null;
  };

  const onBlur = () => {
    if (!g) return;
    const els = g.els;
    const was = g.axis === "x";
    end();
    if (was) suppressUntil = performance.now() + 400;
    if (els.length) springBack(els);
  };

  // A mouse press on an image or a link would start the browser's own drag (a ghost) a few px in: never while ours may run.
  const onDragStart = (e: DragEvent) => {
    if (g?.mouse) e.preventDefault();
  };
  // Once the drag is sideways, no text gets selected (the class sets user-select: none; this catches what starts anyway).
  const onSelectStart = (e: Event) => {
    if (g?.mouse && g.axis === "x") e.preventDefault();
  };

  const onDown = (e: PointerEvent) => {
    const mouse = e.pointerType === "mouse";
    if (mouse && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return; // right/middle/modified: not a swipe
    if (g && (mouse || g.mouse)) { // a mouse has one pointer: a new press means the last release was missed; drop it, start fresh
      const els = g.axis === "x" ? g.els : [];
      end();
      if (els.length) springBack(els);
    }
    if (g) { // a second finger: pinch, never a swipe
      const els = g.axis === "x" ? g.els : [];
      end();
      if (els.length) springBack(els);
      return;
    }
    if (!e.isPrimary || !opts.canStart()) return;
    if (!mouse && (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX)) return;
    if (swipeBlocked(host, e.target as Element, mouse)) return;
    const main = host.querySelector<HTMLElement>("main");
    g = { id: e.pointerId, mouse, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null, els: [], width: main?.clientWidth || window.innerWidth, samples: [{ x: e.clientX, t: e.timeStamp }], dx: 0, frame: 0 };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    if (mouse) window.addEventListener("blur", onBlur);
  };

  const onMove = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    if (g.mouse && (e.buttons & 1) === 0) { onCancel(e); return; } // the button was let go where we could not see it
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      // A long press first is text selection or a menu, not a swipe.
      if (e.timeStamp - g.t > LONG_PRESS_MS || Math.abs(dx) < Math.abs(dy) * LOCK_RATIO || !opts.kind()) { end(); return; }
      g.axis = "x";
      if (!reducedMotion()) {
        g.els = movers(host);
        for (const el of g.els) { el.style.transition = "none"; el.style.willChange = "translate, opacity"; }
      }
      if (g.mouse) {
        // After movers() read the layout: an inline style on the host only (a class on <html> re-matched every rule and cost
        // a 30-95 ms frame right at the lock, which also ate the flick).
        host.style.userSelect = "none";
        host.style.cursor = "grabbing";
        window.getSelection()?.removeAllRanges();
        try { host.setPointerCapture(g.id); host.addEventListener("lostpointercapture", onCancel, true); } catch { /* pointer gone */ }
      }
    }
    if (g.mouse) e.preventDefault();
    g.dx = dx;
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    while (g.samples.length > 2 && e.timeStamp - g.samples[1]!.t > 90) g.samples.shift();
    if (g.els.length && !g.frame) g.frame = requestAnimationFrame(paint);
  };

  const onCancel = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const els = g.els;
    if (g.axis === "x") suppressUntil = performance.now() + 400;
    end();
    if (els.length) springBack(els);
  };

  const onUp = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const st = g;
    end();
    if (st.axis !== "x") return;
    suppressUntil = performance.now() + 400; // the release of a sideways drag is never a tap on what was under the finger
    const dx = e.clientX - st.x;
    // Speed over the last ~90 ms of movement; a finger that stopped before lifting (>80 ms still) is no flick.
    const first = st.samples[0]!;
    const last = st.samples[st.samples.length - 1]!;
    const v = e.timeStamp - last.t > 80 ? 0 : (last.x - first.x) / Math.max(8, last.t - first.t);
    const flick = Math.abs(v) >= FLICK_V && Math.abs(dx) >= FLICK_MIN && Math.sign(v) === Math.sign(dx);
    const far = Math.abs(dx) >= commitDistance(st.width) && !(Math.sign(v) === -Math.sign(dx) && Math.abs(v) > 0.3);
    if (!flick && !far) { if (st.els.length) springBack(st.els); return; }
    const dir: SwipeDir = dx < 0 ? 1 : -1;
    const kind = opts.kind();
    const els = st.els;
    if (!kind) { if (els.length) springBack(els); return; }
    if (!els.length) { // reduced motion: switch at once
      opts.commit(dir);
      return;
    }
    // The page leaves the way the finger went; the switch (route or Estudio view) lands once the exit has played.
    const now = parseFloat(els[0]!.style.translate) || 0;
    const out = `${(now - dir * Math.max(60, st.width * 0.18)).toFixed(1)}px 0`;
    for (const el of els) {
      el.style.transition = "translate .12s cubic-bezier(.4, 0, 1, 1), opacity .12s ease-in";
      el.style.translate = out;
      el.style.opacity = "0";
    }
    pending = { dir, at: Date.now() };
    if (kind === "route") {
      // 1.5.13 (Oscar: a "pegón" froze the page mid-slide as it settled into Estudio): the switch waits for
      // the exit to play, exactly as the Estudio flip below already did. Committing inside the release task
      // put the new screen's mount burst (render + database readings, one long task) ahead of the next
      // frame, so the screen froze on the last follow frame — page displaced, ambient strip showing — and
      // the entrance slide could only start once the burst ended. Now the exit paints first, the burst runs
      // against a clean screen, and the entrance (created in the shell's layout effect, its clock starting
      // at the first frame produced after the mount) plays whole.
      window.setTimeout(() => {
        pending = { dir, at: Date.now() };
        opts.commit(dir);
      }, 120);
      // The old screen is unmounted by the switch; if it stays (something kept it), it comes back.
      window.setTimeout(() => {
        const left = els.filter((el) => el.isConnected);
        if (left.length && host.isConnected) { pending = null; springBack(left); }
      }, 900);
      return;
    }
    window.setTimeout(() => {
      opts.commit(dir);
      requestAnimationFrame(() => requestAnimationFrame(() => { clear(els); playPendingSlide(host); }));
    }, 120);
  };

  const onClick = (e: MouseEvent) => {
    if (performance.now() < suppressUntil) {
      suppressUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  host.addEventListener("pointerdown", onDown, true);
  host.addEventListener("click", onClick, true);
  host.addEventListener("dragstart", onDragStart, true);
  document.addEventListener("selectstart", onSelectStart, true);
  return () => {
    const els = g?.els ?? [];
    end();
    clear(els);
    host.removeEventListener("pointerdown", onDown, true);
    host.removeEventListener("click", onClick, true);
    host.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("selectstart", onSelectStart, true);
  };
}
