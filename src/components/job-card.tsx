import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Clock, GripVertical, Phone, Pin, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddressLine } from "@/components/address-line";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfirmLink } from "@/components/confirm-link";
import { ContactIcons } from "@/components/contact-icons";
import { CueChip } from "@/components/cue-chip";
import { useDensity, useQuadCols } from "@/components/density-toggle";
import { MessageComposer, WhatsAppButton } from "@/components/message-composer";
import { MethodField } from "@/components/method-field";
import { OffDayDialog, shiftToMonday, useRareDay } from "@/components/off-day-ask";
import { MoneyCalc } from "@/components/money-calc";
import { PhotoPicker } from "@/components/photo-picker";
import { ReasonChips } from "@/components/reason-chips";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeshName } from "@/components/mesh-name";
import { meshFrame } from "@/lib/density";
import { addDaysISO, stampDay, todayISO } from "@/lib/dates";
import { formatDay, formatTime, jobKindLabel, money, telHref } from "@/lib/format";
import { isHechoConfirmSkipped, subscribeHechoConfirm } from "@/lib/hecho-confirm";
import { useI18n, useTx } from "@/lib/i18n";
import { applyOutboxJob, enqueue, isOfflineError, useOutbox } from "@/lib/offline-queue";
import { cancelJob, completeJob, reopenJob, rescheduleJob, toggleJobPin, undoPostpone } from "@/lib/server/lawn";
import { CANCEL_REASON, DEFAULT_ABONO_PRESETS, POSTPONE_REASONS, type JobRow } from "@/lib/types";

