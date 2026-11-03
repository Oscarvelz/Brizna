// Brizna sync: one compressed, text-only snapshot per account in Supabase (brizna_books).
// Photos and the on-device backup copies never leave the phone.
import { exclusive } from "@/lib/db";
import { withChecksum } from "@/lib/backup-plan";
import { supabase, getUser } from "./cloud";
import { HASH_V, SCHEMA, hashView, snapshotMeta } from "./sync-logic";

const TABLES = [
  "app_settings", "clients", "pad_pages", "jobs", "payments", "client_changes", "day_goals",
  "day_marks", "day_notes", "pad_links", "pad_notes", "week_off_dates", "work_days",
];
const PARENTS = new Set(["clients", "pad_pages"]);

// rev/at: the cloud copy this device last saw (at is the server's stamp, never compared with this clock).
// hv: how hash was made (older versions hashed the raw text).
type State = { rev: number; at: string; dirty: boolean; editedAt: string; hash?: string; hv?: number; checkedAt?: string };
const KEY = (uid: string) => `brizna.sync.${uid}`;
function load(uid: string): State {
  try { return { rev: 0, at: "", dirty: false, editedAt: "", ...JSON.parse(localStorage.getItem(KEY(uid)) || "{}") }; }
  catch { return { rev: 0, at: "", dirty: false, editedAt: "" }; }
}
function save(uid: string, s: State) { try { localStorage.setItem(KEY(uid), JSON.stringify(s)); } catch { /* ignore */ } }

function deviceId() {
  let id = "";
  try { id = localStorage.getItem("brizna.device") || ""; } catch { /* ignore */ }
  if (!id) { id = crypto.randomUUID(); try { localStorage.setItem("brizna.device", id); } catch { /* ignore */ } }
  return id;
}

export type SyncStatus = "off" | "idle" | "syncing" | "offline" | "error";
let status: SyncStatus = "off";
let statusListeners: ((s: SyncStatus) => void)[] = [];
function setStatus(s: SyncStatus) {
  if (s === "idle" && uid) { const st = load(uid); st.checkedAt = new Date().toISOString(); save(uid, st); }
  status = s; statusListeners.forEach((f) => f(s));
}
export function syncStatus() { return status; }
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  statusListeners.push(fn);
  return () => { statusListeners = statusListeners.filter((f) => f !== fn); };
}

// ---------- snapshot <-> database ----------
async function gzip(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function gunzip(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

type Pg = Parameters<Parameters<typeof exclusive>[0]>[0];
async function readTables(pg: Pg): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const r = await pg.query<{ j: unknown[] | null }>(`select json_agg(x) as j from ${t} x`);
    const rows = (r.rows[0]?.j ?? []) as Record<string, unknown>[];
    if (t === "jobs") for (const row of rows) if ("photo" in row) row.photo = null;
    out[t] = rows;
  }
  return out;
}
type Dump = { text: string; view: string };
function pack(tables: Record<string, unknown[]>): Dump {
  // v stays 1 so older app versions still read it; schema tells newer ones which tables/columns it has.
  return { text: JSON.stringify({ v: 1, schema: SCHEMA, app: "brizna", tables }), view: hashView(tables) };
}
async function dump(): Promise<Dump> {
  return exclusive(async (pg) => pack(await readTables(pg)));
}

