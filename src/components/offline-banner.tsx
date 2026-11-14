import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidateLawn } from "@/components/job-card";
import { useTx } from "@/lib/i18n";
import { addFailed, clearFailed, isOfflineError, readOutbox, removeOutbox, useFailed, type FailedOp, type OutboxOp } from "@/lib/offline-queue";
import { sealedOn } from "@/lib/presentation/seal-flag";
import { completeJob, rescheduleJob, saveDayNote } from "@/lib/server/lawn";

/** Applies one queued op. Returns "gone" when the server refused it because the job is
 *  no longer there to apply it to — that op can never succeed and must not vanish
 *  silently (1.5.51, auditoría interna D6). Throws on real errors; the caller sorts
 *  network errors (stay queued) from the rest (the failed list). */
async function runOp(op: OutboxOp): Promise<"applied" | "gone"> {
  if (op.kind === "done") {
    const res = await completeJob({
      data: {
        id: op.jobId,
        settlement: op.settlement,
        abono: op.abono,
        method: op.method || undefined,
        photo: op.photo,
        tip: op.tip,
      },
    });
    // completeJob answers ok:false only when the job does not exist (already-done is
    // ok:true + skipped, i.e. the intent was achieved by another path).
    return res.ok ? "applied" : "gone";
  }
  if (op.kind === "postpone") {
    const res = await rescheduleJob({ data: { id: op.jobId, date: op.date, reason: op.reason } });
    return res.ok ? "applied" : "gone";
  }
  await saveDayNote({ data: { date: op.date, body: op.body } });
  return "applied";
}

// 1.5.51 (D5): flush used to have no re-entry guard — it runs on mount and on every
// "online" event, and ops were removed only at the end, so two overlapping passes could
// run the same ops at the same time. One pass at a time now, module-wide.
let flushing = false;

export function OfflineBanner() {
  const tx = useTx();
  const txRef = useRef(tx);
  txRef.current = tx;
  const qc = useQueryClient();
  const [count, setCount] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCount(readOutbox().length);
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    };
    sync();
    const onBox = () => sync();
    window.addEventListener("ols-outbox", onBox);
    window.addEventListener("online", onBox);
    window.addEventListener("offline", onBox);
    return () => {
      window.removeEventListener("ols-outbox", onBox);
      window.removeEventListener("online", onBox);
      window.removeEventListener("offline", onBox);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function flush() {
      if (flushing || stop) return;
      // Presentation seal (Cerca 0): never flush while sealed (see offline-queue's readOutbox gate).
      if (sealedOn()) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const ops = readOutbox();
      if (!ops.length) return;
      flushing = true;
      try {
        const applied: string[] = [];
        const failed: FailedOp[] = [];
        for (const op of ops) {
          if (stop) break;
          try {
            const r = await runOp(op);
            if (r === "applied") applied.push(op.id);
            else failed.push({ op, why: "gone", at: Date.now() });
          } catch (err) {
            // The signal died mid-pass: this op and everything after it stay queued.
            if (isOfflineError(err)) break;
            // 1.5.51 (D6): a real refusal used to be counted as uploaded and buried.
            // It goes to the failed list now, where it stays visible until dismissed.
            failed.push({ op, why: err instanceof Error ? err.message : String(err ?? ""), at: Date.now() });
          }
        }
        if (applied.length) removeOutbox(applied);
        if (failed.length) {
          removeOutbox(failed.map((f) => f.op.id));
          addFailed(failed);
        }
        if (applied.length) {
          toast.success(txRef.current("Volvió la red. Lo guardado aquí ya subió.", "The signal is back. What was saved here already uploaded."));
        }
        if (failed.length) {
          toast.error(
            txRef.current(
              `${failed.length} no pudieron subirse. Quedan anotados en el aviso de arriba.`,
              `${failed.length} could not upload. They are noted in the banner above.`,
            ),
          );
        }
        if (applied.length || failed.length) await invalidateLawn(qc);
      } finally {
        flushing = false;
      }
    }
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    void flush();
    return () => {
      stop = true;
      window.removeEventListener("online", onOnline);
    };
  }, [qc]);

  const failed = useFailed();

  if (count === 0 && !offline && failed.length === 0) return null;
  return (
    <>
      {count > 0 || offline ? (
        <p className="mb-3 rounded-xl border-l-4 border-hold bg-hold-bg px-3 py-2 text-sm text-hold print:hidden">
          {tx("Sin red, guardado aquí", "No signal, saved here")}
          {count > 0 ? ` · ${count}` : ""}. {tx("Sube solo cuando vuelva la señal.", "It uploads only when the signal returns.")}
        </p>
      ) : null}
      {failed.length ? (
        <p className="mb-3 rounded-xl border-l-4 border-late bg-late-bg px-3 py-2 text-sm text-late print:hidden">
          {tx(
            `${failed.length} guardados no pudieron subirse a este libro (su trabajo ya no estaba, hubo un rechazo o se restauró una copia).`,
            `${failed.length} saved items could not upload to this book (their job was gone, there was a refusal, or a copy was restored).`,
          )}{" "}
          <button type="button" className="font-semibold underline" onClick={() => clearFailed()}>
            {tx("Descartar aviso", "Dismiss notice")}
          </button>
        </p>
      ) : null}
    </>
  );
}
