import type React from "react";
import { Calculator, GripHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { DEFAULT_ABONO_PRESETS } from "@/lib/types";
import { cn } from "@/lib/utils";

function evalAmount(expr: string): number | null {
  const cleaned = expr.replace(/,/g, ".").replace(/\s/g, "");
  if (!cleaned || !/^[\d.+\-*/()]+$/.test(cleaned)) return null;
  if (/[+\-*/.]{2,}/.test(cleaned.replace(/\.\d/g, "0"))) return null;
  try {
    const n = Function(`"use strict"; return (${cleaned})`)() as unknown;
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v) || v < 0 || v > 100000) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}

const CALC_KEYS = ["7", "8", "9", "÷", "×", "4", "5", "6", "-", "+", "1", "2", "3", "C", "⌫", "0", ".", "="];

function applyKey(expr: string, ch: string, preview: number | null) {
  if (ch === "C") return "";
  if (ch === "⌫") return expr.slice(0, -1);
  if (ch === "=") return preview != null ? String(preview) : expr;
  if (ch === "×") return `${expr}*`;
  if (ch === "÷") return `${expr}/`;
  return `${expr}${ch}`;
}

const CALC_MEM = "ols-calc-memory";

type CalcMemory = { x: number; y: number; w: number; floated: boolean };

let savedCaret: Range | null = null;

function editorEl() {
  return document.querySelector<HTMLElement>("[data-note-editor]");
}

function rememberCaret() {
  const el = editorEl();
  const sel = window.getSelection();
  if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
  savedCaret = sel.getRangeAt(0).cloneRange();
}

function restoreCaret(el: HTMLElement) {
  el.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  const node = savedCaret?.startContainer;
  if (savedCaret && node && (node === el || el.contains(node))) {
    sel.removeAllRanges();
    sel.addRange(savedCaret);
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function keepKeyboard() {
  const el = editorEl();
  if (!el || document.activeElement === el) return;
  restoreCaret(el);
}

function readCalcMemory(): CalcMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CALC_MEM);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CalcMemory>;
    if (!data || typeof data.w !== "number") return null;
    return {
      x: typeof data.x === "number" ? data.x : 0,
      y: typeof data.y === "number" ? data.y : 0,
      w: data.w,
      floated: data.floated === true,
    };
  } catch {
    return null;
  }
}

