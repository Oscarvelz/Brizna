// Sample data ("Datos de ejemplo"): a realistic Miami lawn business made on this device with the
// app's own job/payment logic, so every tag (Hecho:paid|owe|abono, Adelanto) and total matches what
// real taps would make. Every sample client carries contact_id = 'brizna-sample' (a column nothing
// else uses); the first one also carries a registry of the date rows it added (work hours, day
// notes, week goals), so removal deletes exactly the sample and never anything added by hand.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addDaysISO, todayISO, weekdayFromISO, APP_TZ } from "@/lib/dates";
import {
  ensureScheduleForUserInner,
  logClientChange,
  markJobDone,
  snapshotBackup,
} from "@/lib/server/lawn";

export const SAMPLE_MARK = "brizna-sample";
const REG_PREFIX = `${SAMPLE_MARK}:`;

type Registry = {
  v: 1;
  at: string;
  work: [string, string, string][]; // date, clock_in, clock_out
  notes: [string, string][]; // date, body
  weekGoals: string | null; // the value set, only when there was none
};

type Freq = "w" | "b" | "m";
type Settle = "paid" | "owe" | "abono";
type Plan = { settle: Settle; method?: string; tip?: number; abono?: number; skip?: boolean; pending?: boolean };

type Spec = {
  name: string;
  phone: string;
  street: string;
  price: number;
  freq: Freq;
  /** Days from today to one of its visits (0 = today). */
  off: number;
  arrival?: string;
  notes: [string, string];
  cue?: [string, string];
  sameDay?: boolean;
  dueDay?: "late" | number;
  opening?: number;
  paused?: boolean;
  /** Visit plan, oldest first for past visits; the last entry applies to every other visit. */
  plan: (i: number, n: number, iso: string, today: string) => Plan;
  today?: "paid" | "owe" | "pending";
  extra?: { title: [string, string]; amount: number; daysAgo: number; method: string };
  prepay?: { amount: number; daysAgo: number; method: string };
  laterPays?: { daysAgo: number; method: string; all?: boolean }[];
  forgiveDaysAgo?: number;
};

const CARD = (en: boolean) => (en ? "otro:Card" : "otro:Tarjeta");