async function digest(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function hasLocalData(): Promise<boolean> {
  return exclusive(async (pg) => {
    const r = await pg.query<{ n: number }>("select (select count(*) from clients) + (select count(*) from pad_pages) as n");
    return Number(r.rows[0]?.n ?? 0) > 0;
  });
}

class EditedDuringPull extends Error {}
const G = globalThis as any;

/** Replaces the local tables with a cloud copy. guard runs inside the lock, right before
 *  anything is deleted: false means the user saved something meanwhile, so nothing is applied.
 *  Returns the local state just after applying (same lock), for the next change check. */
async function apply(json: string, guard?: () => boolean): Promise<Dump> {
  const data = JSON.parse(json) as { v: number; tables: Record<string, unknown[]> };
  if (!data || data.v !== 1 || !data.tables) throw new Error("bad snapshot");
  if (snapshotMeta(json).schema > SCHEMA) throw new Error("newer snapshot");
  const after = await exclusive(async (pg) => {
    if (guard && !guard()) throw new EditedDuringPull("edited");
    await pg.transaction(async (tx) => {
      for (const t of [...TABLES].reverse()) if (!PARENTS.has(t)) await tx.query(`delete from ${t}`);
      await tx.query("delete from pad_pages");
      await tx.query("delete from clients");
      const colRows = await tx.query<{ t: string; c: string }>(
        `select table_name as t, column_name as c from information_schema.columns
          where table_schema = 'public' and table_name = any($1::text[])`,
        [TABLES],
      );
      for (const t of TABLES) {
        const rows = data.tables[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        // Only the columns the copy carries: a column it lacks (older app) takes its default instead of null.
        const have = new Set(colRows.rows.filter((r) => r.t === t).map((r) => r.c));
        const keys = new Set<string>();
        for (const row of rows) if (row && typeof row === "object") for (const k of Object.keys(row)) keys.add(k);
        const cols = [...keys].filter((k) => have.has(k)).map((c) => `"${c}"`).join(", ");
        if (!cols) continue;
        await tx.query(`insert into ${t} (${cols}) select ${cols} from json_populate_recordset(null::${t}, $1::json)`, [JSON.stringify(rows)]);
      }
      const seqs = await tx.query<{ t: string; s: string | null }>(
        `select table_name as t, pg_get_serial_sequence(table_name::text, 'id') as s
           from information_schema.columns
          where table_schema = 'public' and column_name = 'id' and table_name = any($1::text[])`,
        [TABLES],
      );
      for (const { t, s: seqName } of seqs.rows) {
        if (seqName) await tx.query(`select setval($1, greatest((select coalesce(max(id), 0) from ${t}), 1))`, [seqName]);
      }
      const check = await tx.query<{ n: number }>("select count(*)::int as n from clients");
      if (Number(check.rows[0]?.n ?? 0) !== (data.tables.clients?.length ?? 0)) throw new Error("apply check failed");
    });
    return pack(await readTables(pg));
  });
  G.__bzWriteEpoch = (G.__bzWriteEpoch ?? 0) + 1;
  // New data from another device: let the schedule be checked again.
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("brizna.ensured.")) localStorage.removeItem(k); } catch { /* ignore */ }
  // Tell every screen to read again.
  try { new BroadcastChannel("ols-live").postMessage({ all: true }); } catch { /* ignore */ }
  return after;
}

// ---------- local copy before replacing ----------
let keepCopy: (() => Promise<unknown>) | null = null;
/** Registered by main: saves an on-device backup (Ajustes > copies) without marking a change. */
export function setKeepCopy(fn: () => Promise<unknown>) { keepCopy = fn; }

/** Full on-device copy of this device's data. Returns how much the write counter moved. */
async function keepLocalCopy(): Promise<number> {
  const before = Number(G.__bzWriteEpoch ?? 0);
  const hits = quietHits;
  quiet = true;
  try { await keepCopy?.(); } catch { /* best effort */ } finally { quiet = false; }
  const bump = Number(G.__bzWriteEpoch ?? 0) - before;
  // The copy itself is one save; anything more was the person editing meanwhile: keep it marked.
  if (bump > 2 || quietHits - hits > 1) markDirty();
  return bump;
}

/** Saves the cloud copy as an on-device backup too (Ajustes > Copia de seguridad), before it can be replaced. */
async function keepCloudCopy(json: string): Promise<void> {
  try {
    const t = (JSON.parse(json) as { tables?: Record<string, Record<string, unknown>[]> }).tables ?? {};
    const payload = withChecksum({
      version: 5,
      savedAt: new Date().toISOString(),
      source: "cloud",
      clients: t.clients ?? [],
      jobs: t.jobs ?? [],
      payments: t.payments ?? [],
      padNotes: String(t.pad_notes?.[0]?.body ?? ""),
      padPages: t.pad_pages ?? [],
      workDays: t.work_days ?? [],
      dayMarks: t.day_marks ?? [],
      settings: t.app_settings?.[0] ?? null,
      clientChanges: t.client_changes ?? [],
      dayGoals: t.day_goals ?? [],
      dayNotes: t.day_notes ?? [],
      padLinks: t.pad_links ?? [],
      weekOff: t.week_off_dates ?? [],
    });
    await exclusive(async (pg) => {
      await pg.query(
        `insert into backups (user_id, payload)
         values (coalesce((select user_id from backups order by id desc limit 1), (select user_id from app_settings limit 1), 'dev-user'), $1::jsonb)`,
        [JSON.stringify(payload)],
      );
    });
  } catch (err) { console.warn("[brizna sync] cloud copy", err); }
}

