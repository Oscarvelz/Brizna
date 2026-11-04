import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { canGoBack, historyKey, scrollMemory, takeFocus } from "@/lib/manual/nav";
import { clearRing, showRing } from "@/lib/manual/ring";

const OPEN_LAYER =
  '.bz-hint, [role="dialog"], [role="alertdialog"], [role="menu"], [data-mention-open], [data-radix-popper-content-wrapper]';

function pathOfHash(): string {
  const raw = window.location.hash.replace(/^#/, "");
  const path = raw.split(/[?#]/)[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The card a control sits in: the nearest rounded ancestor with its own background. */
function cardOf(el: Element): HTMLElement | null {
  let a = el.parentElement;
  for (let i = 0; i < 8 && a && a !== document.body; i += 1, a = a.parentElement) {
    if (a.hasAttribute("data-focus-box")) return a;
    const cs = getComputedStyle(a);
    const bg = cs.backgroundColor;
    const solid = bg && bg !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(bg);
    if (solid && parseFloat(cs.borderTopLeftRadius) >= 6 && a.getBoundingClientRect().height < window.innerHeight * 2.5) return a;
  }
  return null;
}

function visible(el: Element | null): el is HTMLElement {
  return Boolean(el && (el as HTMLElement).getClientRects().length > 0);
}

/**
 * App-wide navigation glue for the manual:
 *  · Esc closes the open bubble or dialog first (they handle it), otherwise steps back inside Brizna.
 *  · Back into or out of the manual lands on the same scroll position.
 *  · "Ver en la app" opens the screen, unfolds the spot, scrolls to it and glows it briefly.
 */
export function NavHost() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPath = useRef(pathname);
  const positions = useRef(scrollMemory);
  const restoring = useRef<{ key: string; y: number; until: number } | null>(null);

  /* ---------------------------------------------------------------- Esc */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.repeat) return;
      if (document.querySelector(OPEN_LAYER)) return; // that layer closes itself
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        target.blur();
        return;
      }
      if (canGoBack()) {
        e.preventDefault();
        window.history.back();
      } else if (pathOfHash() === "/manual") {
        e.preventDefault();
        void navigate({ to: "/ajustes" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  /* ---------------------------------------------------- scroll memory */
  useEffect(() => {
    let raf = 0;
    const record = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const key = historyKey();
        if (!key) return;
        const r = restoring.current;
        if (r && r.key === key && Date.now() < r.until) return; // the page is still filling in
        positions.current.set(key, window.scrollY);
      });
    };
    const stopRestore = () => {
      restoring.current = null;
    };
    const onPop = () => {
      const to = pathOfHash();
      const from = prevPath.current;
      if (to !== "/manual" && from !== "/manual") return;
      const key = historyKey();
      const y = positions.current.get(key);
      if (y == null) return;
      restoring.current = { key, y, until: Date.now() + 2500 };
      const tick = () => {
        const r = restoring.current;
        if (!r || r.key !== historyKey()) return;
        window.scrollTo(0, r.y);
        if (Math.abs(window.scrollY - r.y) < 2 && document.documentElement.scrollHeight > r.y + 40) {
          // hold it a moment more: late content can still push things around
          if (Date.now() > r.until - 1700) {
            restoring.current = null;
            return;
          }
        }
        if (Date.now() < r.until) requestAnimationFrame(tick);
        else restoring.current = null;
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("popstate", onPop);
    window.addEventListener("wheel", stopRestore, { passive: true });
    window.addEventListener("touchstart", stopRestore, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", record);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("wheel", stopRestore);
      window.removeEventListener("touchstart", stopRestore);
    };
  }, []);

  useEffect(() => {
    prevPath.current = pathname;
    clearRing(); // a screen change always ends the "Ir allí" ring
  }, [pathname]);

  /* ----------------------------------------------- "Ver en la app" focus */
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const run = () => {
      const want = takeFocus(pathname);
      if (!want) return;
      const started = Date.now();
      let opened = false;
      const step = () => {
        if (cancelled) return;
        const elapsed = Date.now() - started;
        let el: Element | null = null;
        if (want.id && !opened && document.getElementById(want.id)) {
          opened = true;
          window.dispatchEvent(new CustomEvent("ols-open-fold", { detail: want.id }));
        }
        if (want.topic) {
          el = Array.from(document.querySelectorAll(`[data-topic="${CSS.escape(want.topic)}"]`)).find(visible) ?? null;
        }
        if (!el && want.id) {
          const box = document.getElementById(want.id);
          if (box && !opened) {
            opened = true;
            window.dispatchEvent(new CustomEvent("ols-open-fold", { detail: want.id }));
          }
          // give the fold a moment to show the topic's own (?) before settling for the whole box
          if (box && (!want.topic || elapsed > 1600)) el = box;
        }
        if (!el) {
          if (elapsed < 14000) timer = window.setTimeout(step, 120);
          return;
        }
        const isBox = want.id && el.id === want.id;
        const box =
          (isBox ? el : null) ??
          cardOf(el) ??
          el.closest("section, fieldset, details, li, article, label") ??
          el.parentElement ??
          el;
        (box as HTMLElement).scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
        // 1.4.61 (Oscar): the ring stays on while you read; it no longer fades by itself.
        window.setTimeout(() => {
          if (cancelled) return;
          showRing(box, isBox ? null : (el as Element), reduced() ? 150 : 900);
        }, reduced() ? 0 : 320);
      };
      timer = window.setTimeout(step, 80);
    };
    run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