function specs(_en: boolean): Spec[] {
  return [
    {
      name: "María González", phone: "(305) 555-0142", street: "11231 SW 152nd St, Miami, FL 33176",
      price: 45, freq: "w", off: 0, arrival: "08:30", sameDay: true,
      notes: ["Paga en efectivo al terminar. Perro amistoso (Toby).", "Pays cash when done. Friendly dog (Toby)."],
      cue: ["Portón azul", "Blue gate"],
      plan: (i) => ({ settle: "paid", method: "efectivo", tip: i % 3 === 1 ? 5 : 0 }),
      today: "paid",
    },
    {
      name: "Robert Miller", phone: "(786) 555-0187", street: "15420 SW 107th Ave, Miami, FL 33157",
      price: 60, freq: "w", off: 0, arrival: "10:30",
      notes: ["Paga por Zelle cada dos semanas.", "Pays by Zelle every two weeks."],
      plan: () => ({ settle: "owe" }),
      laterPays: [{ daysAgo: 43, method: "zelle" }, { daysAgo: 29, method: "zelle" }, { daysAgo: 15, method: "zelle" }, { daysAgo: 1, method: "zelle" }],
      today: "pending",
    },
    {
      name: "Carmen Rodríguez", phone: "(305) 555-0119", street: "9840 SW 162nd Terrace, Miami, FL 33157",
      price: 55, freq: "b", off: 0, arrival: "12:00",
      notes: ["Cortar también la franja de la acera.", "Also cut the strip by the sidewalk."],
      plan: (i) => ({ settle: "paid", method: "zelle", tip: i === 1 ? 10 : 0 }),
      today: "pending",
    },
    {
      name: "Kevin Brown", phone: "(786) 555-0163", street: "10521 SW 148th St, Miami, FL 33176",
      price: 50, freq: "w", off: 0, arrival: "09:30",
      notes: ["Cerca del parque. Dejar las ramas en la esquina.", "Near the park. Leave branches at the corner."],
      plan: () => ({ settle: "paid", method: "efectivo" }),
      today: "owe",
    },
    {
      name: "Luis Hernández", phone: "(305) 555-0175", street: "16115 SW 99th Ct, Miami, FL 33157",
      price: 40, freq: "w", off: -1, dueDay: "late",
      notes: ["Paga a fin de mes. Recordarle con un mensaje.", "Pays at month end. Remind him by text."],
      plan: (i, n) => (i === n - 1 ? { settle: "owe", pending: true } : { settle: "owe" }),
      laterPays: [{ daysAgo: 30, method: "efectivo", all: true }],
    },
    {
      name: "Jennifer Thompson", phone: "(786) 555-0128", street: "8901 SW 136th St, Miami, FL 33176",
      price: 85, freq: "b", off: -2,
      notes: ["Pagó por adelantado. Patio grande con piscina.", "Paid ahead. Big yard with a pool."],
      plan: (i) => (i < 2 ? { settle: "paid", method: "cheque" } : { settle: "owe" }),
      prepay: { amount: 255, daysAgo: 27, method: "cheque" },
    },
    {
      name: "José Martínez", phone: "(305) 555-0156", street: "14720 SW 112th Ave, Miami, FL 33176",
      price: 50, freq: "w", off: 1, opening: 120,
      notes: ["Debía del año pasado. Va abonando cada corte.", "Owed from last year. Pays a bit each cut."],
      plan: () => ({ settle: "abono", method: "efectivo", abono: 60 }),
    },
    {
      name: "Patricia Díaz", phone: "(786) 555-0134", street: "12650 SW 82nd Ave, Pinecrest, FL 33156",
      price: 120, freq: "m", off: -10, arrival: "08:00",
      notes: ["Casa de esquina, patio enorme. Podar setos cada mes.", "Corner house, huge yard. Trim hedges every month."],
      plan: () => ({ settle: "paid", method: "card" }),
      extra: { title: ["Podar setos", "Hedge trimming"], amount: 40, daysAgo: 10, method: "card" },
    },
    {
      name: "Michael Johnson", phone: "(305) 555-0191", street: "15901 SW 117th Pl, Miami, FL 33177",
      price: 70, freq: "b", off: 2,
      notes: ["No contesta mucho. Dejar nota en la puerta.", "Rarely answers. Leave a note on the door."],
      plan: (i) => (i < 2 ? { settle: "owe" } : { settle: "paid", method: "zelle" }),
    },
    {
      name: "Ana Morales", phone: "(786) 555-0112", street: "10240 SW 154th Terrace, Miami, FL 33157",
      price: 35, freq: "w", off: -3, sameDay: true,
      notes: ["Patio chico. Siempre deja propina.", "Small yard. Always tips."],
      plan: () => ({ settle: "paid", method: "efectivo", tip: 5 }),
    },
    {
      name: "David Pérez", phone: "(305) 555-0148", street: "13305 SW 104th Ct, Miami, FL 33176",
      price: 65, freq: "b", off: -1, paused: true,
      notes: ["De viaje hasta diciembre. Servicio en pausa.", "Traveling until December. Service paused."],
      plan: () => ({ settle: "paid", method: "zelle" }),
    },
    {
      name: "Sofía Castillo", phone: "(786) 555-0179", street: "9415 SW 158th St, Miami, FL 33157",
      price: 65, freq: "b", off: 3,
      notes: ["Le perdoné un corte por la cerca rota.", "Forgave one cut over the broken fence."],
      plan: (i, n) => (i === n - 2 ? { settle: "owe" } : { settle: "paid", method: "zelle" }),
      forgiveDaysAgo: 2,
    },
    {
      name: "Isabel Ramírez", phone: "(305) 555-0137", street: "11780 SW 168th St, Miami, FL 33177",
      price: 95, freq: "m", off: 6,
      notes: ["Pagó dos meses adelantados.", "Paid two months ahead."],
      plan: () => ({ settle: "paid", method: "efectivo" }),
      prepay: { amount: 190, daysAgo: 5, method: "efectivo" },
    },
    {
      name: "Thomas Wilson", phone: "(786) 555-0105", street: "16540 SW 92nd Ave, Miami, FL 33157",
      price: 75, freq: "b", off: 4, dueDay: 15,
      notes: ["Quiere los bordes bien marcados. Paga con cheque.", "Wants sharp edges. Pays by check."],
      plan: () => ({ settle: "paid", method: "cheque" }),
    },
  ];
}

const INTERVAL: Record<Freq, number> = { w: 7, b: 14, m: 0 };
const CUTS: Record<Freq, number> = { w: 4, b: 2, m: 1 };

