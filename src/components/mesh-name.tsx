import { useLayoutEffect, useRef, useState } from "react";
import type { QuadCols } from "@/lib/density";
import { cn } from "@/lib/utils";

/**
 * A client's name on a Grid (Malla) card, always on ONE line, sized to fill the card's width.
 * 1.4.62 (Oscar):
 *  - x2: plenty of room, so the name is big (15-21px). A very long name drops its middle names.
 *  - x3: the full name, never a last-name initial. Font fits the width exactly (11-19px); a very
 *    long name drops its middle names ("María Gutiérrez") before it gets too small.
 *  - x4: may shorten to "Luis H." (12-16px), never broken across lines.
 *  - Only a name that cannot be read even at the floor size at x2/x3 falls back to "Maximiliano B.".
 * Sizes are in px at a 16px root and follow the app's text size setting.
 */
type Rule = { min: number; max: number; floor: number; short: boolean };
const RULES: Record<QuadCols, Rule> = {
  2: { min: 15, max: 21, floor: 13, short: false },
  3: { min: 11, max: 19, floor: 9.5, short: false },
  4: { min: 12, max: 16, floor: 10, short: true },
};
const REF = 20;

function formsOf(full: string, short: boolean): string[] {
  const parts = full.split(" ").filter(Boolean);
  const out = [full];
  if (parts.length > 2) out.push(`${parts[0]} ${parts[parts.length - 1]}`);
  if (short && parts.length > 1) out.push(`${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`, parts[0]!);
  return out;
}

/** Last resort at x2/x3 only, for a name too long to read even at the floor size (e.g. "Maximiliano Bustamante" at x3 on a phone). */
function rescueOf(full: string): string[] {
  const parts = full.split(" ").filter(Boolean);
  return parts.length > 1 ? [`${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`, parts[0]!] : [];
}

/** 1.4.79: one shared name scale per view; each MeshNameUniform reports what it needs, the view takes the smallest. */
const viewNeeds = new WeakMap<Element, Map<Element, number>>();
function viewScale(view: Element, el: Element, need: number | null) {
  let m = viewNeeds.get(view);
  if (!m) viewNeeds.set(view, (m = new Map()));
  if (need == null || need >= 1) m.delete(el);
  else m.set(el, need);
  for (const k of [...m.keys()]) if (!k.isConnected) m.delete(k);
  const min = m.size ? Math.min(...m.values()) : 1;
  const v = view as HTMLElement;
  const cur = v.style.getPropertyValue("--bz-mn-s");
  const next = min < 1 ? String(min) : "";
  if (cur !== next) {
    if (next) v.style.setProperty("--bz-mn-s", next);
    else v.style.removeProperty("--bz-mn-s");
  }
}

/**
 * 1.4.77 (Oscar): Clientes Malla x2/x3 — every name in the grid at the SAME size (CSS: .bz-mname-u, sized by the
 * card width). A name that does not fit on one line puts its last name on line 2; the only break point is
 * before the last name. If even that cannot fit (one very long word), middle names drop first, and only then
 * does this one card's name shrink.
 */
