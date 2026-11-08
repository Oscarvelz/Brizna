import { ChevronDown, Pin } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEY = "ols-folds";
const ALL_KEY = "ols-folds-all";
/** 1.4.99: pins chosen in a tablet tools column (kept apart from the phone's, so neither leaks into the other). */
const WIDE_KEY = "ols-folds-wide";

/** 1.4.99 (Oscar, Cobros on tablet): folds inside a wide tools column start pinned open, so the column fills. */
export const SidePinContext = createContext(false);

function readWide(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDE_KEY) || "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const map: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "boolean") map[k] = v;
    return map;
  } catch {
    return {};
  }
}

function writeWide(id: string, pinned: boolean) {
  const map = readWide();
  map[id] = pinned;
  try {
    localStorage.setItem(WIDE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Pinned here? In a wide tools column: the tablet choice, or pinned when never chosen. Elsewhere: the phone pins. */
function isPinned(id: string, wide: boolean): boolean {
  if (wide) return readWide()[id] ?? true;
  return readPins().includes(id);
}

function readPins(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readMap(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(ALL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    if ("prefix" in parsed && typeof (parsed as { prefix?: unknown }).prefix === "string") {
      const legacy = parsed as { prefix: string; open?: boolean };
      return { [legacy.prefix]: legacy.open === true };
    }
    const map: Record<string, boolean> = {};
    for (const [prefix, open] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof open === "boolean") map[prefix] = open;
    }
    return map;
  } catch {
    return {};
  }
}

export function foldsOpen(prefix: string): boolean {
  return readMap()[prefix] === true;
}

export function setFoldsOpen(prefix: string, open: boolean) {
  const map = readMap();
  map[prefix] = open;
  try {
    sessionStorage.setItem(ALL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("ols-folds-all", { detail: { open, prefix } }));
}

function readForce(id: string): boolean | null {
  const map = readMap();
  let hit: boolean | null = null;
  for (const [prefix, open] of Object.entries(map)) {
    if (prefix && id.startsWith(prefix)) hit = open;
  }
  return hit;
}

function writePins(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function Fold({
  id,
  title,
  hint,
  children,
  className,
  titleClassName,
  contentClassName,
  forceOpen = false,
  group,
  style,
  defaultOpen = false,
  peek,
  chevronEnd = false,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  forceOpen?: boolean;
  /** Opening one fold in the group closes the others, unless they are pinned. */
  group?: string;
  style?: CSSProperties;
  /** Open on first view unless the user chose otherwise (Desplegar or pin). */
  defaultOpen?: boolean;
  /** A short figure shown in the title row while the section is closed. */
  peek?: ReactNode;
  /** Put the open/close arrow at the far right (after ? and pin) so the title icon leads. */
  chevronEnd?: boolean;
}) {
  const tx = useTx();
  // Estudio folds (cif-*) also take the small arrow at the right, so the title's leaf leads (Oscar 2026-11-02).
  chevronEnd = chevronEnd || id.startsWith("cif-");
  const wide = useContext(SidePinContext);
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const [pinned, setPinned] = useState(() => isPinned(id, wide));
  const [open, setOpen] = useState(() => readForce(id) ?? (isPinned(id, wide) || defaultOpen));
  const shown = forceOpen || open;
  // Turning the tablet (tools column appears or goes): take that layout's pin.
  const firstWide = useRef(true);
  useEffect(() => {
    if (firstWide.current) {
      firstWide.current = false;
      return;
    }
    const p = isPinned(id, wide);
    setPinned(p);
    if (p) setOpen(true);
  }, [id, wide]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      if (hash === id || (id === "aj-manual" && hash.startsWith("ayuda-"))) setOpen(true);
    };
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) setOpen(true);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("ols-open-fold", onOpen);
    const onAll = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean; prefix?: string }>).detail;
      if (!detail || typeof detail.open !== "boolean") return;
      if (detail.prefix && !id.startsWith(detail.prefix)) return;
      setOpen(detail.open);
    };
    const onAcc = (event: Event) => {
      if (!group) return;
      const detail = (event as CustomEvent<{ group?: string; id?: string }>).detail;
      if (!detail || detail.group !== group || detail.id === id) return;
      if (isPinned(id, wideRef.current)) return;
      setOpen(false);
    };
    window.addEventListener("ols-folds-all", onAll);
    window.addEventListener("ols-fold-accordion", onAcc);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("ols-open-fold", onOpen);
      window.removeEventListener("ols-folds-all", onAll);
      window.removeEventListener("ols-fold-accordion", onAcc);
    };
  }, [id, group]);

  function togglePin() {
    const next = !pinned;
    if (wide) writeWide(id, next);
    else {
      const all = readPins().filter((item) => item !== id);
      if (next) all.push(id);
      writePins(all);
    }
    setPinned(next);
    if (next) setOpen(true);
  }

  function toggleOpen() {
    const y = id === "aj-manual" ? window.scrollY : null;
    setOpen((value) => {
      const next = !value;
      if (next && group) {
        window.dispatchEvent(new CustomEvent("ols-fold-accordion", { detail: { group, id } }));
      }
      return next;
    });
    if (y != null) {
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }

  const chevBtn = (
<button
      type="button"
      aria-expanded={shown}
      aria-label={tx("Abrir o cerrar", "Open or close")}
      onClick={toggleOpen}
      className="bz-fold-chev grid size-9 shrink-0 place-items-center"
    >
      <span className="bz-fold-chev-dot grid size-7 place-items-center rounded-full">
        <ChevronDown className={cn("size-4 transition-transform", !shown && "-rotate-90")} />
      </span>
    </button>
  );

  return (
    <section
      id={id}
      style={style}
      data-open={shown ? "" : undefined}
      className={cn("bz-fold rounded-xl bg-surface shadow-card", className)}
    >
      <div className={cn("bz-fold-head flex items-center gap-0.5 px-2 py-1", chevronEnd && "bz-fold-head-end")}>
        {chevronEnd ? null : chevBtn}
        <div
          className={cn("bz-fold-title flex min-h-11 min-w-0 flex-1 items-center overflow-hidden font-display text-base font-semibold", titleClassName)}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[data-no-fold]")) return;
            toggleOpen();
          }}
        >
          {title}
          {peek && !shown ? <span className="bz-fold-peek ml-auto shrink-0 truncate font-sans text-sm font-semibold tabular-nums">{peek}</span> : null}
        </div>
        {hint}
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? tx("Dejar de mantener abierto", "Stop keeping this open") : tx("Mantener abierto", "Keep open")}
          onClick={togglePin}
          className={cn(
            // 1.5.18 (Oscar): bare pin — no circle, no box; rose and filled when pinned, muted when not.
            "bz-fold-pin grid size-9 shrink-0 place-items-center",
            pinned ? "text-[color:var(--tone-pin)]" : "text-muted",
          )}
        >
          <Pin className={cn("size-3.5", pinned && "fill-current")} />
        </button>
        {chevronEnd ? chevBtn : null}
      </div>
      {shown ? <div className={cn("bz-fold-body px-3 pb-3", contentClassName)}>{children}</div> : null}
    </section>
  );
}
