import { useEffect, useMemo } from "react";
import "./login.css";

/** Brizna sign-in backdrop: sky fading into a mowed lawn, a soft sun, grass that sways.
 *  CSS/SVG only. Motion stops with prefers-reduced-motion and while the page is hidden. */

const W = 1440;
const H = 320;

// Front hill top edge, shared by the hill path and the blade bases so blades grow out of it.
const front = (x: number) => 214 + 14 * Math.sin(x / 210 + 0.6) + 8 * Math.sin(x / 97 + 2.1);
const mid = (x: number) => 176 + 18 * Math.sin(x / 260 + 2.4) + 6 * Math.sin(x / 120);
const back = (x: number) => 150 + 22 * Math.sin(x / 330 + 4.1);

function hillPath(fn: (x: number) => number) {
  let d = `M0 ${H} L0 ${fn(0).toFixed(1)}`;
  for (let x = 24; x <= W; x += 24) d += ` L${x} ${fn(x).toFixed(1)}`;
  return `${d} L${W} ${H} Z`;
}

// Deterministic pseudo-random, so the lawn looks the same on every visit.
function blades(seed: number, count: number, base: (x: number) => number, tall: number) {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i + r() * 0.8) * (W / count);
    const h = tall * (0.45 + r() * 0.75);
    const w = 7 + r() * 7;
    const lean = (r() - 0.5) * h * 0.5;
    const b = base(x) + 8;
    out.push(
      `M${(x - w / 2).toFixed(1)} ${b.toFixed(1)} Q${(x + lean * 0.2).toFixed(1)} ${(b - h * 0.55).toFixed(1)} ${(x + lean).toFixed(1)} ${(b - h).toFixed(1)} Q${(x + w * 0.15 + lean * 0.35).toFixed(1)} ${(b - h * 0.5).toFixed(1)} ${(x + w / 2).toFixed(1)} ${b.toFixed(1)}Z`,
    );
  }
  return out.join(" ");
}

export function usePausedWhenHidden() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (document.visibilityState === "hidden") root.dataset.bzHidden = "1";
      else delete root.dataset.bzHidden;
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      delete root.dataset.bzHidden;
    };
  }, []);
}

/** The status bar takes the colour of the top of the sky while this screen is up. */
export function useSkyStatusBar() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const before = meta.getAttribute("content");
    const root = document.documentElement;
    const paint = () => {
      const color = getComputedStyle(root).getPropertyValue("--bz-sky-top").trim();
      if (color) meta.setAttribute("content", color);
    };
    paint();
    const watch = new MutationObserver(paint);
    watch.observe(root, { attributes: true, attributeFilter: ["class", "data-palette"] });
    return () => {
      watch.disconnect();
      if (before) meta.setAttribute("content", before);
    };
  }, []);
}

export function LawnScene({ calm = false }: { calm?: boolean }) {
  usePausedWhenHidden();
  useSkyStatusBar();
  const paths = useMemo(
    () => ({
      back: hillPath(back),
      mid: hillPath(mid),
      front: hillPath(front),
      bladesMid: blades(7, 34, mid, 46),
      bladesA: blades(11, 26, front, 78),
      bladesB: blades(23, 24, front, 64),
      bladesC: blades(37, 22, front, 92),
    }),
    [],
  );
  return (
    <div className={`bz-scene${calm ? " bz-calm" : ""}`} aria-hidden="true">
      <div className="bz-sky" />
      <div className="bz-stars">
        <i style={{ left: "12%", top: "9%" }} />
        <i style={{ left: "24%", top: "21%" }} />
        <i style={{ left: "38%", top: "6%" }} />
        <i style={{ left: "57%", top: "15%" }} />
        <i style={{ left: "68%", top: "4%" }} />
        <i style={{ left: "83%", top: "27%" }} />
        <i style={{ left: "7%", top: "31%" }} />
        <i style={{ left: "47%", top: "29%" }} />
        <i style={{ left: "92%", top: "11%" }} />
      </div>
      <div className="bz-sun">
        <span className="bz-sun-halo" />
        <span className="bz-sun-disk" />
      </div>
      <svg className="bz-lawn" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="bzFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--bz-front-top)" }} />
            <stop offset="1" style={{ stopColor: "var(--bz-front-bottom)" }} />
          </linearGradient>
          <linearGradient id="bzSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <pattern id="bzStripes" width="168" height={H} patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
            <rect width="84" height={H} fill="#fff" opacity="0.055" />
          </pattern>
          <clipPath id="bzFrontClip">
            <path d={paths.front} />
          </clipPath>
        </defs>
        <path d={paths.back} style={{ fill: "var(--bz-back)" }} />
        <g className="bz-sway bz-sway-mid">
          <path d={paths.bladesMid} style={{ fill: "var(--bz-mid)" }} />
        </g>
        <path d={paths.mid} style={{ fill: "var(--bz-mid)" }} />
        <g className="bz-sway bz-sway-a">
          <path d={paths.bladesA} style={{ fill: "var(--bz-blade-a)" }} />
        </g>
        <g className="bz-sway bz-sway-b">
          <path d={paths.bladesB} style={{ fill: "var(--bz-blade-b)" }} />
        </g>
        <g className="bz-sway bz-sway-c">
          <path d={paths.bladesC} style={{ fill: "var(--bz-front-top)" }} />
        </g>
        <path d={paths.front} fill="url(#bzFront)" />
        <g clipPath="url(#bzFrontClip)">
          <rect width={W} height={H} fill="url(#bzStripes)" />
          <rect className="bz-sheen" x="-480" width="480" height={H} fill="url(#bzSheen)" />
        </g>
      </svg>
      <div className="bz-haze" />
    </div>
  );
}
