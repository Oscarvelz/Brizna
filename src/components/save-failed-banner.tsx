import { useEffect, useState } from "react";
import { flushFailed, onFlushFailed } from "@/lib/flush-state";
import { useTx } from "@/lib/i18n";

/**
 * MOVIMIENTO 2 (auditoría 2026-11-08, hallazgo 14): when saving to this device's
 * storage fails (full storage, IndexedDB refused), the app used to keep saying
 * everything was saved. This banner stays up — in the same strip as the offline
 * banner, in the danger tone the app already uses — until a save succeeds again.
 */
export function SaveFailedBanner() {
  const tx = useTx();
  const [failed, setFailed] = useState(() => flushFailed());

  useEffect(() => onFlushFailed(setFailed), []);

  if (!failed) return null;
  return (
    <p role="alert" className="mb-3 rounded-xl border-l-4 border-late bg-late-bg px-3 py-2 text-sm font-semibold text-late print:hidden">
      {tx("No se pudo guardar en este equipo.", "Could not save on this device.")}{" "}
      {tx(
        "Lo último que hiciste sigue solo en memoria: no cierres la app, libera espacio en el equipo y sigue trabajando; se guarda solo en cuanto el equipo acepte un guardado.",
        "Your latest work is only in memory: do not close the app, free up space on the device and keep working; it saves by itself as soon as the device accepts a save.",
      )}
    </p>
  );
}
