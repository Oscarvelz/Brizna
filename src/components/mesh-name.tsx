import { useLayoutEffect, useRef, useState } from "react";
import type { QuadCols } from "@/lib/density";
import { cn } from "@/lib/utils";

/**
 * A client's name on a Grid (Malla) card. 1.4.61 (Oscar): at 3 and 4 columns the name sits on ONE
 * line and bigger, never split across two lines and never shrunk. Only when the full name truly does
 * not fit the card is it shortened, first to "María G.", then to the first name.
 */
export function MeshName({ name, cols, className }: { name: string; cols: QuadCols; className?: string }) {
  const full = name.trim().replace(/\s+/g, " ");
  const parts = full.split(" ").filter(Boolean);
  const forms = [full];
  if (parts.length > 1) forms.push(`${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`, parts[0]!);
  const [step, setStep] = useState(0);
  const box = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (cols < 3) return;
    const el = box.current;
    if (!el) return;
    const fit = () => {
      // measure each form in a hidden twin (same font), keep the longest that fits the card
      const room = el.clientWidth;
      if (!room) return;
      const twin = el.cloneNode(false) as HTMLSpanElement;
      twin.style.cssText = "display:inline-block;white-space:nowrap;position:absolute;visibility:hidden;width:auto;max-width:none;overflow:visible;left:-9999px;top:0";
      twin.removeAttribute("title");
      document.body.appendChild(twin);
      let i = 0;
      for (; i < forms.length - 1; i += 1) {
        twin.textContent = forms[i]!;
        if (twin.getBoundingClientRect().width <= room + 0.5) break;
      }
      twin.remove();
      setStep(i);
    };
    fit();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, cols]);

  if (cols >= 3) {
    return (
      <span
        ref={box}
        title={full}
        className={cn(
          "block min-w-0 overflow-hidden whitespace-nowrap font-semibold leading-tight",
          cols === 3 ? "text-[15px]" : "text-sm",
          className,
        )}
      >
        {forms[step] ?? full}
      </span>
    );
  }
  return <span className={cn("block break-words text-xs font-semibold leading-snug", className)}>{full}</span>;
}
