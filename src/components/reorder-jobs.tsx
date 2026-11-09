import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDensity, useQuadCols } from "@/components/density-toggle";
import { JobCard } from "@/components/job-card";
import { viewGrid } from "@/lib/density";
import { useTx } from "@/lib/i18n";
import { reorderJobs } from "@/lib/server/lawn";
import type { JobRow } from "@/lib/types";

export function ReorderableJobs({
  jobs,
  enabled,
}: {
  jobs: JobRow[];
  enabled: boolean;
}) {
  const [order, setOrder] = useState(jobs.map((j) => j.id));
  const orderRef = useRef(order);
  const drag = useRef<{ id: number; pointerId: number } | null>(null);
  const density = useDensity();
  const tx = useTx();
  const cols = useQuadCols();
  const grid = viewGrid(density, cols, density === "dense" ? "gap-1.5" : density === "compact" ? "gap-2" : "gap-3");

  useEffect(() => {
    const ids = jobs.map((j) => j.id);
    setOrder(ids);
    orderRef.current = ids;
  }, [jobs]);

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const ordered = order.map((id) => byId.get(id)).filter((j): j is JobRow => Boolean(j));

  function move(fromId: number, toId: number) {
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(fromId);
      const to = next.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      orderRef.current = next;
      return next;
    });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: number) {
    if (!enabled) return;
    const handle = (e.target as HTMLElement).closest("[data-drag-handle]");
    if (!handle) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, pointerId: e.pointerId };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest("[data-job-id]") as HTMLElement | null;
    const overId = row ? Number(row.dataset.jobId) : NaN;
    if (!Number.isFinite(overId) || overId === drag.current.id) return;
    move(drag.current.id, overId);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    void reorderJobs({ data: { ids: orderRef.current } });
  }

  if (!enabled) {
    return (
      <div className={grid}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    );
  }

  return (
    <div className={grid}>
      {density === "dense" ? null : (
        <p className="col-span-full text-xs font-medium text-muted">
          {tx("Mantén el asa a la izquierda y mueve con el dedo para ordenar la ruta.", "Hold the handle on the left and drag to order the route.")}
        </p>
      )}
      {ordered.map((job) => (
        <div
          key={job.id}
          data-job-id={job.id}
          onPointerDown={(e) => onPointerDown(e, job.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <JobCard job={job} dragHandle />
        </div>
      ))}
    </div>
  );
}
