import { useEffect } from "react";

/* A soft ripple in the element's own tone wherever a card, fold header, option row or pick is
   tapped. One global listener; the ripple lives in a clipped layer that removes itself. */
const SEL = ".bz-stat, .bz-fold-head, .bz-fold-body .bz-row, .bz-pick, .bz-chosen";

export function TapBloom() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const layer = document.createElement("span");
      layer.className = "bz-tap-layer";
      const dot = document.createElement("span");
      dot.className = "bz-tap-ripple";
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      const host = el.closest(".bz-stat, .bz-fold") as HTMLElement | null;
      const cs = host ? getComputedStyle(host) : null;
      const tone = cs?.getPropertyValue("--stat-tone").trim() || cs?.getPropertyValue("--fold-tone").trim();
      if (tone) dot.style.setProperty("--bloom", tone);
      layer.appendChild(dot);
      el.appendChild(layer);
      window.setTimeout(() => layer.remove(), 650);
    };
    document.addEventListener("pointerdown", down, { passive: true });
    return () => document.removeEventListener("pointerdown", down);
  }, []);
  return null;
}
