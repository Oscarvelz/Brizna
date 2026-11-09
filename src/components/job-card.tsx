import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Ban, Check, Clock, GripVertical, MapPin, Phone, Pin, RotateCcw, Scissors, TriangleAlert } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AddressLine, hasAddress } from "@/components/address-line";
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
import { MeshNameUniform } from "@/components/mesh-name";
import { addDaysISO, stampDay, todayISO } from "@/lib/dates";
import { FREQ_SEP, formatDay, formatTime, jobKindLabel, mapsHref, money, telHref } from "@/lib/format";
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
  // 1.5.18 (Oscar): the address stays hidden on the card; a long-press on the map button reveals it.
  const [showAddr, setShowAddr] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
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
  // 1.5.28 (Oscar): the status pill in the contact row carries the days too («Tarde · 1 día»,
  // «Pendiente · en 5 días»), so nobody has to open the details card just to read them.
  const dayDiff = Math.round((Date.parse(job.scheduledDate) - Date.parse(today)) / 86400000);
  const statusDetail = late
    ? tx(`· ${-dayDiff} día${-dayDiff === 1 ? "" : "s"}`, `· ${-dayDiff} day${-dayDiff === 1 ? "" : "s"}`)
    : live.computedStatus === "pending" && dayDiff > 0
      ? tx(`· en ${dayDiff} día${dayDiff === 1 ? "" : "s"}`, `· in ${dayDiff} day${dayDiff === 1 ? "" : "s"}`)
      : undefined;
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

  // 1.5.18 (Oscar): the pin is BARE — no tone box anywhere. On Grande/Media it lives tucked into the
  // card's top corner (see the header); Hecho and Posponer own their whole row again. Same tap, same
  // confirm dialog.
  // 1.5.26 (Oscar): its COLOR now follows the whole app (folds, Agenda, the inventory pin): rose only
  // when pinned («se vuelve rosado cuando están seleccionados»), colorless muted when not — the card
  // pins were the odd ones out, wearing the rose outline even when unpinned.
  const pinButton = (
    <button
      type="button"
      aria-label={job.pinned ? tx("Quitar de fijados", "Unpin") : tx("Fijar en Hoy", "Pin on Today")}
      onClick={onPin}
      className={cn(
        "grid size-8 shrink-0 place-items-center -mr-2 -translate-y-0.5",
        job.pinned ? "text-[color:var(--tone-pin)]" : "text-muted",
      )}
    >
      {/* 1.5.20 (Oscar, fine-tuning): the whole button leans 8 px right (-mr-2 above) so the pin glyph
          sits almost on the map button's right-edge line below it.
          1.5.22 (Oscar): it also rises 2 px with the name and the price, onto the grip dots' center line. */}
      <Pin className={cn(media ? "size-4" : "size-[18px]", job.pinned && "fill-current")} />
    </button>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={askDone}
        stack
        title={<>{tx("¿Cómo cerrar a ", "Close ")}<span className="bz-dialog-who"><span className="bz-dialog-name">{job.clientName}</span>{tx("?", "'s cut?")}</span></>}
        aside={<>{tx("Corte", "Cut")} <b>{money(job.amount)}</b></>}
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
        title={<>{tx("¿Abono de ", "Partial payment for ")}<span className="bz-dialog-who"><span className="bz-dialog-name">{job.clientName}</span>?</span></>}
        aside={<>{tx("Corte", "Cut")} <b>{money(job.amount)}</b></>}
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
        title={<>{tx("¿Volver a pendiente a ", "Move back to pending: ")}<span className="bz-dialog-who"><span className="bz-dialog-name">{job.clientName}</span>{tx("?", "")}</span></>}
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
        icon={<Pin />}
        iconTone="pin"
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
    // 1.4.79 (Oscar): one name size for every tile (last name to line 2 at that size, never a per-card shrink);
    // the date and the price share a row ("2 nov ······ $40", price bigger); phone/map sit beside Hecho at the foot.
    const hecho = pending ? (
      <Button
        size="sm"
        className={cn("bz-jq-done relative min-w-0 flex-1 gap-0.5 px-1", cols === 2 ? "h-9 text-xs" : "h-8 text-[11px]", cols === 4 && "after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] [&_svg]:size-3")}
        data-spot="hecho propina"
        aria-label={cols === 4 ? tx(`Hecho: ${job.clientName}`, `Done: ${job.clientName}`) : undefined}
        onClick={onHecho}
        disabled={complete.isPending}
      >
        {cols === 4 ? <Check strokeWidth={3} /> : null}
        {tx("Hecho", "Done")}
      </Button>
    ) : null;
    return (
      <>
        <article
          className={cn(
            "bz-jq bz-cq flex h-full min-w-0 flex-col rounded-2xl bg-surface shadow-card ring-1 ring-primary/25",
            `is-c${cols}`,
            late && "bg-late-bg bz-late-card bz-late-glow",
          )}
        >
          <div className="flex min-w-0 items-start gap-1">
            {dragHandle && pending && cols === 2 ? (
              <span className="grid size-6 shrink-0 place-items-center text-muted" data-drag-handle aria-hidden>
                <GripVertical className="size-3.5" />
              </span>
            ) : null}
            <Link to="/clientes/$id" params={{ id: String(job.clientId) }} className="min-w-0 flex-1">
              <MeshNameUniform name={job.clientName} cols={cols} />
            </Link>
          </div>
          <div className="bz-jq-foot mt-auto">
            <p className="bz-jq-row">
              <span className="bz-jq-date">
                {live.status === "done" ? <Check className="size-3.5 shrink-0 text-done" strokeWidth={3} aria-label={tx("Hecho", "Done")} /> : null}
                {job.scheduledDate ? formatDay(job.scheduledDate, "d MMM") : ""}
              </span>
              <span className="bz-jq-price">{money(job.amount)}</span>
            </p>
            {cols === 2 && postponed ? (
              <Button size="sm" variant="outline" className="mt-1.5 h-8 w-full px-1 text-xs" onClick={() => setAskReturn(true)}>
                {tx("Deshacer pospuesto", "Undo postpone")}
              </Button>
            ) : null}
            {cols === 2 ? (
              <div className="bz-jq-acts">
                <ContactIcons phone={job.clientPhone} address={job.clientAddress} name={job.clientName} tight variant="some" className="flex-nowrap" />
                {hecho}
              </div>
            ) : hecho ? (
              <div className="bz-jq-acts">{hecho}</div>
            ) : null}
          </div>
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
            late && "bg-late-bg bz-late-card bz-late-glow",
          )}
        >
          {/* 1.5.20 (Oscar): Lista has NO six-dot grip — the bare pin takes the left edge where the grip
              stood. (Route order is still dragged in Grande/Media and via Agenda's Mover.) */}
          <button
            type="button"
            aria-label={job.pinned ? tx("Quitar de fijados", "Unpin") : tx("Fijar en Hoy", "Pin on Today")}
            onClick={onPin}
            // 1.5.18 (Oscar): no box at all — the bare pin (1.5.17's smaller hit area stays).
            // 1.5.26 (Oscar): same color rule as the wide card — rose only when pinned, muted when not.
            className={cn("grid size-6 shrink-0 place-items-center", job.pinned ? "text-[color:var(--tone-pin)]" : "text-muted")}
          >
            <Pin className={cn("size-3", job.pinned && "fill-current")} />
          </button>
          <Link
            to="/clientes/$id"
            params={{ id: String(job.clientId) }}
            className="min-w-0 flex-1 truncate text-sm font-semibold"
          >
            {job.clientName}
          </Link>
          {/* 1.5.20 (Oscar): never write the cue in a Lista row — a bubble that only says «Pista»; a tap opens it. */}
          {job.clientCue ? <CueChip bubble name={job.clientName} text={job.clientCue} /> : null}
          {/* 1.4.68 (Oscar): WA, Mensaje, Llamar - Mensaje sits next to the phone */}
          {job.clientPhone ? <WhatsAppButton phone={job.clientPhone} name={job.clientName} tight /> : null}
          {job.clientPhone ? (
            <MessageComposer phone={job.clientPhone} name={job.clientName} compact tight />
          ) : null}
          {queued ? <span className="shrink-0 text-xs font-semibold text-hold">{tx("Aquí", "Here")}</span> : null}
          {postponed ? (
            <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={() => setAskReturn(true)} aria-label={tx("Deshacer pospuesto", "Undo postpone")}>
              {tx("Volver", "Back")}
            </Button>
          ) : null}
          {pending ? (
            <Button size="sm" className="h-8 shrink-0 px-2 text-xs" data-spot="hecho propina" onClick={onHecho} disabled={complete.isPending}>
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
        late && media && "bz-late-glow",
        !late && live.computedStatus === "pending" && "ring-1 ring-pending/25",
        !late && live.computedStatus === "done" && "ring-1 ring-done/20",
        !late && isOnce && "border-l-4 border-pending bg-pending-bg",
        !late && isExtra && "border-l-4 border-money",
        !late && job.kind === "cut" && "border-l-4 border-today",
      )}
    >
      {/* 1.5.18 (Oscar, correcting 1.5.12 from his phone): the header is his 1.4.64/1.4.80 arrangement
          again — the name at its original size, shrink-wrapped; the price right after it in the neutral
          grey (text-fg/70), 19px Grande / 14px Media — not large green at the far corner; and the BARE
          pin tucked into the top corner. What 1.5.12 keeps: the service - date line, the ONE wide row
          of contact buttons, and the status band. The address now hides behind a long-press on the map
          button, and Hecho/Posponer own their whole row (the pin left it). Spec doc updated the same day. */}
      <div className="min-w-0">
        {/* 1.5.20 (Oscar): the header row centers its children — the six grip dots, the name and the pin
            share one optical line (before, items-start left the dots riding off the name's line). */}
        <div className={cn("flex min-w-0 items-center", media ? "gap-2" : "gap-3")}>
          {/* 1.5.23 (Oscar): the six dots are ALWAYS here, right where the name would begin — «no los
              remueva, solamente quería que se nivelaran». When this card cannot be dragged (Fijados,
              Agenda, a done yard) the dots are a still anchor with no handle in them; the name follows
              after them on the same line, a poquito to the right, and every card's name shares one line. */}
          <span
            className={cn("grid size-8 shrink-0 place-items-center rounded-sm text-muted -ml-2", dragHandle && pending && "touch-none", !media && "bz-grip-lg")}
            {...(dragHandle && pending ? { "data-drag-handle": true } : {})}
            aria-hidden
          >
            {/* 1.5.22 (Oscar): same logic as the pin's -mr-2 — the grip leans 8 px left (-ml-2 above) so
                its six dots sit on the message button's left-edge line below. */}
            <GripVertical className="size-4" />
          </span>
          {/* 1.5.20 (Oscar, fine-tuning): gap 12→14 px — the price breathes "un poquito" more off the name.
              1.5.22 (Oscar): name + price rise 2 px (-translate-y-0.5) to level with the grip dots' center line. */}
          <div className="flex min-w-0 flex-1 items-center gap-3.5 -translate-y-0.5" data-name-room>
            <Link
              to="/clientes/$id"
              params={{ id: String(job.clientId) }}
              className={cn(
                "min-w-0 font-display font-semibold hover:underline",
                media ? "text-[1.25rem] leading-none" : "text-[1.3rem] leading-snug",
              )}
            >
              <MeshNameUniform name={job.clientName} cols={2} size={media ? "jmedia" : "jgrande"} fit />
            </Link>
            <span
              data-price
              className={cn(
                // 1.5.20 (Oscar, fine-tuning): the price rides a touch high next to the bigger serif name;
                // 2 px down (1 px on Media) and its optical center meets the name's and the pin's line.
                "shrink-0 font-display font-semibold leading-none tabular-nums text-fg/70",
                media ? "text-sm translate-y-px" : "text-[1.1875rem] translate-y-0.5",
              )}
            >
              {money(job.amount)}
            </span>
          </div>
          {pinButton}
        </div>
        {/* 1.5.25 (Oscar): the line opens with a super-tiny scissors, quiet (fg/50), «no llamativo,
            solo que parezca bien hecho». (Its seat moved in 1.5.32 — see below.) */}
        {/* 1.5.32 (Oscar, experimento — «te puedo decir reviértelo»): the scissors move OUT from under
            the name to the grip's own column: the line starts at the grip's box (-ml-1, w-8 slot,
            icon centered = under the six dots) and the gap is sized so the TEXT lands exactly on
            the name's first letter (Grande: 8 + 32 + 12 = 52; Media: 8 + 32 + 8 = 48). Before, the
            icon sat on the name's letter line and pushed the text past it. */}
        <div className={cn("flex min-w-0 items-center", media ? "mt-1 -ml-2 gap-2" : "mt-2 -ml-2 gap-3")}>
          <span className="grid w-8 shrink-0 place-items-center" aria-hidden>
            <Scissors className={cn("shrink-0 text-fg/50", media ? "size-2.5" : "size-3")} strokeWidth={2.2} />
          </span>
          <FitLine
            underName
            className={cn("min-w-0 flex-1 font-medium leading-tight text-fg/75", media ? "text-xs" : "text-sm")}
            sizes={media ? [0.6875] : undefined}
            // 1.5.29 (Oscar): the dates COME BACK to the work line, beside the instruction — his call,
            // reversing 1.5.27's removal. This time an en dash (–) separates the parts «para que se
            // vea más bonito»: «Corte de césped – Lun 9 nov», with the arrival time after another one
            // when there is one. Same forms as the original line, new dash.
            forms={[
              [jobKindLabel(job.kind, job.title), capFirst(formatDay(job.scheduledDate, "EEE d MMM")), timeLabel].filter(Boolean).join(" – "),
              [jobKindLabel(job.kind, job.title), formatDay(job.scheduledDate, "d MMM"), timeLabel].filter(Boolean).join(" – "),
            ]}
            lastResort={[jobKindLabel(job.kind, job.title), formatDay(job.scheduledDate, "d MMM")].filter(Boolean).join(" – ")}
          />
        </div>
        {/* 1.5.28 (Oscar): the four contact buttons no longer stretch across the card — they sit
            compact at the left, like the client file's row that «respira mejor», and the status
            rides in THIS row as a pill at the right (with its days), instead of a full-width band
            below. The pill still opens the status details card. Only Grande/Media change;
            Lista and Malla keep their own rows. */}
        <div className={cn("flex min-w-0 flex-wrap items-center", media ? "mt-2 gap-1.5" : "mt-3 gap-2")} data-contact-row>
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
          {hasAddress(job.clientAddress) ? (
            <ConfirmLink
              href={mapsHref(job.clientAddress)}
              kind="maps"
              name={job.clientName}
              onLongPress={() => setShowAddr((v) => !v)}
              className="bz-tone bz-tone-map grid size-11 shrink-0 place-items-center rounded-sm"
            >
              <MapPin className="size-[18px]" />
              <span className="sr-only">{tx("Mapa", "Map")}</span>
            </ConfirmLink>
          ) : null}
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer transition active:scale-[0.97]"
            onClick={() => setShowStatus(true)}
            aria-label={tx(`Detalles del estado de ${job.clientName}`, `${job.clientName}: status details`)}
          >
            <StatusBadge status={live.computedStatus} detail={statusDetail} />
          </button>
        </div>
        {job.clientCue ? <CueChip text={job.clientCue} className="mt-1.5" /> : null}
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

      {/* 1.5.18 (Oscar): no address line by default — the map button is enough. It appears, whole and
          on one line as before, only while revealed by a long-press on the map button. */}
      {showAddr && hasAddress(job.clientAddress) && (
        <AddressLine address={job.clientAddress} name={job.clientName} compact oneLine className={media ? "mt-2" : "mt-3"} />
      )}

      {pending && !compact && (
        // 1.5.31 (Oscar): a little more air between the contact/pill row and Hecho/Posponer
        // («deja un espacio pequeñito entre ellos») — the action row's top margin goes 8 → 12 px.
        <div className={cn("flex items-center", media ? "mt-3 gap-1.5" : "mt-3 gap-2")}>
          <Button data-spot="hecho propina" onClick={onHecho} disabled={complete.isPending} className={cn("min-w-0 flex-1", !media && "gap-1.5 px-2 text-[15px] [&_svg]:size-[18px]")} size={media ? "sm" : "md"}>
            <Check />
            {tx("Hecho", "Done")}
          </Button>
          {/* 1.4.61 (Oscar): Posponer is a real button in the action row, not a loose line under it */}
          <Button variant="outline" onClick={() => setAskPost(true)} className={cn("bz-tone bz-tone-post min-w-0 flex-1 whitespace-nowrap", !media && "gap-1.5 px-2 text-[15px] [&_svg]:size-[18px]")} size={media ? "sm" : "md"}>
            <Clock />
            {tx("Posponer", "Postpone")}
          </Button>
          {/* 1.5.18: no pin in this row — Hecho and Posponer split the whole width equally, as before. */}
        </div>
      )}

      {postponed && !compact && (
        <Button variant="outline" className="mt-1.5 h-9 w-full" size="sm" onClick={() => setAskReturn(true)}>
          <RotateCcw />
          {tx("Deshacer pospuesto", "Undo postpone")}
        </Button>
      )}

      {completedToday && !compact && (
        <div className={cn("flex items-center", media ? "mt-2 gap-1.5" : "mt-2 gap-2")}>
          <Button variant="ghost" className="h-9 min-w-0 flex-1 text-muted" size="sm" onClick={() => setAskUndo(true)}>
            <RotateCcw />
            {tx("Deshacer Hecho", "Undo Done")}
          </Button>
        </div>
      )}

      {/* 1.5.18: no bottom pin row anymore — every Grande/Media card carries its one bare pin in the
          top corner (header), whatever its state. */}
    </article>
    {dialogs}
    {showStatus ? <StatusInfoCard job={job} today={today} onClose={() => setShowStatus(false)} /> : null}
    </>
  );
}

