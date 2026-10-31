import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CobrosCharts } from "@/components/cobros-charts";
import { CifrasInsightsSections } from "@/components/cifras-insights";
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

function EstadisticasPage() {
  const tx = useTx();
  const esfuerzoRank = useCifraRank("esfuerzo");
  const today = todayISO();
  const [findOn, setFindOn] = useState(false);
  const [needle, setNeedle] = useState("");
  const [expandAll, setExpandAll] = useState(() => foldsOpen("cif-"));
  const query = findOn ? needle : "";
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const data = dash.data;
  // Hoy's schedule pass (getDashboard) can add this month's upcoming cuts: recount "Este mes" after it.
  const qc = useQueryClient();
  useEffect(() => {
    if (dash.dataUpdatedAt) void qc.invalidateQueries({ queryKey: ["cifras-insights"] });
  }, [dash.dataUpdatedAt, qc]);

  return (
    <AppShell
      title={tx("Estadísticas", "Statistics")}
      titleExtra={<CifrasOrderButton />}
      action={
        <TitleSearch
          open={findOn}
          onToggle={() => setFindOn((value) => !value)}
          value={needle}
          onChange={setNeedle}
          placeholder={tx("Buscar una cifra", "Search a figure")}
          label={tx("Buscar en Cifras", "Search Figures")}
        />
      }
    >
      <ScrollTop />
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
    </AppShell>
  );
}
