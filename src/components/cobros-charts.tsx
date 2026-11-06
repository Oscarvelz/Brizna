import { masonryCols, useMasonry, usePageWidth } from "@/components/wide-layout";
import { useQuery } from "@tanstack/react-query";
import { STUDY_GC } from "@/lib/study-warm";
import { useNavigate } from "@tanstack/react-router";
import { useRef, type ReactElement, type ReactNode } from "react";
import { Clock3, CloudRain } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Hint } from "@/components/hint";
import { Fold } from "@/components/fold";
import { WeekToDate } from "@/components/cifras-insights";
import { Blade, CountUp, Lead, secStyle } from "@/components/cifras-visuals";
import { useCifraRank, type CifraId } from "@/lib/cifras-order";
import { lastDayOfMonthISO, weekdayFromISO } from "@/lib/dates";
import { smartHit } from "@/lib/fuzzy";
import { findHint, pick } from "@/lib/manual/topics";
import { money, weekdayOptions } from "@/lib/format";
import { reasonLabel, useI18n, useTx } from "@/lib/i18n";
import { getFinanceStats } from "@/lib/server/lawn";
import type { MoneyPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

export function CobrosCharts({
  embedded = false,
  query = "",
  effort = null,
  extra = null,
}: {
  embedded?: boolean;
  query?: string;
  effort?: ReactNode;
  /** The 1.2 sections (Este mes, tendencia, deudas…), placed by their own order. */
  extra?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const tx = useTx();
  // Large screens: the sections flow into steady columns (phones keep one column).
  const box = useRef<HTMLDivElement | null>(null);
  useMasonry(box, embedded ? 0 : masonryCols(usePageWidth()));
  const navigate = useNavigate();
  // 1.4.84: no first-pass skeleton (an SSR-era guard): with the reading cached, the charts paint at once.
  const q = useQuery({ queryKey: ["finance"], queryFn: () => getFinanceStats(), gcTime: STUDY_GC, refetchOnMount: false });
  const data = q.data;
  const rankHoras = useCifraRank("horas");
  const rankSemana = useCifraRank("semana");
  const rankAnio = useCifraRank("anio");
  const rankPospuesto = useCifraRank("pospuesto");

  if (q.isLoading || q.isError || !data) {
    return (
      <div ref={box} className={cn("grid gap-4", !embedded && "mb-6")}>
        {effort}
        {extra}
        {q.isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-surface-2" style={{ order: rankSemana }} />
        ) : null}
      </div>
    );
  }

  const hasWeek = data.weekSeries.some((p) => p.collected > 0 || p.completed > 0);
  const hasYear = data.yearSeries.some((p) => p.collected > 0 || p.cuts > 0);
  const hasLife = data.lifetimeCollected > 0 || data.lifetimeJobs > 0;
  const hasFlow = data.clientFlow.some((p) => p.altas > 0 || p.bajas > 0);

  const weekStack = data.weekSeries.map((p) => ({
    ...p,
    cutAmount: Math.max(0, Math.round((p.completed - p.extraAmount - p.onceAmount) * 100) / 100),
  }));
  const firstYear = data.yearSeries.findIndex((y) => y.collected > 0 || y.cuts > 0);
  const years = firstYear > 0 ? data.yearSeries.slice(firstYear) : data.yearSeries;

  const show = (text: string) => !query.trim() || smartHit(query, text);

  function openFlow(which: "altas" | "bajas", raw: unknown) {
    const payload = (raw as { payload?: { key?: string } } | undefined)?.payload;
    const key = payload?.key;
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const [y, m] = key.split("-").map(Number);
    void navigate({
      to: "/clientes",
      search: {
        filter: which === "bajas" ? "inactive" : "active",
        flow: which,
        since: key,
        until: lastDayOfMonthISO(y!, m!),
      },
    });
  }

  return (
    <div ref={box} className={cn("grid gap-4", !embedded && "mb-6")}>
      {effort}
      {extra}
      {show("horas entrada salida parados") ? (
      <Fold id="cif-horas" style={secStyle(rankHoras)} className="cif-sec" title={t("hours.title")} hint={<Hint topic="horas" />}>
        <Lead
          kicker={t("stats.hoursWeek")}
          figure={hourText(data.hoursWeek, tx)}
          tone="pending"
          sentence={tx(`En el mes llevas ${hourText(data.hoursMonth, tx)}.`, `This month you have ${hourText(data.hoursMonth, tx)}.`)}
        />
        {/* 1.4.91 (Oscar: "se ve apagado"): toned tiles with an inline icon chip; the stop reasons ride as small chips
            beside the count instead of a loose row underneath. */}
        <dl className="cif-hts">
          <div className="cif-ht is-hours">
            <dt className="cif-ht-head">
              <span className="min-w-0">{t("stats.hoursToday")}</span>
              <Hint compact topic="horas" />
            </dt>
            <dd className="cif-ht-val">
              <span className="cif-ht-ic" aria-hidden><Clock3 /></span>
              {hourText(data.hoursToday, tx)}
            </dd>
          </div>
          <div className="cif-ht is-stop">
            <dt className="cif-ht-head">
              <span className="min-w-0">{t("stats.stops")}</span>
              <Hint compact topic="dias-parados" />
            </dt>
            <dd className="cif-ht-val">
              <span className="cif-ht-ic" aria-hidden><CloudRain /></span>
              {String(data.stopReasons.reduce((n, row) => n + row.count, 0))}
              {data.stopReasons.map((row) => (
                <span key={row.reason} className="cif-ht-chip">
                  {data.stopReasons.length > 1 ? `${row.count} ` : ""}
                  {reasonLabel(locale, row.reason).toLocaleLowerCase(locale)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </Fold>
      ) : null}
      {show("semana anterior cortes cobrado dinero por semana barras trabajo hecho") ? (
      <Fold
        id="cif-semana"
        style={secStyle(rankSemana)}
        className="cif-sec"
        title={tx("Esta semana y la pasada", "This week vs. last")}
        hint={<Hint topic="semana-vs" />}
      >
        <WeekToDate>
          {(w) => w ? <WeekNow w={w} /> : null}
        </WeekToDate>
        {hasWeek ? <WeekBars weeks={weekStack} /> : (
          <p className="text-sm text-muted">{tx("Todavía no hay cobros ni trabajos hechos para graficar.", "There are no payments or finished jobs to chart yet.")}</p>
        )}
        <p className="cif-note-line">
          <Blade className="cif-note-blade" />
          {tx(
            `Media de las 4 semanas cerradas: ${data.avgWeekCuts} cortes y ${money(Math.round(data.avgWeekCollected))} cobrados por semana.`,
            `Average of the 4 closed weeks: ${data.avgWeekCuts} cuts and ${money(Math.round(data.avgWeekCollected))} collected a week.`,
          )}
        </p>
      </Fold>
      ) : null}

      {show("cada año cortes cobrado vida dinero de por vida patios") ? (
      <Fold id="cif-anio" style={secStyle(rankAnio)} className="cif-sec" title={tx("Cada año", "Each year")} hint={<Hint topic="cada-anio" />}>
        {hasLife ? (
          <div className="cif-tiles cif-tiles-2 cif-life">
            <div className="cif-tile">
              <span className="cif-tile-label">{tx("Cobrado de por vida", "Lifetime collected")}</span>
              <CountUp className="cif-tile-value text-done" value={data.lifetimeCollected} format={money} />
              <span className="cif-tile-note">{tx("desde el primer cobro", "since the first payment")}</span>
            </div>
            <div className="cif-tile">
              <span className="cif-tile-label">{tx("Cortes de por vida", "Lifetime cuts")}</span>
              <CountUp className="cif-tile-value" value={data.lifetimeCuts} format={(n) => n.toLocaleString("en-US")} />
              <span className="cif-tile-note">
                {data.lifetimeJobs > data.lifetimeCuts
                  ? tx(`${data.lifetimeJobs.toLocaleString("en-US")} trabajos con extras y de una vez`, `${data.lifetimeJobs.toLocaleString("en-US")} jobs with extras and one-time`)
                  : tx("hechos, pagados o no", "done, paid or not")}
              </span>
            </div>
          </div>
        ) : null}
        {hasYear ? (
          <>
            <ul className="mb-3 grid gap-1.5">
              {[...years].reverse().map((y) => (
                <li key={y.key} className="grid gap-0.5 rounded-sm bg-work-bg px-2.5 py-2">
                  {/* 1.4.61 (Oscar): three rows per year: the year, cuts · collected, work hours */}
                  <span className="text-sm font-semibold text-work">{y.label}</span>
                  <span className="text-sm tabular-nums whitespace-nowrap">
                    <span className="font-semibold">{y.cuts}</span>
                    <span className="text-muted">{tx(" cortes · cobrado ", " cuts · collected ")}</span>
                    <span className="font-semibold">{money(y.collected)}</span>
                  </span>
                  <span className="text-sm tabular-nums whitespace-nowrap">
                    <span className="text-muted">{tx("Horas de trabajo ", "Work hours ")}</span>
                    <span className="font-semibold">{y.minutes ? hourText(y.minutes, tx) : "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={years} barGap={2} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted)"
                    width={44}
                    tickFormatter={(v) => (Number(v) >= 1000 ? `$${Math.round(Number(v) / 1000)}k` : `$${v}`)}
                  />
                  <Tooltip
                    formatter={(v) => [money(Number(v) || 0), tx("Cobrado", "Collected")]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="collected" fill="var(--color-done)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{tx("Cuando haya cortes y cobros, aquí se verá cada año.", "When there are cuts and payments, each year will show here.")}</p>
        )}
      </Fold>
      ) : null}

      <ChartBlock
        id="cif-clientes"
        place="clientes"
        query={query}
        title={tx("Clientes nuevos y bajas", "New clients and departures")}
        topic="altas-bajas"
        empty={tx("Cuando añadas o des de baja clientes, aquí se verá el ritmo.", "When you add or deactivate clients, the pace will show here.")}
        hasData={hasFlow}
        height="h-40"
        legend={[[tx("Nuevos", "New"), "var(--color-today)"], [tx("Bajas", "Departures"), "var(--color-late)"]]}
      >
        <BarChart data={data.clientFlow} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="var(--color-muted)" width={24} />
          <Tooltip
            formatter={(v, name) => [v, name === "altas" ? tx("Nuevos", "New") : tx("Bajas", "Departures")]}
            contentStyle={tooltipStyle}
          />
          <Bar
            dataKey="altas"
            fill="var(--color-today)"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(row) => openFlow("altas", row)}
          />
          <Bar
            dataKey="bajas"
            fill="var(--color-late)"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(row) => openFlow("bajas", row)}
          />
        </BarChart>
      </ChartBlock>

      {data.postponeReasons.length > 0 && show("pospuso razón") ? (
        <Fold id="cif-pospuesto" style={secStyle(rankPospuesto)} className="cif-sec" title={tx("Por qué se pospuso", "Why it was postponed")} hint={<Hint topic="pospuesto" />}>
          <ul className="grid gap-1.5">
            {data.postponeReasons.map((row) => (
              <li key={row.reason} className="flex items-center justify-between rounded-sm bg-soil-bg px-2.5 py-2 text-sm">
                <span className="font-semibold text-soil">{row.reason}</span>
                <span className="tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </Fold>
      ) : null}
    </div>
  );
}

type WeekNowData = { cuts: number; jobs: number; collected: number; prevCuts: number; prevJobs: number; prevCollected: number; through: string };

/** This week to date against last week to the same weekday: big collected figure, one sentence, two cards. */
function WeekNow({ w }: { w: WeekNowData }) {
  const tx = useTx();
  const day = weekdayOptions().find((d) => d.value === weekdayFromISO(w.through))?.label ?? "";
  const diff = Math.round((w.collected - w.prevCollected) * 100) / 100;
  const extra = w.jobs - w.cuts;
  return (
    <div className="cif-rise">
      <Lead
        kicker={tx(`Cobrado esta semana, hasta el ${day.toLowerCase()}`, `Collected this week, through ${day}`)}
        figure={<CountUp value={w.collected} format={money} />}
        tone="done"
        sentence={w.prevCollected <= 0 && w.collected <= 0
          ? tx("Todavía nada cobrado, igual que la semana pasada a esta altura.", "Nothing collected yet, same as last week at this point.")
          : diff > 0
            ? tx(`Vas ${money(diff)} arriba de la semana pasada a esta altura.`, `You are ${money(diff)} ahead of last week at this point.`)
            : diff < 0
              ? tx(`Vas ${money(-diff)} abajo de la semana pasada a esta altura.`, `You are ${money(-diff)} behind last week at this point.`)
              : tx("Igual que la semana pasada a esta altura.", "Same as last week at this point.")}
      />
      <div className="grid grid-cols-2 gap-2">
        <CompareCard label={tx("Cortes", "Cuts")} current={w.cuts} previous={w.prevCuts} format={(n) => String(n)} unit={tx("hechos", "done")} note={extra > 0 ? tx(`+${extra} extras o de una vez`, `+${extra} extras or one-time`) : undefined} />
        <CompareCard label={tx("Cobrado", "Collected")} current={w.collected} previous={w.prevCollected} format={money} />
      </div>
    </div>
  );
}

/** The last 8 weeks as bars that grow like grass: collected beside the value of the work done. */
function WeekBars({ weeks }: { weeks: (MoneyPoint & { cutAmount: number })[] }) {
  const tx = useTx();
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.collected, w.completed)));
  const best = weeks.reduce((b, w, i) => (w.collected > (weeks[b]?.collected ?? 0) ? i : b), 0);
  const h = (v: number) => `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`;
  return (
    <div className="mt-4">
      <p className="cif-kicker">{tx("Últimas 8 semanas", "Last 8 weeks")}</p>
      <div className="cif-wbars" role="img" aria-label={weeks.map((w) => `${w.label}: ${money(w.collected)} / ${money(w.completed)}`).join(", ")}>
        {weeks.map((w, i) => {
          const now = i === weeks.length - 1;
          return (
            <div key={w.key} className={cn("cif-wbar", now && "is-now")} title={`${w.label} · ${tx("Cobrado", "Collected")} ${money(w.collected)} · ${tx("Trabajo", "Work")} ${money(w.completed)}`}>
              <span className="cif-wbar-val">{w.collected > 0 ? shortMoney(w.collected) : ""}</span>
              <div className="cif-wbar-pair" style={{ animationDelay: `${i * 55}ms` }}>
                <span className={cn("cif-wbar-paid", i === best && w.collected > 0 && "is-best")} style={{ height: h(w.collected) }} />
                <span className="cif-wbar-work" style={{ height: h(w.completed) }}>
                  <i className="bg-pending" style={{ flexGrow: w.onceAmount }} />
                  <i className="bg-soil" style={{ flexGrow: w.extraAmount }} />
                  <i className="bg-money" style={{ flexGrow: w.cutAmount }} />
                </span>
              </div>
              <span className="cif-wbar-day">{now ? tx("esta", "now") : w.label}</span>
            </div>
          );
        })}
      </div>
      <div className="cif-stack-legend">
        <span><i style={{ background: "var(--color-done)" }} />{tx("Cobrado", "Collected")}</span>
        <span><i style={{ background: "var(--color-money)" }} />{tx("Cortes", "Cuts")}</span>
        <span><i style={{ background: "var(--color-soil)" }} />{tx("Extras", "Extras")}</span>
        <span><i style={{ background: "var(--color-pending)" }} />{tx("Una vez", "One time")}</span>
      </div>
    </div>
  );
}

function shortMoney(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
}

function CompareCard({
  label,
  current,
  previous,
  format,
  unit,
  note,
}: {
  label: string;
  current: number;
  previous: number;
  format: (n: number) => string;
  unit?: string;
  note?: string;
}) {
  const tx = useTx();
  const delta = current - previous;
  const better = delta > 0;
  const worse = delta < 0;
  return (
    <div className="cif-compare">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums">
        {format(current)}
        {unit ? <span className="ml-1 text-xs font-medium text-muted">{unit}</span> : null}
      </p>
      <p
        className={cn(
          "text-xs font-medium",
          better && "text-done",
          worse && "text-late",
          !better && !worse && "text-muted",
        )}
      >
        {delta === 0
          ? tx("Igual que la anterior", "Same as the previous")
          : `${better ? "+" : "−"}${format(Math.abs(delta))} ${tx("vs anterior", "vs previous")}`}
      </p>
      {note ? <p className="cif-compare-note">{note}</p> : null}
    </div>
  );
}

function hourText(minutes: number, tx: (es: string, en: string) => string) {
  const h = Math.floor((minutes || 0) / 60);
  const m = (minutes || 0) % 60;
  return m === 0 ? tx(`${h} h`, `${h} hr`) : tx(`${h} h ${m} min`, `${h} hr ${m} min`);
}

function ChartBlock({
  id,
  place,
  query = "",
  title,
  topic,
  empty,
  hasData,
  height,
  children,
  legend,
}: {
  legend?: [string, string][];
  id: string;
  place: CifraId;
  query?: string;
  title: string;
  topic: string;
  empty: string;
  hasData: boolean;
  height: string;
  children: ReactElement;
}) {
  const rank = useCifraRank(place);
  const { locale } = useI18n();
  const entry = findHint(topic);
  if (query.trim() && !smartHit(query, `${title} ${entry ? pick(locale, entry.what) : ""} ${empty}`)) return null;
  return (
    <Fold id={id} style={secStyle(rank)} className="cif-sec" title={title} hint={<Hint topic={topic} />}>
      {hasData ? (
        <>
          <div className={height}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
          {legend ? (
            <div className="cif-stack-legend">
              {legend.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </Fold>
  );
}
