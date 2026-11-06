// 1.5.02 Duplicate clients: check one new/edited client, check a batch (Añadir varios, contacts import),
// scan the existing list, merge two clients ONLY when the user taps Unir (backup first, rows moved by id,
// conflicts stay on the archived one) and undo a merge. Nothing here merges on its own.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { duplicateGroups, findLike, type DupWhy } from "@/lib/dup-match";
import { ensureScheduleForUser, logClientChange, snapshotBackup } from "@/lib/server/lawn";

export type DupClient = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  kind: "regular" | "one_time";
  price: number;
  cutsPerMonth: number;
  frequencyDays: number | null;
  isActive: boolean;
  balance: number;
  since: string;
  lastCut: string | null;
  nextCut: string | null;
  done: number;
};
export type DupMatch = DupClient & { why: DupWhy[] };

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const day = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

async function loadClients(userId: string, ids?: number[]): Promise<DupClient[]> {
  const sql = await getSql();
  const today = todayISO();
  const rows = await sql.query<Record<string, unknown>>(
    `select c.id, c.name, c.phone, c.address, c.kind, c.price_per_cut, c.cuts_per_month, c.frequency_days,
            c.is_active, c.balance, c.created_at,
            (select max(j.scheduled_date) from jobs j where j.user_id = c.user_id and j.client_id = c.id and j.status = 'done') as last_cut,
            (select min(j.scheduled_date) from jobs j where j.user_id = c.user_id and j.client_id = c.id and j.status = 'pending' and j.scheduled_date >= $2::date) as next_cut,
            (select count(*) from jobs j where j.user_id = c.user_id and j.client_id = c.id and j.status = 'done') as done
       from clients c
      where c.user_id = $1 ${ids ? "and c.id = any($3::int[])" : ""}
      order by c.name asc`,
    ids ? [userId, today, ids] : [userId, today],
  );
  return rows.map((r) => ({
    id: num(r.id),
    name: String(r.name ?? ""),
    phone: (r.phone as string | null) || null,
    address: (r.address as string | null) || null,
    kind: r.kind === "one_time" ? "one_time" : "regular",
    price: num(r.price_per_cut),
    cutsPerMonth: num(r.cuts_per_month),
    frequencyDays: r.frequency_days == null ? null : num(r.frequency_days),
    isActive: Boolean(r.is_active),
    balance: Math.round(num(r.balance) * 100) / 100,
    since: day(r.created_at) ?? "",
    lastCut: day(r.last_cut),
    nextCut: day(r.next_cut),
    done: num(r.done),
  }));
}

/** Pairs the user said are different people ("Es otro cliente"), as "a-b" with a < b. */
async function notDupPairs(userId: string): Promise<Set<string>> {
  const sql = await getSql();
  const rows = await sql.query<{ client_id: unknown; snapshot: unknown }>(
    `select client_id, snapshot from client_changes where user_id = $1 and snapshot like '%"bzNotDup"%'`,
    [userId],
  );
  const out = new Set<string>();
  for (const r of rows) {
    try {
      const s = JSON.parse(String(r.snapshot)) as { bzNotDup?: number };
      if (s.bzNotDup) out.add(pairKey(num(r.client_id), num(s.bzNotDup)));
    } catch {
      /* ignore */
    }
  }
  return out;
}
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const rowInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
});

/** Existing clients that look like this one (create, edit with excludeId). Archived ones count too. */
export const checkClientDupes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => rowInput.extend({ excludeId: z.coerce.number().int().optional() }).parse(data))
  .handler(async ({ context, data }): Promise<{ matches: DupMatch[]; self: DupClient | null }> => {
    const all = await loadClients(context.userId);
    const skip = data.excludeId ? await notDupPairs(context.userId) : new Set<string>();
    const hits = findLike(data, all, data.excludeId).filter((h) => !data.excludeId || !skip.has(pairKey(data.excludeId, h.c.id)));
    const self = data.excludeId ? all.find((c) => c.id === data.excludeId) ?? null : null;
    return { matches: hits.map((h) => ({ ...h.c, why: h.why })), self: self ? { ...self, name: data.name, phone: data.phone || null, address: data.address || null } : null };
  });

