import { stampDay } from "@/lib/dates";

export type BackupStamp = { id: number; at: string };

function fnv(text: string, seed: number) {
  let h = seed;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function backupChecksum(json: string) {
  return fnv(json, 0x811c9dc5) + fnv(json, 0x811c9dc5 ^ 0x9e3779b9);
}

/** JSON with object keys sorted at every level: the database (jsonb) reorders keys, so a
 *  checksum over plain JSON.stringify never matched a copy read back from it. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

export function withChecksum<T extends object>(body: T) {
  return { ...body, checksum: backupChecksum(canonicalJson(body)) };
}

/**
 * MOVIMIENTO 2 (auditoría 2026-11-08, hallazgo 13): checksum of a backup's CONTENT only —
 * everything except the fields that change on every copy even when nothing else did
 * (`savedAt`, the copy's own checksums, and the settings row's `last_backup_at` /
 * `updated_at` stamps, which snapshotBackup itself rewrites). Two copies with the same
 * content checksum hold exactly the same book, so the newer one is pure churn: the
 * snapshot path compares this against the newest stored copy and skips the insert.
 */
export function backupContentChecksum(body: unknown): string {
  if (!body || typeof body !== "object") return backupChecksum(canonicalJson(body));
  const { savedAt: _savedAt, checksum: _checksum, contentChecksum: _content, source: _source, ...rest } = body as Record<string, unknown>;
  let settings = rest.settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const { last_backup_at: _lba, updated_at: _ua, ...keep } = settings as Record<string, unknown>;
    settings = keep;
  }
  return backupChecksum(canonicalJson({ ...rest, settings }));
}

export function checksumMatches(raw: Record<string, unknown>) {
  if (typeof raw.checksum !== "string") return true;
  const { checksum, ...rest } = raw;
  return backupChecksum(canonicalJson(rest)) === checksum || backupChecksum(JSON.stringify(rest)) === checksum;
}

function dayKey(at: string) {
  return stampDay(at);
}

function weekKey(at: string) {
  const date = new Date(`${dayKey(at)}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

/** Newest 8, plus one per day for a week, plus one per week for a month. */
export function idsToKeep(rows: BackupStamp[], now = new Date()) {
  const sorted = [...rows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
  const keep = new Set<number>();
  const days = new Set<string>();
  const weeks = new Set<string>();
  const today = stampDay(now);
  sorted.forEach((row, index) => {
    const day = dayKey(row.at);
    const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
    if (index < 8) keep.add(row.id);
    if (age >= 0 && age < 7 && !days.has(day)) {
      days.add(day);
      keep.add(row.id);
    }
    if (age >= 0 && age < 31 && !weeks.has(weekKey(row.at))) {
      weeks.add(weekKey(row.at));
      keep.add(row.id);
    }
  });
  return keep;
}
