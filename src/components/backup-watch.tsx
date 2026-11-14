import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveBackupNow } from "@/lib/server/lawn";
import { sealedOn } from "@/lib/presentation/seal-flag";
import { whenIdle } from "@/lib/study-warm";

const GAP = 20_000;

export function BackupWatch() {
  const qc = useQueryClient();
  useEffect(() => {
    let last = 0;
    let timer = 0;
    // MOVIMIENTO 2 (hallazgos 13 y 15): the periodic watcher used to force a full copy
    // of the whole book every 3 minutes. Now the tick is a no-op when nothing was
    // written since its last run — the write epoch is bumped by every POST in the
    // device runtime — and even when it does call, snapshotBackup itself skips the
    // insert when the book's content checksum matches the newest stored copy. The
    // 3-minute tick also runs on idle time instead of interrupting whatever the
    // person just tapped. Leaving the app (hide / pagehide) still copies at once:
    // that copy protects real work.
    let lastEpoch: number | null = null;
    const epoch = () => Number((globalThis as { __bzWriteEpoch?: number }).__bzWriteEpoch ?? 0);
    const run = (force = false) => {
      // Presentation seal (Cerca 0): no automatic backup while sealed — a copy
      // of the stage book must never land among the real book's backups. This
      // covers the interval tick and the hide/pagehide forced runs alike.
      if (sealedOn()) return;
      const now = Date.now();
      if (now - last < GAP) return;
      if (!force && lastEpoch !== null && epoch() === lastEpoch) return;
      last = now;
      const atEpoch = epoch();
      void saveBackupNow()
        .then(async () => {
          lastEpoch = atEpoch;
          await qc.invalidateQueries({ queryKey: ["settings"] });
          await qc.invalidateQueries({ queryKey: ["backups"] });
        })
        .catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") run(true);
    };
    const onPageHide = () => run(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") whenIdle(() => run());
    }, 3 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(timer);
    };
  }, [qc]);
  return null;
}
