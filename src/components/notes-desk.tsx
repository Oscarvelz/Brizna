import { FolderOpen, PanelLeftClose, Pin, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { formatDay } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import type { PadPage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 1.5.00 (Oscar, Tab S10 Ultra): the notepad on a tablet or computer is a desk of panels.
 * Notes list (left, always there) | editor | Calculadora + Esta semana (right).
 * Dividers drag (finger or S-Pen, 32 px touch area), double-tap resets, arrows nudge, panels collapse,
 * sizes are remembered on this device. Phones never render any of this.
 */

const KEY = "bz-nb-desk";
export type DeskMode = "three" | "two";
type DeskState = { list: number | null; side: number | null; listOpen: boolean; sideOpen: boolean; calcOpen: boolean };

const LIST = { min: 240, max: 420 };
const SIDE = { min: 290, max: 520 };
const EDITOR_MIN = 440;
const EDITOR_AIM = 780;
const GAP = 20; // one divider column
const SHUT = 52; // a collapsed panel strip

function readDesk(): DeskState {
  const base: DeskState = { list: null, side: null, listOpen: true, sideOpen: true, calcOpen: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<DeskState>;
    return {
      list: typeof d.list === "number" ? d.list : null,
      side: typeof d.side === "number" ? d.side : null,
      listOpen: d.listOpen !== false,
      sideOpen: d.sideOpen !== false,
      calcOpen: d.calcOpen !== false,
    };
  } catch {
    return base;
  }
}

function writeDesk(d: DeskState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Default sizes: the editor aims at a comfortable writing width (~780 px), the rest is shared by the two panels. */
export function deskDefaults(width: number, mode: DeskMode) {
  if (mode === "two") {
    return { list: clamp(Math.round(width * 0.3), 250, 300), side: 0 };
  }
  const spare = Math.max(0, width - EDITOR_AIM - GAP * 2);
  return {
    list: clamp(Math.round(spare * 0.45), 264, 380),
    side: clamp(Math.round(spare * 0.55), 300, 480),
  };
}

export function useDesk(width: number, mode: DeskMode) {
  const [desk, setDesk] = useState<DeskState>(readDesk);
  const def = deskDefaults(width, mode);
  const sideOpen = mode === "three" && desk.sideOpen;
  // Room the editor must keep: the panels give way to it, never the other way round.
  const sideW = mode === "three" ? (sideOpen ? clamp(desk.side ?? def.side, SIDE.min, SIDE.max) : SHUT) : 0;
  const listCap = Math.max(LIST.min, width - EDITOR_MIN - (mode === "three" ? sideW + GAP * 2 : GAP));
  const listW = desk.listOpen ? clamp(desk.list ?? def.list, LIST.min, Math.min(LIST.max, listCap)) : SHUT;
  const sideCap = Math.max(SIDE.min, width - EDITOR_MIN - listW - GAP * 2);
  const sideFinal = mode === "three" && sideOpen ? Math.min(sideW, sideCap) : sideW;
  const update = useCallback((patch: Partial<DeskState>) => {
    setDesk((cur) => {
      const next = { ...cur, ...patch };
      writeDesk(next);
      return next;
    });
  }, []);
  return {
    desk,
    update,
    listW,
    sideW: sideFinal,
    limits: {
      list: { min: LIST.min, max: Math.min(LIST.max, listCap) },
      side: { min: SIDE.min, max: Math.min(SIDE.max, sideCap) },
    },
    defaults: def,
  };
}

/**
 * A panel divider. Drag moves it, double-tap/double-click puts the default size back (and reopens),
 * dragging well past the minimum folds the panel away, arrows nudge 16 px (Shift 48), Home resets.
 */
export function DeskDivider({
  value,
  min,
  max,
  dir,
  label,
  onSize,
  onReset,
  onFold,
  open,
}: {
  value: number;
  min: number;
  max: number;
  /** +1: dragging right grows the panel (left panel); -1: dragging left grows it (right panel). */
  dir: 1 | -1;
  label: string;
  onSize: (px: number, done: boolean) => void;
  onReset: () => void;
  onFold: () => void;
  open: boolean;
}) {
  const hold = useRef<{ x: number; w: number; moved: boolean; id: number } | null>(null);
  const lastTap = useRef(0);
  const [active, setActive] = useState(false);
  const [folding, setFolding] = useState(false);

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    hold.current = { x: e.clientX, w: value, moved: false, id: e.pointerId };
    setActive(true);
    document.documentElement.classList.add("bz-nb-dragging");
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const h = hold.current;
    if (!h || h.id !== e.pointerId) return;
    const dx = (e.clientX - h.x) * dir;
    if (Math.abs(dx) > 3) h.moved = true;
    if (!h.moved) return;
    const raw = h.w + dx;
    setFolding(open && raw < min - 72);
    onSize(clamp(raw, min, max), false);
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    const h = hold.current;
    if (!h || h.id !== e.pointerId) return;
    hold.current = null;
    setActive(false);
    document.documentElement.classList.remove("bz-nb-dragging");
    const raw = h.w + (e.clientX - h.x) * dir;
    if (h.moved) {
      lastTap.current = 0;
      if (open && raw < min - 72) {
        setFolding(false);
        onFold();
        return;
      }
      onSize(clamp(raw, min, max), true);
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 450) {
      lastTap.current = 0;
      onReset();
      return;
    }
    lastTap.current = now;
  }
  function key(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const sign = e.key === "ArrowRight" ? 1 : -1;
      onSize(clamp(value + sign * dir * step, min, max), true);
    } else if (e.key === "Home" || e.key === "Enter") {
      e.preventDefault();
      onReset();
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      data-no-swipe
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={() => {
        if (!hold.current) return;
        hold.current = null;
        setActive(false);
        setFolding(false);
        document.documentElement.classList.remove("bz-nb-dragging");
      }}
      onKeyDown={key}
      onDoubleClick={() => {
        lastTap.current = 0;
        onReset();
      }}
      className={cn("bz-nb-div", active && "is-active", folding && "is-folding")}
    >
      <span className="bz-nb-grip" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/** The folded strip of a panel: its icons stay, one tap opens it again. */
export function DeskStrip({ side, items }: { side: "left" | "right"; items: { icon: ReactNode; label: string; onClick: () => void }[] }) {
  return (
    <div className={cn("bz-nb-strip", side === "right" && "is-right")}>
      {items.map((it) => (
        <button key={it.label} type="button" aria-label={it.label} title={it.label} onClick={it.onClick} className="bz-nb-strip-btn">
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function stamp(page: PadPage) {
  return (page.updatedAt || page.createdAt || "").slice(0, 10);
}

/** Left panel: every note, pinned first, then by folder; search; new note; the cabinet one tap away. */
export function NotesListPanel({
  pages,
  folderOrder,
  currentId,
  drafting,
  draftTitle,
  onOpen,
  onNew,
  onCabinet,
  onFold,
}: {
  pages: PadPage[];
  folderOrder: string[];
  currentId: number | null;
  drafting: boolean;
  draftTitle: string;
  onOpen: (id: number) => void;
  onNew: () => void;
  onCabinet: () => void;
  onFold: () => void;
}) {
  const tx = useTx();
  const [q, setQ] = useState("");
  const [findOn, setFindOn] = useState(false);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = norm(q.trim());
  const shown = needle
    ? pages.filter((p) => norm(`${p.title} ${p.body.replace(/<[^>]+>/g, " ")}`).includes(needle))
    : pages;
  const byDate = (a: PadPage, b: PadPage) => stamp(b).localeCompare(stamp(a)) || b.id - a.id;
  const pinned = shown.filter((p) => p.pinned).sort(byDate);
  const rest = shown.filter((p) => !p.pinned);
  const names = [...folderOrder];
  for (const p of rest) if (!names.includes(p.folder || "No especificada")) names.push(p.folder || "No especificada");
  const groups = names
    .map((name) => ({ name, notes: rest.filter((p) => (p.folder || "No especificada") === name).sort(byDate) }))
    .filter((g) => g.notes.length > 0);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const row = (p: PadPage, showPin: boolean) => {
    const on = !drafting && p.id === currentId;
    const day = stamp(p);
    return (
      <li key={p.id}>
        <button
          ref={on ? activeRef : undefined}
          type="button"
          aria-current={on ? "true" : undefined}
          onClick={() => onOpen(p.id)}
          className={cn("bz-nb-row", on && "is-on")}
        >
          {showPin ? <Pin className="size-3.5 shrink-0 fill-current text-soil" aria-hidden /> : null}
          <span className="bz-nb-row-title">{p.title.trim() || tx("Nota", "Note")}</span>
          {day ? <span className="bz-nb-row-day">{formatDay(day, "d MMM")}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <section className="bz-nb-list" aria-label={tx("Notas", "Notes")}>
      <div className="bz-nb-head">
        <h2 className="bz-nb-title">{tx("Notas", "Notes")}</h2>
        <span className="bz-nb-count">{pages.length}</span>
        <span className="min-w-0 flex-1" />
        <button type="button" aria-pressed={findOn} aria-label={tx("Buscar notas", "Search notes")} onClick={() => { setFindOn((v) => !v); if (findOn) setQ(""); }} className={cn("bz-nb-icon", findOn && "is-on")}>
          <Search className="size-4.5" />
        </button>
        <button type="button" aria-label={tx("Abrir el fichero", "Open the cabinet")} onClick={onCabinet} className="bz-nb-icon">
          <FolderOpen className="size-4.5" />
        </button>
        <button type="button" aria-label={tx("Plegar la lista", "Fold the list")} onClick={onFold} className="bz-nb-icon">
          <PanelLeftClose className="size-4.5" />
        </button>
      </div>
      {findOn ? (
        <div className="bz-nb-find">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("Título o texto", "Title or text")}
            aria-label={tx("Buscar notas", "Search notes")}
          />
          {q ? (
            <button type="button" aria-label={tx("Borrar búsqueda", "Clear search")} onClick={() => setQ("")} className="grid size-8 shrink-0 place-items-center text-muted">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      <button type="button" onClick={onNew} className={cn("bz-nb-new", drafting && "is-on")} aria-current={drafting ? "true" : undefined}>
        <Plus className="size-4.5 shrink-0" aria-hidden />
        <span className="bz-nb-row-title">{drafting ? draftTitle.trim() || tx("Nota nueva", "New note") : tx("Nota nueva", "New note")}</span>
        {drafting ? <span className="bz-nb-row-day">{tx("Escribiendo", "Writing")}</span> : null}
      </button>
      <div className="bz-nb-scroll">
        {pinned.length ? (
          <div className="bz-nb-group">
            <p className="bz-nb-folder">
              <span>{tx("Fijadas", "Pinned")}</span>
              <span>{pinned.length}</span>
            </p>
            <ul>{pinned.map((p) => row(p, true))}</ul>
          </div>
        ) : null}
        {groups.map((g) => (
          <div key={g.name} className="bz-nb-group">
            <p className="bz-nb-folder">
              <span>{g.name}</span>
              <span>{g.notes.length}</span>
            </p>
            <ul>{g.notes.map((p) => row(p, false))}</ul>
          </div>
        ))}
        {shown.length === 0 ? (
          <p className="bz-nb-empty">{needle ? tx("Ninguna nota lo tiene.", "No note has it.") : tx("Todavía no hay notas guardadas.", "No saved notes yet.")}</p>
        ) : null}
      </div>
    </section>
  );
}

export type DeskStyle = CSSProperties & { "--nb-list"?: string; "--nb-side"?: string };
