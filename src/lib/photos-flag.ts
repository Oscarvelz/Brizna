// Photos are switched off on purpose (Oct 31, 2026): Oscar wants Brizna light, with no
// storage growth on the device or in Supabase. Flip to true only if he asks for photos back.
//
// DECISION (Movimiento 2, auditoría 2026-11-08, hallazgo 19 — read this before flipping):
// photos are NOT part of backups or of sync, by design, until they get their own channel.
// - Backups: collectBackup (lib/server/lawn.ts) never reads client_photos / pad_photos,
//   and bulkRestore drops the jobs.photo column — no copy contains any photo.
// - Sync: the snapshot's table list excludes the photo tables and readTables
//   (spa/sync.ts) nulls jobs.photo before packing.
// That combination was an armed trap: with photos on, the first sync pull or backup
// restore would replace whole tables and silently delete every photo on the device.
// Guards now in place for the day this flips: applyBackup refuses to restore (visible
// error) when the device holds photos a copy cannot carry, and sync's apply() refuses
// to pull a snapshot over local photos. Before enabling, photos still need their own
// sync/storage channel — the guards are a stop sign, not the channel.
export const PHOTOS_ENABLED = false;
