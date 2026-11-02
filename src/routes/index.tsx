import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CloudRain, AlertTriangle, CheckCheck, CircleDollarSign, Palmtree, Pin, Plus, Scissors, Sprout, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { markJump } from "@/lib/jump-back";
import { toast } from "sonner";
import { htmlToNote } from "@/components/rich-notes";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { Hint } from "@/components/hint";
import { ScrollTop } from "@/components/scroll-top";
import { JobCard, invalidateLawn } from "@/components/job-card";
import { ReorderableJobs } from "@/components/reorder-jobs";
import { WeatherChip } from "@/components/weather-chip";
import { DayNightSwitch } from "@/components/day-night-switch";
import { Button } from "@/components/ui/button";
import { ReasonChips } from "@/components/reason-chips";
import { SettleDay } from "@/components/settle-day";
import { WorkDayCard } from "@/components/work-day";
import { MessageComposer } from "@/components/message-composer";
import { addDaysISO, todayISO } from "@/lib/dates";
import { viewGrid } from "@/lib/density";
import { formatLongDay, money, weekdayOptions } from "@/lib/format";
import { useI18n, reasonLabel, useTx } from "@/lib/i18n";
import { isHechoConfirmSkipped, setHechoConfirmSkipped, subscribeHechoConfirm } from "@/lib/hecho-confirm";
import { fireJobReminders } from "@/lib/reminders";
import { getDashboard, getSettings, listPinnedNotes, postponeAccumulated, savePad, shiftForRain } from "@/lib/server/lawn";
import type { JobRow } from "@/lib/types";
import { STOP_REASONS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: function HomeRoute() {
    return (
      <DensityScope scope="hoy">
        <Home />
      </DensityScope>
    );
  },
});

