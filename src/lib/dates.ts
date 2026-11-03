import { smartHit } from "@/lib/fuzzy";

export const APP_TZ = "America/New_York";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayISO(timeZone = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const dayFmt = new Map<string, Intl.DateTimeFormat>();

/** Calendar day (YYYY-MM-DD) of a moment, on the app's clock (same zone as todayISO),
 *  never the UTC day. A plain YYYY-MM-DD string is returned as is. */
export function stampDay(v: string | Date | null | undefined, timeZone = APP_TZ): string {
  if (v == null || v === "") return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  let f = dayFmt.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFmt.set(timeZone, f);
  }
  return f.format(d);
}

export function nowHHMM(timeZone = APP_TZ): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
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
  if (!Number.isFinite(hour) || hour > 23) return value;
  const suffix = hour >= 12 ? "p. m." : "a. m.";
  const h12 = hour % 12 || 12;
  return `${h12}:${match[2]} ${suffix}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthParts(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function addMonths(year: number, month: number, n: number) {
  const dt = new Date(Date.UTC(year, month - 1 + n, 1));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
}

export function weekdayFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function weekdayDatesInMonth(
  year: number,
  month: number,
  weekday: number,
): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= last; day += 1) {
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCDay() === weekday) {
      out.push(`${year}-${pad(month)}-${pad(day)}`);
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
  let guard = 0;
  while (cursor < rangeStart && guard < 800) {
    cursor = addDaysISO(cursor, step);
    guard += 1;
  }
  while (cursor <= rangeEnd && guard < 800) {
    out.push(cursor);
    cursor = addDaysISO(cursor, step);
    guard += 1;
  }
  return out;
}

export function sameMonthDay(startISO: string, year: number, month: number): string {
  const day = Number(startISO.slice(8, 10)) || 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = Math.min(Math.max(1, day), last);
  return `${year}-${pad(month)}-${pad(d)}`;
}

/** Days between cuts when the first cut is the start date. */
export function intervalDaysForCuts(cutsPerMonth: number): number | null {
  if (cutsPerMonth === 1) return null;
  if (cutsPerMonth === 2) return 14;
  if (cutsPerMonth === 3) return 10;
  if (cutsPerMonth === 4) return 7;
  return null;
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
  const monthStart = `${opts.year}-${pad(opts.month)}-01`;
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
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(y, m - 1, d + mondayOffset));
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6);
}

export function lastDayOfMonthISO(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(last)}`;
}

export function maxISO(a: string, b: string): string {
  return a > b ? a : b;
}

export function payDueISO(dueDay: number, fromISO: string): string {
  const { year, month } = monthParts(fromISO);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = Math.min(Math.max(1, Math.floor(dueDay) || 1), last);
  return `${year}-${pad(month)}-${pad(d)}`;
}

export function isPaymentLate(dueDay: number | null | undefined, today: string, balance: number): boolean {
  if (!dueDay || balance <= 0) return false;
  return today > payDueISO(dueDay, today);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + delta + (n - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  return `${year}-${pad(month)}-${pad(last.getUTCDate() - delta)}`;
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
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    const windowStart = `${year}-${opts.seasonStart}`;
    const wraps = opts.seasonStart > opts.seasonEnd;
    const windowEnd = wraps ? `${year + 1}-${opts.seasonEnd}` : `${year}-${opts.seasonEnd}`;
    const anchor = opts.anchor > windowStart ? opts.anchor : windowStart;
    for (const date of everyNDaysInRange(anchor, windowStart, windowEnd, every)) {
      if (date < opts.from || date > opts.until) continue;
      if (!inSeasonWindow(date, opts.seasonStart, opts.seasonEnd)) continue;
      out.push(date);
    }
  }
  return [...new Set(out)].sort();
}

