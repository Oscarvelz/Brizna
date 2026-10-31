import { useEffect, useState } from "react";
import { todayISO } from "@/lib/dates";
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
    }
  | { id: string; kind: "postpone"; jobId: number; date: string; reason: string; at: number }
  | { id: string; kind: "note"; date: string; body: string; at: number };

const KEY = "ols-outbox";
const EVENT = "ols-outbox";

function read(): OutboxOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function write(ops: OutboxOp[]) {
  localStorage.setItem(KEY, JSON.stringify(ops));
  window.dispatchEvent(new Event(EVENT));
}

export function readOutbox(): OutboxOp[] {
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
  const row = { ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() } as OutboxOp;
  if (row.kind === "done" && row.photo && row.photo.length > 120_000) row.photo = undefined;
  next.push(row);
  write(next.slice(-40));
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
