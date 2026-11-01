import type { CSSProperties } from "react";
import { useArrived } from "@/components/cifras-visuals";
import { cn } from "@/lib/utils";

/* Brizna 1.4 · Clima visual kit: weather art, tiny gauges and the day timeline.
   SVG + CSS only; animations are transform/opacity and stop under prefers-reduced-motion (see clima.css). */

export type ArtKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export type HeroKind = "sun" | "cloud" | "rain" | "storm";

export function artKind(code: number): ArtKind {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloudy";
  if (code === 1 || code === 2) return "partly";
  return "clear";
}

export function heroKind(code: number): HeroKind {
  const a = artKind(code);
  if (a === "storm") return "storm";
  if (a === "rain" || a === "drizzle" || a === "snow") return "rain";
  if (a === "cloudy" || a === "fog") return "cloud";
  return "sun";
}

function Cloud({ className, x = 0, y = 0, s = 1 }: { className?: string; x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={className}>
        <circle cx="22" cy="30" r="12" />
        <circle cx="40" cy="20" r="17" />
        <circle cx="59" cy="29" r="12.5" />
        <rect x="10" y="28" width="62" height="16" rx="8" />
      </g>
    </g>
  );
}

/** Big animated weather picture for the hero. */
export function WxArt({ code, night = false, className }: { code: number; night?: boolean; className?: string }) {
  const k = artKind(code);
  const sunny = k === "clear" || k === "partly";
  const cloudy = k !== "clear";
  const drops = k === "rain" || k === "storm" ? 9 : k === "drizzle" ? 6 : 0;
  return (
    <svg viewBox="0 0 120 100" className={cn("clx-art", `is-${k}`, className)} aria-hidden>
      <defs>
        <radialGradient id="clx-sun-g" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fff6c9" />
          <stop offset="55%" stopColor="#ffd34d" />
          <stop offset="100%" stopColor="#f5a524" />
        </radialGradient>
        <linearGradient id="clx-bolt-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe58a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {sunny && !night ? (
        <g transform={k === "partly" ? "translate(78 34)" : "translate(60 46)"}>
          <g className="clx-rays">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r1 = k === "partly" ? 20 : 27;
              const r2 = k === "partly" ? 27 : 37;
              return (
                <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} />
              );
            })}
          </g>
          <circle r={k === "partly" ? 15 : 21} className="clx-sun-glow" />
          <circle r={k === "partly" ? 14 : 20} fill="url(#clx-sun-g)" className="clx-sun-core" />
        </g>
      ) : null}
      {sunny && night ? (
        <g transform={k === "partly" ? "translate(78 32)" : "translate(60 44)"}>
          <path d="M6-20 A21 21 0 1 0 20 10 A16 16 0 1 1 6-20 Z" className="clx-moon" />
          <circle cx="-30" cy="-12" r="1.6" className="clx-star" />
          <circle cx="28" cy="-22" r="1.3" className="clx-star" style={{ animationDelay: "-1.2s" }} />
          <circle cx="-22" cy="22" r="1.1" className="clx-star" style={{ animationDelay: "-2.1s" }} />
        </g>
      ) : null}
      {cloudy ? (
        <>
          {k !== "partly" ? <Cloud className="clx-cloud clx-cloud-back" x={46} y={6} s={0.82} /> : null}
          <g className="clx-drift">
            <Cloud className={cn("clx-cloud", (k === "storm" || k === "rain") && "is-dark")} x={k === "partly" ? 14 : 12} y={k === "partly" ? 30 : 22} s={k === "partly" ? 0.95 : 1.12} />
          </g>
        </>
      ) : null}
      {k === "fog" ? (
        <g className="clx-fog">
          <rect x="14" y="74" width="70" height="5" rx="2.5" />
          <rect x="32" y="84" width="74" height="5" rx="2.5" style={{ animationDelay: "-2s" }} />
          <rect x="20" y="94" width="56" height="4" rx="2" style={{ animationDelay: "-4s" }} />
        </g>
      ) : null}
      {drops ? (
        <g className={cn("clx-drops", k === "drizzle" && "is-light")}>
          {Array.from({ length: drops }, (_, i) => (
            <line
              key={i}
              x1={30 + ((i * 9.5) % 62)}
              y1={74 + (i % 3) * 4}
              x2={27 + ((i * 9.5) % 62)}
              y2={k === "drizzle" ? 79 + (i % 3) * 4 : 83 + (i % 3) * 4}
              style={{ animationDelay: `${-(i * 0.23).toFixed(2)}s` }}
            />
          ))}
        </g>
      ) : null}
      {k === "snow" ? (
        <g className="clx-snow">
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx={30 + ((i * 11) % 60)} cy={76 + (i % 2) * 6} r="2.2" style={{ animationDelay: `${-(i * 0.45).toFixed(2)}s` }} />
          ))}
        </g>
      ) : null}
      {k === "storm" ? <path d="M64 58 L52 80 H61 L55 98 L74 72 H64 L70 58 Z" fill="url(#clx-bolt-g)" className="clx-bolt" /> : null}
    </svg>
  );
}