/** One list of look-alikes per row, in order (Añadir varios, contacts import). */
export const checkClientDupesBatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ rows: z.array(rowInput).min(1).max(40) }).parse(data))
  .handler(async ({ context, data }): Promise<{ rows: DupMatch[][] }> => {
    const all = await loadClients(context.userId);
    return { rows: data.rows.map((row) => findLike(row, all).map((h) => ({ ...h.c, why: h.why }))) };
  });

/** Groups of existing clients that look alike, without the pairs marked "Es otro cliente". */
export const scanClientDupes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ groups: { members: DupClient[]; why: DupWhy[] }[] }> => {
    // Only clients on the route: an archived one (or one already merged away) is not a duplicate to clean up.
    const all = (await loadClients(context.userId)).filter((c) => c.isActive);
    const skip = await notDupPairs(context.userId);
    const groups = duplicateGroups(all)
      .map((g) => {
        // Drop members whose every look-alike link inside the group was marked different.
        const keep = g.members.filter((m) => g.members.some((o) => o.id !== m.id && !skip.has(pairKey(m.id, o.id))));
        return { members: keep, why: g.why };
      })
      .filter((g) => g.members.length >= 2);
    // Strongest first: same phone or same name before an almost-equal name.
    const weight = (w: DupWhy[]) => (w.includes("phone") ? 4 : 0) + (w.includes("name") ? 4 : 0) + (w.includes("address") ? 3 : 0) + (w.includes("near") ? 1 : 0);
    groups.sort((a, b) => weight(b.why) - weight(a.why));
    return { groups };
  });

/** "Es otro cliente": remember that these two are different people (the scan stops pairing them). */
export const markNotDuplicate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ a: z.coerce.number().int(), b: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const both = await loadClients(context.userId, [data.a, data.b]);
    const a = both.find((c) => c.id === data.a);
    const b = both.find((c) => c.id === data.b);
    if (!a || !b) return { ok: false as const };
    await logClientChange(context.userId, a.id, `No es el mismo cliente que ${b.name}`, { bzNotDup: b.id });
    await logClientChange(context.userId, b.id, `No es el mismo cliente que ${a.name}`, { bzNotDup: a.id });
    return { ok: true as const };
  });

type MergeRecord = {
  v: 1;
  mergeId: string;
  keepId: number;
  dropId: number;
  keepName: string;
  dropName: string;
  at: string;
  jobs: number[];
  payments: number[];
  photos: number[];
  links: number[];
  /** Pending cuts of the archived client, deleted like archiving does (put back on undo). */
  pending: Record<string, unknown>[];
  conflicts: { jobs: number; links: number };
  keepBefore: { balance: number; credit: number; phone: string | null; address: string | null; notes: string | null; cue: string | null };
  filled: Partial<Record<"phone" | "address" | "notes" | "cue", string>>;
  dropBefore: { balance: number; credit: number; isActive: boolean; deactivatedAt: string | null };
};

