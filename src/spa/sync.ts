// Brizna sync: one compressed, text-only snapshot per account in Supabase (brizna_books).
// Photos and the on-device backup copies never leave the phone.
import { exclusive } from "@/lib/db";
import { supabase, getUser } from "./cloud";

const TABLES = [
  "app_settings", "clients", "pad_pages", "jobs", "payments", "client_changes", "day_goals",
  "day_marks", "day_notes", "pad_links", "pad_notes", "week_off_dates", "work_days",
];
const PARENTS = new Set(["clients", "pad_pages"]);

type State = { rev: number; at: string; dirty: boolean; editedAt: string; hash?: string; checkedAt?: string };
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

async function dump(): Promise<string> {
  return exclusive(async (pg) => {
    const out: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      const r = await pg.query<{ j: unknown[] | null }>(`select json_agg(x) as j from ${t} x`);
      const rows = (r.rows[0]?.j ?? []) as Record<string, unknown>[];
      if (t === "jobs") for (const row of rows) if ("photo" in row) row.photo = null;
      out[t] = rows;
    }
    return JSON.stringify({ v: 1, app: "brizna", tables: out });
  });
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

async function apply(json: string) {
  const data = JSON.parse(json) as { v: number; tables: Record<string, unknown[]> };
  if (!data || data.v !== 1 || !data.tables) throw new Error("bad snapshot");
  await exclusive(async (pg) => {
    await pg.transaction(async (tx) => {
      for (const t of [...TABLES].reverse()) if (!PARENTS.has(t)) await tx.query(`delete from ${t}`);
      await tx.query("delete from pad_pages");
      await tx.query("delete from clients");
      for (const t of TABLES) {
        const rows = data.tables[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        await tx.query(`insert into ${t} select * from json_populate_recordset(null::${t}, $1::json)`, [JSON.stringify(rows)]);
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
  });
  (globalThis as any).__bzWriteEpoch = ((globalThis as any).__bzWriteEpoch ?? 0) + 1;
  // New data from another device: let the schedule be checked again.
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("brizna.ensured.")) localStorage.removeItem(k); } catch { /* ignore */ }
  // Tell every screen to read again.
  try { new BroadcastChannel("ols-live").postMessage({ all: true }); } catch { /* ignore */ }
}

// ---------- local copy before replacing ----------
let keepCopy: (() => Promise<unknown>) | null = null;
/** Registered by main: saves an on-device backup (Ajustes > copies) without marking a change. */
export function setKeepCopy(fn: () => Promise<unknown>) { keepCopy = fn; }

// ---------- push / pull ----------
let uid: string | null = null;
let running: Promise<void> | null = null;
let again = false;
let timer = 0;
let editCounter = 0;
export let quiet = false;

export function markDirty() {
  if (!uid || quiet) return;
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
    const text = await dump();
    const hash = await digest(text);
    const changed = s.rev === 0 ? false : hash !== s.hash;
    const remoteNewer = Boolean(remote && (Number(remote.revision) > s.rev || (s.rev > 0 && Number(remote.revision) === s.rev && remote.updated_at !== s.at)));

    dbg("state", JSON.stringify(s), "remote", JSON.stringify(remote), "changed", changed, "remoteNewer", remoteNewer);
    if (remote && (remoteNewer || s.rev === 0)) {
      const localWins = s.rev > 0 && changed && s.editedAt && new Date(s.editedAt) > new Date(remote.updated_at);
      if (!localWins) {
        if (changed || (s.rev === 0 && (await hasLocalData()))) {
          quiet = true;
          try { await keepCopy?.(); } catch { /* best effort */ } finally { quiet = false; }
        }
        const full = await supabase.from("brizna_books").select("data_gz, revision, updated_at").maybeSingle();
        if (full.error) throw full.error;
        const remoteJson = full.data ? await gunzip(String(full.data.data_gz)) : "";
        // A brand-new device that already has clients must never be wiped by an EMPTY cloud copy: send its own instead.
        const remoteEmpty = (() => { try { const t = (JSON.parse(remoteJson) as { tables?: Record<string, unknown[]> }).tables ?? {}; return !(t.clients?.length || t.pad_pages?.length); } catch { return false; } })();
        const pushInstead = s.rev === 0 && full.data && remoteEmpty && (await hasLocalData());
        if (full.data && !pushInstead) {
          await apply(remoteJson);
          dbg("applied remote", full.data.revision, (await dump()).match(/"name":"[^"]*"/g)?.join(","));
          save(me, { rev: Number(full.data.revision), at: String(full.data.updated_at), dirty: false, editedAt: "", hash: await digest(await dump()) });
        }
        if (!pushInstead) { setStatus("idle"); return; }
      }
    }

    const emptyTakeover = Boolean(remote && s.rev === 0);
    const needPush = emptyTakeover || (remote ? changed || (force && s.dirty) : (s.rev > 0 || force || (await hasLocalData())));
    if (!needPush) { if (s.dirty) save(me, { ...s, dirty: false }); setStatus("idle"); return; }
    dbg("push", text.match(/"name":"[^"]*"/g)?.join(","));
    const payload = await gzip(text);
    const base = Math.max(s.rev, remote ? Number(remote.revision) : 0);
    const now = new Date().toISOString();
    const res = await supabase.rpc("brizna_push", { p_data: payload, p_revision: base + 1, p_updated: now, p_device: deviceId() });
    if (res.error) throw res.error;
    const row = (Array.isArray(res.data) ? res.data[0] : res.data) as { revision: number; updated_at: string; won: boolean } | undefined;
    if (row?.won) {
      const latest = load(me);
      save(me, { rev: Number(row.revision), at: String(row.updated_at), dirty: editCounter !== mark, editedAt: latest.editedAt, hash });
      if (editCounter !== mark) again = true;
    } else {
      again = true; // someone saved first: next pass reads theirs
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
