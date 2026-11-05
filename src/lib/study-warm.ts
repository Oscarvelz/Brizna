import type { QueryClient } from "@tanstack/react-query";
import { lazy, type ComponentType } from "react";
import { getAdvisor, getCifrasInsights, getFinanceStats } from "@/lib/server/lawn";

/**
 * 1.4.84 (Oscar: "que las tarjetas carguen muchísimo más rápido"): Estudio and Asesor used to load their
 * code and run their database reads only when the tab opened, so the cards sat as empty boxes for seconds.
 * Once the app is idle, the chunks and the three readings are fetched ahead and kept, so opening the tab
 * paints from cache at once and refreshes quietly behind.
 */
const loaded = new Map<() => Promise<unknown>, unknown>();
function track<M>(load: () => Promise<M>): () => Promise<M> {
  const run = () => load().then((m) => {
    loaded.set(run, m);
    return m;
  });
  return run;
}
export const loadAsesor = track(() => import("@/components/asesor"));
export const loadCharts = track(() => import("@/components/cobros-charts"));
export const loadInsights = track(() => import("@/components/cifras-insights"));

/**
 * React.lazy that renders at once when the chunk is already here: React reads a thenable that answers
 * synchronously as resolved, so there is no Suspense fallback frame (a blank box) on the way in.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNow<M, P = any>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>) {
  return lazy(() => {
    if (loaded.has(load)) {
      const mod = { default: pick(loaded.get(load) as M) };
      return { then: (ok: (v: typeof mod) => void) => ok(mod) } as unknown as Promise<typeof mod>;
    }
    return load().then((m) => ({ default: pick(m) }));
  });
}

/** Kept for half an hour, so a later visit still opens from cache (a stale copy shows, then refreshes). */
export const STUDY_GC = 30 * 60_000;

type IdleWin = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };

export function whenIdle(fn: () => void, timeout = 1500) {
  const w = window as IdleWin;
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 60);
}

const idleStep = () => new Promise<void>((resolve) => whenIdle(resolve));

let warmed = false;

/** Called from the shell once per session: waits for the app to settle, then warms Estudio and Asesor. */
export function warmStudy(qc: QueryClient, delay = 2500) {
  if (warmed) return;
  warmed = true;
  window.setTimeout(() => {
    whenIdle(async () => {
      try {
        await Promise.all([loadAsesor(), loadCharts(), loadInsights()]);
        const reads: [string, () => Promise<unknown>][] = [
          ["advisor", () => getAdvisor()],
          ["finance", () => getFinanceStats()],
          ["cifras-insights", () => getCifrasInsights()],
        ];
        for (const [key, queryFn] of reads) {
          await idleStep();
          if (qc.getQueryData([key]) === undefined) await qc.prefetchQuery({ queryKey: [key], queryFn, gcTime: STUDY_GC });
        }
      } catch {
        /* offline chunk or a read failed: the tab simply loads as before */
      }
    }, 3000);
  }, delay);
}