/** Unir: everything of `dropId` moves to `keepId` by row id; `dropId` is archived with what could not move. */
export const mergeClients = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ keepId: z.coerce.number().int(), dropId: z.coerce.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const uid = context.userId;
    if (data.keepId === data.dropId) return { ok: false as const };
    const sql = await getSql();
    const cl = await sql.query<Record<string, unknown>>(
      `select id, name, phone, address, notes, cue, balance, credit, is_active, deactivated_at from clients where user_id = $1 and id = any($2::int[])`,
      [uid, [data.keepId, data.dropId]],
    );
    const K = cl.find((r) => num(r.id) === data.keepId);
    const D = cl.find((r) => num(r.id) === data.dropId);
    if (!K || !D) return { ok: false as const };
    // Backup first: a full copy of the books before anything moves.
    await snapshotBackup(uid, true);
    const keepCuts = new Set(
      (await sql.query<{ d: unknown }>(`select scheduled_date as d from jobs where user_id = $1 and client_id = $2 and kind = 'cut'`, [uid, data.keepId])).map((r) => day(r.d)),
    );
    const dJobs = await sql.query<Record<string, unknown>>(`select * from jobs where user_id = $1 and client_id = $2 order by id`, [uid, data.dropId]);
    const moveJobs: number[] = [];
    const pending: Record<string, unknown>[] = [];
    let jobConflicts = 0;
    for (const j of dJobs) {
      const isCut = j.kind === "cut";
      if (isCut && j.status === "pending") {
        pending.push(j);
        continue;
      }
      if (isCut && keepCuts.has(day(j.scheduled_date))) {
        jobConflicts++;
        continue;
      }
      moveJobs.push(num(j.id));
    }
    const payments = (await sql.query<{ id: unknown }>(`select id from payments where user_id = $1 and client_id = $2`, [uid, data.dropId])).map((r) => num(r.id));
    const photos = (await sql.query<{ id: unknown }>(`select id from client_photos where user_id = $1 and client_id = $2`, [uid, data.dropId]).catch(() => [])).map((r) => num(r.id));
    const keepPages = new Set((await sql.query<{ p: unknown }>(`select page_id as p from pad_links where user_id = $1 and client_id = $2`, [uid, data.keepId])).map((r) => num(r.p)));
    const dLinks = await sql.query<{ id: unknown; p: unknown }>(`select id, page_id as p from pad_links where user_id = $1 and client_id = $2`, [uid, data.dropId]);
    const links = dLinks.filter((l) => !keepPages.has(num(l.p))).map((l) => num(l.id));
    const linkConflicts = dLinks.length - links.length;

    const filled: MergeRecord["filled"] = {};
    for (const f of ["phone", "address", "notes", "cue"] as const) {
      const kv = String(K[f] ?? "").trim();
      const dv = String(D[f] ?? "").trim();
      if (!kv && dv) filled[f] = dv;
    }
    const record: MergeRecord = {
      v: 1,
      mergeId: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      keepId: data.keepId,
      dropId: data.dropId,
      keepName: String(K.name),
      dropName: String(D.name),
      at: new Date().toISOString(),
      jobs: moveJobs,
      payments,
      photos,
      links,
      pending,
      conflicts: { jobs: jobConflicts, links: linkConflicts },
      keepBefore: {
        balance: num(K.balance),
        credit: num(K.credit),
        phone: (K.phone as string | null) ?? null,
        address: (K.address as string | null) ?? null,
        notes: (K.notes as string | null) ?? null,
        cue: (K.cue as string | null) ?? null,
      },
      filled,
      dropBefore: {
        balance: num(D.balance),
        credit: num(D.credit),
        isActive: Boolean(D.is_active),
        deactivatedAt: D.deactivated_at ? String(D.deactivated_at instanceof Date ? D.deactivated_at.toISOString() : D.deactivated_at) : null,
      },
    };
    if (moveJobs.length) await sql.query(`update jobs set client_id = $2 where user_id = $1 and id = any($3::int[])`, [uid, data.keepId, moveJobs]);
    if (payments.length) await sql.query(`update payments set client_id = $2 where user_id = $1 and id = any($3::int[])`, [uid, data.keepId, payments]);
    if (photos.length) await sql.query(`update client_photos set client_id = $2 where user_id = $1 and id = any($3::int[])`, [uid, data.keepId, photos]);
    if (links.length) await sql.query(`update pad_links set client_id = $2 where user_id = $1 and id = any($3::int[])`, [uid, data.keepId, links]);
    if (pending.length) await sql.query(`delete from jobs where user_id = $1 and id = any($2::int[])`, [uid, pending.map((j) => num(j.id))]);
    const sets: string[] = ["balance = balance + $3", "credit = credit + $4"];
    const params: unknown[] = [uid, data.keepId, record.dropBefore.balance, record.dropBefore.credit];
    for (const [f, v] of Object.entries(filled)) {
      params.push(v);
      sets.push(`${f} = $${params.length}`);
    }
    await sql.query(`update clients set ${sets.join(", ")} where user_id = $1 and id = $2`, params);
    await sql.query(
      `update clients set balance = 0, credit = 0, is_active = false, deactivated_at = coalesce(deactivated_at, now()) where user_id = $1 and id = $2`,
      [uid, data.dropId],
    );
    const sameName = record.dropName.trim().toLowerCase() === record.keepName.trim().toLowerCase();
    await logClientChange(uid, data.keepId, sameName ? `Unido con otro ${record.dropName}` : `Unido con ${record.dropName}`, { bzMerge: record });
    await logClientChange(uid, data.dropId, `Unido en ${record.keepName}`, { bzMerge: record });
    await ensureScheduleForUser(uid);
    return {
      ok: true as const,
      mergeId: record.mergeId,
      keepId: data.keepId,
      moved: { jobs: moveJobs.length, payments: payments.length, photos: photos.length, links: links.length },
      conflicts: record.conflicts,
    };
  });

