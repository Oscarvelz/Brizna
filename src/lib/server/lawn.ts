import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  addDaysISO,
  addMonths,
  endOfWeekISO,
  isPaymentLate,
  lastDayOfMonthISO,
  monthParts,
  scheduleDatesForMonth,
  seasonCuts,
  startOfWeekISO,
  todayISO,
  nowHHMM,
  stampDay,
  weekdayFromISO,
  APP_TZ,
} from "@/lib/dates";
import { DEFAULT_BUSINESS_NAME } from "@/lib/format";
import { PHOTOS_ENABLED } from "@/lib/photos-flag";
import { sanitizeHtml } from "@/lib/sanitize";
import { smartHit } from "@/lib/fuzzy";
import { checksumMatches, idsToKeep, withChecksum } from "@/lib/backup-plan";
import { buildReportPdf } from "@/lib/report-pdf";
import { buildReportXls, type WorkbookPack } from "@/lib/report-xls";
import {
  AppSettings,
  BackupSummary,
  ClientChange,
  ClientFilter,
  ClientFlowPoint,
  ClientKind,
  ClientPhoto,
  ClientRow,
  ClientSort,
  ComputedStatus,
  CutsPerMonth,
  DashboardData,
  DayEffort,
  DEFAULT_ABONO_PRESETS,
  DEFAULT_ARRIVAL_PRESETS,
  DEFAULT_CUE_PRESETS,
  DEFAULT_PRICE_PRESETS,
  DEFAULT_DEBT_PRESETS,
  DEFAULT_MESSAGE_PRESETS,
  DEFAULT_TASK_PRESETS,
  DEFAULT_VISIT_PRESETS,
  FinanceStats,
  JobKind,
  JobListFilter,
  JobRange,
  JobRow,
  JobStatus,
  MoneyPoint,
  PadData,
  PadJob,
  PadPage,
  PadPhoto,
  PaymentKind,
  PaymentRow,
  PayTier,
} from "@/lib/types";

function money(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function intId(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asIsoDate(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return stampDay(v);
  return String(v ?? "").slice(0, 10);
}

function asIsoStamp(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function asTime(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

function asCuts(n: unknown): CutsPerMonth {
  const v = Number(n);
  if (v === 1 || v === 2 || v === 3 || v === 4 || v === 5) return v;
  return 2;
}

function computedStatus(status: JobStatus, scheduledDate: string, today: string): ComputedStatus {
  if (status === "pending" && scheduledDate < today) return "late";
  return status;
}

type ClientDb = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  kind: string;
  price_per_cut: unknown;
  cuts_per_month: number;
  weekday: number;
  weekday_2: number | null;
  frequency_days: number | null;
  arrival_time: unknown;
  start_date: unknown;
  pay_same_day: boolean;
  pay_due_day: number | null;
  sort_order: number;
  balance: unknown;
  credit?: unknown;
  rich_notes?: string | null;
  is_active: boolean;
  created_at: unknown;
  cue?: string | null;
  pinned?: boolean;
  blacklisted?: boolean;
  service_paused?: boolean;
  standing_extras?: string | null;
  season_start?: string | null;
  season_end?: string | null;
  season_every?: number | null;
  last_paid_at?: unknown;
  unpaid_jobs?: unknown;
  extras_this_month?: unknown;
  deactivated_at?: unknown;
  next_cut_date: unknown;
  overdue_date: unknown;
  last_cut_date: unknown;
  collected_total: unknown;
  cuts_this_month?: unknown;
};

type JobDb = {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string | null;
  client_address: string | null;
  pay_same_day?: boolean;
  credit?: unknown;
  scheduled_date: unknown;
  arrival_time?: unknown;
  sort_order?: number;
  status: string;
  kind: string;
  title: string | null;
  amount: unknown;
  notes: string | null;
  completed_at: unknown;
  pinned?: boolean;
  postpone_reason?: string | null;
  origin_date?: unknown;
  client_cue?: string | null;
  standing_extras?: string | null;
  has_photo?: boolean | null;
};

function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = to.slice(0, 10).split("-").map(Number);
  if (!ay || !by) return 0;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function parseExtras(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const s = part.trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s.slice(0, 40));
    if (out.length >= 8) break;
  }
  return out;
}

function mmddOrNull(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return /^\d{2}-\d{2}$/.test(s) ? s : null;
}

type RiskOpts = { riskDays: number; riskAmount: number; waitDays: number; riskCuts: number };

function payProfile(
  balance: number,
  lastPaid: string | null,
  lastCut: string | null,
  today: string,
  unpaidJobs: number,
  opts: RiskOpts,
): { highRisk: boolean; payTier: PayTier; daysSincePay: number | null; reliability: number } {
  const ref = lastPaid ?? lastCut;
  const days = ref ? daysBetween(ref, today) : null;
  // High risk by time counts after the waiting stretch (Ajustes: "Días para alto riesgo — Después de En espera").
  const lateByTime = days != null && days >= opts.waitDays + opts.riskDays;
  const lateByMoney = opts.riskAmount > 0 && balance >= opts.riskAmount;
  const lateByCuts = opts.riskCuts > 0 && unpaidJobs >= opts.riskCuts;
  const highRisk = balance > 0 && (lateByTime || lateByMoney || lateByCuts);
  const espera = balance > 0 && !highRisk && days != null && days >= opts.waitDays;
  const payTier: PayTier = highRisk ? "serio" : espera ? "espera" : "al_dia";
  let reliability = 100;
  if (balance > 0 && days != null) reliability -= Math.min(70, Math.max(0, days - 7));
  if (lateByMoney) reliability -= 20;
  if (highRisk) reliability = Math.min(reliability, 35);
  if (espera) reliability = Math.min(reliability, 70);
  return {
    highRisk,
    payTier,
    daysSincePay: balance > 0 ? days : days,
    reliability: Math.max(0, Math.min(100, Math.round(reliability))),
  };
}

function mapClient(row: ClientDb, today = todayISO(), risk: number | RiskOpts = 21): ClientRow {
  const balance = money(row.balance);
  const lastPaid = row.last_paid_at ? asIsoDate(row.last_paid_at) : null;
  const lastCut = row.last_cut_date ? asIsoDate(row.last_cut_date) : null;
  const opts: RiskOpts =
    typeof risk === "number"
      ? { riskDays: risk, riskAmount: 200, waitDays: 45, riskCuts: 3 }
      : risk;
  const profile = payProfile(balance, lastPaid, lastCut, today, intId(row.unpaid_jobs), opts);
  return {
    id: intId(row.id),
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    richNotes: row.rich_notes ?? "",
    kind: (row.kind === "one_time" ? "one_time" : "regular") as ClientKind,
    pricePerCut: money(row.price_per_cut),
    cutsPerMonth: asCuts(row.cuts_per_month),
    weekday: Number(row.weekday) || 1,
    weekday2: row.weekday_2 == null ? null : Number(row.weekday_2),
    frequencyDays: row.frequency_days == null ? null : Number(row.frequency_days) || null,
    arrivalTime: asTime(row.arrival_time),
    startDate: row.start_date ? asIsoDate(row.start_date) : null,
    paySameDay: Boolean(row.pay_same_day),
    payDueDay: row.pay_due_day == null ? null : Number(row.pay_due_day) || null,
    sortOrder: Number(row.sort_order) || 0,
    balance,
    credit: money(row.credit),
    isActive: Boolean(row.is_active),
    createdAt: asIsoStamp(row.created_at),
    nextCutDate: row.next_cut_date ? asIsoDate(row.next_cut_date) : null,
    overdueDate: row.overdue_date ? asIsoDate(row.overdue_date) : null,
    lastCutDate: lastCut,
    collectedTotal: money(row.collected_total),
    cutsThisMonth: intId(row.cuts_this_month),
    tripleCut: intId(row.cuts_this_month) >= 3,
    cue: row.cue?.trim() ? row.cue.trim() : null,
    pinned: Boolean(row.pinned),
    blacklisted: Boolean(row.blacklisted),
    servicePaused: Boolean(row.service_paused),
    highRisk: profile.highRisk,
    hasExtra: intId(row.extras_this_month) > 0,
    deactivatedAt: row.deactivated_at ? asIsoStamp(row.deactivated_at) : null,
    standingExtras: parseExtras(row.standing_extras),
    seasonStart: mmddOrNull(row.season_start),
    seasonEnd: mmddOrNull(row.season_end),
    seasonEvery: row.season_every == null ? null : Number(row.season_every) || null,
    daysSincePay: profile.daysSincePay,
    lastPaidDate: lastPaid,
    payTier: profile.payTier,
    reliability: profile.reliability,
  };
}

function mapJob(row: JobDb, today: string): JobRow {
  const status = (row.status as JobStatus) ?? "pending";
  const scheduledDate = asIsoDate(row.scheduled_date);
  return {
    id: intId(row.id),
    clientId: intId(row.client_id),
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    paySameDay: Boolean(row.pay_same_day),
    credit: money(row.credit),
    scheduledDate,
    arrivalTime: asTime(row.arrival_time),
    sortOrder: Number(row.sort_order) || 0,
    status,
    computedStatus: computedStatus(status, scheduledDate, today),
    kind: (row.kind as JobKind) ?? "cut",
    title: row.title,
    amount: money(row.amount),
    notes: row.notes,
    completedAt: row.completed_at ? asIsoStamp(row.completed_at) : null,
    pinned: Boolean(row.pinned),
    postponeReason: row.postpone_reason?.trim() ? row.postpone_reason.trim() : null,
    originDate: row.origin_date ? asIsoDate(row.origin_date) : null,
    clientCue: row.client_cue?.trim() ? row.client_cue.trim() : null,
    standingExtras: parseExtras(row.standing_extras),
    hasPhoto: Boolean(row.has_photo),
  };
}

const CLIENT_SELECT = `
  c.id, c.name, c.phone, c.address, c.notes, c.kind, c.price_per_cut,
  c.cuts_per_month, c.weekday, c.weekday_2, c.frequency_days, c.arrival_time,
  c.start_date, c.pay_same_day, c.pay_due_day, c.sort_order, c.balance, c.credit, c.rich_notes,
  c.is_active, c.created_at, c.deactivated_at, c.cue, c.pinned, c.blacklisted, c.service_paused,
  c.standing_extras, c.season_start, c.season_end, c.season_every,
  (select min(j.scheduled_date) from jobs j
     where j.client_id = c.id and j.user_id = c.user_id
       and j.status = 'pending' and j.scheduled_date >= $2) as next_cut_date,
  (select min(j.scheduled_date) from jobs j
     where j.client_id = c.id and j.user_id = c.user_id
       and j.status = 'pending' and j.scheduled_date < $2) as overdue_date,
  (select max(j.scheduled_date) from jobs j
     where j.client_id = c.id and j.user_id = c.user_id
       and j.status = 'done') as last_cut_date,
  coalesce((select sum(p.amount) from payments p
     where p.client_id = c.id and p.user_id = c.user_id and p.kind in ('paid','prepaid')), 0) as collected_total,
  (select count(*) from jobs j
     where j.client_id = c.id and j.user_id = c.user_id
       and j.status <> 'cancelled'
       and j.scheduled_date >= date_trunc('month', $2::date)
       and j.scheduled_date < date_trunc('month', $2::date) + interval '1 month') as cuts_this_month,
  (select count(*) from jobs j
     where j.client_id = c.id and j.user_id = c.user_id and j.kind = 'extra'
       and j.status <> 'cancelled'
       and j.scheduled_date >= date_trunc('month', $2::date)
       and j.scheduled_date < date_trunc('month', $2::date) + interval '1 month') as extras_this_month,
  (select max(p.paid_at) from payments p
     where p.client_id = c.id and p.user_id = c.user_id and p.kind in ('paid','prepaid')) as last_paid_at,
  (select count(*) from (
     select j.amount,
            sum(j.amount) over (
              order by coalesce(j.completed_at, j.scheduled_date::timestamptz) desc, j.id desc
            ) as running
       from jobs j
      where j.client_id = c.id and j.user_id = c.user_id and j.status = 'done'
   ) unpaid
   where unpaid.running - unpaid.amount < c.balance) as unpaid_jobs
`;

async function riskPrefs(userId: string): Promise<RiskOpts> {
  const sql = await getSql();
  const rows = await sql.query<{
    risk_days: number | null;
    risk_amount: unknown;
    wait_days: number | null;
    risk_cuts: number | null;
  }>(
    `select risk_days, risk_amount, wait_days, risk_cuts from app_settings where user_id = $1`,
    [userId],
  );
  const days = Number(rows[0]?.risk_days);
  const wait = Number(rows[0]?.wait_days);
  const amount = money(rows[0]?.risk_amount);
  const cuts = Number(rows[0]?.risk_cuts);
  return {
    riskDays: days >= 3 && days <= 400 ? days : 21,
    waitDays: wait >= 7 && wait <= 400 ? wait : 45,
    riskAmount: amount > 0 ? amount : 200,
    riskCuts: cuts >= 1 && cuts <= 30 ? cuts : 3,
  };
}

async function riskDaysFor(userId: string): Promise<number> {
  return (await riskPrefs(userId)).riskDays;
}

async function loadClients(
  userId: string,
  today: string,
  filter: ClientFilter | "all",
): Promise<ClientRow[]> {
  const sql = await getSql();
  const risk = await riskPrefs(userId);
  const rows = await sql.query<ClientDb>(
    `select ${CLIENT_SELECT} from clients c where c.user_id = $1`,
    [userId, today],
  );
  let list = rows.map((row) => mapClient(row, today, risk));
  if (filter === "all") return list;
  if (filter === "active") list = list.filter((c) => c.isActive);
  else if (filter === "regular") list = list.filter((c) => c.isActive && c.kind === "regular");
  else if (filter === "one_time") list = list.filter((c) => c.isActive && c.kind === "one_time");
  else if (filter === "inactive") list = list.filter((c) => !c.isActive);
  else if (filter === "owing") list = list.filter((c) => c.balance > 0);
  else if (filter === "triple") list = list.filter((c) => c.isActive && (c.tripleCut || c.hasExtra));
  else if (filter === "blacklist") list = list.filter((c) => c.blacklisted);
  else if (filter === "risk") list = list.filter((c) => c.isActive && c.highRisk && !c.blacklisted);
  return list;
}

function sortClients(list: ClientRow[], sort: ClientSort): ClientRow[] {
  const copy = [...list];
  const byName = (a: ClientRow, b: ClientRow) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  copy.sort((a, b) => {
    switch (sort) {
      case "name_desc":
        return byName(b, a);
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "price_desc":
        return b.pricePerCut - a.pricePerCut || byName(a, b);
      case "price_asc":
        return a.pricePerCut - b.pricePerCut || byName(a, b);
      case "balance_desc":
        return b.balance - a.balance || byName(a, b);
      case "balance_asc":
        return a.balance - b.balance || byName(a, b);
      case "next_cut": {
        const av = a.nextCutDate ?? "9999-99-99";
        const bv = b.nextCutDate ?? "9999-99-99";
        return av.localeCompare(bv) || byName(a, b);
      }
      case "overdue": {
        const ar = a.overdueDate ? 0 : 1;
        const br = b.overdueDate ? 0 : 1;
        if (ar !== br) return ar - br;
        return (a.overdueDate ?? "").localeCompare(b.overdueDate ?? "") || byName(a, b);
      }
      case "name":
      default:
        return byName(a, b);
    }
  });
  return copy;
}

async function collectBackup(userId: string) {
  const sql = await getSql();
  const clients = await sql.query(`select * from clients where user_id = $1 order by name`, [userId]);
  const jobs = await sql.query(`select * from jobs where user_id = $1 order by scheduled_date, id`, [userId]);
  const payments = await sql.query(`select * from payments where user_id = $1 order by paid_at, id`, [userId]);
  const pad = await sql.query(`select body from pad_notes where user_id = $1`, [userId]);
  const pages = await sql.query(
    `select id, title, body, sort_order, pinned, tags, due_date, due_time from pad_pages where user_id = $1 order by sort_order, id`,
    [userId],
  );
  const workDays = await sql.query(
    `select work_date, clock_in, clock_out, stopped_reason, stopped_at, confirmed, auto from work_days where user_id = $1 order by work_date`,
    [userId],
  );
  const marks = await sql.query(
    `select mark_date, reason, detail, kind from day_marks where user_id = $1 order by mark_date`,
    [userId],
  );
  const settings = await sql.query(`select * from app_settings where user_id = $1`, [userId]);
  // v5: the rest of the user's tables, so a safety copy taken before a sync overwrite is complete.
  const clientChanges = await sql.query(`select * from client_changes where user_id = $1 order by id`, [userId]);
  const dayGoals = await sql.query(`select * from day_goals where user_id = $1 order by goal_date`, [userId]);
  const dayNotes = await sql.query(`select * from day_notes where user_id = $1 order by note_date`, [userId]);
  const padLinks = await sql.query(`select * from pad_links where user_id = $1 order by id`, [userId]);
  const weekOff = await sql.query(`select * from week_off_dates where user_id = $1 order by off_date`, [userId]);
  return withChecksum({
    version: 5,
    savedAt: new Date().toISOString(),
    clients,
    jobs,
    payments,
    padNotes: pad[0]?.body ?? "",
    padPages: pages,
    workDays,
    dayMarks: marks,
    settings: settings[0] ?? null,
    clientChanges,
    dayGoals,
    dayNotes,
    padLinks,
    weekOff,
  });
}

const BACKUP_GAP_MS = 10 * 60 * 1000;
let lastSnapshotAt = 0;

// Automatic safety copies: at most one every 10 minutes during normal work (a full copy of
// years of records on every tap made "Hecho" slow). Risky actions pass force = true.
export async function snapshotBackup(userId: string, force = false): Promise<void> {
  if (!force && Date.now() - lastSnapshotAt < BACKUP_GAP_MS) return;
  lastSnapshotAt = Date.now();
  const sql = await getSql();
  const payload = await collectBackup(userId);
  await sql.query(`insert into backups (user_id, payload) values ($1, $2::jsonb)`, [userId, JSON.stringify(payload)]);
  const rows = await sql.query<{ id: number; created_at: unknown }>(
    `select id, created_at from backups where user_id = $1 order by created_at desc, id desc`,
    [userId],
  );
  const keep = idsToKeep(
    rows.map((row) => ({ id: intId(row.id), at: asIsoStamp(row.created_at) })),
  );
  const drop = rows.map((row) => intId(row.id)).filter((id) => !keep.has(id));
  if (drop.length) {
    const slots = drop.map((_, index) => `$${index + 2}`).join(", ");
    await sql.query(`delete from backups where user_id = $1 and id in (${slots})`, [userId, ...drop]);
  }
  await sql.query(
    `insert into app_settings (user_id, last_backup_at, updated_at)
     values ($1, now(), now())
     on conflict (user_id) do update set last_backup_at = now(), updated_at = now()`,
    [userId],
  );
}

let ensureMemo: { key: string; run: Promise<void> } | null = null;

async function ensureScheduleForUser(userId: string): Promise<void> {
  // On the device, screens read the schedule many times; top it up once per day and
  // again only after something was saved (or synced in). Writes always run it fresh.
  const G = globalThis as { __bzWriteEpoch?: number; __bzInPost?: number; __bzDbKey?: string };
  if (typeof G.__bzWriteEpoch === "number" && !G.__bzInPost) {
    const today = todayISO();
    const key = `${userId}|${today}|${G.__bzWriteEpoch}`;
    if (ensureMemo?.key === key) return ensureMemo.run;
    let store: Storage | null = null;
    try { store = typeof localStorage === "undefined" ? null : localStorage; } catch { store = null; }
    const stampKey = `brizna.ensured.${G.__bzDbKey ?? ""}.${userId}`;
    const stamp = store?.getItem(stampKey) ?? null;
    if (stamp === today) {
      // Already topped up today on this device (saves top it up themselves).
      ensureMemo = { key, run: Promise.resolve() };
      return;
    }
    const run = ensureScheduleForUserInner(userId)
      .then(() => { try { store?.setItem(stampKey, today); } catch { /* ignore */ } })
      .catch((err) => {
        console.error("[ensureSchedule]", err);
        if (ensureMemo?.key === key) ensureMemo = null;
      });
    ensureMemo = { key, run };
    if (stamp) {
      // Topped up on an earlier day: today's visits already exist, so show the screen now
      // and extend the far end of the schedule in the background.
      void run.then(() => {
        try { new BroadcastChannel("ols-live").postMessage({ all: true }); } catch { /* ignore */ }
      });
      return;
    }
    return run;
  }
  try {
    await ensureScheduleForUserInner(userId);
  } catch (err) {
    console.error("[ensureSchedule]", err);
  }
}

export async function ensureScheduleForUserInner(userId: string): Promise<void> {
  const sql = await getSql();
  const today = todayISO();
  const { year, month } = monthParts(today);
  const prefs = await loadPrefs(userId).catch(() => ({
    excludedWeekdays: [] as number[],
    weekGoals: {},
    abonoPresets: DEFAULT_ABONO_PRESETS,
    vacationStart: null as string | null,
    vacationEnd: null as string | null,
    vacationShift: 0,
    horizonMonths: 12,
    seasonStart: null as string | null,
    seasonEnd: null as string | null,
    seasonEvery: null as number | null,
  }));
  const excluded = prefs.excludedWeekdays;
  const offRows = await sql.query<{ off_date: unknown }>(
    `select off_date from week_off_dates where user_id = $1 and off_date >= $2::date`,
    [userId, today],
  );
  const offDates = new Set(offRows.map((r) => asIsoDate(r.off_date)));
  const clients = await sql.query<{
    id: number;
    weekday: number;
    weekday_2: number | null;
    cuts_per_month: number;
    frequency_days: number | null;
    start_date: unknown;
    arrival_time: unknown;
    price_per_cut: unknown;
    season_start: string | null;
    season_end: string | null;
    season_every: number | null;
  }>(
    `select id, weekday, weekday_2, cuts_per_month, frequency_days, start_date,
            arrival_time, price_per_cut, season_start, season_end, season_every
       from clients
      where user_id = $1 and is_active = true and kind = 'regular' and blacklisted = false and service_paused = false`,
    [userId],
  );

  const horizon = prefs.horizonMonths;
  const untilPart = addMonths(year, month, Math.max(0, horizon - 1));
  const until = lastDayOfMonthISO(untilPart.year, untilPart.month);

  // One read of every future cut for all clients (instead of three queries per client).
  const futureRows = await sql.query<{
    id: number;
    client_id: number;
    scheduled_date: unknown;
    status: string;
    postpone_reason: string | null;
    origin_date: unknown;
  }>(
    `select id, client_id, scheduled_date, status, postpone_reason, origin_date from jobs
      where user_id = $1 and kind = 'cut' and scheduled_date >= $2::date`,
    [userId, today],
  );
  const futureByClient = new Map<number, typeof futureRows>();
  for (const row of futureRows) {
    const key = intId(row.client_id);
    const list = futureByClient.get(key);
    if (list) list.push(row);
    else futureByClient.set(key, [row]);
  }
  const dropIds: number[] = [];

  for (const client of clients) {
    const generated: string[] = [];
    for (let step = 0; step < horizon; step += 1) {
      const part = addMonths(year, month, step);
      generated.push(
        ...scheduleDatesForMonth({
          year: part.year,
          month: part.month,
          weekday: Number(client.weekday) || 1,
          weekday2: client.weekday_2 == null ? null : Number(client.weekday_2),
          cutsPerMonth: Number(client.cuts_per_month) || 2,
          frequencyDays: client.frequency_days == null ? null : Number(client.frequency_days),
          startDate: client.start_date ? asIsoDate(client.start_date) : null,
          today,
        }).map((d) => nextOpenDate(d, excluded, offDates)),
      );
    }
    const seasonStart = mmddOrNull(client.season_start) ?? prefs.seasonStart;
    const seasonEnd = mmddOrNull(client.season_end) ?? prefs.seasonEnd;
    const seasonEvery =
      client.season_every != null && Number(client.season_every) >= 7
        ? Number(client.season_every)
        : prefs.seasonEvery;
    const anchor = client.start_date ? asIsoDate(client.start_date) : today;
    let planned = [...new Set(generated)];
    if (seasonStart && seasonEnd && seasonEvery) {
      const seasonal = seasonCuts({
        seasonStart,
        seasonEnd,
        every: seasonEvery,
        anchor,
        from: today,
        until,
      }).map((d) => nextOpenDate(d, excluded, offDates));
      const outside = planned.filter((d) => {
        const md = d.slice(5, 10);
        const inside =
          seasonStart <= seasonEnd ? md >= seasonStart && md <= seasonEnd : md >= seasonStart || md <= seasonEnd;
        return !inside;
      });
      planned = [...new Set([...outside, ...seasonal])];
    }
    const keptRows = (futureByClient.get(intId(client.id)) ?? []).filter((r) => r.status === "pending");
    const claimed = new Set<string>();
    const sticky = new Set<string>();
    const shifted: string[] = [];
    for (const row of keptRows) {
      const d = asIsoDate(row.scheduled_date);
      if (row.origin_date) claimed.add(asIsoDate(row.origin_date));
      if (offDates.has(d) || Boolean(row.postpone_reason?.trim()) || row.origin_date) {
        sticky.add(d);
      }
      if (row.postpone_reason?.trim() && !row.origin_date) shifted.push(d);
    }
    const insertDates = [...new Set(planned.filter((d) => {
      if (claimed.has(d)) return false;
      return !shifted.some((m) => {
        if (m === d) return false;
        if (startOfWeekISO(m) === startOfWeekISO(d)) return true;
        return d < m && m <= addDaysISO(d, 10);
      });
    }))];
    const uniqueDates = new Set([...insertDates, ...sticky]);
    const amount = money(client.price_per_cut);
    const arrival = asTime(client.arrival_time);
    const have = new Set((futureByClient.get(intId(client.id)) ?? []).map((r) => asIsoDate(r.scheduled_date)));
    for (const date of insertDates) {
      if (have.has(date)) continue;
      await sql.query(
        `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount, arrival_time)
         select $1, $2, $3::date, 'pending', 'cut', 'Corte de césped', $4, $5
          where not exists (
            select 1 from jobs
             where user_id = $1 and client_id = $2 and scheduled_date = $3::date and kind = 'cut'
          )`,
        [userId, client.id, date, amount, arrival],
      );
    }
    if (uniqueDates.size > 0) {
      for (const row of keptRows) {
        if (!uniqueDates.has(asIsoDate(row.scheduled_date))) dropIds.push(intId(row.id));
      }
    }
  }
  if (dropIds.length > 0) {
    await sql.query(
      `delete from jobs
        where user_id = $1 and status = 'pending' and kind = 'cut' and id = any($2::int[])`,
      [userId, dropIds],
    );
  }
}

async function loadJobsForIds(userId: string, today: string): Promise<JobRow[]> {
  // Only open jobs plus this week's history: years of finished cuts never reach the dashboard.
  const since = startOfWeekISO(today);
  const sql = await getSql();
  const rows = await sql.query<JobDb>(
    `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
            c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
            j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
            j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
       from jobs j
       join clients c on c.id = j.client_id
      where j.user_id = $1 and c.user_id = $1 and c.is_active = true and c.blacklisted = false
        and (j.status <> 'pending' or c.service_paused = false)
        and (j.status = 'pending' or j.scheduled_date >= $2::date)
      order by j.pinned desc, j.sort_order asc, j.scheduled_date asc, c.name asc`,
    [userId, since],
  );
  return rows.map((r) => mapJob(r, today));
}

const clientInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  kind: z.enum(["regular", "one_time"]),
  pricePerCut: z.coerce.number().min(0).max(100000),
  cutsPerMonth: z.coerce.number().int().min(1).max(5),
  weekday: z.coerce.number().int().min(0).max(6),
  weekday2: z.number().int().min(0).max(6).nullable().optional(),
  frequencyDays: z.number().int().min(1).max(60).nullable().optional(),
  arrivalTime: z.string().trim().max(8).optional().default(""),
  startDate: z.string().optional(),
  paySameDay: z.boolean().optional().default(false),
  payDueDay: z.number().int().min(1).max(31).nullable().optional(),
  oneTimeDate: z.string().optional(),
  oneTimeTitle: z.string().trim().max(120).optional().default(""),
  cue: z.string().trim().max(80).optional().default(""),
  richNotes: z.string().max(20000).optional().default(""),
  standingExtras: z.string().trim().max(240).optional().default(""),
  seasonStart: z.string().trim().max(5).optional().default(""),
  seasonEnd: z.string().trim().max(5).optional().default(""),
  seasonEvery: z.number().int().min(7).max(60).nullable().optional(),
  openingBalance: z.coerce.number().min(0).max(100000).optional().default(0),
});

function addDaysCap(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function parseStringList(raw: unknown, fallback: string[], max = 24): string[] {
  if (!raw) return fallback;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return fallback;
    const out = v.map((s) => String(s).trim()).filter((s) => s.length > 0 && s.length <= 40);
    return out.length ? out.slice(0, max) : fallback;
  } catch {
    return fallback;
  }
}