/** Small static icon for the hour strip and the tomorrow card. */
export function WxIcon({ code, night = false, className }: { code: number; night?: boolean; className?: string }) {
  const k = artKind(code);
  return (
    <svg viewBox="0 0 32 32" className={cn("clx-icon", className)} aria-hidden>
      {k === "clear" || k === "partly" ? (
        night ? (
          <path d={k === "partly" ? "M21 4 A8 8 0 1 0 28 14 A6 6 0 1 1 21 4 Z" : "M17 6 A10 10 0 1 0 27 18 A8 8 0 1 1 17 6 Z"} className="clx-i-moon" />
        ) : (
          <g transform={k === "partly" ? "translate(21 11)" : "translate(16 16)"}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r1 = k === "partly" ? 7.5 : 9.5;
              const r2 = k === "partly" ? 10 : 13;
              return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} className="clx-i-ray" />;
            })}
            <circle r={k === "partly" ? 5.5 : 7} className="clx-i-sun" />
          </g>
        )
      ) : null}
      {k !== "clear" ? (
        <g className={cn("clx-i-cloud", (k === "rain" || k === "storm") && "is-dark")} transform={k === "partly" ? "translate(0 4)" : "translate(0 0)"}>
          <circle cx="11" cy="15" r="5" />
          <circle cx="17" cy="11" r="6.5" />
          <circle cx="23" cy="15.5" r="4.5" />
          <rect x="6" y="14" width="21.5" height="6.5" rx="3.25" />
        </g>
      ) : null}
      {k === "rain" || k === "drizzle" || k === "storm" ? (
        <g className="clx-i-drop">
          <line x1="11" y1="24" x2="9.5" y2="28" />
          <line x1="17" y1="24" x2="15.5" y2="28" />
          {k !== "drizzle" ? <line x1="23" y1="24" x2="21.5" y2="28" /> : null}
        </g>
      ) : null}
      {k === "storm" ? <path d="M17 20 L13 26 H16.5 L14.5 31 L21 24 H17.5 L19.5 20 Z" className="clx-i-bolt" /> : null}
      {k === "snow" ? (
        <g className="clx-i-snow"><circle cx="11" cy="26" r="1.6" /><circle cx="17" cy="28" r="1.6" /><circle cx="23" cy="26" r="1.6" /></g>
      ) : null}
      {k === "fog" ? (
        <g className="clx-i-fog"><rect x="5" y="23" width="18" height="2.4" rx="1.2" /><rect x="10" y="27.5" width="18" height="2.4" rx="1.2" /></g>
      ) : null}
    </svg>
  );
}

/** A rain drop that fills to the chance of rain. */
export function DropGauge({ pct }: { pct: number }) {
  const on = useArrived();
  const f = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 28 34" className="clx-gauge clx-drop-g" aria-hidden>
      <defs>
        <clipPath id="clx-drop-clip">
          <path d="M14 2 C 9 10, 4 16, 4 22 a10 10 0 0 0 20 0 C 24 16, 19 10, 14 2 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#clx-drop-clip)">
        <rect x="0" y="0" width="28" height="34" className="clx-drop-empty" />
        <g className="clx-drop-fill" style={{ transform: `translateY(${on ? (1 - f) * 30 + 2 : 34}px)` }}>
          <path d="M-14 2 q 7 -3 14 0 t 14 0 t 14 0 t 14 0 V 40 H -14 Z" className="clx-drop-water" />
        </g>
      </g>
      <path d="M14 2 C 9 10, 4 16, 4 22 a10 10 0 0 0 20 0 C 24 16, 19 10, 14 2 Z" className="clx-drop-line" />
    </svg>
  );
}

