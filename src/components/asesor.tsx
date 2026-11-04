import { useMasonry, usePageWidth } from "@/components/wide-layout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  HandCoins,
  Heart,
  HeartHandshake,
  Repeat,
  Snowflake,
  Sprout,
  Star,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CountUp, useArrived } from "@/components/cifras-visuals";
import { MessageComposer } from "@/components/message-composer";
import { money } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import {
  getAdvisor,
  type AdvisorAction,
  type AdvisorGroupKey,
  type AdvisorPerson,
  type AdvisorPillar,
  type AdvisorPillarKey,
  type AdvisorReading,
  type AdvisorWeekday,
} from "@/lib/server/lawn";
import { cn } from "@/lib/utils";

/* Estudio · Asesor. A coach in plain words: one verdict, three moves with their $,
   clients in groups, five checks, and a small glossary. Every card: picture or big
   figure first, one sentence, detail on tap. */

type Tx = (es: string, en: string) => string;

const usd = (n: number) => money(Math.round(n));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const DAY_PLURAL: Record<number, [string, string]> = {
  0: ["domingos", "Sundays"],
  1: ["lunes", "Mondays"],
  2: ["martes", "Tuesdays"],
  3: ["miércoles", "Wednesdays"],
  4: ["jueves", "Thursdays"],
  5: ["viernes", "Fridays"],
  6: ["sábados", "Saturdays"],
};
const DAY_SHORT: Record<number, [string, string]> = {
  0: ["Do", "Su"], 1: ["Lu", "Mo"], 2: ["Ma", "Tu"], 3: ["Mi", "We"], 4: ["Ju", "Th"], 5: ["Vi", "Fr"], 6: ["Sá", "Sa"],
};
const MONTH_LETTER_ES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_LETTER_EN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/* ------------------------------------------------------------------ messages */

function messageFor(p: AdvisorPerson, business: string, tx: Tx, plan?: number): string {
  const n = firstName(p.name);
  switch (p.tip) {
    case "collect":
      return tx(
        `Hola ${n}, te saluda ${business}. Tienes un saldo pendiente de ${usd(p.balance)} por el servicio del patio. ¿Me lo puedes pagar esta semana? ¡Muchas gracias!`,
        `Hi ${n}, this is ${business}. You have a balance of ${usd(p.balance)} for the lawn service. Could you pay it this week? Thank you!`,
      );
    case "raise":
      return tx(
        `Hola ${n}, gracias por confiar en ${business} todo este tiempo. A partir del próximo mes, el corte pasará de ${usd(p.price)} a ${usd(p.suggested ?? p.price)}. Seguimos a la orden. ¡Gracias!`,
        `Hi ${n}, thank you for trusting ${business} all this time. Starting next month, the cut will go from ${usd(p.price)} to ${usd(p.suggested ?? p.price)}. Always at your service. Thank you!`,
      );
    case "call":
      return p.reason === "moves"
        ? tx(
            `Hola ${n}, te saluda ${business}. Veo que el día del corte no te ha quedado bien. ¿Qué día de la semana te viene mejor? Lo cambio.`,
            `Hi ${n}, this is ${business}. It looks like your cut day hasn't been working for you. Which day of the week suits you better? I'll change it.`,
          )
        : tx(
            `Hola ${n}, te saluda ${business}. Hace un tiempo que no cortamos tu patio. ¿Te lo agendo esta semana? Tengo espacio.`,
            `Hi ${n}, this is ${business}. It's been a while since we cut your lawn. Want me to book you this week? I have room.`,
          );
    case "plan":
      return tx(
        `Hola ${n}, te saluda ${business}. ¿Te gustaría un plan fijo? Cortamos tu patio cada 2 semanas por ${usd(plan ?? p.price)} y siempre se ve bien. Sin compromiso.`,
        `Hi ${n}, this is ${business}. Would you like a regular plan? We cut your lawn every 2 weeks for ${usd(plan ?? p.price)} and it always looks great. No commitment.`,
      );
    default:
      return tx(
        `Hola ${n}, gracias por ser de nuestros mejores clientes. ¡Es un gusto cuidar tu patio! — ${business}`,
        `Hi ${n}, thank you for being one of our best clients. It's a pleasure to care for your lawn! — ${business}`,
      );
  }
}

/* ------------------------------------------------------------------ hero dial */

const TONE_CLASS = { good: "is-good", warn: "is-warn", bad: "is-bad" } as const;

