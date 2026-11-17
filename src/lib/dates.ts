import { smartHit } from "@/lib/fuzzy";
import { readStoredLocale } from "@/lib/theme";

/* Ola 5 (BZ-45, decisión de Oscar): UN SOLO RELOJ — manda la zona del
 * aparato en todo. Antes todayISO vivía clavado a America/New_York mientras
 * los avisos y los widgets vivían en la zona del teléfono: en el panhandle
 * (Central) o de viaje, el «hoy» de la app y el de los avisos se
 * contradecían. Sin argumento, estas funciones leen el día y la hora EN LA
 * ZONA DEL APARATO; la zona explícita queda solo para quien la pida. */
export function deviceTZ(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/* 1.6.44 (Prejuicio R12, R13B): el año de TODA salida ISO viaja
 * con relleno a cuatro — la familia calculaba con el año literal
 * (utcLiteral, 1.6.40) pero lo escribía desnudo («99-01-15»), y
 * cada comparación de cadenas aguas abajo leía otro siglo: el
 * avance del vencimiento que manda no avanzaba, el atraso jamás
 * disparaba, la cota de vacationHonored quedaba muerta y los
 * rangos de la vista previa corrían sobre 1999. */
function padYear(y: number) {
  return String(y).padStart(4, "0");
}

export function todayISO(timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const dayFmt = new Map<string, Intl.DateTimeFormat>();

/** Calendar day (YYYY-MM-DD) of a moment, on the app's clock (the device's zone,
 *  same as todayISO), never the UTC day. A plain YYYY-MM-DD string is returned as is. */
export function stampDay(v: string | Date | null | undefined, timeZone?: string): string {
  if (v == null || v === "") return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const key = timeZone ?? "device";
  let f = dayFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { ...(timeZone ? { timeZone } : {}), year: "numeric", month: "2-digit", day: "2-digit" });
    dayFmt.set(key, f);
  }
  return f.format(d);
}

export function nowHHMM(timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === "hour")?.value ?? "08";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function clock12(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value;
  const hour = Number(match[1]);
  // 1.5.50 (auditoría interna, P1): the minutes count too — "12:99" used to render as
  // "12:99 p. m.", a fabricated time. An impossible stored time now shows as it is.
  if (!Number.isFinite(hour) || hour > 23 || Number(match[2]) > 59) return value;
  const suffix = readStoredLocale() === "en" ? (hour >= 12 ? "PM" : "AM") : hour >= 12 ? "p. m." : "a. m.";
  const h12 = hour % 12 || 12;
  return `${h12}:${match[2]} ${suffix}`;
}

/** 1.5.50 (auditoría interna, P1): shape AND existence. "2026-02-30" is shaped like a
 *  date and is not one; the old gates checked the shape only, so an impossible date
 *  travelled until the database's ::date cast killed the whole operation with an error
 *  that never named the cause. Round-trips through Date.UTC: a rolled-over result is a
 *  different day than the one written, so it is not real. */
/* 1.6.40 (Prejuicio R11, familia R12B): Date.UTC lee los años
 * 0–99 como 1900+año. La cura de 1.6.37 restauraba el año en
 * addDaysISO con un espejo (−1900) que el febrero del año 0000
 * rompía (1900 no es bisiesto; el 0 sí), y sus hermanas —
 * weekdayFromISO, addMonths, las de último día y semana — nunca
 * recibieron ni eso: un ancla restaurada de la banda sembraba en
 * el día de semana de 1999 y su vista de cortes salía vacía. Toda
 * fecha construida desde un año de datos nace ahora por aquí:
 * setUTCFullYear fija el año LITERAL, con su propio febrero. */
