import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Brizna 1.4 · Cifras visual kit: lawn-themed, CSS/SVG only, transform/opacity animations.
   Every colour comes from the palette tokens, so all day and night palettes follow. */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** True one frame after mount, so CSS transitions run from zero to the value. */
export function useArrived() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let id2 = 0;
    const id = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(id2);
    };
  }, []);
  return on;
}

/** A number that counts up from zero when it appears (and glides when it changes). */
export function CountUp({ value, format, duration = 650, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      // rAF stamps can predate performance.now(): clamp so the ease never dips below the start (it showed -$25).
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const e = 1 - Math.pow(1 - t, 3);
      const v = a + (value - a) * e;
      setShown(t >= 1 ? value : Math.round(v));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, reduced, duration]);
  return <span className={cn("tabular-nums", className)} data-v={value}>{format(shown)}</span>;
}

const TONE = { done: "text-done", money: "text-money", hold: "text-hold", late: "text-late", due: "text-due" } as const;

/** Big headline figure first, one short plain sentence under it. */
export function Lead({ kicker, figure, sentence, tone, aside, icon }: {
  kicker?: ReactNode;
  figure: ReactNode;
  sentence?: ReactNode;
  tone?: "done" | "money" | "hold" | "late" | "due";
  aside?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="cif-lead">
      {icon ? <div className="cif-lead-icon" aria-hidden>{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {kicker ? <p className="cif-kicker">{kicker}</p> : null}
        <p className={cn("cif-lead-figure", tone && TONE[tone])}>{figure}</p>
        {sentence ? <p className="cif-lead-line">{sentence}</p> : null}
      </div>
      {aside ? <div className="cif-lead-aside">{aside}</div> : null}
    </div>
  );
}

/** A little push mower (side view). */
export function Mower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={cn("cif-mower", className)} aria-hidden>
      <path d="M21 4 L27 0.8" className="cif-mower-handle" />
      <path d="M4 12 h15 a3 3 0 0 1 3 3 v2 H3 v-3 a2 2 0 0 1 1-2 Z" className="cif-mower-body" />
      <path d="M8 12 v-2.5 h7 V12" className="cif-mower-motor" />
      <path d="M21 4.5 L18 12" className="cif-mower-handle" />
      <g className="cif-mower-wheel" style={{ transformOrigin: "7px 19px" }}>
        <circle cx="7" cy="19" r="3.4" />
        <path d="M7 16.2 V21.8 M4.2 19 H9.8" />
      </g>
      <g className="cif-mower-wheel" style={{ transformOrigin: "19px 19px" }}>
        <circle cx="19" cy="19" r="3.4" />
        <path d="M19 16.2 V21.8 M16.2 19 H21.8" />
      </g>
    </svg>
  );
}

/** A grass blade / leaf accent. */
export function Blade({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 12 20" className={cn("cif-blade", className)} style={style} aria-hidden>
      <path d="M6 20 C 2 14, 1 7, 6 0 C 8 6, 9 13, 6 20 Z" />
    </svg>
  );
}

/** Progress as a lawn being mowed: mowed stripes behind the mower, tall grass ahead.
 *  `mark` is an optional tick ("where you should be by now"), as a 0–1 fraction. */
export function GrassMeter({ value, mark, label, tone = "done", mower = true }: {
  value: number;
  mark?: number | null;
  label: string;
  tone?: "done" | "money";
  mower?: boolean;
}) {
  const arrived = useArrived();
  const f = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const shown = arrived ? f : 0;
  return (
    <div
      className={cn("cif-grass", tone === "money" && "is-money", mower && "has-mower", arrived && f > 0 && "is-moving")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
      style={{ "--f": shown } as CSSProperties}
    >
      <div className="cif-grass-track">
        <div className="cif-grass-run" />
      </div>
      {mark != null && mark > 0 && mark < 1 ? (
        <div className="cif-grass-marks" aria-hidden>
          <span className="cif-grass-mark" style={{ left: `${mark * 100}%` }} />
        </div>
      ) : null}
      {mower ? (
        <div className="cif-grass-lane" aria-hidden>
          <Mower />
        </div>
      ) : null}
    </div>
  );
}

/** A sun: a ring that fills (0–1) with rays that pop in around it. Content sits in the middle. */
export function SunRing({ value, size = 132, children, rays = 12 }: { value: number; size?: number; children?: ReactNode; rays?: number }) {
  const arrived = useArrived();
  const c = size / 2;
  const r = size / 2 - 18;
  const L = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="cif-sun" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <g className="cif-sun-rays">
          {Array.from({ length: rays }, (_, i) => {
            const a = (i / rays) * Math.PI * 2 - Math.PI / 2;
            const lit = i / rays < f || (f >= 1);
            const x1 = c + Math.cos(a) * (r + 9);
            const y1 = c + Math.sin(a) * (r + 9);
            const x2 = c + Math.cos(a) * (r + 15);
            const y2 = c + Math.sin(a) * (r + 15);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                className={cn("cif-sun-ray", lit && "is-lit")}
                style={{ animationDelay: `${200 + i * 45}ms`, transformOrigin: `${x1}px ${y1}px` }}
              />
            );
          })}
        </g>
        <circle cx={c} cy={c} r={r} className="cif-sun-disc" />
        <circle cx={c} cy={c} r={r} className="cif-sun-track" />
        <circle
          cx={c} cy={c} r={r} className="cif-sun-arc"
          strokeDasharray={L} strokeDashoffset={arrived ? L * (1 - f) : L}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div className="cif-sun-center">{children}</div>
    </div>
  );
}

/** Section wrapper style: keeps the saved order and staggers the entry by it. */
export function secStyle(rank: number): CSSProperties {
  return { order: rank, "--i": Math.min(rank, 12) } as CSSProperties;
}