/** Score 0–100 as a ring of grass blades: lit blades grow in, the sun sits in the middle. */
function GrassDial({ score, tone, word }: { score: number; tone: "good" | "warn" | "bad"; word: string }) {
  const size = 148;
  const c = size / 2;
  const n = 36;
  const lit = Math.round((Math.max(0, Math.min(100, score)) / 100) * n);
  const rIn = 48;
  return (
    <div className={cn("as-dial", TONE_CLASS[tone])} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle cx={c} cy={c} r={rIn - 4} className="as-dial-disc" />
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * 360;
          const on = i < lit;
          return (
            <g key={i} transform={`rotate(${a} ${c} ${c})`}>
              <path
                d={`M ${c - 3.2} ${c - rIn} Q ${c - 2} ${c - rIn - 13} ${c + 1.5} ${c - rIn - (on ? 21 : 12)} Q ${c + 2.4} ${c - rIn - 9} ${c + 3.2} ${c - rIn} Z`}
                className={cn("as-blade", on && "is-on")}
                style={{ animationDelay: `${120 + i * 22}ms` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="as-dial-center">
        <CountUp className="as-dial-num" value={score} format={(v) => String(v)} />
        <span className="as-dial-of">/100</span>
        <span className="as-dial-word">{word}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ words */

const ISSUE: Record<AdvisorPillarKey, [string, string]> = {
  cobro: ["te deben demasiado", "you are owed too much"],
  precios: ["cobras poco a varios clientes", "several clients pay too little"],
  clientes: ["se te están alejando clientes", "some clients are slipping away"],
  agenda: ["tu semana tiene huecos", "your week has empty spots"],
  fijo: ["dependes de trabajos sueltos", "you lean on one-off jobs"],
};
const RANK = { fail: 2, warn: 1, pass: 0 } as const;

const WEIGHT: Record<AdvisorPillarKey, number> = { cobro: 0.3, clientes: 0.25, precios: 0.15, agenda: 0.15, fijo: 0.15 };

/** The check that hurts most: worst status first, then the most points lost from the score. */
function worstPillar(r: AdvisorReading): AdvisorPillar {
  const lost = (p: AdvisorPillar) => (1 - p.score) * WEIGHT[p.key];
  return [...r.pillars].sort((a, b) => RANK[b.status] - RANK[a.status] || lost(b) - lost(a))[0];
}

/** "hace 3 días", "hace 4 meses", "hace más de un año". */
function ago(days: number, tx: Tx): string {
  if (days >= 730) return tx(`hace ${Math.floor(days / 365)} años`, `for ${Math.floor(days / 365)} years`);
  if (days >= 365) return tx("hace más de un año", "for over a year");
  if (days >= 60) return tx(`hace ${Math.floor(days / 30)} meses`, `for ${Math.floor(days / 30)} months`);
  return tx(`hace ${days} ${plural(days, "día", "días")}`, `for ${days} ${plural(days, "day", "days")}`);
}
const shortAgo = (days: number, tx: Tx) => (days >= 365 ? tx(`${Math.floor(days / 365)} a`, `${Math.floor(days / 365)} y`) : days >= 60 ? tx(`${Math.floor(days / 30)} m`, `${Math.floor(days / 30)} mo`) : `${days} d`);

export function verdict(r: AdvisorReading, tx: Tx): { title: string; sub: string; word: string } {
  const w = worstPillar(r);
  // Collection check failing with nothing overdue: the problem is unpaid recent work, not late debt.
  const slowPay = w.key === "cobro" && w.b === 0;
  const issue = slowPay ? tx(`solo has cobrado el ${w.a}% de tu trabajo`, `you've collected only ${w.a}% of your work`) : tx(...ISSUE[w.key]);
  const word = r.tone === "good" ? tx("Bien", "Good") : r.tone === "warn" ? tx("Regular", "Fair") : tx("Atención", "Needs care");
  let title: string;
  if (w.status === "pass") title = tx("Tu negocio va muy bien.", "Your business is doing great.");
  else if (r.tone === "good") title = tx(`Tu negocio va bien, pero ${issue}.`, `Your business is doing well, but ${issue}.`);
  else if (r.tone === "warn") title = tx(`Tu negocio va regular: ${issue}.`, `Your business is so-so: ${issue}.`);
  else title = tx(`Tu negocio necesita atención: ${issue}.`, `Your business needs care: ${issue}.`);
  let sub = "";
  if (w.status === "pass") sub = tx("Sigue así: cobra a tiempo y cuida a tus mejores clientes.", "Keep it up: collect on time and look after your best clients.");
  else if (slowPay) sub = tx(`De lo que hiciste en 90 días te falta cobrar ${100 - Math.min(100, w.a)}%. Nada tiene atraso todavía.`, `${100 - Math.min(100, w.a)}% of your last 90 days of work is still unpaid. Nothing is overdue yet.`);
  else if (w.key === "cobro") sub = tx(`${w.b} ${plural(w.b, "cliente te debe", "clientes te deben")} ${usd(w.c)} con atraso.`, `${w.b} ${plural(w.b, "client owes", "clients owe")} you ${usd(w.c)}, overdue.`);
  else if (w.key === "precios") sub = tx(`${w.a} de ${w.b} clientes de más de un año pagan menos de lo normal.`, `${w.a} of ${w.b} clients of over a year pay less than usual.`);
  else if (w.key === "clientes") sub = tx(`${w.a} de ${w.b} clientes fijos se están alejando.`, `${w.a} of ${w.b} regular clients are drifting away.`);
  else if (w.key === "agenda") sub = tx(`Tu semana está llena al ${w.a}%: caben ${Math.max(0, w.c - w.b)} patios más.`, `Your week is ${w.a}% full: ${Math.max(0, w.c - w.b)} more yards fit.`);
  else sub = tx(`Tus clientes fijos dejan ${usd(w.a)} al mes.`, `Your regular clients bring ${usd(w.a)} a month.`);
  return { title, sub, word };
}

/* ------------------------------------------------------------------ hero */

function Hero({ r }: { r: AdvisorReading }) {
  const tx = useTx();
  const v = verdict(r, tx);
  return (
    <section data-spot="asesor" className={cn("as-card as-hero", TONE_CLASS[r.tone])} data-masonry-full style={{ "--i": 0 } as CSSProperties}>
      <div className="as-hero-top">
        <div className="min-w-0 flex-1">
          <p className="as-kicker"><Sprout aria-hidden />{tx("Tu negocio, en claro", "Business, in short")}</p>
          <h2 className="as-verdict">{v.title}</h2>
          <p className="as-sub">{v.sub}</p>
        </div>
        <GrassDial score={r.score} tone={r.tone} word={v.word} />
      </div>
      <div className="as-hero-stats">
        <div>
          <span>{tx("Te deben", "Owed to you")}</span>
          <CountUp className="as-stat-num" value={Math.round(r.owed)} format={usd} />
          {r.owedLate > 0 ? <small className="text-late">{usd(r.owedLate)} {tx("con atraso", "overdue")}</small> : <small>{tx("todo al día", "all current")}</small>}
        </div>
        <div>
          <span>{tx("Fijo al mes", "Monthly")}</span>
          <CountUp className="as-stat-num" value={r.monthly} format={usd} />
          <small>{tx("de tus clientes fijos", "from regular clients")}</small>
        </div>
        <div>
          <span>{tx("Clientes", "Clients")}</span>
          <CountUp className="as-stat-num" value={r.activeClients} format={(n) => String(n)} />
          <small>{tx("activos", "active")}</small>
        </div>
      </div>
      <Meadow />
    </section>
  );
}

/** A strip of grass along the bottom of the hero that grows in. */
function Meadow() {
  const blades = 46;
  return (
    <svg className="as-meadow" viewBox="0 0 460 26" preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: blades }, (_, i) => {
        const x = 4 + i * 10 + ((i * 37) % 5);
        const h = 12 + ((i * 53) % 13);
        const lean = ((i * 29) % 7) - 3;
        return (
          <path
            key={i}
            d={`M ${x - 2.6} 26 Q ${x - 1} ${26 - h * 0.6} ${x + lean} ${26 - h} Q ${x + 1.2} ${26 - h * 0.5} ${x + 2.6} 26 Z`}
            className={cn("as-meadow-blade", i % 3 === 0 && "is-deep")}
            style={{ animationDelay: `${300 + ((i * 41) % 23) * 28}ms` }}
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ actions */

const ACT_ICON: Record<AdvisorAction["kind"], LucideIcon> = {
  collect: HandCoins,
  raise: TrendingUp,
  winback: HeartHandshake,
  fill: CalendarPlus,
  plans: Repeat,
  season: Snowflake,
};
const ACT_TONE: Record<AdvisorAction["kind"], string> = {
  collect: "is-late",
  raise: "is-money",
  winback: "is-hold",
  fill: "is-done",
  plans: "is-abono",
  season: "is-money",
};

function reasonLine(p: AdvisorPerson, tx: Tx): string {
  if (p.reason === "gap") return tx(`Lleva ${p.sinceCut} días sin corte (lo normal: cada ${p.every}).`, `${p.sinceCut} days without a cut (usual: every ${p.every}).`);
  if (p.reason === "paused") return tx("Tiene el servicio en pausa.", "Their service is paused.");
  if (p.reason === "stopped") return tx("Dejó el servicio hace poco.", "Stopped the service recently.");
  return tx("Pospone o cancela seguido.", "Often postpones or cancels.");
}

function tipLine(p: AdvisorPerson, tx: Tx, plan: number): string {
  switch (p.tip) {
    case "collect":
      return p.payDays != null
        ? tx(`Debe ${usd(p.balance)} ${ago(p.payDays, tx)}. Cóbrale.`, `Owes ${usd(p.balance)} ${ago(p.payDays, tx)}. Collect.`)
        : tx(`Debe ${usd(p.balance)}. Cóbrale.`, `Owes ${usd(p.balance)}. Collect.`);
    case "call":
      return `${reasonLine(p, tx)} ${tx("Escríbele.", "Message them.")}`;
    case "raise":
      return tx(`Sube de ${usd(p.price)} a ${usd(p.suggested ?? p.price)} (+${usd(p.gainYear)} al año).`, `Raise from ${usd(p.price)} to ${usd(p.suggested ?? p.price)} (+${usd(p.gainYear)} a year).`);
    case "plan":
      return tx(`Ofrécele un plan cada 2 semanas por ${usd(plan)}.`, `Offer a plan every 2 weeks for ${usd(plan)}.`);
    case "thank":
      return tx("Agradécele y dale prioridad si llueve.", "Thank them and put them first after rain.");
    default:
      return tx("Todo bien. Mantén el ritmo.", "All good. Keep the rhythm.");
  }
}

export function actionWords(a: AdvisorAction, r: AdvisorReading, tx: Tx): { title: string; line: string; unit: string; sign: string } {
  const top = a.people[0];
  const others = Math.max(0, a.count - 1);
  switch (a.kind) {
    case "collect":
      return {
        title: others > 0 ? tx(`Cobra a ${top.name} y ${others} más`, `Collect from ${top.name} and ${others} more`) : tx(`Cobra a ${top.name}`, `Collect from ${top.name}`),
        line: tx(
          `${a.count} ${plural(a.count, "cliente te debe", "clientes te deben")} con atraso. Empieza por quien más debe y hace más tiempo.`,
          `${a.count} ${plural(a.count, "client owes", "clients owe")} you, overdue. Start with the biggest and oldest.`,
        ),
        unit: tx("por cobrar", "to collect"),
        sign: "",
      };
    case "raise":
      return {
        title: tx(`Sube el precio a ${a.count} ${plural(a.count, "cliente", "clientes")}`, `Raise the price for ${a.count} ${plural(a.count, "client", "clients")}`),
        line: tx(
          `Llevan más de un año y pagan menos que patios parecidos. Ej.: ${top.name}, de ${usd(top.price)} a ${usd(top.suggested ?? top.price)}.`,
          `Over a year with you and paying less than similar yards. E.g. ${top.name}, from ${usd(top.price)} to ${usd(top.suggested ?? top.price)}.`,
        ),
        unit: tx("al año", "a year"),
        sign: "+",
      };
    case "winback":
      return {
        title: tx(`Recupera a ${a.count} ${plural(a.count, "cliente que se aleja", "clientes que se alejan")}`, `Win back ${a.count} ${plural(a.count, "client who is drifting", "clients drifting away")}`),
        line: `${top.name}: ${reasonLine(top, tx).toLowerCase()} ${tx("Un mensaje a tiempo los trae de vuelta.", "A timely message brings them back.")}`,
        unit: tx("en juego al año", "at stake a year"),
        sign: "",
      };
    case "fill": {
      const l = a.light!;
      const day = tx(...DAY_PLURAL[l.dow]);
      const n = Math.round(l.load);
      const h = a.heavy;
      return {
        title: tx(`Llena tus ${day}`, `Fill your ${day}`),
        line: h
          ? tx(
              `Tienes ${n} ${plural(n, "patio", "patios")} y caben ${l.capacity}, mientras los ${DAY_PLURAL[h.dow][0]} van con ${Math.round(h.load)}. Pasa algunos a ese día y llena el resto con clientes nuevos.`,
              `You have ${n} ${plural(n, "yard", "yards")} and room for ${l.capacity}, while ${DAY_PLURAL[h.dow][1]} carry ${Math.round(h.load)}. Move some there and fill the rest with new clients.`,
            )
          : tx(
              `Tienes ${n} ${plural(n, "patio", "patios")} y caben ${l.capacity}. Busca clientes cerca de la ruta de ese día.`,
              `You have ${n} ${plural(n, "yard", "yards")} and room for ${l.capacity}. Look for clients near that day's route.`,
            ),
        unit: tx("al año, si lo llenas", "a year, once full"),
        sign: "+",
      };
    }
    case "plans":
      return {
        title: tx(`Ofrece un plan fijo a ${a.count} ${plural(a.count, "cliente de una vez", "clientes de una vez")}`, `Offer a regular plan to ${a.count} one-time ${plural(a.count, "client", "clients")}`),
        line: tx(
          `Cada 2 semanas por ${usd(a.typical ?? 0)}. Cada uno que diga que sí deja unos ${usd(a.impact)} al año.`,
          `Every 2 weeks for ${usd(a.typical ?? 0)}. Each one who says yes brings about ${usd(a.impact)} a year.`,
        ),
        unit: tx("por cada sí", "per yes"),
        sign: "+",
      };
    default:
      return {
        title: tx("Prepárate para el invierno", "Get ready for winter"),
        line: tx(
          `De noviembre a febrero el trabajo baja un ${a.dropPct}%. Ofrece extras (poda, abono, limpieza) o una cuota fija al mes.`,
          `From November to February work drops ${a.dropPct}%. Offer extras (pruning, fertilizer, cleanup) or a fixed monthly fee.`,
        ),
        unit: tx("en juego", "at stake"),
        sign: "",
      };
  }
  void r;
}

function Bars({ rows }: { rows: { key: string | number; label: string; value: number; text: string; note?: string; tone?: string }[] }) {
  const arrived = useArrived();
  const max = Math.max(1, ...rows.map((x) => x.value));
  return (
    <ul className="as-bars">
      {rows.map((x, i) => (
        <li key={x.key} style={{ "--d": `${i * 90}ms` } as CSSProperties}>
          <span className="as-bars-name">{x.label}</span>
          <span className="as-bars-track"><i className={x.tone} style={{ transform: `scaleX(${arrived ? Math.max(0.04, x.value / max) : 0})` }} /></span>
          <span className="as-bars-val">{x.text}{x.note ? <small>{x.note}</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

function WeekViz({ week, light }: { week: AdvisorWeekday[]; light: AdvisorWeekday }) {
  const tx = useTx();
  const arrived = useArrived();
  const max = Math.max(1, ...week.map((w) => Math.max(w.capacity, w.load)));
  return (
    <div className="as-week" role="img" aria-label={tx("Patios por día de la semana", "Yards per weekday")}>
      {week.map((w, i) => {
        const on = w.dow === light.dow;
        return (
          <div key={w.dow} className={cn("as-week-col", on && "is-light")}>
            <span className="as-week-num">{Math.round(w.load)}<small>/{w.capacity}</small></span>
            <span className="as-week-bar">
              <span className="as-week-cap" style={{ height: `${(w.capacity / max) * 100}%` }} />
              <span
                className="as-week-load"
                style={{ height: `${(Math.min(w.load, max) / max) * 100}%`, transform: `scaleY(${arrived ? 1 : 0})`, transitionDelay: `${i * 70}ms` }}
              />
            </span>
            <span className="as-week-day">{tx(...DAY_SHORT[w.dow])}</span>
          </div>
        );
      })}
    </div>
  );
}

function SeasonViz({ months }: { months: { m: number; value: number }[] }) {
  const tx = useTx();
  const arrived = useArrived();
  const max = Math.max(1, ...months.map((x) => x.value));
  const letters = tx("es", "en") === "es" ? MONTH_LETTER_ES : MONTH_LETTER_EN;
  return (
    <div className="as-season" role="img" aria-label={tx("Trabajo por mes", "Work by month")}>
      {months.map((x, i) => {
        const winter = x.m === 11 || x.m === 12 || x.m === 1 || x.m === 2;
        return (
          <div key={x.m} className={cn("as-season-col", winter && "is-winter")}>
            <span className="as-season-bar">
              <i style={{ height: `${(x.value / max) * 100}%`, transform: `scaleY(${arrived ? 1 : 0})`, transitionDelay: `${i * 45}ms` }} />
            </span>
            <span className="as-season-m">{letters[x.m - 1]}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlanViz() {
  const tx = useTx();
  return (
    <div className="as-plan" role="img" aria-label={tx("Un corte cada 2 semanas", "A cut every 2 weeks")}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={cn("as-plan-wk", i % 2 === 0 && "is-cut")} style={{ animationDelay: `${150 + i * 70}ms` }}>
          {i % 2 === 0 ? <Sprout aria-hidden /> : null}
        </span>
      ))}
      <small>{tx("8 semanas", "8 weeks")}</small>
    </div>
  );
}

function ActionViz({ a }: { a: AdvisorAction }) {
  const tx = useTx();
  if (a.kind === "collect") {
    return (
      <Bars
        rows={a.people.slice(0, 3).map((p) => ({
          key: p.id,
          label: p.name,
          value: p.balance,
          text: usd(p.balance),
          note: p.payDays != null ? shortAgo(p.payDays, tx) : undefined,
          tone: "is-late",
        }))}
      />
    );
  }
  if (a.kind === "raise") {
    return (
      <ul className="as-steps">
        {a.people.slice(0, 3).map((p, i) => (
          <li key={p.id} style={{ "--d": `${i * 90}ms` } as CSSProperties}>
            <span className="as-bars-name">{p.name}</span>
            <span className="as-price is-old">{usd(p.price)}</span>
            <ChevronRight aria-hidden className="as-steps-arrow" />
            <span className="as-price is-new">{usd(p.suggested ?? p.price)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (a.kind === "winback") {
    const p = a.people[0];
    if (p.reason === "gap" && p.sinceCut != null && p.every > 0) {
      return (
        <Bars
          rows={[
            { key: "n", label: tx("Lo normal", "Usual"), value: p.every, text: tx(`${p.every} días`, `${p.every} days`), tone: "is-done" },
            { key: "a", label: tx("Ahora", "Now"), value: p.sinceCut, text: tx(`${p.sinceCut} días`, `${p.sinceCut} days`), tone: "is-hold" },
          ]}
        />
      );
    }
    return (
      <Bars
        rows={a.people.slice(0, 3).map((p) => ({ key: p.id, label: p.name, value: p.monthly, text: `${usd(p.monthly)}${tx("/mes", "/mo")}`, tone: "is-hold" }))}
      />
    );
  }
  if (a.kind === "fill" && a.week && a.light) return <WeekViz week={a.week} light={a.light} />;
  if (a.kind === "plans") return <PlanViz />;
  if (a.kind === "season" && a.months) return <SeasonViz months={a.months} />;
  return null;
}

function GoClient({ id, children, className }: { id: number; children: ReactNode; className?: string }) {
  return (
    <Link to="/clientes/$id" params={{ id: String(id) }} className={className}>
      {children}
    </Link>
  );
}

function ActionDo({ a, r }: { a: AdvisorAction; r: AdvisorReading }) {
  const tx = useTx();
  const top = a.people.find((p) => p.phone) ?? null;
  const plan = a.typical ?? 0;
  const msgLabel = (p: AdvisorPerson) =>
    a.kind === "collect" ? tx(`Cobrar a ${firstName(p.name)}`, `Ask ${firstName(p.name)} to pay`)
    : a.kind === "raise" ? tx(`Avisar a ${firstName(p.name)}`, `Tell ${firstName(p.name)}`)
    : a.kind === "plans" ? tx(`Ofrecer a ${firstName(p.name)}`, `Offer ${firstName(p.name)}`)
    : tx(`Escribir a ${firstName(p.name)}`, `Message ${firstName(p.name)}`);
  const message = top ? (
    <MessageComposer phone={top.phone!} name={top.name} initialText={messageFor(top, r.business, tx, plan)} label={msgLabel(top)} className="as-btn-main" />
  ) : null;
  if (a.kind === "collect") {
    return (
      <div className="as-do">
        {message}
        <Link to="/cobros" search={{ view: "owing" }} hash="lista" className="as-btn">
          <Wallet aria-hidden />{tx("Abrir Cobros", "Open Payments")}
        </Link>
      </div>
    );
  }
  if (a.kind === "fill") {
    return (
      <div className="as-do">
        <Link to="/nuevo" className="as-btn as-btn-solid"><CalendarPlus aria-hidden />{tx("Añadir cliente", "Add client")}</Link>
        <Link to="/agenda" className="as-btn">{tx("Ver agenda", "Open schedule")}</Link>
      </div>
    );
  }
  if (a.kind === "season") {
    return (
      <div className="as-do">
        <Link to="/ajustes" hash="aj-temporada" className="as-btn as-btn-solid"><Snowflake aria-hidden />{tx("Temporada en Ajustes", "Season in Settings")}</Link>
        <Link to="/clientes" className="as-btn">{tx("Ver clientes", "Open clients")}</Link>
      </div>
    );
  }
  const first = a.people[0];
  return (
    <div className="as-do">
      {message}
      {first ? (
        <GoClient id={first.id} className="as-btn">
          {tx("Ver a", "Open")} {firstName(first.name)}<ChevronRight aria-hidden />
        </GoClient>
      ) : null}
    </div>
  );
}

function PeopleList({ people, r, plan, extra }: { people: AdvisorPerson[]; r: AdvisorReading; plan: number; extra?: number }) {
  const tx = useTx();
  return (
    <ul className="as-people">
      {people.map((p, i) => (
        <li key={p.id} style={{ "--d": `${i * 50}ms` } as CSSProperties}>
          <GoClient id={p.id} className="as-person">
            <span className="as-person-name">{p.name}</span>
            <span className="as-person-tip">{tipLine(p, tx, plan)}</span>
          </GoClient>
          {p.phone ? <MessageComposer phone={p.phone} name={p.name} compact tight initialText={messageFor(p, r.business, tx, plan)} /> : null}
          <GoClient id={p.id} className="as-person-go"><ChevronRight aria-hidden /></GoClient>
        </li>
      ))}
      {extra && extra > 0 ? <li className="as-people-more">{tx(`y ${extra} más`, `and ${extra} more`)}</li> : null}
    </ul>
  );
}

function ActionCard({ a, i, r }: { a: AdvisorAction; i: number; r: AdvisorReading }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const w = actionWords(a, r, tx);
  const Icon = ACT_ICON[a.kind];
  const listed = a.people.length;
  return (
    <li className={cn("as-act", ACT_TONE[a.kind])} style={{ "--i": i + 1 } as CSSProperties}>
      <div className="as-act-head">
        <span className="as-act-pic" aria-hidden>
          <Icon />
          <b className="as-act-n">{i + 1}</b>
        </span>
        <div className="as-act-fig">
          <span className="as-act-money">{w.sign}<CountUp value={a.impact} format={usd} /></span>
          <small>{w.unit}</small>
        </div>
      </div>
      <p className="as-act-title">{w.title}</p>
      <p className="as-act-line">{w.line}</p>
      <ActionViz a={a} />
      <ActionDo a={a} r={r} />
      {listed > 0 ? (
        <>
          <button type="button" className="as-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? tx("Ocultar", "Hide") : tx(`Ver a quién (${a.count})`, `See who (${a.count})`)}
            <ChevronDown aria-hidden className={cn(open && "rotate-180")} />
          </button>
          {open ? <PeopleList people={a.people} r={r} plan={a.typical ?? 0} extra={a.count - listed} /> : null}
        </>
      ) : null}
    </li>
  );
}

function Actions({ r }: { r: AdvisorReading }) {
  const tx = useTx();
  const acts = useRef<HTMLOListElement | null>(null);
  const width = usePageWidth();
  useMasonry(acts, width >= 1150 ? 3 : width >= 600 ? 2 : 0, 11, true);
  return (
    <section data-spot="asesor-pasos" className="as-card" data-masonry-full style={{ "--i": 1 } as CSSProperties}>
      <h3 className="as-h3"><Leafy />{tx("Lo que yo haría ahora", "What I'd do now")}</h3>
      {r.actions.length ? (
        <ol ref={acts} className="as-acts">
          {r.actions.map((a, i) => <ActionCard key={a.kind} a={a} i={i} r={r} />)}
        </ol>
      ) : (
        <p className="as-calm"><Check aria-hidden />{tx("Nada urgente. Todo está en orden: sigue así.", "Nothing urgent. Everything is in order: keep it up.")}</p>
      )}
    </section>
  );
}

function Leafy() {
  return (
    <svg viewBox="0 0 12 20" className="as-leaf" aria-hidden>
      <path d="M6 20C2 14 1 7 6 0c2 6 3 13 0 20z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ groups */

const GROUP_META: Record<AdvisorGroupKey, { icon: LucideIcon; tone: string; es: string; en: string; mean: [string, string] }> = {
  estrellas: { icon: Star, tone: "is-abono", es: "Estrellas", en: "Stars", mean: ["Pagan a tiempo y dejan más dinero. Cuídalos.", "Pay on time and bring the most. Look after them."] },
  fieles: { icon: Heart, tone: "is-done", es: "Fieles", en: "Loyal", mean: ["Vienen y pagan normal. La base del negocio.", "Steady and paying. The base of the business."] },
  riesgo: { icon: AlertTriangle, tone: "is-hold", es: "En riesgo", en: "At risk", mean: ["Se están alejando: mucho sin corte, en pausa o cambian seguido.", "Drifting away: long gaps, paused, or often moved."] },
  morosos: { icon: Wallet, tone: "is-late", es: "Morosos", en: "Late payers", mean: ["Te deben con atraso. Cobra primero.", "They owe you, overdue. Collect first."] },
  ocasionales: { icon: Repeat, tone: "is-money", es: "Ocasionales", en: "One-time", mean: ["Trabajos de una vez, sin plan fijo.", "One-time jobs, no regular plan."] },
};
const GROUP_ORDER: AdvisorGroupKey[] = ["estrellas", "fieles", "riesgo", "morosos", "ocasionales"];

function Groups({ r }: { r: AdvisorReading }) {
  const tx = useTx();
  const [pick, setPick] = useState<AdvisorGroupKey | null>(null);
  const arrived = useArrived();
  const groups = GROUP_ORDER.map((k) => r.groups.find((g) => g.key === k)!).filter(Boolean);
  const total = Math.max(1, groups.reduce((t, g) => t + g.count, 0));
  const max = Math.max(1, ...groups.map((g) => g.count));
  const chosen = groups.find((g) => g.key === pick) ?? null;
  const plan = r.actions.find((a) => a.kind === "plans")?.typical ?? 0;
  const moneyLabel = (k: AdvisorGroupKey, v: number) =>
    k === "morosos" ? tx(`${usd(v)} deben`, `${usd(v)} owed`) : k === "ocasionales" ? tx(`${usd(v)} en el año`, `${usd(v)} this year`) : tx(`${usd(v)}/mes`, `${usd(v)}/mo`);
  return (
    <section data-spot="asesor-grupos" className="as-card" style={{ "--i": 2 } as CSSProperties}>
      <h3 className="as-h3"><Leafy />{tx("Tus clientes, en grupos", "Your clients, in groups")}</h3>
      <div className="as-share" aria-hidden>
        {groups.filter((g) => g.count > 0).map((g) => (
          <i key={g.key} className={GROUP_META[g.key].tone} style={{ flexGrow: arrived ? g.count / total : 0.0001 }} />
        ))}
      </div>
      <div className="as-garden" role="list">
        {groups.map((g, i) => {
          const m = GROUP_META[g.key];
          const Icon = m.icon;
          const d = g.count > 0 ? 34 + 30 * Math.sqrt(g.count / max) : 30;
          return (
            <button
              key={g.key}
              type="button"
              role="listitem"
              aria-pressed={pick === g.key}
              disabled={g.count === 0}
              onClick={() => setPick((cur) => (cur === g.key ? null : g.key))}
              className={cn("as-bed", m.tone, pick === g.key && "is-picked", g.count === 0 && "is-empty")}
              style={{ "--d": `${120 + i * 90}ms` } as CSSProperties}
            >
              <span className="as-bed-pot">
                <span className="as-bubble" style={{ width: d, height: d }}>
                  <b>{g.count}</b>
                </span>
                <Icon aria-hidden className="as-bed-icon" />
              </span>
              <span className="as-bed-name">{tx(m.es, m.en)}</span>
              <span className="as-bed-money">{g.count ? moneyLabel(g.key, g.money) : "—"}</span>
            </button>
          );
        })}
      </div>
      {chosen ? (
        <div className="as-group-open" key={chosen.key}>
          <p className="as-group-mean">{tx(...GROUP_META[chosen.key].mean)}</p>
          <PeopleList people={chosen.people.slice(0, 12)} r={r} plan={plan || Math.round(r.pillars.find((p) => p.key === "precios")?.c ?? 0)} extra={chosen.count - Math.min(12, chosen.people.length)} />
        </div>
      ) : (
        <p className="as-hint-line">{tx("Toca un grupo para ver a quién y qué hacer con cada uno.", "Tap a group to see who is in it and what to do with each.")}</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ checks */

const PILLAR_TITLE: Record<AdvisorPillarKey, [string, string]> = {
  cobro: ["Cobras a tiempo", "Paid on time"],
  precios: ["Tus precios", "Your prices"],
  clientes: ["Clientes que se van", "Clients leaving"],
  agenda: ["Semana llena", "Full week"],
  fijo: ["Ingreso fijo", "Fixed income"],
};

export function pillarWords(p: AdvisorPillar, r: AdvisorReading, tx: Tx): { line: string; more: string } {
  switch (p.key) {
    case "cobro":
      return {
        line: tx(`Cobraste ${Math.min(100, p.a)}% del trabajo de 90 días. ${p.b} con atraso.`, `You collected ${Math.min(100, p.a)}% of 90 days of work. ${p.b} overdue.`),
        more: tx(
          `Lo sano: cobrar al menos 92 de cada 100 dólares trabajados y pocos clientes con atraso. Hoy deben ${usd(p.c)} con atraso. Cobra el mismo día cuando puedas.`,
          `Healthy: collect at least 92 of every 100 dollars worked, with few overdue clients. Overdue today: ${usd(p.c)}. Collect the same day when you can.`,
        ),
      };
    case "precios":
      return {
        line: p.a > 0
          ? tx(`${p.a} de ${p.b} clientes antiguos pagan poco.`, `${p.a} of ${p.b} long-time clients pay too little.`)
          : tx("Tus precios van parejos.", "Your prices are even."),
        more: tx(
          `El precio normal por patio es ${usd(p.c)}. A quien lleva más de un año pagando mucho menos, súbele poco a poco y avísale con tiempo.`,
          `The usual price per yard is ${usd(p.c)}. For clients paying much less after a year, raise it a little at a time, with notice.`,
        ),
      };
    case "clientes":
      return {
        line: p.a > 0
          ? tx(`${p.a} de ${p.b} clientes fijos se alejan.${p.c > 0 ? ` ${p.c} ${plural(p.c, "nuevo", "nuevos")} en 4 meses.` : ""}`, `${p.a} of ${p.b} regulars drifting.${p.c > 0 ? ` ${p.c} new in 4 months.` : ""}`)
          : p.c > 0
            ? tx(`Nadie se está yendo. ${p.c} ${plural(p.c, "nuevo", "nuevos")} en 4 meses.`, `Nobody is leaving. ${p.c} new in 4 months.`)
            : tx("Nadie se está yendo.", "Nobody is leaving."),
        more: tx(
          "Cuenta a quien lleva el doble de lo normal sin corte, tiene el servicio en pausa, lo dejó hace poco o pospone seguido. Recuperar a un cliente cuesta menos que buscar uno nuevo.",
          "Counts clients with twice the usual gap, paused service, recently stopped, or who postpone often. Keeping a client costs less than finding a new one.",
        ),
      };
    case "agenda":
      return {
        line: tx(`Llena al ${p.a}%: ${p.b} de ${p.c} patios por semana.`, `${p.a}% full: ${p.b} of ${p.c} yards a week.`),
        more: r.hasGoals
          ? tx("Se mide contra tu meta de patios por día (Esfuerzo de la semana), con lo agendado en las próximas 4 semanas.", "Measured against your daily yard goal (Week effort), using the next 4 weeks of schedule.")
          : tx("Se mide contra tu día más lleno. Pon tu meta de patios por día en Esfuerzo de la semana y lo mediré mejor.", "Measured against your busiest day. Set your daily yard goal in Week effort for a better reading."),
      };
    default:
      return {
        line: tx(`Tus fijos dejan ${usd(p.a)} al mes.`, `Your regulars bring ${usd(p.a)} a month.`),
        more: tx(
          `Los últimos 3 meses promediaron ${usd(p.b)} de trabajo. ${p.c > 25 ? `Tu cliente más grande es el ${p.c}% de todo: no dependas de uno solo.` : "Ningún cliente pesa demasiado."} Brizna no sabe tus gastos: compáralo con lo que gastas al mes.`,
          `The last 3 months averaged ${usd(p.b)} of work. ${p.c > 25 ? `Your biggest client is ${p.c}% of it all: don't rely on one.` : "No single client weighs too much."} Brizna doesn't know your costs: compare it with what you spend a month.`,
        ),
      };
  }
}

const STATUS_ICON = { pass: Check, warn: AlertTriangle, fail: X } as const;

function Checks({ r }: { r: AdvisorReading }) {
  const tx = useTx();
  const [open, setOpen] = useState<AdvisorPillarKey | null>(null);
  const arrived = useArrived();
  const passed = r.pillars.filter((p) => p.status === "pass").length;
  return (
    <section data-spot="asesor-chequeos" className="as-card" style={{ "--i": 3 } as CSSProperties}>
      <h3 className="as-h3">
        <Leafy />{tx("Cinco chequeos", "Five checks")}
        <span className="as-h3-note">{tx(`${passed} de 5 bien`, `${passed} of 5 good`)}</span>
      </h3>
      <ul className="as-checks">
        {r.pillars.map((p, i) => {
          const Icon = STATUS_ICON[p.status];
          const w = pillarWords(p, r, tx);
          const isOpen = open === p.key;
          return (
            <li key={p.key} className={cn("as-check", `is-${p.status}`)} style={{ "--d": `${i * 70}ms` } as CSSProperties}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((cur) => (cur === p.key ? null : p.key))}>
                <span className="as-check-dot"><Icon aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="as-check-title">{tx(...PILLAR_TITLE[p.key])}</span>
                  <span className="as-check-line">{w.line}</span>
                </span>
                <span className="as-check-meter" aria-hidden><i style={{ transform: `scaleX(${arrived ? Math.max(0.05, p.score) : 0})` }} /></span>
                <ChevronDown aria-hidden className={cn("as-check-chev", isOpen && "rotate-180")} />
              </button>
              {isOpen ? <p className="as-check-more">{w.more}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ glossary */

function Glossary() {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  const words: [string, string, string, string][] = [
    ["Puntaje", "Score", "De 0 a 100. Con 75 o más, el negocio va bien.", "0 to 100. At 75 or more, the business is doing well."],
    ["Saldo", "Balance", "Lo que un cliente te debe hoy.", "What a client owes you today."],
    ["Con atraso", "Overdue", "Debe hace más días, más dinero o más cortes de lo que marcaste en Ajustes.", "Owes for more days, money or cuts than you set in Settings."],
    ["Precio normal", "Usual price", "El precio del medio entre tus clientes con visitas parecidas.", "The middle price among your clients with similar visits."],
    ["En riesgo", "At risk", "Lleva el doble de lo normal sin corte, está en pausa, lo dejó o cambia seguido.", "Twice the usual gap, paused, stopped, or often moved."],
    ["Ingreso fijo", "Fixed income", "Lo que tus clientes fijos dejan en un mes normal.", "What your regular clients bring in a normal month."],
    ["Al año", "A year", "Lo que suma en 12 meses si lo haces y el cliente sigue.", "What it adds up to in 12 months if you do it and the client stays."],
  ];
  return (
    <section className="as-card as-words" style={{ "--i": 4 } as CSSProperties}>
      <button type="button" className="as-words-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="as-h3 m-0"><Leafy />{tx("Palabras claras", "Plain words")}</span>
        <ChevronDown aria-hidden className={cn("as-check-chev", open && "rotate-180")} />
      </button>
      {open ? (
        <dl className="as-gloss">
          {words.map(([es, en, des, den]) => (
            <div key={es}><dt>{tx(es, en)}</dt><dd>{tx(des, den)}</dd></div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ panel */

export function AsesorPanel() {
  const tx = useTx();
  const q = useQuery({ queryKey: ["advisor"], queryFn: () => getAdvisor() });
  if (q.isLoading) {
    return (
      <div className="as-skel" aria-busy>
        <span /><span /><span />
      </div>
    );
  }
  const r = q.data;
  if (!r || !r.hasData) {
    return (
      <section data-spot-alt="asesor asesor-pasos asesor-grupos asesor-chequeos" className="as-card as-empty bz-frame">
        <Sprout aria-hidden className="as-empty-sprout" />
        <p className="as-verdict">{tx("Añade clientes y aquí verás consejos.", "Add clients and you'll see advice here.")}</p>
        <p className="as-sub">{tx("Con unos cortes marcados como Hecho, te diré qué cobrar, a quién subir el precio y qué días llenar.", "Once a few cuts are marked Done, I'll tell you what to collect, whose price to raise and which days to fill.")}</p>
        <Link to="/nuevo" className="as-btn as-btn-solid mt-3"><CalendarPlus aria-hidden />{tx("Añadir cliente", "Add client")}</Link>
      </section>
    );
  }
  return <AsesorBoard r={r} />;
}

/** Phones: one column. Large screens: verdict and actions across, the rest in steady columns. */
function AsesorBoard({ r }: { r: AdvisorReading }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const width = usePageWidth();
  useMasonry(wrap, width >= 880 ? 2 : 0, 14);
  return (
    <div ref={wrap} className="as-wrap">
      <Hero r={r} />
      <Actions r={r} />
      <Groups r={r} />
      <Checks r={r} />
      <Glossary />
    </div>
  );
}
