/**
 * The Presentation seal (Cerca 0 foundation). While the seal is on, the app is
 * performing on the stage book, not the real one: cloud sync, the offline
 * queue's network flush, automatic backups and the native widget must all
 * stand down, so nothing built on the stage can leave the device and no real
 * queued work can land in the stage book.
 *
 * Leaf module on purpose — no imports, so any layer may read the flag without
 * a cycle. Memory only on purpose: the flag is never persisted anywhere, so a
 * cold boot always opens the real book (see stage.ts).
 */
let sealed = false;

/** True while a presentation stage is live and every egress path must no-op. */
export function sealedOn(): boolean {
  return sealed;
}

/** Flip the seal. Only stage.ts (enter/exit) calls this. */
export function setSealed(v: boolean): void {
  sealed = v;
}