function parseNumList(raw: unknown, fallback: number[]): number[] {
  if (!raw) return fallback;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return fallback;
    const nums = v
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 100000)
      .map((n) => Math.round(n * 100) / 100);
    return nums.length ? nums.slice(0, 12) : fallback;
  } catch {
    return fallback;
  }
}

function parseWeekGoals(raw: unknown): Record<string, number> {
  if (!raw) return {};
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || typeof v !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const day = Number(k);
      const g = Number(val);
      if (day >= 0 && day <= 6 && Number.isFinite(g) && g >= 1 && g <= 80) {
        out[String(day)] = Math.round(g);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseExcluded(raw: unknown): number[] {
  if (!raw) return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map(Number).filter((n) => n >= 0 && n <= 6))];
  } catch {
    return [];
  }
}

function nextOpenDate(iso: string, excluded: number[], offDates?: Set<string>): string {
  const offs = offDates ?? new Set<string>();
  if ((excluded.length === 0 || excluded.length >= 7) && offs.size === 0) return iso;
  let d = iso;
  for (let i = 0; i < 28; i += 1) {
    const closedWeekday =
      excluded.length > 0 && excluded.length < 7 && excluded.includes(weekdayFromISO(d));
    if (!closedWeekday && !offs.has(d)) return d;
    d = addDaysISO(d, 1);
  }
  return iso;
}

async function loadPrefs(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{
    week_goals: string | null;
    abono_presets: string | null;
    vacation_start: unknown;
    vacation_end: unknown;
    vacation_shift: number | null;
    excluded_weekdays: string | null;
    horizon_months: number | null;
    season_start: string | null;
    season_end: string | null;
    season_every: number | null;
  }>(
    `select week_goals, abono_presets, vacation_start, vacation_end, vacation_shift, excluded_weekdays,
            horizon_months, season_start, season_end, season_every
       from app_settings where user_id = $1`,
    [userId],
  );
  const r = rows[0];
  const horizon = Number(r?.horizon_months);
  const every = Number(r?.season_every);
  return {
    weekGoals: parseWeekGoals(r?.week_goals),
    abonoPresets: parseNumList(r?.abono_presets, DEFAULT_ABONO_PRESETS),
    vacationStart: r?.vacation_start ? asIsoDate(r.vacation_start) : null,
    vacationEnd: r?.vacation_end ? asIsoDate(r.vacation_end) : null,
    vacationShift: Number(r?.vacation_shift) || 0,
    excludedWeekdays: parseExcluded(r?.excluded_weekdays),
    horizonMonths: horizon >= 4 && horizon <= 18 ? horizon : 12,
    seasonStart: mmddOrNull(r?.season_start),
    seasonEnd: mmddOrNull(r?.season_end),
    seasonEvery: every >= 7 && every <= 60 ? every : null,
  };
}

export async function logClientChange(
  userId: string,
  clientId: number,
  summary: string,
  snapshot: unknown,
) {
  const sql = await getSql();
  await sql.query(
    `insert into client_changes (user_id, client_id, summary, snapshot) values ($1,$2,$3,$4)`,
    [userId, clientId, summary.slice(0, 240), JSON.stringify(snapshot ?? {})],
  );
  await sql.query(
    `delete from client_changes
      where user_id = $1 and client_id = $2 and id not in (
        select id from client_changes
         where user_id = $1 and client_id = $2
         order by created_at desc, id desc
         limit 40
      )`,
    [userId, clientId],
  );
}

async function moveJobToDate(
  userId: string,
  jobId: number,
  clientId: number,
  target: string,
): Promise<string> {
  const sql = await getSql();
  let d = target;
  for (let i = 0; i < 21; i += 1) {
    try {
      await sql.query(
        `update jobs
            set scheduled_date = $3::date,
                origin_date = coalesce(origin_date, scheduled_date)
          where user_id = $1 and id = $2 and status = 'pending'`,
        [userId, jobId, d],
      );
      return d;
    } catch {
      d = addDaysISO(d, 1);
    }
  }
  return target;
}

async function shiftPendingJobs(
  userId: string,
  days: number,
  fromDate: string,
  toDate?: string,
): Promise<number> {
  if (days === 0) return 0;
  const sql = await getSql();
  const rows = await sql.query<{ id: number; client_id: number; scheduled_date: unknown }>(
    `select id, client_id, scheduled_date from jobs
      where user_id = $1 and status = 'pending'
        and scheduled_date >= $2::date
        ${toDate ? "and scheduled_date <= $3::date" : ""}
      order by scheduled_date ${days > 0 ? "desc" : "asc"}, id desc`,
    toDate ? [userId, fromDate, toDate] : [userId, fromDate],
  );
  let moved = 0;
  for (const row of rows) {
    const prev = asIsoDate(row.scheduled_date);
    const next = addDaysISO(prev, days);
    await moveJobToDate(userId, intId(row.id), intId(row.client_id), next);
    moved += 1;
  }
  return moved;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function highRiskClientIds(userId: string, today: string): Promise<Set<number>> {
  const sql = await getSql();
  const risk = await riskPrefs(userId);
  const rows = await sql.query<{
    id: number;
    balance: unknown;
    last_paid: unknown;
    last_cut: unknown;
    unpaid_jobs: unknown;
  }>(
    `select c.id, c.balance,
            (select max(p.paid_at)::date from payments p
              where p.user_id = c.user_id and p.client_id = c.id and p.kind in ('paid','prepaid')) as last_paid,
            (select max(j.scheduled_date) from jobs j
              where j.user_id = c.user_id and j.client_id = c.id and j.status = 'done') as last_cut,
            (select count(*) from (
               select j.amount,
                      sum(j.amount) over (
                        order by coalesce(j.completed_at, j.scheduled_date::timestamptz) desc, j.id desc
                      ) as running
                 from jobs j
                where j.client_id = c.id and j.user_id = c.user_id and j.status = 'done'
             ) unpaid
             where unpaid.running - unpaid.amount < c.balance) as unpaid_jobs
       from clients c
      where c.user_id = $1 and c.is_active = true and c.blacklisted = false and c.balance > 0`,
    [userId],
  );
  const ids = new Set<number>();
  for (const row of rows) {
    const balance = money(row.balance);
    const ref = row.last_paid ? asIsoDate(row.last_paid) : row.last_cut ? asIsoDate(row.last_cut) : null;
    const lateByTime = ref != null && daysBetween(ref, today) >= risk.waitDays + risk.riskDays;
    const lateByMoney = balance >= risk.riskAmount;
    const lateByCuts = risk.riskCuts > 0 && intId(row.unpaid_jobs) >= risk.riskCuts;
    if (lateByTime || lateByMoney || lateByCuts) ids.add(intId(row.id));
  }
  return ids;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DashboardData> => {
    await ensureScheduleForUser(context.userId);
    const sql = await getSql();
    const today = todayISO();
    const weekStart = startOfWeekISO(today);
    const weekEnd = endOfWeekISO(today);
    const { year, month } = monthParts(today);
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = lastDayOfMonthISO(year, month);

    const jobs = await loadJobsForIds(context.userId, today);
    const todayJobs = jobs.filter((j) => j.scheduledDate === today && j.status === "pending");
    const todayDone = jobs.filter((j) => j.scheduledDate === today && j.status === "done");
    const overdue = jobs.filter((j) => j.computedStatus === "late");
    const upcoming = jobs.filter(
      (j) =>
        j.status === "pending" && j.scheduledDate > today && j.scheduledDate <= addDaysCap(today, 7),
    );

    const statsRows = await sql.query<{
      active_clients: unknown;
      regular_clients: unknown;
      onetime_clients: unknown;
      outstanding: unknown;
      collected_month: unknown;
      completed_month: unknown;
      completed_week: unknown;
      archived_clients: unknown;
    }>(
      `select
         (select count(*) from clients where user_id = $1 and is_active = true) as active_clients,
         (select count(*) from clients where user_id = $1 and is_active = true and kind = 'regular') as regular_clients,
         (select count(*) from clients where user_id = $1 and is_active = true and kind = 'one_time') as onetime_clients,
         (select coalesce(sum(balance),0) from clients where user_id = $1) as outstanding,
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind in ('paid','prepaid') and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as collected_month,
         (select coalesce(sum(amount),0) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date) as completed_month,
         (select coalesce(sum(amount),0) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $4::date and scheduled_date <= $5::date) as completed_week,
         (select count(*) from clients where user_id = $1 and is_active = false) as archived_clients`,
      [context.userId, monthStart, monthEnd, weekStart, weekEnd],
    );
    const s = statsRows[0];
    const weekPending = jobs.filter(
      (j) => j.status === "pending" && j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd,
    );
    const weekDone = jobs.filter(
      (j) => j.status === "done" && j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd,
    );
    const goalRows = await sql.query<{ goal_date: unknown; goal: number }>(
      `select goal_date, goal from day_goals
        where user_id = $1 and goal_date >= $2::date and goal_date <= $3::date`,
      [context.userId, weekStart, weekEnd],
    );
    const prefs = await loadPrefs(context.userId).catch(() => ({
      weekGoals: {} as Record<string, number>,
    }));
    const override = new Map(goalRows.map((r) => [asIsoDate(r.goal_date), Number(r.goal) || 0]));
    const weekEffort: DayEffort[] = [];
    const weekGoals: { date: string; goal: number }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDaysISO(weekStart, i);
      const dayJobs = jobs.filter((j) => j.scheduledDate === date && j.status !== "cancelled");
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      weekEffort.push({
        date,
        weekday,
        done: dayJobs.filter((j) => j.status === "done").length,
        pending: dayJobs.filter((j) => j.status === "pending").length,
      });
      const goal = override.get(date) || prefs.weekGoals[String(weekday)] || 0;
      if (goal > 0) weekGoals.push({ date, goal });
    }

    const riskIds = await highRiskClientIds(context.userId, today);
    const force = new Set<number>();
    for (const job of overdue) force.add(job.id);
    const seenRisk = new Set<number>();
    const riskNext = jobs
      .filter((j) => j.status === "pending" && j.scheduledDate >= today && riskIds.has(j.clientId))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    for (const job of riskNext) {
      if (seenRisk.has(job.clientId)) continue;
      seenRisk.add(job.clientId);
      force.add(job.id);
    }
    const lock = (job: JobRow): JobRow =>
      force.has(job.id) ? { ...job, pinned: true, pinLocked: true } : job;
    const extraAttention = jobs.filter(
      (job) => force.has(job.id) && job.status === "pending" && job.scheduledDate > addDaysCap(today, 7),
    );

    return {
      today: todayJobs.map(lock),
      todayDone,
      overdue: overdue.map(lock),
      upcoming: [...upcoming, ...extraAttention].map(lock),
      weekEffort,
      weekGoals,
      stats: {
        activeClients: intId(s?.active_clients),
        regularClients: intId(s?.regular_clients),
        oneTimeClients: intId(s?.onetime_clients),
        pendingToday: todayJobs.length,
        doneToday: todayDone.length,
        overdueCount: overdue.length,
        outstanding: money(s?.outstanding),
        collectedMonth: money(s?.collected_month),
        completedMonth: money(s?.completed_month),
        completedWeek: money(s?.completed_week),
        weekPendingCount: weekPending.length,
        weekPendingAmount: weekPending.reduce((sum, j) => sum + j.amount, 0),
        weekDoneCount: weekDone.length,
        archivedClients: intId(s?.archived_clients),
      },
    };
  });

const listClientsInput = z.object({
  q: z.string().optional().default(""),
  sort: z
    .enum([
      "name",
      "name_desc",
      "newest",
      "oldest",
      "price_desc",
      "price_asc",
      "balance_desc",
      "balance_asc",
      "next_cut",
      "overdue",
    ])
    .optional()
    .default("name"),
  filter: z
    .enum(["active", "regular", "one_time", "inactive", "owing", "triple", "blacklist", "risk"])
    .optional()
    .default("active"),
  flow: z.enum(["altas", "bajas"]).optional(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => listClientsInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await ensureScheduleForUser(context.userId);
    const today = todayISO();
    let list = await loadClients(
      context.userId,
      today,
      data.flow ? "all" : data.filter,
    );
    if (data.flow === "altas" && data.since) {
      const until = data.until ?? "9999-12-31";
      list = list.filter((c) => {
        const d = stampDay(c.createdAt);
        return d >= data.since! && d <= until;
      });
    } else if (data.flow === "bajas" && data.since) {
      const until = data.until ?? "9999-12-31";
      list = list.filter((c) => {
        const d = c.deactivatedAt ? stampDay(c.deactivatedAt) : "";
        return d >= data.since! && d <= until;
      });
    }
    const q = data.q.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const hay = `${c.name} ${c.phone ?? ""} ${c.address ?? ""} ${c.cue ?? ""}`;
        return smartHit(q, hay);
      });
    }
    return sortClients(list, data.sort);
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const today = todayISO();
    const rows = await sql.query<ClientDb>(
      `select ${CLIENT_SELECT} from clients c where c.user_id = $1 and c.id = $3`,
      [context.userId, today, data.id],
    );
    const client = rows[0] ? mapClient(rows[0], today, await riskPrefs(context.userId)) : null;
    if (!client) return null;
    const jobs = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras,
              (j.photo is not null) as has_photo
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and j.client_id = $2
        order by case when j.status = 'pending' then 0 else 1 end,
                 j.sort_order asc, j.scheduled_date asc, j.id desc`,
      [context.userId, data.id],
    );
    const payments = await sql.query<{
      id: number;
      client_id: number;
      amount: unknown;
      kind: string;
      note: string | null;
      method: string | null;
      paid_at: unknown;
      tip: unknown;
    }>(
      `select id, client_id, amount, kind, note, method, paid_at, tip
         from payments
        where user_id = $1 and client_id = $2
        order by paid_at desc, id desc
        limit 200`,
      [context.userId, data.id],
    );
    const photos = await sql.query<{
      id: number;
      caption: string | null;
      data: string;
      created_at: unknown;
    }>(
      `select id, caption, data, created_at from client_photos
        where user_id = $1 and client_id = $2
        order by created_at desc, id desc
        limit 6`,
      [context.userId, data.id],
    );
    const paymentRows: PaymentRow[] = payments.map((p) => ({
      id: intId(p.id),
      clientId: intId(p.client_id),
      amount: money(p.amount),
      kind: (p.kind as PaymentKind) ?? "paid",
      note: p.note,
      method: p.method,
      paidAt: asIsoStamp(p.paid_at),
      tip: money(p.tip),
    }));
    const photoRows: ClientPhoto[] = photos.map((p) => ({
      id: intId(p.id),
      caption: p.caption,
      data: p.data,
      createdAt: asIsoStamp(p.created_at),
    }));
    return { client, jobs: jobs.map((j) => mapJob(j, today)), payments: paymentRows, photos: photoRows };
  });

function normalizeArrival(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return null;
}

export const createClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => clientInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const phone = data.phone.trim() || null;
    const address = data.address.trim() || null;
    const notes = data.notes.trim() || null;
    const arrival = normalizeArrival(data.arrivalTime);
    const startDate =
      data.kind === "regular"
        ? data.startDate && data.startDate.length >= 8
          ? data.startDate
          : todayISO()
        : null;
    const weekday = startDate ? weekdayFromISO(startDate) : data.weekday;
    const freqDays = data.frequencyDays && data.frequencyDays > 0 ? data.frequencyDays : null;
    const weekday2 = data.cutsPerMonth === 5 ? (data.weekday2 ?? null) : null;
    const payDueDay = data.paySameDay ? null : (data.payDueDay ?? null);
    const cue = data.cue.trim() || null;
    const richNotes = sanitizeHtml(data.richNotes);
    const standing = parseExtras(data.standingExtras).join(", ") || null;
    const seasonStart = mmddOrNull(data.seasonStart);
    const seasonEnd = mmddOrNull(data.seasonEnd);
    const seasonEvery = seasonStart && seasonEnd && data.seasonEvery ? data.seasonEvery : null;
    const inserted = await sql.query<{ id: number }>(
      `insert into clients
         (user_id, name, phone, address, notes, kind, price_per_cut, cuts_per_month,
          weekday, weekday_2, frequency_days, arrival_time, start_date, pay_same_day, pay_due_day,
          cue, rich_notes, standing_extras, season_start, season_end, season_every)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       returning id`,
      [
        context.userId,
        data.name,
        phone,
        address,
        notes,
        data.kind,
        data.pricePerCut,
        data.kind === "regular" ? data.cutsPerMonth : 1,
        data.kind === "regular" ? weekday : 1,
        weekday2,
        freqDays,
        arrival,
        startDate,
        data.paySameDay,
        payDueDay,
        cue,
        richNotes,
        standing,
        seasonStart,
        seasonEnd,
        seasonEvery,
      ],
    );
    const id = intId(inserted[0]?.id);
    if (data.kind === "one_time") {
      const date = data.oneTimeDate && data.oneTimeDate.length >= 8 ? data.oneTimeDate : todayISO();
      const title = data.oneTimeTitle?.trim() || "Trabajo único";
      await sql.query(
        `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount, arrival_time)
         values ($1,$2,$3::date,'pending','one_time',$4,$5,$6)`,
        [context.userId, id, date, title, data.pricePerCut, arrival],
      );
    } else {
      await ensureScheduleForUser(context.userId);
    }
    const opening = Math.round((Number(data.openingBalance) || 0) * 100) / 100;
    if (opening > 0) {
      await sql.query(`update clients set balance = $3 where user_id = $1 and id = $2`, [
        context.userId,
        id,
        opening,
      ]);
      await sql.query(
        `insert into payments (user_id, client_id, amount, kind, note) values ($1,$2,$3,'opening',$4)`,
        [context.userId, id, opening, "Deuda anterior"],
      );
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { id };
  });

export const createClientsBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        contacts: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              phone: z.string().trim().max(40).optional().default(""),
              address: z.string().trim().max(240).optional().default(""),
              pricePerCut: z.coerce.number().min(0).max(100000).optional().default(30),
              cutsPerMonth: z.coerce.number().int().min(1).max(5).optional().default(2),
              weekday: z.coerce.number().int().min(0).max(6).optional(),
              startDate: z.string().optional(),
              paySameDay: z.boolean().optional().default(false),
              payDueDay: z.number().int().min(1).max(31).nullable().optional(),
              frequencyDays: z.number().int().min(1).max(60).nullable().optional(),
              kind: z.enum(["regular", "one_time"]).optional().default("regular"),
              oneTimeDate: z.string().optional(),
              oneTimeTitle: z.string().trim().max(120).optional().default(""),
              openingBalance: z.coerce.number().min(0).max(100000).optional().default(0),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const ids: number[] = [];
    for (const c of data.contacts) {
      const startDate =
        c.kind === "one_time"
          ? null
          : c.startDate && c.startDate.length >= 8
            ? c.startDate
            : todayISO();
      const weekday = startDate ? weekdayFromISO(startDate) : (c.weekday ?? 1);
      const inserted = await sql.query<{ id: number }>(
        `insert into clients
           (user_id, name, phone, address, kind, price_per_cut, cuts_per_month, weekday,
            start_date, pay_same_day, pay_due_day, frequency_days)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id`,
        [
          context.userId,
          c.name,
          c.phone.trim() || null,
          c.address.trim() || null,
          c.kind ?? "regular",
          c.pricePerCut ?? 30,
          c.kind === "one_time" ? 1 : (c.cutsPerMonth ?? 2),
          weekday,
          startDate,
          Boolean(c.paySameDay),
          c.paySameDay ? null : (c.payDueDay ?? null),
          c.frequencyDays ?? null,
        ],
      );
      const id = intId(inserted[0]?.id);
      ids.push(id);
      if (c.kind === "one_time") {
        const date = c.oneTimeDate && c.oneTimeDate.length >= 8 ? c.oneTimeDate : todayISO();
        await sql.query(
          `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount)
           values ($1,$2,$3::date,'pending','one_time',$4,$5)`,
          [context.userId, id, date, c.oneTimeTitle?.trim() || "Trabajo único", c.pricePerCut ?? 30],
        );
      }
      const opening = Math.round((Number(c.openingBalance) || 0) * 100) / 100;
      if (opening > 0) {
        await sql.query(`update clients set balance = $3 where user_id = $1 and id = $2`, [
          context.userId,
          id,
          opening,
        ]);
        await sql.query(
          `insert into payments (user_id, client_id, amount, kind, note) values ($1,$2,$3,'opening',$4)`,
          [context.userId, id, opening, "Deuda anterior"],
        );
      }
    }
    await ensureScheduleForUser(context.userId);
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ids, count: ids.length };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    clientInput.extend({ id: z.coerce.number().int() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql.query<{
      weekday: number;
      weekday_2: number | null;
      cuts_per_month: number;
      frequency_days: number | null;
      start_date: unknown;
      kind: string;
      season_start: string | null;
      season_end: string | null;
      season_every: number | null;
    }>(
      `select weekday, weekday_2, cuts_per_month, frequency_days, start_date, kind,
              season_start, season_end, season_every
         from clients where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    if (!existing[0]) return { ok: false as const };
    const phone = data.phone.trim() || null;
    const address = data.address.trim() || null;
    const notes = data.notes.trim() || null;
    const arrival = normalizeArrival(data.arrivalTime);
    const startDate =
      data.kind === "regular"
        ? data.startDate && data.startDate.length >= 8
          ? data.startDate
          : todayISO()
        : null;
    const weekday = startDate ? weekdayFromISO(startDate) : data.weekday;
    const freqDays = data.frequencyDays && data.frequencyDays > 0 ? data.frequencyDays : null;
    const weekday2 = data.cutsPerMonth === 5 ? (data.weekday2 ?? null) : null;
    const payDueDay = data.paySameDay ? null : (data.payDueDay ?? null);
    const cue = data.cue.trim() || null;
    const richNotes = sanitizeHtml(data.richNotes);
    const standing = parseExtras(data.standingExtras).join(", ") || null;
    const seasonStart = mmddOrNull(data.seasonStart);
    const seasonEnd = mmddOrNull(data.seasonEnd);
    const seasonEvery = seasonStart && seasonEnd && data.seasonEvery ? data.seasonEvery : null;
    await sql.query(
      `update clients
          set name = $3, phone = $4, address = $5, notes = $6,
              kind = $7, price_per_cut = $8, cuts_per_month = $9, weekday = $10,
              weekday_2 = $11, frequency_days = $12, arrival_time = $13,
              start_date = $14, pay_same_day = $15, pay_due_day = $16,
              cue = $17, rich_notes = $18, standing_extras = $19,
              season_start = $20, season_end = $21, season_every = $22
        where user_id = $1 and id = $2`,
      [
        context.userId,
        data.id,
        data.name,
        phone,
        address,
        notes,
        data.kind,
        data.pricePerCut,
        data.kind === "regular" ? data.cutsPerMonth : 1,
        data.kind === "regular" ? weekday : 1,
        weekday2,
        freqDays,
        arrival,
        startDate,
        data.paySameDay,
        payDueDay,
        cue,
        richNotes,
        standing,
        seasonStart,
        seasonEnd,
        seasonEvery,
      ],
    );

    const prev = existing[0];
    const scheduleChanged =
      data.kind === "regular" &&
      (Number(prev.weekday) !== weekday ||
        Number(prev.weekday_2) !== Number(weekday2) ||
        Number(prev.cuts_per_month) !== data.cutsPerMonth ||
        Number(prev.frequency_days) !== Number(freqDays) ||
        asIsoDate(prev.start_date) !== (startDate ?? "") ||
        (prev.season_start ?? "") !== (seasonStart ?? "") ||
        (prev.season_end ?? "") !== (seasonEnd ?? "") ||
        Number(prev.season_every ?? 0) !== Number(seasonEvery ?? 0));

    if (scheduleChanged) {
      const today = todayISO();
      await sql.query(
        `delete from jobs
          where user_id = $1 and client_id = $2 and kind = 'cut'
            and status = 'pending' and scheduled_date >= $3::date`,
        [context.userId, data.id, today],
      );
    }

    await sql.query(
      `update jobs set amount = $3, arrival_time = $4
        where user_id = $1 and client_id = $2 and kind = 'cut' and status = 'pending'`,
      [context.userId, data.id, data.pricePerCut, arrival],
    );

    if (data.kind === "regular") await ensureScheduleForUser(context.userId);
    await logClientChange(context.userId, data.id, "Datos del cliente actualizados", {
      name: data.name,
      phone,
      address,
      pricePerCut: data.pricePerCut,
      cutsPerMonth: data.cutsPerMonth,
      weekday,
      startDate,
      paySameDay: data.paySameDay,
      payDueDay,
      kind: data.kind,
    }).catch(() => undefined);
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const };
  });