/** A wind sock that lifts with the wind (0 km/h hangs, 35+ km/h straight out). */
export function WindSock({ kmh }: { kmh: number }) {
  const on = useArrived();
  const f = Math.max(0, Math.min(1, kmh / 35));
  const droop = 72 - f * 68;
  return (
    <svg viewBox="0 0 34 34" className="clx-gauge clx-sock" aria-hidden>
      <line x1="5" y1="3" x2="5" y2="32" className="clx-sock-pole" />
      <g className="clx-sock-arm" style={{ transform: `rotate(${on ? droop : 80}deg)`, transformOrigin: "6px 6px" }}>
        <g className={cn("clx-sock-flutter", kmh >= 8 && "is-on")} style={{ transformOrigin: "6px 6px" } as CSSProperties}>
          <path d="M6 2.5 L13 3.5 V10.5 L6 11.5 Z" className="clx-sock-a" />
          <path d="M13 3.5 L20 4.5 V9.5 L13 10.5 Z" className="clx-sock-b" />
          <path d="M20 4.5 L27 5.5 V8.5 L20 9.5 Z" className="clx-sock-a" />
        </g>
      </g>
    </svg>
  );
}

/** A thin ring for humidity. */
export function HumidRing({ pct }: { pct: number }) {
  const on = useArrived();
  const r = 12;
  const L = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 32 32" className="clx-gauge clx-ring" aria-hidden>
      <circle cx="16" cy="16" r={r} className="clx-ring-track" />
      <circle cx="16" cy="16" r={r} className="clx-ring-arc" strokeDasharray={L} strokeDashoffset={on ? L * (1 - f) : L} transform="rotate(-90 16 16)" />
      <path d="M16 10 C 14 13, 12.5 15, 12.5 17 a3.5 3.5 0 0 0 7 0 C 19.5 15, 18 13, 16 10 Z" className="clx-ring-drop" />
    </svg>
  );
}

export type Slot = { label: string; kind: "dry" | "maybe" | "wet" | "hot"; title: string };

/** The next ~12 hours as one bar: green dry, blue rain, amber hot. */
export function DayStrip({ slots, marks }: { slots: Slot[]; marks: { at: number; label: string }[] }) {
  return (
    <div className="clx-strip">
      <div className="clx-strip-bar" role="img" aria-label={slots.map((s) => s.title).join(", ")}>
        {slots.map((s, i) => (
          <span key={i} className={cn("clx-seg", `is-${s.kind}`)} style={{ "--i": i } as CSSProperties} title={s.title} />
        ))}
      </div>
      <div className="clx-strip-marks" aria-hidden>
        {marks.map((m, i) => (
          <span key={i} style={{ left: `${(m.at / Math.max(1, slots.length)) * 100}%` }} className={cn(i === 0 && "is-first", i === marks.length - 1 && "is-last")}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}

/** A row of grass blades with a small mower along the bottom of the hero. */
export function GrassEdge({ mow }: { mow: boolean }) {
  return (
    <div className={cn("clx-grass", mow && "is-mowing")} aria-hidden>
      <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="clx-grass-blades">
        <path d={grassPath()} />
      </svg>
      {mow ? (
        <div className="clx-mower-lane">
        <svg viewBox="0 0 32 24" className="clx-mower">
          <path d="M21 4 L27 0.8" className="clx-mower-handle" />
          <path d="M4 12 h15 a3 3 0 0 1 3 3 v2 H3 v-3 a2 2 0 0 1 1-2 Z" className="clx-mower-body" />
          <path d="M8 12 v-2.5 h7 V12" className="clx-mower-motor" />
          <path d="M21 4.5 L18 12" className="clx-mower-handle" />
          <circle cx="7" cy="19" r="3.4" className="clx-mower-wheel" />
          <circle cx="19" cy="19" r="3.4" className="clx-mower-wheel" />
        </svg>
        </div>
      ) : null}
    </div>
  );
}

function grassPath() {
  let d = "M0 24 ";
  for (let x = 0; x < 400; x += 6) {
    const h = 9 + ((x * 37) % 11);
    const lean = ((x * 13) % 5) - 2;
    d += `L${x + 1} 24 L${x + 3 + lean} ${24 - h} L${x + 5} 24 `;
  }
  return d + "L400 24 Z";
}
