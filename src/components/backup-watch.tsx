import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveBackupNow } from "@/lib/server/lawn";

const GAP = 20_000;

export function BackupWatch() {
  const qc = useQueryClient();
  useEffect(() => {
    let last = 0;
    let timer = 0;
    const run = () => {
      const now = Date.now();
      if (now - last < GAP) return;
      last = now;
      void saveBackupNow()
        .then(async () => {
          await qc.invalidateQueries({ queryKey: ["settings"] });
          await qc.invalidateQueries({ queryKey: ["backups"] });
        })
        .catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") run();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", run);
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, 3 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", run);
      window.clearInterval(timer);
    };
  }, [qc]);
  return null;
}
