import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Fold } from "@/components/fold";
import { Hint } from "@/components/hint";
import { NativeSelect } from "@/components/ui/input";
import { monthParts, todayISO } from "@/lib/dates";
import { monthNames, weekdayOptions } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { getSettings, getYearRhythm } from "@/lib/server/lawn";
import { smartHit } from "@/lib/fuzzy";
import { useCifraRank } from "@/lib/cifras-order";
import { cn } from "@/lib/utils";

function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function ReasonLine({
  posts,
  stops,
  offs,
}: {
  posts: { reason: string; count: number }[];
  stops: { reason: string; count: number }[];
  offs: { reason: string; count: number }[];
}) {
  const tx = useTx();
  const merged = new Map<string, number>();
  for (const row of [...posts, ...stops, ...offs]) {
    const reason = row.reason.trim();
    if (!reason) continue;
    merged.set(reason, (merged.get(reason) ?? 0) + row.count);
  }
  const rows = [...merged.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  if (rows.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold">{tx("¿Por qué no se trabajó?", "Why was it not worked?")}</p>
      <ul className="mt-1 grid gap-0.5">
        {rows.map(([reason, count]) => (
          <li key={reason} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{reason}</span>
            <span className="shrink-0 tabular-nums text-muted">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthBlocks({ months }: { months: number[] }) {
  const tx = useTx();
  const names = monthNames();
  const [open, setOpen] = useState<number | null>(null);
  const counts = months.length === 12 ? months : Array.from({ length: 12 }, () => 0);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        <p className="text-sm font-semibold">{tx("Meses", "Months")}</p>
        <Hint
          text={tx(
            "Doce bloques, uno por mes del año que estás mirando. Arriba va el número del mes. Abajo, más pequeño, cuántos días hábiles no se trabajaron. No entra el día que casi nunca se trabaja, si ya lo marcaste en Agenda: suele ser el domingo. Toca un mes para leer la frase.",
            "Twelve blocks, one per month of the year you are looking at. The month number is on top. Below, smaller, is how many business days were not worked. The day that is almost never worked stays out, if you already marked it on Schedule: it is usually Sunday. Tap a month to read the sentence.",
          )}
        />
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {counts.map((count, index) => {
          const month = index + 1;
          const on = open === month;
          return (
            <button
              key={month}
              type="button"
              onClick={() => setOpen(on ? null : month)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-md bg-bg",
                on && "ring-1 ring-primary",
              )}
            >
              <span className="text-sm font-semibold leading-none">{month}</span>
              <span className="mt-1 text-[11px] leading-none text-muted tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      {open ? (
        <p className="mt-2 text-sm text-muted">
          {tx(
            `En ${names[open - 1]?.toLowerCase() ?? open} no se ${counts[open - 1] === 1 ? "trabajó" : "trabajaron"} ${counts[open - 1]} ${counts[open - 1] === 1 ? "día" : "días"}.`,
            `In ${names[open - 1] ?? open}, ${counts[open - 1]} ${counts[open - 1] === 1 ? "day was" : "days were"} not worked.`,
          )}
        </p>
      ) : null}
    </div>
  );
}

export function YearRhythm({ query = "" }: { query?: string }) {
  const tx = useTx();
  const rank = useCifraRank("ritmo");
  const now = monthParts(todayISO());
  const [year, setYear] = useState(now.year);
  const [skipRare, setSkipRare] = useState(() => {
    try {
      return localStorage.getItem("ols-rhythm-skip") === "1";
    } catch {
      return false;
    }
  });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const q = useQuery({
    queryKey: ["rhythm", year, skipRare],
    queryFn: () => getYearRhythm({ data: { year, skipRare } }),
  });
  const data = q.data;
  const total = (data?.worked ?? 0) + (data?.rest ?? 0);
  const workPct = total > 0 ? Math.round(((data?.worked ?? 0) / total) * 100) : 0;
  const years = Array.from({ length: 6 }, (_, i) => now.year - i);
  const rare = (settings.data?.excludedWeekdays ?? [])
    .map((day) => weekdayOptions().find((item) => item.value === day)?.label)
    .filter(Boolean)
    .join(", ");
  const blob = tx(
    "Días del año trabajo descanso horas hábiles casi nunca",
    "Days in the year work rest hours business almost never",
  );
  if (query.trim() && !smartHit(query, blob)) return null;

  return (
    <Fold
      id="cif-ritmo"
      style={{ order: rank }}
      title={
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{tx("Días del año", "Days in the year")}</span>
          <NativeSelect
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label={tx("Año", "Year")}
            className="h-8 w-auto bg-transparent px-1 shadow-none"
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </span>
      }
      hint={
        <Hint
          manual="ritmo"
          text={tx(
            "Compara los días con horas de trabajo y los días de descanso. Un día a medias cuenta con sus horas exactas. La palomilla deja fuera el día que casi nunca se trabaja. Abajo, las razones vienen de patios pospuestos, de Parar por lluvia y de los días libres marcados en Agenda.",
            "Compares days with work hours and rest days. A partial day still counts its exact hours. The check leaves out the day that is almost never worked. Below, the reasons come from postponed yards, Stop for rain, and days off marked on Schedule.",
          )}
        />
      }
    >
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={skipRare}
          onChange={(e) => {
            setSkipRare(e.target.checked);
            try {
              localStorage.setItem("ols-rhythm-skip", e.target.checked ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
        />
        <span className="min-w-0 flex-1">{tx("No contar el día que casi nunca se trabaja", "Leave out the day that is almost never worked")}</span>
        <Hint
          text={tx(
            "Ese día suele ser el domingo. Si marcas la casilla, se omite: no entra en los días trabajados ni en los de descanso.",
            "That day is usually Sunday. If you check the box, it is left out: it does not count as a worked day or a rest day.",
          )}
        />
      </label>
      {skipRare ? (
        <p className="mt-1 text-xs text-muted">
          {rare
            ? tx(`Fuera del conteo: ${rare}.`, `Left out: ${rare}.`)
            : tx(
                "Todavía no hay un día marcado en Agenda. Márcalo en Días libres de esta semana.",
                "No day is marked on Schedule yet. Mark it under Days off this week.",
              )}
        </p>
      ) : null}
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-sun">
        <div className="bg-done" style={{ width: `${workPct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {data
          ? tx(
              `${data.worked} trabajados · ${data.rest} sin trabajar · ${hoursLabel(data.minutes)}`,
              `${data.worked} worked · ${data.rest} not worked · ${hoursLabel(data.minutes)}`,
            )
          : "…"}
      </p>
      {data && data.todayMinutes > 0 && year === now.year ? (
        <p className="text-xs text-muted">
          {tx(
            `Hoy lleva ${hoursLabel(data.todayMinutes)}. Si el día no terminó, esas horas ya entran.`,
            `Today has ${hoursLabel(data.todayMinutes)} so far. If the day is not finished, those hours already count.`,
          )}
        </p>
      ) : null}
      {data ? <ReasonLine posts={data.posts} stops={data.stops} offs={data.offs} /> : null}
      {data ? <MonthBlocks months={data.months} /> : null}
    </Fold>
  );
}