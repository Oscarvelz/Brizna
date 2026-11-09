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
let pending: { dir: SwipeDir; at: number; off: number; bridge: boolean } | null = null;

/* 1.5.59 — the integrated sheet (Oscar, three rounds of screenshots of the same defect: the page
 * dragged aside, a black strip beside it, the next page arriving only later). The strip is empty
 * because the neighbor screen does not exist until the finger lets go and the router mounts it.
 * The bridge: every time a tab screen is LEFT by a committed swipe, a faithful clone of it is kept
 * in a small vault. On the next drag toward that tab, the clone is staged beside the live page and
 * follows the same offset, so the strip is the neighbor itself, moving as one sheet. At release
 * the clone glides the rest of the way on the compositor — it keeps moving even while the main
 * thread is busy mounting the real screen underneath — and a 60 ms crossfade hands over to the
 * real screen once it has painted. The follow, the lock, the thresholds and the exit are exactly
 * as they were; this only fills the strip and covers the mount. A tab never visited in this
 * session has no clone yet and enters the 1.5.58 way. */
const SNAP_MAX_AGE = 5 * 60_000;
const vault = new Map<string, { node: HTMLElement; at: number }>();
let bridge: { wrap: HTMLElement; mounted: boolean; glided: boolean; done: boolean } | null = null;

function routeKey(): string {
  const h = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return h || "hoy";
}

/** Keep a faithful, inert clone of the screen being left. Ids are stripped (the real screen's code
 * must never find the clone) and the drag's inline transforms are stripped (it must stage at rest). */
function snapshotPage(host: HTMLElement) {
  const page = host.querySelector<HTMLElement>(".alive-page");
  if (!page) return;
  const clone = page.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.querySelectorAll<HTMLElement>("[style]").forEach((n) => {
    n.style.removeProperty("translate");
    n.style.removeProperty("opacity");
    n.style.removeProperty("transition");
    n.style.removeProperty("will-change");
  });
  vault.set(routeKey(), { node: clone, at: Date.now() });
  while (vault.size > 4) {
    const oldest = vault.keys().next().value;
    if (oldest === undefined) break;
    vault.delete(oldest);
  }
}

/** Stage the neighbor's clone in a fixed slab clipped to the main column, ready to follow the drag. */
function stageSlab(host: HTMLElement, key: string): HTMLElement | null {
  const hit = vault.get(key);
  if (!hit || Date.now() - hit.at > SNAP_MAX_AGE) return null;
  const main = host.querySelector<HTMLElement>("main");
  if (!main) return null;
  const r = main.getBoundingClientRect();
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = `position:fixed;left:${r.left.toFixed(1)}px;top:${r.top.toFixed(1)}px;width:${r.width.toFixed(1)}px;height:${r.height.toFixed(1)}px;overflow:hidden;pointer-events:none;z-index:20;`;
  wrap.appendChild(hit.node);
  document.body.appendChild(wrap);
  return wrap;
}

function fadeSlabOut(wrap: HTMLElement) {
  const anim = wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, easing: "ease-out", fill: "forwards" });
  const kill = () => wrap.remove();
  if (anim.finished) anim.finished.then(kill, kill);
  else window.setTimeout(kill, 140);
}

function finishBridge() {
  if (!bridge || bridge.done || !bridge.mounted || !bridge.glided) return;
  bridge.done = true;
  const wrap = bridge.wrap;
  bridge = null;
  fadeSlabOut(wrap);
}

function dropBridge() {
  if (!bridge) return;
  bridge.done = true;
  bridge.wrap.remove();
  bridge = null;
}

/** The clone rides the rest of the sweep on the compositor while the real screen mounts beneath it. */
function glideSlab(wrap: HTMLElement) {
  bridge = { wrap, mounted: false, glided: false, done: false };
  const anim = wrap.animate(
    [{ translate: wrap.style.translate || "0px 0" }, { translate: "0px 0" }],
    { duration: 240, easing: EASE, fill: "forwards" },
  );
  const mark = () => { if (bridge && bridge.wrap === wrap) { bridge.glided = true; finishBridge(); } };
  if (anim.finished) anim.finished.then(mark, mark);
  else window.setTimeout(mark, 320);
  window.setTimeout(() => {
    if (bridge && bridge.wrap === wrap && !bridge.done) { bridge.done = true; bridge = null; fadeSlabOut(wrap); }
  }, 1000);
}

function clear(els: HTMLElement[]) {
  for (const el of els) {
    el.getAnimations?.().forEach((a) => { if ((a as CSSAnimation).animationName === undefined) a.cancel(); });
    el.style.translate = "";
    el.style.opacity = "";
    el.style.transition = "";
    el.style.willChange = "";
  }
}

/** The new screen (or the other Estudio view) slides in from the side the finger went to.
 * 1.5.58 (Oscar, with screenshots): the entrance used to start almost in place — 44 px out, at
 * 0.35 opacity — so at release the motion stopped, the new page faded in where it stood, and the
 * strip the finger had vacated sat empty for a beat: the "gap" after letting go. The entrance now
 * CONTINUES the sweep the finger began: the new screen starts at the distance the strip still had
 * to travel (page width minus the release offset the drag had already covered) and rides it in
 * nearly solid, like the second half of one sheet. Only this start geometry changed — the follow,
 * the lock, the thresholds and the exit are exactly as they were. */
