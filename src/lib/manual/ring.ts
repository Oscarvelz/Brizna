/**
 * "Ver en la app" highlight (1.4.67, Oscar: "la cajita que se ilumina por unos segundos").
 *
 * A solid frame drawn over the target (its own layer, so no parent can clip it and no card shadow can
 * hide it). It copies the target's corner radius, follows it while the page settles, fades in (~200 ms),
 * glows once and fades out: about 2.8 s in all. No bounce, no looping pulse.
 * Reduced motion: a still outline that fades out at the end.
 *
 * It ends early on your first tap, a scroll you make (not the jump's own), a screen change or the
 * fingerprint lock. The topic's own (?) gets a soft mark for the same few seconds.
 * Only one highlight exists at a time.
 */

const DOT = "bz-ring-dot";
/** Total life of one highlight (fade in + glow + fade out). */
export const RING_MS = 2800;

type Live = { box: Element; stop: () => void };
let live: Live | null = null;

/** The element currently highlighted (tests and other layers). */
export function ringTarget(): Element | null {
  return live?.box ?? null;
}

/** Remove the current highlight, if any. */
export function clearRing() {
  const cur = live;
  live = null;
  if (cur) cur.stop();
}

/** True while a highlight is on screen. */
export function ringOn(): boolean {
  return live !== null;
}

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bottom edge of whatever sits fixed on top of the page (header), so the frame never paints over it. */
function topEdge(): number {
  const head = document.querySelector(".pod-header");
  if (!head) return 0;
  const cs = getComputedStyle(head);
  if (cs.position !== "sticky" && cs.position !== "fixed") return 0;
  return Math.max(0, head.getBoundingClientRect().bottom);
}

/**
 * Highlight `box` (and give the topic's (?) `dot` a soft mark).
 * `settleMs`: the jump's own smooth scroll still running; scrolling in that window is not yours.
 */
export function showRing(first: Element, dot: Element | null = null, settleMs = 900, refind?: () => Element | null) {
  let box = first;
  clearRing();
  const started = Date.now();
  const still = reduced();
  const life = RING_MS;
  let settleUntil = started + settleMs;

  const frame = document.createElement("div");
  frame.className = "bz-spot";
  frame.setAttribute("aria-hidden", "true");
  if (still) frame.classList.add("is-still");
  frame.style.setProperty("--bz-spot-ms", `${life}ms`);
  // a target inside the sticky header (Agenda's Semana/Mes/Todo) is drawn above it, unclipped
  const inHeader = Boolean(box.closest(".pod-header"));
  if (inHeader) frame.style.zIndex = "35";
  document.body.appendChild(frame);
  box.setAttribute("data-spot-on", "");
  dot?.classList.add(DOT);

  const cs = getComputedStyle(box);
  const pad = 3; // frame sits just outside the element's edge
  // square elements (a field and its label) get a soft corner instead of a hard box
  const radius = (v: string) => `${(parseFloat(v) || 0) > 0 ? (parseFloat(v) || 0) + pad : 10}px`;
  frame.style.borderTopLeftRadius = radius(cs.borderTopLeftRadius);
  frame.style.borderTopRightRadius = radius(cs.borderTopRightRadius);
  frame.style.borderBottomLeftRadius = radius(cs.borderBottomLeftRadius);
  frame.style.borderBottomRightRadius = radius(cs.borderBottomRightRadius);

  let raf = 0;
  const place = () => {
    const r = box.getBoundingClientRect();
    const top = r.top - pad;
    frame.style.transform = `translate(${Math.round(r.left - pad)}px, ${Math.round(top)}px)`;
    frame.style.width = `${Math.round(r.width + pad * 2)}px`;
    frame.style.height = `${Math.round(r.height + pad * 2)}px`;
    // never paint over the sticky header
    const cut = inHeader ? 0 : topEdge() - top;
    frame.style.clipPath = cut > 0 ? `inset(${Math.round(cut)}px -40px -40px -40px)` : "";
    raf = requestAnimationFrame(place);
  };
  place();

  // Screens that are still filling in (Estudio's columns) can push the target away after the jump:
  // for the first moment, bring it back into view. That scroll is ours, not the user's.
  const keepInView = () => {
    if (inHeader) return;
    const r = box.getBoundingClientRect();
    const head = topEdge();
    const out = r.bottom < head + 24 || r.top > window.innerHeight - 24;
    if (!out) return;
    settleUntil = Date.now() + 900;
    (box as HTMLElement).scrollIntoView({ behavior: still ? "auto" : "smooth", block: r.height > window.innerHeight - head ? "start" : "center" });
  };

  const dismiss = () => {
    if (live && live.stop === stop) clearRing();
  };
  const userScroll = (e: Event) => {
    if (Date.now() < settleUntil) return;
    if (e.type === "keydown") {
      const k = (e as KeyboardEvent).key;
      if (!["PageDown", "PageUp", "ArrowDown", "ArrowUp", " ", "Home", "End"].includes(k)) return;
    }
    dismiss();
  };
  const onTap = () => dismiss();
  const onLeave = () => dismiss();

  const watch = window.setInterval(() => {
    if (!box.isConnected) {
      // the screen re-drew the same block (data arrived): follow the new one
      const again = refind?.();
      if (!again) return dismiss();
      box.removeAttribute("data-spot-on");
      box = again;
      box.setAttribute("data-spot-on", "");
      if (live) live.box = box;
    }
    // only after our own glide has finished, so it is never restarted mid-way
    if (Date.now() - started < 2400 && Date.now() > settleUntil) keepInView();
  }, 200);
  const end = window.setTimeout(dismiss, life);

  document.addEventListener("pointerdown", onTap, true);
  window.addEventListener("wheel", userScroll, { passive: true });
  window.addEventListener("touchmove", userScroll, { passive: true });
  window.addEventListener("keydown", userScroll);
  window.addEventListener("hashchange", onLeave);
  window.addEventListener("bz-locked", onLeave);
  window.addEventListener("pagehide", onLeave);

  function stop() {
    cancelAnimationFrame(raf);
    window.clearInterval(watch);
    window.clearTimeout(end);
    document.removeEventListener("pointerdown", onTap, true);
    window.removeEventListener("wheel", userScroll);
    window.removeEventListener("touchmove", userScroll);
    window.removeEventListener("keydown", userScroll);
    window.removeEventListener("hashchange", onLeave);
    window.removeEventListener("bz-locked", onLeave);
    window.removeEventListener("pagehide", onLeave);
    box.removeAttribute("data-spot-on");
    dot?.classList.remove(DOT);
    // a quick fade if it ended early; at its natural end the animation already faded it
    const now = getComputedStyle(frame).opacity;
    frame.style.opacity = now;
    frame.style.animation = "none";
    if (parseFloat(now) > 0.02 && typeof frame.animate === "function") {
      frame.animate([{ opacity: now }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      window.setTimeout(() => frame.remove(), 230);
    } else frame.remove();
  }
  live = { box, stop };
}
