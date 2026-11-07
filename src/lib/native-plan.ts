/**
 * 1.4.97 Brizna for Android: the reminder schedule and the "Hoy" widget, worked out on the device from Brizna's own
 * data and handed to the app (BriznaNative.setSchedule / setWidget). No server: the app keeps the list and fires it
 * with Android alarms, even with Brizna closed or after a restart. Runs only inside the app (see components/native-host).
 *
 * Reminder kinds (each can be turned off in Ajustes, Notificaciones):
 * - cortes: the evening before each of the next 8 days with cuts, at the chosen hour (19:00 by default).
 * - pagos: 7:30 a.m. on the day of the month a client pays (pay day 31 falls on the month's last day).
 * - riesgo: the next 7:30 a.m.: late cuts (today's still open ones count, they will be late by then) and Alto riesgo.
 * - lluvia: 7:30 a.m. on the day the yards moved by rain land on.
 */
import { formatDay, formatTime, money } from "@/lib/format";
import { readAppearance } from "@/lib/theme";
import type { NativePlan } from "@/lib/server/lawn";

export type NotifyPrefs = { cuts: boolean; pay: boolean; risk: boolean; rain: boolean; hour: string };
export const NOTIFY_DEFAULT: NotifyPrefs = { cuts: true, pay: true, risk: true, rain: true, hour: "19:00" };
const KEY = "brizna.notify";
export const MORNING = "7:30";

export function readNotifyPrefs(): NotifyPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<NotifyPrefs> | null;
    if (!raw) return { ...NOTIFY_DEFAULT };
    const hour = typeof raw.hour === "string" && /^\d{1,2}:\d{2}$/.test(raw.hour) ? raw.hour : NOTIFY_DEFAULT.hour;
    return {
      cuts: raw.cuts !== false,
      pay: raw.pay !== false,
      risk: raw.risk !== false,
      rain: raw.rain !== false,
      hour,
    };
  } catch {
    return { ...NOTIFY_DEFAULT };
  }
}

export function writeNotifyPrefs(next: NotifyPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new Event("bz-notify-prefs"));
}

export type PlanItem = { id: string; at: number; kind: "cortes" | "pagos" | "riesgo" | "lluvia"; title: string; body: string; route: string };

const en = () => typeof document !== "undefined" && document.documentElement.lang === "en";
const tx = (es: string, eng: string) => (en() ? eng : es);

function at(date: string, hhmm: string, addDays = 0): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y!, m! - 1, d! + addDays, h!, mi!, 0, 0).getTime();
}

