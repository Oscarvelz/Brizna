import { useEffect } from "react";

/**
 * 1.4.69: a split pane or the floating window can be narrower than the screen. Tailwind's sm/md/lg
 * breakpoints are re-declared in styles.css to also require "not inside a pane that is narrower than
 * the breakpoint", so the page inside gets the layout that fits the pane, not the whole screen.
 * This keeps the pane's classes in step with its width (no React render; ResizeObserver only).
 */
const STEPS: [string, number][] = [
  ["bz-lt-sm", 640],
  ["bz-lt-md", 768],
  ["bz-lt-lg", 1024],
];

export function syncPaneWidth(el: HTMLElement, width: number) {
  for (const [cls, min] of STEPS) {
    const on = width < min;
    if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
  }
}

export function usePaneWidthClasses(el: HTMLElement | null) {
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    syncPaneWidth(el, el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) syncPaneWidth(el, entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
}
