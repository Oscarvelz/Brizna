/**
 * "Ir allí" focus ring (1.4.61, Oscar). The ring is a class on the target itself, so it follows it
 * on scroll, resize and layout changes. After a gentle entrance it stays steady (no pulse) while you read.
 *
 * It goes away on: your first tap, a scroll you make (not the jump's own), phone back (closes the ring
 * only, you stay on the screen), a screen change, the fingerprint lock, or after 60 s.
 * If the target's own (?) bubble is open, the ring stays until that bubble closes.
 * Only one ring exists at a time.
 */
import { pushBackStep } from "@/lib/back-close";

const RING = "bz-ring";
const DOT = "bz-ring-dot";
export const RING_CAP_MS = 60_000;

type Live = { box: Element; dot: Element | null; stop: () => void };
let live: Live | null = null;

/** Remove the current ring, if any. */
export function clearRing() {
  const cur = live;
  live = null;
  if (cur) cur.stop();
}

/** True while a ring is on screen (for tests and other layers). */
export function ringOn(): boolean {
  return live !== null;
}

/** An open (?) bubble that belongs to the ringed target. */
function ownBubbleOpen(box: Element, dot: Element | null): boolean {
  const btns = Array.from(box.querySelectorAll<HTMLElement>('[data-topic] > button[aria-expanded="true"]'));
  if (dot) btns.push(...Array.from(dot.querySelectorAll<HTMLElement>('button[aria-expanded="true"]')));
  return btns.length > 0;
}

function inOwnHint(node: Node | null, box: Element, dot: Element | null): boolean {
  if (!node || !(node instanceof Element)) return false;
  const tip = node.closest('[role="tooltip"]');
  if (tip && ownBubbleOpen(box, dot)) return true;
  const hintBtn = node.closest("[data-topic]");
  return Boolean(hintBtn && (box.contains(hintBtn) || (dot && dot.contains(hintBtn))));
}

/**
 * Put the ring on `box` (and a soft mark on the (?) `dot`, when the jump was to a topic).
 * `settleMs`: the jump's own smooth scroll still running; scrolling in that window is not yours.
 */
export function showRing(box: Element, dot: Element | null = null, settleMs = 900) {
  clearRing();
  const started = Date.now();
  box.classList.add(RING);
  dot?.classList.add(DOT);

  let heldByBubble = false;
  let settleUntil = started + settleMs;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Screens that are still filling in (Estudio's columns) can push the target away after the jump:
  // for the first moments, bring it back into view. That scroll is ours, not the user's.
  const keepInView = () => {
    const r = box.getBoundingClientRect();
    const head = document.querySelector(".pod-header")?.getBoundingClientRect().bottom ?? 0;
    const out = r.bottom < head + 24 || r.top > window.innerHeight - 24;
    if (!out) return;
    settleUntil = Date.now() + 900;
    (box as HTMLElement).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: r.height > window.innerHeight - head ? "start" : "center" });
  };
  let backDone: (() => void) | null = null;
  const timers: number[] = [];

  const dismiss = () => {
    if (live && live.box === box) clearRing();
  };
  const userScroll = (e: Event) => {
    if (Date.now() < settleUntil) return;
    if (ownBubbleOpen(box, dot)) return;
    if (e.type === "keydown") {
      const k = (e as KeyboardEvent).key;
      if (!["PageDown", "PageUp", "ArrowDown", "ArrowUp", " ", "Home", "End"].includes(k)) return;
    }
    dismiss();
  };
  const onTap = (e: PointerEvent) => {
    // Opening (or using) the target's own (?) keeps the ring; it then waits for that bubble to close.
    if (inOwnHint(e.target as Node, box, dot)) return;
    if (ownBubbleOpen(box, dot)) return; // this tap closes the bubble; the watcher ends the ring after it
    dismiss();
  };
  const onLeave = () => dismiss();

  const watch = window.setInterval(() => {
    if (!box.isConnected) return dismiss();
    if (Date.now() - started < 2500) keepInView();
    const open = ownBubbleOpen(box, dot);
    if (open) heldByBubble = true;
    else if (heldByBubble) return dismiss();
    if (!open && Date.now() - started > RING_CAP_MS) dismiss();
  }, 250);

  document.addEventListener("pointerdown", onTap, true);
  window.addEventListener("wheel", userScroll, { passive: true });
  window.addEventListener("touchmove", userScroll, { passive: true });
  window.addEventListener("keydown", userScroll);
  window.addEventListener("hashchange", onLeave);
  window.addEventListener("bz-locked", onLeave);
  window.addEventListener("pagehide", onLeave);

  // Phone back: the first back only takes the ring away, like a sheet; you stay where you are.
  backDone = pushBackStep(() => {
    backDone = null;
    dismiss();
  });

  live = {
    box,
    dot,
    stop: () => {
      window.clearInterval(watch);
      for (const t of timers) window.clearTimeout(t);
      document.removeEventListener("pointerdown", onTap, true);
      window.removeEventListener("wheel", userScroll);
      window.removeEventListener("touchmove", userScroll);
      window.removeEventListener("keydown", userScroll);
      window.removeEventListener("hashchange", onLeave);
      window.removeEventListener("bz-locked", onLeave);
      window.removeEventListener("pagehide", onLeave);
      box.classList.remove(RING);
      dot?.classList.remove(DOT);
      const done = backDone;
      backDone = null;
      done?.();
    },
  };
}
