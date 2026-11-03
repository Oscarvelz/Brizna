import { addDaysISO, stampDay, startOfWeekISO, weekdayFromISO } from "@/lib/dates";
import { frequencyLabel, jobKindLabel, money } from "@/lib/format";
import { methodLabel } from "@/components/method-field";
import { reasonLabel } from "@/lib/i18n";
import type { ClientRow, LocaleName } from "@/lib/types";
import type { AdvisorReading, ExportRaw, ExportRawJob } from "@/lib/server/lawn";
import { chosenSections, initialsOf, PRESETS, resolvePeriod, SECTIONS, type ExportOptions, type SectionId, type Tx } from "./options";

/**
 * One reading of the business for an export: filtered, named (or initialed), with the plain
 * sentence each section opens with. The PDF, the worksheet and Print all draw from this.
 */

export type Group = "active" | "oneTime" | "archived";

export interface XClient {
  id: number;
  name: string;
  phone: string;
  address: string;
  group: Group;
  raw: ClientRow;
}

export interface AgendaItem {
  date: string;
  order: number;
  name: string;
  phone: string;
  address: string;
  time: string;
  job: string;
  amount: number;
  owes: number;
  cue: string;
  late: boolean;
}

export interface Bar {
  label: string;
  /** Collected. */
  a: number;
  /** Work done ($). */
  b: number;
  /** Jobs done. */
  n: number;
  /** Payments. */
  p: number;
}

export interface Model {
  locale: LocaleName;
  tx: Tx;
  amounts: boolean;
  business: string;
  title: string;
  today: string;
  generated: string;
  from: string;
  to: string;
  periodLabel: string;
  scope: string;
  sections: SectionId[];
  sectionTitle: (id: SectionId) => string;
  headline: string;
  takeaway: Partial<Record<SectionId, string>>;
  clients: XClient[];
  nameOf: (id: number) => string;
  kpi: {
    collected: number;
    payments: number;
    owed: number;
    owedPeople: number;
    jobsDone: number;
    doneValue: number;
    cuts: number;
    extras: number;
    once: number;
    activeClients: number;
    oneTimeClients: number;
    archivedClients: number;
    tips: number;
    tipCount: number;
    forgiven: number;
    credit: number;
    minutes: number;
    workDays: number;
    pendingInPeriod: number;
  };
  series: { unit: "week" | "month" | "year"; bars: Bar[] };
  months: { key: string; label: string; jobs: number; value: number; collected: number; tips: number; forgiven: number; payments: number }[];
  cobros: {
    rows: { id: number; name: string; phone: string; balance: number; oldestDays: number | null; opening: number; b0: number; b31: number; b61: number; b91: number; tier: string; sincePay: number | null; unpaidJobs: number }[];
    buckets: { key: "b0" | "b31" | "b61" | "b91" | "opening"; label: string; amount: number; people: number }[];
    credits: { name: string; credit: number }[];
  };
  pagos: {
    rows: { date: string; name: string; amount: number; kind: string; method: string; tip: number; note: string }[];
    byMethod: { label: string; amount: number; n: number }[];
    byClient: { name: string; amount: number; n: number }[];
  };
  trabajos: {
    rows: { date: string; name: string; kind: string; job: string; amount: number }[];
    byClient: { name: string; jobs: number; value: number }[];
  };
  agenda: { days: { date: string; label: string; items: AgendaItem[] }[]; late: AgendaItem[]; total: number; value: number; vacation: string };
  clientRows: { name: string; group: string; phone: string; address: string; day: string; every: string; price: number; next: string; last: string; balance: number; credit: number; since: string; notes: string }[];
  precios: {
    rows: { name: string; price: number; visits: number; monthly: number; every: string; group: string }[];
    typical: number;
    average: number;
    low: number;
    high: number;
    below: number;
    monthlyTotal: number;
    bands: { label: string; n: number }[];
  };
  horas: { rows: { date: string; clockIn: string; clockOut: string; hours: number; jobs: number; value: number; collected: number; stopped: string }[]; perHour: number; perHourCollected: number; avgDay: number };
  propinas: { rows: { date: string; name: string; tip: number; method: string }[]; byClient: { name: string; tip: number; n: number }[]; avg: number };
  pospuestos: { rows: { from: string; to: string; name: string; job: string; reason: string }[]; byReason: { reason: string; n: number }[]; offDays: { date: string; reason: string }[] };
  notas: { day: { date: string; text: string }[]; pages: { title: string; folder: string; due: string; text: string; pinned: boolean }[] };
  asesor: null | {
    score: number;
    word: string;
    tone: "good" | "warn" | "bad";
    title: string;
    sub: string;
    moves: { title: string; line: string; impact: string }[];
    checks: { label: string; status: "pass" | "warn" | "fail"; line: string }[];
  };
}

/* ------------------------------------------------------------------ words & dates */

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y ?? 2000, m: m ?? 1, d: d ?? 1 };
}

/** "2 nov 2026" / "Nov 2, 2026". */
export function dayLong(iso: string, locale: LocaleName, withYear = true) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const { y, m, d } = parts(iso);
  if (locale === "en") return `${MONTHS_EN[m - 1]!.slice(0, 3)} ${d}${withYear ? `, ${y}` : ""}`;
  return `${d} ${MONTHS_ES[m - 1]!.slice(0, 3)}${withYear ? ` ${y}` : ""}`;
}

/** "lun 2 nov" / "Mon Nov 2". */
export function dayShort(iso: string, locale: LocaleName) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const { m, d } = parts(iso);
  const w = weekdayFromISO(iso);
  if (locale === "en") return `${DAYS_EN[w]!.slice(0, 3)} ${MONTHS_EN[m - 1]!.slice(0, 3)} ${d}`;
  return `${DAYS_ES[w]!.slice(0, 3)} ${d} ${MONTHS_ES[m - 1]!.slice(0, 3)}`;
}