export const setClientActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update clients
          set is_active = $3,
              deactivated_at = case when $3 then null else now() end
        where user_id = $1 and id = $2`,
      [context.userId, data.id, data.isActive],
    );
    if (!data.isActive) {
      // An archived client gets no more visits: drop their open (pending) cuts.
      await sql.query(
        `delete from jobs where user_id = $1 and client_id = $2 and status = 'pending'`,
        [context.userId, data.id],
      );
    }
    if (data.isActive) await ensureScheduleForUser(context.userId);
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await snapshotBackup(context.userId, true).catch(() => undefined);
    await sql.query(`delete from clients where user_id = $1 and id = $2`, [
      context.userId,
      data.id,
    ]);
    return { ok: true };
  });

export async function markJobDone(
  userId: string,
  jobId: number,
  settlement: "paid" | "owe" | "abono" | "auto",
  abono = 0,
  method = "",
  photo = "",
  tip = 0,
): Promise<{ ok: false } | { ok: true; collected: boolean; skipped: boolean; usedCredit: number }> {
  const sql = await getSql();
  const rows = await sql.query<{
    client_id: number;
    amount: unknown;
    status: string;
    pay_same_day: boolean;
    credit: unknown;
  }>(
    `select j.client_id, j.amount, j.status, c.pay_same_day, c.credit
       from jobs j join clients c on c.id = j.client_id
      where j.user_id = $1 and j.id = $2`,
    [userId, jobId],
  );
  const job = rows[0];
  if (!job) return { ok: false };
  if (job.status === "done" || job.status === "cancelled") {
    return { ok: true, collected: false, skipped: true, usedCredit: 0 };
  }
  await sql.query(
    `update jobs set status = 'done', completed_at = now()
      where user_id = $1 and id = $2`,
    [userId, jobId],
  );
  if (PHOTOS_ENABLED && photo.startsWith("data:image/") && photo.length <= 180_000) {
    await sql.query(`update jobs set photo = $3 where user_id = $1 and id = $2`, [
      userId,
      jobId,
      photo,
    ]);
  }
  const amount = money(job.amount);
  const payMethod = method.trim().slice(0, 40) || null;
  const mode = settlement === "auto" ? (job.pay_same_day ? "paid" : "owe") : settlement;
  if (mode === "paid") {
    if (amount > 0) {
      await sql.query(
        `insert into payments (user_id, client_id, amount, kind, note, method)
         values ($1,$2,$3,'paid','Pago de este corte',$4)`,
        [userId, job.client_id, amount, payMethod],
      );
    }
    await sql.query(`update jobs set notes = 'Hecho:paid' where user_id = $1 and id = $2`, [
      userId,
      jobId,
    ]);
    const paidTip = Math.round(Math.max(0, tip) * 100) / 100;
    if (paidTip > 0) {
      await sql.query(
        `insert into payments (user_id, client_id, amount, kind, note, method, tip)
         values ($1,$2,0,'paid','Propina',$3,$4)`,
        [userId, job.client_id, payMethod, paidTip],
      );
    }
    return { ok: true, collected: true, skipped: false, usedCredit: 0 };
  }
  let usedCredit = 0;
  if (amount > 0) {
    const credit = money(job.credit);
    if (credit >= amount) {
      usedCredit = amount;
      await sql.query(`update clients set credit = credit - $3 where user_id = $1 and id = $2`, [
        userId,
        job.client_id,
        amount,
      ]);
    } else if (credit > 0) {
      usedCredit = credit;
      const rest = Math.round((amount - credit) * 100) / 100;
      await sql.query(
        `update clients set credit = 0, balance = balance + $3 where user_id = $1 and id = $2`,
        [userId, job.client_id, rest],
      );
    } else {
      await sql.query(`update clients set balance = balance + $3 where user_id = $1 and id = $2`, [
        userId,
        job.client_id,
        amount,
      ]);
    }
  }
  const tags: string[] = [];
  if (usedCredit > 0) tags.push(`Adelanto:${usedCredit}`);
  if (mode === "abono") {
    const pay = Math.round(Math.max(0, abono) * 100) / 100;
    if (pay > 0) {
      const balRows = await sql.query<{ balance: unknown; credit: unknown }>(
        `select balance, credit from clients where user_id = $1 and id = $2`,
        [userId, job.client_id],
      );
      const balance = money(balRows[0]?.balance);
      const creditNow = money(balRows[0]?.credit);
      const toDebt = Math.min(pay, balance);
      const leftover = Math.round((pay - toDebt) * 100) / 100;
      if (toDebt > 0) {
        await sql.query(
          `insert into payments (user_id, client_id, amount, kind, note, method)
           values ($1,$2,$3,'paid','Abono al marcar hecho',$4)`,
          [userId, job.client_id, toDebt, payMethod],
        );
      }
      if (leftover > 0) {
        await sql.query(
          `insert into payments (user_id, client_id, amount, kind, note, method)
           values ($1,$2,$3,'prepaid','Abono al marcar hecho',$4)`,
          [userId, job.client_id, leftover, payMethod],
        );
      }
      await sql.query(
        `update clients set balance = $3, credit = $4 where user_id = $1 and id = $2`,
        [
          userId,
          job.client_id,
          Math.max(0, Math.round((balance - toDebt) * 100) / 100),
          Math.round((creditNow + leftover) * 100) / 100,
        ],
      );
    }
    tags.push(`Hecho:abono:${pay}`);
  }
  // Tag owed jobs too, so undo never mistakes another job's same-amount payment for this one.
  if (!tags.some((t) => t.startsWith("Hecho:"))) tags.push("Hecho:owe");
  if (tags.length) {
    await sql.query(`update jobs set notes = $3 where user_id = $1 and id = $2`, [
      userId,
      jobId,
      tags.join("\n"),
    ]);
  }
  const extra = Math.round(Math.max(0, tip) * 100) / 100;
  if (extra > 0) {
    await sql.query(
      `insert into payments (user_id, client_id, amount, kind, note, method, tip)
       values ($1,$2,0,'paid','Propina',$3,$4)`,
      [userId, job.client_id, payMethod, extra],
    );
  }
  return { ok: true, collected: usedCredit >= amount && amount > 0, skipped: false, usedCredit };
}

export const completeJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.coerce.number().int(),
        collectNow: z.boolean().optional(),
        settlement: z.enum(["paid", "owe", "abono"]).optional(),
        abono: z.coerce.number().min(0).max(100000).optional(),
        method: z.string().trim().max(40).optional(),
        photo: z.string().max(180000).optional(),
        tip: z.coerce.number().min(0).max(100000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const settlement = data.settlement ?? (data.collectNow ? "paid" : "owe");
    const result = await markJobDone(
      context.userId,
      data.id,
      settlement,
      data.abono ?? 0,
      data.method ?? "",
      data.photo ?? "",
      data.tip ?? 0,
    );
    if (!result.ok) return { ok: false as const };
    if (!result.skipped) {
      await ensureScheduleForUser(context.userId);
      await snapshotBackup(context.userId).catch(() => undefined);
    }
    return { ok: true as const, collected: result.collected, usedCredit: result.usedCredit };
  });

export const completeTodayJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const today = todayISO();
    const rows = await sql.query<{ id: number }>(
      `select j.id from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and c.is_active = true
          and c.service_paused = false
          and j.status = 'pending' and j.scheduled_date = $2::date
        order by j.sort_order asc, c.name asc`,
      [context.userId, today],
    );
    let done = 0;
    for (const row of rows) {
      const res = await markJobDone(context.userId, row.id, "auto");
      if (res.ok && !res.skipped) done += 1;
    }
    await ensureScheduleForUser(context.userId);
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, count: done };
  });

export const reopenJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      client_id: number;
      amount: unknown;
      status: string;
      completed_at: unknown;
      notes: string | null;
    }>(
      `select client_id, amount, status, completed_at, notes from jobs
        where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    const job = rows[0];
    if (!job || job.status !== "done") return { ok: false as const };
    const amount = money(job.amount);
    const notes = job.notes ?? "";
    const pays = await sql.query<{ id: number }>(
      `select id from payments
        where user_id = $1 and client_id = $2 and kind = 'paid'
          and amount = $3 and note in ('Pago el mismo día', 'Pago de este corte')
        order by paid_at desc, id desc
        limit 1`,
      [context.userId, job.client_id, amount],
    );
    // Jobs carry a Hecho:* tag. Untagged (older) jobs count as paid only when a 'Pago de este corte'
    // payment of the same amount was made at/after this job's completion on the same local day;
    // a job that used credit (Adelanto:) never does, so its credit is given back below.
    const tagged = notes.includes("Hecho:");
    let legacyPay: { id: number } | undefined;
    if (!tagged && !notes.includes("Adelanto:") && job.completed_at && amount > 0) {
      const legacy = await sql.query<{ id: number }>(
        `select p.id from payments p, jobs j
          where p.user_id = $1 and p.client_id = $2 and p.kind = 'paid'
            and p.amount = $3 and p.note in ('Pago el mismo día', 'Pago de este corte')
            and j.user_id = $1 and j.id = $4 and j.completed_at is not null
            and p.paid_at >= j.completed_at
            and (p.paid_at at time zone $5)::date = (j.completed_at at time zone $5)::date
          order by p.paid_at asc, p.id asc
          limit 1`,
        [context.userId, job.client_id, amount, data.id, APP_TZ],
      );
      legacyPay = legacy[0];
    }
    if (notes.includes("Hecho:paid") || legacyPay) {
      const target = notes.includes("Hecho:paid") ? pays[0] : legacyPay;
      if (target) {
        await sql.query(`delete from payments where user_id = $1 and id = $2`, [
          context.userId,
          target.id,
        ]);
      }
    } else {
      if (notes.includes("Hecho:abono")) {
        const recent = await sql.query<{ id: number; amount: unknown; kind: string }>(
          `select id, amount, kind from payments
            where user_id = $1 and client_id = $2 and note = 'Abono al marcar hecho'
            order by paid_at desc, id desc
            limit 2`,
          [context.userId, job.client_id],
        );
        // One abono is at most two rows (debt + credit) summing to the tagged amount; never take an older job's row.
        const tag = /Hecho:abono:([\d.]+)/.exec(notes);
        const target = tag ? money(tag[1]) : Infinity;
        const abonos: typeof recent = [];
        let sum = 0;
        for (const p of recent) {
          if (sum >= target - 0.001) break;
          abonos.push(p);
          sum = Math.round((sum + money(p.amount)) * 100) / 100;
        }
        for (const p of abonos) {
          const paid = money(p.amount);
          if (p.kind === "prepaid") {
            await sql.query(
              `update clients set credit = greatest(credit - $3, 0) where user_id = $1 and id = $2`,
              [context.userId, job.client_id, paid],
            );
          } else if (p.kind === "paid") {
            await sql.query(`update clients set balance = balance + $3 where user_id = $1 and id = $2`, [
              context.userId,
              job.client_id,
              paid,
            ]);
          }
          await sql.query(`delete from payments where user_id = $1 and id = $2`, [context.userId, p.id]);
        }
      }
      const m = /Adelanto:([\d.]+)/.exec(notes);
      const used = m ? money(m[1]) : 0;
      if (used > 0) {
        const rest = Math.max(0, Math.round((amount - used) * 100) / 100);
        await sql.query(
          `update clients
              set credit = credit + $3,
                  balance = greatest(balance - $4, 0)
            where user_id = $1 and id = $2`,
          [context.userId, job.client_id, used, rest],
        );
      } else if (amount > 0) {
        await sql.query(
          `update clients set balance = greatest(balance - $3, 0) where user_id = $1 and id = $2`,
          [context.userId, job.client_id, amount],
        );
      }
    }
    await sql.query(
      `update jobs set status = 'pending', completed_at = null,
         notes = case when notes like 'Adelanto:%' or notes like '%Hecho:%' then null else notes end
        where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    return { ok: true as const };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), reason: z.string().trim().max(80).optional().default("") }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // 1.4.65: Posponer with the reason Cancelado lands here and keeps that reason
    await sql.query(
      `update jobs set status = 'cancelled',
              postpone_reason = case when $3 = '' then postpone_reason else $3 end
        where user_id = $1 and id = $2 and status = 'pending'`,
      [context.userId, data.id, data.reason],
    );
    return { ok: true };
  });

export const reorderJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.coerce.number().int()).min(1).max(80) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    for (let i = 0; i < data.ids.length; i += 1) {
      await sql.query(
        `update jobs set sort_order = $3 where user_id = $1 and id = $2`,
        [context.userId, data.ids[i], i + 1],
      );
    }
    return { ok: true };
  });

const extraInput = z.object({
  clientId: z.coerce.number().int(),
  title: z.string().trim().min(1).max(120),
  amount: z.coerce.number().min(0).max(100000),
  date: z.string().min(8),
  notes: z.string().trim().max(500).optional().default(""),
  arrivalTime: z.string().trim().max(8).optional().default(""),
  markDone: z.boolean().optional().default(false),
});

export const addExtraJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => extraInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql.query<{ id: number }>(
      `select id from clients where user_id = $1 and id = $2`,
      [context.userId, data.clientId],
    );
    if (!owned[0]) return { ok: false as const };
    const today = todayISO();
    const markDone = data.markDone || data.date <= today;
    const arrival = normalizeArrival(data.arrivalTime);
    const inserted = await sql.query<{ id: number }>(
      `insert into jobs
         (user_id, client_id, scheduled_date, status, kind, title, amount, notes, completed_at, arrival_time)
       values ($1,$2,$3::date,$4,'extra',$5,$6,$7,$8,$9)
       returning id`,
      [
        context.userId,
        data.clientId,
        data.date,
        markDone ? "done" : "pending",
        data.title,
        data.amount,
        data.notes.trim() || null,
        markDone ? new Date().toISOString() : null,
        arrival,
      ],
    );
    if (markDone) {
      const cred = await sql.query<{ credit: unknown; pay_same_day: boolean }>(
        `select credit, pay_same_day from clients where user_id = $1 and id = $2`,
        [context.userId, data.clientId],
      );
      const credit = money(cred[0]?.credit);
      if (credit >= data.amount) {
        await sql.query(`update clients set credit = credit - $3 where user_id = $1 and id = $2`, [
          context.userId,
          data.clientId,
          data.amount,
        ]);
      } else if (credit > 0) {
        await sql.query(
          `update clients set credit = 0, balance = balance + $3 where user_id = $1 and id = $2`,
          [context.userId, data.clientId, Math.round((data.amount - credit) * 100) / 100],
        );
      } else {
        await sql.query(`update clients set balance = balance + $3 where user_id = $1 and id = $2`, [
          context.userId,
          data.clientId,
          data.amount,
        ]);
      }
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, id: intId(inserted[0]?.id) };
  });

const payInput = z.object({
  clientId: z.coerce.number().int(),
  kind: z.enum(["paid", "waived", "prepaid"]),
  amount: z.coerce.number().min(0).max(100000).optional(),
  note: z.string().trim().max(240).optional().default(""),
  method: z.string().trim().max(40).optional().default(""),
  tip: z.coerce.number().min(0).max(100000).optional().default(0),
});

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => payInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ balance: unknown; credit: unknown }>(
      `select balance, credit from clients where user_id = $1 and id = $2`,
      [context.userId, data.clientId],
    );
    const client = rows[0];
    if (!client) return { ok: false as const, paymentIds: [] as number[] };
    const balance = money(client.balance);
    const credit = money(client.credit);
    const payMethod = data.method.trim().slice(0, 40) || null;
    if (data.kind === "waived") {
      await sql.query(
        `insert into payments (user_id, client_id, amount, kind, note, method) values ($1,$2,$3,'waived',$4,$5)`,
        [context.userId, data.clientId, balance, data.note.trim() || null, null],
      );
      await sql.query(`update clients set balance = 0 where user_id = $1 and id = $2`, [
        context.userId,
        data.clientId,
      ]);
      await snapshotBackup(context.userId).catch(() => undefined);
      return { ok: true as const, paymentIds: [] as number[] };
    }
    const amount = money(data.amount ?? (data.kind === "paid" ? balance : 0));
    const tip = money(data.tip ?? 0);
    if (amount <= 0 && tip <= 0) return { ok: false as const, paymentIds: [] as number[] };
    if (amount <= 0 && tip > 0) {
      const ins = await sql.query<{ id: number }>(
        `insert into payments (user_id, client_id, amount, kind, note, method, tip)
         values ($1,$2,0,'paid','Propina',$3,$4) returning id`,
        [context.userId, data.clientId, payMethod, tip],
      );
      return { ok: true as const, paymentIds: [intId(ins[0]?.id)] };
    }
    const toDebt = Math.min(amount, balance);
    const leftover = Math.round((amount - toDebt) * 100) / 100;
    const ids: number[] = [];
    if (toDebt > 0) {
      const ins = await sql.query<{ id: number }>(
        `insert into payments (user_id, client_id, amount, kind, note, method) values ($1,$2,$3,'paid',$4,$5) returning id`,
        [context.userId, data.clientId, toDebt, data.note.trim() || "Abono", payMethod],
      );
      ids.push(intId(ins[0]?.id));
    }
    if (leftover > 0) {
      const ins = await sql.query<{ id: number }>(
        `insert into payments (user_id, client_id, amount, kind, note, method) values ($1,$2,$3,'prepaid',$4,$5) returning id`,
        [
          context.userId,
          data.clientId,
          leftover,
          data.note.trim() || "Pago por adelantado",
          payMethod,
        ],
      );
      ids.push(intId(ins[0]?.id));
    }
    if (tip > 0 && ids[0]) {
      await sql.query(`update payments set tip = $3 where user_id = $1 and id = $2`, [
        context.userId,
        ids[0],
        tip,
      ]);
    }
    await sql.query(
      `update clients
          set balance = $3,
              credit = $4
        where user_id = $1 and id = $2`,
      [context.userId, data.clientId, Math.max(0, balance - toDebt), credit + leftover],
    );
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, paymentIds: ids };
  });

export const undoPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ ids: z.array(z.coerce.number().int()).min(1).max(8) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    for (const id of data.ids) {
      const rows = await sql.query<{ client_id: number; amount: unknown; kind: string }>(
        `select client_id, amount, kind from payments where user_id = $1 and id = $2`,
        [context.userId, id],
      );
      const p = rows[0];
      if (!p) continue;
      const amount = money(p.amount);
      if (p.kind === "prepaid") {
        await sql.query(
          `update clients set credit = greatest(credit - $3, 0) where user_id = $1 and id = $2`,
          [context.userId, p.client_id, amount],
        );
      } else if (p.kind === "paid") {
        await sql.query(`update clients set balance = balance + $3 where user_id = $1 and id = $2`, [
          context.userId,
          p.client_id,
          amount,
        ]);
      } else if (p.kind === "waived") {
        await sql.query(`update clients set balance = balance + $3 where user_id = $1 and id = $2`, [
          context.userId,
          p.client_id,
          amount,
        ]);
      }
      await sql.query(`delete from payments where user_id = $1 and id = $2`, [context.userId, id]);
    }
    return { ok: true as const };
  });

export const recordPaymentsBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        clientIds: z.array(z.coerce.number().int()).min(1).max(40),
        kind: z.enum(["paid", "waived"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let count = 0;
    let total = 0;
    for (const clientId of data.clientIds) {
      const rows = await sql.query<{ balance: unknown }>(
        `select balance from clients where user_id = $1 and id = $2`,
        [context.userId, clientId],
      );
      const client = rows[0];
      if (!client) continue;
      const balance = money(client.balance);
      if (balance <= 0) continue;
      await sql.query(
        `insert into payments (user_id, client_id, amount, kind, note) values ($1,$2,$3,$4,$5)`,
        [context.userId, clientId, balance, data.kind, null],
      );
      await sql.query(`update clients set balance = 0 where user_id = $1 and id = $2`, [
        context.userId,
        clientId,
      ]);
      count += 1;
      total += balance;
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, count, total };
  });

export const upsertDayGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        goal: z.union([z.coerce.number().int().min(1).max(80), z.null()]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const weekday = weekdayFromISO(data.date);
    if (data.goal == null) {
      await sql.query(`delete from day_goals where user_id = $1 and goal_date = $2::date`, [
        context.userId,
        data.date,
      ]);
      return { ok: true as const, goal: null };
    }
    await sql.query(
      `insert into day_goals (user_id, goal_date, goal) values ($1, $2::date, $3)
       on conflict (user_id, goal_date) do update set goal = $3`,
      [context.userId, data.date, data.goal],
    );
    const prefs = await loadPrefs(context.userId);
    const next = { ...prefs.weekGoals, [String(weekday)]: data.goal };
    await sql.query(
      `insert into app_settings (user_id, week_goals, updated_at)
       values ($1, $2, now())
       on conflict (user_id) do update set week_goals = $2, updated_at = now()`,
      [context.userId, JSON.stringify(next)],
    );
    return { ok: true as const, goal: data.goal };
  });

export const getClientInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ regular: unknown; onetime: unknown; total: unknown; archived: unknown; round_amount: unknown }>(
      `select
         (select count(*) from clients where user_id = $1 and is_active = true and kind = 'regular') as regular,
         (select count(*) from clients where user_id = $1 and is_active = true and kind = 'one_time') as onetime,
         (select count(*) from clients where user_id = $1 and is_active = true) as total,
         (select count(*) from clients where user_id = $1 and is_active = false) as archived,
         (select coalesce(sum(price_per_cut), 0) from clients where user_id = $1 and is_active = true and kind = 'regular') as round_amount`,
      [context.userId],
    );
    return {
      regular: intId(rows[0]?.regular),
      oneTime: intId(rows[0]?.onetime),
      total: intId(rows[0]?.total),
      archived: intId(rows[0]?.archived),
      round: money(rows[0]?.round_amount),
    };
  });

const jobsInput = z.object({
  filter: z.enum(["pending", "late", "done", "cancelled", "all"]).optional().default("pending"),
  range: z.enum(["week", "month", "ahead", "all", "history"]).optional().default("month"),
  q: z.string().optional().default(""),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(0).max(12).optional(),
});

export const listJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => jobsInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await ensureScheduleForUser(context.userId);
    const today = todayISO();
    const { year, month } = monthParts(today);
    const weekStart = startOfWeekISO(today);
    const weekEnd = endOfWeekISO(today);
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = lastDayOfMonthISO(year, month);
    let from = "0001-01-01";
    let to = "9999-12-31";
    if (data.range === "week") {
      from = weekStart;
      to = weekEnd;
    } else if (data.range === "month") {
      from = monthStart;
      to = monthEnd;
    } else if (data.range === "ahead") {
      from = today;
      to = addDaysISO(today, 90);
    } else if (data.range === "history") {
      const y = data.year ?? year;
      const m = data.month ?? 0;
      if (m >= 1 && m <= 12) {
        from = `${y}-${String(m).padStart(2, "0")}-01`;
        to = lastDayOfMonthISO(y, m);
      } else {
        from = `${y}-01-01`;
        to = `${y}-12-31`;
      }
    }
    const sql = await getSql();
    const rows = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1
          and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
          and c.blacklisted = false
          and (j.status <> 'pending' or c.service_paused = false)
        order by j.pinned desc, j.scheduled_date asc, c.name asc`,
      [context.userId, from, to],
    );
    let jobs = rows.map((r) => mapJob(r, today));
    const q = data.q.trim().toLowerCase();
    if (q) {
      jobs = jobs.filter((j) =>
        smartHit(
          q,
          `${j.clientName} ${j.title ?? ""} ${j.clientAddress ?? ""} ${j.clientCue ?? ""} ${j.postponeReason ?? ""}`,
        ),
      );
    }
    const filter = data.filter as JobListFilter;
    if (filter === "pending") jobs = jobs.filter((j) => j.status === "pending" && j.computedStatus !== "late");
    else if (filter === "late") jobs = jobs.filter((j) => j.computedStatus === "late");
    else if (filter === "done") jobs = jobs.filter((j) => j.status === "done");
    else if (filter === "cancelled") jobs = jobs.filter((j) => j.status === "cancelled");
    return jobs;
  });

export const listBalances = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const today = todayISO();
    const list = await loadClients(context.userId, today, "owing");
    const sorted = sortClients(list, "balance_desc");
    const sql = await getSql();
    const { year, month } = monthParts(today);
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = lastDayOfMonthISO(year, month);
    const weekStart = startOfWeekISO(today);
    const weekEnd = endOfWeekISO(today);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const totals = await sql.query<{
      outstanding: unknown;
      collected_month: unknown;
      collected_week: unknown;
      collected_year: unknown;
      waived_month: unknown;
      completed_month: unknown;
      completed_week: unknown;
      completed_year: unknown;
      cuts_week: unknown;
      cuts_month: unknown;
      cuts_year: unknown;
    }>(
      `select
         (select coalesce(sum(balance),0) from clients where user_id = $1) as outstanding,
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind in ('paid','prepaid') and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as collected_month,
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind in ('paid','prepaid') and paid_at >= $4::date and paid_at < ($5::date + interval '1 day')) as collected_week,
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind in ('paid','prepaid') and paid_at >= $6::date and paid_at < ($7::date + interval '1 day')) as collected_year,
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind = 'waived' and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as waived_month,
         (select coalesce(sum(amount),0) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date) as completed_month,
         (select coalesce(sum(amount),0) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $4::date and scheduled_date <= $5::date) as completed_week,
         (select coalesce(sum(amount),0) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $6::date and scheduled_date <= $7::date) as completed_year,
         (select count(*) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $4::date and scheduled_date <= $5::date) as cuts_week,
         (select count(*) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date) as cuts_month,
         (select count(*) from jobs
           where user_id = $1 and status = 'done' and scheduled_date >= $6::date and scheduled_date <= $7::date) as cuts_year`,
      [context.userId, monthStart, monthEnd, weekStart, weekEnd, yearStart, yearEnd],
    );
    const payments = await sql.query<{
      id: number;
      client_id: number;
      client_name: string;
      amount: unknown;
      kind: string;
      note: string | null;
      method: string | null;
      paid_at: unknown;
      tip: unknown;
    }>(
      `select p.id, p.client_id, c.name as client_name, p.amount, p.kind, p.note, p.method, p.paid_at, p.tip
         from payments p
         join clients c on c.id = p.client_id
        where p.user_id = $1 and p.paid_at >= $2::date and p.paid_at < ($3::date + interval '1 day')
        order by p.paid_at desc, p.id desc
        limit 2500`,
      [context.userId, yearStart, yearEnd],
    );
    const doneRows = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and j.status = 'done'
          and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
        order by j.scheduled_date desc, c.name asc
        limit 400`,
      [context.userId, weekStart, weekEnd],
    );
    // month window might start before week; fetch month separately if needed
    const monthDoneRows = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and j.status = 'done'
          and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
        order by j.scheduled_date desc, c.name asc
        limit 800`,
      [context.userId, monthStart, monthEnd],
    );
    const yearDoneRows = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and j.status = 'done'
          and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
        order by j.scheduled_date desc, c.name asc
        limit 2500`,
      [context.userId, yearStart, yearEnd],
    );
    const weekDoneRows = doneRows;
    const t = totals[0];
    return {
      clients: sorted,
      totals: {
        outstanding: money(t?.outstanding),
        collectedMonth: money(t?.collected_month),
        collectedWeek: money(t?.collected_week),
        collectedYear: money(t?.collected_year),
        waivedMonth: money(t?.waived_month),
        completedMonth: money(t?.completed_month),
        completedWeek: money(t?.completed_week),
        completedYear: money(t?.completed_year),
        cutsWeek: intId(t?.cuts_week),
        cutsMonth: intId(t?.cuts_month),
        cutsYear: intId(t?.cuts_year),
      },
      payments: payments.map((p) => ({
        id: intId(p.id),
        clientId: intId(p.client_id),
        clientName: p.client_name,
        amount: money(p.amount),
        kind: (p.kind as PaymentKind) ?? "paid",
        note: p.note,
        method: p.method,
        paidAt: asIsoStamp(p.paid_at),
        tip: money(p.tip),
      })) satisfies PaymentRow[],
      doneWeek: weekDoneRows.map((r) => mapJob(r, today)),
      doneMonth: monthDoneRows.map((r) => mapJob(r, today)),
      doneYear: yearDoneRows.map((r) => mapJob(r, today)),
    };
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AppSettings> => {
    const sql = await getSql();
    const rows = await sql.query<{
      business_name: string;
      theme: string;
      reminders_enabled: boolean;
      ask_yesterday: boolean | null;
      reminder_minutes: number;
      last_backup_at: unknown;
      daily_goal: number | null;
      week_goals: string | null;
      abono_presets: string | null;
      vacation_start: unknown;
      vacation_end: unknown;
      vacation_shift: number | null;
      excluded_weekdays: string | null;
      task_presets: string | null;
      arrival_presets: string | null;
      price_presets: string | null;
      debt_presets: string | null;
      visit_presets: string | null;
      cue_presets: string | null;
      risk_days: number | null;
      risk_amount: unknown;
      wait_days: number | null;
      risk_cuts: number | null;
      message_presets: string | null;
      horizon_months: number | null;
      season_start: string | null;
      season_end: string | null;
      season_every: number | null;
      locale: string | null;
      palette: string | null;
      work_start: string | null;
      work_end: string | null;
    }>(
      `select business_name, theme, reminders_enabled, ask_yesterday, reminder_minutes, last_backup_at, daily_goal,
              week_goals, abono_presets, vacation_start, vacation_end, vacation_shift, excluded_weekdays,
              task_presets, arrival_presets, price_presets, debt_presets, visit_presets, cue_presets, risk_days, risk_amount, wait_days, risk_cuts, message_presets,
              horizon_months, season_start, season_end, season_every,
              locale, palette, work_start, work_end
         from app_settings where user_id = $1`,
      [context.userId],
    );
    let row = rows[0];
    if (!row) {
      await sql.query(
        `insert into app_settings (user_id, business_name) values ($1, $2)
         on conflict (user_id) do nothing`,
        [context.userId, DEFAULT_BUSINESS_NAME],
      );
      row = {
        business_name: DEFAULT_BUSINESS_NAME,
        theme: "light",
        reminders_enabled: false,
        ask_yesterday: true,
        reminder_minutes: 60,
        last_backup_at: null,
        daily_goal: null,
        week_goals: null,
        abono_presets: null,
        vacation_start: null,
        vacation_end: null,
        vacation_shift: 0,
        excluded_weekdays: null,
        task_presets: null,
        arrival_presets: null,
        price_presets: null,
        debt_presets: null,
        visit_presets: null,
        cue_presets: null,
        risk_days: 21,
        risk_amount: 200,
        wait_days: 45,
        risk_cuts: 3,
        message_presets: null,
        horizon_months: 12,
        season_start: null,
        season_end: null,
        season_every: null,
        locale: "es",
        palette: "jardin",
        work_start: "08:00",
        work_end: "17:30",
      };
    }
    const counts = await sql.query<{ clients: unknown; jobs: unknown }>(
      `select
         (select count(*) from clients where user_id = $1) as clients,
         (select count(*) from jobs where user_id = $1) as jobs`,
      [context.userId],
    );
    return {
      businessName: row.business_name || DEFAULT_BUSINESS_NAME,
      theme: row.theme === "amoled" ? "amoled" : "light",
      remindersEnabled: Boolean(row.reminders_enabled),
      askYesterday: row.ask_yesterday !== false,
      reminderMinutes: Number(row.reminder_minutes) || 60,
      dailyGoal: row.daily_goal == null ? null : Number(row.daily_goal) || null,
      lastBackupAt: row.last_backup_at ? asIsoStamp(row.last_backup_at) : null,
      clientCount: intId(counts[0]?.clients),
      jobCount: intId(counts[0]?.jobs),
      weekGoals: parseWeekGoals(row.week_goals),
      abonoPresets: parseNumList(row.abono_presets, DEFAULT_ABONO_PRESETS),
      vacationStart: row.vacation_start ? asIsoDate(row.vacation_start) : null,
      vacationEnd: row.vacation_end ? asIsoDate(row.vacation_end) : null,
      vacationShift: Number(row.vacation_shift) || 0,
      excludedWeekdays: parseExcluded(row.excluded_weekdays),
      taskPresets: parseStringList(row.task_presets, DEFAULT_TASK_PRESETS),
      arrivalPresets: (() => {
        const times = parseStringList(row.arrival_presets, DEFAULT_ARRIVAL_PRESETS, 8).filter((t) =>
          /^\d{2}:\d{2}$/.test(t),
        );
        return times.length ? times : DEFAULT_ARRIVAL_PRESETS;
      })(),
      pricePresets: parseNumList(row.price_presets, DEFAULT_PRICE_PRESETS),
      debtPresets: parseNumList(row.debt_presets, DEFAULT_DEBT_PRESETS),
      visitPresets: parseStringList(row.visit_presets, DEFAULT_VISIT_PRESETS, 16),
      cuePresets: parseStringList(row.cue_presets, DEFAULT_CUE_PRESETS, 16),
      riskDays: Number(row.risk_days) >= 3 ? Number(row.risk_days) : 21,
      riskAmount: money(row.risk_amount) > 0 ? money(row.risk_amount) : 200,
      riskCuts: Number(row.risk_cuts) >= 1 ? Number(row.risk_cuts) : 3,
      waitDays: Number(row.wait_days) >= 7 ? Number(row.wait_days) : 45,
      messagePresets: parseStringList(row.message_presets, DEFAULT_MESSAGE_PRESETS, 12),
      horizonMonths: Number(row.horizon_months) >= 4 ? Number(row.horizon_months) : 12,
      seasonStart: mmddOrNull(row.season_start),
      seasonEnd: mmddOrNull(row.season_end),
      seasonEvery:
        Number(row.season_every) >= 7 && Number(row.season_every) <= 60 ? Number(row.season_every) : null,
      locale: row.locale === "en" ? "en" : "es",
      palette:
        row.palette === "costa" || row.palette === "barro" || row.palette === "pino" || row.palette === "cielo"
          ? row.palette
          : "jardin",
      workStart: /^\d{2}:\d{2}$/.test(row.work_start ?? "") ? row.work_start! : "08:00",
      workEnd: /^\d{2}:\d{2}$/.test(row.work_end ?? "") ? row.work_end! : "17:30",
    };
  });

const settingsInput = z.object({
  businessName: z.string().trim().min(1).max(60).optional(),
  theme: z.enum(["light", "amoled"]).optional(),
  remindersEnabled: z.boolean().optional(),
  askYesterday: z.boolean().optional(),
  reminderMinutes: z.coerce.number().int().min(5).max(24 * 60).optional(),
  dailyGoal: z.union([z.coerce.number().int().min(1).max(40), z.null()]).optional(),
  abonoPresets: z.array(z.coerce.number().min(0.01).max(100000)).min(1).max(12).optional(),
  excludedWeekdays: z.array(z.coerce.number().int().min(0).max(6)).max(6).optional(),
  taskPresets: z.array(z.string().trim().min(1).max(40)).min(1).max(24).optional(),
  arrivalPresets: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(8).optional(),
  pricePresets: z.array(z.coerce.number().min(0.01).max(100000)).min(1).max(12).optional(),
  debtPresets: z.array(z.coerce.number().min(0.01).max(100000)).min(1).max(12).optional(),
  visitPresets: z.array(z.string().trim().min(1).max(60)).min(1).max(16).optional(),
  cuePresets: z.array(z.string().trim().min(1).max(60)).min(1).max(16).optional(),
  riskDays: z.coerce.number().int().min(3).max(400).optional(),
  riskAmount: z.coerce.number().min(1).max(100000).optional(),
  riskCuts: z.coerce.number().int().min(1).max(30).optional(),
  waitDays: z.coerce.number().int().min(7).max(400).optional(),
  messagePresets: z.array(z.string().trim().min(1).max(180)).min(1).max(12).optional(),
  horizonMonths: z.coerce.number().int().min(4).max(18).optional(),
  seasonStart: z.string().trim().max(5).nullable().optional(),
  seasonEnd: z.string().trim().max(5).nullable().optional(),
  seasonEvery: z.number().int().min(7).max(60).nullable().optional(),
  locale: z.enum(["es", "en"]).optional(),
  palette: z.enum(["jardin", "costa", "barro", "pino", "cielo"]).optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into app_settings (user_id, business_name)
       values ($1, $2)
       on conflict (user_id) do nothing`,
      [context.userId, DEFAULT_BUSINESS_NAME],
    );
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [context.userId];
    let i = 2;
    if (data.businessName !== undefined) {
      sets.push(`business_name = $${i++}`);
      params.push(data.businessName);
    }
    if (data.theme !== undefined) {
      sets.push(`theme = $${i++}`);
      params.push(data.theme);
    }
    if (data.remindersEnabled !== undefined) {
      sets.push(`reminders_enabled = $${i++}`);
      params.push(data.remindersEnabled);
    }
    if (data.askYesterday !== undefined) {
      sets.push(`ask_yesterday = $${i++}`);
      params.push(data.askYesterday);
    }
    if (data.reminderMinutes !== undefined) {
      sets.push(`reminder_minutes = $${i++}`);
      params.push(data.reminderMinutes);
    }
    if (data.dailyGoal !== undefined) {
      sets.push(`daily_goal = $${i++}`);
      params.push(data.dailyGoal);
    }
    if (data.abonoPresets !== undefined) {
      sets.push(`abono_presets = $${i++}`);
      params.push(JSON.stringify(data.abonoPresets));
    }
    if (data.excludedWeekdays !== undefined) {
      sets.push(`excluded_weekdays = $${i++}`);
      params.push(JSON.stringify(data.excludedWeekdays));
    }
    if (data.taskPresets !== undefined) {
      sets.push(`task_presets = $${i++}`);
      params.push(JSON.stringify(data.taskPresets));
    }
    if (data.arrivalPresets !== undefined) {
      sets.push(`arrival_presets = $${i++}`);
      params.push(JSON.stringify(data.arrivalPresets));
    }
    if (data.pricePresets !== undefined) {
      sets.push(`price_presets = $${i++}`);
      params.push(JSON.stringify(data.pricePresets));
    }
    if (data.debtPresets !== undefined) {
      sets.push(`debt_presets = $${i++}`);
      params.push(JSON.stringify(data.debtPresets));
    }
    if (data.visitPresets !== undefined) {
      sets.push(`visit_presets = $${i++}`);
      params.push(JSON.stringify(data.visitPresets));
    }
    if (data.cuePresets !== undefined) {
      sets.push(`cue_presets = $${i++}`);
      params.push(JSON.stringify(data.cuePresets));
    }
    if (data.riskDays !== undefined) {
      sets.push(`risk_days = $${i++}`);
      params.push(data.riskDays);
    }
    if (data.riskAmount !== undefined) {
      sets.push(`risk_amount = $${i++}`);
      params.push(data.riskAmount);
    }
    if (data.riskCuts !== undefined) {
      sets.push(`risk_cuts = $${i++}`);
      params.push(data.riskCuts);
    }
    if (data.waitDays !== undefined) {
      sets.push(`wait_days = $${i++}`);
      params.push(data.waitDays);
    }
    if (data.messagePresets !== undefined) {
      sets.push(`message_presets = $${i++}`);
      params.push(JSON.stringify(data.messagePresets));
    }
    if (data.horizonMonths !== undefined) {
      sets.push(`horizon_months = $${i++}`);
      params.push(data.horizonMonths);
    }
    if (data.seasonStart !== undefined) {
      sets.push(`season_start = $${i++}`);
      params.push(mmddOrNull(data.seasonStart));
    }
    if (data.seasonEnd !== undefined) {
      sets.push(`season_end = $${i++}`);
      params.push(mmddOrNull(data.seasonEnd));
    }
    if (data.seasonEvery !== undefined) {
      sets.push(`season_every = $${i++}`);
      params.push(data.seasonEvery);
    }
    if (data.locale !== undefined) {
      sets.push(`locale = $${i++}`);
      params.push(data.locale);
    }
    if (data.palette !== undefined) {
      sets.push(`palette = $${i++}`);
      params.push(data.palette);
    }
    if (data.workStart !== undefined) {
      sets.push(`work_start = $${i++}`);
      params.push(data.workStart);
    }
    if (data.workEnd !== undefined) {
      sets.push(`work_end = $${i++}`);
      params.push(data.workEnd);
    }
    await sql.query(
      `update app_settings set ${sets.join(", ")} where user_id = $1`,
      params,
    );
    if (data.excludedWeekdays !== undefined || data.horizonMonths !== undefined || data.seasonEvery !== undefined || data.seasonStart !== undefined) {
      await ensureScheduleForUser(context.userId);
    }
    return { ok: true as const };
  });

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await snapshotBackup(context.userId, true);
    const payload = await collectBackup(context.userId);
    return { json: JSON.stringify(payload) };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BackupSummary[]> => {
    const sql = await getSql();
    // Count inside Postgres: parsing a dozen multi-megabyte copies just to count them was slow.
    const rows = await sql.query<{
      id: number;
      created_at: unknown;
      client_count: unknown;
      job_count: unknown;
    }>(
      `select id, created_at,
              case when jsonb_typeof(payload->'clients') = 'array' then jsonb_array_length(payload->'clients') else 0 end as client_count,
              case when jsonb_typeof(payload->'jobs') = 'array' then jsonb_array_length(payload->'jobs') else 0 end as job_count
         from backups where user_id = $1
        order by created_at desc, id desc limit 12`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: intId(r.id),
      createdAt: asIsoStamp(r.created_at),
      clientCount: intId(r.client_count),
      jobCount: intId(r.job_count),
    }));
  });

