import type { QueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/server/lawn";
import type { ClientRow } from "@/lib/types";

/**
 * 1.4.95 (Oscar: tapping a client showed "Cliente" and one big empty box before the file appeared).
 * The Clientes list already holds every client's row (name, chips, phone, address, debt), the same row the
 * file reads. The file paints from that row at once, and its own reading (cuts, movements, photos) starts on
 * the finger's touch instead of after the page has changed.
 */
export type ClientFile = Awaited<ReturnType<typeof getClient>>;

export const clientKey = (id: number) => ["client", id] as const;

/** The row this client already has in any cached Clientes list (or null). */
export function rowFromLists(qc: QueryClient, id: number): ClientRow | null {
  for (const [, list] of qc.getQueriesData<unknown>({ queryKey: ["clients"] })) {
    if (!Array.isArray(list)) continue;
    const hit = (list as ClientRow[]).find((c) => c && typeof c === "object" && c.id === id && "pricePerCut" in c);
    if (hit) return hit;
  }
  return null;
}

/** Starts the file's reading now; a second call while it runs (or while it is fresh) does nothing. */
export function prefetchClient(qc: QueryClient, id: number) {
  if (!Number.isFinite(id)) return;
  const state = qc.getQueryState(clientKey(id));
  if (state?.fetchStatus === "fetching") return;
  if (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < 5_000) return;
  void qc.prefetchQuery({ queryKey: clientKey(id), queryFn: () => getClient({ data: { id } }), staleTime: 5_000 });
}

const FILE_HREF = /#\/clientes\/(\d+)(?:[?/]|$)/;

let hooked = false;

/** Once per app: any press on a link to a client's file (Clientes, Hoy, Agenda, Cobros) starts its reading. */
export function installClientPrefetch(qc: QueryClient) {
  if (hooked || typeof document === "undefined") return;
  hooked = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const a = (event.target as Element | null)?.closest?.("a[href]");
      const m = a?.getAttribute("href")?.match(FILE_HREF);
      if (m) prefetchClient(qc, Number(m[1]));
    },
    { capture: true, passive: true },
  );
}