/** 1.5.23 (Oscar): the little card behind the status band — designed, not loose: the client's name,
 *  the state as its own pill, and a few truthful rows (due date, days late or days away, price).
 *  1.5.25 (Oscar): a more premium finish — the name stands clearly above the rest (text-xl), the dates
 *  open with a capital («Jueves 5 de noviembre»), a status-tinted hairline crowns the card, the headline
 *  travels on a soft tinted band with its icon, and Cerrar is the primary button. */
function StatusInfoCard({ job, today, onClose }: { job: JobRow; today: string; onClose: () => void }) {
  const tx = useTx();
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const diff = Math.round((Date.parse(job.scheduledDate) - Date.parse(today)) / 86400000);
  const rows: Array<[string, string]> = [];
  let headline: string | null = null;
  if (job.computedStatus === "late") {
    const n = -diff;
    headline = n === 1 ? tx("Lleva 1 día de retraso", "1 day overdue") : tx(`Lleva ${n} días de retraso`, `${n} days overdue`);
    rows.push([tx("Debió hacerse", "Was due"), cap(formatDay(job.scheduledDate, "EEEE d 'de' MMMM"))]);
    if (job.originDate && job.originDate !== job.scheduledDate) {
      rows.push([tx("Día original", "Original day"), cap(formatDay(job.originDate, "EEE d 'de' MMM"))]);
    }
    if (job.postponeReason) rows.push([tx("Razón", "Reason"), job.postponeReason]);
  } else if (job.computedStatus === "pending") {
    headline =
      diff === 0
        ? tx("Es para hoy", "It's for today")
        : diff === 1
          ? tx("Es mañana", "It's tomorrow")
          : tx(`Faltan ${diff} días`, `${diff} days away`);
    rows.push([tx("Programado", "Scheduled"), cap(formatDay(job.scheduledDate, "EEEE d 'de' MMMM"))]);
  } else if (job.computedStatus === "done") {
    rows.push([
      tx("Se hizo", "Done on"),
      cap(formatDay(job.completedAt ? stampDay(job.completedAt) : job.scheduledDate, "EEEE d 'de' MMMM")),
    ]);
  } else {
    rows.push([tx("Programado", "Scheduled"), cap(formatDay(job.scheduledDate, "EEEE d 'de' MMMM"))]);
  }
  rows.push([tx("Precio", "Price"), money(job.amount)]);
  const accent =
    job.computedStatus === "late"
      ? { bar: "bg-late", band: "bg-late-bg text-late", Icon: TriangleAlert }
      : job.computedStatus === "done"
        ? { bar: "bg-done", band: "bg-done-bg text-done", Icon: Check }
        : job.computedStatus === "cancelled"
          ? { bar: "bg-muted", band: "bg-surface-2 text-muted", Icon: Ban }
          : { bar: "bg-pending", band: "bg-pending-bg text-pending", Icon: Clock };
  const HeadIcon = accent.Icon;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-6 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-xs overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={job.clientName}
      >
        <div className={cn("h-1.5 w-full", accent.bar)} aria-hidden />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-display text-xl font-semibold leading-tight tracking-tight">{job.clientName}</p>
            <StatusBadge status={job.computedStatus} />
          </div>
          {headline ? (
            <p className={cn("mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", accent.band)}>
              <HeadIcon className="size-4 shrink-0" strokeWidth={2.4} />
              {headline}
            </p>
          ) : null}
          <dl className="mt-2 divide-y divide-border/60">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
                <dd className="min-w-0 text-right text-[15px] font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-fg shadow-sm transition active:scale-[0.99]"
          >
            {tx("Cerrar", "Close")}
          </button>
        </div>
      </div>
    </div>
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

/** 1.4.67 (Oscar): the name grows to use the room it has (between `minRem` and `maxRem`), still one
    line. A long name first drops its middle names (as before) and never goes below `minRem`. */
export function OneLineName({ name, minRem, maxRem }: { name: string; minRem?: number; maxRem?: number }) {
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
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const minPx = minRem ? minRem * rootPx : 0;
      const maxPx = maxRem ? maxRem * rootPx : 0;
      const twin = el.cloneNode(false) as HTMLSpanElement;
      twin.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;display:inline-block;white-space:nowrap;width:auto;max-width:none;overflow:visible";
      if (minPx) twin.style.fontSize = `${minPx}px`;
      link.appendChild(twin);
      let pick = forms.length - 1;
      let size = minPx;
      for (let i = 0; i < forms.length; i += 1) {
        twin.textContent = forms[i]!;
        const w = twin.getBoundingClientRect().width;
        if (w <= room + 0.5) {
          pick = i;
          if (minPx && maxPx && w > 0) size = Math.max(minPx, Math.min(maxPx, Math.floor((minPx * (room - 2)) / w * 4) / 4));
          break;
        }
      }
      twin.remove();
      if (minPx) el.style.fontSize = `${size}px`;
      setStep(pick);
    };
    fit();
    // 1.4.70: re-fit on the next frame, not inside the observer (changing the font there re-sized the row it
    // watches: "ResizeObserver loop" on big width jumps such as releasing a floating-window resize).
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; fit(); });
    });
    ro.observe(row);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, minRem, maxRem]);
  return (
    <span ref={ref} data-card-name className="block overflow-hidden whitespace-nowrap" title={step > 0 ? name : undefined}>
      {forms[Math.min(step, forms.length - 1)]}
    </span>
  );
}

