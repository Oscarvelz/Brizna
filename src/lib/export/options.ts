import { addDaysISO, endOfWeekISO, lastDayOfMonthISO, monthParts, startOfWeekISO } from "@/lib/dates";

/**
 * What goes into an export. One set of choices drives the PDF, the worksheet and Print,
 * and it is remembered on this device between uses.
 */

export type Tx = (es: string, en: string) => string;

export type SectionId =
  | "resumen"
  | "cobros"
  | "pagos"
  | "trabajos"
  | "agenda"
  | "clientes"
  | "precios"
  | "horas"
  | "propinas"
  | "pospuestos"
  | "notas"
  | "asesor";

export type PresetId = "todo" | "cobros" | "agenda" | "mes" | "clientes" | "contador";
export type PeriodId = "week" | "month" | "lastMonth" | "year" | "lastYear" | "custom" | "all";

export interface ExportOptions {
  preset: PresetId | "custom";
  period: PeriodId;
  from: string;
  to: string;
  /** Days the field sheet (Agenda) looks ahead, from today. */
  ahead: 7 | 14 | 28;
  sections: Record<SectionId, boolean>;
  groups: { active: boolean; oneTime: boolean; archived: boolean };
  /** null = every client in the groups; otherwise only these ids. */
  pick: number[] | null;
  phones: boolean;
  names: boolean;
  amounts: boolean;
}

export interface SectionDef {
  id: SectionId;
  es: string;
  en: string;
  noteEs: string;
  noteEn: string;
  /** Needs amounts shown to make sense. */
  money: boolean;
}

export const SECTIONS: SectionDef[] = [
  { id: "resumen", es: "Resumen", en: "Summary", noteEs: "Las cifras grandes y una gráfica", noteEn: "The big figures and a chart", money: false },
  { id: "cobros", es: "Te deben", en: "Owed to you", noteEs: "Quién debe, cuánto y desde cuándo", noteEn: "Who owes, how much, since when", money: true },
  { id: "pagos", es: "Pagos recibidos", en: "Payments received", noteEs: "Cada pago, por medio y por mes", noteEn: "Every payment, by method and month", money: true },
  { id: "trabajos", es: "Trabajos hechos", en: "Work done", noteEs: "Cortes, extras y trabajos de una vez", noteEn: "Cuts, extras and one-time jobs", money: false },
  { id: "agenda", es: "Agenda próxima", en: "Upcoming route", noteEs: "Hoja de ruta con casillas para marcar", noteEn: "Route sheet with boxes to tick", money: false },
  { id: "clientes", es: "Clientes", en: "Clients", noteEs: "Directorio: contacto, día y frecuencia", noteEn: "Directory: contact, day, frequency", money: false },
  { id: "precios", es: "Precios", en: "Prices", noteEs: "Lo que cobra cada patio y lo normal", noteEn: "What each yard pays and what is usual", money: true },
  { id: "horas", es: "Horas y $ por hora", en: "Hours and $ per hour", noteEs: "Entrada, salida y lo ganado por hora", noteEn: "Clock in, out, and earned per hour", money: false },
  { id: "propinas", es: "Propinas", en: "Tips", noteEs: "Quién dejó propina y cuánto", noteEn: "Who tipped and how much", money: true },
  { id: "pospuestos", es: "Pospuestos y motivos", en: "Postponed and why", noteEs: "Trabajos movidos y días libres", noteEn: "Moved jobs and days off", money: false },
  { id: "notas", es: "Notas", en: "Notes", noteEs: "Notas del día, fichero y hoja para escribir", noteEn: "Day notes, notebook, a page to write on", money: false },
  { id: "asesor", es: "Asesor", en: "Advisor", noteEs: "Nota del negocio y los 3 mejores pasos", noteEn: "Business score and the top 3 moves", money: true },
];

const ALL_ON: Record<SectionId, boolean> = Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as Record<SectionId, boolean>;
const NONE: Record<SectionId, boolean> = Object.fromEntries(SECTIONS.map((s) => [s.id, false])) as Record<SectionId, boolean>;

export interface PresetDef {
  id: PresetId;
  es: string;
  en: string;
  noteEs: string;
  noteEn: string;
  period: PeriodId;
  sections: Record<SectionId, boolean>;
  groups: ExportOptions["groups"];
  phones: boolean;
  names: boolean;
  amounts: boolean;
  ahead?: ExportOptions["ahead"];
}

export const PRESETS: PresetDef[] = [
  {
    id: "todo",
    es: "Todo",
    en: "Everything",
    noteEs: "Cada sección, cada cliente",
    noteEn: "Every section, every client",
    period: "all",
    sections: { ...ALL_ON },
    groups: { active: true, oneTime: true, archived: true },
    phones: true,
    names: true,
    amounts: true,
  },
  {
    id: "cobros",
    es: "Cobros y deudas",
    en: "Payments & debts",
    noteEs: "Quién debe y lo que entró",
    noteEn: "Who owes and what came in",
    period: "month",
    sections: { ...NONE, resumen: true, cobros: true, pagos: true },
    groups: { active: true, oneTime: true, archived: true },
    phones: true,
    names: true,
    amounts: true,
  },
  {
    id: "agenda",
    es: "Agenda semanal",
    en: "This week's route",
    noteEs: "Hoja de ruta para llevar",
    noteEn: "A route sheet to carry",
    period: "week",
    sections: { ...NONE, agenda: true, notas: true },
    groups: { active: true, oneTime: true, archived: false },
    phones: true,
    names: true,
    amounts: true,
    ahead: 7,
  },
  {
    id: "mes",
    es: "Resumen del mes",
    en: "Month summary",
    noteEs: "Cómo fue el mes, en cifras",
    noteEn: "How the month went, in figures",
    period: "month",
    sections: { ...NONE, resumen: true, cobros: true, pagos: true, trabajos: true, horas: true, propinas: true, pospuestos: true, asesor: true },
    groups: { active: true, oneTime: true, archived: true },
    phones: false,
    names: true,
    amounts: true,
  },
  {
    id: "clientes",
    es: "Clientes",
    en: "Clients",
    noteEs: "Directorio con precios",
    noteEn: "Directory with prices",
    period: "all",
    sections: { ...NONE, clientes: true, precios: true },
    groups: { active: true, oneTime: true, archived: false },
    phones: true,
    names: true,
    amounts: true,
  },
  {
    id: "contador",
    es: "Para el contador",
    en: "For the CPA",
    noteEs: "Ingresos por mes, propinas, pagos",
    noteEn: "Income by month, tips, payments",
    period: "lastYear",
    sections: { ...NONE, resumen: true, pagos: true, propinas: true, trabajos: true },
    groups: { active: true, oneTime: true, archived: true },
    phones: false,
    names: true,
    amounts: true,
  },
];

