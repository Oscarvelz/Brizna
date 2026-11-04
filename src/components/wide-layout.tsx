import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { usePageWide, usePageWidth } from "@/components/app-shell";
import { cn } from "@/lib/utils";

/**
 * Large screens: the page's main list on the left and its tools in a side column.
 * Narrow (every phone, and a narrow split window): exactly the old order, side first, no wrapper.
 */
export function WideSplit({
  side,
  children,
  min = 880,
  sideFirst = true,
  className,
  sideClassName,
}: {
  side: ReactNode;
  children: ReactNode;
  min?: number;
  /** Narrow order: side content before the main content (true) or after it. */
  sideFirst?: boolean;
  className?: string;
  sideClassName?: string;
}) {
  const wide = usePageWide(min);
  if (!wide) return sideFirst ? <>{side}{children}</> : <>{children}{side}</>;
  return (
    <div className={cn("bz-split", className)}>
      <div className="bz-split-main">{children}</div>
      <aside className={cn("bz-split-side", sideClassName)}>{side}</aside>
    </div>
  );
}

/** Columns for a page column of this width (0 = keep the phone's single column). */
export function masonryCols(width: number, min = 880, three = 1500) {
  if (width < min) return 0;
  return width >= three ? 3 : 2;
}

const UNIT = 4;
/** Sections that read best across the whole page (wide summaries and charts). */
const MASONRY_FULL = "#cif-pulso, #cif-mes";

/**
 * Large screens: the box's children flow into `cols` steady columns (a section keeps its column,
 * so opening a fold only pushes what is below it in that column). Children keep their CSS order.
 * A child with data-masonry-full spans every column. cols = 0 turns it off (phones).
 */
export function useMasonry(ref: RefObject<HTMLElement | null>, cols: number, gap = 16, fillLast = false) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const kids = () => Array.from(box.children) as HTMLElement[];
    const clear = () => {
      box.classList.remove("bz-masonry");
      box.style.removeProperty("--bz-cols");
      for (const el of kids()) {
        el.style.removeProperty("grid-column");
        el.style.removeProperty("grid-row-end");
      }
    };
    if (cols < 2) {
      clear();
      return;
    }
    box.classList.add("bz-masonry");
    box.style.setProperty("--bz-cols", String(cols));
    const assign = () => {
      const list = kids()
        .map((el, i) => ({ el, i, o: Number.parseInt(getComputedStyle(el).order, 10) || 0 }))
        .sort((a, b) => a.o - b.o || a.i - b.i);
      let k = 0;
      let last: { el: HTMLElement; c: number } | null = null;
      for (const { el } of list) {
        if (el.hasAttribute("data-masonry-full") || el.matches(MASONRY_FULL)) {
          el.style.gridColumn = "1 / -1";
          last = null;
          continue;
        }
        if (getComputedStyle(el).display === "none") continue;
        // data-masonry-under="<id>": sits in the same column as that section, right below it (balances columns).
        const under = el.dataset.masonryUnder;
        const host = under ? box.querySelector<HTMLElement>(`#${CSS.escape(under)}`) : null;
        const hostCol = host && host.parentElement === box ? Number.parseInt(host.style.gridColumn, 10) : NaN;
        if (Number.isFinite(hostCol) && hostCol > 0) {
          el.style.gridColumn = String(hostCol);
          continue;
        }
        const c = (k % cols) + 1;
        el.style.gridColumn = String(c);
        last = { el, c };
        k += 1;
      }
      // An odd last card (3 cards in 2 columns) takes the rest of the row instead of leaving a hole.
      if (fillLast && last && k % cols !== 0) last.el.style.gridColumn = `${last.c} / -1`;
    };
    const size = () => {
      for (const el of kids()) {
        const h = el.getBoundingClientRect().height;
        const span = h > 0 ? Math.max(1, Math.ceil((h + gap) / UNIT)) : 1;
        const next = `span ${span}`;
        if (el.style.gridRowEnd !== next) el.style.gridRowEnd = next;
      }
    };
    // Write spans on the next frame: writing inside the observer callback trips its loop guard.
    // Rows are minmax(4px, auto) in CSS, so a section that grew before its span caught up pushes
    // its rows taller (a brief gap at worst) instead of drawing over the section below it.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        size();
      });
    });
    const watch = () => {
      ro.disconnect();
      for (const el of kids()) ro.observe(el);
    };
    assign();
    size();
    watch();
    const mo = new MutationObserver(() => {
      assign();
      size();
      watch();
    });
    mo.observe(box, { childList: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      clear();
    };
  }, [ref, cols, gap, fillLast]);
}

/** A box whose children become steady columns on large screens; phones get the box exactly as before. */
export function Masonry({ className, min = 880, three, children, gap }: { className?: string; min?: number; three?: number; children: ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cols = masonryCols(usePageWidth(), min, three);
  useMasonry(ref, cols, gap);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export { usePageWide, usePageWidth };