export const saveBackupNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await snapshotBackup(context.userId, true);
    return { ok: true as const, at: new Date().toISOString() };
  });

type BackupPayload = {
  clients?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  padNotes?: string;
  padPages?: Record<string, unknown>[];
  workDays?: Record<string, unknown>[];
  dayMarks?: Record<string, unknown>[];
  // v5 copies only (older copies leave these tables as they are).
  settings?: Record<string, unknown> | null;
  clientChanges?: Record<string, unknown>[];
  dayGoals?: Record<string, unknown>[];
  dayNotes?: Record<string, unknown>[];
  padLinks?: Record<string, unknown>[];
  weekOff?: Record<string, unknown>[];
};

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function parseBackup(raw: unknown, trusted = false): BackupPayload {
  const obj = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!obj || typeof obj !== "object") throw new Error("Copia inválida");
  const data = obj as Record<string, unknown>;
  // Copies kept in this device's own database are trusted (their old checksums were taken before
  // the database reordered keys, so they could never match); files still have to match.
  if (!trusted && !checksumMatches(data)) throw new Error("Copia dañada");
  return {
    clients: asRecordArray(data.clients),
    jobs: asRecordArray(data.jobs),
    payments: asRecordArray(data.payments),
    padNotes: typeof data.padNotes === "string" ? data.padNotes : "",
    padPages: Array.isArray(data.padPages) ? asRecordArray(data.padPages) : undefined,
    workDays: Array.isArray(data.workDays) ? asRecordArray(data.workDays) : undefined,
    dayMarks: Array.isArray(data.dayMarks) ? asRecordArray(data.dayMarks) : undefined,
    settings:
      Number(data.version) >= 5 && data.settings && typeof data.settings === "object"
        ? (data.settings as Record<string, unknown>)
        : undefined,
    clientChanges: Array.isArray(data.clientChanges) ? asRecordArray(data.clientChanges) : undefined,
    dayGoals: Array.isArray(data.dayGoals) ? asRecordArray(data.dayGoals) : undefined,
    dayNotes: Array.isArray(data.dayNotes) ? asRecordArray(data.dayNotes) : undefined,
    padLinks: Array.isArray(data.padLinks) ? asRecordArray(data.padLinks) : undefined,
    weekOff: Array.isArray(data.weekOff) ? asRecordArray(data.weekOff) : undefined,
  };
}

function strField(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

// Restores rows exactly as the backup holds them (every column the table has), in bulk.
const tableColsCache = new Map<string, string[]>();
async function tableColumns(table: string): Promise<string[]> {
  const hit = tableColsCache.get(table);
  if (hit) return hit;
  const sql = await getSql();
  const rows = await sql.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table],
  );
  const cols = rows.map((r) => r.column_name);
  tableColsCache.set(table, cols);
  return cols;
}

async function bulkRestore(table: "jobs" | "payments", rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  const sql = await getSql();
  const tableCols = new Set(await tableColumns(table));
  const keys = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) keys.add(k);
  const cols = [...keys].filter((k) => k !== "id" && k !== "photo" && tableCols.has(k));
  const list = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += 800) {
    const chunk = rows.slice(i, i + 800);
    await sql.query(
      `insert into ${table} (${list}) select ${list} from jsonb_populate_recordset(null::${table}, $1::jsonb)`,
      [JSON.stringify(chunk)],
    );
  }
}

async function restoreClientExtras(clientId: number, row: Record<string, unknown>): Promise<void> {
  const sql = await getSql();
  const tableCols = new Set(await tableColumns("clients"));
  const skip = new Set(["id", "user_id", "name", "balance", "credit", "rich_notes"]);
  const cols = Object.keys(row).filter((k) => tableCols.has(k) && !skip.has(k));
  if (!cols.length) return;
  const sets = cols.map((c) => `"${c}" = r."${c}"`).join(", ");
  await sql.query(
    `update clients c set ${sets} from jsonb_populate_record(null::clients, $2::jsonb) r where c.id = $1`,
    [clientId, JSON.stringify(row)],
  );
}

async function applyBackup(userId: string, payload: BackupPayload): Promise<{ clients: number; jobs: number }> {
  const sql = await getSql();
  await snapshotBackup(userId, true);
  await sql.query(`delete from payments where user_id = $1`, [userId]);
  await sql.query(`delete from jobs where user_id = $1`, [userId]);
  await sql.query(`delete from clients where user_id = $1`, [userId]);

  const idMap = new Map<number, number>();
  for (const row of payload.clients ?? []) {
    const oldId = intId(row.id);
    const name = strField(row, "name") ?? "Cliente";
    const inserted = await sql.query<{ id: number }>(
      `insert into clients
         (user_id, name, phone, address, notes, kind, price_per_cut, cuts_per_month,
          weekday, weekday_2, frequency_days, arrival_time, start_date, pay_same_day,
          sort_order, balance, is_active, pay_due_day, credit, rich_notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       returning id`,
      [
        userId,
        name.slice(0, 120),
        strField(row, "phone"),
        strField(row, "address"),
        strField(row, "notes"),
        row.kind === "one_time" ? "one_time" : "regular",
        money(row.price_per_cut ?? row.pricePerCut),
        asCuts(row.cuts_per_month ?? row.cutsPerMonth),
        Number(row.weekday) || 1,
        row.weekday_2 == null && row.weekday2 == null ? null : Number(row.weekday_2 ?? row.weekday2),
        row.frequency_days == null && row.frequencyDays == null
          ? null
          : Number(row.frequency_days ?? row.frequencyDays) || null,
        strField(row, "arrival_time", "arrivalTime"),
        strField(row, "start_date", "startDate"),
        Boolean(row.pay_same_day ?? row.paySameDay),
        Number(row.sort_order ?? row.sortOrder) || 0,
        money(row.balance),
        row.is_active === false || row.isActive === false ? false : true,
        row.pay_due_day == null && row.payDueDay == null
          ? null
          : Number(row.pay_due_day ?? row.payDueDay) || null,
        money(row.credit),
        strField(row, "rich_notes", "richNotes") ?? "",
      ],
    );
    const newId = intId(inserted[0]?.id);
    if (oldId && newId) idMap.set(oldId, newId);
    // Brizna's own backups carry every column: keep paused/blocked flags, season, cue, dates, etc.
    if (newId && "user_id" in row) await restoreClientExtras(newId, row);
    if (newId && (row.service_paused === true || row.servicePaused === true)) {
      await sql.query(`update clients set service_paused = true where user_id = $1 and id = $2`, [
        userId,
        newId,
      ]);
    }
  }

  const fullJobs = (payload.jobs ?? []).filter((row) => "user_id" in row && "client_id" in row);
  if (fullJobs.length) {
    await bulkRestore(
      "jobs",
      fullJobs
        .map((row) => ({ ...row, user_id: userId, client_id: idMap.get(intId(row.client_id)) }))
        .filter((row) => row.client_id),
    );
  }
  for (const row of (payload.jobs ?? []).filter((r) => !("user_id" in r && "client_id" in r))) {
    const clientId = idMap.get(intId(row.client_id ?? row.clientId));
    if (!clientId) continue;
    const status = row.status === "done" || row.status === "cancelled" ? String(row.status) : "pending";
    const kind = row.kind === "extra" || row.kind === "one_time" ? String(row.kind) : "cut";
    await sql.query(
      `insert into jobs
         (user_id, client_id, scheduled_date, status, kind, title, amount, notes, completed_at, arrival_time, sort_order)
       values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        userId,
        clientId,
        asIsoDate(row.scheduled_date ?? row.scheduledDate) || todayISO(),
        status,
        kind,
        strField(row, "title"),
        money(row.amount),
        strField(row, "notes"),
        row.completed_at ?? row.completedAt ?? null,
        strField(row, "arrival_time", "arrivalTime"),
        Number(row.sort_order ?? row.sortOrder) || 0,
      ],
    );
  }

  const fullPayments = (payload.payments ?? []).filter((row) => "user_id" in row && "client_id" in row);
  if (fullPayments.length) {
    // Keeps kind (opening, prepaid...), method and tip, so totals and balances match the original.
    await bulkRestore(
      "payments",
      fullPayments
        .map((row) => ({ ...row, user_id: userId, client_id: idMap.get(intId(row.client_id)) }))
        .filter((row) => row.client_id),
    );
  }
  for (const row of (payload.payments ?? []).filter((r) => !("user_id" in r && "client_id" in r))) {
    const clientId = idMap.get(intId(row.client_id ?? row.clientId));
    if (!clientId) continue;
    await sql.query(
      `insert into payments (user_id, client_id, amount, kind, note, paid_at)
       values ($1,$2,$3,$4,$5,coalesce($6::timestamptz, now()))`,
      [
        userId,
        clientId,
        money(row.amount),
        row.kind === "waived" ? "waived" : "paid",
        strField(row, "note"),
        row.paid_at ?? row.paidAt ?? null,
      ],
    );
  }

  await ensureScheduleForUser(userId);
  if (payload.padNotes != null) {
    await sql.query(
      `insert into pad_notes (user_id, body, updated_at) values ($1, $2, now())
       on conflict (user_id) do update set body = $2, updated_at = now()`,
      [userId, sanitizeHtml(payload.padNotes).slice(0, 20000)],
    );
  }
  const pageMap = new Map<number, number>();
  if (payload.padPages) {
    await sql.query(`delete from pad_pages where user_id = $1`, [userId]);
    for (const row of payload.padPages) {
      const ins = await sql.query<{ id: number }>(
        `insert into pad_pages (user_id, title, body, sort_order, pinned, tags, due_date, due_time)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          userId,
          (strField(row, "title") ?? "Nota").slice(0, 160),
          String(row.body ?? "").slice(0, 20000),
          Number(row.sort_order ?? row.sortOrder) || 0,
          Boolean(row.pinned),
          strField(row, "tags") ?? "",
          strField(row, "due_date", "dueDate"),
          strField(row, "due_time", "dueTime"),
        ],
      );
      const oldPage = intId(row.id);
      const newPage = intId(ins[0]?.id);
      if (oldPage && newPage) pageMap.set(oldPage, newPage);
    }
  }
  if (payload.workDays) {
    await sql.query(`delete from work_days where user_id = $1`, [userId]);
    for (const row of payload.workDays) {
      const date = strField(row, "work_date", "workDate");
      if (!date) continue;
      await sql.query(
        `insert into work_days (user_id, work_date, clock_in, clock_out, stopped_reason, stopped_at, confirmed, auto)
         values ($1,$2::date,$3,$4,$5,$6,$7,$8)
         on conflict (user_id, work_date) do nothing`,
        [
          userId,
          date.slice(0, 10),
          strField(row, "clock_in", "clockIn"),
          strField(row, "clock_out", "clockOut"),
          strField(row, "stopped_reason", "stoppedReason"),
          row.stopped_at ?? row.stoppedAt ?? null,
          Boolean(row.confirmed),
          row.auto !== false,
        ],
      );
    }
  }
  if (payload.dayMarks) {
    await sql.query(`delete from day_marks where user_id = $1`, [userId]);
    for (const row of payload.dayMarks) {
      const date = strField(row, "mark_date", "markDate");
      const reason = strField(row, "reason");
      const kind = strField(row, "kind");
      if (!date || !reason || !kind) continue;
      await sql.query(
        `insert into day_marks (user_id, mark_date, reason, detail, kind)
         values ($1,$2::date,$3,$4,$5)
         on conflict do nothing`,
        [userId, date.slice(0, 10), reason.slice(0, 80), strField(row, "detail") ?? "", kind.slice(0, 40)],
      );
    }
  }
  await restoreV5Tables(userId, payload, idMap, pageMap);
  return { clients: payload.clients?.length ?? 0, jobs: payload.jobs?.length ?? 0 };
}

// Rows as the copy holds them, only the columns this table has (a missing column takes its default).
async function insertRows(table: string, rows: Record<string, unknown>[], dropId: boolean): Promise<void> {
  if (!rows.length) return;
  const sql = await getSql();
  const tableCols = new Set(await tableColumns(table));
  const keys = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) keys.add(k);
  const cols = [...keys].filter((k) => tableCols.has(k) && !(dropId && k === "id"));
  if (!cols.length) return;
  const list = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += 800) {
    await sql.query(
      `insert into ${table} (${list}) select ${list} from jsonb_populate_recordset(null::${table}, $1::jsonb) on conflict do nothing`,
      [JSON.stringify(rows.slice(i, i + 800))],
    );
  }
}

/** v5 copies: settings, client history, day goals/notes, off days and note links. */
async function restoreV5Tables(
  userId: string,
  payload: BackupPayload,
  idMap: Map<number, number>,
  pageMap: Map<number, number>,
): Promise<void> {
  const sql = await getSql();
  if (payload.settings) {
    const tableCols = new Set(await tableColumns("app_settings"));
    const cols = Object.keys(payload.settings).filter((k) => tableCols.has(k) && k !== "user_id" && k !== "last_backup_at");
    if (cols.length) {
      await sql.query(`insert into app_settings (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
      await sql.query(
        `update app_settings a set ${cols.map((c) => `"${c}" = r."${c}"`).join(", ")}
           from jsonb_populate_record(null::app_settings, $2::jsonb) r where a.user_id = $1`,
        [userId, JSON.stringify(payload.settings)],
      );
    }
  }
  const mine = (rows: Record<string, unknown>[]): Record<string, unknown>[] => rows.map((row) => ({ ...row, user_id: userId }));
  if (payload.dayGoals) {
    await sql.query(`delete from day_goals where user_id = $1`, [userId]);
    await insertRows("day_goals", mine(payload.dayGoals), false);
  }
  if (payload.dayNotes) {
    await sql.query(`delete from day_notes where user_id = $1`, [userId]);
    await insertRows("day_notes", mine(payload.dayNotes), false);
  }
  if (payload.weekOff) {
    await sql.query(`delete from week_off_dates where user_id = $1`, [userId]);
    await insertRows("week_off_dates", mine(payload.weekOff), false);
  }
  if (payload.clientChanges) {
    // Clients were re-created above (cascade removed their old history); point rows at the new ids.
    const rows = mine(payload.clientChanges)
      .map((row) => ({ ...row, client_id: idMap.get(intId(row.client_id)) }))
      .filter((row) => row.client_id);
    await insertRows("client_changes", rows, true);
  }
  if (payload.padLinks && payload.padPages) {
    await sql.query(`delete from pad_links where user_id = $1`, [userId]);
    const rows = mine(payload.padLinks)
      .map((row) => ({ ...row, page_id: pageMap.get(intId(row.page_id)), client_id: idMap.get(intId(row.client_id)) }))
      .filter((row) => row.page_id && row.client_id);
    await insertRows("pad_links", rows, true);
  }
}

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown }>(
      `select payload from backups where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    if (!rows[0]) return { ok: false as const };
    const counts = await applyBackup(context.userId, parseBackup(rows[0].payload, true));
    return { ok: true as const, ...counts };
  });

export const importBackupJson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ json: z.string().min(2).max(40_000_000) }).parse(data))
  .handler(async ({ context, data }) => {
    const counts = await applyBackup(context.userId, parseBackup(data.json));
    return { ok: true as const, ...counts };
  });