/** Deshacer: rows go back to the archived client by id, it comes back as it was, the kept one loses only what came. */
export const undoMerge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ mergeId: z.string().min(3).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const uid = context.userId;
    const sql = await getSql();
    const rows = await sql.query<{ snapshot: unknown }>(
      `select snapshot from client_changes where user_id = $1 and snapshot like $2 order by id desc`,
      [uid, `%${data.mergeId}%`],
    );
    let rec: MergeRecord | null = null;
    let undone = false;
    for (const r of rows) {
      try {
        const s = JSON.parse(String(r.snapshot)) as { bzMerge?: MergeRecord; bzMergeUndone?: string };
        if (s.bzMergeUndone === data.mergeId) undone = true;
        if (s.bzMerge?.mergeId === data.mergeId) rec = s.bzMerge;
      } catch {
        /* ignore */
      }
    }
    if (!rec) return { ok: false as const, reason: "missing" as const };
    if (undone) return { ok: false as const, reason: "done" as const };
    const both = await sql.query<{ id: unknown }>(`select id from clients where user_id = $1 and id = any($2::int[])`, [uid, [rec.keepId, rec.dropId]]);
    if (both.length < 2) return { ok: false as const, reason: "missing" as const };
    await snapshotBackup(uid, true);
    if (rec.jobs.length) await sql.query(`update jobs set client_id = $2 where user_id = $1 and client_id = $3 and id = any($4::int[])`, [uid, rec.dropId, rec.keepId, rec.jobs]);
    if (rec.payments.length) await sql.query(`update payments set client_id = $2 where user_id = $1 and client_id = $3 and id = any($4::int[])`, [uid, rec.dropId, rec.keepId, rec.payments]);
    if (rec.photos.length) await sql.query(`update client_photos set client_id = $2 where user_id = $1 and client_id = $3 and id = any($4::int[])`, [uid, rec.dropId, rec.keepId, rec.photos]);
    if (rec.links.length) await sql.query(`update pad_links set client_id = $2 where user_id = $1 and client_id = $3 and id = any($4::int[])`, [uid, rec.dropId, rec.keepId, rec.links]);
    // Filled fields go back to empty only if nobody changed them since.
    const sets: string[] = ["balance = balance - $3", "credit = greatest(credit - $4, 0)"];
    const params: unknown[] = [uid, rec.keepId, rec.dropBefore.balance, rec.dropBefore.credit];
    for (const [f, v] of Object.entries(rec.filled)) {
      params.push(v);
      sets.push(`${f} = case when ${f} = $${params.length} then null else ${f} end`);
    }
    await sql.query(`update clients set ${sets.join(", ")} where user_id = $1 and id = $2`, params);
    await sql.query(
      `update clients set balance = $3, credit = $4, is_active = $5, deactivated_at = $6::timestamptz where user_id = $1 and id = $2`,
      [uid, rec.dropId, rec.dropBefore.balance, rec.dropBefore.credit, rec.dropBefore.isActive, rec.dropBefore.deactivatedAt],
    );
    // Pending cuts that were cleared come back (unless that day is taken now).
    const taken = new Set(
      (await sql.query<{ d: unknown }>(`select scheduled_date as d from jobs where user_id = $1 and client_id = $2 and kind = 'cut'`, [uid, rec.dropId])).map((r) => day(r.d)),
    );
    for (const j of rec.pending) {
      if (taken.has(day(j.scheduled_date))) continue;
      const cols = Object.keys(j).filter((k) => k !== "id" && j[k] !== undefined);
      await sql
        .query(
          `insert into jobs (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
          cols.map((k) => j[k]),
        )
        .catch(() => undefined);
    }
    await logClientChange(uid, rec.keepId, `Unión con ${rec.dropName} deshecha`, { bzMergeUndone: rec.mergeId });
    await logClientChange(uid, rec.dropId, `Unión con ${rec.keepName} deshecha`, { bzMergeUndone: rec.mergeId });
    await ensureScheduleForUser(uid);
    return { ok: true as const, dropId: rec.dropId, keepId: rec.keepId };
  });
