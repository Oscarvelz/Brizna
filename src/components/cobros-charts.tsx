import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
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
import { YearRhythm } from "@/components/year-rhythm";
import { useCifraRank, type CifraId } from "@/lib/cifras-order";
import { lastDayOfMonthISO } from "@/lib/dates";
import { smartHit } from "@/lib/fuzzy";
import { money } from "@/lib/format";
import { reasonLabel, useI18n, useTx } from "@/lib/i18n";
import { getFinanceStats } from "@/lib/server/lawn";
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
}: {
  embedded?: boolean;
  query?: string;
  effort?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const tx = useTx();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["finance"], queryFn: () => getFinanceStats() });
  const data = q.data;
  const rankNumeros = useCifraRank("numeros");
  const rankHoras = useCifraRank("horas");
  const rankFiabilidad = useCifraRank("fiabilidad");
  const rankSemana = useCifraRank("semana");
  const rankAnio = useCifraRank("anio");
  const rankPospuesto = useCifraRank("pospuesto");

  if (!ready || q.isLoading || q.isError || !data) {
    return (
      <div className={cn("grid gap-4", !embedded && "mb-6")}>
        {effort}
        {!ready || q.isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-surface-2" style={{ order: rankNumeros }} />
        ) : null}
      </div>
    );
  }

  const hasWeek = data.weekSeries.some((p) => p.collected > 0 || p.completed > 0);
  const hasMonth = data.monthSeries.some((p) => p.collected > 0 || p.cuts > 0);
  const hasYear = data.yearSeries.some((p) => p.collected > 0 || p.cuts > 0);
  const hasFlow = data.clientFlow.some((p) => p.altas > 0 || p.bajas > 0);

  const thisMonth = data.monthSeries[data.monthSeries.length - 1];
  const lastMonth = data.monthSeries[data.monthSeries.length - 2];

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
    <div className={cn("grid gap-4", !embedded && "mb-6")}>
      {effort}
      {show("números patios promedio mediana ticket cobrado propinas personas vida dinero ganado") ? (
      <Fold id="cif-numeros" style={{ order: rankNumeros }} title={tx("Números", "Numbers")} hint={<Hint manual="cifras" text={tx("Sin barras. Sirve cuando ya hay varias semanas de trabajo.", "No bars. Useful once there are several weeks of work.")} />}>
        <dl className="grid grid-cols-2 gap-2">
          <div className="col-span-2 grid grid-cols-2 gap-2 rounded-md p-1.5 ring-1 ring-border">
            <NumberCell
              label={tx("Dinero de por vida", "Lifetime money")}
              value={money(data.lifetimeCollected)}
              manual="cifras-vida-dinero"
              hint={tx(
                "Todo el dinero que ya te pagaron desde el primer cobro. Suma Cobrado de todos los años, no solo este. No es la cuenta de patios de al lado. Lo que sigue en Por cobrar no entra. Las propinas se cuentan aparte.",
                "All the money already paid to you since the first payment. It adds up Collected from every year, not just this one. It is not the yard count beside it. What is still in To collect does not count. Tips are counted apart.",
              )}
            />
            <NumberCell
              label={tx("Patios de por vida", "Lifetime yards")}
              value={String(data.lifetimeCuts)}
              manual="cifras-vida-patios"
              hint={tx(
                "Cuántos patios quedaron en Hecho, del primero al último. Es una cuenta de patios, no de dinero. Un patio sin pagar también cuenta.",
                "How many yards were marked Done, from the first to the last. It is a count of yards, not money. A yard that is not paid yet still counts.",
              )}
            />
          </div>
          <NumberCell label={tx("Patios esta semana", "Yards this week")} value={String(data.thisWeekCuts)} manual="cifras-semana" hint={tx("Los patios marcados Hecho en esta semana, de lunes a domingo.", "Yards marked Done this week, Monday through Sunday.")} />
          <NumberCell label={tx("Patios semana pasada", "Yards last week")} value={String(data.lastWeekCuts)} manual="cifras-semana-pasada" hint={tx("La misma cuenta, pero de la semana anterior.", "The same count, but for the previous week.")} />
          <NumberCell label={tx("Promedio por semana", "Average per week")} value={String(data.avgWeekCuts)} manual="cifras-promedio" hint={tx("Suma los patios de las últimas 4 semanas y los divide entre 4.", "Adds the yards from the last 4 weeks and divides by 4.")} />
          <NumberCell label={tx("Mediana por semana", "Median per week")} value={String(data.medianWeekCuts)} manual="cifras-mediana" hint={tx("El punto medio de esas semanas. No es el promedio: un día enorme no lo empuja.", "The midpoint of those weeks. It is not the average: one huge day does not push it.")} />
          <NumberCell label={tx("Ticket promedio", "Average ticket")} value={money(data.avgTicket)} manual="cifras-ticket" hint={tx("Lo cobrado este año dividido entre los patios hechos.", "Collected this year divided by the yards done.")} />
          <NumberCell label={tx("Cobrado, promedio semanal", "Collected, weekly average")} value={money(data.avgWeekCollected)} manual="cifras-cobrado-semana" hint={tx("El dinero de Cobrado de las últimas 4 semanas, dividido entre 4.", "Collected money from the last 4 weeks, divided by 4.")} />
          <NumberCell label={tx("Personas por cobrar", "People to collect")} value={String(data.owingPeople)} manual="cobros-por-cobrar" hint={tx("Cuántas personas tienen saldo en Por cobrar.", "How many people have a balance in To collect.")} />
          <NumberCell label={tx("Al corriente con saldo", "Current with a balance")} value={String(data.currentPeople)} manual="cobros-corriente" hint={tx("Deben, pero todavía no llegan a En espera ni a Alto riesgo.", "They owe, but they are not yet in Waiting or High risk.")} />
          <NumberCell label={tx("Propinas del año", "Tips this year")} value={money(data.tipsYear)} manual="propina-anio" hint={tx("Dinero de más que no cambia la deuda. No entra en Cobrado.", "Extra money that does not change the debt. It does not go into Collected.")} />
          <NumberCell label={tx("Propinas del mes", "Tips this month")} value={money(data.tipsMonth)} manual="propina-mes" hint={tx("Las propinas de este mes.", "Tips from this month.")} />
        </dl>
      </Fold>
      ) : null}
      <YearRhythm query={query} />
      {show("horas entrada salida parados") ? (
      <Fold id="cif-horas" style={{ order: rankHoras }} title={t("hours.title")} hint={<Hint manual="horas" text={t("hours.auto")} />}>
        <dl className="grid grid-cols-2 gap-2">
          <NumberCell label={t("stats.hoursToday")} value={hourText(data.hoursToday, tx)} manual="horas" hint={t("hours.auto")} />
          <NumberCell label={t("stats.hoursWeek")} value={hourText(data.hoursWeek, tx)} manual="horas" hint={t("hours.auto")} />
          <NumberCell label={t("stats.hoursMonth")} value={hourText(data.hoursMonth, tx)} manual="horas" hint={t("hours.auto")} />
          <NumberCell
            label={t("stats.stops")}
            value={String(data.stopReasons.reduce((n, row) => n + row.count, 0))}
            manual="lluvia"
            hint={tx("Días en los que paraste el trabajo y la razón que quedó guardada.", "Days you stopped work and the reason that was saved.")}
          />
        </dl>
        {data.stopReasons.length > 0 ? (
          <ul className="mt-2 grid gap-1 text-sm">
            {data.stopReasons.map((row) => (
              <li key={row.reason} className="flex justify-between gap-2">
                <span>{reasonLabel(locale, row.reason)}</span>
                <span className="tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Fold>
      ) : null}
      {show("fiabilidad espera riesgo pago") ? (
      <Fold id="cif-fiabilidad" style={{ order: rankFiabilidad }} className="border-l-4 border-hold bg-hold-bg" title={<span className="text-hold">{tx("Fiabilidad de pago", "Payment reliability")}</span>} hint={<Hint manual="fiabilidad" text={tx("Distinto del resto. Mide si la persona paga a tiempo y si el saldo se pasó de lo que tú marcaste.", "Different from the rest. It measures whether the person pays on time and whether the balance went past what you set.")} />}>
        <dl className="grid grid-cols-2 gap-2">
          <NumberCell label={tx("En espera", "Waiting")} value={String(data.waitPeople)} manual="en-espera" hint={tx("Siguen debiendo y se atrasaron, pero todavía no llegan al límite naranja.", "They still owe and fell behind, but they have not reached the orange limit yet.")} />
          <NumberCell label={tx("Alto riesgo", "High risk")} value={String(data.seriousPeople)} hold manual="alto-riesgo" hint={tx("Se pasaron de los días, del monto o de los cortes sin pagar que pusiste en Ajustes. Siguen en Por cobrar.", "They went past the days, the amount, or the unpaid cuts you set in Settings. They stay in To collect.")} />
        </dl>
      </Fold>
      ) : null}
      {show("semana anterior cortes cobrado mes") ? (
      <Fold id="cif-semana" style={{ order: rankSemana }} title={tx("Esta semana frente a la anterior", "This week versus the previous one")} hint={<Hint text={tx("El registro de cada semana se guarda. Sirve para ver si esta semana cortaste o cobraste más que la pasada.", "Each week's record is kept. It shows whether you cut or collected more this week than last week.")} />}>
        <div className="grid grid-cols-2 gap-2">
          <CompareCard
            label={tx("Cortes", "Cuts")}
            current={data.thisWeekCuts}
            previous={data.lastWeekCuts}
            format={(n) => String(n)}
            unit={tx("patios", "yards")}
          />
          <CompareCard
            label={tx("Cobrado", "Collected")}
            current={data.thisWeekCollected}
            previous={data.lastWeekCollected}
            format={money}
          />
        </div>
        {thisMonth && lastMonth ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <CompareCard
              label={tx("Cortes del mes", "Cuts this month")}
              current={thisMonth.cuts}
              previous={lastMonth.cuts}
              format={(n) => String(n)}
              unit={tx("patios", "yards")}
              quiet
            />
            <CompareCard
              label={tx("Cobrado del mes", "Collected this month")}
              current={thisMonth.collected}
              previous={lastMonth.collected}
              format={money}
              quiet
            />
          </div>
        ) : null}
        <p className="mt-3 text-sm text-muted">
          {tx(
            `Media de las últimas 4 semanas: ${data.avgWeekCuts} patios y ${money(data.avgWeekCollected)} cobrados.`,
            `Average of the last 4 weeks: ${data.avgWeekCuts} yards and ${money(data.avgWeekCollected)} collected.`,
          )}
        </p>
        <p className="mt-2 rounded-sm bg-due-bg px-3 py-2 text-sm">
          <span className="font-semibold text-due">{data.latePayers}</span>
          <span className="text-muted">
            {data.latePayers === 1
              ? tx(" cliente con fecha de pago vencida y saldo.", " client with a past due date and a balance.")
              : tx(" clientes con fecha de pago vencida y saldo.", " clients with a past due date and a balance.")}{" "}
            {tx("Solo cuenta si les pusiste día habitual.", "It only counts if you set a usual pay day.")}
          </span>
        </p>
      </Fold>
      ) : null}

      <ChartBlock
        id="cif-semana-dinero"
        place="semana-dinero"
        query={query}
        title={tx("Dinero por semana", "Money by week")}
        hint={tx("Verde: lo cobrado. Oscuro: el valor de los patios ya hechos, aunque aún no te hayan pagado. Cada barra es una semana.", "Green: money collected. Dark: the value of yards already done, even if they have not paid you yet. Each bar is a week.")}
        empty={tx("Todavía no hay cobros ni trabajos hechos para graficar.", "There are no payments or finished jobs to chart yet.")}
        hasData={hasWeek}
        height="h-44"
      >
        <BarChart data={data.weekSeries} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="var(--color-muted)"
            width={36}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(v, name) => [money(Number(v) || 0), String(name ?? tx("Monto", "Amount"))]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="collected" name={tx("Cobrado", "Collected")} fill="var(--color-done)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name={tx("Hecho", "Done")} fill="var(--color-money)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="extraAmount" name={tx("Extras", "Extras")} fill="var(--color-soil)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="onceAmount" name={tx("Una vez", "One time")} fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartBlock>

      <ChartBlock
        id="cif-mes"
        place="mes"
        query={query}
        title={tx("Dinero por mes", "Money by month")}
        hint={tx("Cada barra es un mes. Así se compara un mes con los anteriores.", "Each bar is a month. That is how one month is compared with earlier ones.")}
        empty={tx("Todavía no hay cobros este año para graficar por mes.", "There are no payments this year yet to chart by month.")}
        hasData={hasMonth}
        height="h-40"
      >
        <BarChart data={data.monthSeries} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="var(--color-muted)"
            width={36}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(v, name) => [money(Number(v) || 0), String(name ?? tx("Cobrado", "Collected"))]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="collected" name={tx("Cobrado", "Collected")} fill="var(--color-done)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="extraAmount" name={tx("Extras", "Extras")} fill="var(--color-soil)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="onceAmount" name={tx("Una vez", "One time")} fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartBlock>

      {show("cada año cortes cobrado") ? (
      <Fold id="cif-anio" style={{ order: rankAnio }} title={tx("Cada año", "Each year")} hint={<Hint text={tx("Cuánto cobraste y cuántos cortes hiciste en cada año. El conteo no se borra al cambiar de año.", "How much you collected and how many cuts you made each year. The count is not erased when the year changes.")} />}>
        {hasYear ? (
          <>
            <ul className="mb-3 grid gap-1.5">
              {[...data.yearSeries].reverse().map((y) => (
                <li
                  key={y.key}
                  className="flex items-baseline justify-between gap-2 rounded-sm bg-work-bg px-2.5 py-2"
                >
                  <span className="text-sm font-semibold text-work">{y.label}</span>
                  <span className="text-sm tabular-nums">
                    <span className="font-semibold">{y.cuts}</span>
                    <span className="text-muted">{tx(" cortes · cobrado ", " cuts · collected ")}</span>
                    <span className="font-semibold">{money(y.collected)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.yearSeries} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted)"
                    width={36}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(v) => [money(Number(v) || 0), tx("Cobrado", "Collected")]}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="collected" fill="var(--color-work)" radius={[4, 4, 0, 0]} />
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
        hint={tx("Altas: patios que añadiste ese mes. Bajas: clientes que diste de baja ese mes.", "New: yards you added that month. Departures: clients you deactivated that month.")}
        empty={tx("Cuando añadas o des de baja clientes, aquí se verá el ritmo.", "When you add or deactivate clients, the pace will show here.")}
        hasData={hasFlow}
        height="h-40"
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
        <Fold id="cif-pospuesto" style={{ order: rankPospuesto }} title={tx("Por qué se pospuso", "Why it was postponed")} hint={<Hint text={tx("Últimos 90 días. Cuenta los patios movidos con una razón.", "Last 90 days. Counts yards moved with a reason.")} />}>
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

function CompareCard({
  label,
  current,
  previous,
  format,
  unit,
  quiet,
}: {
  label: string;
  current: number;
  previous: number;
  format: (n: number) => string;
  unit?: string;
  quiet?: boolean;
}) {
  const tx = useTx();
  const delta = current - previous;
  const better = delta > 0;
  const worse = delta < 0;
  return (
    <div className={cn("rounded-sm px-2.5 py-2", quiet ? "bg-work-bg" : "bg-surface-2")}>
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
    </div>
  );
}

function hourText(minutes: number, tx: (es: string, en: string) => string) {
  const h = Math.floor((minutes || 0) / 60);
  const m = (minutes || 0) % 60;
  return m === 0 ? tx(`${h} h`, `${h} hr`) : tx(`${h} h ${m} min`, `${h} hr ${m} min`);
}

function NumberCell({
  label,
  value,
  hint,
  hold,
  manual,
}: {
  label: string;
  value: string;
  hint?: string;
  hold?: boolean;
  manual?: string;
}) {
  return (
    <div className={cn("rounded-sm px-2.5 py-2", hold ? "bg-surface" : "bg-surface-2")}>
      <dt className="flex items-center text-xs font-medium tracking-wide text-muted uppercase">
        <span className="min-w-0">{label}</span>
        {hint || manual ? <Hint manual={manual} text={hint ?? label} /> : null}
      </dt>
      <dd className={cn("font-display text-lg font-semibold tabular-nums", hold && "text-hold")}>{value}</dd>
    </div>
  );
}

function ChartBlock({
  id,
  place,
  query = "",
  title,
  hint,
  empty,
  hasData,
  height,
  children,
}: {
  id: string;
  place: CifraId;
  query?: string;
  title: string;
  hint: string;
  empty: string;
  hasData: boolean;
  height: string;
  children: ReactElement;
}) {
  const rank = useCifraRank(place);
  if (query.trim() && !smartHit(query, `${title} ${hint} ${empty}`)) return null;
  return (
    <Fold id={id} style={{ order: rank }} title={title} hint={<Hint text={hint} />}>
      {hasData ? (
        <div className={height}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </Fold>
  );
}