function monthLabel(year: number, month: number): string {
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${names[month - 1] ?? month} ${String(year).slice(2)}`;
}

export const getFinanceStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FinanceStats> => {
    const sql = await getSql();
    const today = todayISO();
    const weekStart = startOfWeekISO(today);
    const { year, month } = monthParts(today);

    const weekSeries: MoneyPoint[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const start = addDaysISO(weekStart, -i * 7);
      const end = addDaysISO(start, 6);
      const rows = await sql.query<{
        collected: unknown;
        completed: unknown;
        cuts: unknown;
        jobs: unknown;
        extra_cuts: unknown;
        extra_amount: unknown;
        once_cuts: unknown;
        once_amount: unknown;
      }>(
        `select
           (select coalesce(sum(amount),0) from payments
             where user_id = $1 and kind in ('paid','prepaid')
               and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as collected,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as completed,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'cut'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as cuts,
           (select count(*) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as jobs,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_amount,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_amount`,
        [context.userId, start, end],
      );
      weekSeries.push({
        key: start,
        label: `${start.slice(5, 7)}/${start.slice(8, 10)}`,
        collected: money(rows[0]?.collected),
        completed: money(rows[0]?.completed),
        cuts: intId(rows[0]?.cuts),
        jobs: intId(rows[0]?.jobs),
        extraCuts: intId(rows[0]?.extra_cuts),
        extraAmount: money(rows[0]?.extra_amount),
        onceCuts: intId(rows[0]?.once_cuts),
        onceAmount: money(rows[0]?.once_amount),
      });
    }

    const monthSeries: MoneyPoint[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const m = addMonths(year, month, -i);
      const from = `${m.year}-${String(m.month).padStart(2, "0")}-01`;
      const to = lastDayOfMonthISO(m.year, m.month);
      const rows = await sql.query<{
        collected: unknown;
        completed: unknown;
        cuts: unknown;
        jobs: unknown;
        extra_cuts: unknown;
        extra_amount: unknown;
        once_cuts: unknown;
        once_amount: unknown;
      }>(
        `select
           (select coalesce(sum(amount),0) from payments
             where user_id = $1 and kind in ('paid','prepaid')
               and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as collected,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as completed,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'cut'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as cuts,
           (select count(*) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as jobs,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_amount,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_amount`,
        [context.userId, from, to],
      );
      monthSeries.push({
        key: from,
        label: monthLabel(m.year, m.month),
        collected: money(rows[0]?.collected),
        completed: money(rows[0]?.completed),
        cuts: intId(rows[0]?.cuts),
        jobs: intId(rows[0]?.jobs),
        extraCuts: intId(rows[0]?.extra_cuts),
        extraAmount: money(rows[0]?.extra_amount),
        onceCuts: intId(rows[0]?.once_cuts),
        onceAmount: money(rows[0]?.once_amount),
      });
    }

    const yearSeries: MoneyPoint[] = [];
    for (let i = 3; i >= 0; i -= 1) {
      const y = year - i;
      const from = `${y}-01-01`;
      const to = `${y}-12-31`;
      const rows = await sql.query<{
        collected: unknown;
        completed: unknown;
        cuts: unknown;
        jobs: unknown;
        extra_cuts: unknown;
        extra_amount: unknown;
        once_cuts: unknown;
        once_amount: unknown;
      }>(
        `select
           (select coalesce(sum(amount),0) from payments
             where user_id = $1 and kind in ('paid','prepaid')
               and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as collected,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as completed,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'cut'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as cuts,
           (select count(*) from jobs
             where user_id = $1 and status = 'done'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as jobs,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'extra'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as extra_amount,
           (select count(*) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_cuts,
           (select coalesce(sum(amount),0) from jobs
             where user_id = $1 and status = 'done' and kind = 'one_time'
               and scheduled_date >= $2::date and scheduled_date <= $3::date) as once_amount`,
        [context.userId, from, to],
      );
      const workRows = await sql.query<{ clock_in: string | null; clock_out: string | null }>(
        `select clock_in, clock_out from work_days
          where user_id = $1 and confirmed = true and work_date >= $2::date and work_date <= $3::date`,
        [context.userId, from, to],
      );
      yearSeries.push({
        minutes: workRows.reduce((t, r) => t + minutesBetween(r.clock_in, r.clock_out), 0),
        key: from,
        label: String(y),
        collected: money(rows[0]?.collected),
        completed: money(rows[0]?.completed),
        cuts: intId(rows[0]?.cuts),
        jobs: intId(rows[0]?.jobs),
        extraCuts: intId(rows[0]?.extra_cuts),
        extraAmount: money(rows[0]?.extra_amount),
        onceCuts: intId(rows[0]?.once_cuts),
        onceAmount: money(rows[0]?.once_amount),
      });
    }

    const clientFlow: ClientFlowPoint[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const m = addMonths(year, month, -i);
      const from = `${m.year}-${String(m.month).padStart(2, "0")}-01`;
      const to = lastDayOfMonthISO(m.year, m.month);
      const rows = await sql.query<{ altas: unknown; bajas: unknown }>(
        `select
           (select count(*) from clients
             where user_id = $1 and created_at >= $2::date
               and created_at < ($3::date + interval '1 day')) as altas,
           (select count(*) from clients
             where user_id = $1 and deactivated_at >= $2::date
               and deactivated_at < ($3::date + interval '1 day')) as bajas`,
        [context.userId, from, to],
      );
      clientFlow.push({
        key: from,
        label: monthLabel(m.year, m.month),
        altas: intId(rows[0]?.altas),
        bajas: intId(rows[0]?.bajas),
      });
    }

    const jobs = await sql.query<{ scheduled_date: unknown; status: string }>(
      `select scheduled_date, status from jobs
        where user_id = $1 and scheduled_date >= $2::date and scheduled_date <= $3::date`,
      [context.userId, weekStart, endOfWeekISO(today)],
    );
    const weekEffort: DayEffort[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDaysISO(weekStart, i);
      const day = jobs.filter((j) => asIsoDate(j.scheduled_date) === date && j.status !== "cancelled");
      weekEffort.push({
        date,
        weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
        done: day.filter((j) => j.status === "done").length,
        pending: day.filter((j) => j.status === "pending").length,
      });
    }

    const owing = await sql.query<{ pay_due_day: number | null; balance: unknown }>(
      `select pay_due_day, balance from clients
        where user_id = $1 and is_active = true and balance > 0`,
      [context.userId],
    );
    const latePayers = owing.filter((c) =>
      isPaymentLate(c.pay_due_day, today, money(c.balance)),
    ).length;

    const thisWeek = weekSeries[weekSeries.length - 1];
    const lastWeek = weekSeries[weekSeries.length - 2];
    // The 4 closed weeks before this one (the week in progress would pull the figures down).
    const sample = weekSeries.slice(-5, -1);
    const avgWeekCuts = sample.length
      ? Math.round((sample.reduce((s, p) => s + p.cuts, 0) / sample.length) * 10) / 10
      : 0;
    const avgWeekCollected = sample.length
      ? Math.round((sample.reduce((s, p) => s + p.collected, 0) / sample.length) * 100) / 100
      : 0;
    const reasonRows = await sql.query<{ reason: string; n: unknown }>(
      `select coalesce(nullif(trim(postpone_reason), ''), 'Sin razón') as reason, count(*) as n
         from jobs
        where user_id = $1
          and postpone_reason is not null
          and length(trim(postpone_reason)) > 0
          and scheduled_date >= $2::date
        group by 1
        order by count(*) desc
        limit 8`,
      [context.userId, addDaysISO(today, -90)],
    );

    // Median of the same last 4 weeks the average uses (the hint says "those weeks").
    const cuts = sample.map((p) => p.cuts);
    const sortedCuts = [...cuts].sort((a, b) => a - b);
    const mid = Math.floor(sortedCuts.length / 2);
    const medianWeekCuts = sortedCuts.length
      ? sortedCuts.length % 2
        ? sortedCuts[mid]!
        : Math.round((((sortedCuts[mid - 1] ?? 0) + (sortedCuts[mid] ?? 0)) / 2) * 10) / 10
      : 0;
    const yearStart = `${year}-01-01`;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const ticketRows = await sql.query<{ avg_ticket: unknown; n: unknown }>(
      `select coalesce(avg(amount),0) as avg_ticket, count(*) as n
         from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date`,
      [context.userId, yearStart, today],
    );
    const tipRows = await sql.query<{ tips_year: unknown; tips_month: unknown }>(
      `select
         coalesce(sum(tip),0) as tips_year,
         coalesce(sum(tip) filter (where paid_at >= $3::date),0) as tips_month
       from payments
       where user_id = $1 and paid_at >= $2::date and paid_at < ($4::date + interval '1 day')`,
      [context.userId, yearStart, monthStart, today],
    );
    const lifeRows = await sql.query<{ collected: unknown; cuts: unknown; jobs: unknown }>(
      `select
         (select coalesce(sum(amount),0) from payments
           where user_id = $1 and kind in ('paid','prepaid')) as collected,
         (select count(*) from jobs
           where user_id = $1 and status = 'done' and kind = 'cut') as cuts,
         (select count(*) from jobs
           where user_id = $1 and status = 'done') as jobs`,
      [context.userId],
    );
    const owingClients = await loadClients(context.userId, today, "owing");
    const waitPeople = owingClients.filter((c) => c.payTier === "espera").length;
    const seriousPeople = owingClients.filter((c) => c.payTier === "serio").length;

    return {
      weekSeries,
      monthSeries,
      yearSeries,
      clientFlow,
      weekEffort,
      thisWeekCuts: thisWeek?.cuts ?? 0,
      lastWeekCuts: lastWeek?.cuts ?? 0,
      thisWeekCollected: thisWeek?.collected ?? 0,
      lastWeekCollected: lastWeek?.collected ?? 0,
      latePayers,
      avgWeekCuts,
      avgWeekCollected,
      medianWeekCuts,
      avgTicket: money(ticketRows[0]?.avg_ticket),
      owingPeople: owingClients.length,
      waitPeople,
      seriousPeople,
      currentPeople: Math.max(0, owingClients.length - waitPeople - seriousPeople),
      postponeReasons: reasonRows.map((r) => ({ reason: r.reason, count: intId(r.n) })),
      tipsYear: money(tipRows[0]?.tips_year),
      tipsMonth: money(tipRows[0]?.tips_month),
      lifetimeCollected: money(lifeRows[0]?.collected),
      lifetimeCuts: intId(lifeRows[0]?.cuts),
      lifetimeJobs: intId(lifeRows[0]?.jobs),
      ...(await workFigures(context.userId, today)),
    };
  });

export const rescheduleJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.coerce.number().int(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().trim().max(80).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ scheduled_date: unknown; status: string; client_id: number; kind: string }>(
      `select scheduled_date, status, client_id, kind from jobs where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    const job = rows[0];
    if (!job || job.status !== "pending") return { ok: false as const, reason: "gone" as const, prevDate: "" };
    const prevDate = asIsoDate(job.scheduled_date);
    try {
      await sql.query(
        `update jobs
            set scheduled_date = $3::date,
                origin_date = coalesce(origin_date, scheduled_date),
                postpone_reason = case when $4 = '' then postpone_reason else $4 end
          where user_id = $1 and id = $2 and status = 'pending'`,
        [context.userId, data.id, data.date, data.reason],
      );
    } catch {
      return { ok: false as const, reason: "duplicate" as const, prevDate };
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, prevDate };
  });

export const undoPostpone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ origin_date: unknown; status: string }>(
      `select origin_date, status from jobs where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    const job = rows[0];
    if (!job || job.status !== "pending" || !job.origin_date) {
      return { ok: false as const, reason: "gone" as const, date: "" };
    }
    const date = asIsoDate(job.origin_date);
    try {
      await sql.query(
        `update jobs
            set scheduled_date = $3::date,
                origin_date = null,
                postpone_reason = null
          where user_id = $1 and id = $2 and status = 'pending'`,
        [context.userId, data.id, date],
      );
    } catch {
      return { ok: false as const, reason: "duplicate" as const, date };
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, date };
  });

export const bulkClients = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        ids: z.array(z.coerce.number().int()).min(1).max(400),
        action: z.enum(["reactivate", "archive", "delete"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await snapshotBackup(context.userId, true).catch(() => undefined);
    if (data.action === "delete") {
      await sql.query(`delete from clients where user_id = $1 and id = any($2::int[])`, [
        context.userId,
        data.ids,
      ]);
      return { ok: true as const, count: data.ids.length };
    }
    const active = data.action === "reactivate";
    await sql.query(
      `update clients
          set is_active = $3,
              deactivated_at = case when $3 then null else now() end
        where user_id = $1 and id = any($2::int[])`,
      [context.userId, data.ids, active],
    );
    if (!active) {
      await sql.query(
        `delete from jobs where user_id = $1 and client_id = any($2::int[]) and status = 'pending'`,
        [context.userId, data.ids],
      );
    }
    if (active) await ensureScheduleForUser(context.userId);
    return { ok: true as const, count: data.ids.length };
  });

export const saveClientNotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), html: z.string().max(20000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`update clients set rich_notes = $3 where user_id = $1 and id = $2`, [
      context.userId,
      data.id,
      sanitizeHtml(data.html),
    ]);
    return { ok: true as const };
  });

export const getPad = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ trashDays: z.coerce.number().int().min(1).max(365).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<PadData> => {
    await ensureScheduleForUser(context.userId);
    const sql = await getSql();
    const today = todayISO();
    const horizon = addDaysISO(today, 6);
    const trashDays = data.trashDays ?? 30;
    await sql.query(
      `delete from pad_pages
        where user_id = $1 and deleted_at is not null
          and deleted_at < now() - ($2::int * interval '1 day')`,
      [context.userId, trashDays],
    );
    let pages = await sql.query<{
      id: number;
      title: string;
      body: string;
      sort_order: number;
      folder: string | null;
      pinned: boolean | null;
      tags: string | null;
      due_date: unknown;
      due_time: string | null;
      deleted_at: unknown;
      created_at: unknown;
      updated_at: unknown;
    }>(
      `select id, title, body, sort_order, folder, pinned, tags, due_date, due_time, deleted_at, created_at, updated_at
         from pad_pages
        where user_id = $1 order by pinned desc, sort_order asc, id asc`,
      [context.userId],
    );
    if (pages.length === 0) {
      const legacy = await sql.query<{ body: string }>(
        `select body from pad_notes where user_id = $1`,
        [context.userId],
      );
      const inserted = await sql.query<{
        id: number;
        title: string;
        body: string;
        sort_order: number;
        folder: string | null;
        pinned: boolean | null;
        tags: string | null;
        due_date: unknown;
        due_time: string | null;
        deleted_at: unknown;
        created_at: unknown;
        updated_at: unknown;
      }>(
        `insert into pad_pages (user_id, title, body, sort_order, folder)
         values ($1, 'General', $2, 0, '')
         returning id, title, body, sort_order, folder, pinned, tags, due_date, due_time, deleted_at, created_at, updated_at`,
        [context.userId, legacy[0]?.body ?? ""],
      );
      pages = inserted;
    }
    const jobs = await sql.query<{
      id: number;
      client_id: number;
      client_name: string;
      scheduled_date: unknown;
      title: string | null;
      status: string;
      amount: unknown;
      kind: string;
    }>(
      `select j.id, j.client_id, c.name as client_name, j.scheduled_date, j.title, j.status, j.amount, j.kind
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and c.is_active = true
          and (j.status <> 'pending' or c.service_paused = false)
          and j.status <> 'cancelled'
          and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
        order by j.scheduled_date asc, c.name asc`,
      [context.userId, today, horizon],
    );
    const mapped: PadJob[] = jobs.map((j) => ({
      id: intId(j.id),
      clientId: intId(j.client_id),
      clientName: j.client_name,
      date: asIsoDate(j.scheduled_date),
      title: j.title || (j.kind === "extra" ? "Extra" : j.kind === "one_time" ? "Una vez" : "Corte"),
      status: j.status,
      amount: money(j.amount),
    }));
    const weekDays = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDaysISO(today, i);
      weekDays.push({
        date,
        weekday: weekdayFromISO(date),
        items: mapped.filter((j) => j.date === date),
      });
    }
    const links = await sql.query<{ page_id: number; client_id: number }>(
      `select page_id, client_id from pad_links where user_id = $1`,
      [context.userId],
    );
    const byPage = new Map<number, number[]>();
    for (const link of links) {
      const id = intId(link.page_id);
      const list = byPage.get(id) ?? [];
      list.push(intId(link.client_id));
      byPage.set(id, list);
    }
    const mappedPages: PadPage[] = pages.map((p) => ({
      id: intId(p.id),
      title: p.title,
      body: p.body ?? "",
      sortOrder: Number(p.sort_order) || 0,
      folder: p.folder?.trim() ?? "",
      pinned: Boolean(p.pinned),
      tags: p.tags?.trim() ?? "",
      dueDate: p.due_date ? asIsoDate(p.due_date) : null,
      dueTime: p.due_time && /^\d{2}:\d{2}/.test(p.due_time) ? p.due_time.slice(0, 5) : null,
      clientIds: byPage.get(intId(p.id)) ?? [],
      deletedAt: p.deleted_at ? asIsoStamp(p.deleted_at) : null,
      createdAt: p.created_at ? asIsoStamp(p.created_at) : p.updated_at ? asIsoStamp(p.updated_at) : "",
      updatedAt: p.updated_at ? asIsoStamp(p.updated_at) : "",
    }));
    const clients = await sql.query<{ id: number; name: string; phone: string | null; cue: string | null }>(
      `select id, name, phone, cue from clients where user_id = $1 and is_active = true order by name asc limit 400`,
      [context.userId],
    );
    return {
      pages: mappedPages,
      weekDays,
      clients: clients.map((c) => ({
        id: intId(c.id),
        name: c.name,
        phone: c.phone,
        cue: c.cue,
      })),
    };
  });

export const savePad = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        html: z.string().max(20000).optional(),
        pageId: z.coerce.number().int().optional(),
        title: z.string().trim().max(80).optional(),
        folder: z.string().trim().max(40).optional(),
        pinned: z.boolean().optional(),
        tags: z.string().trim().max(200).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        trashed: z.boolean().optional(),
        clientIds: z.array(z.coerce.number().int()).max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const html = data.html != null ? sanitizeHtml(data.html) : null;
    if (data.pageId) {
      await sql.query(
        `update pad_pages
            set body = coalesce($3, body),
                title = coalesce($4, title),
                folder = coalesce($5, folder),
                updated_at = now()
          where user_id = $1 and id = $2`,
        [context.userId, data.pageId, html, data.title ?? null, data.folder ?? null],
      );
      if (data.pinned !== undefined) {
        await sql.query(`update pad_pages set pinned = $3 where user_id = $1 and id = $2`, [
          context.userId,
          data.pageId,
          data.pinned,
        ]);
      }
      if (data.tags !== undefined) {
        await sql.query(`update pad_pages set tags = $3 where user_id = $1 and id = $2`, [
          context.userId,
          data.pageId,
          data.tags,
        ]);
      }
      if (data.dueDate !== undefined) {
        await sql.query(`update pad_pages set due_date = $3::date where user_id = $1 and id = $2`, [
          context.userId,
          data.pageId,
          data.dueDate,
        ]);
      }
      if (data.dueTime !== undefined) {
        await sql.query(`update pad_pages set due_time = $3 where user_id = $1 and id = $2`, [
          context.userId,
          data.pageId,
          data.dueTime,
        ]);
      }
      if (data.trashed === true) {
        await sql.query(
          `update pad_pages set deleted_at = now(), pinned = false where user_id = $1 and id = $2`,
          [context.userId, data.pageId],
        );
      } else if (data.trashed === false) {
        await sql.query(`update pad_pages set deleted_at = null where user_id = $1 and id = $2`, [
          context.userId,
          data.pageId,
        ]);
      }
      if (data.clientIds) {
        await sql.query(`delete from pad_links where user_id = $1 and page_id = $2`, [context.userId, data.pageId]);
        for (const clientId of data.clientIds) {
          await sql.query(
            `insert into pad_links (user_id, page_id, client_id)
             select $1, $2, $3
              where exists (select 1 from clients where user_id = $1 and id = $3)
             on conflict (page_id, client_id) do nothing`,
            [context.userId, data.pageId, clientId],
          );
        }
      }
    } else if (html != null) {
      await sql.query(
        `insert into pad_notes (user_id, body, updated_at) values ($1, $2, now())
         on conflict (user_id) do update set body = $2, updated_at = now()`,
        [context.userId, html],
      );
    }
    return { ok: true as const };
  });

export const createPadPage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(80).optional(),
      folder: z.string().trim().max(40).optional(),
    }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const max = await sql.query<{ m: unknown }>(
      `select coalesce(max(sort_order), -1) as m from pad_pages where user_id = $1`,
      [context.userId],
    );
    const inserted = await sql.query<{ id: number }>(
      `insert into pad_pages (user_id, title, body, sort_order, folder)
       values ($1, $2, '', $3, $4) returning id`,
      [context.userId, data.title?.trim() || "Nota", intId(max[0]?.m) + 1, data.folder?.trim() || ""],
    );
    return { id: intId(inserted[0]?.id) };
  });

export const deletePadPage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const count = await sql.query<{ n: unknown }>(
      `select count(*) as n from pad_pages where user_id = $1`,
      [context.userId],
    );
    if (intId(count[0]?.n) <= 1) return { ok: false as const, reason: "last" as const };
    await sql.query(`delete from pad_pages where user_id = $1 and id = $2`, [
      context.userId,
      data.id,
    ]);
    return { ok: true as const };
  });

export const listPinnedNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number; title: string; body: string }>(
      `select id, title, body from pad_pages
        where user_id = $1 and pinned = true and deleted_at is null
        order by updated_at desc, id desc
        limit 6`,
      [context.userId],
    );
    return rows.map((row) => ({
      id: intId(row.id),
      title: row.title || "Nota",
      body: row.body ?? "",
    }));
  });

export const dropPadFolder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ name: z.string().trim().min(1).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`delete from pad_pages where user_id = $1 and folder = $2`, [context.userId, data.name]);
    return { ok: true as const };
  });

export const exportSheets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureScheduleForUser(context.userId);
    const today = todayISO();
    const clients = await loadClients(context.userId, today, "active");
    const sql = await getSql();
    const jobs = await sql.query<JobDb>(
      `select j.id, j.client_id, c.name as client_name, c.phone as client_phone,
              c.address as client_address, c.pay_same_day, c.credit, j.scheduled_date, j.status, j.kind,
              j.title, j.amount, j.notes, j.completed_at, j.arrival_time, j.sort_order,
              j.pinned, j.postpone_reason, j.origin_date, c.cue as client_cue, c.standing_extras
         from jobs j
         join clients c on c.id = j.client_id
        where j.user_id = $1 and c.user_id = $1 and j.status = 'pending'
        order by j.scheduled_date asc, c.name asc`,
      [context.userId],
    );
    const mapped = jobs.map((r) => mapJob(r, today));
    const clientHeader = [
      "Nombre",
      "Teléfono",
      "Dirección",
      "Tipo",
      "Precio",
      "Cortes al mes",
      "Día",
      "Inicio",
      "Paga el mismo día",
      "Deuda",
      "Adelanto",
      "Notas",
    ];
    const clientRows = clients.map((c) =>
      [
        c.name,
        c.phone ?? "",
        c.address ?? "",
        c.kind === "one_time" ? "Una vez" : "Regular",
        c.pricePerCut,
        c.cutsPerMonth,
        c.weekday,
        c.startDate ?? "",
        c.paySameDay ? "Sí" : "No",
        c.balance,
        c.credit,
        c.notes ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    const jobHeader = [
      "Fecha",
      "Cliente",
      "Teléfono",
      "Dirección",
      "Trabajo",
      "Estado",
      "Monto",
      "Hora",
      "Notas",
    ];
    const jobRows = mapped.map((j) =>
      [
        j.scheduledDate,
        j.clientName,
        j.clientPhone ?? "",
        j.clientAddress ?? "",
        j.title ?? "",
        j.computedStatus === "late" ? "Tarde" : "Pendiente",
        j.amount,
        j.arrivalTime ?? "",
        j.notes ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    return {
      clientsCsv: [clientHeader.join(","), ...clientRows].join("\n"),
      jobsCsv: [jobHeader.join(","), ...jobRows].join("\n"),
      stamp: today,
      clientCount: clients.length,
      jobCount: mapped.length,
    };
  });

export const exportReport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ pdf: string; xls: string; today: string }> => {
    const sql = await getSql();
    const today = todayISO();
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const settings = await sql.query<{ business_name: string | null }>(
      `select business_name from app_settings where user_id = $1`,
      [context.userId],
    );
    const weekStart = startOfWeekISO(today);
    const weeks: { label: string; collected: number }[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const start = addDaysISO(weekStart, -i * 7);
      const end = addDaysISO(start, 6);
      const sum = await sql.query<{ n: unknown }>(
        `select coalesce(sum(amount), 0) as n from payments
          where user_id = $1 and kind in ('paid', 'prepaid')
            and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')`,
        [context.userId, start, end],
      );
      weeks.push({ label: start.slice(5), collected: money(sum[0]?.n) });
    }
    const clients = await sql.query<{
      name: string;
      phone: string | null;
      price_per_cut: unknown;
      balance: unknown;
    }>(
      `select name, phone, price_per_cut, balance from clients
        where user_id = $1 order by balance desc, name asc limit 2000`,
      [context.userId],
    );
    const jobs = await sql.query<{ scheduled_date: unknown; name: string; status: string; amount: unknown }>(
      `select j.scheduled_date, c.name, j.status, j.amount
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and (j.scheduled_date >= $2::date or j.status = 'pending')
        order by j.scheduled_date desc, c.name asc
        limit 4000`,
      [context.userId, yearStart],
    );
    const payments = await sql.query<{ paid_at: unknown; name: string; amount: unknown; kind: string }>(
      `select p.paid_at, c.name, p.amount, p.kind
         from payments p join clients c on c.id = p.client_id
        where p.user_id = $1 and p.paid_at >= $2::date
        order by p.paid_at desc
        limit 4000`,
      [context.userId, yearStart],
    );
    const hours = await sql.query<{ work_date: unknown; clock_in: string | null; clock_out: string | null }>(
      `select work_date, clock_in, clock_out from work_days
        where user_id = $1 and confirmed and work_date >= $2::date
        order by work_date asc`,
      [context.userId, yearStart],
    );
    const clientRows = clients.map((row) => ({
      name: row.name,
      phone: row.phone ?? "",
      price: money(row.price_per_cut),
      balance: money(row.balance),
    }));
    const owing = clientRows.filter((row) => row.balance > 0);
    const statusEs = (status: string) => (status === "done" ? "Hecho" : status === "cancelled" ? "Cancelado" : "Pendiente");
    const pack: WorkbookPack = {
      business: settings[0]?.business_name?.trim() || "Oscar's Lawn Service",
      today,
      weekCollected: weeks[weeks.length - 1]?.collected ?? 0,
      owingPeople: owing.length,
      owingTotal: owing.reduce((n, row) => n + row.balance, 0),
      weeks,
      owing: owing.slice(0, 24),
      clients: clientRows,
      jobs: jobs.map((row) => ({
        date: asIsoDate(row.scheduled_date),
        name: row.name,
        status: statusEs(row.status),
        amount: money(row.amount),
      })),
      payments: payments.map((row) => ({
        date: stampDay(asIsoStamp(row.paid_at)),
        name: row.name,
        amount: money(row.amount),
        kind: row.kind,
      })),
      hours: hours.map((row) => ({
        date: asIsoDate(row.work_date),
        inn: (row.clock_in ?? "").slice(0, 5),
        out: (row.clock_out ?? "").slice(0, 5),
        hours: Math.round((minutesBetween(row.clock_in, row.clock_out) / 60) * 100) / 100,
      })),
    };
    return {
      today,
      pdf: Buffer.from(buildReportPdf(pack)).toString("base64"),
      xls: Buffer.from(buildReportXls(pack), "utf8").toString("base64"),
    };
  });

export const applyVacation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (data.end < data.start) return { ok: false as const, reason: "range" as const, moved: 0 };
    const sql = await getSql();
    const prefs = await loadPrefs(context.userId);
    if (prefs.vacationShift) {
      await shiftPendingJobs(
        context.userId,
        -prefs.vacationShift,
        prefs.vacationStart ?? data.start,
      );
    }
    let days = 0;
    let cursor = data.start;
    while (cursor <= data.end && days < 180) {
      days += 1;
      cursor = addDaysISO(cursor, 1);
    }
    const moved = await shiftPendingJobs(context.userId, days, data.start, data.end);
    const overdue = await sql.query<{ id: number; client_id: number }>(
      `select id, client_id from jobs
        where user_id = $1 and status = 'pending' and scheduled_date < $2::date
        order by scheduled_date asc, id asc`,
      [context.userId, data.start],
    );
    const returnDate = addDaysISO(data.end, 1);
    for (const row of overdue) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), returnDate);
    }
    await sql.query(
      `insert into app_settings (user_id, vacation_start, vacation_end, vacation_shift, updated_at)
       values ($1, $2::date, $3::date, $4, now())
       on conflict (user_id) do update
         set vacation_start = $2::date, vacation_end = $3::date, vacation_shift = $4, updated_at = now()`,
      [context.userId, data.start, data.end, days],
    );
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const, moved: moved + overdue.length, days };
  });

export const clearVacation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prefs = await loadPrefs(context.userId);
    if (prefs.vacationShift && prefs.vacationStart) {
      await shiftPendingJobs(context.userId, -prefs.vacationShift, prefs.vacationStart);
    }
    const sql = await getSql();
    await sql.query(
      `update app_settings
          set vacation_start = null, vacation_end = null, vacation_shift = 0, updated_at = now()
        where user_id = $1`,
      [context.userId],
    );
    await ensureScheduleForUser(context.userId);
    return { ok: true as const };
  });

export const bulkReschedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        ids: z.array(z.coerce.number().int()).min(1).max(200),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const target = data.date;
    const rows = await sql.query<{ id: number; client_id: number; name: string }>(
      `select j.id, j.client_id, c.name
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.status = 'pending' and j.id = any($2::int[])`,
      [context.userId, data.ids],
    );
    let moved = 0;
    const names: string[] = [];
    for (const row of rows) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), target);
      moved += 1;
      names.push(row.name);
    }
    return { ok: true as const, moved, date: target, names };
  });

export const postponeAccumulated = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scope: z.enum(["overdue", "today"]).optional().default("overdue"),
        reason: z.string().trim().max(80).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const today = todayISO();
    const sql = await getSql();
    const target = data.date;
    const rows =
      data.scope === "today"
        ? await sql.query<{ id: number; client_id: number; name: string }>(
            `select j.id, j.client_id, c.name
               from jobs j join clients c on c.id = j.client_id
              where j.user_id = $1 and j.status = 'pending' and j.scheduled_date = $2::date`,
            [context.userId, today],
          )
        : await sql.query<{ id: number; client_id: number; name: string }>(
            `select j.id, j.client_id, c.name
               from jobs j join clients c on c.id = j.client_id
              where j.user_id = $1 and j.status = 'pending' and j.scheduled_date < $2::date`,
            [context.userId, today],
          );
    let moved = 0;
    const names: string[] = [];
    for (const row of rows) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), target);
      if (data.reason) {
        await sql.query(`update jobs set postpone_reason = $3 where user_id = $1 and id = $2`, [
          context.userId,
          intId(row.id),
          data.reason,
        ]);
      }
      moved += 1;
      names.push(row.name);
    }
    return { ok: true as const, moved, date: target, names };
  });

export const moveDayJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (data.from === data.to) return { ok: true as const, moved: 0, date: data.to, names: [] as string[] };
    const sql = await getSql();
    const target = data.to;
    const rows = await sql.query<{ id: number; client_id: number; name: string }>(
      `select j.id, j.client_id, c.name
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.status = 'pending' and j.scheduled_date = $2::date`,
      [context.userId, data.from],
    );
    let moved = 0;
    const names: string[] = [];
    for (const row of rows) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), target);
      moved += 1;
      names.push(row.name);
    }
    return { ok: true as const, moved, date: target, names };
  });

