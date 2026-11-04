import { createMemoryHistory, createRouter, RouterProvider, type AnyRoute } from "@tanstack/react-router";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { TabletTab } from "@/lib/tablet-mode";

/**
 * Extra screens (the second half of a split, and the floating window) run inside the same app,
 * each with its own little router, so they share the database, the data cache and live updates.
 */
export type PaneInfo = { id: string; onPath: (tab: TabletTab) => void };
export const PaneContext = createContext<PaneInfo | null>(null);
export const usePane = () => useContext(PaneContext);

let tree: AnyRoute | null = null;
export function setPaneRouteTree(next: AnyRoute) {
  tree = next;
}

function sameTab(here: string, tab: TabletTab) {
  return tab === "/" ? here === "/" : here === tab || here.startsWith(`${tab}/`);
}

/**
 * 1.4.69: memoized on (id, path). The shell re-renders when a split pane becomes active, the float window
 * moves, or a menu opens; none of that may re-render the whole page inside a pane. The latest onPath is
 * read through a ref, so a new callback from the parent never counts as a change.
 */
export const PaneView = memo(
  function PaneView({ id, path, onPath }: { id: string; path: TabletTab; onPath: (tab: TabletTab) => void }) {
    const [router] = useState(() =>
      tree ? createRouter({ routeTree: tree, history: createMemoryHistory({ initialEntries: [path] }) }) : null,
    );
    const latest = useRef(onPath);
    latest.current = onPath;
    const info = useMemo<PaneInfo>(() => ({ id, onPath: (tab) => latest.current(tab) }), [id]);
    useEffect(() => {
      if (!router) return;
      if (sameTab(router.state.location.pathname, path)) return;
      void router.navigate({ to: path } as never);
    }, [router, path]);
    if (!router) return null;
    return (
      <PaneContext.Provider value={info}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <RouterProvider router={router as any} />
      </PaneContext.Provider>
    );
  },
  (a, b) => a.id === b.id && a.path === b.path,
);
