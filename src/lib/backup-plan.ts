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

export function withChecksum<T extends object>(body: T) {
  const json = JSON.stringify(body);
  return { ...body, checksum: backupChecksum(json) };
}

export function checksumMatches(raw: Record<string, unknown>) {
  if (typeof raw.checksum !== "string") return true;
  const { checksum, ...rest } = raw;
  return backupChecksum(JSON.stringify(rest)) === checksum;
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