/** The UTC instant of a wall-clock time on the app's clock (America/New_York). */
function stamp(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let guess = want + 5 * 3600_000;
  const f = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let k = 0; k < 2; k += 1) {
    const p = Object.fromEntries(f.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const seen = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    guess += want - seen;
  }
  return new Date(guess).toISOString();
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function method(raw: string | undefined, en: boolean): string {
  if (!raw) return "";
  return raw === "card" ? CARD(en) : raw;
}

/** Past visit dates (oldest first) inside the last `days` days, and the start date that makes the schedule continue. */
function visits(freq: Freq, offIn: number, today: string, days = 56): { past: string[]; start: string } {
  const past: string[] = [];
  // Lawn days are Monday to Saturday: a visit that would land on a Sunday moves one day out.
  let off = offIn;
  if (off !== 0 && weekdayFromISO(addDaysISO(today, off)) === 0) off += off > 0 ? 1 : -1;
  if (freq === "m") {
    // Same day of month, going back two months from the visit near today.
    const near = addDaysISO(today, off);
    const day = Number(near.slice(8, 10));
    const [y, m] = near.split("-").map(Number);
    for (let back = 3; back >= 0; back -= 1) {
      const dt = new Date(Date.UTC(y, m - 1 - back, 1));
      const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
      if (iso < today && iso >= addDaysISO(today, -days)) past.push(iso);
    }
    return { past, start: past[0] ?? near };
  }
  const step = INTERVAL[freq];
  let d = addDaysISO(today, off);
  while (d >= today) d = addDaysISO(d, -step);
  const list: string[] = [];
  while (d >= addDaysISO(today, -days)) { list.push(d); d = addDaysISO(d, -step); }
  list.reverse();
  return { past: list, start: list[0] ?? addDaysISO(today, off) };
}

async function sampleClients(userId: string) {
  const sql = await getSql();
  return sql.query<{ id: number; contact_id: string }>(
    `select id, contact_id from clients where user_id = $1 and contact_id like $2 order by id`,
    [userId, `${SAMPLE_MARK}%`],
  );
}

export const getSampleState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ sample: number; total: number }>(
      `select count(*) filter (where contact_id like $2) as sample, count(*) as total from clients where user_id = $1`,
      [context.userId, `${SAMPLE_MARK}%`],
    );
    const sample = Number(rows[0]?.sample ?? 0);
    const total = Number(rows[0]?.total ?? 0);
    return { loaded: sample > 0, sample, real: total - sample };
  });

