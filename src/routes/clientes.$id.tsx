import { WideSplit } from "@/components/wide-layout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageComposer, WhatsAppButton } from "@/components/message-composer";
import { Search, Archive, CalendarCheck, CalendarClock, CalendarDays, ChevronDown, Clock, Download, HandHeart, NotebookPen, Pencil, Phone, Plus, ReceiptText, Scissors, ShieldAlert, Sparkles, StickyNote, Wallet, History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AddressLine } from "@/components/address-line";
import { AppShell } from "@/components/app-shell";
import { CueChip } from "@/components/cue-chip";
import {
  ArrivalField,
  ClientForm,
  formFromClient,
  payloadFromForm,
  TaskPresets,
  type ClientFormValue,
} from "@/components/client-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfirmLink } from "@/components/confirm-link";
import { Hint } from "@/components/hint";
import { OffDayDialog, shiftToMonday, useRareDay } from "@/components/off-day-ask";
import { ScrollTop } from "@/components/scroll-top";
import { JobCard, invalidateLawn } from "@/components/job-card";
import { MoneyCalc } from "@/components/money-calc";
import { PayDialog, type PayMode } from "@/components/pay-dialog";
import { RichNotes } from "@/components/rich-notes";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { stampDay, todayISO } from "@/lib/dates";
import { meshFrame, viewGrid } from "@/lib/density";
import { DEFAULT_ARRIVAL_PRESETS, DEFAULT_TASK_PRESETS } from "@/lib/types";
import { DEFAULT_CUT_TITLE, FREQ_SEP, formatDay, formatTime, frequencyLabel, jobKindLabel, money, payDueLabel, telHref, weekdayLabel } from "@/lib/format";
import { downloadHref } from "@/lib/save-file";
import { emphasize, useI18n, useTx } from "@/lib/i18n";
import { noteMatches, notePlain } from "@/lib/note-search";
import { DensityScope, DensityToggle, useDensity, useQuadCols } from "@/components/density-toggle";
import { methodLabel } from "@/components/method-field";
import { PhotoPicker } from "@/components/photo-picker";
import { PHOTOS_ENABLED } from "@/lib/photos-flag";
import { ServicePause } from "@/components/service-pause";
import {
  addClientPhoto,
  addExtraJob,
  adjustJobAmount,
  clearJobPhoto,
  deleteClient,
  deleteClientPhoto,
  getClient,
  getJobPhoto,
  getSettings,
  listClientChanges,
  listClients,
  listPadForClient,
  recordPayment,
  rescheduleJob,
  restoreClientChange,
  saveClientNotes,
  setBlacklist,
  setClientActive,
  updateClient,
  updatePayMode,
} from "@/lib/server/lawn";
import type { ClientPhoto, JobRow, PaymentRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clientKey, rowFromLists } from "@/lib/client-warm";
import { whenIdle } from "@/lib/study-warm";

export const Route = createFileRoute("/clientes/$id")({
  component: function ClientRoute() {
    return (
      <DensityScope scope="ficha">
        <ClientDetailPage />
      </DensityScope>
    );
  },
});

