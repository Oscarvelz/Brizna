import { useEffect, useState } from "react";
import { todayISO } from "@/lib/dates";
import { sealedOn } from "@/lib/presentation/seal-flag";
import type { ComputedStatus, JobStatus } from "@/lib/types";

export type OutboxOp =
  | {
      id: string;
      kind: "done";
      jobId: number;
      settlement: "paid" | "owe" | "abono";
      abono?: number;
      method?: string;
      photo?: string;
      tip?: number;
      at: number;
      /** 1.5.51 (auditoría interna, D1): op format version — every op carries one. */
      v?: number;
    }
  | { id: string; kind: "postpone"; jobId: number; date: string; reason: string; at: number; v?: number }
  | { id: string; kind: "note"; date: string; body: string; at: number; v?: number };

export type FailedOp = { op: OutboxOp; why: string; at: number };

const LEGACY_KEY = "ols-outbox";
const EVENT = "ols-outbox";
const OP_VERSION = 1;
/** A field day cannot plausibly queue more than this; past it, the oldest ops move to
 *  the visible failed list instead of vanishing (D6). */
const MAX_OPS = 200;

/** 1.5.51 (auditoría interna, D1): the queue belongs to an account, like
 *  `brizna.screens.<uid>` and `brizna.sync.<uid>` already do. It used to live under one
 *  global key, surviving sign-outs and restores, and flushed against whoever's database
 *  happened to be open — with per-database serial job ids, a "Hecho" from account A
 *  could land on account B's job with the same id and move B's money. The owner is read
 *  from `brizna.lastUser`, the same place query-snapshot.ts reads it. */
function scope(): string {
  try {
    const raw = localStorage.getItem("brizna.lastUser") || sessionStorage.getItem("brizna.lastUser") || "null";
    const u = JSON.parse(raw) as { id?: string } | null;
    return u && typeof u.id === "string" && u.id ? u.id : "local";
  } catch {
    return "local";
  }
}

function key(): string {
  return `ols-outbox.${scope()}`;
}

function failedKey(): string {
  return `ols-outbox-failed.${scope()}`;
}

function readKey(k: string): OutboxOp[] {
  try {
    const raw = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(raw) ? (raw as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

let legacyAdopted = false;
let localAdopted = false;

function read(): OutboxOp[] {
  if (typeof localStorage === "undefined") return [];
  const mine = readKey(key());
  // One-time adoption: ops queued by an older Brizna under the global key belong to
  // whoever was signed in when they were queued — on this device, the account that is
  // open now. They move into that account's queue rather than being orphaned (and
  // rather than flushing later against a stranger's book).
  if (!legacyAdopted && mine.length === 0) {
    legacyAdopted = true;
    const legacy = readKey(LEGACY_KEY);
    if (legacy.length) {
      try {
        localStorage.setItem(key(), JSON.stringify(legacy));
        localStorage.removeItem(LEGACY_KEY);
      } catch { /* ignore */ }
      return legacy;
    }
  }
  // 1.5.93 (campaña Prejuicio, BZ-5): the same adoption for the PROVISIONAL scope.
  // Work queued with no remembered session lives under `ols-outbox.local`; when the
  // owner signs in, the scope changes to their account and those ops used to stay
  // behind, invisible and never uploaded — a field day's "Hecho" marks lost in plain
  // sight. They belong to the owner of this device's book (the same admission C1
  // makes), so the first account-scoped read moves them into the account's queue.
  if (!localAdopted && scope() !== "local" && mine.length === 0) {
    localAdopted = true;
    const local = readKey("ols-outbox.local");
    if (local.length) {
      try {
        localStorage.setItem(key(), JSON.stringify(local));
        localStorage.removeItem("ols-outbox.local");
      } catch { /* ignore */ }
      return local;
    }
  }
  return mine;
}

function write(ops: OutboxOp[]) {
  localStorage.setItem(key(), JSON.stringify(ops));
  window.dispatchEvent(new Event(EVENT));
}

/* ---------- the failed list (la papelera, D6) ---------- */

export function readFailed(): FailedOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(failedKey()) || "[]");
    return Array.isArray(raw) ? (raw as FailedOp[]) : [];
  } catch {
    return [];
  }
}

