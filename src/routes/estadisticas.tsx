import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { DayNightSwitch } from "@/components/day-night-switch";
import { WeatherChip } from "@/components/weather-chip";
import { getDashboard } from "@/lib/server/lawn";

const FOLD_UNTIL_KEY = "bz-cif-folded-until";
const FOLD_MINUTES = 5;
function foldedUntil(): number {
  try {
    return Number(localStorage.getItem(FOLD_UNTIL_KEY)) || 0;
  } catch {
    return 0;
  }
}

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
    <div data-spot="estudio" className={`as-toggle${view === "asesor" ? " is-right" : ""}`} role="tablist" aria-label={tx("Vista", "View")}>
      <span className="as-toggle-thumb" aria-hidden />
      <button type="button" role="tab" aria-selected={view === "estudio"} className={view === "estudio" ? "is-on" : undefined} onClick={() => onChange("estudio")}>
        <BarChart3 aria-hidden />
        {tx("Estudio", "Stats")}
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
  // 1.4.61 (Oscar): Desplegar is checked by default, always. Unchecking asks first, folds everything,
  // and re-checks itself after FOLD_MINUTES.
  const [expandAll, setExpandAll] = useState(() => foldedUntil() <= Date.now());
  const [askFold, setAskFold] = useState(false);
  useEffect(() => {
    const until = foldedUntil();
    const reopen = () => {
      try { localStorage.removeItem(FOLD_UNTIL_KEY); } catch { /* private mode */ }
      setExpandAll(true);
      setFoldsOpen("cif-", true);
    };
    if (until <= Date.now()) {
      if (!foldsOpen("cif-")) reopen();
      return;
    }
    const timer = window.setTimeout(reopen, until - Date.now());
    return () => window.clearTimeout(timer);
  }, [expandAll]);
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
      title={tx("Estudio", "Stats")}
      titleExtra={view === "estudio" ? <CifrasOrderButton /> : undefined}
      action={
        <span className="inline-flex items-center gap-3">
          <WeatherChip />
          {view === "asesor" ? null : <TitleSearch
          open={findOn}
          onToggle={() => setFindOn((value) => !value)}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar cifra", "Search")}
          label={tx("Buscar en Estudio", "Search Stats")}
        />}
          <span className="mr-2 grid w-10 shrink-0 place-items-center">
            <DayNightSwitch />
          </span>
        </span>
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
              if (!e.target.checked) {
                setAskFold(true);
                return;
              }
              try { localStorage.removeItem(FOLD_UNTIL_KEY); } catch { /* private mode */ }
              setExpandAll(true);
              setFoldsOpen("cif-", true);
            }}
          />
          {tx("Desplegar", "Expand")}
        </label>
      </div>
      <ConfirmDialog
        open={askFold}
        title={tx("¿Plegar todo?", "Fold everything?")}
        description={tx(
          `Cada bloque queda plegado y solo ves los títulos. En ${FOLD_MINUTES} minutos se vuelve a desplegar solo.`,
          `Every block folds to its title. In ${FOLD_MINUTES} minutes it unfolds again on its own.`,
        )}
        confirmLabel={tx("Plegar", "Fold")}
        cancelLabel={tx("Cancelar", "Cancel")}
        onConfirm={() => {
          setAskFold(false);
          try { localStorage.setItem(FOLD_UNTIL_KEY, String(Date.now() + FOLD_MINUTES * 60_000)); } catch { /* private mode */ }
          setExpandAll(false);
          setFoldsOpen("cif-", false);
        }}
        onCancel={() => setAskFold(false)}
      />
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