export const loadSample = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ locale: z.enum(["es", "en"]).optional().default("es") }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const en = data.locale === "en";
    const sql = await getSql();
    if ((await sampleClients(userId)).length > 0) return { ok: false as const, already: true as const, clients: 0 };
    await snapshotBackup(userId, true).catch(() => undefined);
    const today = todayISO();
    const reg: Registry = { v: 1, at: new Date().toISOString(), work: [], notes: [], weekGoals: null };
    const title = en ? "Lawn cut" : "Corte de césped";
    // day -> minutes of work (for the hours log)
    const dayJobs = new Map<string, number>();
    const doneAt = (date: string) => {
      const n = dayJobs.get(date) ?? 0;
      dayJobs.set(date, n + 1);
      return stamp(date, hhmm(8 * 60 + 35 + n * 52 + (n % 2) * 9));
    };
    const lastPayId = async () => Number((await sql.query<{ m: number }>(`select coalesce(max(id),0) as m from payments`))[0]?.m ?? 0);

    // Rain: the most recent weekday 6-12 days ago stopped early; its visits moved to the next day.
    let rainDay = "";
    const list = specs(en);
    const firstIds: number[] = [];
    for (let s = 0; s < list.length; s += 1) {
      const c = list[s]!;
      const { past, start } = visits(c.freq, c.off, today);
      const dueDay =
        c.dueDay === "late" ? Math.max(1, Number(today.slice(8, 10)) - 2) : typeof c.dueDay === "number" ? c.dueDay : null;
      const ins = await sql.query<{ id: number }>(
        `insert into clients
           (user_id, name, phone, address, notes, kind, price_per_cut, cuts_per_month, weekday, start_date,
            arrival_time, pay_same_day, pay_due_day, cue, contact_id, created_at, sort_order)
         values ($1,$2,$3,$4,$5,'regular',$6,$7,$8,$9::date,$10,$11,$12,$13,$14,$15,$16) returning id`,
        [
          userId, c.name, c.phone, c.street, en ? c.notes[1] : c.notes[0], c.price, CUTS[c.freq],
          weekdayFromISO(start), start, c.arrival ?? null, Boolean(c.sameDay), c.sameDay ? null : dueDay,
          c.cue ? (en ? c.cue[1] : c.cue[0]) : null, SAMPLE_MARK, stamp(addDaysISO(start, -3), "19:10"), s,
        ],
      );
      const id = Number(ins[0]!.id);
      firstIds.push(id);
      if (c.opening) {
        await sql.query(`update clients set balance = $3 where user_id = $1 and id = $2`, [userId, id, c.opening]);
        await sql.query(
          `insert into payments (user_id, client_id, amount, kind, note, paid_at) values ($1,$2,$3,'opening',$4,$5)`,
          [userId, id, c.opening, en ? "Earlier debt" : "Deuda anterior", stamp(addDaysISO(start, -3), "19:10")],
        );
      }
      if (c.prepay && c.prepay.daysAgo > 0) {
        // Paid ahead before the visits it covers.
        const when = addDaysISO(today, -c.prepay.daysAgo);
        await sql.query(
          `insert into payments (user_id, client_id, amount, kind, note, method, paid_at) values ($1,$2,$3,'prepaid',$4,$5,$6)`,
          [userId, id, c.prepay.amount, en ? "Paid ahead" : "Pago por adelantado", method(c.prepay.method, en), stamp(when, "17:45")],
        );
        await sql.query(`update clients set credit = credit + $3 where user_id = $1 and id = $2`, [userId, id, c.prepay.amount]);
      }
      const pays = [...(c.laterPays ?? [])];
      for (let i = 0; i < past.length; i += 1) {
        let date = past[i]!;
        // Paused client: no visits in the last three weeks.
        if (c.paused && date > addDaysISO(today, -21)) continue;
        // Pay the owed visits before this one, when a payment day comes.
        while (pays.length && addDaysISO(today, -pays[0]!.daysAgo) < date) {
          const p = pays.shift()!;
          await payDebt(userId, id, method(p.method, en), stamp(addDaysISO(today, -p.daysAgo), "18:20"), en);
        }
        const plan = c.plan(i, past.length, date, today);
        let moved = false;
        if (!rainDay && date <= addDaysISO(today, -6) && date >= addDaysISO(today, -12) && weekdayFromISO(date) !== 0 && weekdayFromISO(date) !== 6) {
          rainDay = date;
        }
        if (rainDay && date === rainDay) moved = true;
        const origin = date;
        if (moved) date = addDaysISO(date, 1);
        const job = await sql.query<{ id: number }>(
          `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount, arrival_time, created_at, origin_date, postpone_reason)
           values ($1,$2,$3::date,'pending','cut',$4,$5,$6,$7,$8::date,$9) returning id`,
          [userId, id, date, title, c.price, c.arrival ?? null, stamp(addDaysISO(origin, -7), "07:00"),
            moved ? origin : null, moved ? (en ? "Rain" : "Lluvia") : null],
        );
        const jobId = Number(job[0]!.id);
        if (plan.pending) continue; // missed visit: stays late
        const before = await lastPayId();
        await markJobDone(userId, jobId, plan.settle, plan.abono ?? 0, method(plan.method, en), "", plan.tip ?? 0);
        const at = doneAt(date);
        await sql.query(`update jobs set completed_at = $3 where user_id = $1 and id = $2`, [userId, jobId, at]);
        await sql.query(`update payments set paid_at = $3 where user_id = $1 and client_id = $2 and id > $4`, [userId, id, at, before]);
      }
      while (pays.length) {
        const p = pays.shift()!;
        if (addDaysISO(today, -p.daysAgo) >= today) break;
        await payDebt(userId, id, method(p.method, en), stamp(addDaysISO(today, -p.daysAgo), "18:20"), en);
      }
      if (c.extra) {
        const when = addDaysISO(today, -c.extra.daysAgo);
        const job = await sql.query<{ id: number }>(
          `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount, created_at)
           values ($1,$2,$3::date,'pending','extra',$4,$5,$6) returning id`,
          [userId, id, when, en ? c.extra.title[1] : c.extra.title[0], c.extra.amount, stamp(when, "07:00")],
        );
        const jobId = Number(job[0]!.id);
        const before = await lastPayId();
        await markJobDone(userId, jobId, "paid", 0, method(c.extra.method, en));
        const at = doneAt(when);
        await sql.query(`update jobs set completed_at = $3 where user_id = $1 and id = $2`, [userId, jobId, at]);
        await sql.query(`update payments set paid_at = $3 where user_id = $1 and client_id = $2 and id > $4`, [userId, id, at, before]);
      }
      if (c.forgiveDaysAgo) {
        const bal = await sql.query<{ balance: unknown }>(`select balance from clients where user_id = $1 and id = $2`, [userId, id]);
        const owed = Number(bal[0]?.balance ?? 0);
        if (owed > 0) {
          await sql.query(
            `insert into payments (user_id, client_id, amount, kind, note, paid_at) values ($1,$2,$3,'waived',$4,$5)`,
            [userId, id, owed, en ? "Broken fence" : "Cerca rota", stamp(addDaysISO(today, -c.forgiveDaysAgo), "16:30")],
          );
          await sql.query(`update clients set balance = 0 where user_id = $1 and id = $2`, [userId, id]);
        }
      }
      if (c.paused) await sql.query(`update clients set service_paused = true where user_id = $1 and id = $2`, [userId, id]);
      if (s === 2) {
        // A price change in its history.
        await logClientChange(userId, id, en ? "Price $50 → $55" : "Precio $50 → $55", {
          name: c.name, phone: c.phone, address: c.street, pricePerCut: c.price, cutsPerMonth: CUTS[c.freq],
          weekday: weekdayFromISO(start), startDate: start, paySameDay: false, payDueDay: null, kind: "regular",
        });
        await sql.query(`update client_changes set created_at = $3 where user_id = $1 and client_id = $2`, [userId, id, stamp(addDaysISO(today, -20), "20:05")]);
      }
    }

    // Upcoming schedule (and today's visits) from the app's own planner.
    await ensureScheduleForUserInner(userId);

    // Today: some done, some still to do.
    for (let s = 0; s < list.length; s += 1) {
      const c = list[s]!;
      if (!c.today || c.today === "pending") continue;
      const job = await sql.query<{ id: number }>(
        `select id from jobs where user_id = $1 and client_id = $2 and scheduled_date = $3::date and kind = 'cut' and status = 'pending'`,
        [userId, firstIds[s], today],
      );
      if (job[0]) await markJobDone(userId, Number(job[0].id), c.today, 0, c.today === "paid" ? "efectivo" : "");
    }

    // One job planned for a sample client on a later date, beyond the regular cuts.
    const thomas = firstIds[list.length - 1]!;
    await sql.query(
      `insert into jobs (user_id, client_id, scheduled_date, status, kind, title, amount, arrival_time)
       values ($1,$2,$3::date,'pending','extra',$4,90,'14:00')`,
      [userId, thomas, addDaysISO(today, 4), en ? "Mulch for the flower beds" : "Mulch en los canteros"],
    );

    // Work hours: confirmed on the past days with visits; the rain day stopped early.
    const existing = await sql.query<{ work_date: string }>(`select work_date::text as work_date from work_days where user_id = $1`, [userId]);
    const taken = new Set(existing.map((r) => String(r.work_date).slice(0, 10)));
    const days = [...dayJobs.keys(), ...(rainDay ? [rainDay] : [])].filter((d) => d < today).sort();
    for (const d of [...new Set(days)]) {
      if (taken.has(d)) continue;
      const n = dayJobs.get(d) ?? 0;
      const isRain = d === rainDay;
      const inAt = hhmm(7 * 60 + 50 + (weekdayFromISO(d) % 3) * 10);
      const outAt = isRain ? "11:20" : hhmm(Math.min(17 * 60 + 40, 8 * 60 + 35 + n * 52 + 45 + (weekdayFromISO(d) % 2) * 15));
      await sql.query(
        `insert into work_days (user_id, work_date, clock_in, clock_out, stopped_reason, stopped_at, confirmed, auto)
         values ($1,$2::date,$3,$4,$5,$6,true,false) on conflict (user_id, work_date) do nothing`,
        [userId, d, inAt, outAt, isRain ? (en ? "Rain" : "Lluvia") : null, isRain ? stamp(d, "11:20") : null],
      );
      reg.work.push([d, inAt, outAt]);
    }

    // Day notes: today and the rain day (only where there is none).
    const notes: [string, string][] = [[today, en ? "Buy trimmer line and gas." : "Comprar hilo para la bordeadora y gasolina."]];
    if (rainDay) notes.push([rainDay, en ? "Heavy rain at 11. Moved the rest to tomorrow." : "Llovió fuerte a las 11. Pasé el resto a mañana."]);
    for (const [d, body] of notes) {
      const r = await sql.query(
        `insert into day_notes (user_id, note_date, body) values ($1,$2::date,$3) on conflict (user_id, note_date) do nothing returning note_date`,
        [userId, d, body],
      );
      if (r.length) reg.notes.push([d, body]);
    }

    // Week goals (cuts per weekday), only when none are set.
    await sql.query(`insert into app_settings (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
    const wg = await sql.query<{ week_goals: string | null }>(`select week_goals from app_settings where user_id = $1`, [userId]);
    if (!wg[0]?.week_goals) {
      // A goal per weekday: the cuts planned for the coming week (at least one on Monday to Saturday).
      const week = await sql.query<{ d: string }>(
        `select scheduled_date::text as d from jobs where user_id = $1 and status <> 'cancelled'
            and scheduled_date >= $2::date and scheduled_date < ($2::date + 7)`,
        [userId, today],
      );
      const count: Record<number, number> = {};
      for (const r of week) {
        const w = weekdayFromISO(String(r.d).slice(0, 10));
        count[w] = (count[w] ?? 0) + 1;
      }
      const goalMap: Record<string, number> = {};
      for (let w = 1; w <= 6; w += 1) goalMap[String(w)] = Math.max(1, count[w] ?? 0);
      const goals = JSON.stringify(goalMap);
      await sql.query(`update app_settings set week_goals = $2 where user_id = $1`, [userId, goals]);
      reg.weekGoals = goals;
    }

    await sql.query(`update clients set contact_id = $3 where user_id = $1 and id = $2`, [userId, firstIds[0], REG_PREFIX + JSON.stringify(reg)]);
    return { ok: true as const, already: false as const, clients: list.length };
  });

async function payDebt(userId: string, clientId: number, payMethod: string, at: string, en: boolean) {
  const sql = await getSql();
  const r = await sql.query<{ balance: unknown }>(`select balance from clients where user_id = $1 and id = $2`, [userId, clientId]);
  const owed = Math.round(Number(r[0]?.balance ?? 0) * 100) / 100;
  if (owed <= 0) return;
  await sql.query(
    `insert into payments (user_id, client_id, amount, kind, note, method, paid_at) values ($1,$2,$3,'paid',$4,$5,$6)`,
    [userId, clientId, owed, en ? "Payment" : "Abono", payMethod || null, at],
  );
  await sql.query(`update clients set balance = 0 where user_id = $1 and id = $2`, [userId, clientId]);
}

export const removeSample = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const sql = await getSql();
    const rows = await sampleClients(userId);
    if (!rows.length) return { ok: true as const, clients: 0 };
    await snapshotBackup(userId, true).catch(() => undefined);
    const regs: Registry[] = [];
    for (const r of rows) {
      if (!r.contact_id.startsWith(REG_PREFIX)) continue;
      try { regs.push(JSON.parse(r.contact_id.slice(REG_PREFIX.length)) as Registry); } catch { /* ignore */ }
    }
    const ids = rows.map((r) => Number(r.id));
    // Jobs, payments, changes, photos and note links go with their client (on delete cascade);
    // deleted explicitly too, so nothing is left even on an older table.
    for (const t of ["payments", "jobs", "client_changes", "pad_links", "client_photos"]) {
      await sql.query(`delete from ${t} where user_id = $1 and client_id = any($2::int[])`, [userId, ids]).catch(() => undefined);
    }
    await sql.query(`delete from clients where user_id = $1 and id = any($2::int[]) and contact_id like $3`, [userId, ids, `${SAMPLE_MARK}%`]);
    for (const reg of regs) {
      // Only rows still exactly as the sample left them.
      for (const [d, i, o] of reg.work ?? []) {
        await sql.query(
          `delete from work_days where user_id = $1 and work_date = $2::date and clock_in = $3 and clock_out = $4`,
          [userId, d, i, o],
        );
      }
      for (const [d, body] of reg.notes ?? []) {
        await sql.query(`delete from day_notes where user_id = $1 and note_date = $2::date and body = $3`, [userId, d, body]);
      }
      if (reg.weekGoals) {
        await sql.query(`update app_settings set week_goals = null where user_id = $1 and week_goals = $2`, [userId, reg.weekGoals]);
      }
    }
    return { ok: true as const, clients: ids.length };
  });