export const updatePayMode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), paySameDay: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update clients
          set pay_same_day = $3,
              pay_due_day = case when $3 then null else pay_due_day end
        where user_id = $1 and id = $2`,
      [context.userId, data.id, data.paySameDay],
    );
    await logClientChange(
      context.userId,
      data.id,
      data.paySameDay ? "Paga el mismo día" : "La deuda se acumula",
      { paySameDay: data.paySameDay },
    ).catch(() => undefined);
    return { ok: true as const };
  });

export const listClientChanges = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ clientId: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }): Promise<ClientChange[]> => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: number;
      summary: string;
      snapshot: unknown;
      created_at: unknown;
    }>(
      `select id, summary, snapshot, created_at from client_changes
        where user_id = $1 and client_id = $2
        order by created_at desc, id desc
        limit 30`,
      [context.userId, data.clientId],
    );
    return rows.map((r) => ({
      id: intId(r.id),
      summary: r.summary,
      snapshot: typeof r.snapshot === "string" ? r.snapshot : JSON.stringify(r.snapshot ?? {}),
      createdAt: asIsoStamp(r.created_at),
    }));
  });

export const restoreClientChange = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ clientId: z.coerce.number().int(), changeId: z.coerce.number().int() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ snapshot: unknown }>(
      `select snapshot from client_changes
        where user_id = $1 and client_id = $2 and id = $3`,
      [context.userId, data.clientId, data.changeId],
    );
    const raw = rows[0]?.snapshot;
    const snap =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : ((raw as Record<string, unknown> | undefined) ?? null);
    if (!snap) return { ok: false as const };
    const sets: string[] = [];
    const params: unknown[] = [context.userId, data.clientId];
    let i = 3;
    const map: [string, string][] = [
      ["name", "name"],
      ["phone", "phone"],
      ["address", "address"],
      ["notes", "notes"],
      ["pricePerCut", "price_per_cut"],
      ["cutsPerMonth", "cuts_per_month"],
      ["weekday", "weekday"],
      ["startDate", "start_date"],
      ["paySameDay", "pay_same_day"],
      ["payDueDay", "pay_due_day"],
      ["kind", "kind"],
    ];
    for (const [key, col] of map) {
      if (snap[key] === undefined) continue;
      sets.push(`${col} = $${i++}`);
      params.push(snap[key]);
    }
    if (sets.length) {
      await sql.query(
        `update clients set ${sets.join(", ")} where user_id = $1 and id = $2`,
        params,
      );
    }
    await logClientChange(context.userId, data.clientId, "Cambio restaurado", snap).catch(
      () => undefined,
    );
    await ensureScheduleForUser(context.userId);
    return { ok: true as const };
  });

export const translateYardSms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ text: z.string().trim().min(1).max(800) }).parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "La traducción no está disponible ahora." };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "You translate short SMS from a Spanish-speaking lawn-care gardener (Oscar's Lawn Service) into natural, concise American English. Keep the gardening context: lawn, yard, mowing, hedge, trim, payment, arrival time. Fix grammar. If the line is a question, end with ?. If it is an exclamation, end with !. Do not add greetings or extra sentences. Return only the English text.",
          },
          { role: "user", content: data.text },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: "No se pudo traducir. Inténtalo de nuevo." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (body.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false as const, error: "La traducción salió vacía." };
    return { ok: true as const, text };
  });

function punctuateUtterance(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return t;
  t = t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
  if (/[.?!…]$/.test(t)) return t;
  if (
    /^(qué|que|cómo|como|cuándo|cuando|dónde|donde|adónde|por qué|por que|cuál|cual|quién|quien|cuánto|cuanto|what|how|when|where|why|who|which|whose|can you|could you|would you|is |are |do |does |did |will )/i.test(
      t,
    )
  ) {
    return `${t}?`;
  }
  if (/^(oye|wow|guau|cuidado|hey|mira|ay|ojo|alto|stop|watch out|careful|bravo)\b/i.test(t)) {
    return `${t}!`;
  }
  return `${t}.`;
}

export const polishYardText = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        text: z.string().trim().min(1).max(4000),
        lang: z.enum(["es", "en"]).optional().default("es"),
        html: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const local = data.html ? data.text : punctuateUtterance(data.text);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: true as const, text: local };
    const lang = data.lang === "en" ? "English" : "Spanish";
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: data.html ? 1200 : 400,
        messages: [
          {
            role: "system",
            content: data.html
              ? `Correct grammar, accents, and capitalization in the text of this HTML. Language: ${lang}. If a sentence is a question, end it with ?. If it is an exclamation, end it with !. Keep every tag and attribute. Do not add facts. Return only HTML.`
              : `Correct this short lawn-service note or SMS in ${lang}. Fix grammar, accents, and capitalization. If it is a question, end with ?. If it is an exclamation, end with !. Otherwise end with a period when it is a full sentence. Do not add greetings or new facts. Return only the corrected text.`,
          },
          { role: "user", content: data.text },
        ],
      }),
    });
    if (!res.ok) return { ok: true as const, text: local };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (body.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return { ok: true as const, text: text || local };
  });

export const findDuplicateClients = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().max(40).optional().default(""),
        excludeId: z.coerce.number().int().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const digits = data.phone.replace(/\D/g, "");
    const tail = digits.length >= 7 ? digits.slice(-10) : "";
    const rows = await sql.query<{ id: number; name: string; phone: string | null }>(
      `select id, name, phone from clients
        where user_id = $1
          and ($4::int is null or id <> $4)
          and (
            lower(trim(name)) = lower(trim($2))
            or (
              $3 <> ''
              and right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = $3
            )
          )
        order by name asc
        limit 5`,
      [context.userId, data.name, tail, data.excludeId ?? null],
    );
    return {
      matches: rows.map((r) => ({ id: intId(r.id), name: r.name, phone: r.phone })),
    };
  });

export const setBlacklist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), blacklisted: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`update clients set blacklisted = $3 where user_id = $1 and id = $2`, [
      context.userId,
      data.id,
      data.blacklisted,
    ]);
    if (data.blacklisted) {
      await sql.query(
        `delete from jobs
          where user_id = $1 and client_id = $2 and status = 'pending' and scheduled_date >= $3::date`,
        [context.userId, data.id, todayISO()],
      );
    } else {
      await ensureScheduleForUser(context.userId);
    }
    return { ok: true as const };
  });

export const setServicePaused = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), paused: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `update clients set service_paused = $3
        where user_id = $1 and id = $2
        returning id`,
      [context.userId, data.id, data.paused],
    );
    if (!rows[0]) return { ok: false as const };
    if (data.paused) {
      await sql.query(
        `delete from jobs
          where user_id = $1 and client_id = $2 and status = 'pending'`,
        [context.userId, data.id],
      );
    } else {
      await ensureScheduleForUser(context.userId);
    }
    await snapshotBackup(context.userId).catch(() => undefined);
    return { ok: true as const };
  });

export const toggleJobPin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ pinned: boolean }>(
      `update jobs set pinned = not pinned
        where user_id = $1 and id = $2
        returning pinned`,
      [context.userId, data.id],
    );
    return { ok: Boolean(rows[0]), pinned: Boolean(rows[0]?.pinned) };
  });

export const getWeekOff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const today = todayISO();
    const from = addDaysISO(today, -45);
    const to = addDaysISO(today, 90);
    const offs = await sql.query<{ off_date: unknown }>(
      `select off_date from week_off_dates
        where user_id = $1 and off_date >= $2::date and off_date <= $3::date
        order by off_date`,
      [context.userId, from, to],
    );
    const notes = await sql.query<{ note_date: unknown; body: string }>(
      `select note_date, body from day_notes where user_id = $1`,
      [context.userId],
    );
    const postponed = await sql.query<{ origin_date: unknown; reason: string; name: string }>(
      `select origin_date, reason, name from (
         select j.origin_date, trim(j.postpone_reason) as reason, c.name as name
           from jobs j
           join clients c on c.id = j.client_id and c.user_id = j.user_id
          where j.user_id = $1
            and j.origin_date is not null
            and j.scheduled_date <> j.origin_date
            and length(trim(coalesce(j.postpone_reason, ''))) > 0
         union all
         select w.work_date, trim(w.stopped_reason), ''
           from work_days w
          where w.user_id = $1
            and length(trim(coalesce(w.stopped_reason, ''))) > 0
         union all
         select m.mark_date, trim(m.reason), trim(m.detail)
           from day_marks m
          where m.user_id = $1
            and m.kind = 'off'
            and length(trim(coalesce(m.reason, ''))) > 0
       ) s
       order by origin_date`,
      [context.userId],
    );
    return {
      offDates: offs.map((r) => asIsoDate(r.off_date)),
      notes: notes.map((r) => ({ date: asIsoDate(r.note_date), body: r.body ?? "" })),
      postponed: postponed
        .filter((row) => row.reason.trim())
        .map((row) => ({
          date: asIsoDate(row.origin_date),
          reason: row.reason.trim(),
          name: row.name.trim(),
        })),
    };
  });

export const toggleOffDate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().trim().max(80).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql.query(
      `select 1 as ok from week_off_dates where user_id = $1 and off_date = $2::date`,
      [context.userId, data.date],
    );
    if (existing[0]) {
      await sql.query(`delete from week_off_dates where user_id = $1 and off_date = $2::date`, [
        context.userId,
        data.date,
      ]);
      await sql.query(`delete from day_marks where user_id = $1 and mark_date = $2::date and kind = 'off'`, [
        context.userId,
        data.date,
      ]);
      return { on: false as const, moved: 0, names: [] as string[], date: data.date };
    }
    await sql.query(
      `insert into week_off_dates (user_id, off_date) values ($1, $2::date) on conflict do nothing`,
      [context.userId, data.date],
    );
    const prefs = await loadPrefs(context.userId);
    const offRows = await sql.query<{ off_date: unknown }>(
      `select off_date from week_off_dates where user_id = $1`,
      [context.userId],
    );
    const offDates = new Set(offRows.map((r) => asIsoDate(r.off_date)));
    const target = nextOpenDate(addDaysISO(data.date, 1), prefs.excludedWeekdays, offDates);
    const rows = await sql.query<{ id: number; client_id: number; name: string }>(
      `select j.id, j.client_id, c.name
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.status = 'pending' and j.scheduled_date = $2::date`,
      [context.userId, data.date],
    );
    const names: string[] = [];
    const reason = data.reason.trim() || "Día libre";
    for (const row of rows) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), target);
      await sql.query(`update jobs set postpone_reason = $3 where user_id = $1 and id = $2`, [
        context.userId,
        intId(row.id),
        reason,
      ]);
      names.push(row.name);
    }
    await sql.query(
      `insert into day_marks (user_id, mark_date, reason, detail, kind)
       values ($1, $2::date, $3, $4, 'off')
       on conflict (user_id, mark_date, kind, reason)
       do update set detail = excluded.detail`,
      [context.userId, data.date, reason, names.join(", ")],
    );
    return { on: true as const, moved: names.length, names, date: target };
  });

export const saveDayNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        body: z.string().max(180),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const body = data.body.trim();
    if (!body) {
      await sql.query(`delete from day_notes where user_id = $1 and note_date = $2::date`, [
        context.userId,
        data.date,
      ]);
    } else {
      await sql.query(
        `insert into day_notes (user_id, note_date, body) values ($1, $2::date, $3)
         on conflict (user_id, note_date) do update set body = $3`,
        [context.userId, data.date, body.slice(0, 180)],
      );
    }
    return { ok: true as const };
  });

export const shiftForRain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        reason: z.string().trim().min(1).max(80).optional().default("Lluvia"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const today = todayISO();
    const sql = await getSql();
    const prefs = await loadPrefs(context.userId);
    const offRows = await sql.query<{ off_date: unknown }>(
      `select off_date from week_off_dates where user_id = $1 and off_date >= $2::date`,
      [context.userId, today],
    );
    const offDates = new Set(offRows.map((r) => asIsoDate(r.off_date)));
    const target = nextOpenDate(addDaysISO(today, 1), prefs.excludedWeekdays, offDates);
    const rows = await sql.query<{ id: number; client_id: number; name: string; phone: string | null }>(
      `select j.id, j.client_id, c.name, c.phone
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.status = 'pending' and j.scheduled_date = $2::date
          and c.is_active = true and c.service_paused = false`,
      [context.userId, today],
    );
    const people: { id: number; name: string; phone: string | null }[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      await moveJobToDate(context.userId, intId(row.id), intId(row.client_id), target);
      await sql.query(`update jobs set postpone_reason = $3 where user_id = $1 and id = $2`, [
        context.userId,
        intId(row.id),
        data.reason,
      ]);
      const cid = intId(row.client_id);
      if (!seen.has(cid)) {
        seen.add(cid);
        people.push({ id: cid, name: row.name, phone: row.phone });
      }
    }
    await ensureWorkDay(context.userId, today);
    await sql.query(
      `update work_days
          set stopped_reason = $3, stopped_at = now(), clock_out = $4, auto = false
        where user_id = $1 and work_date = $2::date`,
      [context.userId, today, data.reason, nowHHMM()],
    );
    return { ok: true as const, moved: rows.length, date: target, people, reason: data.reason, at: new Date().toISOString() };
  });

export const getJobPhoto = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ photo: string | null; scheduled_date: unknown }>(
      `select photo, scheduled_date from jobs where user_id = $1 and id = $2`,
      [context.userId, data.id],
    );
    const row = rows[0];
    if (!row?.photo) return { photo: null as string | null, date: "" };
    return { photo: row.photo, date: asIsoDate(row.scheduled_date) };
  });

export const addClientPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        clientId: z.coerce.number().int(),
        data: z.string().max(180000),
        caption: z.string().trim().max(80).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!PHOTOS_ENABLED || !data.data.startsWith("data:image/")) return { ok: false as const };
    const sql = await getSql();
    const owned = await sql.query<{ id: number }>(
      `select id from clients where user_id = $1 and id = $2`,
      [context.userId, data.clientId],
    );
    if (!owned[0]) return { ok: false as const };
    const count = await sql.query<{ n: unknown }>(
      `select count(*) as n from client_photos where user_id = $1 and client_id = $2`,
      [context.userId, data.clientId],
    );
    if (intId(count[0]?.n) >= 6) return { ok: false as const };
    await sql.query(
      `insert into client_photos (user_id, client_id, data, caption) values ($1,$2,$3,$4)`,
      [context.userId, data.clientId, data.data, data.caption.trim() || null],
    );
    return { ok: true as const };
  });

export const deleteClientPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`delete from client_photos where user_id = $1 and id = $2`, [context.userId, data.id]);
    return { ok: true as const };
  });

export const listPadPhotos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ pageId: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }): Promise<PadPhoto[]> => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number; data: string; created_at: unknown }>(
      `select id, data, created_at from pad_photos
        where user_id = $1 and page_id = $2
        order by created_at desc, id desc
        limit 6`,
      [context.userId, data.pageId],
    );
    return rows.map((row) => ({
      id: intId(row.id),
      data: row.data,
      createdAt: asIsoStamp(row.created_at),
    }));
  });

export const addPadPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ pageId: z.coerce.number().int(), data: z.string().max(180000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!PHOTOS_ENABLED || !data.data.startsWith("data:image/")) return { ok: false as const };
    const sql = await getSql();
    const owned = await sql.query<{ id: number }>(
      `select id from pad_pages where user_id = $1 and id = $2`,
      [context.userId, data.pageId],
    );
    if (!owned[0]) return { ok: false as const };
    const count = await sql.query<{ n: unknown }>(
      `select count(*) as n from pad_photos where user_id = $1 and page_id = $2`,
      [context.userId, data.pageId],
    );
    if (intId(count[0]?.n) >= 6) return { ok: false as const };
    await sql.query(`insert into pad_photos (user_id, page_id, data) values ($1,$2,$3)`, [
      context.userId,
      data.pageId,
      data.data,
    ]);
    return { ok: true as const };
  });

export const deletePadPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`delete from pad_photos where user_id = $1 and id = $2`, [context.userId, data.id]);
    return { ok: true as const };
  });

export const exportScope = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const from = data.from ?? "1970-01-01";
    const to = data.to ?? "2999-12-31";
    const jobs = await sql.query<{
      scheduled_date: unknown;
      name: string;
      phone: string | null;
      title: string | null;
      status: string;
      amount: unknown;
      postpone_reason: string | null;
    }>(
      `select j.scheduled_date, c.name, c.phone, j.title, j.status, j.amount, j.postpone_reason
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
          and j.status <> 'cancelled'
        order by j.scheduled_date asc, c.name asc
        limit 5000`,
      [context.userId, from, to],
    );
    const payments = await sql.query<{
      paid_at: unknown;
      name: string;
      amount: unknown;
      kind: string;
      method: string | null;
      note: string | null;
    }>(
      `select p.paid_at, c.name, p.amount, p.kind, p.method, p.note
         from payments p join clients c on c.id = p.client_id
        where p.user_id = $1 and p.paid_at >= $2::date and p.paid_at < ($3::date + interval '1 day')
        order by p.paid_at asc, c.name asc
        limit 5000`,
      [context.userId, from, to],
    );
    const jobHeader = ["Fecha", "Cliente", "Teléfono", "Trabajo", "Estado", "Monto", "Razón"];
    const jobLines = jobs.map((j) =>
      [
        asIsoDate(j.scheduled_date),
        j.name,
        j.phone ?? "",
        j.title ?? "",
        j.status,
        money(j.amount),
        j.postpone_reason ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    const payHeader = ["Fecha", "Cliente", "Monto", "Tipo", "Medio", "Nota"];
    const payLines = payments.map((p) =>
      [stampDay(asIsoStamp(p.paid_at)), p.name, money(p.amount), p.kind, p.method ?? "", p.note ?? ""]
        .map(csvCell)
        .join(","),
    );
    const csv = ["Trabajos", jobHeader.join(","), ...jobLines, "", "Cobros", payHeader.join(","), ...payLines].join(
      "\n",
    );
    return {
      csv,
      from: data.from ?? null,
      to: data.to ?? null,
      jobs: jobs.map((j) => ({
        date: asIsoDate(j.scheduled_date),
        name: j.name,
        phone: j.phone,
        title: j.title,
        status: j.status,
        amount: money(j.amount),
      })),
      payments: payments.map((p) => ({
        date: stampDay(asIsoStamp(p.paid_at)),
        name: p.name,
        amount: money(p.amount),
        kind: p.kind,
        method: p.method,
      })),
    };
  });

function minutesBetween(a: string | null, b: string | null): number {
  if (!a || !b || !/^\d{2}:\d{2}/.test(a) || !/^\d{2}:\d{2}/.test(b)) return 0;
  const [ah, am] = a.slice(0, 5).split(":").map(Number);
  const [bh, bm] = b.slice(0, 5).split(":").map(Number);
  const delta = bh * 60 + bm - (ah * 60 + am);
  return delta > 0 && delta < 18 * 60 ? delta : 0;
}

async function workPrefs(userId: string) {
  const sql = await getSql();
  const prefs = await sql.query<{ work_start: string | null; work_end: string | null }>(
    `select work_start, work_end from app_settings where user_id = $1`,
    [userId],
  );
  const start = /^\d{2}:\d{2}$/.test(prefs[0]?.work_start ?? "") ? prefs[0]!.work_start! : "08:00";
  const end = /^\d{2}:\d{2}$/.test(prefs[0]?.work_end ?? "") ? prefs[0]!.work_end! : "17:30";
  return { start, end };
}

async function ensureWorkDay(userId: string, date: string) {
  const sql = await getSql();
  const { start, end } = await workPrefs(userId);
  await sql.query(
    `insert into work_days (user_id, work_date, clock_in, clock_out, auto, confirmed)
     values ($1, $2::date, $3, $4, true, false)
     on conflict (user_id, work_date) do nothing`,
    [userId, date, start, end],
  );
}

/** Days older than yesterday stay uncounted until the day after the question. Then the preset hours are assumed. */
async function settleUnconfirmedWork(userId: string, today: string) {
  const sql = await getSql();
  const { start, end } = await workPrefs(userId);
  const yesterday = addDaysISO(today, -1);
  await sql.query(
    `update work_days
        set clock_in = $3, clock_out = $4, confirmed = true, auto = true
      where user_id = $1
        and work_date < $2::date
        and confirmed = false`,
    [userId, yesterday, start, end],
  );
}

async function workFigures(userId: string, today: string) {
  await settleUnconfirmedWork(userId, today);
  await ensureWorkDay(userId, today);
  const sql = await getSql();
  const { year, month } = monthParts(today);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonthISO(year, month);
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const yearStart = `${year}-01-01`;
  const spanFrom = yearStart < monthStart && yearStart < weekStart ? yearStart : monthStart < weekStart ? monthStart : weekStart;
  const to = monthEnd > weekEnd ? monthEnd : weekEnd;
  const rows = await sql.query<{
    work_date: unknown;
    clock_in: string | null;
    clock_out: string | null;
    stopped_reason: string | null;
    confirmed: boolean | null;
  }>(
    `select work_date, clock_in, clock_out, stopped_reason, confirmed from work_days
      where user_id = $1 and work_date >= $2::date and work_date <= $3::date`,
    [userId, spanFrom, to],
  );
  const sum = (start: string, end: string) =>
    rows.reduce((total, row) => {
      const date = asIsoDate(row.work_date);
      if (date < start || date > end || !row.confirmed) return total;
      return total + minutesBetween(row.clock_in, row.clock_out);
    }, 0);
  const stops = new Map<string, number>();
  for (const row of rows) {
    const date = asIsoDate(row.work_date);
    if (!row.stopped_reason || date < yearStart || date > today) continue;
    stops.set(row.stopped_reason, (stops.get(row.stopped_reason) ?? 0) + 1);
  }
  return {
    hoursToday: sum(today, today),
    hoursWeek: sum(weekStart, weekEnd),
    hoursMonth: sum(monthStart, monthEnd),
    stopReasons: [...stops.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

export const getWorkSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const today = todayISO();
    await ensureWorkDay(context.userId, today);
    const sql = await getSql();
    const rows = await sql.query<{
      clock_in: string | null;
      clock_out: string | null;
      stopped_reason: string | null;
      stopped_at: unknown;
      confirmed: boolean | null;
      auto: boolean | null;
    }>(
      `select clock_in, clock_out, stopped_reason, stopped_at, confirmed, auto
         from work_days where user_id = $1 and work_date = $2::date`,
      [context.userId, today],
    );
    const row = rows[0];
    const figures = await workFigures(context.userId, today);
    const yesterday = addDaysISO(today, -1);
    const { start, end } = await workPrefs(context.userId);
    const prior = await sql.query<{ confirmed: boolean | null }>(
      `select confirmed from work_days where user_id = $1 and work_date = $2::date`,
      [context.userId, yesterday],
    );
    return {
      date: today,
      clockIn: row?.clock_in?.slice(0, 5) ?? "08:00",
      clockOut: row?.clock_out?.slice(0, 5) ?? "17:30",
      stoppedReason: row?.stopped_reason ?? null,
      stoppedAt: row?.stopped_at ? asIsoStamp(row.stopped_at) : null,
      confirmed: Boolean(row?.confirmed),
      auto: row?.auto !== false,
      pendingYesterday: prior[0] && !prior[0].confirmed ? { date: yesterday, clockIn: start, clockOut: end } : null,
      ...figures,
    };
  });

export const punchWork = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        kind: z.enum(["in", "out", "preset", "confirm", "unconfirm", "confirm-yesterday", "unconfirm-yesterday"]),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        out: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const today = todayISO();
    await ensureWorkDay(context.userId, today);
    const sql = await getSql();
    if (data.kind === "confirm-yesterday") {
      const yesterday = addDaysISO(today, -1);
      const prefs = await workPrefs(context.userId);
      const start = data.time ?? prefs.start;
      const end = data.out ?? prefs.end;
      await sql.query(
        `update work_days
            set clock_in = $3, clock_out = $4, confirmed = true, auto = $5
          where user_id = $1 and work_date = $2::date and confirmed = false`,
        [context.userId, yesterday, start, end, !(data.time || data.out)],
      );
    } else if (data.kind === "unconfirm-yesterday") {
      const yesterday = addDaysISO(today, -1);
      const prefs = await workPrefs(context.userId);
      const start = data.time ?? prefs.start;
      const end = data.out ?? prefs.end;
      await sql.query(
        `update work_days
            set clock_in = $3, clock_out = $4, confirmed = false, auto = true
          where user_id = $1 and work_date = $2::date`,
        [context.userId, yesterday, start, end],
      );
    } else if (data.kind === "confirm" || data.kind === "unconfirm") {
      await sql.query(`update work_days set confirmed = $3 where user_id = $1 and work_date = $2::date`, [
        context.userId,
        today,
        data.kind === "confirm",
      ]);
    } else if (data.kind === "preset") {
      const prefs = await sql.query<{ work_start: string | null; work_end: string | null }>(
        `select work_start, work_end from app_settings where user_id = $1`,
        [context.userId],
      );
      const start = /^\d{2}:\d{2}$/.test(prefs[0]?.work_start ?? "") ? prefs[0]!.work_start : "08:00";
      const end = /^\d{2}:\d{2}$/.test(prefs[0]?.work_end ?? "") ? prefs[0]!.work_end : "17:30";
      await sql.query(
        `update work_days set clock_in = $3, clock_out = $4, auto = true, confirmed = false
          where user_id = $1 and work_date = $2::date`,
        [context.userId, today, start, end],
      );
    } else if (data.kind === "in") {
      await sql.query(
        `update work_days set clock_in = $3, auto = false where user_id = $1 and work_date = $2::date`,
        [context.userId, today, data.time || nowHHMM()],
      );
    } else {
      await sql.query(
        `update work_days set clock_out = $3, auto = false where user_id = $1 and work_date = $2::date`,
        [context.userId, today, data.time || nowHHMM()],
      );
    }
    return { ok: true as const };
  });

export const linkPadClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ pageId: z.coerce.number().int(), clientId: z.coerce.number().int() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into pad_links (user_id, page_id, client_id)
       select $1, $2, $3
        where exists (select 1 from pad_pages where user_id = $1 and id = $2)
          and exists (select 1 from clients where user_id = $1 and id = $3)
       on conflict (page_id, client_id) do nothing`,
      [context.userId, data.pageId, data.clientId],
    );
    return { ok: true as const };
  });

export const listDueNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: number;
      title: string;
      due_date: unknown;
      due_time: string | null;
      pinned: boolean | null;
    }>(
      `select id, title, due_date, due_time, pinned from pad_pages
        where user_id = $1 and due_date is not null
          and due_date >= $2::date and due_date <= $3::date
        order by pinned desc, due_time asc nulls last, title asc`,
      [context.userId, data.from, data.to],
    );
    return rows.map((row) => ({
      id: intId(row.id),
      title: row.title,
      date: asIsoDate(row.due_date),
      time: row.due_time?.slice(0, 5) ?? null,
      pinned: Boolean(row.pinned),
    }));
  });

export const listPadForClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ clientId: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number; title: string; body: string; pinned: boolean | null; tags: string | null }>(
      `select p.id, p.title, p.body, p.pinned, p.tags
         from pad_links l join pad_pages p on p.id = l.page_id
        where l.user_id = $1 and l.client_id = $2 and p.user_id = $1 and p.deleted_at is null
        order by p.pinned desc, p.updated_at desc`,
      [context.userId, data.clientId],
    );
    return rows.map((row) => ({
      id: intId(row.id),
      title: row.title,
      body: row.body ?? "",
      pinned: Boolean(row.pinned),
      tags: row.tags ?? "",
    }));
  });

export const adjustJobAmount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.coerce.number().int(), amount: z.coerce.number().min(0).max(100000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      amount: unknown;
      status: string;
      client_id: number;
      balance: unknown;
      credit: unknown;
    }>(
      `select j.amount, j.status, j.client_id, c.balance, c.credit
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and j.id = $2`,
      [context.userId, data.id],
    );
    const job = rows[0];
    if (!job) return { ok: false as const };
    const next = money(data.amount);
    const prev = money(job.amount);
    const delta = Math.round((next - prev) * 100) / 100;
    await sql.query(`update jobs set amount = $3 where user_id = $1 and id = $2`, [
      context.userId,
      data.id,
      next,
    ]);
    if (job.status === "done" && delta !== 0) {
      let balance = Math.round((money(job.balance) + delta) * 100) / 100;
      let credit = money(job.credit);
      if (balance < 0) {
        credit = Math.round((credit + Math.abs(balance)) * 100) / 100;
        balance = 0;
      }
      await sql.query(`update clients set balance = $3, credit = $4 where user_id = $1 and id = $2`, [
        context.userId,
        job.client_id,
        balance,
        credit,
      ]);
    }
    return { ok: true as const };
  });

export const clearJobPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`update jobs set photo = null where user_id = $1 and id = $2`, [context.userId, data.id]);
    return { ok: true as const };
  });

export const listPostponed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ reason: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ name: string; scheduled_date: unknown; title: string | null }>(
      `select c.name, j.scheduled_date, j.title
         from jobs j join clients c on c.id = j.client_id
        where j.user_id = $1 and lower(j.postpone_reason) = lower($2)
        order by j.scheduled_date desc
        limit 24`,
      [context.userId, data.reason],
    );
    return rows.map((row) => ({
      clientName: row.name,
      date: asIsoDate(row.scheduled_date),
      title: row.title ?? "",
    }));
  });

function daysInclusive(from: string, to: string) {
  if (to < from) return 0;
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export const getYearRhythm = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        skipRare: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const today = todayISO();
    const start = `${data.year}-01-01`;
    const end = `${data.year}-12-31`;
    const through = today < start ? "" : today > end ? end : today;
    if (!through) {
      return {
        year: data.year,
        worked: 0,
        rest: 0,
        minutes: 0,
        todayMinutes: 0,
        through: start,
        posts: [],
        stops: [],
        offs: [],
        months: Array.from({ length: 12 }, () => 0),
      };
    }
    const prefs = await loadPrefs(context.userId);
    await settleUnconfirmedWork(context.userId, today);
    const rare = new Set(data.skipRare ? prefs.excludedWeekdays : []);
    const sql = await getSql();
    const rows = await sql.query<{
      work_date: unknown;
      clock_in: string | null;
      clock_out: string | null;
    }>(
      `select work_date, clock_in, clock_out from work_days
        where user_id = $1 and work_date >= $2::date and work_date <= $3::date and confirmed`,
      [context.userId, start, through],
    );
    let worked = 0;
    let minutes = 0;
    let todayMinutes = 0;
    const workedDays = new Set<string>();
    for (const row of rows) {
      const iso = asIsoDate(row.work_date);
      const mins = minutesBetween(row.clock_in, row.clock_out);
      if (mins <= 0) continue;
      const usualRest = prefs.excludedWeekdays.includes(weekdayFromISO(iso));
      if (data.skipRare && usualRest) {
        worked += 1;
        minutes += mins;
        workedDays.add(iso);
        if (iso === today) todayMinutes = mins;
        continue;
      }
      worked += 1;
      minutes += mins;
      workedDays.add(iso);
      if (iso === today) todayMinutes = mins;
    }
    const sundayWork = await sql.query<{ d: unknown }>(
      `select distinct scheduled_date as d from jobs
        where user_id = $1
          and status = 'done'
          and scheduled_date >= $2::date and scheduled_date <= $3::date
          and (
            kind in ('one_time', 'extra')
            or origin_date is not null
            or length(trim(coalesce(postpone_reason, ''))) > 0
          )`,
      [context.userId, start, through],
    );
    for (const row of sundayWork) {
      const iso = asIsoDate(row.d);
      if (!prefs.excludedWeekdays.includes(weekdayFromISO(iso))) continue;
      if (workedDays.has(iso)) continue;
      worked += 1;
      workedDays.add(iso);
    }
    const span = daysInclusive(start, through);
    let business = 0;
    for (let i = 0; i < span; i += 1) {
      const iso = addDaysISO(start, i);
      if (!rare.has(weekdayFromISO(iso))) business += 1;
    }
    const rest = Math.max(0, business - worked);
    const posts = await sql.query<{ reason: string; n: unknown }>(
      `select trim(postpone_reason) as reason, count(*) as n
         from jobs
        where user_id = $1
          and origin_date >= $2::date and origin_date <= $3::date
          and scheduled_date <> origin_date
          and length(trim(coalesce(postpone_reason, ''))) > 0
        group by 1
        order by n desc, reason`,
      [context.userId, start, end],
    );
    const stops = await sql.query<{ reason: string; n: unknown }>(
      `select trim(stopped_reason) as reason, count(*) as n
         from work_days
        where user_id = $1
          and work_date >= $2::date and work_date <= $3::date
          and length(trim(coalesce(stopped_reason, ''))) > 0
        group by 1
        order by n desc, reason`,
      [context.userId, start, end],
    );
    const offs = await sql.query<{ reason: string; n: unknown }>(
      `select trim(reason) as reason, count(*) as n
         from day_marks
        where user_id = $1
          and kind = 'off'
          and mark_date >= $2::date and mark_date <= $3::date
          and length(trim(coalesce(reason, ''))) > 0
        group by 1
        order by n desc, reason`,
      [context.userId, start, end],
    );
    const missed = await sql.query<{ d: unknown }>(
      `select distinct d from (
         select origin_date as d from jobs
          where user_id = $1
            and origin_date >= $2::date and origin_date <= $3::date
            and scheduled_date <> origin_date
            and length(trim(coalesce(postpone_reason, ''))) > 0
         union
         select work_date from work_days
          where user_id = $1
            and work_date >= $2::date and work_date <= $3::date
            and length(trim(coalesce(stopped_reason, ''))) > 0
         union
         select mark_date from day_marks
          where user_id = $1 and kind = 'off'
            and mark_date >= $2::date and mark_date <= $3::date
       ) days`,
      [context.userId, start, end],
    );
    const months = Array.from({ length: 12 }, () => 0);
    const skipDays = new Set(prefs.excludedWeekdays);
    for (const row of missed) {
      const iso = asIsoDate(row.d);
      if (!iso.startsWith(String(data.year))) continue;
      if (skipDays.has(weekdayFromISO(iso))) continue;
      const month = Number(iso.slice(5, 7));
      if (month >= 1 && month <= 12) months[month - 1] += 1;
    }
    return {
      year: data.year,
      worked,
      rest,
      minutes,
      todayMinutes,
      through,
      posts: posts.map((row) => ({ reason: row.reason, count: intId(row.n) })),
      stops: stops.map((row) => ({ reason: row.reason, count: intId(row.n) })),
      offs: offs.map((row) => ({ reason: row.reason, count: intId(row.n) })),
      months,
    };
  });

