import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useBackClose } from "@/lib/back-close";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Brizna's own time and date pickers (Oscar: never the grey Android system dialog).
 * Same API as <input type="time|date">: value or defaultValue, onChange, onBlur, min, max.
 */

const fieldClass =
  "h-12 w-full rounded-sm bg-surface px-3 text-fg shadow-card transition-[box-shadow] duration-150 disabled:opacity-50";

type Props = InputHTMLAttributes<HTMLInputElement> & { type: "time" | "date"; noYear?: boolean; /** Presentación (B6): data-present anchor for the trigger, minted by the caller. */ "data-present"?: string };

function fakeEvent(value: string) {
  const target = { value } as HTMLInputElement;
  return { target, currentTarget: target } as unknown as ChangeEvent<HTMLInputElement> & FocusEvent<HTMLInputElement>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function todayIso() {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
}
function parseIso(v: string | undefined): { y: number; m: number; d: number } | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  return r ? { y: +r[1], m: +r[2] - 1, d: +r[3] } : null;
}
function parseTime(v: string | undefined): { h: number; min: number } | null {
  const r = /^(\d{1,2}):(\d{2})/.exec(v ?? "");
  return r ? { h: +r[1], min: +r[2] } : null;
}
function timeLabel(v: string, en: boolean) {
  const t = parseTime(v);
  if (!t) return "";
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  const ap = t.h >= 12 ? (en ? "PM" : "p.m.") : en ? "AM" : "a.m.";
  return `${h12}:${pad(t.min)} ${ap}`;
}
function dateLabel(v: string, en: boolean, long = false, noYear = false) {
  const p = parseIso(v);
  if (!p) return "";
  const d = new Date(p.y, p.m, p.d, 12);
  // Short label fits a half-width field on one line: "Tue, Nov 3" this year, "Jan 5, 2027" another year.
  const thisYear = p.y === new Date().getFullYear();
  const short: Intl.DateTimeFormatOptions = noYear ? { day: "numeric", month: "short" } : thisYear ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" };
  if (!long && !en) {
    // Spanish without the "de" fillers: "mar, 3 nov" / "6 ene 2027".
    const parts = new Intl.DateTimeFormat("es-US", short).formatToParts(d);
    const get = (t: string) => parts.find((x) => x.type === t)?.value.replace(".", "") ?? "";
    const dm = `${get("day")} ${get("month")}`;
    return short.year ? `${dm} ${get("year")}` : short.weekday ? `${get("weekday")}, ${dm}` : dm;
  }
  return new Intl.DateTimeFormat(en ? "en-US" : "es-US", long ? (noYear ? { day: "numeric", month: "long" } : { weekday: "long", day: "numeric", month: "long" }) : short).format(d);
}

export function PickerField({ type, noYear, value, defaultValue, onChange, onBlur, min, max, className, disabled, required, id, "aria-label": ariaLabel, "data-present": dataPresent }: Props) {
  const { locale } = useI18n();
  const en = locale === "en";
  const controlled = value !== undefined;
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  useEffect(() => {
    if (!controlled) setInner(String(defaultValue ?? ""));
  }, [defaultValue, controlled]);
  const cur = controlled ? String(value ?? "") : inner;
  const [open, setOpen] = useState(false);

  const commit = (next: string) => {
    setOpen(false);
    if (!controlled) setInner(next);
    if (next !== cur) onChange?.(fakeEvent(next));
    onBlur?.(fakeEvent(next));
  };

  const label = type === "time" ? timeLabel(cur, en) : dateLabel(cur, en, false, noYear);
  const Icon = type === "time" ? Clock : CalendarDays;
  return (
    <>
      <button
        type="button"
        id={id}
        data-present={dataPresent}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(fieldClass, "bz-pf-trigger flex items-center justify-between gap-2 text-left text-base font-semibold", className)}
      >
        <span className={cn("truncate", !label && "font-normal text-subtle")}>
          {label || (type === "time" ? (en ? "Pick a time" : "Elegir hora") : en ? "Pick a day" : "Elegir día")}
        </span>
        <Icon className="size-[1.1rem] shrink-0 text-primary" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            type === "time" ? (
              <TimeSheet value={cur} en={en} required={required} onCancel={() => setOpen(false)} onDone={commit} />
            ) : (
              <DateSheet value={cur} en={en} noYear={noYear} min={min as string | undefined} max={max as string | undefined} required={required} onCancel={() => setOpen(false)} onDone={commit} />
            ),
            document.body,
          )
        : null}
    </>
  );
}

