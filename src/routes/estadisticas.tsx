import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CobrosCharts } from "@/components/cobros-charts";
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
            "Metas, cortes y cobros a lo largo del tiempo. Aquí encontrará la información técnica de todo su trabajo duro.",
            "Goals, cuts, and collections over time. Here you will find the technical record of all your hard work.",
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