export function playPendingSlide(host: HTMLElement | null) {
  const p = pending;
  if (!p || !host) return;
  pending = null;
  if (p.bridge) {
    // The real screen has painted under the bridge clone: signal it, and do not slide the real
    // screen too (the clone is doing the moving; a second slide would double the motion).
    if (bridge) { bridge.mounted = true; finishBridge(); }
    return;
  }
  if (Date.now() - p.at > 900 || reducedMotion()) return;
  const els = movers(host);
  const width = host.querySelector<HTMLElement>("main")?.clientWidth || window.innerWidth;
  const rest = Math.max(28, Math.min(width, Math.abs(p.dir * width + p.off)));
  const from = `${p.dir * rest}px 0`;
  for (const el of els) {
    el.animate([{ translate: from, opacity: 0.85 }, { translate: "0 0", opacity: 1 }], { duration: 240, easing: EASE });
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
  slab: { wrap: HTMLElement; dir: SwipeDir } | null;
  width: number;
  samples: { x: number; t: number }[];
  dx: number;
  frame: number;
};

/** Wires the swipe onto the shell column. commit() does the switch and says which kind it was (null = nothing to switch). */
export function installPageSwipe(
  host: HTMLElement,
  opts: { canStart: () => boolean; kind: () => SwipeKind | null; commit: (dir: SwipeDir) => void; neighbor?: (dir: SwipeDir) => string | null },
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
    if (g.slab) g.slab.wrap.style.translate = `${(off + g.slab.dir * g.width).toFixed(1)}px 0`;
  };

  /** The staged clone leaves the way it came when the gesture does not commit. */
  const springSlab = (slab: { wrap: HTMLElement; dir: SwipeDir } | null, width: number) => {
    if (!slab) return;
    slab.wrap.style.transition = `translate .22s ${EASE}`;
    slab.wrap.style.translate = `${slab.dir * width}px 0`;
    window.setTimeout(() => slab.wrap.remove(), 260);
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
    const slab = g.slab;
    const width = g.width;
    const was = g.axis === "x";
    end();
    if (was) suppressUntil = performance.now() + 400;
    if (els.length) springBack(els);
    if (was) springSlab(slab, width);
    else slab?.wrap.remove();
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
      const slab = g.axis === "x" ? g.slab : null;
      const width = g.width;
      end();
      if (els.length) springBack(els);
      springSlab(slab, width);
    }
    if (g) { // a second finger: pinch, never a swipe
      const els = g.axis === "x" ? g.els : [];
      const slab = g.axis === "x" ? g.slab : null;
      const width = g.width;
      end();
      if (els.length) springBack(els);
      springSlab(slab, width);
      return;
    }
    dropBridge(); // a fresh press supersedes a bridge still handing over
    if (!e.isPrimary || !opts.canStart()) return;
    if (!mouse && (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX)) return;
    if (swipeBlocked(host, e.target as Element, mouse)) return;
    const main = host.querySelector<HTMLElement>("main");
    g = { id: e.pointerId, mouse, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null, els: [], slab: null, width: main?.clientWidth || window.innerWidth, samples: [{ x: e.clientX, t: e.timeStamp }], dx: 0, frame: 0 };
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
        // 1.5.59: stage the neighbor's clone beside the page, if this drag is a tab switch and a
        // faithful clone of that tab is in the vault. From here it follows the same offset.
        if (opts.kind() === "route" && opts.neighbor) {
          const dir: SwipeDir = dx < 0 ? 1 : -1;
          const key = opts.neighbor(dir);
          if (key) {
            const wrap = stageSlab(host, key);
            if (wrap) g.slab = { wrap, dir };
          }
        }
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
    const slab = g.slab;
    const width = g.width;
    if (g.axis === "x") suppressUntil = performance.now() + 400;
    end();
    if (els.length) springBack(els);
    springSlab(slab, width);
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
    if (!flick && !far) { if (st.els.length) springBack(st.els); springSlab(st.slab, st.width); return; }
    const dir: SwipeDir = dx < 0 ? 1 : -1;
    const kind = opts.kind();
    const els = st.els;
    if (!kind) { if (els.length) springBack(els); springSlab(st.slab, st.width); return; }
    if (!els.length) { // reduced motion: switch at once
      opts.commit(dir);
      return;
    }
    // 1.5.59: leaving this tab by a committed swipe — keep its clone in the vault for the way back,
    // and keep the staged neighbor only if it matches the committed direction (a drag that reversed
    // past center staged the wrong side: drop that clone, the 1.5.58 entrance covers the switch).
    if (kind === "route") snapshotPage(host);
    const slab = st.slab && st.slab.dir === dir ? st.slab : null;
    if (st.slab && !slab) st.slab.wrap.remove();
    // The page leaves the way the finger went; a new screen is switched to at once, the other Estudio view after the exit.
    const now = parseFloat(els[0]!.style.translate) || 0;
    const out = `${(now - dir * Math.max(60, st.width * 0.18)).toFixed(1)}px 0`;
    for (const el of els) {
      el.style.transition = "translate .12s cubic-bezier(.4, 0, 1, 1), opacity .12s ease-in";
      el.style.translate = out;
      el.style.opacity = "0";
    }
    pending = { dir, at: Date.now(), off: now, bridge: !!slab };
    if (kind === "route") {
      if (slab) glideSlab(slab.wrap);
      opts.commit(dir);
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
    const slabWrap = g?.slab?.wrap;
    end();
    if (slabWrap) slabWrap.remove();
    dropBridge();
    clear(els);
    host.removeEventListener("pointerdown", onDown, true);
    host.removeEventListener("click", onClick, true);
    host.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("selectstart", onSelectStart, true);
  };
}
