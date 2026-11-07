// 1.4.98 launch splash hand-off (the splash itself is inline in spa/index.html so it paints before any script loads).
// The app says when its first real screen is drawn; the splash then fades over it, so there is never a blank frame
// and the app's own loading view never shows as a second splash.
import { useEffect, useState } from "react";

const w = (typeof window !== "undefined" ? window : undefined) as (Window & { __bzShellReady?: boolean; __bzSplashGone?: boolean }) | undefined;

/** The first real screen is on: tell the splash (after two frames, so it is really painted). Safe to call often. */
export function markShellReady() {
  if (!w || w.__bzShellReady) return;
  w.__bzShellReady = true;
  requestAnimationFrame(() => requestAnimationFrame(() => { (w as unknown as { __bzReadyAt?: number }).__bzReadyAt = performance.now(); w.dispatchEvent(new Event("brizna:shell-ready")); }));
}

export function splashGone(): boolean {
  return !w || w.__bzSplashGone !== false;
}

/** 1.5.03: run non-urgent work (a sync, a weather reading that restyles the page) only after the launch splash has
 *  faded out, so it never lands on the fade's frames. Runs after `delay` ms (and an idle moment) once it is gone. */
export function afterSplash(fn: () => void, delay = 0): () => void {
  let dead = false, t = 0;
  const run = () => {
    if (dead) return;
    t = window.setTimeout(() => {
      if (dead) return;
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => { if (!dead) fn(); }, { timeout: 400 }); else fn();
    }, delay);
  };
  if (!w || splashGone()) run();
  else w.addEventListener("brizna:splash-gone", run, { once: true });
  return () => { dead = true; window.clearTimeout(t); w?.removeEventListener("brizna:splash-gone", run); };
}

/** True once the launch splash has gone (or there was none). */
export function useSplashGone(): boolean {
  const [gone, setGone] = useState(splashGone);
  useEffect(() => {
    if (gone || !w) return;
    const on = () => setGone(true);
    w.addEventListener("brizna:splash-gone", on);
    if (splashGone()) setGone(true);
    return () => w.removeEventListener("brizna:splash-gone", on);
  }, [gone]);
  return gone;
}

/** Inside the app shell: ready once its main area has content and no loading placeholders, two frames in a row. */
export function watchShellReady() {
  if (!w || w.__bzShellReady) return;
  let calm = 0;
  const start = performance.now();
  const tick = () => {
    if (w.__bzShellReady) return;
    const main = document.querySelector("#root main");
    const busy = !main || !(main.textContent || "").trim() || !!main.querySelector(".animate-pulse, .bz-shim, [aria-busy='true']");
    calm = busy ? 0 : calm + 1;
    if (calm >= 2 || performance.now() - start > 8000) { markShellReady(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Before a reload that only refreshes the code or the account: the next start skips the splash. */
export function quietNextBoot() {
  try { sessionStorage.setItem("brizna-quiet-boot", "1"); } catch { /* ignore */ }
}
