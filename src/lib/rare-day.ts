import { addDaysISO, weekdayFromISO } from "@/lib/dates";

export type RareKind = "sunday" | "free";

export function rareKind(iso: string, excluded: number[], offDates: string[]): RareKind | null {
  if (!iso) return null;
  const weekday = weekdayFromISO(iso);
  if (weekday === 0) return "sunday";
  if (excluded.includes(weekday) || offDates.includes(iso)) return "free";
  return null;
}

export function mondayAfter(iso: string): string {
  const weekday = weekdayFromISO(iso);
  const hop = weekday === 0 ? 1 : (8 - weekday) % 7 || 7;
  return addDaysISO(iso, hop === 0 ? 1 : weekday === 0 ? 1 : hop);
}