/** "Ana, Luis y Carmen" / "Ana, Luis, Carmen y 2 más" (never an ellipsis). */
export function joinNames(names: string[], max = 4): string {
  const and = tx(" y ", " and ");
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= max) return `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`;
  const rest = names.length - (max - 1);
  return `${names.slice(0, max - 1).join(", ")}${and}${rest} ${tx("más", "more")}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** One closing period, never two ("2 p.m." stays as it is). */
const dot = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
/** A client with two jobs the same day (a cut and an extra) is named once. */
const once = (names: string[]) => [...new Set(names)];

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(y!, m!, 0).getDate();
}

export function buildSchedule(plan: NativePlan, prefs: NotifyPrefs, now = Date.now()): PlanItem[] {
  const out: PlanItem[] = [];
  const push = (it: PlanItem) => { if (it.at > now) out.push(it); };
  for (const day of plan.days) {
    if (prefs.cuts && day.date > plan.today && day.cuts.length) {
      const rain = day.cuts.filter((c) => c.rain).length;
      const seen = new Set<string>();
      const names = day.cuts.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true))).map((c) => {
        const t = formatTime(c.time);
        return t ? `${c.name} ${t}` : c.name;
      });
      const body = dot(joinNames(names)) + (rain ? ` ${rain === 1 ? tx("1 viene de la lluvia.", "1 comes from the rain.") : tx(`${rain} vienen de la lluvia.`, `${rain} come from the rain.`)}` : "");
      push({
        id: `cortes-${day.date}`,
        at: at(day.date, prefs.hour, -1),
        kind: "cortes",
        title: tx(`Mañana: ${plural(day.cuts.length, "corte", "cortes")}`, `Tomorrow: ${plural(day.cuts.length, "cut", "cuts")}`),
        body,
        route: "/agenda",
      });
    }
    if (prefs.pay) {
      const dom = Number(day.date.slice(8));
      const last = daysInMonth(day.date);
      const who = plan.pay.filter((p) => p.day === dom || (dom === last && p.day > last));
      if (who.length) {
        const names = who.map((p) => (p.balance > 0 ? `${p.name} (${money(p.balance)})` : p.name));
        const title = who.length === 1
          ? tx(`Hoy paga ${who[0]!.name}`, `${who[0]!.name} pays today`)
          : tx(`Hoy pagan ${who.length} clientes`, `${who.length} clients pay today`);
        push({
          id: `pagos-${day.date}`,
          at: at(day.date, MORNING),
          kind: "pagos",
          title,
          body: who.length === 1 ? (who[0]!.balance > 0 ? tx(`Debe ${money(who[0]!.balance)}.`, `Owes ${money(who[0]!.balance)}.`) : tx("Está al día.", "All paid up.")) : dot(joinNames(names)),
          route: "/cobros",
        });
      }
    }
    if (prefs.rain) {
      const moved = once(day.cuts.filter((c) => c.rain).map((c) => c.name));
      if (moved.length) {
        push({
          id: `lluvia-${day.date}`,
          at: at(day.date, MORNING),
          kind: "lluvia",
          title: moved.length === 1 ? tx("Hoy va el patio de la lluvia", "Today: the yard moved by rain") : tx(`Hoy van ${moved.length} patios de la lluvia`, `Today: ${moved.length} yards moved by rain`),
          body: dot(joinNames(moved)),
          route: "/",
        });
      }
    }
  }
  if (prefs.risk) {
    const morningToday = at(plan.today, MORNING);
    const first = morningToday > now ? plan.today : plan.days[1]?.date;
    if (first) {
      const todayOpen = first === plan.today ? [] : (plan.days[0]?.cuts ?? []).map((c) => c.name);
      const late = [...plan.overdue, ...todayOpen];
      const parts: string[] = [];
      if (late.length) parts.push(tx(plural(late.length, "corte atrasado", "cortes atrasados"), plural(late.length, "late cut", "late cuts")));
      if (plan.risk.length) parts.push(tx(`${plan.risk.length} en Alto riesgo`, `${plan.risk.length} at high risk`));
      if (parts.length) {
        const body: string[] = [];
        if (late.length) body.push(dot(`${tx("Atrasados", "Late")}: ${joinNames(once(late))}`));
        if (plan.risk.length) body.push(dot(`${tx("Alto riesgo", "High risk")}: ${joinNames(once(plan.risk))}`));
        push({
          id: `riesgo-${first}`,
          at: at(first, MORNING),
          kind: "riesgo",
          title: parts.join(" · "),
          body: body.join(" "),
          route: late.length ? "/" : "/cobros",
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function buildWidget(plan: NativePlan) {
  const look = readAppearance().mode;
  // Panel extras (1.5.09): per-day rows/dow/dom/done for the tablet "Panel" widget, the top debtors and one
  // alert line. Additive only: the "Hoy" widget reads the fields it always read and ignores the rest.
  const alertParts: string[] = [];
  if (plan.overdue.length) alertParts.push(tx(plural(plan.overdue.length, "corte atrasado", "cortes atrasados"), plural(plan.overdue.length, "late cut", "late cuts")));
  if (plan.risk.length) alertParts.push(tx(`${plan.risk.length} en Alto riesgo`, `${plan.risk.length} at high risk`));
  return {
    v: 1,
    look,
    title: tx("Hoy", "Today"),
    weekLabel: tx("Semana", "Week"),
    owedLabel: tx("Por cobrar", "To collect"),
    owed: money(plan.outstanding),
    debtors: plan.debtors.map((x) => ({ name: x.name, amt: money(x.balance) })),
    alertLine: alertParts.join(" · "),
    at: Date.now(),
    days: plan.days.slice(0, 8).map((d) => {
      const n = d.cuts.length;
      const first = d.cuts[0];
      const t = first ? formatTime(first.time) : null;
      const rest = once(d.cuts.slice(1).map((c) => c.name)).filter((x) => x !== first?.name);
      const doneLine = d.done ? `\n${tx(plural(d.done, "hecho", "hechos"), `${d.done} done`)}` : "";
      return {
        date: d.date,
        label: formatDay(d.date, en() ? "EEEE, MMM d" : "EEEE d MMM"),
        dow: formatDay(d.date, "EEE"),
        dom: String(Number(d.date.slice(8, 10))),
        done: d.done,
        rows: d.cuts.slice(0, 6).map((c) => ({ n: c.name, t: formatTime(c.time) ?? "", rain: c.rain })),
        more: d.cuts.length > 6 ? tx(`y ${d.cuts.length - 6} más`, `and ${d.cuts.length - 6} more`) : "",
        count: n,
        countLabel: (n === 1 ? tx("corte hoy", "cut today") : tx("cortes hoy", "cuts today")) + doneLine,
        nextLabel: n ? (n === 1 ? tx("Próximo", "Next") : tx("Próximos", "Next")) : "",
        next1: first ? (t ? `${first.name} · ${t}` : first.name) : d.done ? tx("Todo hecho por hoy", "All done for today") : tx("Día libre de cortes", "No cuts today"),
        // One name per line, never split between two names (a long name wraps at its last name, same size).
        next2: rest.length === 0 ? "" : rest.length === 1 ? rest[0]! : `${rest[0]}\n${tx(`y ${rest.length - 1} más`, `and ${rest.length - 1} more`)}`,
      };
    }),
  };
}
