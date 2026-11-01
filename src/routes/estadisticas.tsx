import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Compass } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
// Charts load only when Estudio opens, so the app starts lighter.
const CobrosCharts = lazy(() => import("@/components/cobros-charts").then((m) => ({ default: m.CobrosCharts })));
const AsesorPanel = lazy(() => import("@/components/asesor").then((m) => ({ default: m.AsesorPanel })));
const CifrasInsightsSections = lazy(() => import("@/components/cifras-insights").then((m) => ({ default: m.CifrasInsightsSections })));
import { CifrasOrderButton } from "@/components/cifras-order-button";
import { EffortWeek } from "@/components/effort-week";
import { foldsOpen, setFoldsOpen } from "@/components/fold";
import { AppShell, TitleSearch } from "@/components/app-shell";
import { ScrollTop } from "@/components/scroll-top";
import { todayISO } from "@/lib/dates";
import { useCifraRank } from "@/lib/cifras-order";
import { useTx } from "@/lib/i18n";
import { getDashboard } from "@/lib/server/lawn";

export const Route = createFileRoute("/estadisticas")({ component: EstadisticasPage });

type StudyView = "estudio" | "asesor";
const VIEW_KEY = "bz-estudio-view";

function readView(): StudyView {
  try {
    return localStorage.getItem(VIEW_KEY) === "asesor" ? "asesor" : "estudio";
  } catch {
    return "estudio";
  }
}

/** Big two-way pill at the top: Estudio (the figures) | Asesor (the coach). Remembered on this device. */
function StudyToggle({ view, onChange }: { view: StudyView; onChange: (v: StudyView) => void }) {
  const tx = useTx();
  return (
    <div className={`as-toggle${view === "asesor" ? " is-right" : ""}`} role="tablist" aria-label={tx("Vista", "View")}>
      <span className="as-toggle-thumb" aria-hidden />
      <button type="button" role="tab" aria-selected={view === "estudio"} className={view === "estudio" ? "is-on" : undefined} onClick={() => onChange("estudio")}>
        <BarChart3 aria-hidden />
        {tx("Estudio", "Study")}
      </button>
      <button type="button" role="tab" aria-selected={view === "asesor"} className={view === "asesor" ? "is-on" : undefined} onClick={() => onChange("asesor")}>
        <Compass aria-hidden />
        {tx("Asesor", "Advisor")}
      </button>
    </div>
  );
}

function EstadisticasPage() {
  const tx = useTx();
  const esfuerzoRank = useCifraRank("esfuerzo");
  const today = todayISO();
  const [view, setViewState] = useState<StudyView>(readView);
  const setView = (v: StudyView) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
    window.scrollTo({ top: 0 });
  };
  const [findOn, setFindOn] = useState(false);
  const [needle, setNeedle] = useState("");
  const [expandAll, setExpandAll] = useState(() => foldsOpen("cif-"));
  const query = findOn ? needle : "";
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const data = dash.data;
  // Hoy's schedule pass (getDashboard) can add this month's upcoming cuts: recount "Este mes" after it.
  const qc = useQueryClient();
  useEffect(() => {
    if (dash.dataUpdatedAt) {
      void qc.invalidateQueries({ queryKey: ["cifras-insights"] });
      void qc.invalidateQueries({ queryKey: ["advisor"] });
    }
  }, [dash.dataUpdatedAt, qc]);

  return (
    <AppShell
      title={tx("Estudio", "Study")}
      titleExtra={view === "estudio" ? <CifrasOrderButton /> : undefined}
      action={
        view === "asesor" ? undefined : <TitleSearch
          open={findOn}
          onToggle={() => setFindOn((value) => !value)}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar una cifra", "Search a figure")}
          label={tx("Buscar en Estudio", "Search Study")}
        />
      }
    >
      <ScrollTop />
      <StudyToggle view={view} onChange={setView} />
      {view === "asesor" ? (
        <Suspense fallback={<div className="as-skel" aria-busy><span /><span /></div>}>
          <AsesorPanel />
        </Suspense>
      ) : (
      <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted">
          {tx(
            "Cómo va el negocio de un vistazo: el mes, lo que te deben, tus mejores clientes y tus días fuertes. Toca cualquier cifra para ver más.",
            "How the business is doing at a glance: the month, what you are owed, your best clients, and your strong days. Tap any figure to see more.",
          )}
        </p>
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={expandAll}
            aria-label={tx("Desplegar todo", "Expand all")}
            onChange={(e) => {
              const open = e.target.checked;
              setExpandAll(open);
              setFoldsOpen("cif-", open);
            }}
          />
          {tx("Desplegar", "Expand")}
        </label>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface-2" />}>
      <CobrosCharts
        query={query}
        extra={<CifrasInsightsSections query={query} />}
        effort={
          data ? (
            <EffortWeek
              days={data.weekEffort}
              today={today}
              weekDone={data.stats.weekDoneCount}
              goals={data.weekGoals}
              query={query}
            />
          ) : dash.isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-surface-2" style={{ order: esfuerzoRank }} />
          ) : null
        }
      />
      </Suspense>
      </>
      )}
    </AppShell>
  );
}
