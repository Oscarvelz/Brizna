import { useMasonry, usePageWidth } from "@/components/wide-layout";
import { useQuery } from "@tanstack/react-query";
import { STUDY_GC } from "@/lib/study-warm";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarPlus,
  CalendarX2,
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
  TrendingDown,
  TrendingUp,
  Timer,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
const DAY_ONE: Record<number, [string, string]> = {
  0: ["domingo", "Sunday"], 1: ["lunes", "Monday"], 2: ["martes", "Tuesday"], 3: ["miércoles", "Wednesday"],
  4: ["jueves", "Thursday"], 5: ["viernes", "Friday"], 6: ["sábado", "Saturday"],
};
const DAY_SHORT: Record<number, [string, string]> = {
  0: ["Do", "Su"], 1: ["Lu", "Mo"], 2: ["Ma", "Tu"], 3: ["Mi", "We"], 4: ["Ju", "Th"], 5: ["Vi", "Fr"], 6: ["Sá", "Sa"],
};
const MONTH_LETTER_ES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_LETTER_EN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/* ------------------------------------------------------------------ messages */

function messageFor(p: AdvisorPerson, business: string, tx: Tx, plan?: number, kind?: AdvisorAction["kind"]): string {
  const n = firstName(p.name);
  // 1.5.01: a client with no visit booked gets a booking message; a yard priced under its time gets the raise one.
  if (kind === "unbooked") {
    return tx(
      `Hola ${n}, te saluda ${business}. No tengo tu próximo corte en la agenda. ¿Te lo dejo para esta semana o la próxima?`,
      `Hi ${n}, this is ${business}. I don't have your next cut on the schedule. Shall I book you for this week or next?`,
    );
  }
  const tip = kind === "time" ? "raise" : p.tip;
  switch (tip) {
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

/** 1.4.99 (Oscar): the score as a refined gauge. A 270° ring open at the bottom: a hairline neutral track, the
 *  score arc in the band colour with a soft tonal gradient and round caps, fine ticks every 10 points, a small dot
 *  at the value and a static soft glow inside. The arc draws once from 0 (ease-out, no overshoot); reduced motion
 *  shows it drawn. The big serif number, "/100" and the band pill sit inside. */
function ScoreGauge({ score, tone, word }: { score: number; tone: "good" | "warn" | "bad"; word: string }) {
  const uid = useId().replace(/:/g, "");
  const size = 148;
  const c = size / 2;
  const r = 60;
  const v = Math.max(0, Math.min(100, Math.round(score)));
  const a0 = 135; // start angle (degrees, clockwise from 3 o'clock): bottom left
  const sweep = 270;
  const pt = (deg: number, rad: number) => {
    const t = (deg * Math.PI) / 180;
    return [c + rad * Math.cos(t), c + rad * Math.sin(t)] as const;
  };
  const [sx, sy] = pt(a0, r);
  const [ex, ey] = pt(a0 + sweep, r);
  const arc = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const deg = a0 + (i / 10) * sweep;
    const major = i % 5 === 0;
    const [x1, y1] = pt(deg, r + 7.5);
    const [x2, y2] = pt(deg, r + (major ? 12 : 10.5));
    return { x1, y1, x2, y2, major, on: i * 10 <= v };
  });
  return (
    <div className={cn("as-dial as-gauge", TONE_CLASS[tone])} style={{ width: size, height: size, "--v": v, "--rot": `${(v / 100) * sweep}deg` } as CSSProperties} role="img" aria-label={`${v}/100 ${word}`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={`asg-${uid}`} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={ex} y2={ey}>
            <stop offset="0" className="as-gauge-s0" />
            <stop offset="0.55" className="as-gauge-s1" />
            <stop offset="1" className="as-gauge-s2" />
          </linearGradient>
          <radialGradient id={`asr-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" className="as-gauge-g0" />
            <stop offset="1" className="as-gauge-g1" />
          </radialGradient>
        </defs>
        <circle cx={c} cy={c} r={r - 6} fill={`url(#asr-${uid})`} className="as-gauge-glow" />
        {ticks.map((k, i) => (
          <line key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} className={cn("as-gauge-tick", k.major && "is-major", k.on && "is-on")} />
        ))}
        <path d={arc} className="as-gauge-track" pathLength={100} />
        <path d={arc} className="as-gauge-arc" pathLength={100} stroke={`url(#asg-${uid})`} style={{ strokeDasharray: `${v} 200` }} />
        <g className="as-gauge-knob" style={{ transformOrigin: `${c}px ${c}px` }}>
          <circle cx={pt(a0, r)[0]} cy={pt(a0, r)[1]} r={2.6} className="as-gauge-dot" />
        </g>
      </svg>
      <div className="as-dial-center">
        <CountUp className="as-dial-num" value={score} duration={950} format={(n) => String(n)} />
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
  // 1.5.08: an agenda with no measurable week (capacity 0) has no verdict to give —
  // it used to win "worst pillar" and announce a week 0% full with room for 0 more yards.
  const pool = r.pillars.filter((p) => !(p.key === "agenda" && p.c <= 0));
  return [...(pool.length ? pool : r.pillars)].sort((a, b) => RANK[b.status] - RANK[a.status] || lost(b) - lost(a))[0];
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
        <ScoreGauge score={r.score} tone={r.tone} word={v.word} />
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
    </section>
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
  unbooked: CalendarX2,
  trend: TrendingDown,
  time: Timer,
};
const ACT_TONE: Record<AdvisorAction["kind"], string> = {
  collect: "is-late",
  raise: "is-money",
  winback: "is-hold",
  fill: "is-done",
  plans: "is-abono",
  season: "is-money",
  unbooked: "is-hold",
  trend: "is-late",
  time: "is-money",
};

function reasonLine(p: AdvisorPerson, tx: Tx): string {
  if (p.reason === "gap") return tx(`Lleva ${p.sinceCut} días sin corte (lo normal: cada ${p.every}).`, `${p.sinceCut} days without a cut (usual: every ${p.every}).`);
  if (p.reason === "paused") return tx("Tiene el servicio en pausa.", "Their service is paused.");
  if (p.reason === "stopped") return tx("Dejó el servicio hace poco.", "Stopped the service recently.");
  return tx("Pospone o cancela seguido.", "Often postpones or cancels.");
}

function tipLine(p: AdvisorPerson, tx: Tx, plan: number): string {
  switch (p.tip) {
    case "collect": {
      const base = p.neverPaid
        ? tx(`Nunca te ha pagado: debe ${usd(p.balance)}.`, `Has never paid you: owes ${usd(p.balance)}.`)
        : p.payDays != null
          ? tx(`Debe ${usd(p.balance)} ${ago(p.payDays, tx)}.`, `Owes ${usd(p.balance)} ${ago(p.payDays, tx)}.`)
          : tx(`Debe ${usd(p.balance)}.`, `Owes ${usd(p.balance)}.`);
      const soon = p.booked ? tx(` Tiene ${p.booked} ${plural(p.booked, "corte agendado", "cortes agendados")} en 2 semanas: cobra antes de ir.`, ` ${p.booked} ${plural(p.booked, "cut", "cuts")} booked in 2 weeks: collect before you go.`) : tx(" Cóbrale.", " Collect.");
      return base + soon;
    }
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
          `${a.count} ${plural(a.count, "cliente te debe", "clientes te deben")} con atraso${a.neverPaid ? ` (${a.neverPaid} nunca te ${plural(a.neverPaid, "ha", "han")} pagado)` : ""}. Empieza por quien más debe y hace más tiempo.${a.bookedLate ? ` Tienes ${a.bookedLate} ${plural(a.bookedLate, "corte agendado", "cortes agendados")} con ellos en 2 semanas: cobra antes de volver.` : ""}`,
          `${a.count} ${plural(a.count, "client owes", "clients owe")} you, overdue${a.neverPaid ? ` (${a.neverPaid} never paid)` : ""}. Start with the biggest and oldest.${a.bookedLate ? ` You have ${a.bookedLate} ${plural(a.bookedLate, "cut", "cuts")} booked with them in 2 weeks: collect before you go back.` : ""}`,
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
        line: `${top.name}: ${reasonLine(top, tx).toLowerCase()} ${a.count === 1 ? tx("Un mensaje a tiempo lo trae de vuelta.", "A timely message brings them back.") : tx("Un mensaje a tiempo los trae de vuelta.", "A timely message brings them back.")}`,
        unit: tx("en juego al año", "at stake a year"),
        sign: "",
      };
    case "fill": {
      const l = a.light!;
      const day = tx(...DAY_PLURAL[l.dow]);
      const n = Math.round(l.load);
      const h = a.heavy;
      const empty = a.empty ?? [];
      const seen = l.seen ?? 0;
      const roomWord = a.roomFrom === "proven"
        ? seen >= 2
          ? tx(` (lo hiciste en ${seen} ${DAY_PLURAL[l.dow][0]} de los últimos 90 días)`, ` (you did it on ${seen} ${DAY_PLURAL[l.dow][1]} in the last 90 days)`)
          : tx(` (lo hiciste un ${DAY_ONE[l.dow][0]} de los últimos 90 días)`, ` (you did it one ${DAY_ONE[l.dow][1]} in the last 90 days)`)
        : "";
      const emptyNames = empty.slice(0, 6).map((d) => `${tx(...DAY_SHORT[new Date(`${d}T12:00:00`).getDay()])} ${Number(d.slice(8, 10))}`).join(", ");
      const emptyLine = empty.length >= 2
        ? tx(` En las próximas 2 semanas, ${empty.length} días de trabajo no tienen ningún patio (${emptyNames}).`, ` In the next 2 weeks, ${empty.length} work days have no yard at all (${emptyNames}).`)
        : "";
      if (a.emptyOnly) {
        return {
          title: tx(`Llena ${empty.length} días vacíos`, `Fill ${empty.length} empty days`),
          line: tx(
            `En las próximas 2 semanas, ${empty.length} días de trabajo no tienen ningún patio (${emptyNames}). Pasa ahí clientes de tus días llenos o busca clientes nuevos cerca de la ruta.`,
            `In the next 2 weeks, ${empty.length} work days have no yard at all (${emptyNames}). Move clients there from your full days or find new ones near the route.`,
          ),
          unit: tx("en 2 semanas, si los llenas", "in 2 weeks, once full"),
          sign: "+",
        };
      }
      return {
        title: tx(`Llena tus ${day}`, `Fill your ${day}`),
        line: (h
          ? tx(
              `Tienes ${n} ${plural(n, "patio", "patios")} y caben ${l.capacity}, mientras los ${DAY_PLURAL[h.dow][0]} van con ${Math.round(h.load)}. Pasa algunos a ese día y llena el resto con clientes nuevos.`,
              `You have ${n} ${plural(n, "yard", "yards")} and room for ${l.capacity}, while ${DAY_PLURAL[h.dow][1]} carry ${Math.round(h.load)}. Move some there and fill the rest with new clients.`,
            )
          : tx(
              `Tienes ${n} ${plural(n, "patio", "patios")} y caben ${l.capacity}. Busca clientes cerca de la ruta de ese día.`,
              `You have ${n} ${plural(n, "yard", "yards")} and room for ${l.capacity}. Look for clients near that day's route.`,
            )).replace(tx(`caben ${l.capacity}`, `room for ${l.capacity}`), tx(`caben ${l.capacity}${roomWord}`, `room for ${l.capacity}${roomWord}`)) + emptyLine,
        unit: tx("al año, si lo llenas", "a year, once full"),
        sign: "+",
      };
    }
    case "plans":
      return {
        title: tx(`Ofrece un plan fijo a ${a.count} ${plural(a.count, "cliente que vino una vez", "clientes que vinieron una vez")}`, `Offer a regular plan to ${a.count} one-time ${plural(a.count, "client", "clients")}`),
        line: tx(
          `Cada 2 semanas por ${usd(a.typical ?? 0)}. Cada uno que diga que sí deja unos ${usd(a.impact)} al año.`,
          `Every 2 weeks for ${usd(a.typical ?? 0)}. Each one who says yes brings about ${usd(a.impact)} a year.`,
        ),
        unit: tx("por cada sí", "per yes"),
        sign: "+",
      };
    case "unbooked":
      return {
        title: others > 0
          ? tx(`Agenda a ${top.name} y ${others} más`, `Book ${top.name} and ${others} more`)
          : tx(`Agenda a ${top.name}`, `Book ${top.name}`),
        line: tx(
          `${a.count} ${plural(a.count, "cliente fijo no tiene", "clientes fijos no tienen")} ninguna visita en las próximas 4 semanas. Sin fecha, se caen de la ruta sin que te des cuenta.`,
          `${a.count} regular ${plural(a.count, "client has", "clients have")} no visit in the next 4 weeks. With no date, they drop off the route unnoticed.`,
        ),
        unit: tx("en juego al año", "at stake a year"),
        sign: "",
      };
    case "trend": {
      const drop = a.beforeAvg ? Math.round((1 - (a.nowAvg ?? 0) / a.beforeAvg) * 100) : 0;
      const m = Number(r.today.slice(5, 7));
      const winter = m === 11 || m === 12 || m === 1 || m === 2;
      return {
        title: tx(`Tus semanas bajaron ${drop}%`, `Your weeks dropped ${drop}%`),
        line: tx(
          `Las últimas 4 semanas dejaron ${usd(a.nowAvg ?? 0)} por semana; las 4 de antes, ${usd(a.beforeAvg ?? 0)}.${winter ? " Parte es la temporada: el pasto crece menos." : ""} Mira qué días quedaron flojos y llénalos.`,
          `The last 4 weeks brought ${usd(a.nowAvg ?? 0)} a week; the 4 before, ${usd(a.beforeAvg ?? 0)}.${winter ? " Part of it is the season: grass grows slower." : ""} See which days went light and fill them.`,
        ),
        unit: tx("menos en 4 semanas", "less in 4 weeks"),
        sign: "",
      };
    }
    case "time":
      return {
        title: tx(`${a.count} ${plural(a.count, "patio paga", "patios pagan")} poco por su tiempo`, `${a.count} ${plural(a.count, "yard pays", "yards pay")} little for the time`),
        line: tx(
          `Tu hora vale ${usd(a.medianHourly ?? 0)} (lo del medio de tus patios medidos). ${top.name}: ${top.minutes} min por visita, de un Hecho al siguiente, por ${usd(top.price)}. Te deja ${usd(top.hourly ?? 0)} la hora. Sube su corte de ${usd(top.price)} a ${usd(top.suggested ?? top.price)}.`,
          `Your hour is worth ${usd(a.medianHourly ?? 0)} (the middle of your measured yards). ${top.name}: ${top.minutes} min per visit, from one Done to the next, for ${usd(top.price)}. That leaves you ${usd(top.hourly ?? 0)} an hour. Raise the cut from ${usd(top.price)} to ${usd(top.suggested ?? top.price)}.`,
        ),
        unit: tx("al año", "a year"),
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

/** 1.5.01: eight weeks of money (7-day blocks ending yesterday); the last four in full colour. */
function TrendViz({ weeks }: { weeks: { start: string; value: number }[] }) {
  const tx = useTx();
  const arrived = useArrived();
  const max = Math.max(1, ...weeks.map((x) => x.value));
  return (
    <div className="as-season as-trend" role="img" aria-label={tx("Dinero por semana, 8 semanas", "Money per week, 8 weeks")}>
      {weeks.map((x, i) => (
        <div key={x.start} className={cn("as-season-col", i >= 4 && "is-now")}>
          <span className="as-season-bar">
            <i style={{ height: `${(x.value / max) * 100}%`, transform: `scaleY(${arrived ? 1 : 0})`, transitionDelay: `${i * 45}ms` }} />
          </span>
          <span className="as-season-m">{Number(x.start.slice(8, 10))}</span>
        </div>
      ))}
    </div>
  );
}

function PlanViz() {
  const tx = useTx();
  return (
    <div className="as-plan" role="img" aria-label={tx("Un corte cada 2 semanas", "A cut every 2 weeks")}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={cn("as-plan-wk", i % 2 === 0 && "is-cut")} style={{ animationDelay: `${50 + i * 30}ms` }}>
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
  if (a.kind === "time") {
    return (
      <ul className="as-steps">
        {a.people.slice(0, 3).map((p, i) => (
          <li key={p.id} style={{ "--d": `${i * 90}ms` } as CSSProperties}>
            <span className="as-bars-name">{p.name}<small className="as-steps-note">{p.minutes} min · {usd(p.hourly ?? 0)}{tx("/h", "/h")}</small></span>
            <span className="as-price is-old">{usd(p.price)}</span>
            <ChevronRight aria-hidden className="as-steps-arrow" />
            <span className="as-price is-new">{usd(p.suggested ?? p.price)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (a.kind === "unbooked") {
    return (
      <Bars
        rows={a.people.slice(0, 3).map((p) => ({ key: p.id, label: p.name, value: p.monthly, text: `${usd(p.monthly)}${tx("/mes", "/mo")}`, note: p.nextCut ? undefined : tx("sin fecha", "no date"), tone: "is-hold" }))}
      />
    );
  }
  if (a.kind === "trend" && a.weeks) return <TrendViz weeks={a.weeks} />;
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
    : a.kind === "unbooked" ? tx(`Agendar a ${firstName(p.name)}`, `Book ${firstName(p.name)}`)
    : a.kind === "time" ? tx(`Avisar a ${firstName(p.name)}`, `Tell ${firstName(p.name)}`)
    : tx(`Escribir a ${firstName(p.name)}`, `Message ${firstName(p.name)}`);
  const message = top ? (
    <MessageComposer phone={top.phone!} name={top.name} initialText={messageFor(top, r.business, tx, plan, a.kind)} label={msgLabel(top)} className="as-btn-main" />
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
  if (a.kind === "trend") {
    return (
      <div className="as-do">
        <Link to="/agenda" className="as-btn as-btn-solid"><CalendarPlus aria-hidden />{tx("Ver agenda", "Open schedule")}</Link>
        <Link to="/cobros" className="as-btn"><Wallet aria-hidden />{tx("Abrir Cobros", "Open Payments")}</Link>
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

/** 1.5.01: inside an action's list, each person's line speaks to that action (its own number). */
function kindTip(p: AdvisorPerson, kind: AdvisorAction["kind"] | undefined, tx: Tx): string | null {
  if (kind === "unbooked") {
    return p.nextCut
      ? tx(`Próxima visita: ${p.nextCut.slice(8, 10)}/${p.nextCut.slice(5, 7)}. Deja ${usd(p.monthly)} al mes.`, `Next visit: ${p.nextCut.slice(5, 7)}/${p.nextCut.slice(8, 10)}. Brings ${usd(p.monthly)} a month.`)
      : tx(`Sin próxima visita. Deja ${usd(p.monthly)} al mes.`, `No next visit. Brings ${usd(p.monthly)} a month.`);
  }
  if (kind === "time" && p.minutes) {
    return tx(
      `${p.minutes} min por ${usd(p.price)} = ${usd(p.hourly ?? 0)} la hora. Sube a ${usd(p.suggested ?? p.price)} (+${usd(p.gainYear)} al año).`,
      `${p.minutes} min for ${usd(p.price)} = ${usd(p.hourly ?? 0)} an hour. Raise to ${usd(p.suggested ?? p.price)} (+${usd(p.gainYear)} a year).`,
    );
  }
  return null;
}

function PeopleList({ people, r, plan, extra, kind }: { people: AdvisorPerson[]; r: AdvisorReading; plan: number; extra?: number; kind?: AdvisorAction["kind"] }) {
  const tx = useTx();
  return (
    <ul className="as-people">
      {people.map((p, i) => (
        <li key={p.id} style={{ "--d": `${i * 50}ms` } as CSSProperties}>
          <GoClient id={p.id} className="as-person">
            <span className="as-person-name">{p.name}</span>
            <span className="as-person-tip">{kindTip(p, kind, tx) ?? tipLine(p, tx, plan)}</span>
          </GoClient>
          {p.phone ? <MessageComposer phone={p.phone} name={p.name} compact tight initialText={messageFor(p, r.business, tx, plan, kind)} /> : null}
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
        {/* 1.4.83 (Oscar): the overdue card wears the same tilted "!" sticker as late client cards, in its empty top-right corner. */}
        {ACT_TONE[a.kind] === "is-late" ? <span className="as-bang" aria-hidden><span>!</span></span> : null}
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
          {open ? <PeopleList people={a.people} r={r} plan={a.typical ?? 0} extra={a.count - listed} kind={a.kind} /> : null}
        </>
      ) : null}
    </li>
  );
}

function Actions({ r }: { r: AdvisorReading }) {
  const tx = useTx();
  const acts = useRef<HTMLOListElement | null>(null);
  const [all, setAll] = useState(false);
  const width = usePageWidth();
  useMasonry(acts, width >= 1150 ? 3 : width >= 600 ? 2 : 0, 11, true);
  return (
    <section data-spot="asesor-pasos" className="as-card" data-masonry-full style={{ "--i": 1 } as CSSProperties}>
      <h3 className="as-h3"><Leafy />{tx("Lo que yo haría ahora", "What I'd do now")}</h3>
      {r.actions.length ? (
        <>
          <ol ref={acts} className="as-acts">
            {r.actions.slice(0, all ? undefined : 3).map((a, i) => <ActionCard key={a.kind} a={a} i={i} r={r} />)}
          </ol>
          {r.actions.length > 3 ? (
            <button type="button" className="as-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? tx("Ver solo las tres primeras", "Show only the first three") : tx(`Ver ${r.actions.length - 3} ${plural(r.actions.length - 3, "consejo más", "consejos más")}`, `See ${r.actions.length - 3} more ${plural(r.actions.length - 3, "tip", "tips")}`)}
              <ChevronDown aria-hidden className={cn(all && "rotate-180")} />
            </button>
          ) : null}
        </>
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
      // 1.5.08: no goals and nothing proven = no measure, said plainly instead of "0 of 0 yards".
      if (p.c <= 0) {
        return {
          line: tx("Aún no puedo medir tu semana.", "I can't measure your week yet."),
          more: tx("Sin metas de patios ni días probados no hay medida. Pon tu meta de patios por día en Esfuerzo de la semana, o marca cortes como Hecho, y la mido.", "With no yard goals and no proven days there is nothing to measure against. Set your daily yard goal in Week effort, or mark cuts Done, and I'll measure it."),
        };
      }
      return {
        line: tx(`Llena al ${p.a}%: ${p.b} de ${p.c} patios por semana.`, `${p.a}% full: ${p.b} of ${p.c} yards a week.`),
        more: r.hasGoals
          ? tx("Se mide contra tu meta de patios por día (Esfuerzo de la semana), con lo agendado en las próximas 4 semanas.", "Measured against your daily yard goal (Week effort), using the next 4 weeks of schedule.")
          : tx("Se mide contra lo más que hiciste cada día de la semana al menos 2 veces en los últimos 90 días. Pon tu meta de patios por día en Esfuerzo de la semana y lo mediré mejor.", "Measured against the most you did on each weekday at least twice in the last 90 days. Set your daily yard goal in Week effort for a better reading."),
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

/** 1.5.01: every check ends in one tap that acts on it. */
function CheckDo({ p, r }: { p: AdvisorPillar; r: AdvisorReading }) {
  const tx = useTx();
  const act = (k: AdvisorAction["kind"]) => r.actions.find((a) => a.kind === k);
  if (p.key === "cobro") {
    return (
      <div className="as-do as-check-do">
        <Link to="/cobros" search={{ view: "owing" }} hash="lista" className="as-btn"><Wallet aria-hidden />{tx("Abrir Cobros", "Open Payments")}</Link>
      </div>
    );
  }
  if (p.key === "agenda") {
    return (
      <div className="as-do as-check-do">
        <Link to="/agenda" className="as-btn"><CalendarPlus aria-hidden />{tx("Ver agenda", "Open schedule")}</Link>
      </div>
    );
  }
  const who = p.key === "precios"
    ? (act("raise") ?? act("time"))?.people[0]
    : p.key === "clientes"
      ? r.groups.find((g) => g.key === "riesgo")?.people[0] ?? act("unbooked")?.people[0]
      : r.groups.find((g) => g.key === "ocasionales")?.people.find((x) => x.value12 > 0);
  if (who) {
    return (
      <div className="as-do as-check-do">
        <GoClient id={who.id} className="as-btn">{tx("Ver a", "Open")} {firstName(who.name)}<ChevronRight aria-hidden /></GoClient>
      </div>
    );
  }
  return (
    <div className="as-do as-check-do">
      <Link to="/clientes" className="as-btn">{tx("Ver clientes", "Open clients")}<ChevronRight aria-hidden /></Link>
    </div>
  );
}

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
              {isOpen ? (
                <>
                  <p className="as-check-more">{w.more}</p>
                  <CheckDo p={p} r={r} />
                </>
              ) : null}
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
    ["Tu hora", "Your hour", "Precio ÷ minutos por visita, medidos entre un Hecho y el anterior de ese día (o la hora de entrada). Cuenta con 3 visitas medidas o más.", "Price ÷ minutes per visit, measured between one Done and the one before it that day (or clock-in). Counts with 3 or more measured visits."],
    ["Sin próxima visita", "No next visit", "Cliente fijo activo sin ningún corte agendado en las próximas 4 semanas.", "An active regular client with no cut booked in the next 4 weeks."],
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
  const q = useQuery({ queryKey: ["advisor"], queryFn: () => getAdvisor(), gcTime: STUDY_GC, refetchOnMount: false });
  if (q.isLoading) {
    return (
      <div className="as-skel" aria-busy>
        <span /><span /><span />
      </div>
    );
  }
  if (q.isError) {
    return (
      <section data-spot-alt="asesor" className="as-card as-empty bz-frame">
        <Sprout aria-hidden className="as-empty-sprout" />
        <p className="as-verdict">{tx("No pude leer tus datos.", "I couldn't read your data.")}</p>
        <p className="as-sub">{tx("Algo falló al preparar tus consejos. Tus datos están a salvo: intenta de nuevo.", "Something failed while preparing your advice. Your data is safe: try again.")}</p>
        <button type="button" className="as-btn as-btn-solid mt-3" onClick={() => void q.refetch()}>{tx("Reintentar", "Retry")}</button>
      </section>
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
