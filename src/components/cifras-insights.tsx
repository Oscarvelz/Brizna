import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Fold } from "@/components/fold";
import { Hint } from "@/components/hint";
import { useCifraRank } from "@/lib/cifras-order";
import { money, monthNames, weekdayOptions } from "@/lib/format";
import { smartHit } from "@/lib/fuzzy";
import { useI18n, useTx } from "@/lib/i18n";
import { getCifrasInsights, type CifrasInsights, type CifrasMonth } from "@/lib/server/lawn";
import { cn } from "@/lib/utils";
import { Blade, CountUp, GrassMeter, Lead, SunRing, secStyle, useArrived, useReducedMotion } from "@/components/cifras-visuals";

type Tx = (es: string, en: string) => string;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const short = (v: number) => (Math.abs(v) >= 10000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : money(Math.round(v)));

function Delta({ now, before, tx, unit = "money", note }: { now: number; before: number; tx: Tx; unit?: "money" | "count"; note?: string }) {
  if (before <= 0 && now <= 0) return <span className="cif-delta text-muted">—</span>;
  if (before <= 0) return <span className="cif-delta text-done"><ArrowUpRight aria-hidden />{tx("nuevo", "new")}{note ? ` ${note}` : ""}</span>;
  const change = Math.round(((now - before) / before) * 100);
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const diff = now - before;
  return (
    <span className={cn("cif-delta", change > 0 ? "text-done" : change < 0 ? "text-late" : "text-muted")} title={unit === "money" ? `${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))}` : undefined}>
      <Icon aria-hidden />
      {change > 0 ? "+" : change < 0 ? "−" : ""}
      {Math.abs(change)}%{note ? <span className="ml-1 font-medium text-muted">{note}</span> : null}
    </span>
  );
}

function monthName(key: string, long = true) {
  const m = Number(key.slice(5, 7));
  const name = monthNames()[m - 1] ?? key;
  return long ? name : name.slice(0, 3);
}

function useInsights(enabled = true) {
  return useQuery({ queryKey: ["cifras-insights"], queryFn: () => getCifrasInsights(), enabled });
}

/* ------------------------------------------------------------------ Este mes */

function Ring({ collected, done, planned, empty }: { collected: number; done: number; planned: number; empty: boolean }) {
  const arrived = useArrived();
  const size = 172;
  const c = size / 2;
  const r1 = 74;
  const r2 = 58;
  const L1 = 2 * Math.PI * r1;
  const L2 = 2 * Math.PI * r2;
  const base = planned > 0 ? planned : Math.max(collected, done, 1);
  const f1 = empty ? 0 : Math.min(1, collected / base);
  const f2 = empty ? 0 : Math.min(1, done / base);
  const over = !empty && collected > base;
  return (
    <svg className="cif-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="cifRingA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--color-done) 70%, #fff)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-done)" }} />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r1} className="cif-ring-track" strokeWidth={14} />
      <circle cx={c} cy={c} r={r2} className="cif-ring-track" strokeWidth={8} />
      <circle
        cx={c} cy={c} r={r1} fill="none" stroke="url(#cifRingA)" strokeWidth={14} strokeLinecap="round"
        strokeDasharray={L1} strokeDashoffset={arrived ? L1 * (1 - f1) : L1}
        transform={`rotate(-90 ${c} ${c})`} className={cn("cif-ring-arc", over && "cif-ring-over")}
      />
      <circle
        cx={c} cy={c} r={r2} fill="none" strokeWidth={8} strokeLinecap="round" className="cif-ring-arc cif-ring-work"
        strokeDasharray={L2} strokeDashoffset={arrived ? L2 * (1 - f2) : L2}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

function PulseSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const rank = useCifraRank("pulso");
  const p = data.pulse;
  const title = tx("Este mes", "This month");
  if (query.trim() && !smartHit(query, `${title} cobrado esperado mes deben falta hacer pronóstico tasa cobro propinas`)) return null;
  const month = monthName(data.today.slice(0, 7));
  const empty = !data.hasData;
  const rate = pct(p.rate90.collected, p.rate90.done);
  const left = p.restValue + p.lateValue;
  const prevName = monthName(addMonthKey(data.today.slice(0, 7), -1));
  return (
    <Fold
      id="cif-pulso"
      style={secStyle(rank)}
      defaultOpen
      className="cif-sec cif-hero"
      title={<span className="flex items-baseline gap-2">{title}<span className="font-sans text-sm font-medium text-muted">{month}</span></span>}
      peek={money(p.collected)}
      hint={<Hint text={tx(
        "El anillo grande es lo cobrado este mes. El de adentro, el trabajo ya hecho. Los dos se miden contra lo esperado: lo que vale todo el trabajo agendado del mes (hecho, por hacer y atrasado).",
        "The big ring is what you collected this month. The inner one is the work already done. Both are measured against expected: what all of this month's scheduled work is worth (done, still to do, and late).",
      )} />}
    >
      {empty || p.planned <= 0 ? null : (
      <p className="cif-lead-line cif-lead-solo cif-rise">
        {p.collected >= p.planned
            ? tx(`Ya cobraste todo lo esperado de ${month.toLowerCase()}.`, `You already collected everything expected for ${month}.`)
            : tx(
                `Llevas el ${pct(p.collected, p.planned)}% de lo esperado. Faltan ${money(Math.max(0, p.planned - p.collected))} por entrar.`,
                `You are at ${pct(p.collected, p.planned)}% of expected. ${money(Math.max(0, p.planned - p.collected))} still to come in.`,
              )}
      </p>
      )}
      <div className="cif-hero-body">
      <div className="cif-pulse cif-rise">
        <div className="cif-pulse-ring">
          <Ring collected={p.collected} done={p.doneValue} planned={p.planned} empty={empty} />
          <div className="cif-pulse-center">
            <span className="cif-pulse-label">{tx("Cobrado", "Collected")}</span>
            <CountUp className="cif-pulse-big" value={p.collected} format={money} />
            <span className="cif-pulse-of">
              {p.planned > 0 ? tx(`de ${money(p.planned)} esperados`, `of ${money(p.planned)} expected`) : tx("sin trabajo agendado", "no work scheduled")}
            </span>
            {p.planned > 0 ? <span className="cif-pulse-pct">{pct(p.collected, p.planned)}%</span> : null}
          </div>
        </div>
        <div className="cif-pulse-side">
          <ul className="cif-legend">
            <li><i className="bg-done" />{tx("Cobrado", "Collected")}<b data-v={p.collected}>{money(p.collected)}</b></li>
            <li><i className="cif-dot-work" />{tx("Trabajo hecho", "Work done")}<b data-v={p.doneValue}>{money(p.doneValue)}</b><small>{p.doneCount} {tx(p.doneCount === 1 ? "trabajo" : "trabajos", p.doneCount === 1 ? "job" : "jobs")}</small></li>
            <li><i className="cif-dot-rest" />{tx("Falta por hacer", "Still to do")}<b data-v={p.restValue}>{money(p.restValue)}</b><small>{p.restCount} {tx("agendados", "scheduled")}</small></li>
            {p.lateCount > 0 ? (
              <li><i className="bg-hold" />{tx("Atrasado", "Late")}<b data-v={p.lateValue}>{money(p.lateValue)}</b><small>{p.lateCount} {tx("sin marcar", "not marked")}</small></li>
            ) : null}
          </ul>
          <p className="cif-forecast">
            {left > 0
              ? tx(
                  `Si haces lo que queda, el trabajo del mes llega a ${money(p.doneValue + left)}.`,
                  `If you do what is left, this month's work reaches ${money(p.doneValue + left)}.`,
                )
              : p.doneValue > 0
                ? tx("Todo lo agendado de este mes ya está hecho.", "Everything scheduled this month is done.")
                : tx("Cuando agendes y marques cortes, aquí verás cómo va el mes.", "When you schedule and mark cuts, this shows how the month is going.")}
          </p>
        </div>
      </div>
      <div className="cif-tiles cif-rise" style={{ animationDelay: "80ms" }}>
        <Link to="/cobros" className="cif-tile cif-tile-link">
          <span className="cif-tile-label">{tx("Te deben", "Owed to you")}</span>
          <CountUp className={cn("cif-tile-value", p.outstanding > 0 && "text-hold")} value={p.outstanding} format={money} />
          <span className="cif-tile-note">{p.owingPeople} {tx(p.owingPeople === 1 ? "persona" : "personas", p.owingPeople === 1 ? "person" : "people")}<ChevronRight aria-hidden /></span>
        </Link>
        <div className="cif-tile">
          <span className="cif-tile-label">{tx(`vs ${prevName} a esta fecha`, `vs ${prevName} to date`)}</span>
          <span className="cif-tile-value"><Delta now={p.collected} before={p.prevCollectedToDate} tx={tx} /></span>
          <span className="cif-tile-note">{tx(`entonces ${money(p.prevCollectedToDate)}`, `then ${money(p.prevCollectedToDate)}`)}</span>
        </div>
        <div className="cif-tile">
          <span className="cif-tile-label">{tx("Tasa de cobro · 90 días", "Collection rate · 90 days")}</span>
          <span className="cif-tile-value" data-v={rate}>{p.rate90.done > 0 ? `${rate}%` : "—"}</span>
          <span className="cif-meter" aria-hidden><span style={{ width: `${Math.min(100, rate)}%` }} /></span>
          <span className="cif-tile-note">{p.rate90.done > 0 ? tx(`De cada $100 de trabajo, cobraste $${rate}`, `Of every $100 of work, you collected $${rate}`) : tx("Aún sin trabajo", "No work yet")}</span>
          {p.rate90.done > 0 ? (
            <span className={cn("cif-tile-foot", rate > 100 && "is-on")}>
              {tx("Puede pasar de 100%: los pagos adelantados cuentan cuando entran.", "It can go over 100%: prepayments count when they come in.")}
            </span>
          ) : null}
        </div>
        <div className="cif-tile">
          <span className="cif-tile-label">{tx("Propinas del mes", "Tips this month")}</span>
          <CountUp className={cn("cif-tile-value", p.tips > 0 && "text-due")} value={p.tips} format={money} />
          <span className="cif-tile-note">{tx("aparte de lo cobrado", "apart from collected")}</span>
        </div>
      </div>
      </div>
    </Fold>
  );
}