/** 1.4.65: the card's Posponer reasons add Cancelado (before Otro), which cancels the cut instead of moving it. */
const CARD_REASONS = [...POSTPONE_REASONS.filter((r) => r !== "Otro"), CANCEL_REASON, "Otro"];
import { useUndo } from "@/lib/undo";
import { playTick } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export function JobCard({
  job,
  compact,
  dragHandle,
}: {
  job: JobRow;
  compact?: boolean;
  dragHandle?: boolean;
}) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const tx = useTx();
  const today = todayISO();
  const push = useUndo((s) => s.push);
  const rare = useRareDay();
  const [sure, setSure] = useState<null | "paid" | "owe" | "abono">(null);
  const [rarePost, setRarePost] = useState<null | { iso: string; kind: "sunday" | "free" }>(null);
  const [askDone, setAskDone] = useState(false);
  const [askAbono, setAskAbono] = useState(false);
  const [abono, setAbono] = useState("");
  const [askUndo, setAskUndo] = useState(false);
  const [askPost, setAskPost] = useState(false);
  const [askReturn, setAskReturn] = useState(false);
  const [askPin, setAskPin] = useState(false);
  const [postDate, setPostDate] = useState(addDaysISO(job.scheduledDate, 1));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [tip, setTip] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [skip, setSkip] = useState(false);
  const ops = useOutbox();
  const live = applyOutboxJob(job, ops, today);
  const queued = live !== job;

  useEffect(() => {
    const read = () => setSkip(isHechoConfirmSkipped(today));
    read();
    return subscribeHechoConfirm(read);
  }, [today]);

  const complete = useMutation({
    mutationFn: async (input: {
      settlement: "paid" | "owe" | "abono";
      abono?: number;
      method?: string;
      photo?: string;
      tip?: number;
    }) => {
      const payload = {
        id: job.id,
        settlement: input.settlement,
        abono: input.abono,
        method: input.method || undefined,
        photo: input.photo,
        tip: input.tip,
      };
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue({
          kind: "done",
          jobId: job.id,
          settlement: input.settlement,
          abono: input.abono,
          method: input.method,
          photo: input.photo,
          tip: input.tip,
        });
        return { ok: true as const, offline: true as const, collected: false, usedCredit: 0 };
      }
      try {
        return await completeJob({ data: payload });
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        enqueue({
          kind: "done",
          jobId: job.id,
          settlement: input.settlement,
          abono: input.abono,
          method: input.method,
          photo: input.photo,
          tip: input.tip,
        });
        return { ok: true as const, offline: true as const, collected: false, usedCredit: 0 };
      }
    },
    onSuccess: async (res, input) => {
      if ("offline" in res && res.offline) {
        toast(tx("Sin red, guardado aquí", "No signal, saved here"));
        setAskDone(false);
        setAskAbono(false);
        return;
      }
      playTick();
      if (input.settlement === "paid") {
        toast.success(tx("Hecho y cobrado. Si debía de antes, eso sigue por cobrar.", "Done and paid. Older debt stays in To collect."));
      } else if (input.settlement === "abono") {
        toast.success(
          tx(
            `Hecho y abonado ${money(input.abono ?? 0)}. El resto sigue por cobrar.`,
            `Done with a partial payment of ${money(input.abono ?? 0)}. The rest stays in To collect.`,
          ),
        );
      } else if (res.ok && (res.usedCredit ?? 0) >= job.amount && job.amount > 0) {
        toast.success(tx("Hecho. Lo cubrió el adelanto y no se sumó a la cuenta.", "Done. The prepayment covered it and it was not added to the balance."));
      } else {
        toast.success(tx("Hecho y pendiente. Este corte quedó en por cobrar.", "Done and unpaid. This cut is now in To collect."));
      }
      setAskDone(false);
      setAskAbono(false);
      setPhoto(null);
      push({
        label: tx(`Hecho: ${job.clientName}`, `Done: ${job.clientName}`),
        undo: async () => {
          await reopenJob({ data: { id: job.id } });
          await invalidateLawn(qc);
        },
        redo: async () => {
          await completeJob({
            data: { id: job.id, settlement: input.settlement, abono: input.abono, method: input.method, photo: input.photo, tip: input.tip },
          });
          await invalidateLawn(qc);
        },
      });
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("No se pudo guardar", "Could not save")),
  });
  const cancel = useMutation({
    mutationFn: () => cancelJob({ data: { id: job.id, reason: CANCEL_REASON } }),
    onSuccess: async () => {
      toast(tx(`Cancelado: ${job.clientName}. El cliente no se borra.`, `Canceled: ${job.clientName}. The client is not deleted.`));
      setAskPost(false);
      setReason("");
      await invalidateLawn(qc);
    },
  });
  const undo = useMutation({
    mutationFn: () => reopenJob({ data: { id: job.id } }),
    onSuccess: async () => {
      toast(tx("Vuelto a pendiente", "Back to pending"));
      setAskUndo(false);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("No se pudo deshacer", "Could not undo")),
  });
  const postpone = useMutation({
    mutationFn: async (date?: string) => {
      const when = date || postDate;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue({ kind: "postpone", jobId: job.id, date: when, reason });
        return { ok: true as const, offline: true as const, prevDate: job.scheduledDate, reason: "ok" as const };
      }
      try {
        return await rescheduleJob({ data: { id: job.id, date: when, reason } });
      } catch (err) {
        if (!isOfflineError(err)) throw err;
        enqueue({ kind: "postpone", jobId: job.id, date: when, reason });
        return { ok: true as const, offline: true as const, prevDate: job.scheduledDate, reason: "ok" as const };
      }
    },
    onSuccess: async (res) => {
      if ("offline" in res && res.offline) {
        toast(tx("Sin red, guardado aquí", "No signal, saved here"));
        setAskPost(false);
        return;
      }
      if (!res.ok) {
        toast.error(
          res.reason === "duplicate"
            ? tx("Ya hay un corte de este cliente ese día.", "This client already has a cut that day.")
            : tx("No se pudo posponer", "Could not postpone"),
        );
        return;
      }
      const prev = res.prevDate;
      toast.success(tx(`Pospuesto: ${job.clientName}`, `Postponed: ${job.clientName}`));
      setAskPost(false);
      push({
        label: tx(`Posponer ${job.clientName}`, `Postpone ${job.clientName}`),
        undo: async () => {
          await rescheduleJob({ data: { id: job.id, date: prev } });
          await invalidateLawn(qc);
        },
        redo: async () => {
          await rescheduleJob({ data: { id: job.id, date: postDate, reason } });
          await invalidateLawn(qc);
        },
      });
      await invalidateLawn(qc);
    },
  });

  const unpostpone = useMutation({
    mutationFn: () => undoPostpone({ data: { id: job.id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(
          res.reason === "duplicate"
            ? tx("Ya hay un corte de este cliente ese día.", "This client already has a cut that day.")
            : tx("No se pudo deshacer el pospuesto", "Could not undo the postpone"),
        );
        return;
      }
      toast.success(tx(`Volvió al ${formatDay(res.date, "EEE d")}`, `Back on ${formatDay(res.date, "EEE d")}`));
      setAskReturn(false);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("No se pudo deshacer el pospuesto", "Could not undo the postpone")),
  });

  const pin = useMutation({
    mutationFn: () => toggleJobPin({ data: { id: job.id } }),
    onSuccess: async (res) => {
      toast(res.pinned ? tx("Fijado en Hoy", "Pinned on Today") : tx("Ya no está fijado", "No longer pinned"));
      setAskPin(false);
      await invalidateLawn(qc);
    },
  });

  const density = useDensity();
  const cols = useQuadCols();
  const dense = density === "dense";
  const media = density === "compact";
  const quad = density === "quad";
  const pending = live.status === "pending";
  const late = live.computedStatus === "late";
  const timeLabel = formatTime(job.arrivalTime);
  const isOnce = job.kind === "one_time";
  const isExtra = job.kind === "extra";
  const postponed = pending && Boolean(job.originDate) && job.originDate !== job.scheduledDate;
  const skipThis = skip && job.scheduledDate === today;
  const isCancel = reason === CANCEL_REASON;

  function onPin() {
    if (job.pinLocked) {
      toast(tx("Este patio sigue en Hoy hasta que lo hagas, o hasta que deje de estar atrasado o en alto riesgo.", "This yard stays on Today until you finish it, or until it is no longer late or high risk."));
      return;
    }
    // 1.4.63 (Oscar): pinning or unpinning asks first and says where the yard goes
    setAskPin(true);
  }

  function onHecho() {
    if (skipThis) {
      complete.mutate({
        settlement: job.paySameDay ? "paid" : "owe",
        method: job.paySameDay ? method : undefined,
        photo: photo ?? undefined,
      });
      return;
    }
    setAskDone(true);
  }

  const completedToday =
    live.status === "done" &&
    !queued &&
    (live.scheduledDate === today || (live.completedAt ? stampDay(live.completedAt) === today : false));

  const pinButton = (box: string, icon: string) => (
    <button
      type="button"
      aria-label={job.pinned ? tx("Quitar de fijados", "Unpin") : tx("Fijar en Hoy", "Pin on Today")}
      onClick={onPin}
      className={cn("bz-tone bz-tone-pin grid shrink-0 place-items-center rounded-sm", box, job.pinned && "bz-tone-on")}
    >
      <Pin className={icon} />
    </button>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={askDone}
        stack
        title={tx(`¿Cómo cerrar ${job.clientName}?`, `How do you want to close ${job.clientName}'s cut?`)}
        description={
          <div className="grid gap-2">
            <p>
              {tx(`Este corte es ${money(job.amount)}. `, `This cut is ${money(job.amount)}. `)}
              <strong>{tx("Cobrado", "Collected")}</strong>
              {tx(" anota solo el pago de hoy. ", " records only today's payment. ")}
              <strong>{tx("Pendiente", "Unpaid")}</strong>
              {tx(" suma el corte a la cuenta. ", " adds the cut to the balance. ")}
              <strong>{tx("Abonado", "Partial")}</strong>
              {tx(" anota una parte.", " records part of it.")}
            </p>
            <MethodField value={method} onChange={setMethod} />
            <label className="text-xs font-semibold text-muted">
              {tx("Propina, si dieron de más", "Tip, if they gave extra")}
              <Input value={tip} inputMode="decimal" onChange={(e) => setTip(e.target.value)} placeholder="0" className="mt-1" />
            </label>
            <PhotoPicker label={t("photo.job")} onPick={setPhoto} />
            {photo ? <p className="text-xs text-muted">{t("photo.ready")}</p> : null}
          </div>
        }
        confirmLabel={t("hecho.paid")}
        extraLabel={t("hecho.owe")}
        altLabel={t("hecho.abono")}
        cancelLabel={tx("Atrás", "Back")}
        pending={complete.isPending}
        onConfirm={() => {
          if (skip) {
            complete.mutate({
              settlement: "paid",
              method,
              photo: photo ?? undefined,
              tip: Math.round((Number(tip) || 0) * 100) / 100,
            });
            return;
          }
          setSure("paid");
        }}
        onExtra={() => {
          if (skip) {
            complete.mutate({ settlement: "owe", photo: photo ?? undefined });
            return;
          }
          setSure("owe");
        }}
        onAlt={() => {
          setAskDone(false);
          setAbono(String(job.amount || ""));
          setAskAbono(true);
        }}
        onCancel={() => setAskDone(false)}
      />
      <ConfirmDialog
        open={askAbono}
        title={tx(`¿Abono de ${job.clientName}?`, `Partial payment for ${job.clientName}?`)}
        description={
          <div className="grid gap-2">
            <p>
              {tx(
                `El corte de ${money(job.amount)} entra en la cuenta y este abono se resta. Lo que no cubra, y lo que ya debía, sigue por cobrar.`,
                `The ${money(job.amount)} cut goes on the balance and this partial payment is subtracted. What it does not cover, and older debt, stays in To collect.`,
              )}
            </p>
            <MoneyCalc
              value={abono}
              onChange={setAbono}
              presets={DEFAULT_ABONO_PRESETS}
            />
          </div>
        }
        confirmLabel={tx("Hecho y abonado", "Done with a partial payment")}
        confirmTone="abono"
        cancelLabel={tx("Atrás", "Back")}
        pending={complete.isPending}
        onConfirm={() => {
          const n = Math.round((Number(abono) || 0) * 100) / 100;
          if (n <= 0) {
            toast.error(tx("Escribe el monto del abono.", "Enter the partial payment amount."));
            return;
          }
          if (skip) {
            complete.mutate({
              settlement: "abono",
              abono: n,
              method,
              photo: photo ?? undefined,
              tip: Math.round((Number(tip) || 0) * 100) / 100,
            });
            return;
          }
          setSure("abono");
        }}
        onCancel={() => setAskAbono(false)}
      />
      <ConfirmDialog
        front
        open={sure != null}
        title={
          sure === "owe"
            ? tx("¿Hecho y pendiente?", "Done and unpaid?")
            : sure === "abono"
              ? tx("¿Hecho y abonado?", "Done with a partial payment?")
              : tx("¿Hecho y cobrado?", "Done and paid?")
        }
        description={
          sure === "owe"
            ? tx("El corte queda hecho y el monto entra en Por cobrar.", "The cut is done and the amount goes into To collect.")
            : sure === "abono"
              ? tx(`Se anota el abono de ${money(Number(abono) || 0)}. El resto sigue por cobrar.`, `The partial payment of ${money(Number(abono) || 0)} is recorded. The rest stays in To collect.`)
              : tx("Se anota el pago de hoy en Cobrado. Lo que debía de antes sigue por cobrar.", "Today's payment is recorded in Collected. Older debt stays in To collect.")
        }
        confirmLabel={
          sure === "owe" ? tx("Sí, pendiente", "Yes, unpaid") : sure === "abono" ? tx("Sí, abonado", "Yes, partial") : tx("Sí, cobrado", "Yes, paid")
        }
        pending={complete.isPending}
        onConfirm={() => {
          const choice = sure;
          setSure(null);
          if (choice === "owe") complete.mutate({ settlement: "owe", photo: photo ?? undefined });
          else if (choice === "abono") {
            const n = Math.round((Number(abono) || 0) * 100) / 100;
            complete.mutate({
              settlement: "abono",
              abono: n,
              method,
              photo: photo ?? undefined,
              tip: Math.round((Number(tip) || 0) * 100) / 100,
            });
          } else {
            complete.mutate({
              settlement: "paid",
              method,
              photo: photo ?? undefined,
              tip: Math.round((Number(tip) || 0) * 100) / 100,
            });
          }
        }}
        onCancel={() => setSure(null)}
      />
      <ConfirmDialog
        open={askUndo}
        title={tx(`¿Volver ${job.clientName} a pendiente?`, `Move ${job.clientName} back to pending?`)}
        description={tx(
          "Sirve para corregir un toque por error. El saldo, el adelanto o el cobro de este trabajo también se deshace.",
          "Use this to fix an accidental tap. The balance, prepayment, or payment for this job is also undone.",
        )}
        confirmLabel={tx("Deshacer", "Undo")}
        pending={undo.isPending}
        onConfirm={() => undo.mutate()}
        onCancel={() => setAskUndo(false)}
      />
      <ConfirmDialog
        open={askPost}
        title={isCancel ? tx("¿Cancelar este corte?", "Cancel this cut?") : tx("¿Por qué pospuso?", "Why was it postponed?")}
        description={
          <div className="grid gap-2">
            <p>
              {isCancel
                ? tx(`${job.clientName} no se hace ni se cobra. Queda como Cancelado con su razón. El cliente no se borra.`, `${job.clientName} is not done or charged. It stays as Canceled with its reason. The client is not deleted.`)
                : tx(`${job.clientName} pasa a otro día.`, `${job.clientName} moves to another day.`)}
            </p>
            {isCancel ? null : <Input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} />}
            {/* 1.4.65 (Oscar): Quitar left the card; Posponer covers it with the reason Cancelado */}
            <ReasonChips value={reason} onChange={setReason} reasons={CARD_REASONS} history={!isCancel} />
          </div>
        }
        confirmLabel={isCancel ? tx("Sí, cancelar", "Yes, cancel") : tx("Sí, posponer", "Yes, postpone")}
        danger={isCancel}
        pending={postpone.isPending || cancel.isPending}
        onConfirm={() => {
          if (isCancel) {
            cancel.mutate();
            return;
          }
          const kind = rare.kindOf(postDate);
          if (kind) {
            setAskPost(false);
            setRarePost({ iso: postDate, kind });
            return;
          }
          postpone.mutate(postDate);
        }}
        onCancel={() => setAskPost(false)}
      />
      <ConfirmDialog
        open={askReturn}
        title={tx("¿Deshacer pospuesto?", "Undo the postpone?")}
        description={tx(
          `${job.clientName} vuelve al ${job.originDate ? formatDay(job.originDate, "EEEE d 'de' MMMM") : "día original"}. La razón se quita.`,
          `${job.clientName} goes back to ${job.originDate ? formatDay(job.originDate, "EEEE, MMMM d") : "the original day"}. The reason is cleared.`,
        )}
        confirmLabel={tx("Sí, deshacer pospuesto", "Yes, undo postpone")}
        pending={unpostpone.isPending}
        onConfirm={() => unpostpone.mutate()}
        onCancel={() => setAskReturn(false)}
      />
      <ConfirmDialog
        open={askPin}
        title={job.pinned ? tx("¿Quitar de Fijados?", "Unpin this yard?") : tx("¿Fijar este patio?", "Pin this yard?")}
        description={
          job.pinned
            ? job.scheduledDate === today
              ? tx(`${job.clientName} sale de Fijados y vuelve a su lugar en Hoy.`, `${job.clientName} leaves Pinned and goes back to its place in Today.`)
              : tx(
                  `${job.clientName} sale de Fijados y vuelve al ${formatDay(job.scheduledDate, "EEEE d 'de' MMMM")}.`,
                  `${job.clientName} leaves Pinned and goes back to ${formatDay(job.scheduledDate, "EEEE, MMMM d")}.`,
                )
            : job.scheduledDate > addDaysISO(today, 7)
              ? tx(
                  `${job.clientName} pasará a Fijados, arriba en Hoy, cuando falte una semana.`,
                  `${job.clientName} moves to Pinned, at the top of Today, once it is a week away.`,
                )
              : tx(
                  `${job.clientName} pasará a Fijados, arriba en Hoy, hasta que lo hagas.`,
                  `${job.clientName} moves to Pinned, at the top of Today, until you finish it.`,
                )
        }
        confirmLabel={job.pinned ? tx("Quitar", "Unpin") : tx("Fijar", "Pin")}
        pending={pin.isPending}
        onConfirm={() => pin.mutate()}
        onCancel={() => setAskPin(false)}
      />
      <OffDayDialog
        iso={rarePost?.iso ?? null}
        kind={rarePost?.kind ?? null}
        pending={postpone.isPending}
        onKeep={() => {
          const iso = rarePost?.iso;
          setRarePost(null);
          if (iso) postpone.mutate(iso);
        }}
        onMonday={() => {
          const iso = rarePost?.iso;
          setRarePost(null);
          if (iso) postpone.mutate(shiftToMonday(iso));
        }}
        onClose={() => setRarePost(null)}
      />
    </>
  );

  if (quad) {
    return (
      <>
        <article
          className={cn(
            "flex min-w-0 flex-col gap-1 rounded-2xl bg-surface shadow-card ring-1 ring-primary/25",
            meshFrame(cols),
            late && "bg-late-bg bz-late-card",
          )}
        >
          <div className="flex min-w-0 items-start gap-1">
            {dragHandle && pending && cols === 2 ? (
              <span className="grid size-6 shrink-0 place-items-center text-muted" data-drag-handle aria-hidden>
                <GripVertical className="size-3.5" />
              </span>
            ) : null}
            <Link to="/clientes/$id" params={{ id: String(job.clientId) }} className="min-w-0 flex-1">
              <MeshName name={job.clientName} cols={cols} />
            </Link>
          </div>
          {cols < 4 ? (
            <p className="truncate text-[11px] text-muted">{job.scheduledDate ? formatDay(job.scheduledDate, "d MMM") : ""}</p>
          ) : (
            <p className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[11px] leading-tight text-muted">
              {live.status === "done" ? (
                <Check className="size-3.5 shrink-0 text-done" strokeWidth={3} aria-label={tx("Hecho", "Done")} />
              ) : null}
              <span className="min-w-0 overflow-hidden">{job.scheduledDate ? formatDay(job.scheduledDate, "d MMM") : ""}</span>
            </p>
          )}
          <p className={cn("truncate font-semibold tabular-nums", cols === 4 ? "text-[11px]" : "text-xs")}>{money(job.amount)}</p>
          {cols === 2 ? (
            <ContactIcons phone={job.clientPhone} address={job.clientAddress} name={job.clientName} tight variant="some" />
          ) : null}
          {cols === 2 && postponed ? (
            <Button size="sm" variant="outline" className="h-8 w-full px-1 text-xs" onClick={() => setAskReturn(true)}>
              {tx("Deshacer pospuesto", "Undo postpone")}
            </Button>
          ) : null}
          {cols === 2 && pending ? (
            <Button size="sm" className="mt-auto h-8 w-full px-1 text-xs" onClick={onHecho} disabled={complete.isPending}>
              {tx("Hecho", "Done")}
            </Button>
          ) : null}
          {cols === 3 && pending ? (
            <Button size="sm" className="mt-auto h-7 w-full px-1 text-[11px]" onClick={onHecho} disabled={complete.isPending}>
              {tx("Hecho", "Done")}
            </Button>
          ) : null}
        </article>
        {dialogs}
      </>
    );
  }

  if (dense) {
    return (
      <>
        <article
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md bg-surface px-2 py-1 shadow-card",
            late && "bg-late-bg bz-late-card",
          )}
        >
          {dragHandle && pending ? (
            <span className="grid size-8 shrink-0 touch-none place-items-center text-muted" data-drag-handle aria-hidden>
              <GripVertical className="size-3.5" />
            </span>
          ) : null}
          <button
            type="button"
            aria-label={job.pinned ? tx("Quitar de fijados", "Unpin") : tx("Fijar en Hoy", "Pin on Today")}
            onClick={onPin}
            className={cn(
              "bz-tone bz-tone-pin grid size-8 shrink-0 place-items-center rounded-sm",
              job.pinned && "bz-tone-on",
            )}
          >
            <Pin className="size-3" />
          </button>
          <Link
            to="/clientes/$id"
            params={{ id: String(job.clientId) }}
            className="min-w-0 flex-1 truncate text-sm font-semibold"
          >
            {job.clientName}
          </Link>
          {job.clientCue ? <CueChip text={job.clientCue} className="max-w-24 shrink" /> : null}
          {job.clientPhone ? (
            <MessageComposer phone={job.clientPhone} name={job.clientName} compact tight />
          ) : null}
          {job.clientPhone ? <WhatsAppButton phone={job.clientPhone} name={job.clientName} tight /> : null}
          {queued ? <span className="shrink-0 text-xs font-semibold text-hold">{tx("Aquí", "Here")}</span> : null}
          {postponed ? (
            <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={() => setAskReturn(true)} aria-label={tx("Deshacer pospuesto", "Undo postpone")}>
              {tx("Volver", "Back")}
            </Button>
          ) : null}
          {pending ? (
            <Button size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={onHecho} disabled={complete.isPending}>
              {tx("Hecho", "Done")}
            </Button>
          ) : completedToday ? (
            <Button size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-xs" onClick={() => setAskUndo(true)}>
              {tx("Deshacer", "Undo")}
            </Button>
          ) : null}
        </article>
        {dialogs}
      </>
    );
  }

  return (
    <>
    <article
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-xl bg-surface shadow-card",
        media ? "p-2.5" : "p-4",
        late && "bg-late-bg bz-late-card",
        !late && live.computedStatus === "pending" && "ring-1 ring-pending/25",
        !late && live.computedStatus === "done" && "ring-1 ring-done/20",
        !late && isOnce && "border-l-4 border-pending bg-pending-bg",
        !late && isExtra && "border-l-4 border-money",
        !late && job.kind === "cut" && "border-l-4 border-today",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {dragHandle && pending && !media ? (
          <span
            className="bz-grip-lg grid size-8 shrink-0 touch-none place-items-center rounded-sm text-muted"
            data-drag-handle
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {media ? (
          <>
          <div className="flex min-w-0 items-center gap-1.5">
            {dragHandle && pending ? (
              <span
                className="grid size-8 shrink-0 touch-none place-items-center rounded-sm text-muted"
                data-drag-handle
                aria-hidden
              >
                <GripVertical className="size-4" />
              </span>
            ) : null}
            {/* 1.4.64 (Oscar): price sits right after the name; contact chips grouped; pin last, top-right */}
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <Link
                to="/clientes/$id"
                params={{ id: String(job.clientId) }}
                className="min-w-0 font-display text-[1.0625rem] font-semibold leading-none hover:underline"
              >
                <OneLineName name={job.clientName} />
              </Link>
              <span className="shrink-0 font-display text-sm font-semibold leading-none tabular-nums text-fg/70">{money(job.amount)}</span>
            </div>
            {job.clientPhone ? (
              <MessageComposer phone={job.clientPhone} name={job.clientName} compact tight />
            ) : null}
            {job.clientPhone ? <WhatsAppButton phone={job.clientPhone} name={job.clientName} tight /> : null}
            {job.clientPhone ? (
              <ConfirmLink
                href={telHref(job.clientPhone)}
                kind="call"
                name={job.clientName}
                className="bz-tone bz-tone-call grid size-8 shrink-0 place-items-center rounded-sm"
              >
                <Phone className="size-3.5" />
                <span className="sr-only">{tx("Llamar", "Call")}</span>
              </ConfirmLink>
            ) : null}
            {pinButton("size-8", "size-3.5")}
          </div>
          <p className={cn("mt-1 truncate text-xs leading-none text-muted", dragHandle && pending && "pl-10")}>
            {jobKindLabel(job.kind, job.title)}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </p>
          </>
          ) : (
          <>
          {/* 1.4.64 (Oscar): name + price on one line, pin in the top-right corner */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <Link
                to="/clientes/$id"
                params={{ id: String(job.clientId) }}
                className="min-w-0 font-display text-[1.3rem] font-semibold leading-snug hover:underline"
              >
                <OneLineName name={job.clientName} />
              </Link>
              <span className="shrink-0 font-display text-base font-semibold tabular-nums text-fg/70">{money(job.amount)}</span>
            </div>
            {pinButton("size-8", "size-3.5")}
          </div>
          {/* 1.4.65 (Oscar): service – date – time on one line; contact chips with the status badge
              right-aligned on the same row, vertically centered */}
          <FitLine
            className="mt-1.5 min-w-0 text-sm font-medium leading-tight text-fg/75"
            forms={[
              [jobKindLabel(job.kind, job.title), capFirst(formatDay(job.scheduledDate, "EEE d MMM")), timeLabel].filter(Boolean).join(" – "),
              [jobKindLabel(job.kind, job.title), formatDay(job.scheduledDate, "d MMM"), timeLabel].filter(Boolean).join(" – "),
            ]}
          />
          <div className="mt-2 flex min-w-0 items-center gap-1.5" data-contact-chips>
            {job.clientPhone ? (
              <>
                <MessageComposer phone={job.clientPhone} name={job.clientName} compact />
                <WhatsAppButton phone={job.clientPhone} name={job.clientName} />
                <ConfirmLink
                  href={telHref(job.clientPhone)}
                  kind="call"
                  name={job.clientName}
                  className="bz-tone bz-tone-call grid size-11 shrink-0 place-items-center rounded-sm"
                >
                  <Phone className="size-[18px]" />
                  <span className="sr-only">{tx("Llamar", "Call")}</span>
                </ConfirmLink>
              </>
            ) : null}
            <span className="ml-auto shrink-0" data-status-col>
              <StatusBadge status={live.computedStatus} />
            </span>
          </div>
          </>
          )}
          {job.clientCue ? <CueChip text={job.clientCue} className="mt-1" /> : null}
          {job.standingExtras.length > 0 ? (
            <p className="mt-1 text-xs font-semibold text-soil">
              {tx("Siempre", "Always")}: {job.standingExtras.join(" · ")}
            </p>
          ) : null}
          {queued ? <p className="mt-1 text-xs font-semibold text-hold">{tx("Sin red, guardado aquí", "No signal, saved here")}</p> : null}
          {!media && (isOnce || isExtra) && (
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isOnce ? "bg-pending text-primary-fg" : "bg-money-bg text-money",
              )}
            >
              {isOnce ? tx("Una vez", "One-time") : tx("Extra", "Extra")}
            </span>
          )}
        </div>
      </div>

      {job.clientAddress && !media && (
        <AddressLine address={job.clientAddress} name={job.clientName} compact className="mt-3" />
      )}

      {pending && !compact && (
        <div className={cn("grid grid-cols-2 items-center", media ? "mt-2 gap-2" : "mt-4 gap-2.5")}>
          <Button onClick={onHecho} disabled={complete.isPending} className={cn("w-full", !media && "gap-1.5 px-2 text-[15px] [&_svg]:size-[18px]")} size={media ? "sm" : "md"}>
            <Check />
            {tx("Hecho", "Done")}
          </Button>
          {/* 1.4.61 (Oscar): Posponer is a real button in the action row, not a loose line under it */}
          <Button variant="outline" onClick={() => setAskPost(true)} className={cn("bz-tone bz-tone-post w-full whitespace-nowrap", !media && "gap-1.5 px-2 text-[15px] [&_svg]:size-[18px]")} size={media ? "sm" : "md"}>
            <Clock />
            {tx("Posponer", "Postpone")}
          </Button>
        </div>
      )}

      {postponed && !compact && (
        <Button variant="outline" className="mt-1 h-9 w-full" size="sm" onClick={() => setAskReturn(true)}>
          <RotateCcw />
          {tx("Deshacer pospuesto", "Undo postpone")}
        </Button>
      )}

      {completedToday && !compact && (
        <div className="mt-2">
          <Button variant="ghost" className="h-9 w-full text-muted" size="sm" onClick={() => setAskUndo(true)}>
            <RotateCcw />
            {tx("Deshacer Hecho", "Undo Done")}
          </Button>
        </div>
      )}
    </article>
    {dialogs}
    </>
  );
}