function Sheet({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  const titleId = useId();
  useBackClose(true, onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[120] grid place-items-end p-3 sm:place-items-center" data-no-fold="">
      <button type="button" aria-label={title} className="absolute inset-0 bz-scrim" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bz-pf-sheet relative w-full max-w-md">
        <p id={titleId} className="sr-only">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

function Foot({ en, onCancel, onDone, left }: { en: boolean; onCancel: () => void; onDone: () => void; left?: React.ReactNode }) {
  return (
    <div className="bz-pf-foot">
      <div className="min-w-0 flex-1">{left}</div>
      <button type="button" className="bz-pf-text" onClick={onCancel}>
        {en ? "Cancel" : "Cancelar"}
      </button>
      <button type="button" className="bz-pf-done" onClick={onDone}>
        {en ? "Done" : "Listo"}
      </button>
    </div>
  );
}

function TimeSheet({ value, en, required, onCancel, onDone }: { value: string; en: boolean; required?: boolean; onCancel: () => void; onDone: (v: string) => void }) {
  const start = parseTime(value) ?? { h: 8, min: 0 };
  const [h, setH] = useState(start.h);
  const [min, setMin] = useState(start.min);
  const pm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const setH12 = (n: number) => setH((n % 12) + (pm ? 12 : 0));
  const setPm = (next: boolean) => setH((h % 12) + (next ? 12 : 0));
  const out = `${pad(h)}:${pad(min)}`;
  return (
    <Sheet title={en ? "Time" : "Hora"} onCancel={onCancel}>
      <div className="bz-pf-head">
        <span className="bz-pf-big">
          {h12}:{pad(min)}
        </span>
        <div className="bz-pf-seg" role="group">
          <button type="button" className={cn(!pm && "is-on")} aria-pressed={!pm} onClick={() => setPm(false)}>
            {en ? "AM" : "a.m."}
          </button>
          <button type="button" className={cn(pm && "is-on")} aria-pressed={pm} onClick={() => setPm(true)}>
            {en ? "PM" : "p.m."}
          </button>
        </div>
      </div>
      <p className="bz-pf-cap">{en ? "Hour" : "Hora"}</p>
      <div className="bz-pf-grid">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={cn("bz-pf-cell", h12 === n && "is-on")} aria-pressed={h12 === n} onClick={() => setH12(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="bz-pf-cap">{en ? "Minutes" : "Minutos"}</p>
      <div className="bz-pf-grid">
        {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => (
          <button key={n} type="button" className={cn("bz-pf-cell", min === n && "is-on")} aria-pressed={min === n} onClick={() => setMin(n)}>
            :{pad(n)}
          </button>
        ))}
      </div>
      <Foot
        en={en}
        onCancel={onCancel}
        onDone={() => onDone(out)}
        left={
          !required && value ? (
            <button type="button" className="bz-pf-text" onClick={() => onDone("")}>
              {en ? "Clear" : "Borrar"}
            </button>
          ) : null
        }
      />
    </Sheet>
  );
}

function DateSheet({
  value,
  en,
  min,
  max,
  required,
  noYear,
  onCancel,
  onDone,
}: {
  value: string;
  en: boolean;
  noYear?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  onCancel: () => void;
  onDone: (v: string) => void;
}) {
  const today = todayIso();
  const [sel, setSel] = useState(parseIso(value) ? value : today);
  const s = parseIso(sel)!;
  const [view, setView] = useState({ y: s.y, m: s.m });
  const first = new Date(view.y, view.m, 1).getDay(); // Sunday first
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat(en ? "en-US" : "es-US", { month: "long", year: "numeric" }).format(new Date(view.y, view.m, 15));
  const wk = en ? ["S", "M", "T", "W", "T", "F", "S"] : ["D", "L", "M", "M", "J", "V", "S"];
  const shift = (n: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const out = (iso: string) => (min && iso < min) || (max && iso > max);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <Sheet title={en ? "Day" : "Día"} onCancel={onCancel}>
      <div className="bz-pf-head">
        <span className="bz-pf-big bz-pf-big-date">{dateLabel(sel, en, true, noYear)}</span>
      </div>
      <div className="bz-pf-month">
        <button type="button" className="bz-pf-nav" aria-label={en ? "Previous month" : "Mes anterior"} onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden />
        </button>
        <span className="bz-pf-month-name">{monthName}</span>
        <button type="button" className="bz-pf-nav" aria-label={en ? "Next month" : "Mes siguiente"} onClick={() => shift(1)}>
          <ChevronRight aria-hidden />
        </button>
      </div>
      <div className="bz-pf-cal" role="grid">
        {wk.map((w, i) => (
          <span key={`w${i}`} className="bz-pf-wk">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <span key={`b${i}`} />;
          const iso = isoOf(view.y, view.m, d);
          const off = Boolean(out(iso));
          return (
            <button
              key={iso}
              type="button"
              disabled={off}
              className={cn("bz-pf-day", iso === sel && "is-on", iso === today && "is-today")}
              aria-pressed={iso === sel}
              onClick={() => setSel(iso)}
            >
              {d}
            </button>
          );
        })}
      </div>
      <Foot
        en={en}
        onCancel={onCancel}
        onDone={() => onDone(sel)}
        left={
          <span className="flex items-center gap-1">
            <button
              type="button"
              className="bz-pf-text"
              onClick={() => {
                const t = parseIso(today)!;
                setSel(today);
                setView({ y: t.y, m: t.m });
              }}
            >
              {en ? "Today" : "Hoy"}
            </button>
            {!required && value ? (
              <button type="button" className="bz-pf-text" onClick={() => onDone("")}>
                {en ? "Clear" : "Borrar"}
              </button>
            ) : null}
          </span>
        }
      />
    </Sheet>
  );
}
