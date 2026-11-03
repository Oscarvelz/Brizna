import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useBackClose } from "@/lib/back-close";
import { useTx } from "@/lib/i18n";
import { onSyncNotice, resolveSyncConflict, snoozeSyncNotice, syncNotice, type SyncNotice as Notice } from "@/spa/sync";

/** Sync asks only when it can't decide alone: both this device and the cloud changed, or the
 *  cloud copy comes from a newer Brizna. Nothing is overwritten until a button is tapped. */
export function SyncNotice() {
  const tx = useTx();
  const titleId = useId();
  const [n, setN] = useState<Notice>(() => syncNotice());
  const [busy, setBusy] = useState(false);
  useEffect(() => onSyncNotice((next) => { setN(next); setBusy(false); }), []);
  const open = Boolean(n);
  useBackClose(open, snoozeSyncNotice);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") snoozeSyncNotice(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!n || typeof document === "undefined") return null;

  const conflict = n.kind === "conflict";
  const pick = (keep: "cloud" | "device") => { setBusy(true); void resolveSyncConflict(keep); };
  const update = () => {
    setBusy(true);
    const go = () => window.location.reload();
    try {
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).finally(go);
    } catch { go(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-end overflow-y-auto p-3 sm:place-items-center sm:p-4">
      <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0 bz-scrim" onClick={snoozeSyncNotice} />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="bz-frame bz-dialog relative my-auto w-full min-w-0 max-w-md rounded-xl bg-surface p-5 shadow-card">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {conflict ? tx("Cambios en dos lugares", "Changes in two places") : tx("Hay una Brizna más nueva", "A newer Brizna is out")}
        </h2>
        <p className="bz-dialog-text mt-2 text-muted">
          {conflict
            ? tx("Este equipo y la nube cambiaron. Guardé los dos en Copia de seguridad.", "This device and the cloud both changed. Both are saved in Backup.")
            : tx("Tu otro equipo usa una versión más nueva. Actualiza para recibir sus cambios.", "Your other device runs a newer version. Update to get its changes.")}
        </p>
        <div className="mt-5 grid gap-2">
          {conflict ? (
            <>
              <Button type="button" disabled={busy} className="whitespace-nowrap" onClick={() => pick("device")}>
                {tx("Quedarme con este equipo", "Keep this device's")}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} className="whitespace-nowrap" onClick={() => pick("cloud")}>
                {tx("Usar lo de la nube", "Use the cloud's")}
              </Button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" disabled={busy} className="whitespace-nowrap" onClick={snoozeSyncNotice}>
                {tx("Ahora no", "Not now")}
              </Button>
              <Button type="button" disabled={busy} className="whitespace-nowrap" onClick={update}>
                {tx("Actualizar", "Update")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