function addMonthKey(key: string, n: number) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ Tendencia */

function TrendSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const { locale } = useI18n();
  const reduced = useReducedMotion();
  const rank = useCifraRank("mes");
  const [pick, setPick] = useState<number | null>(null);
  const title = tx("Ingresos, mes a mes", "Income, month by month");
  const months = data.months;
  const rows = useMemo(
    () => months.map((m) => ({ ...m, short: `${monthName(m.key, false)}${m.key.slice(5, 7) === "01" ? ` ${m.key.slice(2, 4)}` : ""}` })),
    [months, locale],
  );
  if (query.trim() && !smartHit(query, `${title} dinero mes tendencia cobrado trabajo ingresos`)) return null;
  const has = months.some((m) => m.collected > 0 || m.doneValue > 0);
  const firstWith = months.findIndex((m) => m.collected > 0 || m.doneValue > 0);
  const shown = firstWith > 0 ? rows.slice(Math.max(0, firstWith - 1)) : rows;
  const idx = pick ?? shown.length - 1;
  const sel = shown[idx];
  const prevSel = idx > 0 ? shown[idx - 1] : undefined;
  const complete = months.filter((m) => !m.partial);
  const total12 = months.reduce((s, m) => s + m.collected, 0);
  const best = [...complete].sort((a, b) => b.collected - a.collected)[0];
  const lastFull = complete[complete.length - 1];
  const beforeFull = complete[complete.length - 2];
  return (
    <Fold
      id="cif-mes"
      style={secStyle(rank)}
      className="cif-sec"
      defaultOpen
      title={title}
      peek={lastFull ? money(lastFull.collected) : undefined}
      hint={<Hint text={tx(
        "Verde: lo cobrado cada mes. Línea punteada: lo que valió el trabajo hecho ese mes. Si la línea va por encima del verde, quedó dinero por cobrar. El último mes va en curso. Toca un mes para ver el detalle.",
        "Green: collected each month. Dotted line: what the work done that month was worth. When the line runs above the green, money was left to collect. The last month is in progress. Tap a month for details.",
      )} />}
    >
      {has ? (
        <div className="cif-rise">
          <div className="cif-trend-head">
            <div>
              <p className="cif-kicker">{tx("Últimos 12 meses", "Last 12 months")}</p>
              <p className="cif-figure"><CountUp value={Math.round(total12 * 100) / 100} format={money} /></p>
            </div>
            {lastFull && beforeFull ? (
              <div className="text-right">
                <p className="cif-kicker">{tx(`${monthName(lastFull.key)} vs ${monthName(beforeFull.key)}`, `${monthName(lastFull.key)} vs ${monthName(beforeFull.key)}`)}</p>
                <p className="cif-figure-sm"><Delta now={lastFull.collected} before={beforeFull.collected} tx={tx} /></p>
              </div>
            ) : null}
          </div>
          <div className="h-48 select-none" onClick={(e) => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={shown}
                margin={{ top: 8, right: 6, bottom: 0, left: 2 }}
                onClick={(state) => {
                  const i = (state as { activeTooltipIndex?: number | string } | null)?.activeTooltipIndex;
                  if (i != null && Number.isFinite(Number(i))) setPick(Number(i));
                }}
              >
                <defs>
                  <linearGradient id="cifTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--color-done)", stopOpacity: 0.42 }} />
                    <stop offset="1" style={{ stopColor: "var(--color-done)", stopOpacity: 0.02 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
                <XAxis dataKey="short" tick={{ fontSize: 10, fill: "var(--color-muted)" }} stroke="var(--color-border)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted)" }} stroke="transparent" width={44} tickFormatter={(v) => short(Number(v))} />
                <Tooltip content={<TrendTip tx={tx} />} cursor={{ stroke: "var(--color-muted)", strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="collected" stroke="var(--color-done)" strokeWidth={2.5} fill="url(#cifTrendFill)" isAnimationActive={!reduced} animationDuration={900} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }} dot={false} />
                <Line type="monotone" dataKey="doneValue" stroke="var(--color-money)" strokeWidth={1.75} strokeDasharray="4 4" dot={false} isAnimationActive={!reduced} animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="cif-legend-row">
            <span><i className="bg-done" />{tx("Cobrado", "Collected")}</span>
            <span><i className="cif-dash" />{tx("Trabajo hecho", "Work done")}</span>
            {best ? <span className="ml-auto text-muted">{tx(`Mejor mes: ${monthName(best.key)} · ${money(best.collected)}`, `Best month: ${monthName(best.key)} · ${money(best.collected)}`)}</span> : null}
          </div>
          {sel ? (
            <div className="cif-pick" key={sel.key}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-base font-semibold">{monthName(sel.key)} {sel.key.slice(0, 4)}{sel.partial ? <span className="ml-1.5 font-sans text-xs font-medium text-muted">{tx("en curso", "in progress")}</span> : null}</p>
                {sel.partial ? (
                  <Delta now={data.pulse.collected} before={data.pulse.prevCollectedToDate} tx={tx} note={tx("a esta fecha", "to date")} />
                ) : prevSel ? (
                  <Delta now={sel.collected} before={prevSel.collected} tx={tx} note={tx(`vs ${monthName(prevSel.key, false).toLowerCase()}`, `vs ${monthName(prevSel.key, false)}`)} />
                ) : null}
              </div>
              <dl className="cif-pick-grid">
                <div><dt>{tx("Cobrado", "Collected")}</dt><dd>{money(sel.collected)}</dd></div>
                <div><dt>{tx("Trabajo", "Work")}</dt><dd>{money(sel.doneValue)}</dd></div>
                <div><dt>{tx("Cortes", "Cuts")}</dt><dd>{sel.cuts}{sel.jobs > sel.cuts ? <small> +{sel.jobs - sel.cuts}</small> : null}</dd></div>
                <div><dt>{tx("Propinas", "Tips")}</dt><dd>{money(sel.tips)}</dd></div>
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty text={tx("Cuando haya cobros y cortes, aquí verás la curva de cada mes.", "Once there are payments and cuts, each month's curve shows here.")} />
      )}
    </Fold>
  );
}