function writeCalcMemory(mem: CalcMemory) {
  try {
    localStorage.setItem(CALC_MEM, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}

function fittedWidth(w: number) {
  const view = window.visualViewport?.width ?? window.innerWidth;
  return Math.min(Math.max(200, w), Math.min(360, view - 24));
}

function placeCuenta(expr: string, preview: number) {
  const el = editorEl();
  if (!el) return;
  restoreCaret(el);
  const pretty = expr.replaceAll("*", "×").replaceAll("/", "÷");
  const line = pretty === String(preview) ? money(preview) : `${pretty} = ${money(preview)}`;
  document.execCommand("insertText", false, line);
  rememberCaret();
}

function insertCuenta(expr: string, preview: number) {
  if (editorEl()) {
    placeCuenta(expr, preview);
    return;
  }
  document.querySelector<HTMLButtonElement>("[data-note-edit]")?.click();
  window.setTimeout(() => placeCuenta(expr, preview), 60);
}

export function QuickPad({ onClose }: { onClose: () => void }) {
  const memory = useState(readCalcMemory)[0];
  const [expr, setExpr] = useState("");
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(() => {
    if (!memory?.floated || typeof window === "undefined") return null;
    const vv = window.visualViewport;
    const top = vv?.offsetTop ?? 0;
    const left = vv?.offsetLeft ?? 0;
    const bottom = top + (vv?.height ?? window.innerHeight);
    const right = left + (vv?.width ?? window.innerWidth);
    return {
      x: Math.min(right - 48, Math.max(left, memory.x)),
      y: Math.min(bottom - 36, Math.max(top + 4, memory.y)),
    };
  });
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState(() => (typeof window === "undefined" ? 320 : fittedWidth(memory?.w ?? 320)));
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const resize = useRef<{ x: number; w: number } | null>(null);
  const live = useRef({ spot, box });
  live.current = { spot, box };
  const tx = useTx();
  const preview = evalAmount(expr);
  const tight = box < 230;

  useEffect(() => {
    function onSelect() {
      rememberCaret();
    }
    document.addEventListener("selectionchange", onSelect);
    const vv = window.visualViewport;
    function lift() {
      if (!vv) return;
      const height = padRef.current?.offsetHeight ?? 0;
      const top = vv.offsetTop;
      const bottom = top + vv.height;
      setSpot((current) => {
        if (!current) return current;
        const y = Math.min(Math.max(top + 4, bottom - Math.max(height, 36) - 8), Math.max(top + 4, current.y));
        return y === current.y ? current : { ...current, y };
      });
    }
    vv?.addEventListener("resize", lift);
    return () => {
      document.removeEventListener("selectionchange", onSelect);
      vv?.removeEventListener("resize", lift);
    };
  }, []);

  function persist() {
    const current = live.current;
    writeCalcMemory({
      x: current.spot?.x ?? 0,
      y: current.spot?.y ?? 0,
      w: current.box,
      floated: Boolean(current.spot),
    });
  }

  function close() {
    persist();
    onClose();
  }

  function onGripDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const visual = Math.round(rect.width);
    const width = Math.min(visual, window.innerWidth - 16);
    if (Math.abs(width - box) > 4) {
      live.current = { ...live.current, box: width };
      setBox(width);
    }
    const hold = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drag.current = hold;
    setDragging(true);
    function move(ev: PointerEvent) {
      const vv = window.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const left = vv?.offsetLeft ?? 0;
      const bottom = top + (vv?.height ?? window.innerHeight);
      const right = left + (vv?.width ?? window.innerWidth);
      const next = {
        x: Math.min(right - 48, Math.max(left - width + 48, ev.clientX - hold.x)),
        y: Math.min(bottom - 36, Math.max(top + 4, ev.clientY - hold.y)),
      };
      setSpot(next);
      live.current = { ...live.current, spot: next };
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag.current = null;
      setDragging(false);
      persist();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onResizeDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    resize.current = { x: e.clientX, w: box };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const hold = resize.current;
    if (!hold) return;
    const cap = Math.min(360, window.innerWidth - 24);
    const next = Math.min(cap, Math.max(200, hold.w + (e.clientX - hold.x)));
    live.current = { ...live.current, box: next };
    setBox(next);
  }

  function onResizeUp() {
    resize.current = null;
    persist();
  }

  const key = tight ? "h-8 px-0 text-sm" : "h-11 px-0 text-base";
  const wide = Math.min(box, (typeof window === "undefined" ? box : window.innerWidth) - 16);
  const pad = (
    <div
      ref={padRef}
      data-no-swipe
      onPointerDownCapture={(e) => {
        rememberCaret();
        e.preventDefault();
      }}
      onPointerUp={() => window.setTimeout(keepKeyboard, 0)}
      className={cn("rounded-md bg-bg p-2 shadow-card", spot ? "fixed z-[80]" : "relative mb-3 max-w-full")}
      style={
        spot
          ? { left: spot.x, top: spot.y, width: wide, touchAction: "none" }
          : { width: wide, maxWidth: "100%", touchAction: "none" }
      }
    >
      <div className="mb-1 flex items-center">
        <button
          type="button"
          aria-label={tx("Achicar o agrandar", "Shrink or grow")}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          className="grid size-8 shrink-0 cursor-ew-resize touch-none place-items-center text-muted"
        >
          <span className="block size-3 border-t-2 border-l-2 border-current" />
        </button>
        <button
          type="button"
          aria-label={tx("Mover calculadora", "Move calculator")}
          onPointerDown={onGripDown}
          className="flex h-8 min-w-0 flex-1 cursor-grab touch-none items-center justify-center rounded-sm text-muted active:cursor-grabbing"
        >
          <GripHorizontal className={cn("size-5", dragging && "text-fg")} />
        </button>
        <span className="size-8 shrink-0" />
      </div>
      <button
        type="button"
        aria-label={tx("Cerrar calculadora", "Close calculator")}
        onPointerUp={close}
        className="absolute top-1 right-1 grid size-8 place-items-center text-lg font-bold leading-none text-late"
      >
        ×
      </button>
      <p className={cn("mb-2 pr-8 text-center font-display font-semibold tabular-nums", tight ? "text-base" : "text-lg")}>
        {expr || "0"}
        {preview != null && String(preview) !== expr ? (
          <span className="ml-2 text-sm font-medium text-muted">= {money(preview)}</span>
        ) : null}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {CALC_KEYS.filter((k) => k !== "=" && k !== "0" && k !== ".").map((k) => (
          <Button
            key={k}
            type="button"
            variant="outline"
            className={cn(key, k === "C" && "text-late")}
            onPointerUp={() => setExpr((current) => applyKey(current, k, evalAmount(current)))}
          >
            {k}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className={cn("col-span-2", key)}
          onPointerUp={() => setExpr((current) => applyKey(current, "0", null))}
        >
          0
        </Button>
        <Button
          type="button"
          variant="outline"
          className={key}
          onPointerUp={() => setExpr((current) => applyKey(current, ".", null))}
        >
          .
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={preview == null}
          aria-label={tx("Insertar la cuenta en la nota", "Insert the calculation into the note")}
          onPointerUp={() => {
            if (preview == null) return;
            insertCuenta(expr, preview);
            window.setTimeout(keepKeyboard, 0);
          }}
          className={cn("col-span-2 px-2 text-money", tight ? "h-8 text-xs" : "h-11 text-sm")}
        >
          {tx("En la nota", "Into note")}
        </Button>
      </div>
    </div>
  );

  if (spot && typeof document !== "undefined") return createPortal(pad, document.body);
  return pad;
}

export function CalcButton({ pressed, onClick }: { pressed: boolean; onClick: () => void }) {
  const tx = useTx();
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={tx("Calculadora", "Calculator")}
      onPointerDown={(e) => {
        rememberCaret();
        e.preventDefault();
      }}
      onPointerUp={() => onClick()}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full",
        pressed ? "bg-soil-bg text-soil" : "text-fg",
      )}
    >
      <Calculator className="size-5" />
    </button>
  );
}

/** Grid shape for n presets + Calculadora (2+ slots, always beside at least one preset, never alone). */
function mcalcStyle(n: number) {
  let c = 4;
  let span = 4;
  for (const k of [4, 3, 5, 6]) {
    const rest = n % k;
    if (n > 0 && rest > 0 && rest + 2 <= k) {
      c = k;
      span = k - rest;
      break;
    }
  }
  const wide = n > 0 && n <= 7;
  return {
    ["--mc-c2" as string]: c,
    ["--mc-s2" as string]: span,
    ["--mc-c1" as string]: wide ? n + 2 : c,
    ["--mc-s1" as string]: wide ? 2 : span,
  } as React.CSSProperties;
}

export function MoneyCalc({
  value,
  onChange,
  presets = DEFAULT_ABONO_PRESETS,
  guardPreset,
}: {
  value: string;
  onChange: (next: string) => void;
  presets?: number[];
  guardPreset?: (amount: number, apply: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState(value);
  const startY = useRef(0);
  const tx = useTx();
  const preview = evalAmount(expr);

  function tap(ch: string) {
    if (ch === "C") {
      setExpr("");
      return;
    }
    if (ch === "⌫") {
      setExpr(expr.slice(0, -1));
      return;
    }
    if (ch === "=") {
      if (preview != null) setExpr(String(preview));
      return;
    }
    if (ch === "×") {
      setExpr(`${expr}*`);
      return;
    }
    if (ch === "÷") {
      setExpr(`${expr}/`);
      return;
    }
    setExpr(`${expr}${ch}`);
  }

  const keys = ["7", "8", "9", "÷", "×", "4", "5", "6", "-", "+", "1", "2", "3", "C", "⌫", "0", ".", "="];

  return (
    <div>
      {/* 1.4.75: presets and Calculadora fill their rows evenly (Calculadora takes the free slots of the
          last row, never a row of its own); one row when the box is wide. */}
      <div className="bz-mcalc mt-3" style={mcalcStyle(presets.length)}>
        <div className="bz-mcalc-grid">
          {presets.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={Number(value) === n}
              onClick={() => {
                const apply = () => {
                  onChange(String(n));
                  setExpr(String(n));
                };
                if (guardPreset) guardPreset(n, apply);
                else apply();
              }}
              className={cn("bz-mchip", Number(value) === n && "is-on")}
            >
              ${n}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setExpr(value);
              setOpen((v) => !v);
            }}
            className={cn("bz-mchip is-calc", open && "is-on")}
          >
            <Calculator aria-hidden />
            {tx("Calculadora", "Calculator")}
          </button>
        </div>
      </div>
      {open ? (
        <div
          className="relative mt-2 rounded-md bg-bg p-2"
          onPointerDown={(e) => {
            startY.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (e.clientY - startY.current < 48 || preview == null) return;
            onChange(String(preview));
            setExpr(String(preview));
          }}
        >
          <button
            type="button"
            aria-label={tx("Cerrar calculadora", "Close calculator")}
            onClick={() => setOpen(false)}
            className="absolute top-1 right-1 grid size-8 place-items-center text-lg font-bold leading-none text-late"
          >
            ×
          </button>
          <p className="mb-1 pr-8 text-center text-xs text-muted">
            {tx("Desliza hacia abajo para usar el resultado sin cerrar.", "Swipe down to use the result without closing.")}
          </p>
          <p className="mb-2 text-center font-display text-lg font-semibold tabular-nums">
            {expr || "0"}
            {preview != null && String(preview) !== expr ? (
              <span className="ml-2 text-sm font-medium text-muted">= {money(preview)}</span>
            ) : null}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {keys.map((k) => (
              <Button
                key={k}
                type="button"
                variant={k === "=" ? "primary" : "outline"}
                className={cn("h-11 px-0 text-base", k === "C" && "text-late")}
                onClick={() => tap(k)}
              >
                {k}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            className="mt-2 w-full"
            disabled={preview == null}
            onClick={() => {
              if (preview == null) return;
              onChange(String(preview));
              setExpr(String(preview));
            }}
          >
            {tx("Usar", "Use")} {preview != null ? money(preview) : tx("resultado", "result")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