// ---------- notices (both devices changed / cloud copy from a newer Brizna) ----------
export type SyncNotice = { kind: "conflict" | "newer" } | null;
let notice: SyncNotice = null;
let noticeListeners: ((n: SyncNotice) => void)[] = [];
let snoozedUntil = 0;
let choice: "cloud" | "device" | null = null;
let copiedFor = "";
function showNotice(n: SyncNotice) {
  if (n && Date.now() < snoozedUntil) return;
  if (notice?.kind === n?.kind) return;
  notice = n; noticeListeners.forEach((f) => f(n));
}
// Test harness only (window.__bzTrace is set by the browser tests, never by the app).
try { if ((globalThis as any).__bzTrace) (globalThis as any).__bzSyncNotice = showNotice; } catch { /* ignore */ }
export function syncNotice() { return notice; }
export function onSyncNotice(fn: (n: SyncNotice) => void) {
  noticeListeners.push(fn);
  return () => { noticeListeners = noticeListeners.filter((f) => f !== fn); };
}
/** "Not now": hide it for a while; nothing is overwritten meanwhile. */
export function snoozeSyncNotice() { snoozedUntil = Date.now() + 10 * 60_000; notice = null; noticeListeners.forEach((f) => f(null)); }
/** The person picked which copy stays. */
export function resolveSyncConflict(keep: "cloud" | "device") {
  choice = keep; snoozedUntil = 0; notice = null; noticeListeners.forEach((f) => f(null));
  return syncNow(true);
}

// ---------- push / pull ----------
let uid: string | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer = 0;
let editCounter = 0;
export let quiet = false;

let quietHits = 0;
export function markDirty() {
  if (!uid) return;
  if (quiet) { quietHits += 1; return; }
  const s = load(uid);
  s.dirty = true;
  s.editedAt = new Date().toISOString();
  save(uid, s);
  editCounter += 1;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), 3000);
}

export function syncNow(force = false): Promise<void> {
  if (!uid) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    try { await once(force); } finally {
      running = null;
      if (again) { again = false; void syncNow(); }
    }
  })();
  return running;
}

type PushRow = { revision: number; updated_at: string; won: boolean };
let v2 = true;
/** Saves only over the cloud copy this device saw (revision = base); the server stamps the time. */
async function pushOver(payload: string, base: number): Promise<PushRow | undefined> {
  if (v2) {
    const res = await supabase.rpc("brizna_push_v2", { p_data: payload, p_base: base, p_device: deviceId() });
    if (!res.error) return (Array.isArray(res.data) ? res.data[0] : res.data) as PushRow | undefined;
    const code = String((res.error as { code?: string }).code ?? "");
    if (code !== "PGRST202" && code !== "42883") throw res.error;
    v2 = false; // server without the new function yet
  }
  const res = await supabase.rpc("brizna_push", { p_data: payload, p_revision: base + 1, p_updated: new Date().toISOString(), p_device: deviceId() });
  if (res.error) throw res.error;
  return (Array.isArray(res.data) ? res.data[0] : res.data) as PushRow | undefined;
}

function dbg(...a: unknown[]) { if ((window as any).__bzTrace) console.info("[brizna sync]", ...a); }

