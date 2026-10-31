import type { QueryClient } from "@tanstack/react-query";

/**
 * Instant screens: keep the last answers of the app's screens on the device
 * (localStorage, per account) and paint them right away on open, while the
 * on-device database starts. Every restored screen is marked stale, so it
 * refreshes from the database as soon as that is ready.
 */
const MAX_ENTRY = 400_000; // characters per screen answer
const MAX_TOTAL = 2_500_000;

function storeKey(): string | null {
  try {
    const u = JSON.parse(localStorage.getItem("brizna.lastUser") || "null") as { id?: string } | null;
    return `brizna.screens.${u && typeof u.id === "string" ? u.id : "local"}`;
  } catch {
    return null;
  }
}

/** Screens that depend on today's date: shown from the snapshot only on the same day. */
const SAFE_ANY_DAY = new Set(["settings", "clients", "client", "pad", "pad-pins", "pad-client", "inventory", "rhythm", "client-changes", "balances"]);
const NEVER = new Set(["export", "backups", "pad-photos"]);
const dayOf = (t: number) => new Date(t).toLocaleDateString("en-CA");

type Saved = { v: 1; at: number; q: [unknown[], unknown][] };

export function restoreScreens(client: QueryClient) {
  const key = storeKey();
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved;
    if (saved?.v !== 1 || !Array.isArray(saved.q)) return;
    const sameDay = dayOf(saved.at) === dayOf(Date.now());
    for (const [queryKey, data] of saved.q) {
      if (data === undefined || !Array.isArray(queryKey)) continue;
      if (!sameDay && !SAFE_ANY_DAY.has(String(queryKey[0]))) continue;
      // updatedAt 1 = very old, so the screen still asks the database on mount.
      client.setQueryData(queryKey, data, { updatedAt: 1 });
    }
  } catch {
    /* a bad snapshot just means a normal start */
  }
}

export function keepScreens(client: QueryClient) {
  const key = storeKey();
  if (!key || typeof window === "undefined") return;
  let timer = 0;
  const save = () => {
    timer = 0;
    try {
      const out: [unknown[], unknown][] = [];
      let total = 0;
      const all = client
        .getQueryCache()
        .getAll()
        .filter((q) => !NEVER.has(String(q.queryKey[0])) && q.state.status === "success" && q.state.data !== undefined && q.state.dataUpdatedAt > 1)
        .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
      for (const q of all) {
        const text = JSON.stringify([q.queryKey, q.state.data]);
        if (!text || text.length > MAX_ENTRY || total + text.length > MAX_TOTAL) continue;
        total += text.length;
        out.push(JSON.parse(text) as [unknown[], unknown]);
      }
      localStorage.setItem(key, JSON.stringify({ v: 1, at: Date.now(), q: out } satisfies Saved));
    } catch {
      /* storage full or data not serialisable: skip this save */
    }
  };
  const later = () => {
    if (!timer) timer = window.setTimeout(save, 1500);
  };
  client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success") later();
  });
  const now = () => {
    if (timer) window.clearTimeout(timer);
    save();
  };
  window.addEventListener("pagehide", now);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") now();
  });
}