export function utcLiteral(y: number, m0: number, d: number): Date {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m0, d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

export function isRealISODate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = utcLiteral(y, mo - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/* 1.6.40 (Prejuicio R11, R12B-2): el espejo cliente de
 * validVacation (server/lawn.ts) — los anuncios de Hoy y Agenda
 * solo proclaman la bandera que el motor honra (fin ≥ inicio y
 * tramo inclusivo ≤ 180, es decir diff < 180). El editor de
 * Ajustes lee la bandera cruda y conserva su poder de quitarla. */
export function vacationHonored(start: string | null | undefined, end: string | null | undefined): boolean {
  return !!start && !!end && end >= start && addDaysISO(start, 180) > end;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // 1.6.40: nace por utcLiteral (ver arriba) — el espejo −1900 de
  // 1.6.37 (R11B-2) restauraba el año pero heredaba el febrero de
  // 1900: sobre 0000-02-29 la identidad devolvía 0000-03-01
  // (R12B-5). setUTCDate suma los días sobre el año verdadero.
  const dt = utcLiteral(y, m - 1, d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${padYear(dt.getUTCFullYear())}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthParts(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function addMonths(year: number, month: number, n: number) {
  // 1.6.40 (R12B-4): aritmética pura — vía Date.UTC el año 99 + 1
  // mes daba 1999 y la vista previa de cortes salía vacía.
  const total = year * 12 + (month - 1) + n;
  const y = Math.floor(total / 12);
  return { year: y, month: total - y * 12 + 1 };
}

export function weekdayFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  // 1.6.40 (R12B-1): el día de semana se lee del año LITERAL — la
  // generación deriva el día del start_date crudo, y un ancla
  // restaurada de la banda sembraba en el día de 19xx para siempre.
  return utcLiteral(y, m - 1, d).getUTCDay();
}

export function weekdayDatesInMonth(
  year: number,
  month: number,
  weekday: number,
): string[] {
  const out: string[] = [];
  const last = utcLiteral(year, month, 0).getUTCDate();
  for (let day = 1; day <= last; day += 1) {
    const dt = utcLiteral(year, month - 1, day);
    if (dt.getUTCDay() === weekday) {
      out.push(`${padYear(year)}-${pad(month)}-${pad(day)}`);
    }
  }
  return out;
}

export function cutsForMonth(
  year: number,
  month: number,
  weekday: number,
  freq: 1 | 2 | 3,
): string[] {
  const all = weekdayDatesInMonth(year, month, weekday);
  if (freq === 1) return all.slice(0, 1);
  if (freq === 2) {
    if (all.length >= 3) return [all[0]!, all[2]!];
    return all.slice(0, 2);
  }
  return all.slice(0, 3);
}

export function everyNDaysInRange(
  startISO: string,
  rangeStart: string,
  rangeEnd: string,
  n: number,
): string[] {
  const step = Math.max(1, Math.floor(n) || 1);
  const out: string[] = [];
  let cursor = startISO;
  // 1.5.51 (auditoría interna, P2): the jump from the anchor to the range is ARITHMETIC
  // now. It used to walk one step at a time under the same 800-step guard as the
  // enumeration, so a daily client anchored more than 800 days ago spent the whole
  // guard jumping and got ZERO dates back — silently: no future visits, no error, no
  // trace, and the client quietly stopped being scheduled.
  if (cursor < rangeStart) {
    const diffDays = Math.round((Date.parse(rangeStart) - Date.parse(cursor)) / 86_400_000);
    if (Number.isFinite(diffDays) && diffDays > 0) {
      cursor = addDaysISO(cursor, Math.ceil(diffDays / step) * step);
    }
  }
  // The enumeration keeps its own guard, sized by the range it has to cover.
  const spanDays = Math.max(0, Math.round((Date.parse(rangeEnd) - Date.parse(cursor)) / 86_400_000));
  let guard = Math.floor(spanDays / step) + 2;
  while (cursor <= rangeEnd && guard > 0) {
    out.push(cursor);
    cursor = addDaysISO(cursor, step);
    guard -= 1;
  }
  return out;
}

export function sameMonthDay(startISO: string, year: number, month: number): string {
  const day = Number(startISO.slice(8, 10)) || 1;
  const last = utcLiteral(year, month, 0).getUTCDate();
  const d = Math.min(Math.max(1, day), last);
  return `${padYear(year)}-${pad(month)}-${pad(d)}`;
}

/** Days between cuts when the first cut is the start date. */
export function intervalDaysForCuts(cutsPerMonth: number): number | null {
  if (cutsPerMonth === 1) return null;
  if (cutsPerMonth === 2) return 14;
  if (cutsPerMonth === 3) return 10;
  if (cutsPerMonth === 4) return 7;
  return null;
}

/**
 * Visits per month for a regular client — ONE count for the whole house
 * (Asesor, Estudio, exportación): the same rhythm the agenda actually seeds.
 * A custom frequency rules first (30.44 ÷ its days); otherwise the count
 * derives from the seeding interval above: every 14 days ≈ 2.17, every 10
 * ≈ 3.04, weekly ≈ 4.35, two weekdays a week ≈ 8.70, monthly = 1. The old
 * per-screen copies read the card's cutsPerMonth raw (weekly counted 4,
 * twice-a-week counted 5) and understated the month's floor.
 */
export function monthlyVisitsFor(cutsPerMonth: number, frequencyDays: number | null): number {
  if (frequencyDays && frequencyDays > 0) return 30.44 / frequencyDays;
  if (!(cutsPerMonth > 0)) return 0;
  if (cutsPerMonth === 5) return (2 * 30.44) / 7;
  const interval = intervalDaysForCuts(cutsPerMonth);
  if (interval != null) return 30.44 / interval;
  return 1;
}

export function scheduleDatesForMonth(opts: {
  year: number;
  month: number;
  weekday: number;
  weekday2?: number | null;
  cutsPerMonth: number;
  frequencyDays?: number | null;
  startDate?: string | null;
  today: string;
}): string[] {
  const monthStart = `${padYear(opts.year)}-${pad(opts.month)}-01`;
  const monthEnd = lastDayOfMonthISO(opts.year, opts.month);
  const anchor = opts.startDate && opts.startDate.length >= 8 ? opts.startDate : opts.today;
  const minDate = anchor > opts.today ? anchor : opts.today;
  const weekday = opts.startDate ? weekdayFromISO(opts.startDate) : opts.weekday;

  let dates: string[] = [];
  if (opts.frequencyDays && opts.frequencyDays > 0) {
    dates = everyNDaysInRange(anchor, monthStart, monthEnd, opts.frequencyDays);
  } else if (opts.cutsPerMonth === 5) {
    const first = weekdayDatesInMonth(opts.year, opts.month, weekday);
    const second =
      opts.weekday2 != null && opts.weekday2 !== weekday
        ? weekdayDatesInMonth(opts.year, opts.month, opts.weekday2)
        : [];
    dates = [...new Set([...first, ...second])].sort();
  } else if (opts.cutsPerMonth === 1) {
    dates = [sameMonthDay(anchor, opts.year, opts.month)];
  } else {
    const interval = intervalDaysForCuts(opts.cutsPerMonth) ?? 14;
    dates = everyNDaysInRange(anchor, monthStart, monthEnd, interval);
  }
  return dates.filter((d) => d >= minDate);
}

export function previewUpcomingCuts(opts: {
  weekday: number;
  weekday2?: number | null;
  cutsPerMonth: number;
  frequencyDays?: number | null;
  startDate?: string | null;
  today: string;
  count?: number;
}): string[] {
  const start = opts.startDate && opts.startDate.length >= 8 ? opts.startDate : opts.today;
  const { year, month } = monthParts(start);
  const months = [0, 1, 2, 3].map((n) => addMonths(year, month, n));
  const dates: string[] = [];
  for (const m of months) {
    dates.push(
      ...scheduleDatesForMonth({
        year: m.year,
        month: m.month,
        weekday: opts.weekday,
        weekday2: opts.weekday2,
        cutsPerMonth: opts.cutsPerMonth,
        frequencyDays: opts.frequencyDays,
        startDate: start,
        today: opts.today,
      }),
    );
  }
  const unique = [...new Set(dates)].sort();
  return unique.slice(0, opts.count ?? 4);
}

export function startOfWeekISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = utcLiteral(y, m - 1, d);
  const day = dt.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = utcLiteral(y, m - 1, d + mondayOffset);
  return `${padYear(monday.getUTCFullYear())}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6);
}

export function lastDayOfMonthISO(year: number, month: number): string {
  const last = utcLiteral(year, month, 0).getUTCDate();
  return `${padYear(year)}-${pad(month)}-${pad(last)}`;
}

export function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

export function payDueISO(dueDay: number, fromISO: string): string {
  const { year, month } = monthParts(fromISO);
  const last = utcLiteral(year, month, 0).getUTCDate();
  const d = Math.min(Math.max(1, Math.floor(dueDay) || 1), last);
  return `${padYear(year)}-${pad(month)}-${pad(d)}`;
}

/* Ola 5 (BZ-15): el vencimiento que MANDA para decir «atrasado». Antes
 * isPaymentLate comparaba solo contra el vencimiento de ESTE mes: el día 1,
 * toda deuda impaga dejaba de estar atrasada hasta que pasaba el nuevo
 * vencimiento (amnesia de calendario). Ahora: si se conoce desde cuándo vive
 * la deuda (unpaidSince), manda el PRIMER vencimiento que la deuda no
 * cumplió — los días cuentan desde ahí, sin reinicio el día 1 ni el día
 * después del vencimiento. Sin esa fecha (deuda inicial), manda el último
 * vencimiento ya pasado. El día de pago en sí nunca es atraso: el atraso
 * empieza al día siguiente del vencimiento que manda. */
export function governingDueISO(dueDay: number, today: string, unpaidSince?: string | null): string {
  if (unpaidSince) {
    // 1.6.37 (Prejuicio R10, R11B-1): the governing date is computed
    // as always — the first due date on or after the debt's birth —
    // but it is never allowed past the calendar's edge: a restored
    // birth in December 9999 used to make this function answer
    // «10000-01-10», a string string-comparison reads as OLDER than
    // today (a future debt collected as late) and Date.parse reads
    // as NaN. Clamped to 9999-12-31 the debt is simply not late yet.
    let due = payDueISO(dueDay, unpaidSince);
    if (due < unpaidSince) {
      const { year, month } = monthParts(unpaidSince);
      const next = month === 12 ? `${padYear(year + 1)}-01-15` : `${padYear(year)}-${pad(month + 1)}-15`;
      due = payDueISO(dueDay, next);
    }
    return due.length > 10 ? "9999-12-31" : due;
  }
  const thisDue = payDueISO(dueDay, today);
  if (today > thisDue) return thisDue;
  const { year, month } = monthParts(today);
  const prev = month === 1 ? `${padYear(year - 1)}-12-15` : `${padYear(year)}-${pad(month - 1)}-15`;
  return payDueISO(dueDay, prev);
}

export function isPaymentLate(
  dueDay: number | null | undefined,
  today: string,
  balance: number,
  unpaidSince?: string | null,
): boolean {
  if (!dueDay || balance <= 0) return false;
  return today > governingDueISO(dueDay, today, unpaidSince);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = utcLiteral(year, month - 1, 1);
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + delta + (n - 1) * 7;
  return `${padYear(year)}-${pad(month)}-${pad(day)}`;
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = utcLiteral(year, month, 0);
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  return `${padYear(year)}-${pad(month)}-${pad(last.getUTCDate() - delta)}`;
}

/** Major US holidays plus Nochebuena and víspera. Soft label only — never hides a count. */
export function holidayName(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const year = Number(iso.slice(0, 4));
  const md = iso.slice(5);
  const fixed: Record<string, string> = {
    "01-01": "Año Nuevo",
    "06-19": "Juneteenth",
    "07-04": "Independencia",
    "11-11": "Día de los Veteranos",
    "12-24": "Nochebuena",
    "12-25": "Navidad",
    "12-31": "Víspera de Año Nuevo",
  };
  if (fixed[md]) return fixed[md];
  if (iso === nthWeekday(year, 1, 1, 3)) return "Martin Luther King";
  if (iso === nthWeekday(year, 2, 1, 3)) return "Día de los Presidentes";
  if (iso === lastWeekday(year, 5, 1)) return "Memorial Day";
  if (iso === nthWeekday(year, 9, 1, 1)) return "Día del Trabajo";
  if (iso === nthWeekday(year, 10, 1, 2)) return "Día de la Raza";
  const thanks = nthWeekday(year, 11, 4, 4);
  if (iso === thanks) return "Thanksgiving";
  if (iso === addDaysISO(thanks, 1)) return "Viernes de Thanksgiving";
  return null;
}

const HOLIDAY_ALIASES: Record<string, string> = {
  "Año Nuevo": "new year ano nuevo enero first",
  Juneteenth: "juneteenth junio freedom",
  Independencia: "july 4 julio cuatro independencia fourth",
  "Día de los Veteranos": "veteranos veterans noviembre",
  Nochebuena: "nochebuena christmas eve vispera diciembre",
  Navidad: "navidad christmas noel xmas diciembre",
  "Víspera de Año Nuevo": "vispera new year eve diciembre",
  "Martin Luther King": "mlk martin king enero",
  "Día de los Presidentes": "presidentes presidents febrero",
  "Memorial Day": "memorial mayo fallen",
  "Día del Trabajo": "labor day trabajo septiembre",
  "Día de la Raza": "raza columbus octubre",
  Thanksgiving: "thanksgiving pavo accion de gracias noviembre",
  "Viernes de Thanksgiving": "black friday viernes thanksgiving",
};

export function holidayHits(query: string, year: number): { iso: string; name: string }[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const found: { iso: string; name: string }[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const last = Number(lastDayOfMonthISO(year, month).slice(8));
    for (let day = 1; day <= last; day += 1) {
      const iso = `${padYear(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const name = holidayName(iso);
      if (!name) continue;
      const blob = `${name} ${HOLIDAY_ALIASES[name] ?? ""}`;
      if (smartHit(q, blob)) found.push({ iso, name });
    }
  }
  return found;
}

export function inSeasonWindow(iso: string, startMMDD: string, endMMDD: string): boolean {
  const md = iso.slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(startMMDD) || !/^\d{2}-\d{2}$/.test(endMMDD)) return false;
  if (startMMDD <= endMMDD) return md >= startMMDD && md <= endMMDD;
  return md >= startMMDD || md <= endMMDD;
}

/** Cuts inside a season window, every N days, without adding dates outside it. */
export function seasonCuts(opts: {
  seasonStart: string;
  seasonEnd: string;
  every: number;
  anchor: string;
  from: string;
  until: string;
}): string[] {
  const every = Math.max(1, Math.floor(opts.every) || 1);
  const startYear = Number(opts.from.slice(0, 4)) - 1;
  const endYear = Number(opts.until.slice(0, 4)) + 1;
  const out: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const windowStart = `${padYear(year)}-${opts.seasonStart}`;
    const wraps = opts.seasonStart > opts.seasonEnd;
    const windowEnd = wraps ? `${padYear(year + 1)}-${opts.seasonEnd}` : `${padYear(year)}-${opts.seasonEnd}`;
    const anchor = opts.anchor > windowStart ? opts.anchor : windowStart;
    for (const date of everyNDaysInRange(anchor, windowStart, windowEnd, every)) {
      if (date < opts.from || date > opts.until) continue;
      if (!inSeasonWindow(date, opts.seasonStart, opts.seasonEnd)) continue;
      out.push(date);
    }
  }
  return [...new Set(out)].sort();
}

