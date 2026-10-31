import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidateLawn } from "@/components/job-card";
import { useTx } from "@/lib/i18n";
import { isOfflineError, readOutbox, removeOutbox, type OutboxOp } from "@/lib/offline-queue";
import { completeJob, rescheduleJob, saveDayNote } from "@/lib/server/lawn";

async function runOp(op: OutboxOp) {
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
    if (!res.ok) return;
    return;
  }
  if (op.kind === "postpone") {
    await rescheduleJob({ data: { id: op.jobId, date: op.date, reason: op.reason } });
    return;
  }
  await saveDayNote({ data: { date: op.date, body: op.body } });
}

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
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const ops = readOutbox();
      if (!ops.length || stop) return;
      const done: string[] = [];
      for (const op of ops) {
        try {
          await runOp(op);
          done.push(op.id);
        } catch (err) {
          if (isOfflineError(err)) break;
          done.push(op.id);
        }
      }
      if (done.length) {
        removeOutbox(done);
        toast.success(txRef.current("Volvió la red. Lo guardado aquí ya subió.", "The signal is back. What was saved here already uploaded."));
        await invalidateLawn(qc);
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

  if (count === 0 && !offline) return null;
  return (
    <p className="mb-3 rounded-xl border-l-4 border-hold bg-hold-bg px-3 py-2 text-sm text-hold print:hidden">
      {tx("Sin red, guardado aquí", "No signal, saved here")}
      {count > 0 ? ` · ${count}` : ""}. {tx("Sube solo cuando vuelva la señal.", "It uploads only when the signal returns.")}
    </p>
  );
}