function ClientDetailPage() {
  const tx = useTx();
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [paying, setPaying] = useState<PayMode | null>(null);
  // 1.4.80 (Oscar: tapping Abono/Adelanto left the pill stuck on Pagado): the segmented control keeps its own selection.
  const [seg, setSeg] = useState<PayMode>("full");
  const [askDelete, setAskDelete] = useState(false);
  const [askOff, setAskOff] = useState(false);
  const [askOn, setAskOn] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<ClientFormValue | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [payAsk, setPayAsk] = useState(false);
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const presets = settingsQ.data?.abonoPresets;

  // 1.4.95 (Oscar: the file opened as one empty box): the row the Clientes list already holds paints the card at
  // once; cuts, movements and photos arrive from the file's own reading a moment later.
  const q = useQuery({
    queryKey: clientKey(numericId),
    queryFn: () => getClient({ data: { id: numericId } }),
    enabled: Number.isFinite(numericId),
    refetchOnWindowFocus: false,
    placeholderData: () => {
      const row = rowFromLists(qc, numericId);
      return row ? { client: row, jobs: [] as JobRow[], payments: [] as PaymentRow[], photos: [] as ClientPhoto[] } : undefined;
    },
  });

  const data = q.data;
  const client = data?.client;
  const seeded = q.isPlaceholderData;
  const painted = useAfterPaint();

  const save = useMutation({
    mutationFn: (value: ClientFormValue) =>
      updateClient({ data: { id: numericId, ...payloadFromForm(value) } }),
    onSuccess: async (_res, value) => {
      for (const photo of value.pendingPhotos) {
        await addClientPhoto({ data: { clientId: numericId, data: photo } }).catch(() => undefined);
      }
      toast.success(tx("Datos actualizados", "Details updated"));
      setEditing(false);
      setPendingEdit(null);
      await invalidateLawn(qc);
    },
    onError: () => toast.error(tx("No se pudo guardar", "Could not save")),
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      setClientActive({ data: { id: numericId, isActive: !(client?.isActive ?? true) } }),
    onSuccess: async () => {
      toast(client?.isActive ? tx("Movido a Archivos", "Moved to Archive") : tx("Cliente reactivado", "Client reactivated"));
      setAskOff(false);
      setAskOn(false);
      await invalidateLawn(qc);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteClient({ data: { id: numericId } }),
    onSuccess: async () => {
      toast(tx("Cliente eliminado", "Client deleted"));
      await invalidateLawn(qc);
      await navigate({ to: "/clientes" });
    },
  });

  if (q.isLoading) {
    return (
      <AppShell title={tx("Cliente", "Client")}>
        <ClientCardShimmer />
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title={tx("Cliente", "Client")}>
        <p className="text-muted">{tx("No se encontró este cliente.", "This client was not found.")}</p>
      </AppShell>
    );
  }

  const timeLabel = formatTime(client.arrivalTime);

  return (
    <AppShell
      title={client.name}
      titleExtra={
        <button
          type="button"
          aria-label={tx("Editar", "Edit")}
          onClick={() => setEditing(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Pencil className="size-4" />
        </button>
      }
    >
      <ScrollTop />
      {editing ? (
        <div>
          <ClientForm
            initial={formFromClient(client)}
            submitLabel={tx("Guardar cambios", "Save changes")}
            pending={save.isPending}
            onSubmit={(v) => setPendingEdit(v)}
          />
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setEditing(false)}>
            {tx("Cancelar", "Cancel")}
          </Button>
          <ConfirmDialog
            open={Boolean(pendingEdit)}
            title={tx("¿Guardar cambios?", "Save changes?")}
            description={tx(
              "Se actualiza el cliente y, si cambió el horario, la agenda.",
              "The client is updated and, if the schedule changed, the calendar too.",
            )}
            confirmLabel={tx("Sí, guardar", "Yes, save")}
            pending={save.isPending}
            onConfirm={() => pendingEdit && save.mutate(pendingEdit)}
            onCancel={() => setPendingEdit(null)}
          />
        </div>
      ) : (
        <>
          <WideSplit
            sideFirst={false}
            side={
              painted ? <>
          <section className="mt-4 rounded-xl border-l-4 border-hold bg-hold-bg p-4 shadow-card">
            <h2 className="font-display text-lg font-semibold text-hold">{tx("Fiabilidad", "Reliability")}</h2>
            <p className="mt-1 text-sm">
              {emphasize(
                client.servicePaused
                ? tx(
                    "En pausa. No se le hará el patio hasta que decidas Continuar.",
                    "Paused. The yard is not done until you tap Play.",
                  )
                : client.payTier === "serio"
                ? tx("Espera seria. También está en Alto riesgo.", "Serious wait. It is also in High risk.")
                : client.payTier === "espera"
                  ? tx(
                      "En espera. Sigue debiendo y todavía no llega al límite que pusiste.",
                      "Waiting. They still owe and have not reached the limit you set.",
                    )
                  : client.balance > 0
                    ? tx(
                        "Al corriente. Debe, pero dentro del tiempo que aceptas.",
                        "On track. They owe, but within the time you accept.",
                      )
                    : tx("Al día. No tiene saldo.", "Up to date. There is no balance."),
              )}
            </p>
            <p className="mt-2 text-sm tabular-nums">
              {tx(`Puntaje ${client.reliability}`, `Score ${client.reliability}`)}
              {client.daysSincePay != null && client.balance > 0 && !client.lastPaidDate
                ? tx(" · Sin pagos todavía", " · No payments yet")
                : client.daysSincePay != null
                ? tx(
                    ` · ${client.daysSincePay} ${client.daysSincePay === 1 ? "día" : "días"} desde el último pago o corte`,
                    ` · ${client.daysSincePay} ${client.daysSincePay === 1 ? "day" : "days"} since the last payment or cut`,
                  )
                : ""}
            </p>
          </section>

          {PHOTOS_ENABLED && !seeded ? <ClientPhotos clientId={client.id} photos={data?.photos ?? []} /> : null}

          <section className="mt-8">
            <h2 className="mb-1 font-display text-lg font-semibold">{tx("Próximos cortes", "Upcoming cuts")}</h2>
            <p className="mb-3 text-sm text-muted">
              {tx(
                "La regla sigue en la ficha. Si mueves una fecha, no vuelve al día viejo.",
                "The rule stays on the file. If you move a date, it does not go back to the old day.",
              )}
            </p>
            {seeded ? <ShimmerCards n={2} /> : <UpcomingCuts jobs={(data?.jobs ?? []).filter((j) => j.status === "pending")} />}
          </section>

          <section id="historial" data-spot="historial" className="mt-8">
            <HistoryBlock
              clientId={client.id}
              since={client.startDate || client.createdAt}
              paid={client.collectedTotal}
              jobs={(data?.jobs ?? []).filter((j) => j.status !== "pending")}
              loading={seeded}
            />
          </section>

          <div className="mt-10 grid gap-2">
            <Button
              variant="secondary"
              onClick={() => (client.isActive ? setAskOff(true) : setAskOn(true))}
            >
              {client.isActive ? tx("Mover a archivos", "Move to archive") : tx("Reactivar", "Reactivate")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void setBlacklist({ data: { id: client.id, blacklisted: !client.blacklisted } }).then(async () => {
                  toast(client.blacklisted ? tx("Salió de la lista negra", "Left the blacklist") : tx("Pasó a la lista negra", "Added to the blacklist"));
                  await invalidateLawn(qc);
                });
              }}
            >
              {client.blacklisted ? tx("Quitar de la lista negra", "Remove from the blacklist") : tx("Pasar a lista negra", "Add to the blacklist")}
            </Button>
            <Button variant="ghost" className="text-late" onClick={() => setAskDelete(true)}>
              {tx("Eliminar para siempre", "Delete forever")}
            </Button>
          </div>

              </> : null
            }
          >
          <section className="bz-cl-card min-w-0 max-w-full overflow-hidden rounded-xl bg-surface p-4 shadow-card">
            {/* 1.4.75 (Oscar: "ajusta finamente, con mejor contraste y organización"): header = frequency chip + since
                meta on the left, price on the right; the rest of the facts share one strip of tone chips. */}
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="bz-fact is-freq">
                  <CalendarDays aria-hidden />
                  {client.kind === "one_time"
                    ? tx("Trabajo de una vez", "One-time job")
                    : (
                      <>
                        {frequencyLabel(client.cutsPerMonth, {
                          frequencyDays: client.frequencyDays,
                          weekday2: client.weekday2,
                        })}
                        <span className="bz-sep">{FREQ_SEP}</span>
                        {`${weekdayLabel(client.weekday)}${
                          client.weekday2 != null && client.cutsPerMonth === 5
                            ? ` ${tx("y", "and")} ${weekdayLabel(client.weekday2)}`
                            : ""
                        }`}
                      </>
                    )}
                </span>
                {client.startDate && client.kind === "regular" ? (
                  <p className="bz-cl-meta">
                    {tx(`Desde ${formatDay(client.startDate, "d MMM yyyy")}`, `Since ${formatDay(client.startDate, "d MMM yyyy")}`)}
                  </p>
                ) : null}
              </div>
              <p className="bz-cl-price shrink-0 text-right font-display font-semibold tabular-nums">
                {money(client.pricePerCut)}
                {client.kind === "regular" ? <span className="bz-cl-per">{tx("/ corte", "/ cut")}</span> : null}
              </p>
            </div>
            <div className="bz-facts mt-3">
              {timeLabel ? (
                <span className="bz-fact is-arrive" title={tx(`Llegada ${timeLabel}`, `Arrival ${timeLabel}`)}>
                  <Clock aria-hidden />
                  <span className="bz-long">{tx(`Llegada ${timeLabel}`, `Arrival ${timeLabel}`)}</span>
                  <span className="bz-short">{timeLabel}</span>
                </span>
              ) : null}
              {client.lastCutDate ? (
                <span className="bz-fact">
                  <CalendarCheck aria-hidden />
                  {tx(`Último corte ${formatDay(client.lastCutDate, "d MMM")}`, `Last cut ${formatDay(client.lastCutDate, "d MMM")}`)}
                </span>
              ) : null}
              {client.tripleCut ? (
                <span className="bz-fact is-arrive">
                  <Scissors aria-hidden />
                  <span className="bz-long">{tx(`${client.cutsThisMonth} cortes este mes`, `${client.cutsThisMonth} cuts this month`)}</span>
                  <span className="bz-short">{tx(`${client.cutsThisMonth} cortes`, `${client.cutsThisMonth} cuts`)}</span>
                </span>
              ) : null}
              {!client.paySameDay && client.payDueDay ? (
                <span className="bz-fact">
                  <CalendarClock aria-hidden />
                  {payDueLabel(client.payDueDay)}
                </span>
              ) : null}
              <button type="button" onClick={() => setPayAsk(true)} className={cn("bz-fact", client.paySameDay ? "is-money" : "is-arrive")}>
                <Wallet aria-hidden />
                {client.paySameDay ? tx("Paga el mismo día", "Pays the same day") : tx("Se acumula", "It adds up")}
              </button>
              {!client.isActive ? (
                <span className="bz-fact is-soil">
                  <Archive aria-hidden />
                  {tx("En archivos", "In archive")}
                </span>
              ) : null}
            </div>

            <div className="bz-cl-rows mt-3 grid min-w-0 gap-2">
              {client.phone && (
                <div className="bz-cl-contact flex min-w-0 items-center gap-2">
                  <ConfirmLink
                    href={telHref(client.phone)}
                    kind="call"
                    name={client.name}
                    label={tx(`Llamar a ${client.name}: ${client.phone}`, `Call ${client.name}: ${client.phone}`)}
                    className="bz-inset bz-cl-phone flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md bg-sun pr-3 pl-1.5 text-sm font-semibold tabular-nums"
                  >
                    <span className="bz-tone bz-tone-call grid size-8 shrink-0 place-items-center rounded-sm">
                      <Phone className="size-4" />
                    </span>
                    <span className="min-w-0 whitespace-nowrap">{client.phone}</span>
                  </ConfirmLink>
                  <MessageComposer phone={client.phone} name={client.name} compact />
                  <WhatsAppButton phone={client.phone} name={client.name} />
                </div>
              )}
              {client.address && <AddressLine address={client.address} name={client.name} />}
              {client.cue && !client.notes ? <CueChip full text={client.cue} className="w-fit" /> : null}
              {client.notes ? (
                <div className="bz-inset bz-cl-note flex min-w-0 items-start gap-2.5 rounded-md bg-sun px-3 py-2.5">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-soil" aria-hidden />
                  <p className="min-w-0 text-sm leading-relaxed">
                    {client.cue ? <CueChip full text={client.cue} className="mr-1.5 align-[1px]" /> : null}
                    {client.notes}
                  </p>
                </div>
              ) : null}
              {client.highRisk ? <RiskBanner days={client.daysSincePay} /> : null}
              {client.blacklisted ? (
                <p className="text-sm font-semibold">
                  {tx("En lista negra. No se agenda solo.", "On the blacklist. It is not scheduled on its own.")}
                </p>
              ) : null}
            </div>
          </section>

          <section data-spot="ficha-deuda" className="bz-debt mt-4 min-w-0 max-w-full overflow-hidden rounded-xl border-l-4 border-money bg-money-bg p-4 shadow-card">
            {/* 1.4.75 (Oscar: "necesita un toque más premium y ajuste fino"): one header line, figures with Perdonar,
                chip rows that fill evenly, one segmented pay control, then Trabajo extra | Pausa on one line. */}
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {tx("Deuda", "Debt")}
                <Hint topic="ficha-deuda" />
              </p>
              <span className="bz-fact is-money is-sm" title={tx("Cobrado en total", "Collected in total")}>
                <ReceiptText aria-hidden />
                {tx("Cobrado", "Collected")}
                <span className="bz-xl">{tx(" en total", " in total")}</span> <b>{money(client.collectedTotal)}</b>
              </span>
            </div>
            <div className="bz-debt-figs mt-2">
              <div className="min-w-0">
                <p className="bz-debt-lbl text-xs font-medium text-muted">{tx("Monto acumulado", "Amount owed")}</p>
                <p className="bz-debt-num text-money">{money(client.balance)}</p>
              </div>
              <div className="min-w-0">
                <p className="bz-debt-lbl text-xs font-medium text-muted">{tx("Adelanto", "Advance")}</p>
                <p className="bz-debt-num text-done">{money(client.credit)}</p>
              </div>
              <WaiveButton clientId={client.id} balance={client.balance} name={client.name} />
            </div>
            <MoneyCalc value={draftAmount} onChange={setDraftAmount} presets={presets} />
            {(() => {
              const opts: { k: PayMode; label: string; off: boolean }[] = [
                { k: "full", label: tx("Pagado", "Paid"), off: client.balance <= 0 && !draftAmount },
                { k: "abono", label: tx("Abono", "Partial"), off: client.balance <= 0 },
                { k: "prepaid", label: tx("Adelanto", "Advance"), off: false },
              ];
              const live = opts.find((o) => o.k === seg && !o.off) ?? opts.find((o) => !o.off) ?? opts[2]!;
              const idx = opts.indexOf(live);
              return (
                <div
                  className="bz-seg mt-3"
                  role="radiogroup"
                  aria-label={tx("Registrar un pago", "Record a payment")}
                  style={{ ["--i" as string]: idx } as React.CSSProperties}
                >
                  <span className="bz-seg-ind" aria-hidden />
                  {opts.map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      role="radio"
                      aria-checked={o === live}
                      className={cn("bz-seg-btn", o === live && "is-sel")}
                      disabled={o.off}
                      onClick={() => {
                        setSeg(o.k);
                        setPaying(o.k);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="bz-debt-row mt-3">
              <button
                type="button"
                aria-expanded={showExtra}
                className={cn("bz-actbtn is-extra", showExtra && "is-on")}
                onClick={() => setShowExtra((v) => !v)}
              >
                <Plus aria-hidden />
                <span className="bz-long">{tx("Trabajo extra", "Extra job")}</span>
                <span className="bz-short">{tx("Extra", "Extra")}</span>
              </button>
              <ServicePause id={client.id} name={client.name} paused={client.servicePaused} labeled />
            </div>
            {showExtra ? <ExtraForm clientId={client.id} onDone={() => setShowExtra(false)} /> : null}
            {client.servicePaused ? (
              <p className="mt-2 text-sm font-semibold text-hold">
                {emphasize(
                  tx(
                    "En pausa. No entra a Hoy ni a la agenda hasta que decidas Continuar. El caso queda en En espera.",
                    "Paused. They stay off Today and the schedule until you tap Play. The case stays in Waiting.",
                  ),
                )}
              </p>
            ) : null}
          </section>

          {paying && (
            <PayDialog
              open
              mode={paying}
              clientId={client.id}
              name={client.name}
              balance={client.balance}
              credit={client.credit}
              defaultAmount={draftAmount}
              presets={presets}
              onClose={() => setPaying(null)}
            />
          )}

          {seeded ? (
            client.collectedTotal > 0 || client.lastPaidDate ? <MovesBlock clientId={client.id} payments={[]} loading /> : null
          ) : (data?.payments ?? []).length > 0 ? <MovesBlock clientId={client.id} payments={data?.payments ?? []} /> : null}

          <ChangeHistory clientId={client.id} />

          <ClientNotes key={client.id} clientId={client.id} clientName={client.name} initial={client.richNotes} />

          <div className="mt-4">
            <button type="button" className="bz-actbtn is-edit" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              {tx("Editar ficha", "Edit file")}
            </button>
          </div>

          </WideSplit>
          <ConfirmDialog
            open={payAsk}
            title={tx("¿Cómo paga este cliente?", "How does this client pay?")}
            description={
              client.paySameDay
                ? tx(
                    "Ahora cobra al marcar Hecho. Si cambias a Se acumula, el precio entra a la deuda hasta que marques Pagado o Perdonar.",
                    "It charges when you mark Done. If you switch to It adds up, the price goes into the debt until you mark Paid or Forgive.",
                  )
                : tx(
                    "Ahora el precio se suma a la deuda. Si cambias a Paga el mismo día, cobras al marcar Hecho.",
                    "The price is added to the debt. If you switch to Pays the same day, you collect when you mark Done.",
                  )
            }
            confirmLabel={
              client.paySameDay
                ? tx("Cambiar a se acumula", "Switch to it adds up")
                : tx("Cambiar a paga el mismo día", "Switch to pays the same day")
            }
            onConfirm={() => {
              void updatePayMode({ data: { id: client.id, paySameDay: !client.paySameDay } })
                .then(() => invalidateLawn(qc))
                .then(() => toast.success(tx("Forma de cobro actualizada", "Payment setup updated")))
                .catch(() => toast.error(tx("No se pudo guardar", "Could not save")));
              setPayAsk(false);
            }}
            onCancel={() => setPayAsk(false)}
          />
          <ConfirmDialog
            open={askOff}
            title={<>{tx("¿Pasar a archivos a ", "Move ")}<span className="bz-dialog-who"><span className="bz-dialog-name">{client.name}</span>{tx("?", " to the archive?")}</span></>}
            description={tx(
              "Sale de la agenda. Queda guardado en Archivos con todos sus datos.",
              "They leave the schedule. They stay saved in Archive with all their data.",
            )}
            confirmLabel={tx("Mover a archivos", "Move to archive")}
            pending={toggleActive.isPending}
            onConfirm={() => toggleActive.mutate()}
            onCancel={() => setAskOff(false)}
          />
          <ConfirmDialog
            open={askOn}
            title={<>{tx("¿Reactivar a ", "Reactivate ")}<span className="bz-dialog-who"><span className="bz-dialog-name">{client.name}</span>?</span></>}
            description={tx(
              "Vuelve a la agenda con su horario y su cuenta.",
              "They return to the schedule with their times and their account.",
            )}
            confirmLabel={tx("Sí, reactivar", "Yes, reactivate")}
            pending={toggleActive.isPending}
            onConfirm={() => toggleActive.mutate()}
            onCancel={() => setAskOn(false)}
          />
          <ConfirmDialog
            open={askDelete}
            title={<>{tx("¿Eliminar a ", "Delete ")}<span className="bz-dialog-who"><span className="bz-dialog-name is-late">{client.name}</span>?</span></>}
            description={tx(
              "Se borra el cliente y todo su historial. Esta acción no se puede deshacer.",
              "The client and their whole history are deleted. This cannot be undone.",
            )}
            confirmLabel={tx("Eliminar", "Delete")}
            danger
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
            onCancel={() => setAskDelete(false)}
          />
        </>
      )}
    </AppShell>
  );
}

function ChangeHistory({ clientId }: { clientId: number }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["client-changes", clientId],
    queryFn: () => listClientChanges({ data: { clientId } }),
    enabled: open,
  });
  const restore = useMutation({
    mutationFn: (changeId: number) => restoreClientChange({ data: { clientId, changeId } }),
    onSuccess: async () => {
      toast.success(tx("Cambio restaurado", "Change restored"));
      setRestoreId(null);
      await invalidateLawn(qc);
      await qc.invalidateQueries({ queryKey: ["client-changes", clientId] });
    },
  });
  return (
    <section id="cambios-hechos" data-spot="cambios-hechos" className="bz-fold mt-4 rounded-xl bg-surface p-4 shadow-card">
      <FoldHead
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={tx("Cambios hechos", "Changes made")}
        icon={<History aria-hidden />}
        chip={open && q.data ? String(q.data.length) : null}
        topic="cambios-hechos"
      />
      {open ? (
        <ul className="bz-fold-list">
          {(q.data ?? []).length === 0 ? (
            <li className="bz-fold-empty"><History aria-hidden />{tx("Todavía no hay cambios registrados.", "There are no recorded changes yet.")}</li>
          ) : (
            (q.data ?? []).map((c) => (
              <li key={c.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="bz-mov-main">
                  <span className="bz-mov-kind is-plain">{c.summary}</span>
                  <span className="bz-mov-sub">{formatDay(stampDay(c.createdAt), "d MMM")}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setRestoreId(c.id)}>
                  {tx("Restaurar", "Restore")}
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <ConfirmDialog
        open={restoreId != null}
        title={tx("¿Restaurar este cambio?", "Restore this change?")}
        description={tx(
          "Vuelven los datos de ese momento. Se guarda un registro nuevo por si quieres deshacer.",
          "The data from that moment comes back. A new record is saved in case you want to undo.",
        )}
        confirmLabel={tx("Sí, restaurar", "Yes, restore")}
        pending={restore.isPending}
        onConfirm={() => restoreId != null && restore.mutate(restoreId)}
        onCancel={() => setRestoreId(null)}
      />
    </section>
  );
}

/** 1.4.91: the tone each movement reads in (dot + word). */
function payKindTone(p: PaymentRow) {
  if (p.kind === "opening") return "is-opening";
  if (p.kind === "prepaid") return "is-prepaid";
  if (p.kind === "waived") return "is-waived";
  if (p.amount <= 0 && (p.tip ?? 0) > 0) return "is-tip";
  if ((p.note ?? "").toLowerCase().includes("abono")) return "is-abono";
  return "is-paid";
}

function payKindLabel(p: PaymentRow, tx: (es: string, en: string) => string) {
  if (p.kind === "opening") return tx("Deuda anterior", "Earlier debt");
  if (p.kind === "prepaid") return tx("Adelanto", "Advance");
  if (p.kind === "waived") return tx("Perdonado", "Forgiven");
  if (p.amount <= 0 && (p.tip ?? 0) > 0) return tx("Propina", "Tip");
  if ((p.note ?? "").toLowerCase().includes("abono")) return tx("Abono", "Partial");
  return tx("Pagado", "Paid");
}

/** One-line fold header shared by Historial, Movimientos and Cambios hechos: chevron, title, chip, (?). */
function FoldHead({
  open,
  onToggle,
  title,
  icon,
  chip,
  chipLoading = false,
  topic,
}: {
  chipLoading?: boolean;
  open: boolean;
  onToggle: () => void;
  title: string;
  icon?: React.ReactNode;
  chip?: React.ReactNode;
  topic: string;
}) {
  return (
    <div className="bz-fh-head">
      <button type="button" aria-expanded={open} onClick={onToggle} className="bz-fh-btn">
        <ChevronDown className={cn("bz-fh-chev", !open && "-rotate-90")} aria-hidden />
        {icon ? <span className="bz-fold-ic">{icon}</span> : null}
        <h2 className="bz-fh-title font-display">{title}</h2>
        {chipLoading ? <span className="bz-shim is-chip is-fold" aria-hidden /> : chip != null && chip !== "" ? <span className="bz-fold-chip">{chip}</span> : null}
      </button>
      <Hint topic={topic} />
    </div>
  );
}

function useFoldMemory(key: string) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [open, toggle] as const;
}

/** Movimientos (1.4.75): every money movement on this client, closed by default and remembered per client. */
function MovesBlock({ clientId, payments, loading = false }: { clientId: number; payments: PaymentRow[]; loading?: boolean }) {
  const tx = useTx();
  const [open, toggle] = useFoldMemory(`ols-mov-${clientId}`);
  const cashIn = payments
    .filter((p) => p.kind === "paid" || p.kind === "prepaid")
    .reduce((sum, p) => Math.round((sum + p.amount) * 100) / 100, 0);
  return (
    <section id="movimientos" data-spot="movimientos" className="bz-fold mt-4 rounded-xl bg-surface p-4 shadow-card">
      <FoldHead
        open={open}
        onToggle={toggle}
        title={tx("Movimientos", "Activity")}
        icon={<Wallet aria-hidden />}
        chipLoading={loading}
        chip={
          <>
            {payments.length}
            <span className="bz-sep">{FREQ_SEP}</span>
            {money(cashIn)}
          </>
        }
        topic="movimientos"
      />
      {open && loading ? (
        <ShimmerRows n={3} />
      ) : open ? (
        <ul className="bz-fold-list">
          {payments.map((p) => {
            const tipOnly = p.amount <= 0 && (p.tip ?? 0) > 0;
            const tip = p.tip ?? 0;
            return (
              <li key={p.id} className={cn("bz-mov", payKindTone(p))}>
                <span className="bz-mov-main">
                  <span className="bz-mov-kind">{payKindLabel(p, tx)}</span>
                  <span className="bz-mov-sub">
                    {formatDay(stampDay(p.paidAt), "d MMM")}
                    {methodLabel(p.method) ? (
                      <>
                        <span className="bz-sep">{FREQ_SEP}</span>
                        {methodLabel(p.method)}
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                  {!tipOnly && tip > 0 ? (
                    <span className="text-xs font-semibold text-done">{tx(`+${money(tip)} propina`, `+${money(tip)} tip`)}</span>
                  ) : null}
                  <span className={cn("bz-mov-amt", p.kind === "waived" && "line-through decoration-1")}>
                    {tipOnly ? money(tip) : money(p.amount)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function ClientNotes({
  clientId,
  clientName,
  initial,
}: {
  clientId: number;
  clientName: string;
  initial: string;
}) {
  const { t } = useI18n();
  const tx = useTx();
  const dirty = useRef(false);
  const draftKey = `ols-client-note-${clientId}`;
  const [html, setHtml] = useState(() => {
    try {
      const draft = sessionStorage.getItem(draftKey);
      if (typeof draft === "string" && draft !== initial) {
        dirty.current = true;
        return draft;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  const [saved, setSaved] = useState(true);
  const [find, setFind] = useState("");
  const [seen, setSeen] = useState(clientId);
  if (seen !== clientId) {
    setSeen(clientId);
    let next = initial;
    dirty.current = false;
    try {
      const draft = sessionStorage.getItem(`ols-client-note-${clientId}`);
      if (typeof draft === "string" && draft !== initial) {
        next = draft;
        dirty.current = true;
      }
    } catch {
      /* ignore */
    }
    setHtml(next);
    setSaved(next === initial);
    setFind("");
  }
  // 1.4.95: linked pages and @-mention names read once the file has painted and the phone is idle.
  const [later, setLater] = useState(false);
  useEffect(() => {
    let live = true;
    whenIdle(() => live && setLater(true), 900);
    return () => {
      live = false;
    };
  }, []);
  const linked = useQuery({
    queryKey: ["pad-client", clientId],
    queryFn: () => listPadForClient({ data: { clientId } }),
    refetchOnWindowFocus: false,
    enabled: later,
  });
  const people = useQuery({
    queryKey: ["clients", "mentions"],
    queryFn: () => listClients({ data: {} }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: later,
  });

  useEffect(() => {
    if (dirty.current || seen !== clientId) return;
    const editor = document.activeElement;
    if (editor instanceof HTMLElement && editor.dataset.noteEditor === "1") return;
    setHtml(initial);
    setSaved(true);
  }, [initial, clientId, seen]);

  const query = find.trim().toLowerCase();
  const clients = (people.data ?? [{ id: clientId, name: clientName, phone: null, cue: null }]).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    cue: c.cue,
  }));
  const ownHit = !query || noteMatches({ title: clientName, body: html, tags: "" }, query, clients);
  const pages = (linked.data ?? []).filter((page) =>
    noteMatches({ title: page.title, body: page.body, tags: page.tags }, query, clients),
  );

  return (
    <section className="bz-pad mt-4" data-spot="notas-cliente">
      <div className="bz-pad-head">
        <span className="bz-pad-ic" aria-hidden>
          <NotebookPen />
        </span>
        <h2 className="min-w-0 font-display text-lg font-semibold">{tx("Notas del cliente", "Client notes")}</h2>
        <Hint topic="notas-cliente" />
        <span
          className={cn("bz-pad-status", !saved && "is-wait")}
          role="status"
          title={saved ? undefined : tx("Se guarda al salir del texto", "Saves when you leave the text")}
        >
          {saved ? t("notes.saved") : tx("Sin guardar", "Not saved")}
        </span>
      </div>
      <label className="bz-pad-find">
        <Search aria-hidden />
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder={t("notes.search")}
          aria-label={t("notes.search")}
          type="search"
        />
      </label>
      {query && !ownHit && pages.length === 0 ? <p className="mb-2 text-sm text-muted">{t("notes.empty")}</p> : null}
      {pages.length > 0 ? (
        <ul className="mb-3 grid gap-2">
          {pages.map((page) => (
            <li key={page.id} className="bz-pad-link rounded-md px-3 py-2">
              <Link to="/notas" search={{ page: page.id, back: `cliente:${clientId}` }} className="font-semibold text-primary">
                {page.pinned ? "• " : ""}
                {page.title || t("notes.title")}
              </Link>
              <p className="bz-fade-3 mt-1 text-sm text-muted">{notePlain(page.body)}</p>
              <p className="mt-1 text-xs text-subtle">{t("notes.linked")}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <RichNotes
        cornerUndo
        draftKey={draftKey}
        value={html}
        onDraft={() => {
          dirty.current = true;
        }}
        onChange={(next) => {
          setHtml(next);
          if (next === initial) {
            setSaved(true);
            return;
          }
          dirty.current = true;
          setSaved(false);
          void saveClientNotes({ data: { id: clientId, html: next } })
            .then(() => setSaved(true))
            .catch(() => toast.error(t("notes.saveFail")));
        }}
        placeholder={t("notes.placeholder")}
        find={ownHit ? find : ""}
        clients={clients}
      />
    </section>
  );
}

/** 1.4.80 (Oscar: "créale un espacio único a este pequeño texto"): the high-risk note as its own alert banner — red
 *  wash + hairline, a shield chip that breathes slowly (static with reduced motion), "Alto riesgo" + how long unpaid. */
function RiskBanner({ days }: { days: number | null }) {
  const tx = useTx();
  const line =
    days != null && days > 0
      ? tx(`Lleva ${days} ${days === 1 ? "día" : "días"} sin pagar.`, `${days} ${days === 1 ? "day" : "days"} without paying.`)
      : tx("La deuda lleva tiempo sin pagarse.", "The debt has gone unpaid for a while.");
  return (
    <div className="bz-risk" role="note">
      <span className="bz-risk-ic" aria-hidden>
        <ShieldAlert />
      </span>
      <p className="bz-risk-txt">
        <b>{emphasize(tx("Alto riesgo", "High risk"))}</b>
        <span>{line}</span>
      </p>
      <Hint topic="espera" className="bz-risk-hint" />
    </div>
  );
}

function WaiveButton({ clientId, balance, name }: { clientId: number; balance: number; name?: string }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => recordPayment({ data: { clientId, kind: "waived" } }),
    onSuccess: async () => {
      toast(tx("Saldo perdonado. La cuenta vuelve a cero.", "Balance forgiven. The account goes back to zero."));
      setOpen(false);
      await invalidateLawn(qc);
    },
  });
  return (
    <>
      <button
        type="button"
        className="bz-actbtn is-forgive bz-waive"
        disabled={balance <= 0 || mut.isPending}
        aria-label={tx("Perdonar la deuda", "Forgive the debt")}
        onClick={() => setOpen(true)}
      >
        <HandHeart aria-hidden />
        <span className="bz-waive-label">{tx("Perdonar", "Forgive")}</span>
      </button>
      <ConfirmDialog
        open={open}
        title={
          name ? (
            <>
              {tx("¿Perdonar a ", "Forgive ")}
              <span className="bz-dialog-who"><span className="bz-dialog-name is-heather">{name}</span>?</span>
            </>
          ) : (
            tx(`¿Perdonar ${money(balance)} de saldo?`, `Forgive the balance of ${money(balance)}?`)
          )
        }
        aside={
          name ? (
            <>
              {tx("Debe", "Owes")} <b>{money(balance)}</b>
            </>
          ) : undefined
        }
        description={tx(
          "No se cuenta como cobrado. El dinero deja de estar por cobrar y la cuenta vuelve a cero.",
          "It does not count as collected. The money leaves To collect and the account goes back to zero.",
        )}
        confirmLabel={tx("Perdonar saldo", "Forgive balance")}
        danger
        pending={mut.isPending}
        onConfirm={() => mut.mutate()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

function ExtraForm({ clientId, onDone }: { clientId: number; onDone: () => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const rare = useRareDay();
  const [rareAsk, setRareAsk] = useState<null | { iso: string; kind: "sunday" | "free" }>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [ask, setAsk] = useState(false);
  const mut = useMutation({
    mutationFn: () =>
      addExtraJob({
        data: {
          clientId,
          title: title.trim() || "Trabajo extra",
          amount: Number(amount) || 0,
          date,
          notes,
          arrivalTime: time,
          markDone: date <= todayISO(),
        },
      }),
    onSuccess: async () => {
      toast.success(tx("Trabajo extra añadido", "Extra job added"));
      await invalidateLawn(qc);
      onDone();
    },
  });
  const n = Number(amount) || 0;
  const doneNow = date <= todayISO();
  return (
    <form
      className="bz-xf mt-3 grid gap-3 rounded-xl p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const kind = rare.kindOf(date);
        if (kind) {
          setRareAsk({ iso: date, kind });
          return;
        }
        setAsk(true);
      }}
    >
      {/* 1.4.80 (Oscar: "la ventana de trabajo extra está abandonada"): sage-mint panel that sits well on the cyan
          Deuda card, titled with its ?, price chips in full-width rows, framed chips, shorter note. */}
      <p className="bz-xf-title">
        <Sparkles aria-hidden />
        {tx("Trabajo extra", "Extra job")}
        <Hint topic="ficha-deuda" />
      </p>
      <div>
        <Label>{tx("¿Qué hay que hacer?", "What needs to be done?")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx("Poda, limpieza, fertilizante", "Trim, cleanup, fertilizer")}
          required
        />
        <TaskPresets
          presets={settingsQ.data?.taskPresets ?? DEFAULT_TASK_PRESETS}
          onPick={setTitle}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["settings"] })}
        />
      </div>
      <div className="bz-xf-pair grid gap-3">
        <div>
          <Label>{tx("Precio extra", "Extra price")}</Label>
          <div className="bz-xf-money">
            <span aria-hidden>$</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label>{tx("Día de inicio", "Start day")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="-mt-3">
        <MoneyCalc value={amount} onChange={setAmount} />
      </div>
      <ArrivalField
        value={time}
        presets={settingsQ.data?.arrivalPresets ?? DEFAULT_ARRIVAL_PRESETS}
        onChange={setTime}
      />
      <div>
        <Label>{tx("Nota", "Note")}</Label>
        <Textarea rows={3} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="bz-xf-add" disabled={mut.isPending}>
        {mut.isPending ? tx("Guardando", "Saving") : tx("Añadir extra", "Add extra")}
      </Button>
      <ConfirmDialog
        open={ask}
        title={tx(`¿Añadir extra de ${money(n)}?`, `Add an extra of ${money(n)}?`)}
        description={
          doneNow
            ? tx(
                "Como es de hoy o de antes, se marca hecho. Si hay adelanto, se cubre sin cobro extra; si no, se suma a la cuenta.",
                "Because it is today or earlier, it is marked done. If there is an advance, it is covered with no extra charge; if not, it is added to the account.",
              )
            : tx(
                "Queda pendiente en la agenda para ese día. Se puede posponer después.",
                "It stays pending on the schedule for that day. It can be postponed later.",
              )
        }
        confirmLabel={tx("Sí, añadir", "Yes, add")}
        pending={mut.isPending}
        onConfirm={() => mut.mutate()}
        onCancel={() => setAsk(false)}
      />
      <OffDayDialog
        iso={rareAsk?.iso ?? null}
        kind={rareAsk?.kind ?? null}
        onKeep={() => {
          setRareAsk(null);
          setAsk(true);
        }}
        onMonday={() => {
          const iso = rareAsk?.iso;
          setRareAsk(null);
          if (iso) setDate(shiftToMonday(iso));
          setAsk(true);
        }}
        onClose={() => setRareAsk(null)}
      />
    </form>
  );
}

const UPCOMING_FIRST = 4;
const UPCOMING_STEP = 8;

/** 1.4.95: false on the first frame, true once the browser has painted it (two frames later). */
function useAfterPaint() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setDone(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  return done;
}

/** 1.4.95: a direct open with nothing cached yet shows the client card's own shape, never a blank box. */
function ClientCardShimmer() {
  return (
    <section className="bz-cl-card bz-shim-card min-w-0 max-w-full overflow-hidden rounded-xl bg-surface p-4 shadow-card" aria-busy="true">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="bz-shim is-chip is-wide" aria-hidden />
        <span className="bz-shim is-price" aria-hidden />
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        <span className="bz-shim is-chip" aria-hidden />
        <span className="bz-shim is-chip" aria-hidden />
        <span className="bz-shim is-chip is-wide" aria-hidden />
      </div>
      <div className="mt-3 grid gap-2">
        <span className="bz-shim is-bar" aria-hidden />
        <span className="bz-shim is-bar" aria-hidden />
      </div>
    </section>
  );
}

function ShimmerRows({ n }: { n: number }) {
  return (
    <div className="bz-shim-rows" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="bz-shim is-row" aria-hidden />
      ))}
    </div>
  );
}

function ShimmerCards({ n }: { n: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="bz-shim-job grid min-w-0 gap-2 rounded-xl bg-surface p-3 shadow-card">
          <span className="bz-shim is-line" aria-hidden />
          <span className="bz-shim is-bar" aria-hidden />
        </div>
      ))}
    </div>
  );
}

function UpcomingCuts({ jobs }: { jobs: JobRow[] }) {
  const tx = useTx();
  const qc = useQueryClient();
  const rare = useRareDay();
  const [pendingDate, setPendingDate] = useState<null | { id: number; iso: string; kind: "sunday" | "free" }>(null);
  const mut = useMutation({
    mutationFn: (input: { id: number; date: string }) => rescheduleJob({ data: input }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.reason === "duplicate" ? tx("Ya hay un corte ese día.", "There is already a cut that day.") : tx("No se pudo mover.", "Could not move it."));
        return;
      }
      toast.success(tx("Fecha cambiada. No vuelve al día anterior.", "Date changed. It does not go back to the previous day."));
      await invalidateLawn(qc);
    },
  });
  // 1.4.95: a regular client can have 50+ cuts ahead; the first few draw with the page, the rest join in batches
  // while the phone is idle, so opening the file never waits on all of them.
  const [shown, setShown] = useState(UPCOMING_FIRST);
  useEffect(() => {
    if (shown >= jobs.length) return;
    let live = true;
    whenIdle(() => live && setShown((n) => n + UPCOMING_STEP), 400);
    return () => {
      live = false;
    };
  }, [shown, jobs.length]);
  if (jobs.length === 0) return <p className="text-sm text-muted">{tx("No hay cortes pendientes.", "There are no pending cuts.")}</p>;
  return (
    <>
    <div className="grid gap-2">
      {jobs.slice(0, shown).map((job) => (
        <div key={job.id} className="grid min-w-0 gap-2 rounded-xl bg-surface p-3 shadow-card">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words text-sm font-semibold">{jobKindLabel(job.kind, job.title)}</p>
            <Input
              type="date"
              value={job.scheduledDate}
              className="h-10 w-full sm:w-40"
              onChange={(e) => {
                const next = e.target.value;
                if (!next || next === job.scheduledDate) return;
                const kind = rare.kindOf(next);
                if (kind) {
                  setPendingDate({ id: job.id, iso: next, kind });
                  return;
                }
                mut.mutate({ id: job.id, date: next });
              }}
            />
          </div>
          <JobCard job={job} compact />
        </div>
      ))}
    </div>
    <OffDayDialog
      iso={pendingDate?.iso ?? null}
      kind={pendingDate?.kind ?? null}
      pending={mut.isPending}
      onKeep={() => {
        const row = pendingDate;
        setPendingDate(null);
        if (row) mut.mutate({ id: row.id, date: row.iso });
      }}
      onMonday={() => {
        const row = pendingDate;
        setPendingDate(null);
        if (row) mut.mutate({ id: row.id, date: shiftToMonday(row.iso) });
      }}
      onClose={() => setPendingDate(null)}
    />
    </>
  );
}

function yearsAsClient(iso: string | null | undefined) {
  if (!iso) return 0;
  const start = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const before =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (before) years -= 1;
  return Math.max(0, years);
}

function HistoryBlock({
  clientId,
  since,
  paid,
  jobs,
  loading = false,
}: {
  clientId: number;
  since: string | null;
  paid: number;
  jobs: JobRow[];
  /** 1.4.95: the file's own reading is still on its way (the card painted from the Clientes row). */
  loading?: boolean;
}) {
  const tx = useTx();
  const [open, toggle] = useFoldMemory(`ols-hist-${clientId}`);
  const done = jobs.filter((job) => job.status === "done").length;
  const years = yearsAsClient(since);
  const yearLabel =
    years <= 0
      ? tx("Menos de 1 año como cliente", "Less than 1 year as a client")
      : years === 1
        ? tx("1 año como cliente", "1 year as a client")
        : tx(`${years} años como cliente`, `${years} years as a client`);
  return (
    <>
      <FoldHead open={open} onToggle={toggle} title={tx("Historial", "History")} icon={<Scissors aria-hidden />} topic="historial" />
      {loading ? (
        <span className="bz-shim is-line mt-2" aria-hidden />
      ) : (
      <p className="mt-1 text-sm tabular-nums text-muted">
        {tx(
          `${done} ${done === 1 ? "patio hecho" : "patios hechos"} · Pagado ${money(paid)} · ${yearLabel}`,
          `${done} ${done === 1 ? "yard done" : "yards done"} · Paid ${money(paid)} · ${yearLabel}`,
        )}
      </p>
      )}
      {open && loading ? (
        <div className="mt-2">
          <ShimmerRows n={3} />
        </div>
      ) : open ? (
        <>
          <div className="mt-2">
            <DensityToggle />
          </div>
          <div className="mt-2">
            <JobHistory jobs={jobs} />
          </div>
        </>
      ) : null}
    </>
  );
}

function JobHistory({ jobs }: { jobs: JobRow[] }) {
  const tx = useTx();
  const qc = useQueryClient();
  const density = useDensity();
  const cols = useQuadCols();
  const dense = density === "dense";
  const media = density === "compact";
  const quad = density === "quad";
  const [photo, setPhoto] = useState<{ src: string; date: string; id: number; name: string } | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const [price, setPrice] = useState<{ id: number; value: string } | null>(null);
  if (jobs.length === 0) return <p className="text-sm text-muted">{tx("Todavía no hay trabajos hechos.", "There are no finished jobs yet.")}</p>;
  const ordered = [...jobs].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

  async function share(src: string, name: string) {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `${name}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: name, text: name });
        return;
      }
    } catch {
      /* download instead */
    }
    const link = document.createElement("a");
    link.href = src;
    link.download = `${name}.jpg`;
    link.click();
  }

  async function savePhoto(src: string, name: string) {
    const file = `${name.replace(/[^\w\s.-]+/g, "").trim().slice(0, 40) || "foto"}.jpg`;
    try {
      await downloadHref(file, src);
      toast(tx("Foto guardada en el teléfono.", "Photo saved on the phone."));
    } catch {
      toast.error(tx("No se pudo descargar la foto.", "Could not download the photo."));
    }
  }

  return (
    <>
      <ul className={viewGrid(density, cols, dense ? "gap-1" : media ? "gap-1.5" : "gap-2")}>
        {ordered.map((job) => (
          <li key={job.id} className={cn("min-w-0 overflow-hidden rounded-xl bg-surface shadow-card", quad ? meshFrame(cols) : dense ? "px-2 py-1.5" : "px-3 py-3")}>
            <div className={cn(quad ? "grid gap-1" : "flex items-center justify-between gap-2")}>
              <div className="min-w-0">
                <p className={cn("truncate font-medium", quad || dense ? "text-xs" : "text-base")}>{job.title && job.title !== DEFAULT_CUT_TITLE ? job.title : tx("Corte", "Cut")}</p>
                {!quad || cols < 4 ? <p className="truncate text-xs text-muted">{formatDay(job.scheduledDate)}</p> : null}
              </div>
              <div className={cn("flex items-center gap-2", quad ? "justify-between" : "shrink-0")}>
                {!dense && !quad ? <StatusBadge status={job.computedStatus} /> : null}
                <button
                  type="button"
                  className="text-sm font-semibold tabular-nums"
                  onClick={() => setPrice({ id: job.id, value: String(job.amount) })}
                >
                  {money(job.amount)}
                </button>
              </div>
            </div>
            {price?.id === job.id ? (
              <div className="mt-2 flex gap-2">
                <Input
                  value={price.value}
                  inputMode="decimal"
                  onChange={(e) => setPrice({ id: job.id, value: e.target.value })}
                  className="h-10"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void adjustJobAmount({ data: { id: job.id, amount: Number(price.value) || 0 } }).then(async () => {
                      setPrice(null);
                      toast.success(tx("Precio actualizado. La cuenta sigue el nuevo monto.", "Price updated. The account follows the new amount."));
                      await invalidateLawn(qc);
                    });
                  }}
                >
                  {tx("Guardar", "Save")}
                </Button>
              </div>
            ) : null}
            {job.hasPhoto ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => {
                    void getJobPhoto({ data: { id: job.id } }).then((res) => {
                      if (res.photo) setPhoto({ src: res.photo, date: res.date || job.scheduledDate, id: job.id, name: job.clientName });
                    });
                  }}
                >
                  {tx("Ver foto", "View photo")}
                </button>
                <button type="button" className="text-xs font-semibold text-late" onClick={() => setDropId(job.id)}>
                  {tx("Quitar", "Remove")}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {photo && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[85] grid place-items-end overflow-y-auto bz-scrim bz-scrim-deep p-3 sm:place-items-center sm:p-4">
              <button type="button" aria-label={tx("Cerrar", "Close")} className="absolute inset-0" onClick={() => setPhoto(null)} />
              <div className="relative my-auto w-full min-w-0 max-w-lg">
                <img src={photo.src} alt={tx(`Patio del ${photo.date}`, `Yard from ${photo.date}`)} className="max-h-[70vh] w-full rounded-xl object-contain bg-surface" />
                <p className="mt-2 text-center text-sm text-primary-fg">{formatDay(photo.date)}</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setPhoto(null)}>
                    {tx("Cerrar", "Close")}
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => void share(photo.src, `${photo.name} ${photo.date}`)}>
                    {tx("Compartir", "Share")}
                  </Button>
                  <button
                    type="button"
                    aria-label={tx("Descargar", "Download")}
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-surface text-fg"
                    onClick={() => void savePhoto(photo.src, `${photo.name} ${photo.date}`)}
                  >
                    <Download className="size-5" />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <ConfirmDialog
        open={dropId != null}
        title={tx("¿Quitar esta foto?", "Remove this photo?")}
        description={tx("La foto del corte se borra. El trabajo se queda.", "The cut photo is deleted. The job stays.")}
        confirmLabel={tx("Quitar", "Remove")}
        danger
        onConfirm={() => {
          if (dropId == null) return;
          void clearJobPhoto({ data: { id: dropId } }).then(async () => {
            setDropId(null);
            setPhoto(null);
            await invalidateLawn(qc);
          });
        }}
        onCancel={() => setDropId(null)}
      />
    </>
  );
}

function ClientPhotos({ clientId, photos }: { clientId: number; photos: ClientPhoto[] }) {
  const tx = useTx();
  const qc = useQueryClient();
  const [open, setOpen] = useState<ClientPhoto | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const [sharePhoto, setSharePhoto] = useState<ClientPhoto | null>(null);
  const [who, setWho] = useState("");
  const people = useQuery({
    queryKey: ["clients", "share"],
    queryFn: () => listClients({ data: {} }),
    enabled: sharePhoto != null,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const add = useMutation({
    mutationFn: (data: string) => addClientPhoto({ data: { clientId, data } }),
    onSuccess: async (res) => {
      if (!res.ok) toast.error(tx("No se pudo guardar la foto.", "Could not save the photo."));
      else toast.success(tx("Foto guardada en la ficha.", "Photo saved on the file."));
      await invalidateLawn(qc);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteClientPhoto({ data: { id } }),
    onSuccess: async () => {
      setDropId(null);
      setOpen(null);
      await invalidateLawn(qc);
    },
  });

  async function share(src: string, name: string, extra?: string) {
    const text = extra?.trim() ? extra.trim() : name;
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `${name}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: name, text });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
    const link = document.createElement("a");
    link.href = src;
    link.download = `${name}.jpg`;
    link.click();
    toast(tx("La foto se descargó para enviarla desde el teléfono.", "The photo downloaded so you can send it from the phone."));
  }

  async function savePhoto(src: string, name: string) {
    const file = `${name.replace(/[^\w\s.-]+/g, "").trim().slice(0, 40) || "foto"}.jpg`;
    try {
      await downloadHref(file, src);
      toast(tx("Foto guardada en el teléfono.", "Photo saved on the phone."));
    } catch {
      toast.error(tx("No se pudo descargar la foto.", "Could not download the photo."));
    }
  }

  const chosen = (people.data ?? []).find((c) => String(c.id) === who);

  return (
    <section className="mt-4 rounded-xl bg-surface p-4 shadow-card">
      <h2 className="font-display text-lg font-semibold">{tx("Fotos de la ficha", "File photos")}</h2>
      <p className="mt-1 text-sm text-muted">{tx("Productos o indicaciones. Las fotos de cada corte están en el historial, con su fecha. Desde aquí se comparten con un cliente o con otra persona.", "Products or instructions. Photos of each cut are in the history, with their date. From here they can be shared with a client or with someone else.")}</p>
      <div className="mt-3">
        <PhotoPicker onPick={(data) => add.mutate(data)} />
      </div>
      {photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" className="block w-full" onClick={() => setOpen(p)}>
                <img src={p.data} alt={p.caption || tx("Indicación", "Instruction")} className="aspect-square w-full rounded-md object-cover" />
              </button>
              <div className="mt-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => {
                    setWho("");
                    setSharePhoto(p);
                  }}
                >
                  {tx("Compartir", "Share")}
                </button>
                <button
                  type="button"
                  aria-label={tx("Descargar", "Download")}
                  className="grid size-7 place-items-center text-fg"
                  onClick={() => void savePhoto(p.data, p.caption || "ficha")}
                >
                  <Download className="size-4" />
                </button>
                <button type="button" className="text-xs font-semibold text-late" onClick={() => setDropId(p.id)}>
                  {tx("Quitar", "Remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bz-scrim bz-scrim-deep p-3 sm:p-4">
              <button type="button" className="absolute inset-0" aria-label={tx("Cerrar", "Close")} onClick={() => setOpen(null)} />
              <div className="relative my-auto w-full min-w-0 max-w-lg">
                <img src={open.data} alt={open.caption || tx("Indicación", "Instruction")} className="max-h-[70vh] w-full rounded-xl object-contain bg-surface" />
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(null)}>
                    {tx("Cerrar", "Close")}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      setWho("");
                      setSharePhoto(open);
                    }}
                  >
                    {tx("Compartir", "Share")}
                  </Button>
                  <button
                    type="button"
                    aria-label={tx("Descargar", "Download")}
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-bg text-fg"
                    onClick={() => void savePhoto(open.data, open.caption || "ficha")}
                  >
                    <Download className="size-5" />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {sharePhoto && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90] grid place-items-end overflow-y-auto bz-scrim bz-scrim-deep p-3 sm:place-items-center sm:p-4">
              <button type="button" className="absolute inset-0" aria-label={tx("Cerrar", "Close")} onClick={() => setSharePhoto(null)} />
              <div role="dialog" aria-modal="true" className="relative my-auto w-full min-w-0 max-w-md rounded-xl bg-surface p-4 shadow-card">
                <h3 className="font-display text-lg font-semibold">{tx("Compartir foto", "Share photo")}</h3>
                <p className="mt-1 text-sm text-muted">
                  {tx(
                    "Elige un cliente o déjalo en blanco para enviarla a cualquier persona. Se abre el menú del teléfono.",
                    "Pick a client or leave it blank to send it to anyone. The phone menu opens.",
                  )}
                </p>
                <label className="mt-3 block text-xs font-semibold text-muted">
                  {tx("Cliente", "Client")}
                  <NativeSelect value={who} onChange={(e) => setWho(e.target.value)} className="mt-1 bg-bg">
                    <option value="">{tx("Otra persona", "Someone else")}</option>
                    {(people.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSharePhoto(null)}>
                    {tx("Cerrar", "Close")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const photo = sharePhoto;
                      const note = chosen
                        ? tx(`Foto para ${chosen.name}`, `Photo for ${chosen.name}`)
                        : tx("Foto de la ficha", "File photo");
                      setSharePhoto(null);
                      void share(photo.data, note, note);
                    }}
                  >
                    {tx("Enviar", "Send")}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <ConfirmDialog
        open={dropId != null}
        title={tx("¿Quitar esta foto?", "Remove this photo?")}
        description={tx("Se borra de la ficha.", "It is removed from the file.")}
        confirmLabel={tx("Quitar", "Remove")}
        danger
        pending={remove.isPending}
        onConfirm={() => dropId != null && remove.mutate(dropId)}
        onCancel={() => setDropId(null)}
      />
    </section>
  );
}