async function once(force = false) {
  const me = uid;
  if (!me) return;
  if (!navigator.onLine) { setStatus("offline"); return; }
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session || sess.session.user.id !== me) { setStatus("offline"); return; }
  setStatus("syncing");
  try {
    const s = load(me);
    const head = await supabase.from("brizna_books").select("revision, updated_at, device_id").maybeSingle();
    if (head.error) throw head.error;
    const remote = head.data as { revision: number; updated_at: string; device_id: string } | null;
    // Nothing edited here and nothing new in the cloud: no need to read the whole database.
    if (remote && s.rev > 0 && !s.dirty && Number(remote.revision) === s.rev && remote.updated_at === s.at) {
      setStatus("idle");
      return;
    }
    const mark = editCounter;
    const local = await dump();
    const text = local.text;
    const hash = await digest(local.view);
    const changed = s.rev === 0 ? false : s.hv === HASH_V ? hash !== s.hash : s.dirty;
    // Both sides changed only when this device has edits the cloud never got (dirty) - not a refreshed schedule or a backup stamp.
    const localEdited = changed && s.dirty;
    const remoteNewer = Boolean(remote && (Number(remote.revision) > s.rev || (s.rev > 0 && Number(remote.revision) === s.rev && remote.updated_at !== s.at)));
    let base = remote ? Number(remote.revision) : s.rev;
    let overCloud = false;

    dbg("state", JSON.stringify(s), "remote", JSON.stringify(remote), "changed", changed, "remoteNewer", remoteNewer, "choice", choice);
    if (remote && (remoteNewer || s.rev === 0)) {
      const full = await supabase.from("brizna_books").select("data_gz, revision, updated_at").maybeSingle();
      if (full.error) throw full.error;
      if (!full.data) { again = true; setStatus("idle"); return; }
      const remoteJson = await gunzip(String(full.data.data_gz));
      const meta = snapshotMeta(remoteJson);
      const fullRev = Number(full.data.revision);
      // A brand-new device that already has clients must never be wiped by an EMPTY cloud copy: send its own instead.
      const pushInstead = s.rev === 0 && meta.empty && (await hasLocalData());
      if (pushInstead) {
        base = fullRev;
      } else if (meta.schema > SCHEMA) {
        // Saved by a newer Brizna: applying it here would drop what this version can't hold, and saving over it would lose it.
        showNotice({ kind: "newer" });
        setStatus("idle");
        return;
      } else if (localEdited && choice !== "cloud") {
        const key = `${fullRev}:${hash}`;
        const copiedKey = `brizna.sync.copied.${me}`;
        let copied = copiedFor;
        try { copied = localStorage.getItem(copiedKey) || copiedFor; } catch { /* ignore */ }
        if (copied !== key) {
          await keepLocalCopy();
          await keepCloudCopy(remoteJson);
          copiedFor = key;
          try { localStorage.setItem(copiedKey, key); } catch { /* ignore */ }
        }
        if (choice !== "device") { showNotice({ kind: "conflict" }); setStatus("idle"); return; }
        base = fullRev; // keep this device's: save it over the cloud copy (already kept on this device)
        overCloud = true;
      } else {
        const bump = changed || (s.rev === 0 && (await hasLocalData())) ? await keepLocalCopy() : 0;
        if (bump > 2 || editCounter !== mark) { again = true; setStatus("idle"); return; } // edited meanwhile: look again
        const epoch = Number(G.__bzWriteEpoch ?? 0);
        const guard = () => editCounter === mark && Number(G.__bzInPost ?? 0) === 0 && Number(G.__bzWriteEpoch ?? 0) === epoch;
        let after: Dump;
        try {
          after = await apply(remoteJson, guard);
        } catch (err) {
          if (err instanceof EditedDuringPull) { again = true; setStatus("idle"); return; }
          throw err;
        }
        // An edit right after the cloud copy landed is on top of it: keep it marked so it goes up next.
        const editedAfter = editCounter !== mark;
        dbg("applied remote", full.data.revision);
        const latest = load(me);
        save(me, { rev: fullRev, at: String(full.data.updated_at), dirty: editedAfter, editedAt: editedAfter ? latest.editedAt : "", hash: await digest(after.view), hv: HASH_V });
        if (choice === "cloud") choice = null;
        if (notice?.kind === "conflict") showNotice(null);
        if (editedAfter) again = true;
        setStatus("idle");
        return;
      }
    }

    const emptyTakeover = Boolean(remote && s.rev === 0);
    const needPush = overCloud || emptyTakeover || (remote ? changed || (force && s.dirty) : (s.rev > 0 || force || (await hasLocalData())));
    if (!needPush) { if (s.dirty || s.hv !== HASH_V) save(me, { ...s, dirty: false, hash, hv: HASH_V }); setStatus("idle"); return; }
    dbg("push", base);
    const payload = await gzip(text);
    const row = await pushOver(payload, base);
    if (row?.won) {
      const latest = load(me);
      save(me, { rev: Number(row.revision), at: String(row.updated_at), dirty: editCounter !== mark, editedAt: latest.editedAt, hash, hv: HASH_V });
      if (editCounter !== mark) again = true;
      if (overCloud) { choice = null; if (notice?.kind === "conflict") showNotice(null); }
    } else {
      again = true; // the cloud moved since this device looked: next pass reads it (and asks if both changed)
    }
    setStatus("idle");
  } catch (err) {
    console.warn("[brizna sync]", err);
    setStatus(navigator.onLine ? "error" : "offline");
  }
}

let wired = false;
export function startSync(userId: string) {
  uid = userId;
  if (!wired) {
    wired = true;
    window.addEventListener("online", () => void syncNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncNow();
      else if (uid && load(uid).dirty) { window.clearTimeout(timer); void syncNow(); }
    });
    window.setInterval(() => { if (document.visibilityState === "visible") void syncNow(); }, 60_000);
  }
  // A device that already has its data lets the first screen load before syncing.
  if (load(userId).rev === 0) void syncNow();
  else window.setTimeout(() => void syncNow(), 2500);
}
export function stopSync() { uid = null; setStatus("off"); }
export function hasPending(): boolean { return Boolean(uid && load(uid).dirty); }
/** For Ajustes: when this account's data was last saved to / checked against the cloud. */
export function syncInfo(): { status: SyncStatus; cloudAt: string; checkedAt: string; pending: boolean; on: boolean } {
  const st = uid ? load(uid) : null;
  return { status, cloudAt: st?.at ?? "", checkedAt: st?.checkedAt ?? "", pending: Boolean(st?.dirty), on: Boolean(uid) };
}
export { getUser };
