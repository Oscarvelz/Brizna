import { useEffect, useState, type ReactNode } from "react";

/* 1.5.56 — the two-beat mount. A page switch used to mount the WHOLE incoming page in one
 * main-thread block before its slide-in could start; that block is the hitch the finger feels
 * at release (bench, 2026-11-09: one long task of 250–620 ms per switch, and the slide only
 * began when the block ended). The gesture (lib/page-swipe.ts) is untouched — the mount is
 * what changes: the first screen renders in the first beat and the rest lands a breath later
 * (~200 ms), while the slide-in — a compositor animation — is already running. Nothing is
 * removed, virtualized or windowed: every item still mounts, just after the page has arrived.
 * The delay is two frames plus 160 ms, so the page is whole right as the 240 ms slide settles;
 * everything deferred lives below the fold on a phone. */
export function useBeat2(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let inner = 0;
    let timer = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        timer = window.setTimeout(() => setOpen(true), 160);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return open;
}

/** Defers a whole block (sections below the first screen) to the second beat. */
export function Beat2({ children }: { children: ReactNode }) {
  return useBeat2() ? <>{children}</> : null;
}

/** First screen of a long list now, the whole list on the second beat. */
export function useFirstScreen<T>(items: readonly T[], first = 10): readonly T[] {
  const open = useBeat2();
  return open || items.length <= first ? items : items.slice(0, first);
}
