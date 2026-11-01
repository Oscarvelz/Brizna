import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { markJump } from "@/lib/jump-back";
import { ChevronDown, ChevronLeft, ChevronRight, Palmtree, Pin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { OffDayDialog, shiftToMonday, useRareDay } from "@/components/off-day-ask";
import { ScrollTop } from "@/components/scroll-top";
import { UndoBar } from "@/components/undo-bar";
import { Hint } from "@/components/hint";
import { invalidateLawn, JobCard } from "@/components/job-card";
import { ReasonChips } from "@/components/reason-chips";
import { ReorderableJobs } from "@/components/reorder-jobs";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import {
  addDaysISO,
  addMonths,
  endOfWeekISO,
  holidayHits,
  holidayName,
  lastDayOfMonthISO,
  monthParts,
  startOfWeekISO,
  todayISO,
  weekdayFromISO,
} from "@/lib/dates";
import { viewGrid } from "@/lib/density";
import { formatDay, money, monthNames, weekdayOptions } from "@/lib/format";
import { useTx } from "@/lib/i18n";
import { useUndo } from "@/lib/undo";
import {
  getSettings,
  getWeekOff,
  listDueNotes,
  listJobs,
  moveDayJobs,
  postponeAccumulated,
  toggleOffDate,
  updateSettings,
} from "@/lib/server/lawn";
import type { JobListFilter, JobRange, JobRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  filter: z.enum(["pending", "late", "done", "cancelled", "all"]).optional(),
  range: z.enum(["week", "month", "ahead", "all", "history"]).optional(),
});

export const Route = createFileRoute("/agenda")({
  validateSearch: (s) => searchSchema.parse(s),
  component: function AgendaRoute() {
    return (
      <DensityScope scope="agenda">
        <AgendaPage />
      </DensityScope>
    );
  },
});

const FILTERS: { value: Exclude<JobListFilter, "all">; on: string }[] = [
  { value: "pending", on: "bg-pending-bg text-pending" },
  { value: "late", on: "bg-late-bg text-late" },
  { value: "done", on: "bg-done-bg text-done" },
  { value: "cancelled", on: "bg-[color-mix(in_srgb,#2a2a2a_82%,var(--color-surface))] text-[#f6f3ec]" },
];

const RANGES: { value: JobRange; labelEs: string; labelEn: string }[] = [
  { value: "week", labelEs: "Semana", labelEn: "Week" },
  { value: "month", labelEs: "Mes", labelEn: "Month" },
  { value: "all", labelEs: "Todo", labelEn: "All" },
];

function postponedJob(job: JobRow) {
  return Boolean(job.postponeReason) || (Boolean(job.originDate) && job.originDate !== job.scheduledDate);
}

