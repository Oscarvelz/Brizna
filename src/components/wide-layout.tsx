import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { usePageWide, usePageWidth } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { SidePinContext } from "@/components/fold";

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
  sideLeft = false,
  pinSideFolds = false,
}: {
  side: ReactNode;
  children: ReactNode;
  min?: number;
  /** Narrow order: side content before the main content (true) or after it. */
  sideFirst?: boolean;
  className?: string;
  sideClassName?: string;
  /** 1.4.98 (Oscar, Cobros): on a wide screen the tools column sits on the LEFT, next to the rail; the list on the right. */
  sideLeft?: boolean;
  /** 1.4.99: folds in the wide tools column start pinned open (their own tablet pin; phone pins untouched). */
  pinSideFolds?: boolean;
}) {
  const wide = usePageWide(min);
  if (!wide) return sideFirst ? <>{side}{children}</> : <>{children}{side}</>;
  return (
    <div className={cn("bz-split", sideLeft && "is-side-left", className)}>
      <div className="bz-split-main">{children}</div>
      <aside className={cn("bz-split-side", sideClassName)}>{pinSideFolds ? <SidePinContext.Provider value>{side}</SidePinContext.Provider> : side}</aside>
    </div>
  );
}

/** 1.4.98: render only when WideSplit is two columns (wide) or only when it is one (narrow), at the same breakpoint. */
export function WideOnly({ min = 880, children }: { min?: number; children: ReactNode }) {
  return usePageWide(min) ? <>{children}</> : null;
}
export function NarrowOnly({ min = 880, children }: { min?: number; children: ReactNode }) {
  return usePageWide(min) ? null : <>{children}</>;
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
export function useMasonry(ref: RefObject<HTMLElement | null>, cols: number, gap = 16, fillLast = false, under?: Record<string, string>, beside?: Record<string, string>) {
  const underKey = under ? JSON.stringify(under) : "";
  const besideKey = beside ? JSON.stringify(beside) : "";
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
        el.style.removeProperty("grid-row-start");
      }
    };
    if (cols < 2) {
      clear();
      return;
    }
    box.classList.add("bz-masonry");
    box.style.setProperty("--bz-cols", String(cols));
    // Sections that sit right under another one: with dense packing a column choice alone could drop them into
    // an earlier hole, so size() also pins their first row to the line just below their host.
    let unders: { el: HTMLElement; host: HTMLElement }[] = [];
    // 1.5.26 (Oscar): a section can also sit BESIDE its host — same first row, next column over — to
    // fill a hole the rotation would otherwise leave (Esfuerzo next to Meta del mes in Estudio).
    let besides: { el: HTMLElement; host: HTMLElement }[] = [];
    const assign = () => {
      const list = kids()
        .map((el, i) => ({ el, i, o: Number.parseInt(getComputedStyle(el).order, 10) || 0 }))
        .sort((a, b) => a.o - b.o || a.i - b.i);
      let k = 0;
      let last: { el: HTMLElement; c: number } | null = null;
      const later: { el: HTMLElement; host: HTMLElement }[] = [];
      const laterBeside: { el: HTMLElement; host: HTMLElement }[] = [];
      for (const { el } of list) {
        if (el.hasAttribute("data-masonry-full") || el.matches(MASONRY_FULL)) {
          el.style.gridColumn = "1 / -1";
          last = null;
          continue;
        }
        if (getComputedStyle(el).display === "none") continue;
        // data-masonry-under="<id>": sits in the same column as that section, right below it (balances columns).
        // (1.4.98: or by id through the hook's `under` map, for sections that cannot carry the attribute)
        const underId: string | undefined = el.dataset.masonryUnder || (under && el.id ? under[el.id] : undefined);
        const host: HTMLElement | null = underId ? box.querySelector<HTMLElement>(`#${CSS.escape(underId)}`) : null;
        if (host && host.parentElement === box) {
          // The host is placed in this same pass (it may come later in the order): join its column afterwards.
          later.push({ el, host });
          continue;
        }
        // data-masonry-beside="<id>" (or the hook's `beside` map): the NEXT column over from that
        // section, on its same first row — fills the hole beside a short host instead of rotating on.
        const besideId: string | undefined = el.dataset.masonryBeside || (beside && el.id ? beside[el.id] : undefined);
        const besideHost: HTMLElement | null = besideId ? box.querySelector<HTMLElement>(`#${CSS.escape(besideId)}`) : null;
        if (besideHost && besideHost.parentElement === box) {
          laterBeside.push({ el, host: besideHost });
          continue;
        }
        const c = (k % cols) + 1;
        el.style.gridColumn = String(c);
        last = { el, c };
        k += 1;
      }
      unders = later;
      for (const { el, host } of later) {
        const hostCol = Number.parseInt(host.style.gridColumn, 10);
        el.style.gridColumn = Number.isFinite(hostCol) && hostCol > 0 ? String(hostCol) : "1";
      }
      besides = laterBeside;
      for (const { el, host } of laterBeside) {
        const hostCol = Number.parseInt(host.style.gridColumn, 10);
        const next = Number.isFinite(hostCol) && hostCol > 0 ? (hostCol >= cols ? 1 : hostCol + 1) : 1;
        el.style.gridColumn = String(next);
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
      pin(0);
    };
    // The host's first row is read back from the layout (rows are UNIT px, no row gap). Spans written this frame settle
    // on the next one (a stretched row moves the host), so look again a few frames on until it holds.
    let pinRaf = 0;
    const pin = (tries: number) => {
      if (!unders.length && !besides.length) return;
      const top = box.getBoundingClientRect().top;
      let moved = false;
      for (const { el, host } of unders) {
        const span = Number.parseInt((host.style.gridRowEnd || "").replace("span", ""), 10);
        if (!Number.isFinite(span) || host.getBoundingClientRect().height <= 0) { el.style.removeProperty("grid-row-start"); continue; }
        const start = String(Math.round((host.getBoundingClientRect().top - top) / UNIT) + 1 + span);
        if (el.style.gridRowStart !== start) { el.style.gridRowStart = start; moved = true; }
      }
      // Beside items start on the host's OWN first row (not below it).
      for (const { el, host } of besides) {
        if (host.getBoundingClientRect().height <= 0) { el.style.removeProperty("grid-row-start"); continue; }
        const start = String(Math.round((host.getBoundingClientRect().top - top) / UNIT) + 1);
        if (el.style.gridRowStart !== start) { el.style.gridRowStart = start; moved = true; }
      }
      if (tries < 6 && (moved || tries < 3)) {
        cancelAnimationFrame(pinRaf);
        pinRaf = requestAnimationFrame(() => pin(tries + 1));
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
      if (pinRaf) cancelAnimationFrame(pinRaf);
      ro.disconnect();
      mo.disconnect();
      clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, cols, gap, fillLast, underKey, besideKey]);
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