export function MeshNameUniform({ name, cols, className, size, fit }: { name: string; cols: 2 | 3 | 4; className?: string; /** 1.4.78: list sizes (Grande/Media) use the same rule at a fixed size. */ size?: "grande" | "media" | "jgrande" | "jmedia" | "cmedia";
  /** 1.4.80 (Oscar): the name shrink-wraps to its own text (widest line) so what follows it (the price) sits right after
   *  the name, even when the last name goes to line 2. The room is measured on the closest [data-name-room] row
   *  (its width minus its other children and gaps) instead of on the name box itself. */
  fit?: boolean }) {
  const full = name.trim().replace(/\s+/g, " ");
  const parts = full.split(" ");
  const forms: [string, string][] = parts.length > 1 ? [[parts.slice(0, -1).join(" "), parts[parts.length - 1]!]] : [[full, ""]];
  if (parts.length > 2) forms.push([parts[0]!, parts[parts.length - 1]!]);
  const [step, setStep] = useState(0);
  const [two, setTwo] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const host = fit ? (el.closest("[data-name-room]") as HTMLElement | null) : null;
    const roomOf = () => {
      if (!host) return el.clientWidth;
      const kids = [...host.children] as HTMLElement[];
      const gap = parseFloat(getComputedStyle(host).columnGap) || 0;
      const others = kids.filter((k) => !k.contains(el)).reduce((t, k) => t + k.getBoundingClientRect().width, 0);
      const cs = getComputedStyle(host);
      const inner = host.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      return Math.floor(inner - others - gap * Math.max(0, kids.length - 1));
    };
    const check = () => {
      const room = roomOf();
      if (!room || room < 0) return;
      el.style.fontSize = "";
      const twin = el.cloneNode(false) as HTMLSpanElement;
      twin.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${room}px`;
      twin.classList.remove("is-2l", "is-fit"); // its spans must measure inline, whatever state the name is in
      el.parentElement?.appendChild(twin);
      const widest = (k: number) => {
        twin.innerHTML = "";
        for (const t of forms[k]!) {
          if (!t) continue;
          const sp = document.createElement("span");
          sp.textContent = t;
          sp.style.whiteSpace = "nowrap";
          twin.appendChild(sp);
          twin.appendChild(document.createTextNode(" "));
        }
        return Math.max(...[...twin.children].map((c) => (c as HTMLElement).getBoundingClientRect().width));
      };
      const view = el.closest("main") ?? el.parentElement ?? document.body;
      const s = parseFloat(getComputedStyle(view).getPropertyValue("--bz-mn-s")) || 1;
      let i = 0;
      while (i < forms.length - 1 && widest(i) / s > room + 0.5) i += 1;
      const w = widest(i) / s;
      let oneLine = 0;
      if (fit) {
        twin.innerHTML = "";
        const sp = document.createElement("span");
        sp.textContent = forms[i]!.filter(Boolean).join(" ");
        sp.style.whiteSpace = "nowrap";
        twin.appendChild(sp);
        oneLine = sp.getBoundingClientRect().width;
      }
      twin.remove();
      // 1.4.79 standing rule (Oscar): never shrink one card. A word that cannot fit even on its own line scales
      // EVERY name in the view by the same factor (CSS var on <main>), so all cards keep one identical size.
      viewScale(view, el, w > room + 0.5 ? Math.max(0.6, Math.floor(((room - 1) / w) * 100) / 100) : 1);
      setStep((p) => (p === i ? p : i));
      if (fit) {
        const t = !!forms[i]![1] && oneLine > room + 0.5;
        setTwo((p) => (p === t ? p : t));
      }
    };
    check();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    // the name box too: a web font that arrives late changes its width (and so whether it needs 2 lines)
    ro?.observe(el);
    if (host) ro?.observe(host);
    let alive = true;
    document.fonts?.ready.then(() => alive && check()).catch(() => undefined);
    return () => {
      alive = false;
      ro?.disconnect();
      viewScale(el.closest("main") ?? el.parentElement ?? document.body, el, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, cols, fit]);
  const [a, b] = forms[step] ?? forms[0]!;
  return (
    <span ref={box} title={full} className={cn("bz-mname-u", size ? `is-${size}` : cols === 4 ? "is-c4" : cols === 3 ? "is-c3" : "is-c2", fit && "is-fit", fit && two && "is-2l", className)}>
      <span>{a}</span>
      {b ? " " : null}
      {b ? <span>{b}</span> : null}
    </span>
  );
}

export function MeshName({ name, cols, className }: { name: string; cols: QuadCols; className?: string }) {
  const full = name.trim().replace(/\s+/g, " ");
  const rule = RULES[cols] ?? RULES[2];
  const main = formsOf(full, rule.short);
  const forms = rule.short ? main : [...main, ...rescueOf(full)];
  const [fit, setFit] = useState<{ step: number; px: number } | null>(null);
  const box = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const room = el.clientWidth;
      if (!room) return;
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const k = rootPx / 16;
      const twin = el.cloneNode(false) as HTMLSpanElement;
      twin.style.cssText = `display:inline-block;white-space:nowrap;position:absolute;visibility:hidden;width:auto;max-width:none;overflow:visible;left:-9999px;top:0;font-size:${REF}px`;
      twin.removeAttribute("title");
      document.body.appendChild(twin);
      let chosen: { step: number; px: number } | null = null;
      let last = { step: main.length - 1, px: rule.floor * k };
      const fitPx = (i: number) => {
        twin.textContent = forms[i]!;
        const w = twin.getBoundingClientRect().width || 1;
        return Math.floor(((room - 1) / w) * REF * 4) / 4; // the size that fills the width exactly
      };
      for (let i = 0; i < main.length; i += 1) {
        const px = fitPx(i);
        if (px >= rule.min * k) {
          chosen = { step: i, px: Math.min(px, rule.max * k) };
          break;
        }
        if (i === main.length - 1) last = { step: i, px: Math.max(px, rule.floor * k) };
      }
      if (!chosen && fitPx(main.length - 1) < rule.floor * k) {
        for (let i = main.length; i < forms.length; i += 1) {
          const px = fitPx(i);
          if (px >= rule.floor * k || i === forms.length - 1) {
            last = { step: i, px: Math.max(Math.min(px, rule.max * k), rule.floor * k) };
            break;
          }
        }
      }
      twin.remove();
      const next = chosen ?? last;
      setFit((prev) => (prev && prev.step === next.step && Math.abs(prev.px - next.px) < 0.2 ? prev : next));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    let alive = true;
    document.fonts?.ready.then(() => alive && measure()).catch(() => undefined);
    return () => {
      alive = false;
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, cols]);

  return (
    <span
      ref={box}
      title={full}
      style={fit ? { fontSize: `${fit.px}px` } : undefined}
      className={cn(
        "block min-w-0 overflow-hidden whitespace-nowrap font-semibold leading-tight",
        !fit && (cols === 2 ? "text-base" : cols === 3 ? "text-[15px]" : "text-sm"),
        className,
      )}
    >
      {forms[fit?.step ?? 0] ?? full}
    </span>
  );
}
