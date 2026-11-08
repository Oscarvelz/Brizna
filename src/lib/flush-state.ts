/**
 * MOVIMIENTO 2 (auditoría 2026-11-08, hallazgo 14): whether the last attempt to save
 * the on-device database to this device's storage FAILED. The device database layer
 * (src/spa/db.ts) publishes here; the shell's SaveFailedBanner subscribes. Kept as a
 * tiny standalone module so UI code never imports the database layer itself (the
 * server build's @/lib/db is a different module with no flush concept — there this
 * simply stays false and the banner never renders).
 */
let failed = false;
const listeners = new Set<(failed: boolean) => void>();

export function setFlushFailed(value: boolean): void {
  if (failed === value) return;
  failed = value;
  listeners.forEach((fn) => fn(value));
}

export function flushFailed(): boolean {
  return failed;
}

export function onFlushFailed(fn: (failed: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
