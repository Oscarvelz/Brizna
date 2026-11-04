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