function writeFailed(rows: FailedOp[]) {
  try {
    localStorage.setItem(failedKey(), JSON.stringify(rows.slice(-50)));
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function addFailed(entries: FailedOp[]) {
  if (!entries.length) return;
  writeFailed([...readFailed(), ...entries]);
}

export function clearFailed() {
  writeFailed([]);
}

/** A restore replaces the book and remaps every id: ops queued against the old book
 *  can never apply to the new one. They are quarantined into the failed list — visible,
 *  counted, dismissible — never silently dropped and never flushed (D1).
 *  1.5.93 (BZ-5): the quarantine walks EVERY scope present on the device, not only
 *  the current one — ops under the provisional scope (`ols-outbox.local`) or another
 *  account's scope point at the same replaced book's ids and are just as poisonous. */
export function quarantineOutbox(why: string): number {
  let moved = 0;
  const mine = read();
  if (mine.length) {
    addFailed(mine.map((op) => ({ op, why, at: Date.now() })));
    write([]);
    moved += mine.length;
  }
  try {
    const scopes = new Set<string>();
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      const m = k ? /^ols-outbox\.(.+)$/.exec(k) : null;
      if (m && !m[1].startsWith("failed")) scopes.add(m[1]);
    }
    for (const sc of scopes) {
      if (`ols-outbox.${sc}` === key()) continue;
      const ops = readKey(`ols-outbox.${sc}`);
      if (!ops.length) continue;
      const failed = (() => {
        try {
          const raw = JSON.parse(localStorage.getItem(`ols-outbox-failed.${sc}`) || "[]");
          return Array.isArray(raw) ? (raw as FailedOp[]) : [];
        } catch { return [] as FailedOp[]; }
      })();
      try {
        localStorage.setItem(
          `ols-outbox-failed.${sc}`,
          JSON.stringify([...failed, ...ops.map((op) => ({ op, why, at: Date.now() }))].slice(-50)),
        );
        localStorage.removeItem(`ols-outbox.${sc}`);
        moved += ops.length;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  if (moved) window.dispatchEvent(new Event(EVENT));
  return moved;
}

export function useFailed(): FailedOp[] {
  const [rows, setRows] = useState<FailedOp[]>(() => readFailed());
  useEffect(() => {
    const sync = () => setRows(readFailed());
    window.addEventListener(EVENT, sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("online", sync);
    };
  }, []);
  return rows;
}

export function readOutbox(): OutboxOp[] {
  // Presentation seal (Cerca 0): the network flush (offline-banner) reads the
  // queue through here, so while sealed it sees an empty queue — real ops
  // queued against the real book can never flush into the stage book, and
  // they stay queued, untouched, for when the seal lifts.
  if (sealedOn()) return [];
  return read();
}

type OutboxInput<T = OutboxOp> = T extends unknown ? Omit<T, "id" | "at"> : never;

export function enqueue(op: OutboxInput): void {
  const next = read().filter((item) => {
    if (op.kind === "note" && item.kind === "note") return item.date !== op.date;
    if (op.kind !== "note" && item.kind !== "note" && item.jobId === op.jobId && item.kind === op.kind) {
      return false;
    }
    return true;
  });
  const row = { ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), v: OP_VERSION } as OutboxOp;
  if (row.kind === "done" && row.photo && row.photo.length > 120_000) row.photo = undefined;
  next.push(row);
  // 1.5.51 (D6): the cap used to be 40 and silent — ops past it vanished while their
  // optimistic paint vanished with them, so done work looked pending again and was
  // simply gone. Past the (much larger) cap, the oldest move to the failed list where
  // the user can see the count and dismiss it knowingly.
  if (next.length > MAX_OPS) {
    const dropped = next.slice(0, next.length - MAX_OPS);
    addFailed(dropped.map((op) => ({ op, why: "overflow", at: Date.now() })));
    write(next.slice(-MAX_OPS));
    return;
  }
  write(next);
}

export function removeOutbox(ids: string[]) {
  const drop = new Set(ids);
  write(read().filter((op) => !drop.has(op.id)));
}

export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|network|offline|load failed|econn|aborted/i.test(msg);
}

export function applyOutboxJob<
  T extends {
    id: number;
    status: JobStatus;
    scheduledDate: string;
    postponeReason: string | null;
    computedStatus: ComputedStatus;
    completedAt: string | null;
  },
>(job: T, ops: OutboxOp[], today = todayISO()): T {
  let next = job;
  for (const op of ops) {
    if (op.kind === "note" || op.jobId !== job.id) continue;
    if (op.kind === "done") {
      next = {
        ...next,
        status: "done",
        computedStatus: "done",
        completedAt: next.completedAt ?? new Date(op.at).toISOString(),
      };
    } else if (op.kind === "postpone") {
      const late = op.date < today;
      next = {
        ...next,
        scheduledDate: op.date,
        postponeReason: op.reason || next.postponeReason,
        computedStatus: next.status === "done" ? next.computedStatus : late ? "late" : "pending",
      };
    }
  }
  return next;
}

export function useOutbox(): OutboxOp[] {
  const [ops, setOps] = useState<OutboxOp[]>(() => read());
  useEffect(() => {
    const sync = () => setOps(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("online", sync);
    };
  }, []);
  return ops;
}
