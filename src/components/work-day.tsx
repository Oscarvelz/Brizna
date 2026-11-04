import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogIn, LogOut, Redo2, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clock12, nowHHMM } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getSettings, getWorkSummary, punchWork } from "@/lib/server/lawn";

function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

type Snap = { scope: "today" | "yesterday"; inn: string; out: string; confirmed: boolean };

export function WorkDayCard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["work"], queryFn: () => getWorkSummary() });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const day = q.data;
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const [ask, setAsk] = useState<"in" | "out" | null>(null);
  const [askDay, setAskDay] = useState(false);
  const [edit, setEdit] = useState(false);
  const [editYesterday, setEditYesterday] = useState(false);
  const [inn, setInn] = useState("08:00");
  const [out, setOut] = useState("17:30");
  const yesterdayNow = useRef<Snap | null>(null);
  const punch = useMutation({
    mutationFn: (input: {
      kind: "in" | "out" | "preset" | "confirm" | "unconfirm" | "confirm-yesterday" | "unconfirm-yesterday";
      time?: string;
      out?: string;
    }) => punchWork({ data: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["work"] });
      await qc.invalidateQueries({ queryKey: ["finance"] });
      await qc.invalidateQueries({ queryKey: ["rhythm"] });
    },
  });

  if (!day) return null;

  function remember() {
    if (!day) return;
    setPast((items) => {
      const snap: Snap = { scope: "today", inn: day.clockIn, out: day.clockOut, confirmed: day.confirmed };
      return [...items, snap].slice(-12);
    });
    setFuture([]);
  }

  function todaySnap(): Snap {
    return { scope: "today", inn: day?.clockIn ?? "08:00", out: day?.clockOut ?? "17:30", confirmed: Boolean(day?.confirmed) };
  }

  function confirmYesterday(time?: string, outTime?: string) {
    if (!day?.pendingYesterday) return;
    const before: Snap = {
      scope: "yesterday",
      inn: day.pendingYesterday.clockIn,
      out: day.pendingYesterday.clockOut,
      confirmed: false,
    };
    const applied: Snap = {
      scope: "yesterday",
      inn: time ?? before.inn,
      out: outTime ?? before.out,
      confirmed: true,
    };
    setPast((items) => [...items, before].slice(-12));
    setFuture([]);
    yesterdayNow.current = applied;
    punch.mutate(
      time || outTime
        ? { kind: "confirm-yesterday", time: applied.inn, out: applied.out }
        : { kind: "confirm-yesterday" },
    );
  }

  async function applySnap(next: Snap) {
    if (next.scope === "yesterday") {
      await punchWork({
        data: next.confirmed
          ? { kind: "confirm-yesterday", time: next.inn, out: next.out }
          : { kind: "unconfirm-yesterday", time: next.inn, out: next.out },
      });
    } else {
      await punchWork({ data: { kind: "in", time: next.inn } });
      await punchWork({ data: { kind: "out", time: next.out } });
      await punchWork({ data: { kind: next.confirmed ? "confirm" : "unconfirm" } });
    }
    await qc.invalidateQueries({ queryKey: ["work"] });
    await qc.invalidateQueries({ queryKey: ["finance"] });
    await qc.invalidateQueries({ queryKey: ["rhythm"] });
  }

  const endAsk = nowHHMM() >= day.clockOut && !day.confirmed;

  return (
    <section className="bz-wd mb-4 rounded-xl bg-surface p-3 shadow-card">
      {/* 1.4.69 (Oscar): status is a chip on the title row; Entrada/Salida are real controls that show their time;
          1.4.70: undo/redo sit small, side by side, at the end of the title row; Entrada/Salida share the full row. */}
      <div className="bz-wd-head flex items-center gap-2">
        <h2 className="flex shrink-0 items-center gap-1 font-display text-base font-semibold">
          <span className="whitespace-nowrap">{t("hours.title")}</span>
          <Hint compact topic="horas" />
        </h2>
        {day.confirmed ? (
          <span className="bz-statchip is-done" title={t("hours.confirmed")}>
            <Check aria-hidden />
            {hoursLabel(day.hoursToday)}
          </span>
        ) : (
          <span className="bz-statchip is-wait">
            <i aria-hidden />
            {t("hours.unconfirmed")}
          </span>
        )}
          <div className="bz-wd-tools ml-auto">
            <button
              type="button"
              aria-label={t("common.cancel") === "Cancel" ? "Undo" : "Deshacer"}
              disabled={(past.length === 0 && !day.confirmed) || punch.isPending}
              onClick={() => {
                if (!day) return;
                if (past.length === 0) {
                  const snap: Snap = { scope: "today", inn: day.clockIn, out: day.clockOut, confirmed: true };
                  setFuture((items) => [...items, snap]);
                  void applySnap({ scope: "today", inn: day.clockIn, out: day.clockOut, confirmed: false });
                  return;
                }
                const prev = past[past.length - 1];
                if (!prev) return;
                const current: Snap =
                  prev.scope === "yesterday"
                    ? { scope: "yesterday", inn: (yesterdayNow.current ?? prev).inn, out: (yesterdayNow.current ?? prev).out, confirmed: true }
                    : todaySnap();
                setPast((items) => items.slice(0, -1));
                setFuture((items) => [...items, current]);
                if (prev.scope === "yesterday") yesterdayNow.current = prev;
                void applySnap(prev);
              }}
              className="bz-wd-tool"
            >
              <Undo2 aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("common.confirm") === "Confirm" ? "Redo" : "Rehacer"}
              disabled={future.length === 0 || punch.isPending}
              onClick={() => {
                const next = future[future.length - 1];
                if (!next || !day) return;
                const held = yesterdayNow.current;
                const current: Snap =
                  next.scope === "yesterday"
                    ? {
                        scope: "yesterday",
                        inn: (held ?? next).inn,
                        out: (held ?? next).out,
                        confirmed: held ? held.confirmed : !next.confirmed,
                      }
                    : todaySnap();
                setFuture((items) => items.slice(0, -1));
                setPast((items) => [...items, current]);
                if (next.scope === "yesterday") yesterdayNow.current = next;
                void applySnap(next);
              }}
              className="bz-wd-tool"
            >
              <Redo2 aria-hidden />
            </button>
          </div>
      </div>
      <div className="bz-wd-row mt-3">
        {(["in", "out"] as const).map((kind) => {
          const Ico = kind === "in" ? LogIn : LogOut;
          return (
            <button
              key={kind}
              type="button"
              className={cn("bz-wd-punch", kind === "out" && "is-out")}
              disabled={punch.isPending}
              onClick={() => setAsk(kind)}
            >
              <Ico aria-hidden />
              <span className="bz-wd-punch-t">
                <span className="bz-wd-punch-k">{t(kind === "in" ? "hours.in" : "hours.out")}</span>
                <span className="bz-wd-punch-v">{clock12(kind === "in" ? day.clockIn : day.clockOut)}</span>
              </span>
            </button>
          );
        })}

      </div>
      {day.stoppedReason || day.stoppedAt ? (
        <p className="mt-2 text-sm text-muted">
          {[day.stoppedReason, day.stoppedAt ? day.stoppedAt.slice(11, 16) : ""].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {day.pendingYesterday && settings.data?.askYesterday !== false ? (
        <div className="bz-wd-ask mt-3">
          <p className="bz-wd-ask-q">
            {t("hours.yesterday")
              .replace("{in}", clock12(day.pendingYesterday.clockIn))
              .replace("{out}", clock12(day.pendingYesterday.clockOut))}
          </p>
          <p className="mt-1 text-sm text-muted">{t("hours.yesterdayHelp")}</p>
          <div className="bz-wd-ask-pair">
            <Button
              type="button"
              size="sm"
              disabled={punch.isPending}
              onClick={() => confirmYesterday()}
            >
              {t("hours.confirm")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bz-wd-quiet"
              onClick={() => {
                setInn(day.pendingYesterday?.clockIn ?? "08:00");
                setOut(day.pendingYesterday?.clockOut ?? "17:30");
                setEditYesterday(true);
              }}
            >
              {t("common.confirm") === "Confirm" ? "No, adjust" : "No, ajustar"}
            </Button>
          </div>
          {editYesterday ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input type="time" value={inn} onChange={(e) => setInn(e.target.value)} aria-label={t("hours.in")} />
              <Input type="time" value={out} onChange={(e) => setOut(e.target.value)} aria-label={t("hours.out")} />
              <Button
                type="button"
                size="sm"
                className="col-span-2"
                disabled={punch.isPending}
                onClick={() => {
                  confirmYesterday(inn, out);
                  setEditYesterday(false);
                }}
              >
                {t("common.confirm") === "Confirm" ? "Save those hours" : "Guardar esas horas"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {endAsk ? (
        <div className="bz-wd-ask mt-3">
          <p className="bz-wd-ask-q">
            {t("hours.ask").replace("{in}", clock12(day.clockIn)).replace("{out}", clock12(day.clockOut))}
          </p>
          <div className="bz-wd-ask-pair">
            <Button type="button" size="sm" disabled={punch.isPending} onClick={() => setAskDay(true)}>
              {t("hours.confirm")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bz-wd-quiet"
              onClick={() => {
                setInn(day.clockIn);
                setOut(day.clockOut);
                setEdit(true);
              }}
            >
              {t("common.confirm") === "Confirm" ? "No, edit" : "No, editar"}
            </Button>
          </div>
          {edit ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input type="time" value={inn} onChange={(e) => setInn(e.target.value)} aria-label={t("hours.in")} />
              <Input type="time" value={out} onChange={(e) => setOut(e.target.value)} aria-label={t("hours.out")} />
              <Button
                type="button"
                size="sm"
                className="col-span-2"
                disabled={punch.isPending}
                onClick={() => {
                  remember();
                  void punchWork({ data: { kind: "in", time: inn } })
                    .then(() => punchWork({ data: { kind: "out", time: out } }))
                    .then(() => punchWork({ data: { kind: "confirm" } }))
                    .then(async () => {
                      setEdit(false);
                      await qc.invalidateQueries({ queryKey: ["work"] });
                      await qc.invalidateQueries({ queryKey: ["finance"] });
                    });
                }}
              >
                {t("common.confirm") === "Confirm" ? "Save those hours" : "Guardar esas horas"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={ask != null}
        title={
          ask === "out"
            ? t("common.confirm") === "Confirm"
              ? "Change the clock-out?"
              : "¿Cambiar la hora de salida?"
            : t("common.confirm") === "Confirm"
              ? "Change the clock-in?"
              : "¿Cambiar la hora de entrada?"
        }
        description={
          t("common.confirm") === "Confirm"
            ? "Use the time right now, or keep the usual schedule."
            : "Usa la hora de ahora, o deja el horario de siempre."
        }
        confirmLabel={t("hours.now")}
        extraLabel={t("hours.preset")}
        pending={punch.isPending}
        onConfirm={() => {
          remember();
          punch.mutate({ kind: ask === "out" ? "out" : "in", time: nowHHMM() });
          setAsk(null);
        }}
        onExtra={() => {
          remember();
          punch.mutate({ kind: "preset" });
          setAsk(null);
        }}
        onCancel={() => setAsk(null)}
      />
      <ConfirmDialog
        front
        open={askDay}
        pending={punch.isPending}
        title={t("common.confirm") === "Confirm" ? "Confirm this day?" : "¿Confirmar este día?"}
        description={
          t("common.confirm") === "Confirm"
            ? `The day is saved as worked, from ${nb(clock12(day.clockIn))} to\u00A0${nb(clock12(day.clockOut))}`
            : `El día queda como trabajado, de ${nb(clock12(day.clockIn))} a\u00A0${nb(clock12(day.clockOut))}`
        }
        confirmLabel={t("common.confirm") === "Confirm" ? "Yes, confirm" : "Sí, confirmar"}
        onConfirm={() => {
          remember();
          punch.mutate({ kind: "confirm" });
          setAskDay(false);
        }}
        onCancel={() => setAskDay(false)}
      />
    </section>
  );
}

const nb = (x: string) => x.replace(/ /g, "\u00A0");