function TrendTip({ active, payload, tx }: { active?: boolean; payload?: { payload: CifrasMonth }[]; tx: Tx }) {
  if (!active || !payload?.length) return null;
  const m = payload[0]!.payload;
  return (
    <div className="cif-tip">
      <p className="font-semibold">{monthName(m.key)} {m.key.slice(0, 4)}</p>
      <p><i className="bg-done" />{tx("Cobrado", "Collected")} <b>{money(m.collected)}</b></p>
      <p><i className="cif-dash" />{tx("Trabajo", "Work")} <b>{money(m.doneValue)}</b></p>
      <p className="text-muted">{m.cuts} {tx("cortes", "cuts")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Quién debe */

const BUCKETS = [
  { key: "0-30", es: "0–30 días", en: "0–30 days", cls: "cif-b0" },
  { key: "31-60", es: "31–60", en: "31–60", cls: "cif-b1" },
  { key: "61-90", es: "61–90", en: "61–90", cls: "cif-b2" },
  { key: "90+", es: "90+ días", en: "90+ days", cls: "cif-b3" },
  // Owed from before any recorded cut: its own bucket, never mixed into "Más de 90".
  { key: "inicial", es: "Saldo inicial", en: "Opening balance", cls: "cif-b4" },
] as const;

function DebtsSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const arrived = useArrived();
  const rank = useCifraRank("fiabilidad");
  const d = data.debts;
  const title = tx("Quién debe y desde cuándo", "Who owes and since when");
  if (query.trim() && !smartHit(query, `${title} fiabilidad espera riesgo pago deuda saldo por cobrar antigüedad`)) return null;
  const max = Math.max(1, ...d.top.map((c) => c.balance));
  return (
    <Fold
      id="cif-fiabilidad"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={d.total > 0 ? money(d.total) : undefined}
      hint={<Hint manual="fiabilidad" text={tx(
        "Lo que te deben, repartido por la edad de cada trabajo sin pagar. Un abono paga primero lo más viejo, así que lo que queda debiendo son los trabajos más recientes. Lo que ya debían antes del primer corte anotado va aparte, como Saldo inicial. En espera y Alto riesgo siguen tus límites de Ajustes.",
        "What you are owed, split by the age of each unpaid job. A payment covers the oldest first, so what is still owed is the most recent jobs. What was owed before the first recorded cut goes apart, as Opening balance. Waiting and High risk follow your limits in Settings.",
      )} />}
    >
      {d.total > 0 ? (
        <div className="cif-rise">
          <Lead
            figure={<CountUp value={d.total} format={money} />}
            tone="hold"
            sentence={(() => {
              const fresh = d.buckets.find((b) => b.key === "0-30")?.amount ?? 0;
              const owing = data.pulse.owingPeople;
              const who = tx(`${owing} ${owing === 1 ? "persona te debe" : "personas te deben"}`, `${owing} ${owing === 1 ? "person owes you" : "people owe you"}`);
              return fresh >= d.total - 0.005
                ? tx(`${who}, todo de este último mes.`, `${who}, all from the last month.`)
                : tx(`${who}. ${pct(fresh, d.total)}% es de este último mes.`, `${who}. ${pct(fresh, d.total)}% is from the last month.`);
            })()}
          />
          <div className="cif-age-bar" role="img" aria-label={BUCKETS.map((b) => `${tx(b.es, b.en)}: ${money(d.buckets.find((x) => x.key === b.key)?.amount ?? 0)}`).join(", ")}>
            {BUCKETS.map((b) => {
              const amt = d.buckets.find((x) => x.key === b.key)?.amount ?? 0;
              return amt > 0 ? <span key={b.key} className={b.cls} style={{ flexGrow: arrived ? amt : 0.0001 }} /> : null;
            })}
          </div>
          <ul className="cif-age-legend">
            {BUCKETS.map((b) => {
              const row = d.buckets.find((x) => x.key === b.key);
              if (b.key === "inicial" && !(row && row.amount > 0)) return null;
              return (
                <li key={b.key} data-v={row?.amount ?? 0}>
                  <i className={b.cls} />
                  <span>{tx(b.es, b.en)}</span>
                  <b>{money(row?.amount ?? 0)}</b>
                  <small>{row?.people ?? 0}</small>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="cif-chip bg-done-bg text-done">{d.currentPeople} {tx("al corriente", "current")}</span>
            <span className="cif-chip bg-due-bg text-due">{d.waitPeople} {tx("en espera", "waiting")}</span>
            <span className="cif-chip bg-hold-bg text-hold">{d.seriousPeople} {tx("alto riesgo", "high risk")}</span>
            {d.latePayers > 0 ? <span className="cif-chip bg-late-bg text-late">{d.latePayers} {tx("pasaron su día de pago", "past their pay day")}</span> : null}
          </div>
          <p className="cif-kicker mt-4">{tx("Los que más deben", "Who owes the most")}</p>
          <ul className="cif-rows">
            {d.top.map((c, i) => (
              <li key={c.id} style={{ animationDelay: `${60 + i * 40}ms` }}>
                <Link to="/clientes/$id" params={{ id: String(c.id) }} className="cif-row">
                  <span className="cif-row-name">
                    {c.name}
                    <small>
                      {[
                        c.oldestDays != null ? tx(`hace ${c.oldestDays} d`, `${c.oldestDays} d old`) : null,
                        c.opening > 0 ? tx(`saldo inicial ${money(c.opening)}`, `opening balance ${money(c.opening)}`) : null,
                        c.unpaidCuts > 0 ? `${c.unpaidCuts} ${tx(c.unpaidCuts === 1 ? "trabajo" : "trabajos", c.unpaidCuts === 1 ? "job" : "jobs")}` : null,
                      ].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <span className="cif-row-bar"><span className={cn(c.tier === "serio" ? "bg-hold" : c.tier === "espera" ? "bg-due" : "bg-done")} style={{ width: arrived ? `${Math.max(4, (c.balance / max) * 100)}%` : "0%" }} /></span>
                  <b className="cif-row-value" data-v={c.balance}>{money(c.balance)}</b>
                  <ChevronRight className="cif-row-go" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty good text={tx("Nadie te debe. Todo cobrado.", "Nobody owes you. Everything is collected.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ Días y temporadas */

function RhythmSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const rank = useCifraRank("calendario");
  const [cell, setCell] = useState<{ month: string; dow: number } | null>(null);
  const title = tx("Días y temporadas", "Days and seasons");
  const days = weekdayOptions();
  const order = [1, 2, 3, 4, 5, 6, 0];
  if (query.trim() && !smartHit(query, `${title} semana día temporada ritmo calendario mapa calor ruta lunes martes`)) return null;
  const cells = data.rhythm.cells;
  const months = data.months.map((m) => m.key);
  const firstWith = months.findIndex((k) => cells.some((c) => c.month === k));
  const rows = firstWith === -1 ? [] : months.slice(firstWith);
  const max = Math.max(1, ...cells.map((c) => c.cuts));
  const wk = data.rhythm.weekdays;
  const wkMax = Math.max(1, ...wk.map((w) => w.cuts));
  const bestDay = [...wk].sort((a, b) => b.value - a.value)[0];
  const sel = cell ? cells.find((c) => c.month === cell.month && c.dow === cell.dow) : null;
  const label = (dow: number) => days.find((w) => w.value === dow);
  return (
    <Fold
      id="cif-calendario"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={bestDay && bestDay.cuts > 0 ? label(bestDay.dow)?.label : undefined}
      hint={<Hint text={tx(
        "Cada fila es un mes y cada columna un día de la semana. Más verde, más trabajos hechos. Abajo, cuánto deja cada día de la semana en los últimos 12 meses: así ves qué ruta vale más. Toca un cuadro para ver el número.",
        "Each row is a month and each column a weekday. Greener means more jobs done. Below, what each weekday brought in over the last 12 months, so you can see which route is worth more. Tap a square for its number.",
      )} />}
    >
      {rows.length ? (
        <div className="cif-rise">
          <div className="cif-heat" role="grid" aria-label={title}>
            <span />
            {order.map((dow) => <span key={dow} className="cif-heat-col">{label(dow)?.short}</span>)}
            {rows.map((key, r) => (
              <HeatRow key={key} monthKey={key} r={r} order={order} cells={cells} max={max} cell={cell} setCell={setCell} />
            ))}
          </div>
          <p className="cif-pick-line" aria-live="polite">
            {sel
              ? tx(
                  `${label(sel.dow)?.label} de ${monthName(sel.month).toLowerCase()}: ${sel.cuts} ${sel.cuts === 1 ? "trabajo" : "trabajos"}, ${money(sel.value)}.`,
                  `${label(sel.dow)?.label}s in ${monthName(sel.month)}: ${sel.cuts} ${sel.cuts === 1 ? "job" : "jobs"}, ${money(sel.value)}.`,
                )
              : cell
                ? tx("Ese día no hubo trabajos hechos.", "No jobs were done that day.")
                : tx("Toca un cuadro para ver el número.", "Tap a square to see the number.")}
          </p>
          <p className="cif-kicker mt-4">{tx("Lo que deja cada día · 12 meses", "What each weekday brings · 12 months")}</p>
          <div className="cif-week">
            {order.map((dow, i) => {
              const w = wk.find((x) => x.dow === dow)!;
              return (
                <div key={dow} className="cif-week-col" data-v={w.value}>
                  <span className="cif-week-val">{w.value > 0 ? short(w.value) : ""}</span>
                  <span className="cif-week-bar"><span style={{ height: `${Math.max(w.cuts ? 6 : 0, (w.cuts / wkMax) * 100)}%`, animationDelay: `${i * 50}ms` }} className={cn(bestDay?.dow === dow && w.cuts > 0 && "is-best")} /></span>
                  <span className="cif-week-day">{label(dow)?.short}</span>
                  <span className="cif-week-n">{w.cuts}</span>
                </div>
              );
            })}
          </div>
          {bestDay && bestDay.cuts > 0 ? (
            <p className="mt-2 text-sm text-muted">
              {tx(
                `${label(bestDay.dow)?.label} es tu mejor día: ${money(bestDay.value)} en ${bestDay.days} ${bestDay.days === 1 ? "día" : "días"} trabajados, unos ${money(Math.round(bestDay.days ? bestDay.value / bestDay.days : 0))} cada uno.`,
                `${label(bestDay.dow)?.label} is your best day: ${money(bestDay.value)} over ${bestDay.days} ${bestDay.days === 1 ? "day" : "days"} worked, about ${money(Math.round(bestDay.days ? bestDay.value / bestDay.days : 0))} each.`,
              )}
            </p>
          ) : null}
        </div>
      ) : (
        <Empty text={tx("Con unas semanas de cortes, aquí verás tus días fuertes y las temporadas.", "After a few weeks of cuts, your strong days and seasons show here.")} />
      )}
    </Fold>
  );
}

function HeatRow({ monthKey, r, order, cells, max, cell, setCell }: {
  monthKey: string; r: number; order: number[]; cells: CifrasInsights["rhythm"]["cells"]; max: number;
  cell: { month: string; dow: number } | null; setCell: (c: { month: string; dow: number } | null) => void;
}) {
  return (
    <>
      <span className="cif-heat-row">{monthName(monthKey, false)}{monthKey.slice(5, 7) === "01" ? ` ${monthKey.slice(2, 4)}` : ""}</span>
      {order.map((dow, c) => {
        const hit = cells.find((x) => x.month === monthKey && x.dow === dow);
        const n = hit?.cuts ?? 0;
        const level = n === 0 ? 0 : 14 + Math.round((n / max) * 86);
        const on = cell?.month === monthKey && cell.dow === dow;
        return (
          <button
            key={dow}
            type="button"
            className={cn("cif-heat-cell", on && "is-on", level > 58 && "is-strong")}
            style={{ "--lvl": `${level}%`, animationDelay: `${r * 25 + c * 12}ms` } as CSSProperties}
            onClick={() => setCell(on ? null : { month: monthKey, dow })}
            aria-label={`${monthKey} ${dow}: ${n}`}
          >
            {n > 0 ? n : ""}
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ Mejores clientes */

function BestSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const arrived = useArrived();
  const rank = useCifraRank("mejores");
  const b = data.best;
  const title = tx("Mejores clientes", "Best clients");
  if (query.trim() && !smartHit(query, `${title} valor patio ruta ingresos top`)) return null;
  const top = b.clients[0];
  const five = b.clients.slice(0, 5).reduce((s, c) => s + c.value, 0);
  return (
    <Fold
      id="cif-mejores"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={top?.name}
      hint={<Hint text={tx(
        "Lo que valió el trabajo hecho para cada cliente en los últimos 12 meses (cortes, extras y trabajos de una vez). La barra compara con el primero. Toca un nombre para abrir su ficha.",
        "What the work done for each client was worth over the last 12 months (cuts, extras, and one-time jobs). The bar compares with the first one. Tap a name to open their card.",
      )} />}
    >
      {b.clients.length ? (
        <div className="cif-rise">
          {b.clients.length >= 5 && b.total > 0 ? (
            <p className="cif-insight">
              {tx(
                `Tus 5 mejores clientes son el ${pct(five, b.total)}% del trabajo del año (${money(five)} de ${money(b.total)}, entre ${b.clientCount} clientes).`,
                `Your top 5 clients are ${pct(five, b.total)}% of the year's work (${money(five)} of ${money(b.total)}, across ${b.clientCount} clients).`,
              )}
            </p>
          ) : null}
          <ol className="cif-rows">
            {b.clients.map((c, i) => (
              <li key={c.id} style={{ animationDelay: `${i * 40}ms` }}>
                <Link to="/clientes/$id" params={{ id: String(c.id) }} className="cif-row">
                  <span className="cif-rank">{i + 1}</span>
                  <span className="cif-row-name">
                    {c.name}
                    <small>{c.jobs} {tx(c.jobs === 1 ? "trabajo" : "trabajos", c.jobs === 1 ? "job" : "jobs")} · {money(c.avg)} {tx("c/u", "each")}{!c.active ? ` · ${tx("de baja", "inactive")}` : ""}</small>
                  </span>
                  <span className="cif-row-bar"><span className="bg-money" style={{ width: arrived ? `${Math.max(4, (c.value / (top?.value || 1)) * 100)}%` : "0%" }} /></span>
                  <b className="cif-row-value" data-v={c.value}>{money(c.value)}</b>
                  <ChevronRight className="cif-row-go" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Empty text={tx("Cuando marques trabajos como hechos, aquí verás qué patios valen más.", "When you mark jobs done, this shows which yards are worth the most.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ Precio */

function Spark({ values, className }: { values: number[]; className?: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter(([, v]) => v > 0);
  if (pts.length < 2) return null;
  const w = 220;
  const h = 44;
  const min = Math.min(...pts.map(([, v]) => v));
  const max = Math.max(...pts.map(([, v]) => v));
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 14);
  const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("cif-spark", className)} preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${x(last[0]).toFixed(1)} ${h} L${x(pts[0]![0]).toFixed(1)} ${h} Z`} className="cif-spark-fill" />
      <path d={d} className="cif-spark-line" />
      <circle cx={x(last[0])} cy={y(last[1])} r="3.2" className="cif-spark-dot" />
    </svg>
  );
}

function PriceSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const rank = useCifraRank("precio");
  const pr = data.price;
  const title = tx("Precio por trabajo", "Price per job");
  if (query.trim() && !smartHit(query, `${title} ticket promedio corte extra una vez precio`)) return null;
  // Free ($0) cuts are left out, like the averages below.
  const perMonth = data.months.map((m) => (m.cutsPriced > 0 ? m.cutValue / m.cutsPriced : 0));
  const firstHalf = perMonth.slice(0, 6).filter((v) => v > 0);
  const secondHalf = perMonth.slice(6).filter((v) => v > 0);
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  return (
    <Fold
      id="cif-precio"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={pr.nCut ? money(pr.avgCut) : undefined}
      hint={<Hint text={tx(
        "Promedio de lo que valió cada trabajo hecho en los últimos 12 meses, separado por tipo. Los trabajos de $0 (cortesías) no cuentan. La línea es el precio medio de un corte, mes a mes.",
        "Average value of each job done over the last 12 months, by kind. $0 jobs (courtesies) don't count. The line is the average price of a cut, month by month.",
      )} />}
    >
      {pr.nCut + pr.nExtra + pr.nOnce > 0 ? (
        <div className="cif-rise">
          <div className="cif-price">
            <div>
              <p className="cif-kicker">{tx("Corte promedio", "Average cut")}</p>
              <p className="cif-figure"><CountUp value={pr.avgCut} format={money} /></p>
              {firstHalf.length && secondHalf.length ? (
                <p className="text-xs text-muted">
                  <Delta now={avg(secondHalf)} before={avg(firstHalf)} tx={tx} note={tx("últimos 6 meses vs anteriores", "last 6 months vs before")} />
                </p>
              ) : null}
            </div>
            <Spark values={perMonth} />
          </div>
          <div className="cif-tiles cif-tiles-3">
            <div className="cif-tile"><span className="cif-tile-label">{tx("Cortes", "Cuts")}</span><span className="cif-tile-value">{money(pr.avgCut)}</span><span className="cif-tile-note">{pr.nCut} {tx("hechos", "done")}</span></div>
            <div className="cif-tile"><span className="cif-tile-label">{tx("Extras", "Extras")}</span><span className="cif-tile-value">{pr.nExtra ? money(pr.avgExtra) : "—"}</span><span className="cif-tile-note">{pr.nExtra} {tx("hechos", "done")}</span></div>
            <div className="cif-tile"><span className="cif-tile-label">{tx("Una vez", "One time")}</span><span className="cif-tile-value">{pr.nOnce ? money(pr.avgOnce) : "—"}</span><span className="cif-tile-note">{pr.nOnce} {tx("hechos", "done")}</span></div>
          </div>
        </div>
      ) : (
        <Empty text={tx("El precio promedio aparece con los primeros trabajos hechos.", "The average price shows up with the first jobs done.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ Propinas */

function TipsSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const arrived = useArrived();
  const rank = useCifraRank("propinas");
  const t = data.tips;
  const title = tx("Propinas", "Tips");
  if (query.trim() && !smartHit(query, `${title} propina extra regalo`)) return null;
  const months = data.months;
  const max = Math.max(1, ...months.map((m) => m.tips));
  return (
    <Fold
      id="cif-propinas"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={t.year > 0 ? money(t.year) : undefined}
      hint={<Hint manual="propina-anio" text={tx(
        "Dinero de más que no cambia la deuda ni entra en Cobrado. Arriba, lo de este año; las barras son los últimos 12 meses.",
        "Extra money that does not change the debt or count as Collected. On top, this year; the bars are the last 12 months.",
      )} />}
    >
      {t.count > 0 || months.some((m) => m.tips > 0) ? (
        <div className="cif-rise">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="cif-kicker">{tx(`Este año (${data.today.slice(0, 4)})`, `This year (${data.today.slice(0, 4)})`)}</p>
              <p className="cif-figure text-due"><CountUp value={t.year} format={money} /></p>
            </div>
            <p className="text-sm text-muted">{t.count} {tx(t.count === 1 ? "propina" : "propinas", t.count === 1 ? "tip" : "tips")} · {tx("promedio", "average")} {money(t.avg)}</p>
          </div>
          <div className="cif-minibars" aria-hidden>
            {months.map((m) => (
              <span key={m.key} title={`${monthName(m.key)}: ${money(m.tips)}`}>
                <span style={{ height: arrived ? `${Math.max(m.tips ? 6 : 0, (m.tips / max) * 100)}%` : "0%" }} className={m.partial ? "is-partial" : undefined} />
                <small>{monthName(m.key, false).slice(0, 1)}</small>
              </span>
            ))}
          </div>
          {t.top.length ? (
            <>
              <p className="cif-kicker mt-3">{tx("Quién deja más propina", "Who tips the most")}</p>
              <ul className="cif-rows">
                {t.top.map((c) => (
                  <li key={c.id}>
                    <Link to="/clientes/$id" params={{ id: String(c.id) }} className="cif-row">
                      <span className="cif-row-name">{c.name}<small>{c.count} {tx(c.count === 1 ? "vez" : "veces", c.count === 1 ? "time" : "times")}</small></span>
                      <b className="cif-row-value">{money(c.total)}</b>
                      <ChevronRight className="cif-row-go" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <Empty text={tx("Cuando registres una propina al cobrar, aquí se suma.", "When you record a tip while collecting, it adds up here.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ Meta del mes */

function GoalSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const rank = useCifraRank("meta");
  const g = data.goal;
  const title = tx("Meta del mes", "Month goal");
  if (query.trim() && !smartHit(query, `${title} meta objetivo patios por día faltan esfuerzo`)) return null;
  const left = Math.max(0, g.total - g.done);
  const pace = g.done - g.dueByToday;
  return (
    <Fold
      id="cif-meta"
      style={secStyle(rank)}
      className="cif-sec"
      defaultOpen
      title={title}
      peek={g.hasGoals ? (left > 0 ? tx(`${g.perDayLeft} por día`, `${g.perDayLeft} a day`) : tx("cumplida", "reached")) : undefined}
      hint={<Hint text={tx(
        "La meta del mes suma la meta de patios de cada día de trabajo del mes (la que pones en Esfuerzo de la semana). Los días libres y las vacaciones no cuentan. Cuenta cada trabajo hecho, como Esfuerzo. La rayita marca dónde deberías ir hoy.",
        "The month goal adds up the yard goal of every working day this month (the one you set in This week's effort). Days off and vacation don't count. It counts every job done, like Effort. The tick marks where you should be today.",
      )} />}
    >
      {g.hasGoals ? (
        <div className="cif-rise">
          <Lead
            kicker={left > 0 ? tx("Para llegar a la meta", "To reach the goal") : tx("Meta del mes", "Month goal")}
            figure={left > 0
              ? (g.workDaysLeft > 0
                  ? <><CountUp value={g.perDayLeft} format={(n) => String(n)} /><span className="cif-lead-unit">{tx(" patios por día", " yards a day")}</span></>
                  : <><CountUp value={left} format={(n) => String(n)} /><span className="cif-lead-unit">{tx(" patios", " yards")}</span></>)
              : tx("¡Cumplida!", "Reached!")}
            tone={left > 0 ? undefined : "done"}
            sentence={left === 0
              ? tx(`Hiciste ${g.done} de ${g.total} patios este mes.`, `You did ${g.done} of ${g.total} yards this month.`)
              : g.workDaysLeft > 0
                ? tx(`Te faltan ${left} patios en ${g.workDaysLeft} ${g.workDaysLeft === 1 ? "día" : "días"} de trabajo, contando hoy.`, `${left} yards to go over ${g.workDaysLeft} working ${g.workDaysLeft === 1 ? "day" : "days"}, today included.`)
                : tx(`No quedan días con meta este mes. Faltaron ${left} patios.`, `No goal days are left this month. ${left} yards short.`)}
            aside={g.dueByToday > 0 || g.done > 0 ? (
              <span className={cn("cif-pace", pace >= 0 ? "is-ahead" : "is-behind")}>
                {pace >= 0
                  ? tx(pace === 0 ? "Al día" : `${pace} adelante`, pace === 0 ? "On pace" : `${pace} ahead`)
                  : tx(`${-pace} atrás`, `${-pace} behind`)}
              </span>
            ) : null}
          />
          <GrassMeter
            value={g.total > 0 ? g.done / g.total : 0}
            mark={g.total > 0 ? g.dueByToday / g.total : null}
            label={tx(`${g.done} de ${g.total} patios`, `${g.done} of ${g.total} yards`)}
          />
          <div className="cif-grass-scale">
            <span><b>{g.done}</b> {tx("hechos", "done")}</span>
            {g.dueByToday > 0 && g.dueByToday < g.total ? <span className="cif-grass-scale-mark">{tx(`hoy deberías ir en ${g.dueByToday}`, `today's mark: ${g.dueByToday}`)}</span> : null}
            <span>{tx("meta", "goal")} <b>{g.total}</b></span>
          </div>
          {g.todayGoal > 0 ? (
            <p className="cif-note-line">
              <Blade className="cif-note-blade" />
              {g.todayDone >= g.todayGoal
                ? tx(`Hoy ya cumpliste: ${g.todayDone} de ${g.todayGoal}.`, `Today is done: ${g.todayDone} of ${g.todayGoal}.`)
                : tx(`Hoy: ${g.todayDone} de ${g.todayGoal}.`, `Today: ${g.todayDone} of ${g.todayGoal}.`)}
            </p>
          ) : null}
        </div>
      ) : (
        <Empty text={tx("Pon una meta de patios por día en Esfuerzo de la semana y aquí verás cuánto falta para la del mes.", "Set a daily yard goal in This week's effort and this shows what is left for the month.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ Ingreso fijo */

function BaselineSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const arrived = useArrived();
  const rank = useCifraRank("fijo");
  const b = data.baseline;
  const title = tx("Ingreso fijo del mes", "Steady monthly income");
  if (query.trim() && !smartHit(query, `${title} fijo base clientes fijos regulares frecuencia mes normal`)) return null;
  const share = b.total > 0 ? b.collected / b.total : 0;
  const topMax = Math.max(1, ...b.top.map((c) => c.value));
  return (
    <Fold
      id="cif-fijo"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={b.total > 0 ? money(b.total) : undefined}
      hint={<Hint text={tx(
        "Lo que dejan tus clientes fijos activos en un mes normal: visitas al mes (según su frecuencia) por su precio. No cuenta extras, trabajos de una vez, clientes en pausa ni temporadas. Es tu piso: lo que entra si todo sigue igual.",
        "What your active regular clients bring in a normal month: visits a month (from their frequency) times their price. It leaves out extras, one-time jobs, paused clients, and seasons. It is your floor: what comes in if nothing changes.",
      )} />}
    >
      {b.clients > 0 ? (
        <div className="cif-rise">
          <Lead
            kicker={tx("Un mes normal", "A normal month")}
            figure={<CountUp value={b.total} format={money} />}
            tone="money"
            sentence={tx(
              `${b.clients} ${b.clients === 1 ? "cliente fijo" : "clientes fijos"}, unas ${Math.round(b.visits)} visitas al mes.`,
              `${b.clients} regular ${b.clients === 1 ? "client" : "clients"}, about ${Math.round(b.visits)} visits a month.`,
            )}
          />
          <GrassMeter value={share} tone="money" label={tx(`Cobrado: ${pct(b.collected, b.total)}% del fijo`, `Collected: ${pct(b.collected, b.total)}% of the steady income`)} />
          <div className="cif-grass-scale">
            <span>{tx("cobrado", "collected")} <b>{money(b.collected)}</b></span>
            <span><b>{pct(b.collected, b.total)}%</b> {tx("del fijo", "of it")}</span>
          </div>
          {b.planned > b.total + 0.5 ? (
            <p className="cif-note-line">
              <Blade className="cif-note-blade" />
              {tx(`Lo agendado este mes (${money(b.planned)}) pasa el fijo: hay extras, trabajos de una vez o un mes con más visitas.`, `This month's scheduled work (${money(b.planned)}) is above the floor: extras, one-time jobs, or a month with more visits.`)}
            </p>
          ) : null}
          {b.top.length > 1 ? (
            <>
              <p className="cif-kicker mt-3">{tx("Los que más aportan", "Who adds the most")}</p>
              <ul className="cif-rows">
                {b.top.map((c, i) => (
                  <li key={c.id} style={{ animationDelay: `${60 + i * 40}ms` }}>
                    <Link to="/clientes/$id" params={{ id: String(c.id) }} className="cif-row">
                      <span className="cif-row-name">
                        {c.name}
                        <small>{tx(`${c.visits} visitas × ${money(c.price)}`, `${c.visits} visits × ${money(c.price)}`)}</small>
                      </span>
                      <span className="cif-row-bar"><span className="bg-money" style={{ width: arrived ? `${Math.max(4, (c.value / topMax) * 100)}%` : "0%" }} /></span>
                      <b className="cif-row-value">{money(c.value)}</b>
                      <ChevronRight className="cif-row-go" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : (
        <Empty text={tx("Cuando tengas clientes fijos activos, aquí verás lo que dejan en un mes normal.", "Once you have active regular clients, this shows what they bring in a normal month.")} />
      )}
    </Fold>
  );
}

/* ------------------------------------------------------------------ $ por hora */

function PerHourSection({ data, query }: { data: CifrasInsights; query: string }) {
  const tx = useTx();
  const rank = useCifraRank("hora");
  const ph = data.perHour;
  const title = tx("$ por hora", "$ per hour");
  if (query.trim() && !smartHit(query, `${title} hora dinero tiempo rendimiento horas cobrado`)) return null;
  const rate = (x: { collected: number; minutes: number }) => (x.minutes > 0 ? x.collected / (x.minutes / 60) : 0);
  const workRate = (x: { doneValue: number; minutes: number }) => (x.minutes > 0 ? x.doneValue / (x.minutes / 60) : 0);
  const wRate = rate(ph.week);
  const mRate = rate(ph.month);
  const hasWeek = ph.week.minutes > 0;
  const head = hasWeek ? wRate : mRate;
  const fill = !hasWeek || mRate <= 0 ? 1 : Math.min(1, wRate / mRate);
  const h = (min: number) => {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    return mm ? tx(`${hh} h ${mm} min`, `${hh} hr ${mm} min`) : tx(`${hh} h`, `${hh} hr`);
  };
  const perH = (n: number) => `${money(Math.round(n))}`;
  return (
    <Fold
      id="cif-hora"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      peek={ph.month.minutes > 0 ? `${perH(head)}/h` : undefined}
      hint={<Hint manual="horas" text={tx(
        "Lo cobrado dividido entre tus horas de trabajo confirmadas, en la semana y en el mes. Cuenta hasta el último día con horas confirmadas. El anillo compara la semana con el mes: lleno es igual o mejor.",
        "What you collected divided by your confirmed work hours, for the week and the month. It counts up to the last day with confirmed hours. The ring compares the week with the month: full means as good or better.",
      )} />}
    >
      {ph.month.minutes > 0 ? (
        <div className="cif-rise">
          <div className="cif-hour">
            <SunRing value={fill} size={124}>
              <span className="cif-sun-big"><CountUp value={Math.round(head)} format={(n) => money(n)} /></span>
              <span className="cif-sun-unit">{tx("por hora", "per hour")}</span>
            </SunRing>
            <p className="cif-lead-line cif-lead-solo">
              {hasWeek
                ? tx(`Esta semana ganas ${perH(wRate)} por cada hora de trabajo.`, `This week you make ${perH(wRate)} for every hour of work.`)
                : tx(`Este mes ganas ${perH(mRate)} por cada hora de trabajo.`, `This month you make ${perH(mRate)} for every hour of work.`)}
              {hasWeek && mRate > 0 ? (
                <> {wRate >= mRate
                  ? tx(`Mejor que el mes (${perH(mRate)}).`, `Better than the month (${perH(mRate)}).`)
                  : tx(`El mes va en ${perH(mRate)}.`, `The month is at ${perH(mRate)}.`)}</>
              ) : null}
            </p>
          </div>
          <div className="cif-tiles cif-tiles-2">
            <div className="cif-tile">
              <span className="cif-tile-label">{tx("Esta semana", "This week")}</span>
              <span className="cif-tile-value">{hasWeek ? `${perH(wRate)}/h` : "—"}</span>
              <span className="cif-tile-note">{hasWeek ? `${money(ph.week.collected)} · ${h(ph.week.minutes)}` : tx("sin horas aún", "no hours yet")}</span>
            </div>
            <div className="cif-tile">
              <span className="cif-tile-label">{tx("Este mes", "This month")}</span>
              <span className="cif-tile-value">{`${perH(mRate)}/h`}</span>
              <span className="cif-tile-note">{`${money(ph.month.collected)} · ${h(ph.month.minutes)}`}</span>
            </div>
          </div>
          <p className="cif-note-line">
            <Blade className="cif-note-blade" />
            {tx(`El trabajo hecho vale ${perH(workRate(ph.month))} por hora este mes, cobrado o no.`, `Work done is worth ${perH(workRate(ph.month))} an hour this month, paid or not.`)}
          </p>
        </div>
      ) : (
        <Empty text={tx("Cuando confirmes tus horas de trabajo, aquí verás cuánto ganas por hora.", "Once your work hours are confirmed, this shows what you make per hour.")} />
      )}
    </Fold>
  );
}

function Empty({ text, good }: { text: string; good?: boolean }) {
  return (
    <p className={cn("cif-empty", good && "is-good")}>
      {good ? <span aria-hidden>✓</span> : <ArrowRight aria-hidden />}
      {text}
    </p>
  );
}

/** The new Cifras sections. Each one keeps its place from the user's saved order. */
/** `ready` waits for Hoy's schedule pass (getDashboard), so the jobs still to do this month exist before counting them. */
export function CifrasInsightsSections({ query = "", ready = true }: { query?: string; ready?: boolean }) {
  const q = useInsights(ready);
  const rank = useCifraRank("pulso");
  if (!q.data) {
    if (q.isError) return null;
    return <div className="cif-skeleton" style={secStyle(rank)} aria-hidden><span /><span /><span /></div>;
  }
  const data = q.data;
  return (
    <>
      <PulseSection data={data} query={query} />
      <GoalSection data={data} query={query} />
      <BaselineSection data={data} query={query} />
      <PerHourSection data={data} query={query} />
      <TrendSection data={data} query={query} />
      <DebtsSection data={data} query={query} />
      <RhythmSection data={data} query={query} />
      <BestSection data={data} query={query} />
      <PriceSection data={data} query={query} />
      <TipsSection data={data} query={query} />
    </>
  );
}

export function WeekToDate({ children }: { children: (w: CifrasInsights["week"] | null) => ReactNode }) {
  const q = useInsights(false);
  return <>{children(q.data?.week ?? null)}</>;
}
