import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { readStoredLocale } from "@/lib/theme";

function english() {
  return readStoredLocale() === "en";
}

function dateLocale() {
  return english() ? enUS : es;
}

export function money(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return `$${Math.round(rounded).toLocaleString("en-US")}`;
  }
  return `$${rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDay(iso: string, pattern = "EEE d MMM"): string {
  try {
    return format(parseISO(iso), pattern, { locale: dateLocale() });
  } catch {
    return iso;
  }
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  // Day from the same local clock as the hour (not the UTC day of the ISO text).
  let day: string;
  try {
    day = format(date, "d MMM yyyy", { locale: dateLocale() });
  } catch {
    day = iso.slice(0, 10);
  }
  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const suffix = english() ? (hour >= 12 ? "PM" : "AM") : hour >= 12 ? "p. m." : "a. m.";
  hour = hour % 12 || 12;
  return `${day}, ${hour}:${minute}:${second} ${suffix}`;
}

export function formatLongDay(iso: string): string {
  return formatDay(iso, english() ? "EEEE, MMMM d" : "EEEE d 'de' MMMM");
}

export function formatTime(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = m[2];
  const suffix = english() ? (h >= 12 ? "PM" : "AM") : h >= 12 ? "p.m." : "a.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return min === "00" ? `${h} ${suffix}` : `${h}:${min} ${suffix}`;
}

export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : `tel:${phone}`;
}

export function smsHref(phone: string, body = ""): string {
  const cleaned = phone.replace(/[^\d+]/g, "") || phone;
  if (!body.trim()) return `sms:${cleaned}`;
  return `sms:${cleaned}?body=${encodeURIComponent(body)}`;
}

export function waHref(phone: string, text = ""): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const n = digits.length === 10 ? `1${digits}` : digits;
  const base = `https://wa.me/${n}`;
  const body = text.trim();
  return body ? `${base}?text=${encodeURIComponent(body)}` : base;
}

export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function payDueLabel(day: number | null | undefined): string | null {
  if (!day) return null;
  return english() ? `Pays on the ${day} of each month` : `Paga el ${day} de cada mes`;
}

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

const WEEKDAYS_EN: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export function weekdayOptions() {
  return english() ? WEEKDAYS_EN : WEEKDAYS;
}

export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthNames() {
  return english() ? MONTHS_EN : MONTHS_ES;
}

export function weekdayLabel(value: number): string {
  return weekdayOptions().find((d) => d.value === value)?.label ?? (english() ? "Monday" : "Lunes");
}

export function frequencyLabel(
  freq: number,
  extra?: { frequencyDays?: number | null; weekday2?: number | null },
): string {
  if (extra?.frequencyDays && extra.frequencyDays > 0) {
    if (english()) {
      return extra.frequencyDays === 1 ? "Every day" : `Every ${extra.frequencyDays} days`;
    }
    return extra.frequencyDays === 1 ? "Todos los días" : `Cada ${extra.frequencyDays} días`;
  }
  if (english()) {
    if (freq === 1) return "Once a month";
    if (freq === 3) return "3 times a month";
    if (freq === 4) return "Every week";
    if (freq === 5) return "Twice a week";
    return "Every 2 weeks";
  }
  if (freq === 1) return "1 vez al mes";
  if (freq === 3) return "3 veces al mes";
  if (freq === 4) return "Cada semana";
  if (freq === 5) return "2 veces por semana";
  return "Cada 2 semanas";
}

/** Title the app stores on every scheduled cut; shown in the current language, never rewritten. */
export const DEFAULT_CUT_TITLE = "Corte de césped";

export function jobKindLabel(kind: string, title?: string | null): string {
  const own = title?.trim();
  if (own && own !== DEFAULT_CUT_TITLE) return own;
  if (own === DEFAULT_CUT_TITLE) return english() ? "Lawn cut" : DEFAULT_CUT_TITLE;
  if (english()) {
    if (kind === "extra") return "Extra job";
    if (kind === "one_time") return "One-time job";
    return "Lawn cut";
  }
  if (kind === "extra") return "Trabajo extra";
  if (kind === "one_time") return "Trabajo único";
  return "Corte de césped";
}

export const PRODUCT_NAME = "Brizna";
export const DEFAULT_BUSINESS_NAME = "Oscar's Lawn Service";