function AgendaPage() {
  const tx = useTx();
  const search = Route.useSearch();
  const density = useDensity();
  const cols = useQuadCols();
  const now = monthParts(todayISO());
  const today = todayISO();
  const qc = useQueryClient();
  const undoPast = useUndo((s) => s.past.length);
  const undoFuture = useUndo((s) => s.future.length);
  const rare = useRareDay();
  const [rareMove, setRareMove] = useState<null | { iso: string; kind: "sunday" | "free"; run: (iso: string) => void }>(null);
  const [filter, setFilter] = useState<JobListFilter>(search.filter ?? "pending");
  const [range, setRange] = useState<JobRange>(search.range && search.range !== "history" ? search.range : "month");
  const [q, setQ] = useState("");
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState(addDaysISO(today, 1));
  const [accDate, setAccDate] = useState(addDaysISO(today, 1));
  const [accReason, setAccReason] = useState("");
  const [askAcc, setAskAcc] = useState<"overdue" | "today" | null>(null);
  const [weekCursor, setWeekCursor] = useState(today);
  const [offOpen, setOffOpen] = useState(() => {
    try {
      return localStorage.getItem("ols-agenda-off") === "1";
    } catch {
      return false;
    }
  });
  const [askOff, setAskOff] = useState<{ kind: "date" | "weekday"; value: string | number; label: string } | null>(null);
  const [offReason, setOffReason] = useState("");
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [pinnedOff, setPinnedOff] = useState(() => {
    try {
      return localStorage.getItem("ols-agenda-off-pin") === "1";
    } catch {
      return false;
    }
  });
  const [cal, setCal] = useState(false);
  const [calCursor, setCalCursor] = useState(now);
  const [weekOf, setWeekOf] = useState(today);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const holiday = useMemo(() => {
    const query = q.trim();
    if (query.length < 3) return null;
    return holidayHits(query, now.year)[0] ?? holidayHits(query, now.year + 1)[0] ?? null;
  }, [q, now.year]);
  useEffect(() => {
    setFocusDay(holiday?.iso ?? null);
  }, [holiday]);
  useEffect(() => {
    if (pinnedOff || !offOpen) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 28) {
        setOffOpen(false);
        try {
          localStorage.setItem("ols-agenda-off", "0");
        } catch {
          /* ignore */
        }
      }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pinnedOff, offOpen]);
  const skipFold = useRef(true);
  useEffect(() => {
    if (skipFold.current) {
      skipFold.current = false;
      return;
    }
    if (pinnedOff) return;
    setOffOpen(false);
    try {
      localStorage.setItem("ols-agenda-off", "0");
    } catch {
      /* ignore */
    }
  }, [filter, range, pinnedOff]);
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#ag-libres") return;
    setOffOpen(true);
    window.setTimeout(() => document.getElementById("ag-libres")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const offQ = useQuery({ queryKey: ["week-off"], queryFn: () => getWeekOff() });
  const excluded = settingsQ.data?.excludedWeekdays ?? [];
  const vacationOn = Boolean(settingsQ.data?.vacationStart && settingsQ.data?.vacationEnd);
  const status = filter === "all" ? "pending" : filter;
  const query = useQuery({
    queryKey: ["jobs", { filter: onlyMoved ? "all" : status, range, q }],
    queryFn: () =>
      listJobs({
        data: {
          filter: onlyMoved ? "all" : status,
          range,
          q,
        },
      }),
  });
  const jobs = (query.data ?? []).filter((job) =>
    onlyMoved ? postponedJob(job) && job.status !== "done" && job.status !== "cancelled" : true,
  );
  const grouped = useMemo(() => groupByDate(jobs), [jobs]);
  const bounds = useMemo(() => {
    if (range === "week") return { from: startOfWeekISO(today), to: endOfWeekISO(today) };
    if (range === "all" || range === "ahead") return { from: "0001-01-01", to: "9999-12-31" };
    const from = `${now.year}-${String(now.month).padStart(2, "0")}-01`;
    return { from, to: lastDayOfMonthISO(now.year, now.month) };
  }, [range, today, now.year, now.month]);
  const sections = useMemo(() => {
    const rows = (offQ.data?.postponed ?? []).filter((row) => row.date >= bounds.from && row.date <= bounds.to);
    const byDate = new Map(grouped);
    const dates = new Set<string>([...byDate.keys(), ...rows.map((row) => row.date)]);
    return [...dates]
      .sort()
      .map((date) => ({
        date,
        items: byDate.get(date) ?? [],
        report: rows.filter((row) => row.date === date),
      }))
      .filter((section) => section.items.length > 0 || section.report.length > 0);
  }, [grouped, offQ.data, bounds]);
  const total = jobs.reduce((sum, job) => sum + job.amount, 0);
  const gap = density === "dense" ? "gap-1.5" : density === "compact" ? "gap-2" : "gap-3";
  const overdueCount = jobs.filter((job) => job.computedStatus === "late").length;

  const moveMut = useMutation({
    mutationFn: (to: string) => moveDayJobs({ data: { from: moveFrom ?? today, to } }),
    onSuccess: async (res) => {
      const who = res.names.slice(0, 4).join(", ");
      toast.success(
        res.names.length
          ? tx(`Pasados al ${formatDay(res.date, "EEE d")}: ${who}${res.names.length > 4 ? "…" : ""}`, `Moved to ${formatDay(res.date, "EEE d")}: ${who}${res.names.length > 4 ? "…" : ""}`)
          : tx(`${res.moved} trabajos pasados al ${formatDay(res.date, "EEE d")}`, `${res.moved} jobs moved to ${formatDay(res.date, "EEE d")}`),
      );
      setMoveFrom(null);
      await invalidateLawn(qc);
    },
  });
  const accMut = useMutation({
    mutationFn: (input: { scope: "overdue" | "today"; date: string }) =>
      postponeAccumulated({ data: { date: input.date, scope: input.scope, reason: accReason } }),
    onSuccess: async (res) => {
      const who = res.names.slice(0, 4).join(", ");
      toast.success(
        res.names.length
          ? tx(`Pasados al ${formatDay(res.date, "EEE d")}: ${who}${res.names.length > 4 ? "…" : ""}`, `Moved to ${formatDay(res.date, "EEE d")}: ${who}${res.names.length > 4 ? "…" : ""}`)
          : tx(`${res.moved} trabajos pasados al ${formatDay(res.date, "EEE d")}`, `${res.moved} jobs moved to ${formatDay(res.date, "EEE d")}`),
      );
      setAskAcc(null);
      await invalidateLawn(qc);
      await qc.invalidateQueries({ queryKey: ["week-off"] });
    },
  });
  const excludeMut = useMutation({
    mutationFn: (days: number[]) => updateSettings({ data: { excludedWeekdays: days } }),
    onSuccess: async () => {
      toast.success(
        tx(
          "Guardado. Ese día sigue libre. Un patio pospuesto a mano, o un trabajo extra o de una vez, sí puede quedar ahí.",
          "Saved. That day stays free. A yard postponed by hand, or an extra or one-time job, can still land there.",
        ),
      );
      await invalidateLawn(qc);
    },
  });
  const offMut = useMutation({
    mutationFn: (payload: { date: string; reason?: string }) => toggleOffDate({ data: payload }),
    onSuccess: async (res) => {
      if (res.on && res.names.length) toast.success(tx(`Día libre. Se movieron: ${res.names.slice(0, 4).join(", ")}`, `Day off. Moved: ${res.names.slice(0, 4).join(", ")}`));
      else if (res.on) toast.success(tx("Día marcado como libre.", "Day marked as off."));
      else toast(tx("Ese día vuelve a estar abierto.", "That day is open again."));
      await invalidateLawn(qc);
      await qc.invalidateQueries({ queryKey: ["week-off"] });
    },
  });

  function askWeekday(day: number, label: string) {
    setAskOff({ kind: "weekday", value: day, label });
  }
  function askDate(date: string, label: string) {
    setOffReason("");
    setAskOff({ kind: "date", value: date, label });
  }
  function scrollCases() {
    markJump();
    window.setTimeout(() => {
      document.getElementById("agenda-casos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
  function filterLabel(value: JobListFilter) {
    if (value === "pending") return tx("Pendiente", "Pending");
    if (value === "late") return tx("Tarde", "Late");
    if (value === "done") return tx("Realizado", "Done");
    if (value === "cancelled") return tx("Cancelado", "Canceled");
    return tx("Pendiente", "Pending");
  }

  return (
    <AppShell
      title={tx("Agenda", "Schedule")}
      titleTight
      action={
        <div className="ml-auto flex min-w-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setCal(true);
              setCalCursor(now);
              setWeekOf(today);
              scrollCases();
            }}
            className={cn(
              "h-10 shrink-0 rounded-full px-2 text-sm font-semibold",
              cal ? "bg-sun text-primary" : "text-muted",
            )}
          >
            {tx("Calendario", "Calendar")}
          </button>
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setCal(false);
                setRange(item.value);
                scrollCases();
              }}
              className={cn(
                "h-10 shrink-0 rounded-full px-2 text-sm font-semibold",
                range === item.value && !cal ? "bg-sun text-primary" : "text-muted",
              )}
            >
              {tx(item.labelEs, item.labelEn)}
            </button>
          ))}
        </div>
      }
    >

      {vacationOn ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border-l-4 border-pending bg-pending-bg p-3">
          <Palmtree className="mt-0.5 size-5 shrink-0 text-pending" />
          <div className="min-w-0">
            <p className="font-semibold text-pending">{tx("Modo vacaciones", "Vacation mode")}</p>
            <p className="text-sm text-muted">
              {tx(
                `Del ${formatDay(settingsQ.data!.vacationStart!, "d MMM")} al ${formatDay(settingsQ.data!.vacationEnd!, "d MMM")}. El trabajo de esas fechas y lo atrasado se movió al regreso. Cámbialo en Ajustes.`,
                `From ${formatDay(settingsQ.data!.vacationStart!, "d MMM")} to ${formatDay(settingsQ.data!.vacationEnd!, "d MMM")}. Work from those dates and anything late was moved to the return. Change it in Settings.`,
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx("Buscar cliente, trabajo o dirección", "Search client, job, or address")}
          className="pl-10"
        />
      </div>
      {holiday ? (
        <button
          type="button"
          onClick={() => {
            setCal(true);
            setCalCursor(monthParts(holiday.iso));
            setWeekOf(holiday.iso);
            setFocusDay(holiday.iso);
          }}
          className="mb-3 h-10 rounded-full bg-due-bg px-3 text-sm font-semibold text-due"
        >
          {holiday.name} · {formatDay(holiday.iso)}
        </button>
      ) : null}

      <div className="mb-3 flex items-center gap-0.5">
      <div id="agenda-controles" className="grid min-w-0 flex-1 grid-cols-5 gap-1">
        {FILTERS.filter((item) => item.value !== "cancelled").map((item) => {
          const on = !onlyMoved && status === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setOnlyMoved(false);
                setFilter(item.value);
                scrollCases();
              }}
              className={cn("h-10 min-w-0 truncate rounded-full px-1 text-[11px] font-semibold sm:text-xs", on ? item.on : "text-muted")}
            >
              {filterLabel(item.value)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setOnlyMoved(true);
            scrollCases();
          }}
          className={cn(
            "h-10 min-w-0 truncate rounded-full px-1 text-[11px] font-semibold sm:text-xs",
            onlyMoved ? "bg-soil-bg text-soil" : "text-muted",
          )}
        >
          {tx("Pospuesto", "Postponed")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOnlyMoved(false);
            setFilter("cancelled");
            scrollCases();
          }}
          className={cn(
            "h-10 min-w-0 truncate rounded-full px-1 text-[11px] font-semibold sm:text-xs",
            !onlyMoved && status === "cancelled" ? FILTERS.find((item) => item.value === "cancelled")?.on : "text-muted",
          )}
        >
          {tx("Cancelado", "Canceled")}
        </button>
      </div>
      <Hint compact topic="agenda" />
      </div>

      <section id="ag-libres" className="mb-3 rounded-xl bg-surface shadow-card">
        <div className="flex min-h-11 items-center gap-0.5 px-1.5">
          <button
            type="button"
            aria-expanded={pinnedOff || offOpen}
            onClick={() => {
              if (pinnedOff) return;
              const next = !offOpen;
              setOffOpen(next);
              try {
                localStorage.setItem("ols-agenda-off", next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", !(pinnedOff || offOpen) && "-rotate-90")} />
            <span className="min-w-0 truncate text-sm font-semibold">{tx("Días libres de esta semana", "Days off this week")}</span>
          </button>
          <button
            type="button"
            aria-pressed={pinnedOff}
            aria-label={pinnedOff ? tx("Dejar de mantener abierto", "Stop keeping this open") : tx("Mantener abierto", "Keep open")}
            onClick={() => {
              const next = !pinnedOff;
              setPinnedOff(next);
              try {
                localStorage.setItem("ols-agenda-off-pin", next ? "1" : "0");
              } catch {
                /* ignore */
              }
              if (next) setOffOpen(true);
            }}
            className={cn("grid size-9 shrink-0 place-items-center rounded-full", pinnedOff ? "bz-pick bz-pick-icon" : "text-muted")}
          >
            <Pin className={cn("size-3.5", pinnedOff && "fill-current")} />
          </button>
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label={tx("Semana anterior", "Previous week")} className="grid size-8 place-items-center text-muted" onClick={() => setWeekCursor(addDaysISO(weekCursor, -7))}>
              <ChevronLeft className="size-3.5" />
            </button>
            <button type="button" aria-label={tx("Esta semana", "This week")} title={tx("Volver a esta semana", "Back to this week")} className="grid size-7 place-items-center" onClick={() => setWeekCursor(today)}>
              <span className={cn("size-2 rounded-full", startOfWeekISO(weekCursor) === startOfWeekISO(today) ? "bg-primary" : "bg-muted")} />
            </button>
            <button type="button" aria-label={tx("Semana siguiente", "Next week")} className="grid size-8 place-items-center text-muted" onClick={() => setWeekCursor(addDaysISO(weekCursor, 7))}>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          <Hint compact topic="dias-libres" />
        </div>
        {pinnedOff || offOpen ? (
          <div className="px-3 pb-3">
            <p className="text-xs text-muted">
              {tx(
                `Semana del ${formatDay(startOfWeekISO(weekCursor), "d MMM")} al ${formatDay(endOfWeekISO(weekCursor), "d MMM")}.`,
                `Week of ${formatDay(startOfWeekISO(weekCursor), "d MMM")} to ${formatDay(endOfWeekISO(weekCursor), "d MMM")}.`,
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }, (_, i) => addDaysISO(startOfWeekISO(weekCursor), i)).map((date) => {
                const on = (offQ.data?.offDates ?? []).includes(date);
                const wd = weekdayOptions().find((item) => item.value === new Date(`${date}T12:00:00Z`).getUTCDay());
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => askDate(date, `${wd?.short ?? ""} ${date.slice(8)}`)}
                    className={cn("h-10 min-w-12 rounded-full px-3 text-sm font-semibold", on ? "bg-late-bg text-late" : "bg-sun text-muted")}
                  >
                    {wd?.short} {date.slice(8)}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1 text-sm font-semibold">
              {tx("Días que casi nunca se trabajan", "Days that are almost never worked")}
              <Hint topic="dia-casi-nunca" />
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {weekdayOptions().map((day) => {
                const on = excluded.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => askWeekday(day.value, day.short)}
                    className={cn("h-10 min-w-12 rounded-full px-3 text-sm font-semibold", on ? "bz-pick" : "bg-sun text-muted")}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {overdueCount > 0 || (filter === "pending" && jobs.some((job) => job.scheduledDate === today)) ? (
        <section className="mb-3 rounded-xl border-l-4 border-soil bg-soil-bg p-3">
          <p className="flex items-center gap-1 font-semibold text-soil">
            {tx("Trabajo acumulado", "Accumulated work")}
            <Hint topic="trabajo-acumulado" />
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={overdueCount === 0} onClick={() => setAskAcc("overdue")}>
              {tx("Pasar atrasados", "Move late ones")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAskAcc("today")}>
              {tx("Pasar pendientes de hoy", "Move today's pending")}
            </Button>
          </div>
        </section>
      ) : null}

      {cal ? null : (
      <div className="mb-3">
        <DensityToggle />
        <p className="mt-2 flex min-w-0 items-center gap-1 text-sm text-muted">
          {tx(
            `${jobs.length} ${jobs.length === 1 ? "trabajo" : "trabajos"} · ${money(total)}${filter === "done" ? " realizados" : ""}`,
            `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} · ${money(total)}${filter === "done" ? " done" : ""}`,
          )}
          {range === "all" && !cal && filter !== "done" ? (
            <Hint compact topic="agenda-todo" />
          ) : null}
        </p>
      </div>
      )}

      <div id="agenda-trabajos">
        {cal ? (
          <MonthBoard
            q={q}
            status={status}
            onlyMoved={onlyMoved}
            cursor={calCursor}
            weekOf={weekOf}
            focusDay={focusDay}
            reports={offQ.data?.postponed ?? []}
            onCursor={setCalCursor}
            onWeek={setWeekOf}
          />
        ) : (
          <div id="agenda-casos">
            {query.isLoading ? (
              <div className="grid gap-3">
                <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
                <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
              </div>
            ) : null}
            {!query.isLoading && sections.filter((section) => (onlyMoved ? section.report.length > 0 : true)).length === 0 ? (
              <div className="rounded-xl bg-sun px-5 py-8 text-center">
                <p className="font-display text-lg font-semibold">
                  {onlyMoved
                    ? range === "week"
                      ? tx("Nada pospuesto esta semana", "Nothing postponed this week")
                      : range === "all"
                        ? tx("Nada pospuesto", "Nothing postponed")
                        : tx("Nada pospuesto este mes", "Nothing postponed this month")
                    : tx("Nada en esta vista", "Nothing in this view")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {onlyMoved
                    ? tx("No hay días ni razones pospuestos.", "There are no postponed days or reasons.")
                    : tx("Cambia el filtro o el período.", "Change the filter or the period.")}
                </p>
              </div>
            ) : null}
            {sections.filter((section) => (onlyMoved ? section.report.length > 0 : section.items.length > 0 || section.report.length > 0)).length > 0 ? (
              <div className="grid gap-6">
                {sections
                  .filter((section) => (onlyMoved ? section.report.length > 0 : section.items.length > 0 || section.report.length > 0))
                  .map((section, index, list) => {
                  const date = section.date;
                  const items = section.items;
                  const week = startOfWeekISO(date);
                  const prevWeek = index > 0 ? startOfWeekISO(list[index - 1]!.date) : "";
                  const weekCount = list.filter((row) => startOfWeekISO(row.date) === week).reduce((sum, row) => sum + row.items.length, 0);
                  const reorder = filter === "pending" && items.length > 1;
                  return (
                    <section key={date}>
                      {week !== prevWeek ? (
                        <div className="mb-2 rounded-md bg-soil-bg px-3 py-2 text-sm text-soil">
                          <p className="font-semibold">{tx(`Semana del ${formatDay(week, "d 'de' MMMM")}`, `Week of ${formatDay(week, "MMMM d")}`)}</p>
                          <p>
                            {tx(
                              `${weekCount} ${weekCount === 1 ? "patio" : "patios"} en esta semana. La siguiente empieza el ${formatDay(addDaysISO(week, 7), "d MMM")}.`,
                              `${weekCount} ${weekCount === 1 ? "yard" : "yards"} this week. The next one starts on ${formatDay(addDaysISO(week, 7), "d MMM")}.`,
                            )}
                          </p>
                        </div>
                      ) : null}
                      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                        <h2 className="min-w-0 font-display text-base font-semibold first-letter:uppercase">
                          {formatDay(date, tx("EEEE d 'de' MMMM", "EEEE, MMMM d"))}
                          {items.length > 0 && !onlyMoved ? (
                            <span className="ml-2 text-sm font-medium text-muted">
                              {tx(`${items.length} ${items.length === 1 ? "patio" : "patios"}`, `${items.length} ${items.length === 1 ? "yard" : "yards"}`)}
                            </span>
                          ) : null}
                        </h2>
                        {filter === "pending" && items.length > 0 && !onlyMoved ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMoveFrom(date);
                              setMoveTo(addDaysISO(date, 1));
                            }}
                            className="shrink-0 text-sm font-semibold text-primary"
                          >
                            {tx("Mover", "Move")}
                          </button>
                        ) : null}
                      </div>
                      {onlyMoved || items.length === 0 ? null : reorder ? (
                        <ReorderableJobs jobs={items} enabled />
                      ) : (
                        <div className={viewGrid(density, cols, gap)}>
                          {items.map((job) => (
                            <JobCard key={job.id} job={job} compact={job.status !== "pending"} />
                          ))}
                        </div>
                      )}
                      {section.report.length > 0 ? <DayReport rows={section.report} /> : null}
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ScrollTop lift={undoPast + undoFuture > 0} />
      {undoPast + undoFuture > 0 ? (
        <div className="fixed right-2 bottom-24 z-30 flex items-center rounded-full bg-surface/90 px-0.5 shadow-card ring-1 ring-border">
          <UndoBar compact />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(moveFrom)}
        title={tx("¿Pasar los patios de este día?", "Move this day's yards?")}
        description={
          <div className="grid gap-2">
            <p>
              {tx(
                `Todos los pendientes del ${moveFrom ? formatDay(moveFrom, "EEEE d") : ""} pasan a la fecha que elijas. Si eliges domingo, se quedan ese día.`,
                `All pending yards for ${moveFrom ? formatDay(moveFrom, "EEEE d") : ""} move to the date you choose. If you choose Sunday, they stay that day.`,
              )}
            </p>
            <Input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
          </div>
        }
        confirmLabel={tx("Sí, mover", "Yes, move")}
        pending={moveMut.isPending}
        onConfirm={() => {
          if (!moveFrom) return;
          const kind = rare.kindOf(moveTo);
          if (kind) {
            setRareMove({ iso: moveTo, kind, run: (iso) => moveMut.mutate(iso) });
            return;
          }
          moveMut.mutate(moveTo);
        }}
        onCancel={() => setMoveFrom(null)}
      />
      <ConfirmDialog
        open={Boolean(askAcc)}
        title={askAcc === "today" ? tx("¿Pasar los pendientes de hoy?", "Move today's pending yards?") : tx("¿Pasar el trabajo atrasado?", "Move the late work?")}
        hint={
          <Hint compact topic={askAcc === "today" ? "pasar-pendientes" : "pasar-atrasado"} />
        }
        description={
          <div className="grid gap-2">
            <p>{tx("Elige el día. La fecha se respeta, aunque sea domingo. La razón es opcional.", "Choose the day. The date is kept, even if it is Sunday. The reason is optional.")}</p>
            <Input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} />
            <ReasonChips value={accReason} onChange={setAccReason} />
          </div>
        }
        confirmLabel={tx("Sí, pasar", "Yes, move")}
        pending={accMut.isPending}
        onConfirm={() => {
          if (!askAcc) return;
          const kind = rare.kindOf(accDate);
          const scope = askAcc;
          if (kind) {
            setRareMove({
              iso: accDate,
              kind,
              run: (iso) => accMut.mutate({ scope, date: iso }),
            });
            return;
          }
          accMut.mutate({ scope, date: accDate });
        }}
        onCancel={() => setAskAcc(null)}
      />
      <ConfirmDialog
        open={Boolean(askOff)}
        title={tx("¿Cambiar este día?", "Change this day?")}
        description={
          askOff?.kind === "date" ? (
            <div className="grid gap-2">
              <p>
                {(offQ.data?.offDates ?? []).includes(String(askOff.value))
                  ? tx(`¿Abrir ${askOff.label}? Los patios vuelven a poder caer ese día.`, `Open ${askOff.label}? Yards can land on that day again.`)
                  : tx(
                      `¿Por qué no se trabaja ${askOff.label}? Los patios de esa fecha pasan al siguiente día abierto. La razón queda en ese día.`,
                      `Why is ${askOff.label} not worked? Yards on that date move to the next open day. The reason stays on that day.`,
                    )}
              </p>
              {(offQ.data?.offDates ?? []).includes(String(askOff.value)) ? null : <ReasonChips value={offReason} onChange={setOffReason} />}
            </div>
          ) : (
            tx(
              `¿Guardar ${askOff?.label ?? ""} como día que casi nunca se trabaja? Los cortes regulares no caerán ahí. Un patio pospuesto a mano, o un trabajo extra o de una vez, sí puede.`,
              `Save ${askOff?.label ?? ""} as a day that is almost never worked? Regular cuts will not land there. A yard postponed by hand, or an extra or one-time job, still can.`,
            )
          )
        }
        confirmLabel={tx("Sí, cambiar", "Yes, change")}
        pending={excludeMut.isPending || offMut.isPending}
        onConfirm={() => {
          if (!askOff) return;
          if (askOff.kind === "weekday") {
            const day = Number(askOff.value);
            const next = excluded.includes(day) ? excluded.filter((item) => item !== day) : [...excluded, day];
            excludeMut.mutate(next);
          } else {
            offMut.mutate({ date: String(askOff.value), reason: offReason });
          }
          setAskOff(null);
        }}
        onCancel={() => setAskOff(null)}
      />
      <OffDayDialog
        iso={rareMove?.iso ?? null}
        kind={rareMove?.kind ?? null}
        pending={moveMut.isPending || accMut.isPending}
        onKeep={() => {
          const job = rareMove;
          setRareMove(null);
          if (job) job.run(job.iso);
        }}
        onMonday={() => {
          const job = rareMove;
          setRareMove(null);
          if (job) job.run(shiftToMonday(job.iso));
        }}
        onClose={() => setRareMove(null)}
      />
    </AppShell>
  );
}

function PostponedDays({ rows }: { rows: { date: string; reason: string; name: string }[] }) {
  const tx = useTx();
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  if (dates.length === 0) {
    return (
      <p className="rounded-xl bg-sun px-4 py-6 text-center text-sm text-muted">
        {tx("No hay días ni razones pospuestos.", "There are no postponed days or reasons.")}
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      {dates.map((date) => (
        <section key={date}>
          <h2 className="font-display text-base font-semibold first-letter:uppercase">
            {formatDay(date, tx("EEEE d 'de' MMMM", "EEEE, MMMM d"))}
          </h2>
          <DayReport rows={rows.filter((row) => row.date === date)} />
        </section>
      ))}
    </div>
  );
}

function DayReport({ rows }: { rows: { reason: string; name: string }[] }) {
  const tx = useTx();
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const names = groups.get(row.reason) ?? [];
    if (row.name && !names.includes(row.name)) names.push(row.name);
    groups.set(row.reason, names);
  }
  if (groups.size === 0) return null;
  return (
    <div className="mt-2 min-w-0 rounded-md bg-surface-2 px-3 py-2.5 text-fg ring-1 ring-border">
      <div className="flex min-w-0 items-start gap-1">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{tx("¿Por qué no se trabajó este día?", "Why was this day not worked?")}</p>
        <Hint compact topic="agenda-dia" />
      </div>
      <div className="mt-1 grid gap-1">
        {[...groups].map(([reason, names]) => (
          <p key={reason} className="text-sm leading-snug">
            <span className="font-semibold">{reason}</span>
            {names.length > 0 ? <span>{` · ${names.join(", ")}`}</span> : null}
          </p>
        ))}
      </div>
    </div>
  );
}

function groupByDate(jobs: JobRow[]): [string, JobRow[]][] {
  const map = new Map<string, JobRow[]>();
  for (const job of jobs) {
    const list = map.get(job.scheduledDate) ?? [];
    list.push(job);
    map.set(job.scheduledDate, list);
  }
  return [...map.entries()];
}

const CAL_HEAD: [string, string][] = [
  ["Lu", "Mon"],
  ["Ma", "Tue"],
  ["Mi", "Wed"],
  ["Ju", "Thu"],
  ["Vi", "Fri"],
  ["Sá", "Sat"],
  ["Do", "Sun"],
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function matchesStatus(job: JobRow, status: Exclude<JobListFilter, "all">) {
  if (status === "pending") return job.status === "pending" && job.computedStatus !== "late";
  if (status === "late") return job.computedStatus === "late";
  if (status === "done") return job.status === "done";
  return job.status === "cancelled";
}

function MonthBoard({
  q,
  status,
  onlyMoved,
  cursor,
  weekOf,
  focusDay,
  reports,
  onCursor,
  onWeek,
  onDive,
}: {
  q: string;
  status: Exclude<JobListFilter, "all">;
  onlyMoved: boolean;
  cursor: { year: number; month: number };
  weekOf: string;
  focusDay?: string | null;
  reports: { date: string; reason: string; name: string }[];
  onCursor: (next: { year: number; month: number }) => void;
  onWeek: (iso: string) => void;
  onDive?: () => void;
}) {
  const tx = useTx();
  const density = useDensity();
  const cols = useQuadCols();
  const today = todayISO();
  const now = monthParts(today);
  const [picked, setPicked] = useState<string | null>(null);
  const lastTap = useRef<{ iso: string; at: number } | null>(null);
  useEffect(() => {
    if (focusDay) setPicked(focusDay);
  }, [focusDay]);
  const weekStart = startOfWeekISO(weekOf);
  const weekEnd = endOfWeekISO(weekOf);
  const endParts = monthParts(weekEnd);
  const crosses = endParts.year !== cursor.year || endParts.month !== cursor.month;
  const query = useQuery({
    queryKey: ["jobs", "calendar", cursor.year, cursor.month, q, onlyMoved],
    queryFn: () => listJobs({ data: { filter: "all", range: "history", q, year: cursor.year, month: cursor.month } }),
  });
  const edge = useQuery({
    queryKey: ["jobs", "calendar", endParts.year, endParts.month, q, onlyMoved, "edge"],
    enabled: crosses,
    queryFn: () => listJobs({ data: { filter: "all", range: "history", q, year: endParts.year, month: endParts.month } }),
  });
  const visible = useMemo(() => {
    const rows = [...(query.data ?? []), ...(crosses ? (edge.data ?? []) : [])];
    const seen = new Set<number>();
    return rows.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      if (onlyMoved) return postponedJob(job) && job.status !== "done" && job.status !== "cancelled";
      return matchesStatus(job, status);
    });
  }, [query.data, edge.data, crosses, onlyMoved, status]);
  const monthKey = `${cursor.year}-${pad2(cursor.month)}`;
  const monthVisible = visible.filter((job) => job.scheduledDate.startsWith(monthKey));
  const byDay = useMemo(() => {
    const map = new Map<string, JobRow[]>();
    for (const job of monthVisible) {
      const list = map.get(job.scheduledDate) ?? [];
      list.push(job);
      map.set(job.scheduledDate, list);
    }
    return map;
  }, [monthVisible]);
  const first = `${cursor.year}-${pad2(cursor.month)}-01`;
  const lead = (weekdayFromISO(first) + 6) % 7;
  const last = Number(lastDayOfMonthISO(cursor.year, cursor.month).slice(8));
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: last }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const selected = picked && picked.startsWith(`${cursor.year}-${pad2(cursor.month)}`) ? picked : null;
  const shown = selected ? (byDay.get(selected) ?? []) : visible.filter((job) => job.scheduledDate >= weekStart && job.scheduledDate <= weekEnd);
  const minY = Math.min(now.year - 1, cursor.year);
  const maxY = Math.max(now.year + 8, cursor.year);
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);
  const gap = density === "dense" ? "gap-1.5" : density === "compact" ? "gap-2" : "gap-3";

  function goMonth(delta: number) {
    const next = addMonths(cursor.year, cursor.month, delta);
    onCursor(next);
    onWeek(`${next.year}-${pad2(next.month)}-01`);
    setPicked(null);
  }
  function goYear(year: number) {
    onCursor({ year, month: cursor.month });
    onWeek(`${year}-${pad2(cursor.month)}-01`);
    setPicked(null);
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="flex h-11 min-w-0 items-center justify-between rounded-full bg-surface px-0.5 shadow-card">
          <button type="button" aria-label={tx("Año anterior", "Previous year")} className="grid size-9 shrink-0 place-items-center" onClick={() => goYear(cursor.year - 1)}>
            <ChevronLeft className="size-4" />
          </button>
          <label className="min-w-0">
            <span className="sr-only">{tx("Año", "Year")}</span>
            <NativeSelect
              value={cursor.year}
              onChange={(e) => goYear(Number(e.target.value))}
              aria-label={tx("Año", "Year")}
              className="h-9 w-auto bg-transparent px-1 shadow-none"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
          <button type="button" aria-label={tx("Año siguiente", "Next year")} className="grid size-9 shrink-0 place-items-center" onClick={() => goYear(cursor.year + 1)}>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex h-11 min-w-0 items-center justify-between rounded-full bg-surface px-0.5 shadow-card">
          <button type="button" aria-label={tx("Mes anterior", "Previous month")} className="grid size-9 shrink-0 place-items-center" onClick={() => goMonth(-1)}>
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold">{monthNames()[cursor.month - 1]}</p>
          <button type="button" aria-label={tx("Mes siguiente", "Next month")} className="grid size-9 shrink-0 place-items-center" onClick={() => goMonth(1)}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mb-3 flex h-11 items-center justify-between rounded-full bg-surface px-0.5 shadow-card">
        <button
          type="button"
          aria-label={tx("Semana anterior", "Previous week")}
          className="grid size-9 shrink-0 place-items-center"
          onClick={() => {
            const next = addDaysISO(weekOf, -7);
            onWeek(next);
            onCursor(monthParts(next));
          }}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className="h-9 min-w-0 truncate px-2 text-sm font-semibold text-primary"
          onClick={() => {
            onWeek(today);
            onCursor(now);
            setPicked(null);
          }}
        >
          {tx(`Semana del ${formatDay(weekStart, "d MMM")}`, `Week of ${formatDay(weekStart, "d MMM")}`)}
        </button>
        <button
          type="button"
          aria-label={tx("Semana siguiente", "Next week")}
          className="grid size-9 shrink-0 place-items-center"
          onClick={() => {
            const next = addDaysISO(weekOf, 7);
            onWeek(next);
            onCursor(monthParts(next));
          }}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-muted">
        {CAL_HEAD.map(([es, en]) => (
          <span key={es}>{tx(es, en)}</span>
        ))}
      </div>
      {query.isLoading ? (
        <div className="h-52 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const iso = `${cursor.year}-${pad2(cursor.month)}-${pad2(day)}`;
            const count = byDay.get(iso)?.length ?? 0;
            const lateLook = (status === "pending" || status === "late") && iso < today && count > 0;
            const isToday = iso === today;
            const on = selected === iso;
            const inWeek = iso >= weekStart && iso <= weekEnd;
            const holiday = holidayName(iso);
            return (
              <button
                key={iso}
                type="button"
                title={holiday ?? undefined}
                onClick={() => {
                  setPicked(iso);
                  const nowTap = Date.now();
                  const again = lastTap.current?.iso === iso && nowTap - lastTap.current.at < 450;
                  lastTap.current = { iso, at: nowTap };
                  if (!again) return;
                  const hasReport = reports.some((row) => row.date === iso);
                  if (count > 0 || (onlyMoved && hasReport)) {
                    onDive?.();
                    markJump();
                    window.setTimeout(() => {
                      document.getElementById("agenda-casos")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 40);
                  }
                }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-md px-0.5",
                  on ? "bg-surface-2 text-fg ring-2 ring-primary" : holiday ? "bg-due-bg text-fg" : isToday ? "bg-sun text-fg" : "bg-surface text-fg",
                  inWeek && !on && "ring-2 ring-soil",
                  count === 0 && !on && !isToday && !holiday && "text-muted",
                )}
              >
                <span className="text-xs font-semibold leading-none">{day}</span>
                <span className={cn("mt-1 text-xs leading-none font-bold", count === 0 && "invisible", count > 0 && (lateLook ? "text-late" : status === "cancelled" ? "text-muted" : "text-done"))}>{count || "0"}</span>
              </button>
            );
          })}
        </div>
      )}
      <h2 className="mt-4 mb-2 font-display text-base font-semibold first-letter:uppercase">
        {selected ? formatDay(selected, tx("EEEE d 'de' MMMM", "EEEE, MMMM d")) : tx(`Semana del ${formatDay(weekStart, "d MMM")}`, `Week of ${formatDay(weekStart, "d MMM")}`)}
        {selected && holidayName(selected) ? <span className="ml-2 text-sm font-medium text-due">{holidayName(selected)}</span> : null}
        <span className="ml-2 text-sm font-medium text-muted">
          {tx(`${shown.length} ${shown.length === 1 ? "patio" : "patios"}`, `${shown.length} ${shown.length === 1 ? "yard" : "yards"}`)}
        </span>
      </h2>
      <DensityToggle />
      <section id="agenda-casos" className="mt-3">
        {onlyMoved ? (
          <PostponedDays
            rows={reports.filter((row) => (selected ? row.date === selected : row.date >= weekStart && row.date <= weekEnd))}
          />
        ) : (
          <>
            {status === "pending" ? <DueNotes from={selected ?? weekStart} to={selected ?? weekEnd} /> : null}
            {shown.length === 0 ? (
              <p className="rounded-xl bg-sun px-4 py-6 text-center text-sm text-muted">
                {status === "done"
                  ? selected
                    ? tx("Nada realizado este día.", "Nothing done this day.")
                    : tx("Nada realizado en esta semana.", "Nothing done this week.")
                  : status === "late"
                    ? selected
                      ? tx("Nada tarde este día.", "Nothing late this day.")
                      : tx("Nada tarde en esta semana.", "Nothing late this week.")
                    : status === "cancelled"
                      ? selected
                        ? tx("Nada cancelado este día.", "Nothing canceled this day.")
                        : tx("Nada cancelado en esta semana.", "Nothing canceled this week.")
                      : selected
                        ? tx("Nada pendiente este día.", "Nothing pending this day.")
                        : tx("Nada pendiente en esta semana.", "Nothing pending this week.")}
              </p>
            ) : (
              <div className={viewGrid(density, cols, gap)}>
                {shown.map((job) => (
                  <JobCard key={job.id} job={job} compact={job.status !== "pending"} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function DueNotes({ from, to }: { from: string; to: string }) {
  const notes =
    useQuery({
      queryKey: ["due-notes", from, to],
      queryFn: () => listDueNotes({ data: { from, to } }),
    }).data ?? [];
  if (!notes.length) return null;
  return (
    <ul className="mb-3 grid gap-1">
      {notes.map((note) => (
        <li key={note.id}>
          <Link to="/notas" search={{ page: note.id, back: "agenda" }} className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-due-bg px-3 text-sm">
            <span className="min-w-0 truncate font-semibold">
              {note.pinned ? "• " : ""}
              {note.title}
            </span>
            <span className="shrink-0 text-muted">{note.time ?? formatDay(note.date, "d MMM")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