/** The card's subline (service – date – time) on one line, never cut. 1.4.65: if the full form does not
    fit, the date drops its weekday. 1.4.67 (Oscar): the name above stays the widest line, so the subline
    takes the first option narrower than the name: full, no weekday, then a slightly smaller font (never
    under 0.8rem). If none is narrower (a very short name), it takes the narrowest that fits. */
/** 1.4.80: the frequency–day dash renders muted (.bz-sep); the text itself (and its measured width) is unchanged. */
function sepParts(text: string): ReactNode {
  if (!text.includes(FREQ_SEP)) return text;
  return text.split(FREQ_SEP).map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? <span className="bz-sep">{FREQ_SEP}</span> : null}
      {part}
    </Fragment>
  ));
}

export function FitLine({ forms, className, underName, lastResort, sizes }: { forms: string[]; className?: string; underName?: boolean; lastResort?: string; /** 1.4.76: try these smaller sizes for each form before dropping to the next form. */ sizes?: number[] }) {
  const [pick, setPick] = useState<{ i: number; rem: number | null }>({ i: 0, rem: null });
  const ref = useRef<HTMLParagraphElement | null>(null);
  const all = lastResort && lastResort !== forms[forms.length - 1] ? [...forms, lastResort] : forms;
  const key = all.join("|");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nameEl = underName ? (el.previousElementSibling?.querySelector("[data-card-name]") as HTMLElement | null) : null;
    // 1.4.68 fix (Oscar: the subline trembled): measure every option from the BASE font, never from the
    // size picked last time (the twin used to inherit it, so 0.8125rem and the normal size kept flipping),
    // read the name's real text width rather than its box, and re-fit only when a measured width really
    // changes (hysteresis), so a pick can never feed the next measurement.
    let last = "";
    const fit = () => {
      if (!el.isConnected || !el.clientWidth) return;
      const room = el.getBoundingClientRect().width - 1;
      let nameW = Infinity;
      if (nameEl && nameEl.isConnected) {
        const nt = document.createElement("span");
        nt.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap";
        nt.style.font = getComputedStyle(nameEl).font;
        nt.textContent = nameEl.textContent ?? "";
        nameEl.appendChild(nt);
        nameW = nt.getBoundingClientRect().width;
        nt.remove();
      }
      const sig = `${Math.round(room)}|${Number.isFinite(nameW) ? Math.round(nameW) : "x"}`;
      if (sig === last) return;
      last = sig;
      const cap = Number.isFinite(nameW) ? nameW - 10 : Infinity;
      const inline = el.style.fontSize;
      el.style.fontSize = "";
      const basePx = getComputedStyle(el).fontSize;
      el.style.fontSize = inline;
      const twin = document.createElement("span");
      twin.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap";
      el.appendChild(twin);
      const options: { i: number; rem: number | null }[] = sizes
        ? forms.flatMap((_, i) => [{ i, rem: null }, ...sizes.map((rem) => ({ i, rem }))])
        : forms.map((_, i) => ({ i, rem: null }));
      if (underName && !sizes) for (const rem of [0.8125, 0.8]) for (let i = 0; i < forms.length; i += 1) options.push({ i, rem });
      // still wider than the name: the time goes (Oscar: weekday first, then time), at the normal size if it fits
      if (underName && all.length > forms.length) for (const rem of [null, 0.8125, 0.8]) options.push({ i: forms.length, rem });
      let best: { i: number; rem: number | null } | null = null;
      let narrowest: { o: { i: number; rem: number | null }; w: number } | null = null;
      for (const o of options) {
        twin.style.fontSize = o.rem ? `${o.rem}rem` : basePx;
        twin.textContent = all[o.i]!;
        const w = twin.getBoundingClientRect().width;
        if (w > room) continue;
        if (o.i < forms.length && (!narrowest || w < narrowest.w)) narrowest = { o, w }; // a fallback keeps the time
        if (w <= cap) {
          best = o;
          break;
        }
      }
      twin.remove();
      const next = best ?? (underName && narrowest ? narrowest.o : { i: forms.length - 1, rem: null });
      setPick((prev) => (prev.i === next.i && prev.rem === next.rem ? prev : next));
    };
    fit();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; fit(); });
    });
    ro.observe(el);
    if (nameEl) ro.observe(nameEl);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, underName, sizes?.join(",")]);
  return (
    <p ref={ref} className={cn("relative whitespace-nowrap", className)} style={pick.rem ? { fontSize: `${pick.rem}rem` } : undefined} data-card-subline>
      {sepParts(all[Math.min(pick.i, all.length - 1)]!)}
    </p>
  );
}
