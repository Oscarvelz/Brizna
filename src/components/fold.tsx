import { ChevronDown, Pin } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEY = "ols-folds";
const ALL_KEY = "ols-folds-all";

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
  const [pinned, setPinned] = useState(() => readPins().includes(id));
  const [open, setOpen] = useState(() => readForce(id) ?? (readPins().includes(id) || defaultOpen));
  const shown = forceOpen || open;

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
      if (readPins().includes(id)) return;
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
    const all = readPins().filter((item) => item !== id);
    if (next) all.push(id);
    writePins(all);
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
            "bz-fold-pin bz-pin-fine grid size-9 shrink-0 place-items-center rounded-full",
            pinned ? "bz-pick bz-pick-icon" : "text-muted",
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