function Home() {
  const today = todayISO();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    staleTime: 8_000,
  });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const pins = useQuery({
    queryKey: ["pad-pins"],
    queryFn: () => listPinnedNotes(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const [unpinNote, setUnpinNote] = useState<{ id: number; title: string } | null>(null);
  const data = q.data;
  const [skip, setSkip] = useState(false);
  const [askAll, setAskAll] = useState(false);
  const [accDate, setAccDate] = useState(addDaysISO(today, 1));
  const [accReason, setAccReason] = useState("");
  const [askAcc, setAskAcc] = useState<"overdue" | "today" | null>(null);
  const [jumpToday, setJumpToday] = useState(0);
  const [jumpLate, setJumpLate] = useState(0);
  const [jumpDone, setJumpDone] = useState(0);
  const [askRain, setAskRain] = useState(false);
  const [stopReason, setStopReason] = useState("Lluvia");
  const { t, locale } = useI18n();
  const tx = useTx();
  const [rainReady, setRainReady] = useState<{
    date: string;
    text: string;
    people: { id: number; name: string; phone: string | null }[];
  } | null>(null);

  useEffect(() => {
    const read = () => setSkip(isHechoConfirmSkipped(today));
    read();
    return subscribeHechoConfirm(read);
  }, [today]);

  useEffect(() => {
    if (!data || !settings.data?.remindersEnabled) return;
    fireJobReminders([...data.overdue, ...data.today], {
      enabled: true,
      minutesBefore: settings.data.reminderMinutes,
      businessName: settings.data.businessName,
    });
  }, [data, settings.data]);

  const accMut = useMutation({
    mutationFn: (scope: "overdue" | "today") =>
      postponeAccumulated({ data: { date: accDate, scope, reason: accReason } }),
    onSuccess: async (res) => {
      const who = res.names.slice(0, 4).join(", ");
      toast.success(
        res.names.length
          ? tx(
              `${res.moved} pasados al ${formatLongDay(res.date)}: ${who}${res.names.length > 4 ? "…" : ""}`,
              `${res.moved} moved to ${formatLongDay(res.date)}: ${who}${res.names.length > 4 ? "…" : ""}`,
            )
          : tx(
              `${res.moved} trabajos pasados al ${formatLongDay(res.date)}`,
              `${res.moved} jobs moved to ${formatLongDay(res.date)}`,
            ),
      );
      setAskAcc(null);
      await invalidateLawn(qc);
    },
  });

  const rainMut = useMutation({
    mutationFn: () => shiftForRain({ data: { reason: stopReason || "Lluvia" } }),
    onSuccess: async (res) => {
      setAskRain(false);
      const when = formatLongDay(res.date);
      const shown = reasonLabel(locale, res.reason);
      const come = t("stop.come").replace("{date}", when);
      const text =
        res.reason === "Lluvia"
          ? `${t("stop.msgRain")} ${come}`
          : `${t("stop.msgOther")} ${shown}. ${come}`;
      setRainReady({ date: res.date, text, people: res.people });
      toast.success(
        res.moved
          ? t("stop.moved").replace("{n}", String(res.moved)).replace("{date}", when)
          : t("stop.none"),
      );
      await invalidateLawn(qc);
    },
    onError: () => toast.error(t("stop.fail")),
  });

  const pendingToday = data?.today.length ?? 0;

  return (
    <AppShell
      title={t("nav.today")}
      action={
        <span className="inline-flex items-center gap-3">
          <WeatherChip />
          <span className="mr-2 grid w-10 shrink-0 place-items-center">
            <DayNightSwitch />
          </span>
          <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
            <Link to="/nuevo">
              <Plus />
              {tx("Cliente", "Client")}
            </Link>
          </Button>
        </span>
      }
    >
      <ScrollTop aboveFab />
      <p className="mb-3 text-muted first-letter:uppercase">{formatLongDay(today)}</p>
      {pins.data && pins.data.length > 0 ? (
        <section className="mb-4 rounded-xl border-l-4 border-primary bg-surface px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{tx("Notas fijadas", "Pinned notes")}</p>
          <ul>
            {pins.data.map((note) => {
              const line = htmlToNote(note.body).split("\n").find((row) => row.trim()) ?? "";
              return (
                <li key={note.id} className="flex min-h-11 items-center gap-1">
                  <button
                    type="button"
                    aria-label={tx("Quitar nota fijada", "Unpin note")}
                    onClick={() => setUnpinNote({ id: note.id, title: note.title || tx("Nota", "Note") })}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-primary"
                  >
                    <Pin className="size-4 fill-current" />
                  </button>
                  <Link to="/notas" search={{ page: note.id, back: "hoy" }} className="min-w-0 flex-1 py-2">
                    <span className="block truncate text-sm font-semibold">{note.title || tx("Nota", "Note")}</span>
                    {line ? <span className="block truncate text-xs text-muted">{line}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {settings.data?.vacationStart ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border-l-4 border-pending bg-pending-bg p-3">
          <Palmtree className="mt-0.5 size-5 shrink-0 text-pending" />
          <div className="min-w-0">
            <p className="font-semibold text-pending">{tx("Modo vacaciones", "Vacation mode")}</p>
            <p className="text-sm text-muted">
              {tx(
                `Del ${formatLongDay(settings.data.vacationStart)} al ${formatLongDay(settings.data.vacationEnd ?? settings.data.vacationStart)}. El trabajo se movió al regreso. Cámbialo en Ajustes.`,
                `From ${formatLongDay(settings.data.vacationStart)} to ${formatLongDay(settings.data.vacationEnd ?? settings.data.vacationStart)}. The work moved to the return date. Change it in Settings.`,
              )}
            </p>
          </div>
        </div>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatLink
          onPress={() => { markJump(); setJumpToday((n) => n + 1); }}
          label={tx("Cortes hoy", "Cuts today")}
          value={String(data?.stats.pendingToday ?? "—")}
          hint={tx("Toca para ver los patios de hoy", "Tap to see today's yards")}
          tone="due"
          icon={<Scissors className="size-4" />}
        />
        <StatLink
          onPress={() => {
            if ((data?.stats.overdueCount ?? 0) === 0) {
              toast(tx("No hay patios atrasados.", "There are no late yards."));
              return;
            }
            markJump();
            setJumpLate((n) => n + 1);
          }}
          label={tx("Atrasados", "Late")}
          value={String(data?.stats.overdueCount ?? "—")}
          hint={tx("Se quedan fijos arriba en Hoy", "They stay pinned at the top of Today")}
          tone="late"
          warn={(data?.stats.overdueCount ?? 0) > 0}
          icon={<AlertTriangle className="size-4" />}
        />
        <StatLink
          to="/cobros"
          search={{ view: "owing" }}
          hash="lista"
          label={tx("Por cobrar", "To collect")}
          value={data ? money(data.stats.outstanding) : "—"}
          hint={tx("Toca para ver esos clientes", "Tap to see those clients")}
          tone="cut"
          icon={<Wallet className="size-4" />}
        />
        <StatLink
          onPress={() => { markJump(); setJumpDone((n) => n + 1); }}
          label={tx("Hechos hoy", "Done today")}
          value={String(data?.stats.doneToday ?? "—")}
          hint={tx("Abre la lista de lo ya hecho hoy", "Opens the list of what is already done today")}
          tone="done"
          icon={<CircleDollarSign className="size-4" />}
        />
      </section>

      {q.isLoading && <ListSkeleton />}
      {q.isError && (
        <p className="rounded-lg bg-late-bg px-4 py-3 text-sm text-late">
          {tx("No se pudo cargar la agenda. Prueba a recargar.", "Could not load the schedule. Try reloading.")}
        </p>
      )}

      {data && data.stats.activeClients === 0 && <EmptyState />}

      {data && (data.overdue.length > 0 || pendingToday > 0) ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.overdue.length === 0}
            onClick={() => setAskAcc("overdue")}
          >
            {tx("Pasar atrasados", "Move late ones")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pendingToday === 0}
            onClick={() => setAskAcc("today")}
          >
            {tx("Pasar pendientes de hoy", "Move today's pending")}
          </Button>
        </div>
      ) : null}
      <WorkDayCard />
      <Button variant="outline" className="mb-4 w-full" onClick={() => setAskRain(true)}>
        <CloudRain />
        {t("stop.button")}
      </Button>
      {rainReady && rainReady.people.length > 0 ? (
        <section className="mb-4 rounded-xl border-l-4 border-hold bg-hold-bg p-3">
          <p className="font-semibold text-hold">{tx("Mensajes listos por la lluvia", "Messages ready for the rain")}</p>
          <p className="mt-1 text-sm text-muted">
            {tx(
              `Los patios de hoy pasaron al ${formatLongDay(rainReady.date)}. El clima sigue siendo el de Miami hasta que lo pidas. Tú envías cada mensaje.`,
              `Today's yards moved to ${formatLongDay(rainReady.date)}. The weather stays Miami's until you ask for it. You send each message.`,
            )}
          </p>
          <textarea
            value={rainReady.text}
            onChange={(e) => setRainReady({ ...rainReady, text: e.target.value })}
            rows={3}
            className="mt-2 w-full rounded-md bg-surface px-3 py-2 text-sm"
          />
          <ul className="mt-2 grid gap-2">
            {rainReady.people.map((person) =>
              person.phone ? (
                <li key={person.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">{person.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <MessageComposer phone={person.phone} name={person.name} compact initialText={rainReady.text} />
                    <MessageComposer
                      phone={person.phone}
                      name={person.name}
                      compact
                      channel="whatsapp"
                      initialText={rainReady.text}
                    />
                  </span>
                </li>
              ) : (
                <li key={person.id} className="text-sm text-muted">
                  {tx(`${person.name} no tiene teléfono.`, `${person.name} has no phone.`)}
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {data ? (
        <DayBoard
          overdue={data.overdue}
          todayJobs={data.today}
          todayDone={data.todayDone}
          upcoming={data.upcoming}
          today={today}
          focusToday={jumpToday}
          focusLate={jumpLate}
          focusDone={jumpDone}
          skip={skip}
          onSkip={(checked) => setHechoConfirmSkipped(checked, today)}
          onAskAll={() => setAskAll(true)}
        />
      ) : null}

      <Link
        to="/nuevo"
        className="alive-fab fixed right-4 bottom-[calc(5.25rem+var(--bz-chin))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-card md:hidden"
        aria-label={tx("Añadir cliente", "Add client")}
      >
        <Plus className="size-6" />
      </Link>

      <SettleDay jobs={data?.today ?? []} open={askAll} onClose={() => setAskAll(false)} />
      <ConfirmDialog
        front
        open={unpinNote != null}
        title={tx("¿Quitar esta nota de Hoy?", "Unpin this note from Today?")}
        description={tx(
          `${unpinNote?.title ?? "La nota"} deja de estar fijada. Sigue en el bloc.`,
          `${unpinNote?.title ?? "The note"} is no longer pinned. It stays in the notepad.`,
        )}
        confirmLabel={tx("Sí, quitar", "Yes, unpin")}
        onConfirm={() => {
          const id = unpinNote?.id;
          setUnpinNote(null);
          if (!id) return;
          void savePad({ data: { pageId: id, pinned: false } }).then(async () => {
            await qc.invalidateQueries({ queryKey: ["pad-pins"] });
            await qc.invalidateQueries({ queryKey: ["pad"] });
            toast(tx("Ya no está fijada", "Unpinned"));
          });
        }}
        onCancel={() => setUnpinNote(null)}
      />
      <ConfirmDialog
        open={Boolean(askAcc)}
        title={
          askAcc === "today"
            ? tx("¿Pasar los pendientes de hoy?", "Move today's pending jobs?")
            : tx("¿Pasar el trabajo atrasado?", "Move the late work?")
        }
        hint={
          <Hint compact topic={askAcc === "today" ? "pasar-pendientes" : "pasar-atrasado"} />
        }
        description={
          <div className="grid gap-2">
            <p>{tx("Elige el día. La razón es opcional.", "Pick the day. The reason is optional.")}</p>
            <Input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} />
            <ReasonChips value={accReason} onChange={setAccReason} />
          </div>
        }
        confirmLabel={tx("Sí, pasar", "Yes, move")}
        pending={accMut.isPending}
        onConfirm={() => askAcc && accMut.mutate(askAcc)}
        onCancel={() => setAskAcc(null)}
      />
      <ConfirmDialog
        open={askRain}
        title={t("stop.title")}
        description={
          <div className="grid gap-2">
            <p>{t("stop.help")}</p>
            <ReasonChips value={stopReason} onChange={setStopReason} reasons={STOP_REASONS} />
          </div>
        }
        confirmLabel={stopReason === "Lluvia" ? t("stop.rain") : t("stop.other")}
        pending={rainMut.isPending}
        onConfirm={() => rainMut.mutate()}
        onCancel={() => setAskRain(false)}
      />
    </AppShell>
  );
}

function DayBoard({
  overdue,
  todayJobs,
  todayDone,
  upcoming,
  today,
  focusToday,
  focusLate,
  focusDone,
  skip,
  onSkip,
  onAskAll,
}: {
  overdue: JobRow[];
  todayJobs: JobRow[];
  todayDone: JobRow[];
  upcoming: JobRow[];
  today: string;
  focusToday: number;
  focusLate: number;
  focusDone: number;
  skip: boolean;
  onSkip: (checked: boolean) => void;
  onAskAll: () => void;
}) {
  const tx = useTx();
  const density = useDensity();
  const cols = useQuadCols();
  const tiles = viewGrid(density, cols, "gap-2");
  const tight = viewGrid(density, cols, "gap-1.5");
  const pinned = [...overdue, ...todayJobs, ...upcoming].filter((j) => j.pinned && j.status === "pending");
  const pinnedIds = new Set(pinned.map((j) => j.id));
  const late = overdue.filter((j) => !pinnedIds.has(j.id));
  const todayPending = todayJobs.filter((j) => !pinnedIds.has(j.id));
  const horizon = addDaysISO(today, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i));
  const byDate = new Map<string, JobRow[]>(days.map((date) => [date, []]));
  byDate.set(today, todayPending);
  for (const job of upcoming) {
    if (pinnedIds.has(job.id)) continue;
    if (job.scheduledDate <= today || job.scheduledDate > horizon) continue;
    const list = byDate.get(job.scheduledDate) ?? [];
    list.push(job);
    byDate.set(job.scheduledDate, list);
  }
  const ordered = days.map((date) => [date, byDate.get(date) ?? []] as const);
  const keys = ["late", ...ordered.map(([date]) => date)];
  const [open, setOpen] = useState<string[]>([today]);

  useEffect(() => {
    if (!focusToday) return;
    setOpen([today]);
    const t = window.setTimeout(() => {
      document.getElementById("dia-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
    return () => window.clearTimeout(t);
  }, [focusToday, today]);

  useEffect(() => {
    if (!focusLate) return;
    const t = window.setTimeout(() => {
      document.getElementById("en-la-mira")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
    return () => window.clearTimeout(t);
  }, [focusLate]);

  useEffect(() => {
    if (!focusDone) return;
    const el = document.getElementById("hechos-hoy") as HTMLDetailsElement | null;
    if (el) el.open = true;
    const t = window.setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
    return () => window.clearTimeout(t);
  }, [focusDone]);


  function toggle(key: string) {
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className="mb-6 grid gap-2">
      <div className="mb-1 grid gap-2">
        <DensityToggle />
      </div>

      {pinned.length > 0 ? (
        <section id="en-la-mira" className="rounded-xl bg-soil-bg p-2">
          <p className="mb-1 px-1 text-xs font-semibold tracking-wide text-soil uppercase">
            {tx(`Fijados · ${pinned.length}`, `Pinned · ${pinned.length}`)}
          </p>
          <p className="mb-2 px-1 text-xs text-muted">
            {tx(
              "Atrasados y alto riesgo se quedan aquí solos, hasta que los resuelvas.",
              "Late and high risk stay here on their own until you resolve them.",
            )}
          </p>
          <div className={tight}>
            {pinned.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      ) : null}

      {late.length > 0 ? (
        <DayFold
          title={tx("Atrasados", "Late")}
          count={late.length}
          open={open.includes("late")}
          tone="late"
          onToggle={() => toggle("late")}
        >
          <div className={tiles}>
            {late.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </DayFold>
      ) : null}

      {ordered.map(([date, items]) => {
        const isToday = date === today;
        const label = isToday
          ? tx("Hoy", "Today")
          : (weekdayOptions().find((w) => w.value === new Date(`${date}T12:00:00Z`).getUTCDay())?.label ?? date);
        return (
          <div key={date} className="grid gap-2">
            {isToday ? (
              <label className="ml-3 flex items-center gap-1.5 justify-self-start text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={keys.length > 0 && keys.every((key) => open.includes(key))}
                  aria-label={tx("Desplegar todo", "Expand all")}
                  onChange={(e) => setOpen(e.target.checked ? keys : [])}
                />
                {tx("Desplegar todo", "Expand all")}
                <Hint topic="desplegar-hoy" />
              </label>
            ) : null}
            <DayFold
            id={isToday ? "dia-hoy" : undefined}
            title={isToday ? tx("Hoy", "Today") : `${label} ${date.slice(8)}`}
            count={items.length}
            open={open.includes(date)}
            tone={isToday ? "today" : "plain"}
            onToggle={() => toggle(date)}
            extra={
              isToday && items.length > 1 ? (
                <Button variant="outline" size="sm" onClick={onAskAll}>
                  <CheckCheck />
                  {tx("Todos", "All")}
                </Button>
              ) : null
            }
          >
            {isToday && items.length > 0 ? (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-xl bg-sun px-3 py-2.5">
                <label className="flex min-h-11 flex-1 items-center gap-2 text-sm leading-snug font-medium">
                  <input
                    type="checkbox"
                    checked={skip}
                    onChange={(e) => onSkip(e.target.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  {tx("Sin confirmación extra por hoy", "No extra confirmation for today")}
                </label>
                <Hint topic="sin-confirmacion" />
              </div>
            ) : null}
            {items.length === 0 ? (
              <p className="px-1 text-sm text-muted">
                {isToday
                  ? todayDone.length > 0
                    ? tx("Ya no quedan cortes pendientes para hoy.", "There are no pending cuts left for today.")
                    : tx("No hay cortes pendientes para hoy.", "There are no pending cuts for today.")
                  : tx("Sin patios este día.", "No yards this day.")}
              </p>
            ) : isToday ? (
              <ReorderableJobs jobs={items} enabled={items.length > 1} />
            ) : (
              <div className={tiles}>
                {items.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </DayFold>
          </div>
        );
      })}

      <details id="hechos-hoy" className="rounded-xl bg-surface shadow-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-done [&::-webkit-details-marker]:hidden">
          {tx("Hechos hoy", "Done today")}
          <span className="rounded-full bg-done-bg px-2 py-0.5 text-xs">{todayDone.length}</span>
        </summary>
        <div className={cn(tight, "px-2 pb-2")}>
          {todayDone.length === 0 ? (
            <p className="col-span-full px-1 py-2 text-sm text-muted">{tx("Todavía no hay patios hechos hoy.", "No yards are done yet today.")}</p>
          ) : (
            todayDone.map((job) => <JobCard key={job.id} job={job} />)
          )}
        </div>
      </details>
    </div>
  );
}

function DayFold({
  title,
  count,
  open,
  tone,
  onToggle,
  extra,
  children,
  id,
}: {
  title: string;
  count: number;
  open: boolean;
  tone: "late" | "today" | "plain";
  onToggle: () => void;
  extra?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const tx = useTx();
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-xl bg-surface shadow-card",
        tone === "late" && "ring-1 ring-late/40",
        tone === "today" && "ring-1 ring-today/40",
      )}
    >
      <div className="flex min-h-12 items-center gap-2 px-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span
            className={cn(
              "font-display text-base font-semibold",
              tone === "late" && "text-late",
              tone === "today" && "text-today",
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              tone === "late" ? "bg-late text-primary-fg" : "bg-sun text-fg",
            )}
          >
            {count}
          </span>
        </button>
        {extra}
        <button type="button" aria-label={open ? tx("Cerrar día", "Close day") : tx("Abrir día", "Open day")} onClick={onToggle} className="text-sm text-muted">
          {open ? tx("Cerrar", "Close") : tx("Abrir", "Open")}
        </button>
      </div>
      {open ? <div className="border-t border-border px-2 py-2">{children}</div> : null}
    </section>
  );
}


function StatLink({
  to,
  search,
  hash,
  onPress,
  label,
  value,
  hint,
  tone,
  warn,
  icon,
}: {
  to?: "/agenda" | "/cobros" | "/clientes";
  search?: Record<string, string>;
  hash?: string;
  onPress?: () => void;
  label: string;
  value: string;
  hint: string;
  tone: "today" | "late" | "money" | "done" | "due" | "soil" | "cut";
  warn?: boolean;
  icon: ReactNode;
}) {
  // Stat skin: the old 4px left bar stays as a transparent spacer (same metrics);
  // the tone rides in --stat-tone (hairline contour, icon chip, label ink).
  const tones = {
    today: "border-l-4 bz-stat-today bg-today-bg",
    late: "border-l-4 bz-stat-late bg-late-bg",
    money: "border-l-4 bz-stat-money bg-money-bg",
    done: "border-l-4 bz-stat-done bg-done-bg",
    due: "border-l-4 bz-stat-due bg-due-bg",
    soil: "border-l-4 bz-stat-soil bg-soil-bg",
    cut: "border-l-4 bz-stat-cut bz-cut-bg",
  };
  const className = cn(
    "alive-stat bz-stat relative block w-full min-h-24 min-w-0 touch-manipulation rounded-xl p-3 text-left transition-[transform,box-shadow] duration-150 active:scale-[0.98] sm:p-4",
    tones[tone],
    warn && "bz-stat-warn",
  );
  const inner = (
    <>
      <p className="bz-stat-label flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {icon}
        {label}
      </p>
      <p
        key={value}
        className={cn(
          "alive-num mt-1 font-display text-2xl font-semibold tabular-nums",
          (warn || tone === "late") && "text-late",
          tone === "money" && "text-money",
          tone === "due" && "text-due",
          tone === "soil" && "text-soil",
          tone === "cut" && "bz-cut-ink",
          tone === "done" && "text-done",
          tone === "today" && "text-today",
        )}
      >
        {value}
      </p>
      <p className="bz-stat-sub mt-1 text-xs leading-snug text-muted">{hint}</p>
    </>
  );
  if (onPress || !to) {
    return (
      <button type="button" onClick={onPress} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={to} search={search as never} hash={hash} className={className}>
      {inner}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
    </div>
  );
}

function EmptyState() {
  const tx = useTx();
  return (
    <div className="mb-8 rounded-xl bg-sun px-5 py-8 text-center">
      <Sprout className="mx-auto mb-3 size-8 text-primary" />
      <h2 className="font-display text-xl font-semibold">{tx("Empieza por un cliente", "Start with a client")}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {tx(
          "Añade el patio, el precio y el día de inicio. La app arma sola la agenda de cada mes.",
          "Add the yard, the price, and the start day. The app builds each month's schedule on its own.",
        )}
      </p>
      <Button asChild className="mt-5">
        <Link to="/nuevo">{tx("Añadir primer cliente", "Add the first client")}</Link>
      </Button>
    </div>
  );
}
