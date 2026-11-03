import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageComposer, WhatsAppButton } from "@/components/message-composer";
import { ChevronDown, Download, Pencil, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { formatDay, formatTime, frequencyLabel, money, payDueLabel, telHref, weekdayLabel } from "@/lib/format";
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
  const [askDelete, setAskDelete] = useState(false);
  const [askOff, setAskOff] = useState(false);
  const [askOn, setAskOn] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<ClientFormValue | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [payAsk, setPayAsk] = useState(false);
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const presets = settingsQ.data?.abonoPresets;

  const q = useQuery({
    queryKey: ["client", numericId],
    queryFn: () => getClient({ data: { id: numericId } }),
    enabled: Number.isFinite(numericId),
    refetchOnWindowFocus: false,
  });

  const data = q.data;
  const client = data?.client;

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
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
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
          <section className="min-w-0 max-w-full overflow-hidden rounded-xl bg-surface p-4 shadow-card">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm text-muted">
                  {client.kind === "one_time"
                    ? tx("Trabajo de una vez", "One-time job")
                    : `${frequencyLabel(client.cutsPerMonth, {
                        frequencyDays: client.frequencyDays,
                        weekday2: client.weekday2,
                      })} · ${weekdayLabel(client.weekday)}${
                        client.weekday2 != null && client.cutsPerMonth === 5
                          ? ` ${tx("y", "and")} ${weekdayLabel(client.weekday2)}`
                          : ""
                      }`}
                </p>
                <p className="mt-1 break-words font-display text-2xl font-semibold tabular-nums sm:text-3xl lg:text-4xl">
                  {money(client.pricePerCut)}
                  <span className="ml-1 text-base font-medium text-muted">
                    {client.kind === "regular" ? tx("/ corte", "/ cut") : ""}
                  </span>
                </p>
                {timeLabel && (
                  <p className="mt-1 text-sm font-semibold text-pending">
                    {tx(`Llegada ${timeLabel}`, `Arrival ${timeLabel}`)}
                  </p>
                )}
                {client.startDate && client.kind === "regular" && (
                  <p className="text-sm text-muted">
                    {tx(`Desde ${formatDay(client.startDate, "d MMM yyyy")}`, `Since ${formatDay(client.startDate, "d MMM yyyy")}`)}
                  </p>
                )}
                {client.lastCutDate && (
                  <p className="text-sm text-muted">
                    {tx(
                      `Último corte ${formatDay(client.lastCutDate, "d MMM")}`,
                      `Last cut ${formatDay(client.lastCutDate, "d MMM")}`,
                    )}
                  </p>
                )}
                {!client.paySameDay && client.payDueDay ? (
                  <p className="text-sm text-muted">{payDueLabel(client.payDueDay)}</p>
                ) : null}
                {client.tripleCut ? (
                  <p className="mt-1 text-sm font-semibold text-pending">
                    {tx(`${client.cutsThisMonth} cortes este mes`, `${client.cutsThisMonth} cuts this month`)}
                  </p>
                ) : null}
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-1 sm:max-w-[11rem] sm:flex-col sm:items-end">
                {client.paySameDay ? (
                  <button
                    type="button"
                    onClick={() => setPayAsk(true)}
                    className="max-w-full rounded-full bg-money-bg px-2.5 py-1 text-left text-xs font-semibold leading-snug text-money"
                  >
                    {tx("Paga el mismo día", "Pays the same day")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPayAsk(true)}
                    className="max-w-full rounded-full bg-pending-bg px-2.5 py-1 text-left text-xs font-semibold leading-snug text-pending"
                  >
                    {tx("Se acumula", "It adds up")}
                  </button>
                )}
                {!client.isActive && (
                  <span className="rounded-full bg-soil-bg px-2.5 py-1 text-xs font-semibold text-soil">
                    {tx("En archivos", "In archive")}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-2">
              {client.phone && (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <ConfirmLink
                    href={telHref(client.phone)}
                    kind="call"
                    name={client.name}
                    className="flex min-h-12 min-w-0 flex-1 basis-40 items-center gap-2 rounded-md bg-sun px-3 text-sm font-medium break-all"
                  >
                    <Phone className="size-4" />
                    {client.phone}
                  </ConfirmLink>
                  <MessageComposer phone={client.phone} name={client.name} compact />
                  <WhatsAppButton phone={client.phone} name={client.name} />
                </div>
              )}
              {client.address && <AddressLine address={client.address} name={client.name} />}
              {client.cue ? <CueChip text={client.cue} className="w-fit" /> : null}
              {client.highRisk ? (
                <p className="text-sm font-semibold text-late">
                  {emphasize(tx("Alto riesgo: la deuda lleva tiempo sin pagarse.", "High risk: the debt has gone unpaid for a while."))}
                </p>
              ) : null}
              {client.blacklisted ? (
                <p className="text-sm font-semibold">
                  {tx("En lista negra. No se agenda solo.", "On the blacklist. It is not scheduled on its own.")}
                </p>
              ) : null}
              {client.notes && <p className="text-sm text-muted">{client.notes}</p>}
            </div>
          </section>

          <section className="mt-4 min-w-0 max-w-full overflow-hidden rounded-xl border-l-4 border-money bg-money-bg p-4 shadow-card">
            <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted uppercase">
              {tx("Deuda", "Debt")}
              <Hint topic="ficha-deuda" />
            </p>
            <div className="mt-2 grid min-w-0 grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">{tx("Monto acumulado", "Amount owed")}</p>
                <p className="break-words font-display text-2xl font-semibold tabular-nums text-money sm:text-3xl">
                  {money(client.balance)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">{tx("Adelanto", "Advance")}</p>
                <p className="break-words font-display text-2xl font-semibold tabular-nums text-done sm:text-3xl">
                  {money(client.credit)}
                </p>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">
              {tx(`Cobrado en total: ${money(client.collectedTotal)}`, `Collected in total: ${money(client.collectedTotal)}`)}
            </p>
            <MoneyCalc value={draftAmount} onChange={setDraftAmount} presets={presets} />
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-3">
              <Button
                variant="money"
                disabled={client.balance <= 0 && !draftAmount}
                onClick={() => setPaying("full")}
              >
                {tx("Pagado", "Paid")}
              </Button>
              <Button variant="outline" disabled={client.balance <= 0} onClick={() => setPaying("abono")}>
                {tx("Abono", "Partial")}
              </Button>
              <Button variant="outline" onClick={() => setPaying("prepaid")}>
                {tx("Adelanto", "Advance")}
              </Button>
            </div>
            <div className="mt-2">
              <WaiveButton clientId={client.id} balance={client.balance} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ServicePause id={client.id} name={client.name} paused={client.servicePaused} labeled />
            </div>
            <Button variant="outline" className="mt-3" onClick={() => setShowExtra((v) => !v)}>
              {tx("Trabajo extra", "Extra job")}
            </Button>
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

          {(data?.payments ?? []).length > 0 && (
            <section className="mt-4 rounded-xl bg-surface p-4 shadow-card">
              <h2 className="font-display text-lg font-semibold">{tx("Movimientos", "Activity")}</h2>
              <ul className="mt-2 grid gap-1">
                {(data?.payments ?? []).map((p) => (
                  <li key={p.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{payKindLabel(p, tx)}</span>
                      <span className="text-muted"> · {formatDay(stampDay(p.paidAt), "d MMM")}</span>
                      {methodLabel(p.method) ? <span className="text-muted"> · {methodLabel(p.method)}</span> : null}
                    </span>
                    <span className={cn(p.kind === "waived" ? "text-muted" : p.kind === "opening" ? "font-semibold tabular-nums text-due" : "font-semibold tabular-nums")}>
                      {p.kind === "waived" ? "—" : money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ChangeHistory clientId={client.id} />

          <section className="mt-4">
            <h2 className="mb-2 font-display text-lg font-semibold">{tx("Notas del cliente", "Client notes")}</h2>
            <ClientNotes key={client.id} clientId={client.id} clientName={client.name} initial={client.richNotes} />
          </section>

          <div className="mt-4">
            <Button variant="outline" onClick={() => setEditing(true)}>
              {tx("Editar", "Edit")}
            </Button>
          </div>

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
              {client.daysSincePay != null
                ? tx(
                    ` · ${client.daysSincePay} días desde el último pago o corte`,
                    ` · ${client.daysSincePay} days since the last payment or cut`,
                  )
                : ""}
            </p>
          </section>

          {PHOTOS_ENABLED ? <ClientPhotos clientId={client.id} photos={data?.photos ?? []} /> : null}

          <section className="mt-8">
            <h2 className="mb-1 font-display text-lg font-semibold">{tx("Próximos cortes", "Upcoming cuts")}</h2>
            <p className="mb-3 text-sm text-muted">
              {tx(
                "La regla sigue en la ficha. Si mueves una fecha, no vuelve al día viejo.",
                "The rule stays on the file. If you move a date, it does not go back to the old day.",
              )}
            </p>
            <UpcomingCuts jobs={(data?.jobs ?? []).filter((j) => j.status === "pending")} />
          </section>

          <section className="mt-8">
            <HistoryBlock
              clientId={client.id}
              since={client.startDate || client.createdAt}
              paid={client.collectedTotal}
              jobs={(data?.jobs ?? []).filter((j) => j.status !== "pending")}
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
            title={tx(`¿Pasar a archivos a ${client.name}?`, `Move ${client.name} to the archive?`)}
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
            title={tx(`¿Reactivar a ${client.name}?`, `Reactivate ${client.name}?`)}
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
            title={tx(`¿Eliminar a ${client.name}?`, `Delete ${client.name}?`)}
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
    <section className="mt-4 rounded-xl bg-surface p-4 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-display text-lg font-semibold">{tx("Cambios hechos", "Changes made")}</span>
        <span className="text-sm font-medium text-muted">{open ? tx("Cerrar", "Close") : tx("Ver", "View")}</span>
      </button>
      {open ? (
        <ul className="mt-2 grid gap-1">
          {(q.data ?? []).length === 0 ? (
            <li className="text-sm text-muted">{tx("Todavía no hay cambios registrados.", "There are no recorded changes yet.")}</li>
          ) : (
            (q.data ?? []).map((c) => (
              <li key={c.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{c.summary}</span>
                  <span className="text-muted"> · {formatDay(stampDay(c.createdAt), "d MMM")}</span>
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

function payKindLabel(p: PaymentRow, tx: (es: string, en: string) => string) {
  if (p.kind === "opening") return tx("Deuda anterior", "Earlier debt");
  if (p.kind === "prepaid") return tx("Adelanto", "Advance");
  if ((p.note ?? "").toLowerCase().includes("abono")) return tx("Abono", "Partial");
  return tx("Pagado", "Paid");
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
  const linked = useQuery({
    queryKey: ["pad-client", clientId],
    queryFn: () => listPadForClient({ data: { clientId } }),
    refetchOnWindowFocus: false,
  });
  const people = useQuery({
    queryKey: ["clients", "mentions"],
    queryFn: () => listClients({ data: {} }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
    <div>
      <p className="mb-2 text-sm text-muted">{t("notes.placeholder")}</p>
      <Input
        value={find}
        onChange={(e) => setFind(e.target.value)}
        placeholder={t("notes.search")}
        aria-label={t("notes.search")}
        className="mb-2"
      />
      {query && !ownHit && pages.length === 0 ? <p className="mb-2 text-sm text-muted">{t("notes.empty")}</p> : null}
      {pages.length > 0 ? (
        <ul className="mb-3 grid gap-2">
          {pages.map((page) => (
            <li key={page.id} className="rounded-md bg-surface px-3 py-2 shadow-card">
              <Link to="/notas" search={{ page: page.id, back: `cliente:${clientId}` }} className="font-semibold text-primary">
                {page.pinned ? "• " : ""}
                {page.title || t("notes.title")}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-muted">{notePlain(page.body)}</p>
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
      <p className="mt-1 text-xs text-muted">{saved ? t("notes.saved") : tx("Se guarda al salir del texto", "Saves when you leave the text")}</p>
    </div>
  );
}

function WaiveButton({ clientId, balance }: { clientId: number; balance: number }) {
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
      <Button variant="outline" className="w-full" disabled={balance <= 0 || mut.isPending} onClick={() => setOpen(true)}>
        {tx("Perdonar", "Forgive")}
      </Button>
      <ConfirmDialog
        open={open}
        title={tx(`¿Perdonar el saldo de ${money(balance)}?`, `Forgive the balance of ${money(balance)}?`)}
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
      className="mt-3 grid gap-3 rounded-xl bg-sun p-4"
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
      <div>
        <Label>{tx("¿Qué hay que hacer?", "What needs to be done?")}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx("Poda, limpieza, fertilizante…", "Trim, cleanup, fertilizer…")}
          required
        />
        <TaskPresets
          presets={settingsQ.data?.taskPresets ?? DEFAULT_TASK_PRESETS}
          onPick={setTitle}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["settings"] })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{tx("Precio extra", "Extra price")}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <MoneyCalc value={amount} onChange={setAmount} />
        </div>
        <div>
          <Label>{tx("Día de inicio", "Start day")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <ArrivalField
        value={time}
        presets={settingsQ.data?.arrivalPresets ?? DEFAULT_ARRIVAL_PRESETS}
        onChange={setTime}
      />
      <div>
        <Label>{tx("Nota", "Note")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" disabled={mut.isPending}>
        {mut.isPending ? tx("Guardando…", "Saving…") : tx("Añadir extra", "Add extra")}
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
  if (jobs.length === 0) return <p className="text-sm text-muted">{tx("No hay cortes pendientes.", "There are no pending cuts.")}</p>;
  return (
    <>
    <div className="grid gap-2">
      {jobs.map((job) => (
        <div key={job.id} className="grid min-w-0 gap-2 rounded-xl bg-surface p-3 shadow-card">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words text-sm font-semibold">{job.title || tx("Corte de césped", "Lawn cut")}</p>
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
}: {
  clientId: number;
  since: string | null;
  paid: number;
  jobs: JobRow[];
}) {
  const tx = useTx();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(`ols-hist-${clientId}`) === "1";
    } catch {
      return false;
    }
  });
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
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          try {
            localStorage.setItem(`ols-hist-${clientId}`, next ? "1" : "0");
          } catch {
            /* ignore */
          }
        }}
        className="flex min-h-11 w-full items-center gap-2 text-left"
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", !open && "-rotate-90")} />
        <h2 className="font-display text-lg font-semibold">{tx("Historial", "History")}</h2>
      </button>
      <p className="mt-1 text-sm tabular-nums text-muted">
        {tx(
          `${done} ${done === 1 ? "patio hecho" : "patios hechos"} · Pagado ${money(paid)} · ${yearLabel}`,
          `${done} ${done === 1 ? "yard done" : "yards done"} · Paid ${money(paid)} · ${yearLabel}`,
        )}
      </p>
      {open ? (
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
                <p className={cn("truncate font-medium", quad || dense ? "text-xs" : "text-base")}>{job.title || tx("Corte", "Cut")}</p>
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