export async function invalidateLawn(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
    qc.invalidateQueries({ queryKey: ["clients"] }),
    qc.invalidateQueries({ queryKey: ["client"] }),
    qc.invalidateQueries({ queryKey: ["jobs"] }),
    qc.invalidateQueries({ queryKey: ["balances"] }),
    qc.invalidateQueries({ queryKey: ["settings"] }),
    qc.invalidateQueries({ queryKey: ["backups"] }),
    qc.invalidateQueries({ queryKey: ["finance"] }),
    qc.invalidateQueries({ queryKey: ["inventory"] }),
    qc.invalidateQueries({ queryKey: ["pad"] }),
    qc.invalidateQueries({ queryKey: ["client-changes"] }),
    qc.invalidateQueries({ queryKey: ["week-off"] }),
  ]);
}

function capFirst(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/** 1.4.64 (Oscar): a client's name on one line at its normal size. A long name drops its middle
    names, then shortens the last name to an initial ("Maximiliano B."), never wraps or shrinks. */
function nameForms(full: string): string[] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const out = [parts.join(" ")];
  if (parts.length > 2) out.push(`${parts[0]} ${parts[parts.length - 1]}`);
  if (parts.length > 1) out.push(`${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`, parts[0]!);
  return out;
}

function OneLineName({ name }: { name: string }) {
  const forms = nameForms(name);
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const key = forms.join("|");
  useLayoutEffect(() => {
    const el = ref.current;
    const link = el?.parentElement;
    const row = link?.parentElement;
    if (!el || !link || !row) return;
    const fit = () => {
      if (!el.isConnected || !row.clientWidth) return;
      const cs = getComputedStyle(row);
      const gap = parseFloat(cs.columnGap) || 0;
      let others = 0;
      for (const kid of Array.from(row.children)) if (kid !== link) others += (kid as HTMLElement).getBoundingClientRect().width + gap;
      const room = row.getBoundingClientRect().width - others - 1;
      const twin = el.cloneNode(false) as HTMLSpanElement;
      twin.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;display:inline-block;white-space:nowrap;width:auto;max-width:none;overflow:visible";
      link.appendChild(twin);
      let pick = forms.length - 1;
      for (let i = 0; i < forms.length; i += 1) {
        twin.textContent = forms[i]!;
        if (twin.getBoundingClientRect().width <= room + 0.5) {
          pick = i;
          break;
        }
      }
      twin.remove();
      setStep(pick);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <span ref={ref} className="block overflow-hidden whitespace-nowrap" title={step > 0 ? name : undefined}>
      {forms[Math.min(step, forms.length - 1)]}
    </span>
  );
}

/** 1.4.65 (Oscar): the card's subline (service – date – time) on one line: if the full form does not
    fit, the date drops its weekday. Words shorten, the font never shrinks. */
function FitLine({ forms, className }: { forms: string[]; className?: string }) {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLParagraphElement | null>(null);
  const key = forms.join("|");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (!el.isConnected || !el.clientWidth) return;
      const room = el.getBoundingClientRect().width - 1;
      const twin = document.createElement("span");
      twin.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap";
      el.appendChild(twin);
      let pick = forms.length - 1;
      for (let i = 0; i < forms.length; i += 1) {
        twin.textContent = forms[i]!;
        if (twin.getBoundingClientRect().width <= room) {
          pick = i;
          break;
        }
      }
      twin.remove();
      setStep(pick);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <p ref={ref} className={cn("relative", className)} data-card-subline>
      {forms[Math.min(step, forms.length - 1)]}
    </p>
  );
}
