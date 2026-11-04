import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { canGoBack, historyKey, scrollMemory, takeFocus } from "@/lib/manual/nav";
import { clearRing, showRing } from "@/lib/manual/ring";
import { markJump } from "@/lib/jump-back";

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
    clearRing(); // a screen change always ends the highlight
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
      const openFold = (id: string) => {
        if (opened) return;
        opened = true;
        window.dispatchEvent(new CustomEvent("ols-open-fold", { detail: id }));
      };
      const firstVisible = (sel: string) => Array.from(document.querySelectorAll(sel)).find(visible) ?? null;
      const step = () => {
        if (cancelled) return;
        const elapsed = Date.now() - started;
        if (want.id && document.getElementById(want.id)) openFold(want.id);
        const t = want.topic ? CSS.escape(want.topic) : "";
        // 1) the exact element the topic talks about (data-spot), 2) its fallback (data-spot-alt),
        // 3) the fold/section id, 4) the topic's own (?) and its card.
        let box: Element | null = t ? firstVisible(`[data-spot~="${t}"]`) : null;
        // a spot can sit inside a closed fold: open the fold it lives in
        if (!box && t) {
          const hidden = document.querySelector(`[data-spot~="${t}"]`);
          const fold = hidden?.closest("section[id], details[id]");
          if (fold?.id) openFold(fold.id);
        }
        // data still loading: give the exact element a moment before settling for less
        const patient = elapsed > 1500;
        if (!box && t && patient) box = firstVisible(`[data-spot-alt~="${t}"]`);
        if (!box && want.id && (patient || !t)) {
          const el = document.getElementById(want.id);
          if (el && visible(el)) box = el;
        }
        let dot: Element | null = null;
        if (!box && t && patient) {
          const el = firstVisible(`[data-topic="${t}"]`);
          if (el) {
            dot = el;
            box =
              cardOf(el) ??
              el.closest("section, fieldset, details, li, article, label") ??
              el.parentElement ??
              el;
          }
        }
        if (!box) {
          if (elapsed < 14000) timer = window.setTimeout(step, 120);
          return;
        }
        if (!dot && t) dot = Array.from(box.querySelectorAll(`[data-topic="${t}"]`)).find(visible) ?? null;
        const target = box as HTMLElement;
        const mark = dot;
        const refind = (): Element | null =>
          (t ? firstVisible(`[data-spot~="${t}"]`) ?? firstVisible(`[data-spot-alt~="${t}"]`) : null) ??
          (want.id ? document.getElementById(want.id) : null);
        // Wait until the screen stops filling in (Estudio's columns, Hoy's data), then glide there once,
        // and light the frame only when the glide has landed, so the few seconds happen where you look.
        const stableSince = { at: Date.now(), y: NaN };
        const waitStable = () => {
          if (cancelled) return;
          if (!target.isConnected) {
            // the block was drawn again while data arrived: start over on the new one
            timer = window.setTimeout(step, 60);
            return;
          }
          const y = target.getBoundingClientRect().top + window.scrollY;
          if (Math.abs(y - stableSince.y) > 2) {
            stableSince.y = y;
            stableSince.at = Date.now();
          }
          const quiet = Date.now() - stableSince.at >= 280;
          if (!quiet && Date.now() - started < 6000) {
            timer = window.setTimeout(waitStable, 70);
            return;
          }
          glide();
        };
        const glide = () => {
          const r = target.getBoundingClientRect();
          const head = document.querySelector(".pod-header")?.getBoundingClientRect().bottom ?? 0;
          const inView = Boolean(target.closest(".pod-header")) || (r.top >= head + 8 && r.bottom <= window.innerHeight - 8);
          if (inView) {
            showRing(target, mark, 300, refind);
            return;
          }
          // phone back returns to where this screen opened. The router answers that history step with
          // its own scroll-to-top a moment later, so the glide starts after it, never under it.
          markJump();
          timer = window.setTimeout(() => go(r.height > window.innerHeight - head - 32, head), 140);
        };
        const go = (tall: boolean, head: number) => {
          if (cancelled) return;
          const keep = target.style.scrollMarginTop;
          target.style.scrollMarginTop = `${Math.round(head + 16)}px`; // clear of the sticky header
          target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: tall ? "start" : "center" });
          window.setTimeout(() => {
            target.style.scrollMarginTop = keep;
          }, 2500);
          const landed = { y: window.scrollY, at: Date.now(), from: Date.now() };
          const waitLand = () => {
            if (cancelled) return;
            if (Math.abs(window.scrollY - landed.y) > 1) {
              landed.y = window.scrollY;
              landed.at = Date.now();
            }
            const still = Date.now() - landed.at >= 140 && Date.now() - landed.from >= 160;
            if (!still && Date.now() - landed.from < 2000) {
              timer = window.setTimeout(waitLand, 50);
              return;
            }
            showRing(target, mark, 400, refind);
          };
          timer = window.setTimeout(waitLand, 60);
        };
        waitStable();
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