export const PERIODS: { id: PeriodId; es: string; en: string }[] = [
  { id: "week", es: "Esta semana", en: "This week" },
  { id: "month", es: "Este mes", en: "This month" },
  { id: "lastMonth", es: "Mes pasado", en: "Last month" },
  { id: "year", es: "Este año", en: "This year" },
  { id: "lastYear", es: "Año pasado", en: "Last year" },
  { id: "all", es: "Todo", en: "All time" },
  { id: "custom", es: "Fechas…", en: "Dates…" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** The dates a period covers, from today's date. */
export function resolvePeriod(o: Pick<ExportOptions, "period" | "from" | "to">, today: string): { from: string; to: string } {
  const { year, month } = monthParts(today);
  switch (o.period) {
    case "week":
      return { from: startOfWeekISO(today), to: endOfWeekISO(today) };
    case "month":
      return { from: `${year}-${pad(month)}-01`, to: lastDayOfMonthISO(year, month) };
    case "lastMonth": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { from: `${y}-${pad(m)}-01`, to: lastDayOfMonthISO(y, m) };
    }
    case "year":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "lastYear":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "custom": {
      const ok = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
      let from = ok(o.from) ? o.from : `${year}-${pad(month)}-01`;
      let to = ok(o.to) ? o.to : today;
      if (to < from) [from, to] = [to, from];
      return { from, to };
    }
    default:
      return { from: "2000-01-01", to: addDaysISO(today, 0) };
  }
}

export function presetOptions(id: PresetId, keep?: Partial<ExportOptions>): ExportOptions {
  const p = PRESETS.find((item) => item.id === id) ?? PRESETS[0]!;
  return {
    preset: p.id,
    period: p.period,
    from: keep?.from ?? "",
    to: keep?.to ?? "",
    ahead: p.ahead ?? keep?.ahead ?? 14,
    sections: { ...p.sections },
    groups: { ...p.groups },
    pick: null,
    phones: p.phones,
    names: p.names,
    amounts: p.amounts,
  };
}

/** Which preset these choices match (period and the route's reach are free), or "custom". */
export function matchPreset(o: ExportOptions): PresetId | "custom" {
  for (const p of PRESETS) {
    const same =
      SECTIONS.every((s) => Boolean(p.sections[s.id]) === Boolean(o.sections[s.id])) &&
      p.groups.active === o.groups.active &&
      p.groups.oneTime === o.groups.oneTime &&
      p.groups.archived === o.groups.archived &&
      p.phones === o.phones &&
      p.names === o.names &&
      p.amounts === o.amounts &&
      o.pick == null;
    if (same) return p.id;
  }
  return "custom";
}

const KEY = "bz-export-options-v1";

export function loadExportOptions(): ExportOptions {
  const base = presetOptions("mes");
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ExportOptions>;
    const o: ExportOptions = {
      preset: "custom",
      period: PERIODS.some((p) => p.id === parsed.period) ? (parsed.period as PeriodId) : base.period,
      from: typeof parsed.from === "string" ? parsed.from : "",
      to: typeof parsed.to === "string" ? parsed.to : "",
      ahead: parsed.ahead === 7 || parsed.ahead === 28 ? parsed.ahead : 14,
      sections: { ...base.sections, ...(parsed.sections ?? {}) },
      groups: { ...base.groups, ...(parsed.groups ?? {}) },
      pick: Array.isArray(parsed.pick) ? parsed.pick.filter((n) => Number.isFinite(n)) : null,
      phones: parsed.phones !== false,
      names: parsed.names !== false,
      amounts: parsed.amounts !== false,
    };
    if (o.pick && o.pick.length === 0) o.pick = null;
    o.preset = matchPreset(o);
    return o;
  } catch {
    return base;
  }
}

export function saveExportOptions(o: ExportOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* storage full: the choice is simply not remembered */
  }
}

/** Sections that print with these choices (money sections need amounts on). */
export function chosenSections(o: ExportOptions): SectionId[] {
  return SECTIONS.filter((s) => o.sections[s.id] && (!s.money || o.amounts)).map((s) => s.id);
}

/** "Juan Pérez" → "J.P."; same initials get a number. */
export function initialsOf(name: string): string {
  const words = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const letter = (word: string) => (word.match(/\p{L}|\d/u)?.[0] ?? "").toUpperCase();
  const first = words[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1]! : "";
  const out = [letter(first), letter(last)].filter(Boolean).map((x) => `${x}.`).join("");
  return out || "?";
}
