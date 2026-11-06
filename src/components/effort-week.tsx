import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Fold } from "@/components/fold";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { formatLongDay, weekdayOptions } from "@/lib/format";
import { smartHit } from "@/lib/fuzzy";
import { useTx } from "@/lib/i18n";
import { useCifraRank } from "@/lib/cifras-order";
import { secStyle } from "@/components/cifras-visuals";
import { upsertDayGoal } from "@/lib/server/lawn";
import type { DayEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EffortWeek({
  days,
  today,
  weekDone,
  goals,
  query = "",
}: {
  days: DayEffort[];
  today: string;
  weekDone: number;
  goals: { date: string; goal: number }[];
  query?: string;
}) {
  const qc = useQueryClient();
  const tx = useTx();
  const rank = useCifraRank("esfuerzo");
  const [editDate, setEditDate] = useState<string | null>(null);
  const goalByDate = new Map(goals.map((g) => [g.date, g.goal]));
  const editingGoal = editDate ? (goalByDate.get(editDate) ?? null) : null;
  const [draft, setDraft] = useState("8");

  useEffect(() => {
    if (!editDate) return;
    const existing = goalByDate.get(editDate);
    const day = days.find((d) => d.date === editDate);
    setDraft(String(existing ?? (day && day.done > 0 ? day.done : 8)));
  }, [editDate, goals, days]);

  const saveGoal = useMutation({
    mutationFn: (payload: { date: string; goal: number | null }) => upsertDayGoal({ data: payload }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditDate(null);
    },
  });

  const max = Math.max(
    1,
    ...days.map((d) => d.done + d.pending),
    ...days.map((d) => goalByDate.get(d.date) ?? 0),
  );
  const todayRow = days.find((d) => d.date === today);
  const todayDone = todayRow?.done ?? 0;
  const todayGoal = goalByDate.get(today) ?? null;

  const title = tx("Esfuerzo de la semana", "This week's effort");
  if (query.trim() && !smartHit(query, `${title} meta patios`)) return null;

  return (
    <Fold
      id="cif-esfuerzo"
      style={secStyle(rank)}
      className="cif-sec"
      title={title}
      hint={
        <Hint topic="esfuerzo" />
      }
    >
      <p className="mb-3 text-sm text-muted">
        {weekDone === 0
          ? tx(
              "Ningún trabajo terminado esta semana. Toca un día para fijar su meta.",
              "No jobs finished this week. Tap a day to set its goal.",
            )
          : tx(
              `${weekDone} ${weekDone === 1 ? "trabajo terminado" : "trabajos terminados"} esta semana.`,
              `${weekDone} ${weekDone === 1 ? "job finished" : "jobs finished"} this week.`,
            )}
        {weekDone > 0 && todayGoal
          ? todayDone >= todayGoal
            ? tx(
                ` Hoy va por encima: ${todayDone} de ${todayGoal}.`,
                ` Today is ahead: ${todayDone} of ${todayGoal}.`,
              )
            : tx(` Hoy: ${todayDone} de ${todayGoal}.`, ` Today: ${todayDone} of ${todayGoal}.`)
          : weekDone > 0
            ? tx(" Toca un día para fijar su meta.", " Tap a day to set its goal.")
            : ""}
      </p>
      {/* 1.4.91 (Oscar): one fixed track per day, the planned part in a faint ink, what is done in its tone,
          the goal as a small tick on the track; today = soft wash, the chosen day = primary ring. */}
      <div className="ew-days grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const label = weekdayOptions().find((w) => w.value === d.weekday)?.short ?? "";
          const isToday = d.date === today;
          const goal = goalByDate.get(d.date) ?? null;
          const planned = d.done + d.pending;
          const plannedPct = planned === 0 ? 0 : Math.max(10, Math.round((planned / max) * 100));
          const donePct = d.done === 0 ? 0 : Math.max(10, Math.round((d.done / max) * 100));
          const vsGoal =
            !goal || d.date > today || (d.date !== today && planned === 0)
              ? "none"
              : d.done >= goal
                ? "above"
                : d.date < today
                  ? "below"
                  : "today";
          const goalPct = goal ? Math.min(100, Math.round((goal / max) * 100)) : 0;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setEditDate(d.date)}
              aria-pressed={editDate === d.date}
              className={cn("ew-day touch-manipulation", isToday && "is-today", editDate === d.date && "is-sel")}
            >
              <span className="ew-track" aria-hidden>
                {plannedPct ? <span className="ew-plan" style={{ height: `${plannedPct}%` }} /> : null}
                {donePct ? (
                  <span
                    className={cn("ew-done", vsGoal === "below" ? "is-below" : vsGoal === "today" ? "is-today" : "is-ok")}
                    style={{ height: `${donePct}%` }}
                  />
                ) : null}
                {goal ? <span className={cn("ew-goal", d.date > today && "is-ahead")} style={{ bottom: `${goalPct}%` }} /> : null}
              </span>
              <span className="ew-lbl">{label}</span>
              <span
                className={cn(
                  "ew-num",
                  vsGoal === "above" && "text-done",
                  vsGoal === "below" && "text-late",
                  vsGoal === "today" && "text-pending",
                )}
              >
                {d.done}
                {d.pending > 0 ? <span className="ew-of">/{planned}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {editDate ? (
        (() => {
          const doneThere = days.find((d) => d.date === editDate)?.done ?? 0;
          const cur = Math.min(80, Math.max(1, Number(draft) || 1));
          const extra = [
            doneThere > 0 && doneThere !== editingGoal ? (
              <button key="match" type="button" className="ew-btn" disabled={saveGoal.isPending} onClick={() => saveGoal.mutate({ date: editDate, goal: doneThere })}>
                {tx(`Igualar a ${doneThere}`, `Match ${doneThere}`)}
              </button>
            ) : null,
            editingGoal ? (
              <button key="none" type="button" className="ew-btn" disabled={saveGoal.isPending} onClick={() => saveGoal.mutate({ date: editDate, goal: null })}>
                {tx("Sin meta", "No goal")}
              </button>
            ) : null,
          ].filter(Boolean);
          const close = (
            <button key="close" type="button" className="ew-btn" disabled={saveGoal.isPending} onClick={() => setEditDate(null)}>
              {tx("Cerrar", "Close")}
            </button>
          );
          const save = (
            <Button
              key="save"
              type="button"
              className={cn("ew-save h-11", extra.length === 1 && "col-span-2")}
              disabled={saveGoal.isPending}
              onClick={() => saveGoal.mutate({ date: editDate, goal: cur })}
            >
              {tx("Guardar meta", "Save goal")}
            </Button>
          );
          return (
            <div className="ew-ed mt-3.5">
              <p className="ew-ed-title first-letter:uppercase">
                {tx(`Meta del ${formatLongDay(editDate)}`, `Goal for ${formatLongDay(editDate)}`)}
              </p>
              <p className="ew-ed-sub">
                {editingGoal
                  ? tx(`Ahora: ${editingGoal} ${editingGoal === 1 ? "patio" : "patios"}.`, `Now: ${editingGoal} ${editingGoal === 1 ? "yard" : "yards"}.`)
                  : tx("Sin meta este día.", "No goal this day.")}
              </p>
              <div className="ew-ed-row">
                <span className="ew-ed-lbl">{tx("Patios de meta", "Goal yards")}</span>
                <div className="aj-num-ctl">
                  <button type="button" className="aj-num-btn" aria-label="−" disabled={cur <= 1} onClick={() => setDraft(String(Math.max(1, cur - 1)))}>
                    <span aria-hidden>−</span>
                  </button>
                  <label className="aj-num-val">
                    <input
                      inputMode="numeric"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
                      aria-label={tx("Patios de meta", "Goal yards")}
                      style={{ width: `${Math.max(2, draft.length) + 0.5}ch` }}
                    />
                  </label>
                  <button type="button" className="aj-num-btn" aria-label="+" disabled={cur >= 80} onClick={() => setDraft(String(Math.min(80, cur + 1)))}>
                    <span aria-hidden>+</span>
                  </button>
                </div>
              </div>
              <div className="ew-acts">
                {extra.length === 1 ? [save, extra[0], close] : [save, close, ...extra]}
              </div>
            </div>
          );
        })()
      ) : (
        <p className="mt-3 text-xs text-muted">
          {tx(
            "La meta de cada día de la semana se guarda para las próximas. Toca la columna para cambiarla.",
            "Each weekday goal is saved for the weeks ahead. Tap the column to change it.",
          )}
        </p>
      )}
    </Fold>
  );
}
