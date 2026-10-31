import { formatTime } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import type { JobRow } from "@/lib/types";

const SEEN_KEY = "ols-reminders-seen";

function seenSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function markSeen(keys: string[]) {
  const set = seenSet();
  for (const k of keys) set.add(k);
  const today = todayISO();
  const keep = [...set].filter((k) => k.includes(today) || k.startsWith("late:"));
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(keep.slice(-80)));
  } catch {
    /* ignore */
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function minutesNow(timeZone = "America/New_York"): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function parseMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fireJobReminders(
  jobs: JobRow[],
  opts: { enabled: boolean; minutesBefore: number; businessName: string },
) {
  if (!opts.enabled || !notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  const today = todayISO();
  const nowMin = minutesNow();
  const seen = seenSet();
  const fired: string[] = [];

  const overdue = jobs.filter((j) => j.computedStatus === "late");
  if (overdue.length > 0) {
    const key = `late:${today}:${overdue.length}`;
    if (!seen.has(key)) {
      new Notification(opts.businessName, {
        body:
          overdue.length === 1
            ? `Hay 1 corte atrasado: ${overdue[0]!.clientName}`
            : `Hay ${overdue.length} cortes atrasados por hacer`,
        tag: "ols-late",
      });
      fired.push(key);
    }
  }

  for (const job of jobs) {
    if (job.status !== "pending" || job.scheduledDate !== today) continue;
    const arrival = parseMinutes(job.arrivalTime);
    const key = `today:${today}:${job.id}`;
    if (seen.has(key)) continue;
    const due =
      arrival == null
        ? true
        : arrival - opts.minutesBefore <= nowMin && nowMin <= arrival + 15;
    if (!due) continue;
    const when = formatTime(job.arrivalTime);
    new Notification(job.clientName, {
      body: when
        ? `Llegada ${when} · ${job.clientAddress || "Corte de hoy"}`
        : job.clientAddress || "Corte pendiente para hoy",
      tag: `ols-job-${job.id}`,
    });
    fired.push(key);
  }

  if (fired.length) markSeen(fired);
}