// ---------------------------------------------------------------------------
// Cifras 1.2: read-only figures for the new Cifras sections (this month, trend,
// who owes and since when, best clients, weekday × month rhythm, tips, price).
// Same conventions as getFinanceStats: Cobrado = payments 'paid' + 'prepaid';
// work value = jobs marked done (by scheduled date); tips are apart.

export type CifrasMonth = {
  key: string; // YYYY-MM
  label: string;
  collected: number;
  doneValue: number;
  cuts: number; // done jobs of kind 'cut'
  jobs: number; // all done jobs
  cutValue: number; // value of done 'cut' jobs (for price per cut)
  cutsPriced: number; // done 'cut' jobs with a price above $0 (free cuts don't pull the average price down)
  extraValue: number;
  onceValue: number;
  tips: number;
  tipCount: number;
  partial: boolean; // the month in progress
};

export type CifrasInsights = {
  today: string;
  monthStart: string;
  monthEnd: string;
  dayOfMonth: number;
  daysInMonth: number;
  hasData: boolean;
  firstWorkDate: string | null;
  pulse: {
    collected: number;
    doneValue: number;
    doneCount: number;
    restValue: number;
    restCount: number;
    lateValue: number;
    lateCount: number;
    planned: number;
    tips: number;
    prevCollectedToDate: number;
    prevDoneToDate: number;
    prevCollectedFull: number;
    outstanding: number;
    owingPeople: number;
    rate90: { collected: number; done: number };
  };
  /** Week to date vs last week to the same weekday. cuts = done 'cut' jobs; jobs = every done job. */
  week: { cuts: number; jobs: number; collected: number; prevCuts: number; prevJobs: number; prevCollected: number; through: string };
  /** Collected ÷ confirmed work hours, week to date and month to date. */
  perHour: {
    week: { collected: number; doneValue: number; minutes: number };
    month: { collected: number; doneValue: number; minutes: number };
  };
  /** Baseline: active regular clients × visits a month (from their frequency) × price. */
  baseline: {
    total: number;
    clients: number;
    visits: number;
    collected: number;
    doneValue: number;
    planned: number;
    top: { id: number; name: string; visits: number; price: number; value: number }[];
  };
  /** Month goal from the daily yard goals (Esfuerzo de la semana): a day's own goal, or its weekday's. */
  goal: {
    total: number;
    done: number;
    dueByToday: number;
    workDaysLeft: number;
    perDayLeft: number;
    todayGoal: number;
    todayDone: number;
    hasGoals: boolean;
  };
  months: CifrasMonth[];
  debts: {
    total: number;
    /** "inicial" = owed from before any recorded cut (opening balance): its own bucket, not 90+. */
    buckets: { key: "0-30" | "31-60" | "61-90" | "90+" | "inicial"; amount: number; people: number }[];
    top: { id: number; name: string; balance: number; oldestDays: number | null; opening: number; tier: PayTier; unpaidCuts: number }[];
    waitPeople: number;
    seriousPeople: number;
    currentPeople: number;
    latePayers: number;
  };
  best: {
    total: number;
    clients: { id: number; name: string; active: boolean; value: number; jobs: number; cuts: number; avg: number }[];
    clientCount: number;
  };
  rhythm: {
    cells: { month: string; dow: number; cuts: number; value: number }[];
    weekdays: { dow: number; cuts: number; value: number; days: number }[];
  };
  tips: { year: number; count: number; avg: number; top: { id: number; name: string; total: number; count: number }[] };
  price: { avgCut: number; avgExtra: number; avgOnce: number; nCut: number; nExtra: number; nOnce: number };
};

export const getCifrasInsights = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CifrasInsights> => {
    const sql = await getSql();
    const uid = context.userId;
    const today = todayISO();
    const { year, month } = monthParts(today);
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStart = `${year}-${pad(month)}-01`;
    const monthEnd = lastDayOfMonthISO(year, month);
    const dayOfMonth = Number(today.slice(8, 10));
    const daysInMonth = Number(monthEnd.slice(8, 10));
    const first = addMonths(year, month, -11);
    const from12 = `${first.year}-${pad(first.month)}-01`;
    const prev = addMonths(year, month, -1);
    const prevStart = `${prev.year}-${pad(prev.month)}-01`;
    const prevEnd = lastDayOfMonthISO(prev.year, prev.month);
    const prevCut = addDaysISO(prevStart, dayOfMonth - 1) > prevEnd ? prevEnd : addDaysISO(prevStart, dayOfMonth - 1);
    const from90 = addDaysISO(today, -89);
    const weekStart = startOfWeekISO(today);
    const prevWeekStart = addDaysISO(weekStart, -7);
    const prevWeekCut = addDaysISO(today, -7);

    const paid = async (from: string, to: string) => {
      const r = await sql.query<{ v: unknown }>(
        `select coalesce(sum(amount),0) as v from payments
          where user_id = $1 and kind in ('paid','prepaid')
            and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')`,
        [uid, from, to],
      );
      return money(r[0]?.v);
    };
    const work = async (from: string, to: string, status: string, kind?: string) => {
      const r = await sql.query<{ v: unknown; n: unknown }>(
        `select coalesce(sum(amount),0) as v, count(*) as n from jobs
          where user_id = $1 and status = $4 and scheduled_date >= $2::date and scheduled_date <= $3::date
            ${kind ? "and kind = $5" : ""}`,
        kind ? [uid, from, to, status, kind] : [uid, from, to, status],
      );
      return { value: money(r[0]?.v), count: intId(r[0]?.n) };
    };

    // 12 months of money and work
    const payRows = await sql.query<{ m: string; collected: unknown; tips: unknown; tip_n: unknown }>(
      `select to_char(paid_at, 'YYYY-MM') as m,
              coalesce(sum(amount) filter (where kind in ('paid','prepaid')),0) as collected,
              coalesce(sum(tip),0) as tips,
              count(*) filter (where tip > 0) as tip_n
         from payments
        where user_id = $1 and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')
        group by 1`,
      [uid, from12, monthEnd],
    );
    const jobRows = await sql.query<{ m: string; kind: string; n: unknown; np: unknown; v: unknown }>(
      `select to_char(scheduled_date, 'YYYY-MM') as m, kind, count(*) as n, count(*) filter (where amount > 0) as np,
              coalesce(sum(amount),0) as v
         from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date
        group by 1, 2`,
      [uid, from12, monthEnd],
    );
    const months: CifrasMonth[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const m = addMonths(year, month, -i);
      const key = `${m.year}-${pad(m.month)}`;
      const p = payRows.find((r) => r.m === key);
      const js = jobRows.filter((r) => r.m === key);
      const byKind = (k: string) => js.find((r) => r.kind === k);
      months.push({
        key,
        label: monthLabel(m.year, m.month),
        collected: money(p?.collected),
        doneValue: money(js.reduce((s, r) => s + money(r.v), 0)),
        cuts: intId(byKind("cut")?.n),
        jobs: js.reduce((s, r) => s + intId(r.n), 0),
        cutValue: money(byKind("cut")?.v),
        cutsPriced: intId(byKind("cut")?.np),
        extraValue: money(byKind("extra")?.v),
        onceValue: money(byKind("one_time")?.v),
        tips: money(p?.tips),
        tipCount: intId(p?.tip_n),
        partial: i === 0,
      });
    }

    // This month
    const collected = await paid(monthStart, today);
    const done = await work(monthStart, monthEnd, "done");
    const rest = await work(today, monthEnd, "pending");
    const late = monthStart <= addDaysISO(today, -1) ? await work(monthStart, addDaysISO(today, -1), "pending") : { value: 0, count: 0 };
    const tipsMonth = months[months.length - 1]?.tips ?? 0;
    const prevCollectedToDate = await paid(prevStart, prevCut);
    const prevDoneToDate = (await work(prevStart, prevCut, "done")).value;
    const prevCollectedFull = await paid(prevStart, prevEnd);
    const collected90 = await paid(from90, today);
    const done90 = (await work(from90, today, "done")).value;

    // Week to date vs last week to the same weekday
    const wk = await work(weekStart, today, "done");
    const pwk = await work(prevWeekStart, prevWeekCut, "done");
    const wkCut = await work(weekStart, today, "done", "cut");
    const pwkCut = await work(prevWeekStart, prevWeekCut, "done", "cut");
    const week = {
      cuts: wkCut.count,
      jobs: wk.count,
      collected: await paid(weekStart, today),
      prevCuts: pwkCut.count,
      prevJobs: pwk.count,
      prevCollected: await paid(prevWeekStart, prevWeekCut),
      through: today,
    };

    // Who owes and since when (first in, first out: a balance covers the newest done jobs)
    const owing = await loadClients(uid, today, "owing");
    const owingIds = new Set(owing.map((c) => c.id));
    const debtJobs = owing.length
      ? await sql.query<{ client_id: number; scheduled_date: unknown; amount: unknown }>(
          `select j.client_id, j.scheduled_date, j.amount
             from jobs j join clients c on c.id = j.client_id and c.user_id = j.user_id
            where j.user_id = $1 and j.status = 'done' and c.balance > 0
            order by j.client_id, coalesce(j.completed_at, j.scheduled_date::timestamptz) desc, j.id desc`,
          [uid],
        )
      : [];
    const bucketKey = (days: number): "0-30" | "31-60" | "61-90" | "90+" =>
      days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    const buckets = new Map<string, { amount: number; people: Set<number> }>(
      ["0-30", "31-60", "61-90", "90+", "inicial"].map((k) => [k, { amount: 0, people: new Set<number>() }]),
    );
    const oldest = new Map<number, number | null>();
    const openingLeft = new Map<number, number>();
    for (const c of owing) {
      let left = c.balance;
      let oldestDays: number | null = null;
      for (const j of debtJobs) {
        if (left <= 0.004) break;
        if (intId(j.client_id) !== c.id) continue;
        const take = Math.min(money(j.amount), left);
        if (take <= 0) continue;
        const days = Math.max(0, daysBetween(asIsoDate(j.scheduled_date), today));
        const b = buckets.get(bucketKey(days))!;
        b.amount += take;
        b.people.add(c.id);
        left = Math.round((left - take) * 100) / 100;
        oldestDays = days;
      }
      if (left > 0.004) {
        // Owed from before any recorded cut (opening balance): its own bucket, "Saldo inicial".
        // oldestDays keeps the age of the oldest unpaid cut only; the row says "saldo inicial" apart.
        const b = buckets.get("inicial")!;
        b.amount += left;
        b.people.add(c.id);
        openingLeft.set(c.id, Math.round(left * 100) / 100);
      }
      oldest.set(c.id, oldestDays);
    }
    const unpaid = new Map<number, number>();
    for (const c of owing) {
      let left = c.balance;
      let n = 0;
      for (const j of debtJobs) {
        if (intId(j.client_id) !== c.id || left <= 0.004) continue;
        left -= money(j.amount);
        n += 1;
      }
      unpaid.set(c.id, n);
    }
    const dueRows = await sql.query<{ pay_due_day: number | null; balance: unknown }>(
      `select pay_due_day, balance from clients where user_id = $1 and balance > 0`,
      [uid],
    );
    const waitPeople = owing.filter((c) => c.payTier === "espera").length;
    const seriousPeople = owing.filter((c) => c.payTier === "serio").length;
    const debts = {
      total: Math.round(owing.reduce((s, c) => s + c.balance, 0) * 100) / 100,
      buckets: (["0-30", "31-60", "61-90", "90+", "inicial"] as const).map((key) => ({
        key,
        amount: Math.round((buckets.get(key)?.amount ?? 0) * 100) / 100,
        people: buckets.get(key)?.people.size ?? 0,
      })),
      top: [...owing]
        .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
        .slice(0, 8)
        .map((c) => ({ id: c.id, name: c.name, balance: c.balance, oldestDays: oldest.get(c.id) ?? null, opening: openingLeft.get(c.id) ?? 0, tier: c.payTier, unpaidCuts: unpaid.get(c.id) ?? 0 })),
      waitPeople,
      seriousPeople,
      currentPeople: Math.max(0, owing.length - waitPeople - seriousPeople),
      latePayers: dueRows.filter((c) => isPaymentLate(c.pay_due_day, today, money(c.balance))).length,
    };
    void owingIds;
    const outstandingRows = await sql.query<{ v: unknown; n: unknown }>(
      // Only what people owe: a negative balance (money ahead) must not shrink "Te deben".
      `select coalesce(sum(balance) filter (where balance > 0),0) as v, count(*) filter (where balance > 0) as n from clients where user_id = $1`,
      [uid],
    );

    // Best clients, last 12 months of work value
    const bestRows = await sql.query<{ id: number; name: string; is_active: boolean; jobs: unknown; cuts: unknown; v: unknown }>(
      `select c.id, c.name, c.is_active, count(*) as jobs, count(*) filter (where j.kind = 'cut') as cuts, coalesce(sum(j.amount),0) as v
         from jobs j join clients c on c.id = j.client_id and c.user_id = j.user_id
        where j.user_id = $1 and j.status = 'done' and j.scheduled_date >= $2::date and j.scheduled_date <= $3::date
        group by c.id, c.name, c.is_active
        order by v desc, c.name
        limit 8`,
      [uid, from12, today],
    );
    const bestTotal = await sql.query<{ v: unknown; n: unknown }>(
      `select coalesce(sum(amount),0) as v, count(distinct client_id) as n from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date`,
      [uid, from12, today],
    );

    // Weekday × month rhythm (done jobs)
    const cellRows = await sql.query<{ m: string; dow: unknown; n: unknown; v: unknown }>(
      `select to_char(scheduled_date, 'YYYY-MM') as m, extract(dow from scheduled_date)::int as dow,
              count(*) as n, coalesce(sum(amount),0) as v
         from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date
        group by 1, 2`,
      [uid, from12, today],
    );
    const dayRows = await sql.query<{ dow: unknown; d: unknown }>(
      `select extract(dow from scheduled_date)::int as dow, count(distinct scheduled_date) as d
         from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date <= $3::date
        group by 1`,
      [uid, from12, today],
    );
    const cells = cellRows.map((r) => ({ month: r.m, dow: intId(r.dow), cuts: intId(r.n), value: money(r.v) }));
    const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      dow,
      cuts: cells.filter((c) => c.dow === dow).reduce((s, c) => s + c.cuts, 0),
      value: Math.round(cells.filter((c) => c.dow === dow).reduce((s, c) => s + c.value, 0) * 100) / 100,
      days: intId(dayRows.find((r) => intId(r.dow) === dow)?.d),
    }));

    // Tips (calendar year) and top tippers
    const yearStart = `${year}-01-01`;
    const tipYear = await sql.query<{ t: unknown; n: unknown }>(
      `select coalesce(sum(tip),0) as t, count(*) filter (where tip > 0) as n from payments
        where user_id = $1 and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')`,
      [uid, yearStart, today],
    );
    const tipTop = await sql.query<{ id: number; name: string; t: unknown; n: unknown }>(
      `select c.id, c.name, coalesce(sum(p.tip),0) as t, count(*) as n
         from payments p join clients c on c.id = p.client_id and c.user_id = p.user_id
        where p.user_id = $1 and p.tip > 0 and p.paid_at >= $2::date and p.paid_at < ($3::date + interval '1 day')
        group by c.id, c.name
        order by t desc, c.name
        limit 3`,
      [uid, yearStart, today],
    );

    // Price per job kind, last 12 months
    const priceRows = await sql.query<{ kind: string; n: unknown; a: unknown }>(
      // $0 jobs (a free cut, a courtesy) don't count toward the average price.
      `select kind, count(*) as n, coalesce(avg(amount),0) as a from jobs
        where user_id = $1 and status = 'done' and amount > 0 and scheduled_date >= $2::date and scheduled_date <= $3::date
        group by kind`,
      [uid, from12, today],
    );
    const pk = (k: string) => priceRows.find((r) => r.kind === k);
    const firstRow = await sql.query<{ d: unknown }>(
      `select min(scheduled_date) as d from jobs where user_id = $1 and status = 'done'`,
      [uid],
    );
    const firstWorkDate = firstRow[0]?.d ? asIsoDate(firstRow[0].d) : null;
    const anyPay = await sql.query<{ n: unknown }>(`select count(*) as n from payments where user_id = $1`, [uid]);

    // $ per hour: collected ÷ confirmed work hours. Both run through the last confirmed day
    // (today counts once its hours are confirmed), so money and hours cover the same days.
    const hourRows = await sql.query<{ work_date: unknown; clock_in: string | null; clock_out: string | null; confirmed: boolean | null }>(
      `select work_date, clock_in, clock_out, confirmed from work_days
        where user_id = $1 and work_date >= $2::date and work_date <= $3::date`,
      [uid, weekStart < monthStart ? weekStart : monthStart, today],
    );
    const todayConfirmed = hourRows.some((r) => asIsoDate(r.work_date) === today && r.confirmed);
    const hourEnd = todayConfirmed ? today : addDaysISO(today, -1);
    const minutesIn = (from: string) =>
      hourRows.reduce((t, r) => {
        const d = asIsoDate(r.work_date);
        return d < from || d > hourEnd || !r.confirmed ? t : t + minutesBetween(r.clock_in, r.clock_out);
      }, 0);
    const perSpan = async (from: string) => {
      if (hourEnd < from) return { collected: 0, doneValue: 0, minutes: 0 };
      return {
        collected: await paid(from, hourEnd),
        doneValue: (await work(from, hourEnd, "done")).value,
        minutes: minutesIn(from),
      };
    };
    const perHour = { week: await perSpan(weekStart), month: await perSpan(monthStart) };

    // Baseline: what regular clients bring in a normal month, from their frequency and price.
    const regRows = await sql.query<{ id: number; name: string; price_per_cut: unknown; cuts_per_month: number | null; frequency_days: number | null }>(
      `select id, name, price_per_cut, cuts_per_month, frequency_days from clients
        where user_id = $1 and is_active = true and kind = 'regular'
          and coalesce(blacklisted, false) = false and coalesce(service_paused, false) = false`,
      [uid],
    );
    const regular = regRows.map((r) => {
      const freq = Number(r.frequency_days) || 0;
      const visits = freq > 0 ? Math.round((30.44 / freq) * 10) / 10 : Number(r.cuts_per_month) || 0;
      const price = money(r.price_per_cut);
      return { id: intId(r.id), name: r.name, visits, price, value: Math.round(visits * price * 100) / 100 };
    });
    const baseline = {
      total: Math.round(regular.reduce((t, r) => t + r.value, 0) * 100) / 100,
      clients: regular.length,
      visits: Math.round(regular.reduce((t, r) => t + r.visits, 0) * 10) / 10,
      collected,
      doneValue: done.value,
      planned: Math.round((done.value + rest.value + late.value) * 100) / 100,
      top: [...regular].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5),
    };

    // Month goal from the daily yard goals (the same ones Esfuerzo de la semana sets).
    const goalPrefs = await loadPrefs(uid).catch(() => null);
    const goalOverride = await sql.query<{ goal_date: unknown; goal: number }>(
      `select goal_date, goal from day_goals where user_id = $1 and goal_date >= $2::date and goal_date <= $3::date`,
      [uid, monthStart, monthEnd],
    );
    const offMonth = await sql.query<{ off_date: unknown }>(
      `select off_date from week_off_dates where user_id = $1 and off_date >= $2::date and off_date <= $3::date`,
      [uid, monthStart, monthEnd],
    );
    const goalByDate = new Map(goalOverride.map((r) => [asIsoDate(r.goal_date), Number(r.goal) || 0]));
    const offSet = new Set(offMonth.map((r) => asIsoDate(r.off_date)));
    const excludedDays = new Set<number>((goalPrefs?.excludedWeekdays ?? []) as number[]);
    const onVacation = (d: string) =>
      Boolean(goalPrefs?.vacationStart && goalPrefs.vacationEnd && d >= goalPrefs.vacationStart && d <= goalPrefs.vacationEnd);
    let goalTotal = 0;
    let goalDue = 0;
    let workDaysLeft = 0;
    let todayGoal = 0;
    for (let d = monthStart; d <= monthEnd; d = addDaysISO(d, 1)) {
      const dow = weekdayFromISO(d);
      const g = goalByDate.get(d) || Number(goalPrefs?.weekGoals?.[String(dow)]) || 0;
      if (g <= 0 || offSet.has(d) || excludedDays.has(dow) || onVacation(d)) continue;
      goalTotal += g;
      if (d < today) goalDue += g;
      if (d === today) todayGoal = g;
      if (d >= today) workDaysLeft += 1;
    }
    const doneBeforeToday = (await work(monthStart, addDaysISO(today, -1), "done")).count;
    const todayDoneN = (await work(today, today, "done")).count;
    const goalDone = doneBeforeToday + todayDoneN;
    const goal = {
      total: goalTotal,
      done: goalDone,
      dueByToday: goalDue,
      workDaysLeft,
      // What's left, spread over today and the working days after it (same numbers the sentence shows).
      perDayLeft: workDaysLeft > 0 ? Math.max(0, Math.ceil((goalTotal - goalDone) / workDaysLeft)) : 0,
      todayGoal,
      todayDone: todayDoneN,
      hasGoals: goalTotal > 0,
    };

    const tYear = money(tipYear[0]?.t);
    const nYear = intId(tipYear[0]?.n);

    return {
      today,
      monthStart,
      monthEnd,
      dayOfMonth,
      daysInMonth,
      hasData: Boolean(firstWorkDate) || intId(anyPay[0]?.n) > 0,
      firstWorkDate,
      pulse: {
        collected,
        doneValue: done.value,
        doneCount: done.count,
        restValue: rest.value,
        restCount: rest.count,
        lateValue: late.value,
        lateCount: late.count,
        planned: Math.round((done.value + rest.value + late.value) * 100) / 100,
        tips: tipsMonth,
        prevCollectedToDate,
        prevDoneToDate,
        prevCollectedFull,
        outstanding: money(outstandingRows[0]?.v),
        owingPeople: intId(outstandingRows[0]?.n),
        rate90: { collected: collected90, done: done90 },
      },
      week,
      perHour,
      baseline,
      goal,
      months,
      debts,
      best: {
        total: money(bestTotal[0]?.v),
        clientCount: intId(bestTotal[0]?.n),
        clients: bestRows.map((r) => {
          const jobsN = intId(r.jobs);
          const value = money(r.v);
          return { id: intId(r.id), name: r.name, active: Boolean(r.is_active), value, jobs: jobsN, cuts: intId(r.cuts), avg: jobsN ? Math.round((value / jobsN) * 100) / 100 : 0 };
        }),
      },
      rhythm: { cells, weekdays },
      tips: {
        year: tYear,
        count: nYear,
        avg: nYear ? Math.round((tYear / nYear) * 100) / 100 : 0,
        top: tipTop.map((r) => ({ id: intId(r.id), name: r.name, total: money(r.t), count: intId(r.n) })),
      },
      price: {
        avgCut: Math.round(money(pk("cut")?.a) * 100) / 100,
        avgExtra: Math.round(money(pk("extra")?.a) * 100) / 100,
        avgOnce: Math.round(money(pk("one_time")?.a) * 100) / 100,
        nCut: intId(pk("cut")?.n),
        nExtra: intId(pk("extra")?.n),
        nOnce: intId(pk("one_time")?.n),
      },
    };
  });

// ---------------------------------------------------------------------------
// Estudio · Asesor: a plain-words coach for a solo lawn-service owner.
// Read-only. One client pass (loadClients) + a handful of grouped queries.
// Everything is computed here as numbers and keys; the screen writes the words.

export type AdvisorStatus = "pass" | "warn" | "fail";
export type AdvisorPillarKey = "cobro" | "precios" | "clientes" | "agenda" | "fijo";
export type AdvisorGroupKey = "estrellas" | "fieles" | "riesgo" | "morosos" | "ocasionales";
export type AdvisorActionKind = "collect" | "raise" | "winback" | "fill" | "plans" | "season";
export type AdvisorTip = "thank" | "raise" | "keep" | "call" | "collect" | "plan";
export type AdvisorRiskReason = "gap" | "moves" | "paused" | "stopped";

export type AdvisorPerson = {
  id: number;
  name: string;
  phone: string | null;
  kind: "regular" | "one_time";
  price: number;
  /** What a normal month with this client is worth (visits × price); one-time clients: 0. */
  monthly: number;
  /** Work done for them in the last 12 months. */
  value12: number;
  balance: number;
  /** Days since they last paid (or since the first unpaid cut). */
  payDays: number | null;
  /** Days since the last cut marked done. */
  sinceCut: number | null;
  /** Their usual days between visits. */
  every: number;
  years: number;
  reason: AdvisorRiskReason | null;
  /** Price suggestion (only when they pay well below similar yards). */
  suggested: number | null;
  gainYear: number;
  tip: AdvisorTip;
};

export type AdvisorWeekday = { dow: number; load: number; capacity: number };

export type AdvisorAction = {
  kind: AdvisorActionKind;
  /** $ shown on the card. per: "now" = money to collect once, "year" = a year's worth, "each" = per client that says yes. */
  impact: number;
  per: "now" | "year" | "each";
  /** Ranking weight in $ (comparable across kinds). */
  weight: number;
  people: AdvisorPerson[];
  count: number;
  typical?: number;
  week?: AdvisorWeekday[];
  light?: AdvisorWeekday;
  /** A weekday booked well past its room (move some yards from it). */
  heavy?: AdvisorWeekday;
  avgPrice?: number;
  dropPct?: number;
  winterAvg?: number;
  restAvg?: number;
  months?: { m: number; value: number }[];
  monthsLeft?: number;
};

export type AdvisorPillar = {
  key: AdvisorPillarKey;
  status: AdvisorStatus;
  score: number; // 0–1
  /** The one number the line is about (%, count or $), with a second one where useful. */
  a: number;
  b: number;
  c: number;
};

export type AdvisorReading = {
  today: string;
  hasData: boolean;
  business: string;
  score: number;
  tone: "good" | "warn" | "bad";
  activeClients: number;
  owed: number;
  owedLate: number;
  monthly: number;
  /** True when the daily yard goals are set (the week is measured against them). */
  hasGoals: boolean;
  actions: AdvisorAction[];
  pillars: AdvisorPillar[];
  groups: { key: AdvisorGroupKey; count: number; money: number; people: AdvisorPerson[] }[];
};

