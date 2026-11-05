import { ConfirmDialog } from "@/components/confirm-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Compass } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { lazyNow, loadAsesor, loadCharts, loadInsights, whenIdle } from "@/lib/study-warm";
// Charts load only when Estudio opens, so the app starts lighter.
// 1.4.84: the shell warms these chunks once the app is idle (study-warm), so they are usually ready here.
const CobrosCharts = lazyNow(loadCharts, (m) => m.CobrosCharts);
const AsesorPanel = lazyNow(loadAsesor, (m) => m.AsesorPanel);
const CifrasInsightsSections = lazyNow(loadInsights, (m) => m.CifrasInsightsSections);
import { CifrasOrderButton } from "@/components/cifras-order-button";
import { EffortWeek } from "@/components/effort-week";
import { foldsOpen, setFoldsOpen } from "@/components/fold";
import { AppShell, TitleSearch } from "@/components/app-shell";
import { ScrollTop } from "@/components/scroll-top";
import { todayISO } from "@/lib/dates";
import { useCifraRank } from "@/lib/cifras-order";
import { useI18n, useTx } from "@/lib/i18n";
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
  const { locale } = useI18n();
  const esfuerzoRank = useCifraRank("esfuerzo");
  const today = todayISO();
  const [view, setViewState] = useState<StudyView>(readView);
  // 1.4.84: a view stays mounted once shown (hidden when the other is on), so switching back paints at
  // once and its entrance replays; the other view is also mounted ahead, hidden, once the page is idle.
  const [mounted, setMounted] = useState<Record<StudyView, boolean>>(() => ({ estudio: view === "estudio", asesor: view === "asesor" }));
  // Estudio is heavier, so it waits longer; hidden (display none) it costs no layout or paint until shown.
  const other: StudyView = view === "asesor" ? "estudio" : "asesor";
  const otherReady = mounted[other];
  useEffect(() => {
    if (otherReady) return;
    let live = true;
    const t = window.setTimeout(
      () => whenIdle(() => live && setMounted((m) => ({ ...m, [other]: true })), 2500),
      other === "asesor" ? 1200 : 2500,
    );
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [other, otherReady]);
  const setView = (v: StudyView) => {
    setMounted((m) => (m[v] ? m : { ...m, [v]: true }));
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const flip = () => setView(readView() === "asesor" ? "estudio" : "asesor");
    window.addEventListener("bz-study-swipe", flip);
    return () => window.removeEventListener("bz-study-swipe", flip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // 1.4.84: the panels open on their cached reading (refetchOnMount off) and refresh here once the
  // entrance has played, so the database reads never hold up the first cards.
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => whenIdle(() => {
      if (!live) return;
      for (const key of ["advisor", "finance", "cifras-insights"]) void qc.invalidateQueries({ queryKey: [key] });
    }), 700);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [qc]);
  // 1.4.84: only a NEW pass counts (not the cached one present on arrival: the panels' own mount refetch
  // covers that), and the recount waits for idle so it never competes with the cards' first paint.
  const seenDash = useRef(dash.dataUpdatedAt);
  useEffect(() => {
    if (!dash.dataUpdatedAt || dash.dataUpdatedAt === seenDash.current) return;
    seenDash.current = dash.dataUpdatedAt;
    whenIdle(() => {
      void qc.invalidateQueries({ queryKey: ["cifras-insights"] });
      void qc.invalidateQueries({ queryKey: ["advisor"] });
    });
  }, [dash.dataUpdatedAt, qc]);

  // 1.4.84: each view's body is memoized, so flipping Estudio/Asesor re-renders neither (the hidden one
  // stays untouched; the shown one only becomes visible).
  const asesorBody = useMemo(() => (
          <Suspense fallback={<div className="as-skel" aria-busy><span /><span /></div>}>
            <AsesorPanel />
          </Suspense>
  ), []);
  const estudioBody = useMemo(() => (
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [locale, expandAll, askFold, query, data, dash.isLoading, today, esfuerzoRank]);

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
      {mounted.asesor ? (
        <div hidden={view !== "asesor"}>
          {asesorBody}
        </div>
      ) : null}
      {mounted.estudio ? (
      <div hidden={view !== "estudio"}>
      {estudioBody}
      </div>
      ) : null}
    </AppShell>
  );
}
