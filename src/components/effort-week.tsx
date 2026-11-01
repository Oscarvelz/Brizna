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
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const label = weekdayOptions().find((w) => w.value === d.weekday)?.short ?? "";
          const isToday = d.date === today;
          const goal = goalByDate.get(d.date) ?? null;
          const height = Math.max(8, Math.round(((d.done + d.pending) / max) * 56));
          const doneH = d.done + d.pending === 0 ? 0 : Math.round((d.done / (d.done + d.pending)) * height);
          const vsGoal =
            !goal || d.date > today || (d.date !== today && d.done + d.pending === 0)
              ? "none"
              : d.done >= goal
                ? "above"
                : d.date < today
                  ? "below"
                  : "today";
          const goalH = goal ? Math.max(2, Math.round((goal / max) * 56)) : 0;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setEditDate(d.date)}
              className={cn(
                "flex min-h-11 flex-col items-center gap-1 rounded-md px-0.5 py-1 touch-manipulation",
                isToday && "bg-today-bg",
                editDate === d.date && "bz-chosen",
              )}
            >
              <div className="relative flex h-14 w-full items-end justify-center">
                {goal && (d.date === today || d.done + d.pending > 0) ? (
                  <span
                    className="absolute right-0 left-0 border-t border-dashed border-muted"
                    style={{ bottom: `${goalH}px` }}
                    aria-hidden
                  />
                ) : null}
                <div
                  className="flex w-4 flex-col-reverse overflow-hidden rounded-sm bg-surface-2"
                  style={{ height: `${height}px` }}
                >
                  <div
                    className={cn(
                      "w-full",
                      vsGoal === "below" ? "bg-late" : vsGoal === "today" ? "bg-pending" : "bg-done",
                    )}
                    style={{ height: `${doneH}px` }}
                  />
                </div>
              </div>
              <p className={cn("text-xs font-semibold", isToday ? "text-today" : "text-muted")}>
                {label}
              </p>
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  vsGoal === "above" && "text-done",
                  vsGoal === "below" && "text-late",
                  vsGoal === "today" && "text-pending",
                )}
              >
                {d.done}
                {d.pending > 0 ? <span className="text-muted">/{d.done + d.pending}</span> : null}
              </p>
            </button>
          );
        })}
      </div>
      {editDate ? (
        <div className="mt-4 rounded-md bg-sun p-3">
          <p className="text-sm font-semibold first-letter:uppercase">
            {tx(`Meta del ${formatLongDay(editDate)}`, `Goal for ${formatLongDay(editDate)}`)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {editingGoal
              ? tx(
                  `Ahora mismo: ${editingGoal} patios. Puedes cambiarla o igualarla a lo hecho.`,
                  `Right now: ${editingGoal} yards. You can change it or match it to what is done.`,
                )
              : tx("Sin meta este día. Pon un número o déjalo así.", "No goal this day. Enter a number or leave it.")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="size-12 shrink-0 px-0"
              onClick={() => setDraft(String(Math.max(1, (Number(draft) || 1) - 1)))}
            >
              −
            </Button>
            <input
              type="number"
              min={1}
              max={80}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-sm bg-surface text-center font-display text-xl font-semibold tabular-nums shadow-card"
              aria-label={tx("Patios de meta", "Goal yards")}
            />
            <Button
              type="button"
              variant="outline"
              className="size-12 shrink-0 px-0"
              onClick={() => setDraft(String(Math.min(80, (Number(draft) || 1) + 1)))}
            >
              +
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              disabled={saveGoal.isPending}
              onClick={() =>
                saveGoal.mutate({ date: editDate, goal: Math.min(80, Math.max(1, Number(draft) || 1)) })
              }
            >
              {tx("Guardar meta", "Save goal")}
            </Button>
            <Button type="button" variant="outline" disabled={saveGoal.isPending} onClick={() => setEditDate(null)}>
              {tx("Cerrar", "Close")}
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saveGoal.isPending}
              onClick={() => saveGoal.mutate({ date: editDate, goal: null })}
            >
              {tx("Sin meta", "No goal")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saveGoal.isPending || (days.find((d) => d.date === editDate)?.done ?? 0) === 0}
              onClick={() => {
                const done = days.find((d) => d.date === editDate)?.done ?? 0;
                if (done > 0) saveGoal.mutate({ date: editDate, goal: done });
              }}
            >
              {tx("Igualar a lo hecho", "Match what is done")}
            </Button>
          </div>
        </div>
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