/** "Lunes 2 de noviembre" / "Monday, November 2". */
export function dayFull(iso: string, locale: LocaleName) {
  const { m, d } = parts(iso);
  const w = weekdayFromISO(iso);
  if (locale === "en") return `${DAYS_EN[w]}, ${MONTHS_EN[m - 1]} ${d}`;
  return `${cap(DAYS_ES[w]!)} ${d} de ${MONTHS_ES[m - 1]}`;
}

export function monthLabel(key: string, locale: LocaleName, short = false) {
  const { y, m } = parts(`${key}-01`);
  const name = locale === "en" ? MONTHS_EN[m - 1]! : MONTHS_ES[m - 1]!;
  return short ? `${cap(name.slice(0, 3))} ${String(y).slice(2)}` : `${cap(name)} ${y}`;
}

export function weekdayName(dow: number, locale: LocaleName, plural = false) {
  if (locale === "en") return `${DAYS_EN[dow]}${plural ? "s" : ""}`;
  const n = DAYS_ES[dow]!;
  return plural && (dow === 0 || dow === 6) ? `${n}s` : n;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

function daysBetween(a: string, b: string) {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

export function stripHtml(text: string): string {
  return String(text ?? "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function periodLabel(from: string, to: string, period: ExportOptions["period"], locale: LocaleName, tx: Tx, firstData: string) {
  const { y: fy, m: fm } = parts(from);
  if (period === "all") return tx(`Todo el historial (desde ${dayLong(firstData, locale)})`, `All time (since ${dayLong(firstData, locale)})`);
  if (period === "month" || period === "lastMonth") return monthLabel(`${fy}-${String(fm).padStart(2, "0")}`, locale);
  if (period === "year" || period === "lastYear") return tx(`Año ${fy}`, `Year ${fy}`);
  if (period === "week") return tx(`Semana del ${dayLong(from, locale, false)} al ${dayLong(to, locale)}`, `Week of ${dayLong(from, locale, false)} – ${dayLong(to, locale)}`);
  return `${dayLong(from, locale)} – ${dayLong(to, locale)}`;
}

/* ------------------------------------------------------------------ build */

export function buildModel(raw: ExportRaw, advisor: AdvisorReading | null, o: ExportOptions, locale: LocaleName, words?: AdvisorWords): Model {
  const tx: Tx = (es, en) => (locale === "en" ? en : es);
  const today = raw.today;
  const { from, to } = resolvePeriod(o, today);
  const amounts = o.amounts;
  const sections = chosenSections(o);

  // Clients in scope.
  const groupOf = (c: ClientRow): Group => (!c.isActive ? "archived" : c.kind === "one_time" ? "oneTime" : "active");
  const pickSet = o.pick?.length ? new Set(o.pick) : null;
  const kept = raw.clients.filter((c) => o.groups[groupOf(c)] && (!pickSet || pickSet.has(c.id)));
  const keptIds = new Set(kept.map((c) => c.id));

  // Initials (numbered when two share them) or names.
  const label = new Map<number, string>();
  if (o.names) for (const c of raw.clients) label.set(c.id, c.name.trim() || "?");
  else {
    const taken = new Map<string, number>();
    const sorted = [...raw.clients].sort((a, b) => a.id - b.id);
    for (const c of sorted) {
      const base = initialsOf(c.name);
      const n = (taken.get(base) ?? 0) + 1;
      taken.set(base, n);
      label.set(c.id, n === 1 ? base : `${base} ${n}`);
    }
  }
  const nameOf = (id: number) => label.get(id) ?? "?";
  // Free text (notes) with names swapped for initials when names are off.
  const nameSwaps = o.names
    ? []
    : raw.clients
        .filter((c) => c.name.trim().length >= 3)
        .sort((a, b) => b.name.length - a.name.length)
        .map((c) => [new RegExp(c.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), nameOf(c.id)] as const);
  const clean = (text: string) => nameSwaps.reduce((t, [re, to2]) => t.replace(re, to2), stripHtml(text));
  const phoneOf = (c: ClientRow | undefined) => (o.phones && c?.phone ? c.phone : "");
  const byId = new Map(raw.clients.map((c) => [c.id, c]));

  const clients: XClient[] = kept
    .map((c) => ({ id: c.id, name: nameOf(c.id), phone: phoneOf(c), address: c.address ?? "", group: groupOf(c), raw: c }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const inRange = (d: string) => d >= from && d <= to;
  const jobs = raw.jobs.filter((j) => keptIds.has(j.clientId) && inRange(j.date));
  const done = jobs.filter((j) => j.status === "done");
  const pays = raw.payments.filter((p) => keptIds.has(p.clientId) && inRange(p.date));
  const money_in = pays.filter((p) => p.kind === "paid" || p.kind === "prepaid");
  const firstData = [raw.jobs.find((j) => j.status === "done")?.date, raw.payments[0]?.date].filter(Boolean).sort()[0] ?? from;

  const groupWord = (g: Group) => (g === "active" ? tx("Activo", "Active") : g === "oneTime" ? tx("Una vez", "One-time") : tx("Archivado", "Archived"));
  const kindWord = (k: string) => (k === "extra" ? tx("Extra", "Extra") : k === "one_time" ? tx("Una vez", "One-time") : tx("Corte", "Cut"));

  /* ---------- KPIs */
  const owingKept = kept.filter((c) => c.balance > 0.004);
  const work = raw.work.filter((w) => w.minutes > 0);
  const kpi: Model["kpi"] = {
    collected: sum(money_in.map((p) => p.amount)),
    payments: money_in.filter((p) => p.amount > 0).length,
    owed: sum(owingKept.map((c) => c.balance)),
    owedPeople: owingKept.length,
    jobsDone: done.length,
    doneValue: sum(done.map((j) => j.amount)),
    cuts: done.filter((j) => j.kind === "cut").length,
    extras: done.filter((j) => j.kind === "extra").length,
    once: done.filter((j) => j.kind === "one_time").length,
    activeClients: kept.filter((c) => groupOf(c) === "active").length,
    oneTimeClients: kept.filter((c) => groupOf(c) === "oneTime").length,
    archivedClients: kept.filter((c) => groupOf(c) === "archived").length,
    tips: sum(pays.map((p) => p.tip)),
    tipCount: pays.filter((p) => p.tip > 0).length,
    forgiven: sum(pays.filter((p) => p.kind === "waived").map((p) => p.amount)),
    credit: sum(kept.map((c) => Math.max(0, c.credit))),
    minutes: work.reduce((a, w) => a + w.minutes, 0),
    workDays: work.length,
    pendingInPeriod: jobs.filter((j) => j.status === "pending" && j.date < today).length,
  };

  /* ---------- series (weeks, months or years) */
  const end = to < today ? to : today;
  const spanStart = o.period === "all" ? firstData : from;
  const spanDays = daysBetween(spanStart, end);
  const unit: Model["series"]["unit"] = spanDays <= 70 ? "week" : spanDays <= 800 ? "month" : "year";
  const keyOf = (d: string) => (unit === "week" ? startOfWeekISO(d) : unit === "month" ? d.slice(0, 7) : d.slice(0, 4));
  const buckets = new Map<string, Bar>();
  const keys: string[] = [];
  if (spanStart <= end) {
    let cursor = unit === "week" ? startOfWeekISO(spanStart) : spanStart;
    let guard = 0;
    while (cursor <= end && guard < 400) {
      const k = keyOf(cursor);
      if (!buckets.has(k)) {
        keys.push(k);
        // A week that starts before the period is named by the period's first day.
        const lab = unit === "week" ? dayLong(k < spanStart ? spanStart : k, locale, false) : unit === "month" ? monthLabel(k, locale, true) : k;
        buckets.set(k, { label: lab, a: 0, b: 0, n: 0, p: 0 });
      }
      cursor = unit === "week" ? addDaysISO(cursor, 7) : unit === "month" ? `${nextMonth(cursor.slice(0, 7))}-01` : `${Number(cursor.slice(0, 4)) + 1}-01-01`;
      guard += 1;
    }
  }
  for (const p of money_in) {
    const bar = buckets.get(keyOf(p.date));
    if (bar) {
      bar.a += p.amount;
      if (p.amount > 0) bar.p += 1;
    }
  }
  for (const j of done) {
    const bar = buckets.get(keyOf(j.date));
    if (bar) {
      bar.b += j.amount;
      bar.n += 1;
    }
  }
  const bars = keys.map((k) => buckets.get(k)!).map((b) => ({ ...b, a: r2(b.a), b: r2(b.b) }));

  /* ---------- months */
  const monthMap = new Map<string, Model["months"][number]>();
  const monthRow = (k: string) => {
    let m = monthMap.get(k);
    if (!m) {
      m = { key: k, label: monthLabel(k, locale), jobs: 0, value: 0, collected: 0, tips: 0, forgiven: 0, payments: 0 };
      monthMap.set(k, m);
    }
    return m;
  };
  for (const j of done) {
    const m = monthRow(j.date.slice(0, 7));
    m.jobs += 1;
    m.value += j.amount;
  }
  for (const p of pays) {
    const m = monthRow(p.date.slice(0, 7));
    if (p.kind === "paid" || p.kind === "prepaid") {
      m.collected += p.amount;
      if (p.amount > 0) m.payments += 1;
    }
    if (p.kind === "waived") m.forgiven += p.amount;
    m.tips += p.tip;
  }
  const months = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({ ...m, value: r2(m.value), collected: r2(m.collected), tips: r2(m.tips), forgiven: r2(m.forgiven) }));

  /* ---------- cobros */
  // "Al día" read as "paid up" next to a balance: a client who owes but is not late is "Reciente".
  const tierWord = (t: string) => (t === "serio" ? tx("Serio", "Serious") : t === "espera" ? tx("En espera", "Waiting") : tx("Reciente", "Recent"));
  const cobrosRows = owingKept
    .map((c) => {
      const a = raw.aging[c.id] ?? { oldestDays: null, opening: c.balance, b0: 0, b31: 0, b61: 0, b91: 0, unpaidJobs: 0 };
      return { id: c.id, name: nameOf(c.id), phone: phoneOf(c), balance: c.balance, oldestDays: a.oldestDays, opening: a.opening, b0: a.b0, b31: a.b31, b61: a.b61, b91: a.b91, tier: tierWord(c.payTier), sincePay: c.lastPaidDate ? c.daysSincePay : null, unpaidJobs: a.unpaidJobs };
    })
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const bucketDefs = [
    { key: "b0" as const, label: tx("0–30 días", "0–30 days") },
    { key: "b31" as const, label: tx("31–60 días", "31–60 days") },
    { key: "b61" as const, label: tx("61–90 días", "61–90 days") },
    { key: "b91" as const, label: tx("Más de 90", "Over 90") },
    { key: "opening" as const, label: tx("Saldo inicial", "Opening balance") },
  ];
  const cobros: Model["cobros"] = {
    rows: cobrosRows,
    buckets: bucketDefs.map((d) => ({ ...d, amount: sum(cobrosRows.map((r) => r[d.key])), people: cobrosRows.filter((r) => r[d.key] > 0.004).length })),
    credits: kept.filter((c) => c.credit > 0.004).map((c) => ({ name: nameOf(c.id), credit: c.credit })).sort((a, b) => b.credit - a.credit),
  };

  /* ---------- pagos */
  const kindPay = (k: string) => (k === "prepaid" ? tx("Adelanto", "Advance") : k === "waived" ? tx("Perdonado", "Forgiven") : k === "opening" ? tx("Saldo inicial", "Opening balance") : tx("Pago", "Payment"));
  const payRows = pays
    .filter((p) => p.kind !== "opening" && (p.amount > 0 || p.tip > 0))
    .map((p) => ({ date: p.date, name: nameOf(p.clientId), amount: p.amount, kind: kindPay(p.kind), method: methodLabel(p.method) ?? tx("Sin anotar", "Not noted"), tip: p.tip, note: clean(p.note ?? "") }));
  const methodMap = new Map<string, { label: string; amount: number; n: number }>();
  for (const p of money_in.filter((x) => x.amount > 0)) {
    const lab = methodLabel(p.method) ?? tx("Sin anotar", "Not noted");
    const row = methodMap.get(lab) ?? { label: lab, amount: 0, n: 0 };
    row.amount += p.amount;
    row.n += 1;
    methodMap.set(lab, row);
  }
  const payClient = new Map<number, { name: string; amount: number; n: number }>();
  for (const p of money_in.filter((x) => x.amount > 0)) {
    const row = payClient.get(p.clientId) ?? { name: nameOf(p.clientId), amount: 0, n: 0 };
    row.amount += p.amount;
    row.n += 1;
    payClient.set(p.clientId, row);
  }
  const pagos: Model["pagos"] = {
    rows: payRows,
    byMethod: [...methodMap.values()].map((m) => ({ ...m, amount: r2(m.amount) })).sort((a, b) => b.amount - a.amount),
    byClient: [...payClient.values()].map((m) => ({ ...m, amount: r2(m.amount) })).sort((a, b) => b.amount - a.amount),
  };

  /* ---------- trabajos */
  const jobWord = (j: ExportRawJob) => (j.title?.trim() ? j.title.trim() : jobKindLabel(j.kind));
  const workClient = new Map<number, { name: string; jobs: number; value: number }>();
  for (const j of done) {
    const row = workClient.get(j.clientId) ?? { name: nameOf(j.clientId), jobs: 0, value: 0 };
    row.jobs += 1;
    row.value += j.amount;
    workClient.set(j.clientId, row);
  }
  const trabajos: Model["trabajos"] = {
    rows: done.map((j) => ({ date: j.date, name: nameOf(j.clientId), kind: kindWord(j.kind), job: jobWord(j), amount: j.amount })),
    byClient: [...workClient.values()].map((m) => ({ ...m, value: r2(m.value) })).sort((a, b) => b.value - a.value || b.jobs - a.jobs),
  };

  /* ---------- agenda (from today, not the period) */
  const item = (j: ExportRawJob): AgendaItem => {
    const c = byId.get(j.clientId);
    const extras = (c?.standingExtras ?? []).filter(Boolean).join(", ");
    return {
      date: j.date,
      order: j.sortOrder,
      name: nameOf(j.clientId),
      phone: phoneOf(c),
      address: c?.address ?? "",
      time: (j.arrivalTime ?? c?.arrivalTime ?? "").slice(0, 5),
      job: jobWord(j) + (extras && j.kind === "cut" ? ` + ${extras}` : ""),
      amount: j.amount,
      owes: c && c.balance > 0.004 ? c.balance : 0,
      cue: clean([c?.cue ?? "", j.notes ?? ""].filter((x) => x.trim()).join(" · ")),
      late: j.date < today,
    };
  };
  const up = raw.upcoming.filter((j) => keptIds.has(j.clientId));
  const late = up.filter((j) => j.date < today).map(item);
  const dayMap = new Map<string, AgendaItem[]>();
  for (const j of up.filter((x) => x.date >= today)) {
    const list = dayMap.get(j.date) ?? [];
    list.push(item(j));
    dayMap.set(j.date, list);
  }
  const vac = raw.vacation.start && raw.vacation.end && raw.vacation.end >= today ? tx(`Vacaciones del ${dayLong(raw.vacation.start, locale, false)} al ${dayLong(raw.vacation.end, locale)}.`, `Time off ${dayLong(raw.vacation.start, locale, false)} – ${dayLong(raw.vacation.end, locale)}.`) : "";
  const agendaDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, items]) => ({ date, label: dayFull(date, locale), items: items.sort((a, b) => a.order - b.order || a.time.localeCompare(b.time) || a.name.localeCompare(b.name)) }));
  const agenda: Model["agenda"] = {
    days: agendaDays,
    late,
    total: agendaDays.reduce((n, d) => n + d.items.length, 0),
    value: sum(agendaDays.flatMap((d) => d.items.map((i) => i.amount))),
    vacation: vac,
  };

  /* ---------- clients directory */
  const dayOf = (c: ClientRow) => {
    if (c.kind === "one_time") return "";
    const a = cap(weekdayName(c.weekday, locale));
    return c.weekday2 != null && c.weekday2 !== c.weekday ? `${a} / ${cap(weekdayName(c.weekday2, locale))}` : a;
  };
  const everyOf = (c: ClientRow) => (c.kind === "one_time" ? tx("Una vez", "One-time") : frequencyLabel(c.cutsPerMonth, { frequencyDays: c.frequencyDays, weekday2: c.weekday2 }));
  const clientRows = clients.map((x) => ({
    name: x.name,
    group: groupWord(x.group),
    phone: x.phone,
    address: x.address,
    day: dayOf(x.raw),
    every: everyOf(x.raw),
    price: x.raw.pricePerCut,
    next: x.raw.isActive ? x.raw.nextCutDate ?? "" : "",
    last: x.raw.lastCutDate ?? "",
    balance: x.raw.balance,
    credit: x.raw.credit,
    since: x.raw.startDate ?? (x.raw.createdAt ? stampDay(x.raw.createdAt) : ""),
    notes: clean([x.raw.notes ?? "", x.raw.richNotes ?? ""].filter((t) => t.trim()).join("\n")).slice(0, 400),
  }));

  /* ---------- prices (active regular clients) */
  const visitsOf = (c: ClientRow) => (c.frequencyDays && c.frequencyDays > 0 ? r2(30.4 / c.frequencyDays) : c.cutsPerMonth === 4 ? 4.3 : c.cutsPerMonth === 5 ? 8.7 : c.cutsPerMonth);
  const priced = kept.filter((c) => c.isActive && c.pricePerCut > 0);
  const regular = priced.filter((c) => c.kind === "regular");
  const prices = regular.map((c) => c.pricePerCut).sort((a, b) => a - b);
  const median = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2]! : (prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2) : 0;
  const bandEdges = [0, 30, 40, 50, 60, 80, Infinity];
  const bands = bandEdges.slice(0, -1).map((lo, i) => {
    const hi = bandEdges[i + 1]!;
    const n = prices.filter((p) => p >= lo && p < hi).length;
    const lab = hi === Infinity ? `$${lo}+` : lo === 0 ? tx(`menos de $${hi}`, `under $${hi}`) : `$${lo}–${hi - 1}`;
    return { label: lab, n };
  });
  const precios: Model["precios"] = {
    rows: priced
      .map((c) => ({ name: nameOf(c.id), price: c.pricePerCut, visits: c.kind === "one_time" ? 0 : visitsOf(c), monthly: c.kind === "one_time" ? 0 : r2(c.pricePerCut * visitsOf(c)), every: everyOf(c), group: groupWord(groupOf(c)) }))
      .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name)),
    typical: r2(median),
    average: prices.length ? r2(sum(prices) / prices.length) : 0,
    low: prices[0] ?? 0,
    high: prices[prices.length - 1] ?? 0,
    below: prices.filter((p) => p < median * 0.8).length,
    monthlyTotal: sum(regular.map((c) => c.pricePerCut * visitsOf(c))),
    bands: bands.filter((b) => b.n > 0),
  };

  /* ---------- hours (the whole business, not per client) */
  const allDone = raw.jobs.filter((j) => j.status === "done");
  const allIn = raw.payments.filter((p) => p.kind === "paid" || p.kind === "prepaid");
  const doneByDay = new Map<string, { n: number; v: number }>();
  for (const j of allDone) {
    const d = doneByDay.get(j.date) ?? { n: 0, v: 0 };
    d.n += 1;
    d.v += j.amount;
    doneByDay.set(j.date, d);
  }
  const inByDay = new Map<string, number>();
  for (const p of allIn) inByDay.set(p.date, (inByDay.get(p.date) ?? 0) + p.amount);
  const horasRows = raw.work.map((w) => {
    const dj = doneByDay.get(w.date);
    return {
      date: w.date,
      clockIn: w.clockIn ?? "",
      clockOut: w.clockOut ?? "",
      hours: r2(w.minutes / 60),
      jobs: dj?.n ?? 0,
      value: r2(dj?.v ?? 0),
      collected: r2(inByDay.get(w.date) ?? 0),
      stopped: w.stopped ? reasonLabel(locale, w.stopped) : "",
    };
  });
  const hoursTotal = r2(kpi.minutes / 60);
  const valueOnWorkDays = sum(horasRows.filter((h) => h.hours > 0).map((h) => h.value));
  const collectedOnAll = sum(allIn.filter((p) => inRange(p.date)).map((p) => p.amount));
  const horas: Model["horas"] = {
    rows: horasRows,
    perHour: hoursTotal > 0 ? r2(valueOnWorkDays / hoursTotal) : 0,
    perHourCollected: hoursTotal > 0 ? r2(collectedOnAll / hoursTotal) : 0,
    avgDay: kpi.workDays ? r2(hoursTotal / kpi.workDays) : 0,
  };

  /* ---------- tips */
  const tipRows = pays.filter((p) => p.tip > 0).map((p) => ({ date: p.date, name: nameOf(p.clientId), tip: p.tip, method: methodLabel(p.method) ?? "" }));
  const tipClient = new Map<string, { name: string; tip: number; n: number }>();
  for (const t of tipRows) {
    const row = tipClient.get(t.name) ?? { name: t.name, tip: 0, n: 0 };
    row.tip += t.tip;
    row.n += 1;
    tipClient.set(t.name, row);
  }
  const propinas: Model["propinas"] = {
    rows: tipRows,
    byClient: [...tipClient.values()].map((x) => ({ ...x, tip: r2(x.tip) })).sort((a, b) => b.tip - a.tip),
    avg: tipRows.length ? r2(kpi.tips / tipRows.length) : 0,
  };

  /* ---------- postponed */
  const moved = jobs.filter((j) => j.originDate && j.originDate !== j.date);
  const posRows = moved.map((j) => ({ from: j.originDate!, to: j.date, name: nameOf(j.clientId), job: jobWord(j), reason: j.postponeReason?.trim() ? reasonLabel(locale, j.postponeReason.trim()) : tx("Sin motivo", "No reason") }));
  const reasonMap = new Map<string, number>();
  for (const r of posRows) reasonMap.set(r.reason, (reasonMap.get(r.reason) ?? 0) + 1);
  const offDays = [
    ...raw.offDays.map((d) => ({ date: d.date, reason: [reasonLabel(locale, d.reason), d.detail].filter(Boolean).join(" · ") })),
    ...raw.work.filter((w) => w.stopped).map((w) => ({ date: w.date, reason: `${tx("Paró temprano", "Stopped early")}: ${reasonLabel(locale, w.stopped!)}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const pospuestos: Model["pospuestos"] = {
    rows: posRows,
    byReason: [...reasonMap.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
    offDays,
  };

  /* ---------- notes */
  const pagesKept = raw.notes.filter((n) => o.period === "all" || n.pinned || (stampDay(n.updated) >= from && stampDay(n.updated) <= to) || (n.due != null && inRange(n.due)));
  const notas: Model["notas"] = {
    day: raw.dayNotes.map((d) => ({ date: d.date, text: clean(d.body) })).filter((d) => d.text),
    pages: pagesKept.map((n) => ({ title: clean(n.title) || tx("Nota", "Note"), folder: n.folder, due: n.due ?? "", text: clean(n.body), pinned: n.pinned })).filter((n) => n.text || n.title),
  };

  /* ---------- advisor */
  const asesor: Model["asesor"] =
    advisor && advisor.hasData && words
      ? (() => {
          const v = words.verdict(advisor, tx);
          const pillarName: Record<string, [string, string]> = {
            cobro: ["Cobro", "Collecting"],
            precios: ["Precios", "Prices"],
            clientes: ["Clientes", "Clients"],
            agenda: ["Agenda", "Schedule"],
            fijo: ["Ingreso fijo", "Steady income"],
          };
          return {
            score: advisor.score,
            word: v.word,
            tone: advisor.tone,
            title: v.title,
            sub: v.sub,
            moves: advisor.actions.slice(0, 3).map((a) => {
              const w = words.actionWords(a, advisor, tx);
              const people = !o.names ? a.people.map((p) => p.name) : [];
              const swap = (t: string) => people.reduce((acc, nm) => acc.split(nm).join(initialsOf(nm)), t);
              return { title: swap(w.title), line: swap(w.line), impact: `${w.sign}${money(Math.round(a.impact))} ${w.unit}` };
            }),
            checks: advisor.pillars.map((p) => ({ label: tx(...(pillarName[p.key] ?? ["", ""])), status: p.status, line: words.pillarWords(p, advisor, tx).line })),
          };
        })()
      : null;

  /* ---------- sentences */
  const per = periodLabel(from, to, o.period, locale, tx, firstData);
  const perIn = o.period === "all" ? tx("en total", "in all") : o.period === "week" ? tx("esta semana", "this week") : o.period === "month" ? tx("este mes", "this month") : o.period === "lastMonth" ? tx("el mes pasado", "last month") : o.period === "year" ? tx("este año", "this year") : o.period === "lastYear" ? tx("el año pasado", "last year") : tx("en esas fechas", "in those dates");
  const m = (n: number) => money(n);
  const takeaway: Partial<Record<SectionId, string>> = {};
  const bestBar = [...bars].sort((a, b) => b.a - a.a)[0];
  takeaway.resumen = amounts
    ? kpi.jobsDone || kpi.collected
      ? tx(
          `Cobraste ${m(kpi.collected)} ${perIn} por ${kpi.jobsDone} ${plural(kpi.jobsDone, "trabajo", "trabajos")} hechos${kpi.owed > 0 ? `, y te deben ${m(kpi.owed)} entre ${kpi.owedPeople} ${plural(kpi.owedPeople, "cliente", "clientes")}` : ", y nadie te debe"}.${bestBar && bars.length > 2 && bestBar.a > 0 ? ` ${unit === "week" ? "La mejor semana" : unit === "month" ? "El mejor mes" : "El mejor año"} fue ${bestBar.label} (${m(bestBar.a)}).` : ""}`,
          `You collected ${m(kpi.collected)} ${perIn} for ${kpi.jobsDone} ${plural(kpi.jobsDone, "job", "jobs")} done${kpi.owed > 0 ? `, and ${kpi.owedPeople} ${plural(kpi.owedPeople, "client owes", "clients owe")} you ${m(kpi.owed)}` : ", and nobody owes you"}.${bestBar && bars.length > 2 && bestBar.a > 0 ? ` The best ${unit} was ${bestBar.label} (${m(bestBar.a)}).` : ""}`,
        )
      : tx(`No hay trabajos ni pagos anotados ${perIn}.`, `No jobs or payments recorded ${perIn}.`)
    : tx(`Hiciste ${kpi.jobsDone} ${plural(kpi.jobsDone, "trabajo", "trabajos")} ${perIn}: ${kpi.cuts} ${plural(kpi.cuts, "corte", "cortes")}, ${kpi.extras} ${plural(kpi.extras, "extra", "extras")} y ${kpi.once} de una vez.`, `You did ${kpi.jobsDone} ${plural(kpi.jobsDone, "job", "jobs")} ${perIn}: ${kpi.cuts} ${plural(kpi.cuts, "cut", "cuts")}, ${kpi.extras} ${plural(kpi.extras, "extra", "extras")} and ${kpi.once} one-time.`);
  const old60 = r2(cobros.buckets.filter((b) => b.key === "b61" || b.key === "b91").reduce((a, b) => a + b.amount, 0));
  const topOwe = cobros.rows[0];
  takeaway.cobros = cobros.rows.length
    ? tx(
        `${cobros.rows.length} ${plural(cobros.rows.length, "cliente te debe", "clientes te deben")} ${m(kpi.owed)}.${old60 > 0 ? ` ${m(old60)} lleva más de 60 días.` : " Casi todo es reciente."} Empieza por ${topOwe!.name} (${m(topOwe!.balance)}).`,
        `${cobros.rows.length} ${plural(cobros.rows.length, "client owes", "clients owe")} you ${m(kpi.owed)}.${old60 > 0 ? ` ${m(old60)} is over 60 days old.` : " Almost all of it is recent."} Start with ${topOwe!.name} (${m(topOwe!.balance)}).`,
      )
    : tx("Nadie te debe nada. ¡Todo cobrado!", "Nobody owes you anything. All collected!");
  const topMethod = pagos.byMethod[0];
  // "La mayoría en efectivo (80%)"; when no method was written down: "Todo sin medio anotado" / "Medio sin anotar en el 60%".
  const topShare = topMethod && kpi.collected > 0 ? Math.round((topMethod.amount / kpi.collected) * 100) : 0;
  const unnoted = topMethod?.label === tx("Sin anotar", "Not noted");
  const methodLineEs = !topMethod ? "" : unnoted ? (topShare >= 100 ? " Todo sin medio de pago anotado." : ` El ${topShare}% sin medio de pago anotado.`) : topShare >= 100 ? ` Todo en ${topMethod.label.toLowerCase()}.` : ` La mayoría en ${topMethod.label.toLowerCase()} (${topShare}%).`;
  const methodLineEn = !topMethod ? "" : unnoted ? (topShare >= 100 ? " No payment method noted." : ` ${topShare}% with no method noted.`) : topShare >= 100 ? ` All by ${topMethod.label.toLowerCase()}.` : ` Most by ${topMethod.label.toLowerCase()} (${topShare}%).`;
  takeaway.pagos = kpi.payments
    ? tx(
        `Entraron ${m(kpi.collected)} en ${kpi.payments} ${plural(kpi.payments, "pago", "pagos")}.${topMethod && kpi.collected > 0 ? methodLineEs : ""}${kpi.forgiven > 0 ? ` Perdonaste ${m(kpi.forgiven)}.` : ""}`,
        `${m(kpi.collected)} came in over ${kpi.payments} ${plural(kpi.payments, "payment", "payments")}.${topMethod && kpi.collected > 0 ? methodLineEn : ""}${kpi.forgiven > 0 ? ` You forgave ${m(kpi.forgiven)}.` : ""}`,
      )
    : tx(`No entraron pagos ${perIn}.`, `No payments came in ${perIn}.`);
  takeaway.trabajos = kpi.jobsDone
    ? tx(
        `Hiciste ${kpi.jobsDone} ${plural(kpi.jobsDone, "trabajo", "trabajos")}${amounts ? ` que valen ${m(kpi.doneValue)}` : ""}: ${kpi.cuts} ${plural(kpi.cuts, "corte", "cortes")}, ${kpi.extras} ${plural(kpi.extras, "extra", "extras")} y ${kpi.once} de una vez.${kpi.pendingInPeriod ? ` ${kpi.pendingInPeriod} ${plural(kpi.pendingInPeriod, "quedó", "quedaron")} sin hacer.` : ""}`,
        `You did ${kpi.jobsDone} ${plural(kpi.jobsDone, "job", "jobs")}${amounts ? ` worth ${m(kpi.doneValue)}` : ""}: ${kpi.cuts} ${plural(kpi.cuts, "cut", "cuts")}, ${kpi.extras} ${plural(kpi.extras, "extra", "extras")} and ${kpi.once} one-time.${kpi.pendingInPeriod ? ` ${kpi.pendingInPeriod} still not done.` : ""}`,
      )
    : tx(`No hay trabajos hechos ${perIn}.`, `No jobs done ${perIn}.`);
  const busiest = [...agenda.days].sort((a, b) => b.items.length - a.items.length)[0];
  takeaway.agenda = agenda.total
    ? tx(
        `${agenda.total} ${plural(agenda.total, "patio", "patios")} en los próximos ${o.ahead} días${amounts ? ` (${m(agenda.value)})` : ""}. El día más lleno es el ${busiest ? dayFull(busiest.date, locale).toLowerCase() : ""} con ${busiest?.items.length ?? 0}.${late.length ? ` ${late.length} ${plural(late.length, "quedó atrasado", "quedaron atrasados")}.` : ""}`,
        `${agenda.total} ${plural(agenda.total, "yard", "yards")} in the next ${o.ahead} days${amounts ? ` (${m(agenda.value)})` : ""}. The busiest day is ${busiest ? dayFull(busiest.date, locale) : ""} with ${busiest?.items.length ?? 0}.${late.length ? ` ${late.length} ${plural(late.length, "is", "are")} overdue.` : ""}`,
      )
    : tx(`No hay patios agendados en los próximos ${o.ahead} días.`, `No yards booked in the next ${o.ahead} days.`);
  const dayCount = new Map<number, number>();
  for (const c of kept.filter((x) => x.isActive && x.kind === "regular")) dayCount.set(c.weekday, (dayCount.get(c.weekday) ?? 0) + 1);
  const topDay = [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0];
  takeaway.clientes = tx(
    `${kpi.activeClients} ${plural(kpi.activeClients, "cliente fijo", "clientes fijos")}, ${kpi.oneTimeClients} de una vez y ${kpi.archivedClients} ${plural(kpi.archivedClients, "archivado", "archivados")}.${topDay ? ` El día con más patios es el ${weekdayName(topDay[0], locale)} (${topDay[1]}).` : ""}`,
    `${kpi.activeClients} regular ${plural(kpi.activeClients, "client", "clients")}, ${kpi.oneTimeClients} one-time and ${kpi.archivedClients} archived.${topDay ? ` Your busiest day is ${weekdayName(topDay[0], locale)} (${topDay[1]}).` : ""}`,
  );
  takeaway.precios = prices.length
    ? tx(
        `El corte típico vale ${m(precios.typical)} (de ${m(precios.low)} a ${m(precios.high)}). ${precios.below ? `${precios.below} ${plural(precios.below, "cliente paga", "clientes pagan")} bastante menos.` : "Nadie paga muy por debajo."} Tus fijos dejan unos ${m(Math.round(precios.monthlyTotal))} al mes.`,
        `A typical cut is ${m(precios.typical)} (from ${m(precios.low)} to ${m(precios.high)}). ${precios.below ? `${precios.below} ${plural(precios.below, "client pays", "clients pay")} well below that.` : "Nobody pays far below it."} Your regulars bring about ${m(Math.round(precios.monthlyTotal))} a month.`,
      )
    : tx("Aún no hay precios anotados.", "No prices recorded yet.");
  takeaway.horas = hoursTotal
    ? tx(
        `Trabajaste ${fmtHours(hoursTotal)} horas en ${kpi.workDays} ${plural(kpi.workDays, "día", "días")} (${fmtHours(horas.avgDay)} por día).${amounts && horas.perHour ? ` Cada hora dejó ${m(horas.perHour)} de trabajo hecho.` : ""}`,
        `You worked ${fmtHours(hoursTotal)} hours over ${kpi.workDays} ${plural(kpi.workDays, "day", "days")} (${fmtHours(horas.avgDay)} a day).${amounts && horas.perHour ? ` Each hour brought ${m(horas.perHour)} of work done.` : ""}`,
      )
    : tx(`No hay horas anotadas ${perIn}.`, `No hours recorded ${perIn}.`);
  takeaway.propinas = tipRows.length
    ? tx(
        `Recibiste ${m(kpi.tips)} en ${tipRows.length} ${plural(tipRows.length, "propina", "propinas")} (${m(propinas.avg)} de promedio). ${propinas.byClient[0] ? `Quien más dejó: ${propinas.byClient[0].name} (${m(propinas.byClient[0].tip)}).` : ""}`,
        `You received ${m(kpi.tips)} in ${tipRows.length} ${plural(tipRows.length, "tip", "tips")} (${m(propinas.avg)} on average). ${propinas.byClient[0] ? `Most generous: ${propinas.byClient[0].name} (${m(propinas.byClient[0].tip)}).` : ""}`,
      )
    : tx(`No hubo propinas ${perIn}.`, `No tips ${perIn}.`);
  takeaway.pospuestos = posRows.length
    ? tx(
        `Se movieron ${posRows.length} ${plural(posRows.length, "trabajo", "trabajos")}. El motivo más común: ${pospuestos.byReason[0]!.reason.toLowerCase()} (${pospuestos.byReason[0]!.n}).${offDays.length ? ` Hubo ${offDays.length} ${plural(offDays.length, "día libre o parada", "días libres o paradas")}.` : ""}`,
        `${posRows.length} ${plural(posRows.length, "job was", "jobs were")} moved. Most common reason: ${pospuestos.byReason[0]!.reason.toLowerCase()} (${pospuestos.byReason[0]!.n}).${offDays.length ? ` ${offDays.length} ${plural(offDays.length, "day off or early stop", "days off or early stops")}.` : ""}`,
      )
    : tx(`No se pospuso ningún trabajo ${perIn}.`, `No jobs were postponed ${perIn}.`);
  takeaway.notas = notas.day.length || notas.pages.length
    ? tx(`${notas.pages.length} ${plural(notas.pages.length, "nota", "notas")} del fichero y ${notas.day.length} ${plural(notas.day.length, "nota", "notas")} del día. Al final, una hoja con líneas para escribir.`, `${notas.pages.length} notebook ${plural(notas.pages.length, "note", "notes")} and ${notas.day.length} day ${plural(notas.day.length, "note", "notes")}. At the end, a lined page to write on.`)
    : tx("Una hoja con líneas para escribir a mano.", "A lined page to write on by hand.");
  takeaway.asesor = asesor
    ? tx(`Nota del negocio: ${asesor.score} de 100 (${asesor.word.toLowerCase()}). Abajo, en palabras simples, los pasos que más dinero mueven.`, `Business score: ${asesor.score} of 100 (${asesor.word.toLowerCase()}). Below, in plain words, the moves worth the most money.`)
    : tx("Aún no hay datos suficientes para el asesor.", "Not enough data for the advisor yet.");

  const preset = PRESETS.find((p) => p.id === o.preset);
  const title = preset ? (preset.id === "todo" ? tx("Informe completo", "Full report") : tx(preset.es, preset.en)) : tx("Informe a medida", "Custom report");
  const scopeBits = [
    o.pick?.length ? tx(`${clients.length} ${plural(clients.length, "cliente elegido", "clientes elegidos")}`, `${clients.length} picked ${plural(clients.length, "client", "clients")}`) : [o.groups.active && tx("activos", "active"), o.groups.oneTime && tx("de una vez", "one-time"), o.groups.archived && tx("archivados", "archived")].filter(Boolean).join(", ") || tx("ningún cliente", "no clients"),
    !o.names && tx("iniciales en vez de nombres", "initials instead of names"),
    !o.phones && tx("sin teléfonos", "no phone numbers"),
    !o.amounts && tx("sin montos", "no amounts"),
  ].filter(Boolean) as string[];
  const scope = cap(o.pick?.length ? scopeBits.join(" · ") : `${tx("Clientes", "Clients")}: ${scopeBits.join(" · ")}`);
  const now = new Date();
  const hh = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, "0");
  const clock = locale === "en" ? `${hh % 12 || 12}:${mm} ${hh >= 12 ? "PM" : "AM"}` : `${hh % 12 || 12}:${mm} ${hh >= 12 ? "p. m." : "a. m."}`;
  const generated = tx(`Hecho el ${dayLong(today, locale)}, ${clock}`, `Made ${dayLong(today, locale)}, ${clock}`);
  const sectionTitle = (id: SectionId) => {
    const s = SECTIONS.find((x) => x.id === id)!;
    return tx(s.es, s.en);
  };
  return {
    locale,
    tx,
    amounts,
    business: raw.business,
    title,
    today,
    generated,
    from: o.period === "all" ? firstData : from,
    to: o.period === "all" ? today : to,
    periodLabel: per,
    scope,
    sections,
    sectionTitle,
    headline: takeaway.resumen ?? "",
    takeaway,
    clients,
    nameOf,
    kpi,
    series: { unit, bars },
    months,
    cobros,
    pagos,
    trabajos,
    agenda,
    clientRows,
    precios,
    horas,
    propinas,
    pospuestos,
    notas,
    asesor,
  };
}

function nextMonth(key: string) {
  const { y, m } = parts(`${key}-01`);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function fmtHours(h: number) {
  const v = Math.round(h * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The advisor's own wording, passed in so the words stay the same as on screen. */
export interface AdvisorWords {
  verdict: (r: AdvisorReading, tx: Tx) => { title: string; sub: string; word: string };
  actionWords: (a: AdvisorReading["actions"][number], r: AdvisorReading, tx: Tx) => { title: string; line: string; unit: string; sign: string };
  pillarWords: (p: AdvisorReading["pillars"][number], r: AdvisorReading, tx: Tx) => { line: string; more: string };
}