export const getAdvisor = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdvisorReading> => {
    const sql = await getSql();
    const uid = context.userId;
    const today = todayISO();
    const from12 = addDaysISO(today, -364);
    const from90 = addDaysISO(today, -89);
    const to28 = addDaysISO(today, 27);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
    const median = (xs: number[]) => {
      const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
      if (!s.length) return 0;
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const clients = await loadClients(uid, today, "all");
    const statRows = await sql.query<{
      client_id: number; done12: unknown; value12: unknown; first_done: unknown; moved90: unknown; cancel90: unknown; done90: unknown;
    }>(
      `select client_id,
              count(*) filter (where status = 'done' and scheduled_date >= $2::date and scheduled_date <= $4::date) as done12,
              coalesce(sum(amount) filter (where status = 'done' and scheduled_date >= $2::date and scheduled_date <= $4::date), 0) as value12,
              min(scheduled_date) filter (where status = 'done') as first_done,
              count(*) filter (where origin_date is not null and origin_date <> scheduled_date and scheduled_date >= $3::date and scheduled_date <= $4::date) as moved90,
              count(*) filter (where status = 'cancelled' and scheduled_date >= $3::date and scheduled_date <= $4::date) as cancel90,
              count(*) filter (where status = 'done' and scheduled_date >= $3::date and scheduled_date <= $4::date) as done90
         from jobs where user_id = $1 group by client_id`,
      [uid, from12, from90, today],
    );
    const stat = new Map(statRows.map((r) => [intId(r.client_id), r]));

    // Money in vs work done (90 days), the average cut price, and work by calendar month (2 years).
    const flowRows = await sql.query<{ paid90: unknown; done90: unknown; avg_cut: unknown }>(
      `select
         (select coalesce(sum(amount),0) from payments where user_id = $1 and kind in ('paid','prepaid')
             and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')) as paid90,
         (select coalesce(sum(amount),0) from jobs where user_id = $1 and status = 'done'
             and scheduled_date >= $2::date and scheduled_date <= $3::date) as done90,
         (select coalesce(avg(amount),0) from jobs where user_id = $1 and status = 'done' and kind = 'cut' and amount > 0
             and scheduled_date >= $4::date and scheduled_date <= $3::date) as avg_cut`,
      [uid, from90, today, from12],
    );
    const paid90 = money(flowRows[0]?.paid90);
    const done90 = money(flowRows[0]?.done90);
    const avgCut = money(flowRows[0]?.avg_cut);
    const thisMonthKey = today.slice(0, 7);
    const from24 = `${Number(today.slice(0, 4)) - 2}${today.slice(4, 7)}-01`;
    const monthRows = await sql.query<{ ym: string; v: unknown }>(
      `select to_char(scheduled_date, 'YYYY-MM') as ym, coalesce(sum(amount),0) as v from jobs
        where user_id = $1 and status = 'done' and scheduled_date >= $2::date and scheduled_date < $3::date
        group by 1 order by 1`,
      [uid, from24, `${thisMonthKey}-01`],
    );
    // The coming 4 weeks, by weekday: how many yards are booked.
    const loadRows = await sql.query<{ dow: unknown; n: unknown }>(
      `select extract(dow from scheduled_date)::int as dow, count(*) as n from jobs
        where user_id = $1 and status = 'pending' and scheduled_date >= $2::date and scheduled_date <= $3::date
        group by 1`,
      [uid, today, to28],
    );
    const settingRows = await sql.query<{ business_name: string | null }>(
      `select business_name from app_settings where user_id = $1`,
      [uid],
    );
    const prefs = await loadPrefs(uid).catch(() => null);
    const business = settingRows[0]?.business_name || DEFAULT_BUSINESS_NAME;

    // ---- one row per client
    const visitsOf = (c: ClientRow) => {
      if (c.kind !== "regular") return 0;
      if (c.frequencyDays && c.frequencyDays > 0) return 30.44 / c.frequencyDays;
      return Number(c.cutsPerMonth) || 0;
    };
    // Similar visits: more than weekly, weekly, every 2–3 weeks, monthly.
    const bucketOf = (v: number) => (v >= 4.8 ? "t" : v >= 3.5 ? "w" : v >= 1.6 ? "b" : "m");
    const regularsActive = clients.filter((c) => c.isActive && c.kind === "regular" && !c.blacklisted);
    const typicalBy = new Map<string, number>();
    for (const b of ["t", "w", "b", "m"]) {
      const prices = regularsActive.filter((c) => !c.servicePaused && bucketOf(visitsOf(c)) === b).map((c) => c.pricePerCut);
      if (prices.filter((p) => p > 0).length >= 3) typicalBy.set(b, median(prices));
    }
    const typicalAll = median(regularsActive.map((c) => c.pricePerCut)) || avgCut;
    const typicalFor = (v: number) => typicalBy.get(bucketOf(v)) ?? typicalAll;

    const people: AdvisorPerson[] = [];
    const lostIds = new Set<number>();
    for (const c of clients) {
      if (c.blacklisted) continue;
      const s = stat.get(c.id);
      const recentlyOff = !c.isActive && c.deactivatedAt != null && daysBetween(stampDay(c.deactivatedAt), today) <= 120;
      if (!c.isActive && !recentlyOff) continue;
      const visits = visitsOf(c);
      const every = visits > 0 ? Math.round(30.44 / visits) : 0;
      const since = c.lastCutDate ? daysBetween(c.lastCutDate, today) : null;
      const first = s?.first_done ? asIsoDate(s.first_done) : null;
      const start = [c.startDate, first, stampDay(c.createdAt)].filter(Boolean).sort()[0] as string;
      const years = Math.max(0, daysBetween(start, today) / 365.25);
      const moved = intId(s?.moved90) + intId(s?.cancel90);
      const done90c = intId(s?.done90);
      let reason: AdvisorRiskReason | null = null;
      if (recentlyOff) reason = "stopped";
      else if (c.kind === "regular" && c.servicePaused) reason = "paused";
      else if (c.kind === "regular" && every > 0 && since != null && since > Math.max(every * 2, every + 14, (c.seasonEvery ?? 0) + 14)) reason = "gap";
      else if (c.kind === "regular" && moved >= 3 && moved >= done90c * 0.3) reason = "moves";
      if (recentlyOff) lostIds.add(c.id);
      const typical = typicalFor(visits);
      const late = c.balance > 0 && c.payTier !== "al_dia";
      let suggested: number | null = null;
      let gainYear = 0;
      if (
        c.isActive && c.kind === "regular" && !c.servicePaused && !late && !reason &&
        c.pricePerCut > 0 && typical > 0 && years >= 1 && c.pricePerCut <= typical * 0.9
      ) {
        // About +15%, to the nearest $5, never past the usual price or +20%, and at least +$5.
        const step = Math.min(Math.round((c.pricePerCut * 1.15) / 5) * 5, typical, Math.round(c.pricePerCut * 1.2));
        suggested = Math.max(c.pricePerCut + 5, step);
        gainYear = Math.round((suggested - c.pricePerCut) * visits * 12);
      }
      people.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        kind: c.kind,
        price: c.pricePerCut,
        monthly: Math.round(visits * c.pricePerCut),
        value12: money(s?.value12),
        balance: c.balance,
        payDays: c.balance > 0 ? c.daysSincePay : null,
        sinceCut: since,
        every,
        years: Math.round(years * 10) / 10,
        reason,
        suggested,
        gainYear,
        tip: "keep",
      });
    }
    const lateIds = new Set(clients.filter((c) => c.balance > 0 && c.payTier !== "al_dia").map((c) => c.id));
    const isLate = (p: AdvisorPerson) => lateIds.has(p.id);

    // ---- groups (a client sits in one: the first that fits)
    const activeRegular = people.filter((p) => p.kind === "regular" && !lostIds.has(p.id));
    const vals = activeRegular.filter((p) => p.value12 > 0).map((p) => p.value12).sort((a, b) => a - b);
    const q75 = vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.75))] : Infinity;
    const groups = new Map<AdvisorGroupKey, AdvisorPerson[]>(
      (["estrellas", "fieles", "riesgo", "morosos", "ocasionales"] as const).map((k) => [k, []]),
    );
    for (const p of people) {
      if (isLate(p)) { p.tip = "collect"; groups.get("morosos")!.push(p); continue; }
      if (p.reason) { p.tip = "call"; groups.get("riesgo")!.push(p); continue; }
      if (p.kind === "one_time") { p.tip = "plan"; groups.get("ocasionales")!.push(p); continue; }
      if (p.value12 >= q75 && p.value12 > 0) { p.tip = p.suggested ? "raise" : "thank"; groups.get("estrellas")!.push(p); continue; }
      p.tip = p.suggested ? "raise" : "keep";
      groups.get("fieles")!.push(p);
    }
    const sortBy: Record<AdvisorGroupKey, (a: AdvisorPerson, b: AdvisorPerson) => number> = {
      morosos: (a, b) => b.balance - a.balance,
      riesgo: (a, b) => b.monthly - a.monthly,
      ocasionales: (a, b) => b.value12 - a.value12,
      estrellas: (a, b) => b.value12 - a.value12,
      fieles: (a, b) => b.gainYear - a.gainYear || b.monthly - a.monthly,
    };
    const groupMoney = (k: AdvisorGroupKey, list: AdvisorPerson[]) =>
      Math.round(list.reduce((t, p) => t + (k === "morosos" ? p.balance : k === "ocasionales" ? p.value12 : p.monthly), 0));
    const groupList = [...groups.entries()].map(([key, list]) => ({
      key,
      count: list.length,
      money: groupMoney(key, list),
      people: [...list].sort((a, b) => sortBy[key](a, b) || a.name.localeCompare(b.name)),
    }));

    // ---- the week: yards booked per weekday vs room for them
    const loads = new Map(loadRows.map((r) => [intId(r.dow), intId(r.n) / 4]));
    const excluded = new Set<number>((prefs?.excludedWeekdays ?? []) as number[]);
    const goals = (prefs?.weekGoals ?? {}) as Record<string, number>;
    const workDays = [1, 2, 3, 4, 5, 6].filter((d) => !excluded.has(d));
    const busiest = Math.max(0, ...workDays.map((d) => loads.get(d) ?? 0));
    const hasGoals = workDays.some((d) => Number(goals[String(d)]) > 0);
    const week: AdvisorWeekday[] = workDays.map((d) => ({
      dow: d,
      load: Math.round((loads.get(d) ?? 0) * 10) / 10,
      capacity: Number(goals[String(d)]) > 0 ? Number(goals[String(d)]) : Math.round(busiest),
    }));
    const weekLoad = week.reduce((t, w) => t + w.load, 0);
    const weekCap = week.reduce((t, w) => t + w.capacity, 0);
    const lightDays = week
      .filter((w) => w.capacity > 0 && w.capacity - w.load >= 3 && w.load <= w.capacity * (hasGoals ? 0.75 : 0.5))
      .sort((a, b) => (b.capacity - b.load) - (a.capacity - a.load));

    // ---- actions
    const actions: AdvisorAction[] = [];
    const morosos = groupList.find((g) => g.key === "morosos")!;
    const owed = r2(clients.reduce((t, c) => t + (c.balance > 0 ? c.balance : 0), 0));
    const owedLate = r2(morosos.people.reduce((t, p) => t + p.balance, 0));
    if (morosos.count > 0 && owedLate >= 20) {
      // Biggest first, nudged up by age (capped at 6 months so an old $50 never beats a fresh $2,000).
      const urgency = (p: AdvisorPerson) => p.balance * (1 + Math.min(180, p.payDays ?? 0) / 90);
      const ranked = [...morosos.people].sort((a, b) => urgency(b) - urgency(a));
      actions.push({ kind: "collect", impact: Math.round(owedLate), per: "now", weight: owedLate * 1.2, people: ranked.slice(0, 8), count: morosos.count });
    }
    const raise = people.filter((p) => p.suggested && !lostIds.has(p.id)).sort((a, b) => b.gainYear - a.gainYear);
    if (raise.length) {
      const gain = raise.reduce((t, p) => t + p.gainYear, 0);
      if (gain >= 60) actions.push({ kind: "raise", impact: gain, per: "year", weight: gain * 1.5, people: raise.slice(0, 8), count: raise.length, typical: Math.round(typicalAll) });
    }
    const risky = groupList.find((g) => g.key === "riesgo")!;
    if (risky.count > 0) {
      const atStake = risky.people.reduce((t, p) => t + p.monthly, 0) * 12;
      if (atStake > 0) actions.push({ kind: "winback", impact: Math.round(atStake), per: "year", weight: atStake * 0.5, people: risky.people.slice(0, 8), count: risky.count });
    }
    if (lightDays.length && avgCut > 0) {
      const light = lightDays[0];
      const room = lightDays.reduce((t, w) => t + (w.capacity - w.load), 0);
      const perYear = Math.round(Math.floor(light.capacity - light.load) * avgCut * 4.33 * 12);
      const heavy = [...week].filter((w) => w.capacity > 0 && w.load > w.capacity * 1.15).sort((a, b) => (b.load - b.capacity) - (a.load - a.capacity))[0];
      actions.push({ kind: "fill", impact: perYear, per: "year", weight: perYear * 0.2, people: [], count: Math.round(room), week, light, heavy, avgPrice: Math.round(avgCut) });
    }
    const occasional = groupList.find((g) => g.key === "ocasionales")!;
    if (occasional.count > 0) {
      const plan = Math.round(typicalBy.get("b") ?? typicalAll);
      const each = Math.round(plan * (30.44 / 14) * 12);
      if (each > 0) actions.push({ kind: "plans", impact: each, per: "each", weight: each * Math.max(1, Math.floor(occasional.count / 3)) * 0.35, people: occasional.people.slice(0, 8), count: occasional.count, typical: plan });
    }
    // Winter (Nov–Feb in Miami): grass grows slower, visits drop.
    const monthVals = monthRows.map((r) => ({ ym: r.ym, m: Number(r.ym.slice(5, 7)), value: money(r.v) })).filter((r) => r.value > 0);
    const isWinter = (m: number) => m === 11 || m === 12 || m === 1 || m === 2;
    const winterVals = monthVals.filter((r) => isWinter(r.m));
    const restVals = monthVals.filter((r) => !isWinter(r.m));
    const monthNow = Number(today.slice(5, 7));
    if (winterVals.length >= 2 && restVals.length >= 3 && (monthNow >= 9 || monthNow <= 1)) {
      const winterAvg = winterVals.reduce((t, r) => t + r.value, 0) / winterVals.length;
      const restAvg = restVals.reduce((t, r) => t + r.value, 0) / restVals.length;
      const drop = restAvg > 0 ? 1 - winterAvg / restAvg : 0;
      const monthsLeft = monthNow >= 9 && monthNow <= 10 ? 4 : monthNow === 11 ? 4 : monthNow === 12 ? 3 : 2;
      if (drop >= 0.12) {
        const lost = Math.round((restAvg - winterAvg) * monthsLeft);
        const byMonth = Array.from({ length: 12 }, (_, i) => {
          const xs = monthVals.filter((r) => r.m === i + 1);
          return { m: i + 1, value: xs.length ? Math.round(xs.reduce((t, r) => t + r.value, 0) / xs.length) : 0 };
        });
        actions.push({ kind: "season", impact: lost, per: "now", weight: lost * 0.6, people: [], count: 0, dropPct: Math.round(drop * 100), winterAvg: Math.round(winterAvg), restAvg: Math.round(restAvg), months: byMonth, monthsLeft });
      }
    }
    actions.sort((a, b) => b.weight - a.weight);

    // ---- five checks
    const activeAll = people.filter((p) => !lostIds.has(p.id));
    const rate = done90 > 0 ? paid90 / done90 : 1;
    const lateShare = activeAll.length ? morosos.count / activeAll.length : 0;
    const cobroScore = clamp01((rate - 0.6) / 0.35) * (1 - Math.min(0.6, lateShare));
    const cobroStatus: AdvisorStatus = rate >= 0.92 && lateShare <= 0.1 ? "pass" : rate >= 0.8 && lateShare <= 0.25 ? "warn" : "fail";
    const eligible = activeRegular.filter((p) => p.years >= 1 && p.price > 0 && !p.reason);
    const under = eligible.filter((p) => p.price <= typicalFor(30.44 / Math.max(1, p.every)) * 0.9).length;
    const underShare = eligible.length ? under / eligible.length : 0;
    const priceStatus: AdvisorStatus = underShare <= 0.1 ? "pass" : underShare <= 0.25 ? "warn" : "fail";
    const leaving = risky.count;
    const leaveShare = activeRegular.length ? leaving / activeRegular.length : 0;
    const newClients = activeRegular.filter((p) => p.years < 120 / 365.25).length;
    const leaveStatus: AdvisorStatus = leaveShare <= 0.06 ? "pass" : leaveShare <= 0.15 ? "warn" : "fail";
    const fill = weekCap > 0 ? weekLoad / weekCap : 0;
    const agendaStatus: AdvisorStatus = weekCap <= 0 ? "warn" : fill >= 0.85 ? "pass" : fill >= 0.6 ? "warn" : "fail";
    const monthly = Math.round(activeRegular.filter((p) => !p.reason).reduce((t, p) => t + p.monthly, 0));
    const full3 = monthVals.filter((r) => r.ym < thisMonthKey).slice(-3);
    const avg3 = full3.length ? full3.reduce((t, r) => t + r.value, 0) / full3.length : 0;
    const fixedRatio = avg3 > 0 ? monthly / avg3 : monthly > 0 ? 1 : 0;
    const topShare = (() => {
      const total = people.reduce((t, p) => t + p.value12, 0);
      const top = Math.max(0, ...people.map((p) => p.value12));
      return total > 0 ? top / total : 0;
    })();
    const fixedStatus: AdvisorStatus = fixedRatio >= 0.75 && topShare <= 0.25 ? "pass" : fixedRatio >= 0.5 ? "warn" : "fail";
    const pillars: AdvisorPillar[] = [
      { key: "cobro", status: cobroStatus, score: cobroScore, a: Math.round(Math.min(rate, 9.99) * 100), b: morosos.count, c: Math.round(owedLate) },
      { key: "precios", status: priceStatus, score: 1 - Math.min(1, underShare * 2.5), a: under, b: eligible.length, c: Math.round(typicalAll) },
      { key: "clientes", status: leaveStatus, score: 1 - Math.min(1, leaveShare * 4), a: leaving, b: activeRegular.length, c: newClients },
      { key: "agenda", status: agendaStatus, score: weekCap > 0 ? clamp01(fill / 0.9) : 0.6, a: Math.round(fill * 100), b: Math.round(weekLoad), c: Math.round(weekCap) },
      { key: "fijo", status: fixedStatus, score: clamp01(fixedRatio / 0.85) * (topShare > 0.25 ? 0.8 : 1), a: monthly, b: Math.round(avg3), c: Math.round(topShare * 100) },
    ];
    const weights: Record<AdvisorPillarKey, number> = { cobro: 0.3, clientes: 0.25, precios: 0.15, agenda: 0.15, fijo: 0.15 };
    const score = Math.round(100 * pillars.reduce((t, p) => t + clamp01(p.score) * weights[p.key], 0));
    const doneAny = statRows.some((r) => intId(r.done12) > 0);
    return {
      today,
      hasData: activeAll.length >= 1 && doneAny,
      business,
      score,
      tone: score >= 75 ? "good" : score >= 50 ? "warn" : "bad",
      activeClients: activeAll.length,
      owed,
      owedLate,
      monthly,
      hasGoals,
      actions: actions.slice(0, 3),
      pillars,
      groups: groupList,
    };
  });

/* ------------------------------------------------------------------ export center (1.4.1)
   Raw data for the export center (Ajustes → Exportar e imprimir). The device builds the PDF,
   the worksheet and the print pages from this one payload, after the person's filters. */

export type ExportRawJob = {
  id: number;
  clientId: number;
  date: string;
  status: JobStatus;
  kind: JobKind;
  title: string | null;
  amount: number;
  completedAt: string | null;
  postponeReason: string | null;
  originDate: string | null;
  arrivalTime: string | null;
  notes: string | null;
  sortOrder: number;
};

export type ExportRawPayment = {
  id: number;
  clientId: number;
  date: string;
  amount: number;
  kind: PaymentKind;
  method: string | null;
  note: string | null;
  tip: number;
};

export type ExportAging = { oldestDays: number | null; opening: number; b0: number; b31: number; b61: number; b91: number; unpaidJobs: number };

export type ExportRaw = {
  today: string;
  from: string;
  to: string;
  aheadTo: string;
  business: string;
  vacation: { start: string | null; end: string | null };
  clients: ClientRow[];
  aging: Record<number, ExportAging>;
  jobs: ExportRawJob[];
  upcoming: ExportRawJob[];
  payments: ExportRawPayment[];
  work: { date: string; clockIn: string | null; clockOut: string | null; minutes: number; stopped: string | null }[];
  dayNotes: { date: string; body: string }[];
  notes: { id: number; title: string; body: string; folder: string; tags: string; pinned: boolean; due: string | null; updated: string }[];
  offDays: { date: string; reason: string; detail: string }[];
  /** Done jobs before `from` (count and value), so "all time" and period figures can be put in context. */
  before: { jobs: number; value: number };
};

export const exportCenterData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ahead: z.coerce.number().int().min(0).max(120).default(14),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ExportRaw> => {
    const uid = context.userId;
    await ensureScheduleForUser(uid).catch(() => undefined);
    const sql = await getSql();
    const today = todayISO();
    const from = data.from;
    const to = data.to;
    const aheadTo = addDaysISO(today, Math.max(0, data.ahead - 1));
    const settings = await sql.query<{ business_name: string | null; vacation_start: unknown; vacation_end: unknown }>(
      `select business_name, vacation_start, vacation_end from app_settings where user_id = $1`,
      [uid],
    );
    const clients = await loadClients(uid, today, "all");
    type JobSel = {
      id: unknown; client_id: unknown; scheduled_date: unknown; status: string; kind: string; title: string | null; amount: unknown;
      completed_at: unknown; postpone_reason: string | null; origin_date: unknown; arrival_time: string | null; notes: string | null; sort_order: unknown;
    };
    const jobCols = `id, client_id, scheduled_date, status, kind, title, amount, completed_at, postpone_reason, origin_date, arrival_time, notes, sort_order`;
    const mapRaw = (r: JobSel): ExportRawJob => ({
      id: intId(r.id),
      clientId: intId(r.client_id),
      date: asIsoDate(r.scheduled_date),
      status: (r.status as JobStatus) ?? "pending",
      kind: (r.kind as JobKind) ?? "cut",
      title: r.title,
      amount: money(r.amount),
      completedAt: r.completed_at ? asIsoStamp(r.completed_at) : null,
      postponeReason: r.postpone_reason,
      originDate: r.origin_date ? asIsoDate(r.origin_date) : null,
      arrivalTime: r.arrival_time,
      notes: r.notes,
      sortOrder: intId(r.sort_order),
    });
    const jobs = await sql.query<JobSel>(
      `select ${jobCols} from jobs
        where user_id = $1 and scheduled_date >= $2::date and scheduled_date <= $3::date
        order by scheduled_date asc, sort_order asc, id asc limit 20000`,
      [uid, from, to],
    );
    const upcoming = await sql.query<JobSel>(
      `select ${jobCols} from jobs
        where user_id = $1 and status = 'pending' and scheduled_date <= $2::date
          and scheduled_date >= ($3::date - interval '60 days')
        order by scheduled_date asc, sort_order asc, id asc limit 3000`,
      [uid, aheadTo, today],
    );
    const payments = await sql.query<{ id: unknown; client_id: unknown; paid_at: unknown; amount: unknown; kind: string; method: string | null; note: string | null; tip: unknown }>(
      `select id, client_id, paid_at, amount, kind, method, note, tip from payments
        where user_id = $1 and paid_at >= $2::date and paid_at < ($3::date + interval '1 day')
        order by paid_at asc, id asc limit 20000`,
      [uid, from, to],
    );
    const work = await sql.query<{ work_date: unknown; clock_in: string | null; clock_out: string | null; stopped_reason: string | null }>(
      `select work_date, clock_in, clock_out, stopped_reason from work_days
        where user_id = $1 and work_date >= $2::date and work_date <= $3::date and work_date <= $4::date
        order by work_date asc`,
      [uid, from, to, today],
    );
    const dayNotes = await sql.query<{ note_date: unknown; body: string }>(
      `select note_date, body from day_notes
        where user_id = $1 and note_date >= $2::date and note_date <= $3::date and length(trim(body)) > 0
        order by note_date asc`,
      [uid, from, to],
    );
    const notes = await sql.query<{ id: unknown; title: string; body: string; folder: string | null; tags: string | null; pinned: boolean | null; due_date: unknown; updated_at: unknown }>(
      `select id, title, body, folder, tags, pinned, due_date, updated_at from pad_pages
        where user_id = $1 and deleted_at is null
        order by pinned desc, updated_at desc limit 400`,
      [uid],
    );
    const offDays = await sql.query<{ mark_date: unknown; reason: string; detail: string }>(
      `select mark_date, reason, detail from day_marks
        where user_id = $1 and kind = 'off' and mark_date >= $2::date and mark_date <= $3::date
        order by mark_date asc`,
      [uid, from, to],
    );
    const before = await sql.query<{ n: unknown; v: unknown }>(
      `select count(*) as n, coalesce(sum(amount), 0) as v from jobs
        where user_id = $1 and status = 'done' and scheduled_date < $2::date`,
      [uid, from],
    );
    // Who owes, and since when: the balance is laid on their newest done jobs first
    // (the same reading the Estudio uses). What is left is the opening balance.
    const owing = clients.filter((c) => c.balance > 0);
    const aging: Record<number, ExportAging> = {};
    if (owing.length) {
      const debtJobs = await sql.query<{ client_id: unknown; scheduled_date: unknown; amount: unknown }>(
        `select j.client_id, j.scheduled_date, j.amount
           from jobs j join clients c on c.id = j.client_id and c.user_id = j.user_id
          where j.user_id = $1 and j.status = 'done' and c.balance > 0
          order by j.client_id, coalesce(j.completed_at, j.scheduled_date::timestamptz) desc, j.id desc`,
        [uid],
      );
      const byClient = new Map<number, { date: string; amount: number }[]>();
      for (const j of debtJobs) {
        const id = intId(j.client_id);
        const list = byClient.get(id) ?? [];
        list.push({ date: asIsoDate(j.scheduled_date), amount: money(j.amount) });
        byClient.set(id, list);
      }
      for (const c of owing) {
        const row: ExportAging = { oldestDays: null, opening: 0, b0: 0, b31: 0, b61: 0, b91: 0, unpaidJobs: 0 };
        let left = c.balance;
        for (const j of byClient.get(c.id) ?? []) {
          if (left <= 0.004) break;
          const take = Math.min(j.amount, left);
          if (take <= 0) continue;
          const days = Math.max(0, daysBetween(j.date, today));
          if (days <= 30) row.b0 += take;
          else if (days <= 60) row.b31 += take;
          else if (days <= 90) row.b61 += take;
          else row.b91 += take;
          left = Math.round((left - take) * 100) / 100;
          row.oldestDays = days;
          row.unpaidJobs += 1;
        }
        if (left > 0.004) row.opening = Math.round(left * 100) / 100;
        for (const k of ["b0", "b31", "b61", "b91"] as const) row[k] = Math.round(row[k] * 100) / 100;
        aging[c.id] = row;
      }
    }
    const vs = settings[0]?.vacation_start ? asIsoDate(settings[0].vacation_start) : null;
    const ve = settings[0]?.vacation_end ? asIsoDate(settings[0].vacation_end) : null;
    return {
      today,
      from,
      to,
      aheadTo,
      business: settings[0]?.business_name?.trim() || DEFAULT_BUSINESS_NAME,
      vacation: { start: vs, end: ve },
      clients,
      aging,
      jobs: jobs.map(mapRaw),
      upcoming: upcoming.map(mapRaw),
      payments: payments.map((p) => ({
        id: intId(p.id),
        clientId: intId(p.client_id),
        date: stampDay(asIsoStamp(p.paid_at)),
        amount: money(p.amount),
        kind: (p.kind as PaymentKind) ?? "paid",
        method: p.method,
        note: p.note,
        tip: money(p.tip),
      })),
      work: work.map((w) => ({
        date: asIsoDate(w.work_date),
        clockIn: w.clock_in ? w.clock_in.slice(0, 5) : null,
        clockOut: w.clock_out ? w.clock_out.slice(0, 5) : null,
        minutes: minutesBetween(w.clock_in, w.clock_out),
        stopped: w.stopped_reason?.trim() || null,
      })),
      dayNotes: dayNotes.map((d) => ({ date: asIsoDate(d.note_date), body: d.body })),
      notes: notes.map((n) => ({
        id: intId(n.id),
        title: n.title || "Nota",
        body: n.body ?? "",
        folder: n.folder ?? "",
        tags: n.tags ?? "",
        pinned: Boolean(n.pinned),
        due: n.due_date ? asIsoDate(n.due_date) : null,
        updated: n.updated_at ? asIsoStamp(n.updated_at) : "",
      })),
      offDays: offDays.map((o) => ({ date: asIsoDate(o.mark_date), reason: o.reason, detail: o.detail ?? "" })),
      before: { jobs: intId(before[0]?.n), value: money(before[0]?.v) },
    };
  });
